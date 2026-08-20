import { Request, Response } from "express";
import { requireIncidentPermission } from "../middlewares/requireIncidentPermission";
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

describe("requireIncidentPermission", () => {
  it("calls next() when identity-service grants the action on Incidents", async () => {
    mockedClient.fetchMyPermissions.mockResolvedValue([{ name: "Incidents", isEnabled: true, actions: ["View", "Create"] }]);
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await requireIncidentPermission("View")(req, res, next);

    expect(mockedClient.fetchMyPermissions).toHaveBeenCalledWith("the-token");
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("responds 403 when Incidents module is present but lacks the action", async () => {
    mockedClient.fetchMyPermissions.mockResolvedValue([{ name: "Incidents", isEnabled: true, actions: ["View"] }]);
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await requireIncidentPermission("Delete")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("responds 403 when the caller has no Incidents permissions at all", async () => {
    mockedClient.fetchMyPermissions.mockResolvedValue([{ name: "Users", isEnabled: true, actions: ["View"] }]);
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await requireIncidentPermission("View")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("responds 401 when identity-service says the token is invalid", async () => {
    mockedClient.fetchMyPermissions.mockResolvedValue(null);
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await requireIncidentPermission("View")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("fails closed with 503 when identity-service is unreachable", async () => {
    mockedClient.fetchMyPermissions.mockRejectedValue(new Error("ECONNREFUSED"));
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await requireIncidentPermission("View")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });
});
