import { Request, Response } from "express";
import { z } from "zod";
import { parseBigIntId, parseBody } from "../utils";
import { decryptCredential } from "../lib/crypto";
import { toTaxiiCredentials } from "../services/taxiiServer.service";
import * as taxiiClient from "../lib/taxiiClient";
import { pollCollection } from "../services/taxiiPoller.service";

function serializeCollection(collection: {
  id: bigint;
  taxiiServerId: bigint;
  collectionId: string;
  title: string | null;
  pollIntervalSeconds: number;
  status: string;
  lastAddedAfter: Date | null;
  lastPolledAt: Date | null;
  lastPollStatus: string | null;
  lastPollError: string | null;
}) {
  return {
    id: collection.id.toString(),
    taxiiServerId: collection.taxiiServerId.toString(),
    collectionId: collection.collectionId,
    title: collection.title,
    pollIntervalSeconds: collection.pollIntervalSeconds,
    status: collection.status,
    lastAddedAfter: collection.lastAddedAfter,
    lastPolledAt: collection.lastPolledAt,
    lastPollStatus: collection.lastPollStatus,
    lastPollError: collection.lastPollError,
  };
}

// Lists the TAXII collections a configured server actually advertises
// (calling out to the server live), for the UI to pick from when adding a
// new TaxiiCollection row.
export async function discoverCollections(req: Request, res: Response) {
  const serverId = parseBigIntId(req.params.serverId);
  if (serverId === null) {
    res.status(400).json({ error: "Invalid server id" });
    return;
  }

  const server = await req.db.taxiiServer.findFirst({ where: { id: serverId } });
  if (!server) {
    res.status(404).json({ error: "TAXII server not found" });
    return;
  }

  const credentials = server.encryptedCredential
    ? toTaxiiCredentials(server.authType, server.encryptedCredential, decryptCredential)
    : undefined;

  const apiRoot = server.apiRoot ?? (await taxiiClient.discoverApiRoot(server.discoveryUrl, credentials));
  if (!server.apiRoot) {
    await req.db.taxiiServer.update({ where: { id: server.id }, data: { apiRoot } });
  }

  const collections = await taxiiClient.listCollections(apiRoot, credentials);
  res.json({ data: collections });
}

const createCollectionSchema = z.object({
  collectionId: z.string().min(1),
  title: z.string().max(255).optional(),
  pollIntervalSeconds: z.number().int().positive().default(900),
});

export async function listTaxiiCollections(req: Request, res: Response) {
  const serverId = parseBigIntId(req.params.serverId);
  if (serverId === null) {
    res.status(400).json({ error: "Invalid server id" });
    return;
  }

  const rows = await req.db.taxiiCollection.findMany({ where: { taxiiServerId: serverId }, orderBy: { id: "asc" } });
  res.json({ data: rows.map(serializeCollection) });
}

export async function createTaxiiCollection(req: Request, res: Response) {
  const serverId = parseBigIntId(req.params.serverId);
  if (serverId === null) {
    res.status(400).json({ error: "Invalid server id" });
    return;
  }

  const body = parseBody(createCollectionSchema, req, res);
  if (!body) return;

  const collection = await req.db.taxiiCollection.create({
    data: {
      tenantId: req.auth!.tenantId,
      taxiiServerId: serverId,
      collectionId: body.collectionId,
      title: body.title,
      pollIntervalSeconds: body.pollIntervalSeconds,
    },
  });

  res.status(201).json({ data: serializeCollection(collection) });
}

const updateCollectionSchema = z.object({
  title: z.string().max(255).optional(),
  pollIntervalSeconds: z.number().int().positive().optional(),
  status: z.enum(["enabled", "disabled"]).optional(),
});

export async function updateTaxiiCollection(req: Request, res: Response) {
  const id = parseBigIntId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid collection id" });
    return;
  }

  const body = parseBody(updateCollectionSchema, req, res);
  if (!body) return;

  const collection = await req.db.taxiiCollection.update({ where: { id }, data: body });
  res.json({ data: serializeCollection(collection) });
}

export async function deleteTaxiiCollection(req: Request, res: Response) {
  const id = parseBigIntId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid collection id" });
    return;
  }

  await req.db.taxiiCollection.delete({ where: { id } });
  res.status(204).send();
}

export async function triggerPoll(req: Request, res: Response) {
  const id = parseBigIntId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid collection id" });
    return;
  }

  const collection = await req.db.taxiiCollection.findFirst({ where: { id } });
  if (!collection) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  await pollCollection(id);

  const updated = await req.db.taxiiCollection.findFirst({ where: { id } });
  res.json({ data: serializeCollection(updated!) });
}

export async function getTaxiiCollectionStatus(req: Request, res: Response) {
  const id = parseBigIntId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid collection id" });
    return;
  }

  const collection = await req.db.taxiiCollection.findFirst({ where: { id } });
  if (!collection) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  const objectCount = await req.db.stixObject.count({ where: { taxiiCollectionId: id } });
  res.json({ data: { ...serializeCollection(collection), objectCount } });
}
