import { Prisma } from "../generated/prisma/client";
import { CreateCommentInput } from "../interfaces/comment";

export interface CommentResponse {
  id: bigint;
  incidentId: bigint;
  authorUserId: bigint;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
}

const commentSelect = {
  id: true,
  incidentId: true,
  authorUserId: true,
  body: true,
  createdAt: true,
  editedAt: true,
} as const;

// Author/time immutable, edits versioned per spec — MVP scope doesn't
// implement comment editing at all (no PATCH route), which trivially
// satisfies that constraint: nothing here can mutate a comment.
export function createComment(
  db: Prisma.TransactionClient,
  tenantId: bigint,
  incidentId: bigint,
  input: CreateCommentInput,
  actorUserId: bigint,
): Promise<CommentResponse> {
  return db.comment.create({
    data: {
      // See incident.service.ts::createIncident for why this is passed
      // explicitly even though the tenant-scoping extension overwrites it.
      tenantId,
      incidentId,
      body: input.body,
      authorUserId: actorUserId,
    },
    select: commentSelect,
  });
}

export function listComments(db: Prisma.TransactionClient, incidentId: bigint): Promise<CommentResponse[]> {
  return db.comment.findMany({ where: { incidentId }, select: commentSelect, orderBy: { createdAt: "asc" } });
}
