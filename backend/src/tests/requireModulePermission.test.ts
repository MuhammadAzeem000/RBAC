import { Request, Response } from "express";
import { requireModulePermission } from "../middlewares/requireModulePermission";
import * as authzService from "../services/authz.service";

jest.mock("../services/authz.service", () => ({
  userHasPermission: jest.fn(),
}));

const mockedService = authzService as unknown as {
  userHasPermission: jest.Mock;
};

function mockRes() {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("requireModulePermission", () => {
  it("responds 403 when the caller's roles don't grant the permission", async () => {
    mockedService.userHasPermission.mockResolvedValue(false);
    const req = { auth: { userId: 1n, email: "alice@example.com" } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    await requireModulePermission("Audit Logs", "View")(req, res, next);

    expect(mockedService.userHasPermission).toHaveBeenCalledWith(1n, "Audit Logs", "View");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when the caller's roles grant the permission", async () => {
    mockedService.userHasPermission.mockResolvedValue(true);
    const req = { auth: { userId: 1n, email: "alice@example.com" } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    await requireModulePermission("Audit Logs", "Create")(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
