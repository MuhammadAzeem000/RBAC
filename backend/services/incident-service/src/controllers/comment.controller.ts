import { Request, Response } from "express";
import { z } from "zod";
import { createCommentSchema } from "../interfaces/comment";
import * as commentService from "../services/comment.service";
import * as incidentService from "../services/incident.service";
import { recordTimelineEvent } from "../services/timeline.service";
import { parseBigIntId } from "../utils";

function parseIncidentId(req: Request, res: Response): bigint | null {
  const id = parseBigIntId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid incident id" });
    return null;
  }
  return id;
}

export async function createComment(req: Request, res: Response) {
  const incidentId = parseIncidentId(req, res);
  if (incidentId === null) return;

  const result = createCommentSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  await incidentService.assertIncidentExists(incidentId);
  const comment = await commentService.createComment(incidentId, result.data, req.auth!.userId);

  await recordTimelineEvent({
    incidentId,
    eventType: "comment_added",
    actorUserId: req.auth!.userId,
    summary: "Comment added",
    metadata: { commentId: comment.id.toString() },
  });

  res.status(201).json(comment);
}

export async function listComments(req: Request, res: Response) {
  const incidentId = parseIncidentId(req, res);
  if (incidentId === null) return;

  await incidentService.assertIncidentExists(incidentId);
  const comments = await commentService.listComments(incidentId);
  res.json({ data: comments });
}
