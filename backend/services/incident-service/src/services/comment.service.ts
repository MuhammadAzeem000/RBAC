import { prisma } from "../config/prisma";
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
  incidentId: bigint,
  input: CreateCommentInput,
  actorUserId: bigint,
): Promise<CommentResponse> {
  return prisma.comment.create({
    data: { incidentId, body: input.body, authorUserId: actorUserId },
    select: commentSelect,
  });
}

export function listComments(incidentId: bigint): Promise<CommentResponse[]> {
  return prisma.comment.findMany({ where: { incidentId }, select: commentSelect, orderBy: { createdAt: "asc" } });
}
