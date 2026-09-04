import { Request, Response } from "express";
import * as policyService from "../services/policy.service";

export async function listPolicies(req: Request, res: Response) {
  const policies = await policyService.listPolicies(req.db);
  res.json({ data: policies });
}
