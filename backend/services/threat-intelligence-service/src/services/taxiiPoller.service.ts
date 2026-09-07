import { prisma } from "../config/prisma";
import { decryptCredential } from "../lib/crypto";
import * as taxiiClient from "../lib/taxiiClient";
import { toTaxiiCredentials } from "./taxiiServer.service";
import { ingestStixObject } from "./stixIngest.service";

const TICK_MS = 60_000;
const MAX_DUE_PER_TICK = 20;
const OBJECTS_PAGE_LIMIT = 200;

let pollTimer: ReturnType<typeof setInterval> | null = null;

interface DueCollectionId {
  id: bigint;
}

/**
 * Claims collections due for polling using Postgres's own row-locking
 * (`FOR UPDATE SKIP LOCKED`) inside one transaction, immediately stamping
 * `last_polled_at` so a second poller instance (or an overlapping tick)
 * can't claim the same row twice — identical locking idiom to
 * outboxPublisher.service.ts's claimBatch(). A collection whose poll then
 * fails gets its lastPollStatus/lastPollError updated afterwards, but its
 * "claimed" timestamp isn't rolled back — the next tick after its interval
 * elapses will simply try again.
 */
async function claimDueCollections(): Promise<bigint[]> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<DueCollectionId[]>`
      SELECT id
      FROM taxii_collections
      WHERE status = 'enabled'
        AND (last_polled_at IS NULL OR last_polled_at < now() - (poll_interval_seconds || ' seconds')::interval)
      ORDER BY last_polled_at NULLS FIRST
      LIMIT ${MAX_DUE_PER_TICK}
      FOR UPDATE SKIP LOCKED
    `;
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    await tx.taxiiCollection.updateMany({ where: { id: { in: ids } }, data: { lastPolledAt: new Date() } });
    return ids;
  });
}

// Exported for the manual "poll now" endpoint (POST /taxii-collections/:id/poll)
// — runs the exact same poll logic as a scheduled tick, just triggered
// synchronously by a human action instead of the timer.
export async function pollCollection(collectionId: bigint): Promise<void> {
  const collection = await prisma.taxiiCollection.findUnique({
    where: { id: collectionId },
    include: { taxiiServer: true },
  });
  if (!collection) return;

  const server = collection.taxiiServer;

  try {
    let apiRoot = server.apiRoot;
    const credentials = server.encryptedCredential
      ? toTaxiiCredentials(server.authType, server.encryptedCredential, decryptCredential)
      : undefined;

    if (!apiRoot) {
      apiRoot = await taxiiClient.discoverApiRoot(server.discoveryUrl, credentials);
      await prisma.taxiiServer.update({ where: { id: server.id }, data: { apiRoot } });
    }

    let next: string | null | undefined = collection.lastNextToken ?? undefined;
    let addedAfter = collection.lastAddedAfter ?? undefined;
    let latestSeen = addedAfter;
    let more = true;

    while (more) {
      const page = await taxiiClient.pollObjects(
        apiRoot,
        collection.collectionId,
        { addedAfter, next, limit: OBJECTS_PAGE_LIMIT },
        credentials,
      );

      for (const object of page.objects) {
        await ingestStixObject(prisma, object, {
          tenantId: collection.tenantId,
          taxiiServerId: server.id,
          taxiiCollectionId: collection.id,
          sourceFeedName: server.name,
        });
        const modified = object.modified ?? object.created;
        if (typeof modified === "string") {
          const modifiedDate = new Date(modified);
          if (!Number.isNaN(modifiedDate.getTime()) && (!latestSeen || modifiedDate > latestSeen)) {
            latestSeen = modifiedDate;
          }
        }
      }

      more = page.more;
      next = page.next ?? null;

      // Persist the mid-pagination cursor after every page, not just at the
      // end — a crash mid-batch resumes from the same `next` cursor rather
      // than re-processing the whole poll from scratch.
      await prisma.taxiiCollection.update({
        where: { id: collection.id },
        data: { lastNextToken: next ?? null },
      });
    }

    await prisma.taxiiCollection.update({
      where: { id: collection.id },
      data: {
        lastAddedAfter: latestSeen ?? addedAfter ?? null,
        lastNextToken: null,
        lastPollStatus: "succeeded",
        lastPollError: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`TAXII poll failed for collection ${collectionId}:`, error);
    await prisma.taxiiCollection
      .update({ where: { id: collectionId }, data: { lastPollStatus: "failed", lastPollError: message } })
      .catch(() => {});
  }
}

async function tick(): Promise<void> {
  const dueIds = await claimDueCollections();
  // Sequential, not parallel — a slow/unreachable TAXII server shouldn't
  // starve the connection pool for the others; there's no urgency (the next
  // tick picks up anything still due) and the outbox publisher's own
  // philosophy ("just try again next tick") already tolerates a wide window.
  for (const id of dueIds) {
    await pollCollection(id);
  }
}

export function startTaxiiPoller(): void {
  pollTimer = setInterval(() => {
    void tick().catch((error) => console.error("TAXII poller tick failed:", error));
  }, TICK_MS);
}

export function stopTaxiiPoller(): void {
  if (pollTimer) clearInterval(pollTimer);
}
