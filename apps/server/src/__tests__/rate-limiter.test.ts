import { describe, it, expect, vi } from "vitest";
import { rateLimiter } from "../lib/rate-limiter.js";
import type { Request, Response } from "express";

function mockReqRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return {
    req: { ip: "127.0.0.1" } as Request,
    res: { status, json } as unknown as Response,
    json,
    status,
  };
}

describe("rateLimiter", () => {
  it("allows requests up to and including the max limit", () => {
    const limiter = rateLimiter({ windowMs: 60000, max: 5 });
    const { req, res } = mockReqRes();
    expect(limiter(req, res)).toBe(true);
    expect(limiter(req, res)).toBe(true);
    expect(limiter(req, res)).toBe(true);
    expect(limiter(req, res)).toBe(true);
    expect(limiter(req, res)).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("blocks requests that exceed the max limit", () => {
    const limiter = rateLimiter({ windowMs: 60000, max: 2 });
    const { req, res, status, json } = mockReqRes();
    expect(limiter(req, res)).toBe(true);
    expect(limiter(req, res)).toBe(true);
    expect(limiter(req, res)).toBe(false);
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({ error: "Too many requests" });
  });

  it("resets after the window expires", async () => {
    const limiter = rateLimiter({ windowMs: 50, max: 1 });
    const { req, res } = mockReqRes();
    expect(limiter(req, res)).toBe(true);
    expect(limiter(req, res)).toBe(false);
    await new Promise((r) => setTimeout(r, 70));
    expect(limiter(req, res)).toBe(true);
  });

  it("uses custom status and message", () => {
    const limiter = rateLimiter({
      windowMs: 60000,
      max: 0,
      status: 401,
      message: "Custom error",
    });
    const { req, res, status, json } = mockReqRes();
    expect(limiter(req, res)).toBe(false);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: "Custom error" });
  });

  it("uses custom key generator to separate clients", () => {
    const limiter = rateLimiter({
      windowMs: 60000,
      max: 1,
      keyGenerator: (req) => (req as any).customKey ?? "default",
    });
    const req1 = { ip: "127.0.0.1", customKey: "user1" } as any;
    const req2 = { ip: "127.0.0.1", customKey: "user2" } as any;
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status, json } as unknown as Response;

    expect(limiter(req1, res)).toBe(true);
    expect(limiter(req1, res)).toBe(false);
    expect(limiter(req2, res)).toBe(true);
  });
});
