import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("../services/authorization.service.js", () => ({
  resolveClaims: vi.fn(),
}));

import { requireClaim } from "../middleware/requireClaim.js";
import { resolveClaims } from "../services/authorization.service.js";

function mockReqRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  const next = vi.fn();
  return { json, status, res, next };
}

describe("requireClaim middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if req.user is missing", async () => {
    const req = {} as Request;
    const { status, json, res, next } = mockReqRes();

    await requireClaim("SOME_CLAIM")(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: "Authentication required" });
    expect(next).not.toHaveBeenCalled();
    expect(resolveClaims).not.toHaveBeenCalled();
  });

  it("returns 403 if claim not in resolved set", async () => {
    vi.mocked(resolveClaims).mockResolvedValue(new Set(["OTHER_CLAIM"]));

    const req = {
      user: { userId: "test-user", roleIds: ["test-role"] },
    } as Request;
    const { status, json, res, next } = mockReqRes();

    await requireClaim("REQUIRED_CLAIM")(req, res, next);

    expect(resolveClaims).toHaveBeenCalledWith(["test-role"]);
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: "Insufficient permissions" });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() if claim is present", async () => {
    vi.mocked(resolveClaims).mockResolvedValue(
      new Set(["REQUIRED_CLAIM", "OTHER_CLAIM"]),
    );

    const req = {
      user: { userId: "test-user", roleIds: ["test-role"] },
    } as Request;
    const { status, res, next } = mockReqRes();

    await requireClaim("REQUIRED_CLAIM")(req, res, next);

    expect(resolveClaims).toHaveBeenCalledWith(["test-role"]);
    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });
});
