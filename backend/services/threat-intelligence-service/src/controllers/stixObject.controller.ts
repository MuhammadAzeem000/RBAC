import { Request, Response } from "express";

function routeParam(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export async function getStixObject(req: Request, res: Response) {
  const stixId = routeParam(req.params.stixId);
  if (!stixId) {
    res.status(400).json({ error: "stixId is required" });
    return;
  }

  const object = await req.db.stixObject.findFirst({ where: { stixId } });
  if (!object) {
    res.status(404).json({ error: "STIX object not found" });
    return;
  }

  res.json({ data: object });
}

export async function listStixObjects(req: Request, res: Response) {
  const type = routeParam(req.query.type);
  const label = routeParam(req.query.label);

  const rows = await req.db.stixObject.findMany({
    where: {
      ...(type ? { type } : {}),
      ...(label ? { labels: { has: label } } : {}),
    },
    orderBy: { ingestedAt: "desc" },
    take: 50,
  });

  res.json({ data: rows });
}
