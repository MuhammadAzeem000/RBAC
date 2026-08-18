import { Request, Response } from "express";
import * as auditLogService from "../services/auditLog.service";
import { parsePagination } from "../utils";

export async function getAuditLogs(req: Request, res: Response) {
  const pagination = parsePagination(req, res);
  if (!pagination) return;

  const result = await auditLogService.getAuditLogs(pagination);
  res.json(result);
}
