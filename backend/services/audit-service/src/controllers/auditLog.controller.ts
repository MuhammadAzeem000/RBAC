import { Request, Response } from "express";
import * as auditLogService from "../services/auditLog.service";
import { listAuditLogsQuerySchema } from "../interfaces/auditLog";
import { parseQuery } from "../utils";

export async function listAuditLogs(req: Request, res: Response) {
  const query = parseQuery(listAuditLogsQuerySchema, req, res);
  if (!query) return;

  const result = await auditLogService.listAuditLogs(req.db, query);
  res.json(result);
}
