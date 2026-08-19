import { Request, Response } from "express";
import { requireAuditPermission } from "../middlewares/requireAuditPermission";
import * as identityClient from "../services/identityClient.service";

jest.mock("../services/identityClient.service", () => ({
  fetchMyPermissions: jest.fn(),
}));

const mockedClient = identityClient as unknown as { fetchMyPermissions: jest.Mock };

function mockRes() {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq() {
  return { auth: { userId: 1n, email: "alice@example.com", token: "the-token" } } as unknown as Request;
}

describe("requireAuditPermission", () => {
  it("calls next() when identity-service grants View on Audit Logs", async () => {
    mockedClient.fetchMyPermissions.mockResolvedValue([{ name: "Audit Logs", isEnabled: true, actions: ["View"] }]);
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await requireAuditPermission("View")(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("responds 403 when the caller has no Audit Logs permission", async () => {
    mockedClient.fetchMyPermissions.mockResolvedValue([{ name: "Users", isEnabled: true, actions: ["View"] }]);
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await requireAuditPermission("View")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when identity-service is unreachable", async () => {
    mockedClient.fetchMyPermissions.mockRejectedValue(new Error("ECONNREFUSED"));
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await requireAuditPermission("View")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });
});
