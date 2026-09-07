import { Request, Response } from "express";
import { z } from "zod";
import { parseBigIntId, parseBody } from "../utils";
import * as taxiiServerService from "../services/taxiiServer.service";
import { encryptCredential } from "../lib/crypto";

const createServerSchema = z.object({
  name: z.string().min(1).max(150),
  discoveryUrl: z.string().url(),
  authType: z.enum(["none", "basic", "bearer"]).default("none"),
  credential: z.record(z.string(), z.unknown()).optional(),
});

const updateServerSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  discoveryUrl: z.string().url().optional(),
  authType: z.enum(["none", "basic", "bearer"]).optional(),
  credential: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["enabled", "disabled"]).optional(),
});

export async function listTaxiiServers(req: Request, res: Response) {
  const rows = await req.db.taxiiServer.findMany({ where: { tenantId: req.auth!.tenantId }, orderBy: { name: "asc" } });
  res.json({ data: rows.map(taxiiServerService.serializeTaxiiServer) });
}

export async function createTaxiiServer(req: Request, res: Response) {
  const body = parseBody(createServerSchema, req, res);
  if (!body) return;

  const server = await taxiiServerService.createTaxiiServer(req.db, req.auth!.tenantId, body);
  res.status(201).json({ data: taxiiServerService.serializeTaxiiServer(server) });
}

export async function updateTaxiiServer(req: Request, res: Response) {
  const id = parseBigIntId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid server id" });
    return;
  }

  const body = parseBody(updateServerSchema, req, res);
  if (!body) return;

  const server = await req.db.taxiiServer.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.discoveryUrl !== undefined ? { discoveryUrl: body.discoveryUrl, apiRoot: null } : {}),
      ...(body.authType !== undefined ? { authType: body.authType } : {}),
      ...(body.credential !== undefined ? { encryptedCredential: encryptCredential(body.credential) } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    },
  });

  res.json({ data: taxiiServerService.serializeTaxiiServer(server) });
}

export async function deleteTaxiiServer(req: Request, res: Response) {
  const id = parseBigIntId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid server id" });
    return;
  }

  await req.db.taxiiCollection.deleteMany({ where: { taxiiServerId: id } });
  await req.db.taxiiServer.delete({ where: { id } });
  res.status(204).send();
}
