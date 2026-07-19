import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../db.js", () => ({
  prisma: {
    roleClaim: { findMany: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
  },
}));

vi.mock("../services/password.service.js", () => ({
  changeUserPassword: vi.fn(),
  resetUserPassword: vi.fn(),
}));

import { prisma } from "../db.js";
import {
  resolveClaims,
  invalidateRole,
  resetForTests,
} from "../services/authorization.service.js";
import { changeUserPassword, resetUserPassword } from "../services/password.service.js";
import app from "../app.js";
import { signAccessToken } from "../lib/auth.js";

const ADMIN_ROLE_ID = "pwd-test-admin-role";
const adminToken = signAccessToken("admin-user-id", [ADMIN_ROLE_ID]);
const userToken = signAccessToken("regular-user-id", ["user-role"]);

function mockRoleClaimFindMany(entries: Array<{ roleId: string; key: string }>) {
  vi.mocked(prisma.roleClaim.findMany).mockResolvedValue(
    entries.map((e) => ({
      id: `rc-${e.roleId}-${e.key}`,
      roleId: e.roleId,
      claimId: `c-${e.key}`,
      createdAt: new Date(),
      claim: { key: e.key },
    })) as never,
  );
}

describe("authorization.service", () => {
  beforeEach(() => {
    resetForTests();
    vi.clearAllMocks();
  });

  it("resolves union of claims across multiple roles correctly", async () => {
    mockRoleClaimFindMany([
      { roleId: "role-a", key: "USER_MANAGE" },
      { roleId: "role-b", key: "DOCUMENT_CREATE" },
      { roleId: "role-b", key: "DOCUMENT_MANAGE" },
    ]);

    const claims = await resolveClaims(["role-a", "role-b"]);
    expect(claims.has("USER_MANAGE")).toBe(true);
    expect(claims.has("DOCUMENT_CREATE")).toBe(true);
    expect(claims.has("DOCUMENT_MANAGE")).toBe(true);
    expect(claims.size).toBe(3);
  });

  it("cache hit does not re-query the DB", async () => {
    mockRoleClaimFindMany([
      { roleId: "role-a", key: "TEST_CLAIM" },
    ]);

    await resolveClaims(["role-a"]);
    expect(prisma.roleClaim.findMany).toHaveBeenCalledTimes(1);

    await resolveClaims(["role-a"]);
    expect(prisma.roleClaim.findMany).toHaveBeenCalledTimes(1);
  });

  it("cache miss queries DB and populates cache", async () => {
    mockRoleClaimFindMany([
      { roleId: "role-a", key: "MISS_CLAIM" },
    ]);

    const claims = await resolveClaims(["role-a"]);
    expect(claims.has("MISS_CLAIM")).toBe(true);
    expect(prisma.roleClaim.findMany).toHaveBeenCalledTimes(1);
  });

  it("invalidateRole clears entry, subsequent resolve re-queries DB", async () => {
    mockRoleClaimFindMany([
      { roleId: "role-a", key: "INVAL_CLAIM" },
    ]);

    await resolveClaims(["role-a"]);
    expect(prisma.roleClaim.findMany).toHaveBeenCalledTimes(1);

    invalidateRole("role-a");

    await resolveClaims(["role-a"]);
    expect(prisma.roleClaim.findMany).toHaveBeenCalledTimes(2);
  });
});

describe("password endpoints", () => {
  beforeEach(() => {
    resetForTests();
    vi.clearAllMocks();
    // Default mock so requireAuth (which now calls prisma.user.findUnique) passes
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isActive: true } as never);
    mockRoleClaimFindMany([
      { roleId: ADMIN_ROLE_ID, key: "USER_MANAGE" },
    ]);
  });

  describe("POST /:id/change-password", () => {
    it("allows a user to change their own password", async () => {
      vi.mocked(changeUserPassword).mockResolvedValue({ success: true });
      const token = signAccessToken("user-123", ["some-role"]);

      const res = await request(app)
        .post("/api/v1/users/user-123/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ currentPassword: "oldpass", newPassword: "newpassword123" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Password changed successfully");
      expect(changeUserPassword).toHaveBeenCalledWith(
        "user-123",
        "oldpass",
        "newpassword123",
      );
    });

    it("rejects wrong current password with 401", async () => {
      vi.mocked(changeUserPassword).mockResolvedValue({
        success: false,
        error: "Current password is incorrect",
      });
      const token = signAccessToken("user-123", ["some-role"]);

      const res = await request(app)
        .post("/api/v1/users/user-123/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ currentPassword: "wrong", newPassword: "newpassword123" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Current password is incorrect");
    });

    it("prevents user from changing another user's password with 403", async () => {
      const token = signAccessToken("user-111", ["some-role"]);

      const res = await request(app)
        .post("/api/v1/users/user-222/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ currentPassword: "oldpass", newPassword: "newpassword123" });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("You can only change your own password");
    });

    it("returns 400 for invalid request body", async () => {
      const token = signAccessToken("user-123", ["some-role"]);

      const res = await request(app)
        .post("/api/v1/users/user-123/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ newPassword: "short" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
    });
  });

  describe("POST /:id/reset-password", () => {
    it("allows admin with USER_MANAGE claim to reset any user's password", async () => {
      vi.mocked(resetUserPassword).mockResolvedValue({ success: true });

      const res = await request(app)
        .post("/api/v1/users/target-user/reset-password")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ newPassword: "newpassword123" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Password reset successfully");
      expect(resetUserPassword).toHaveBeenCalledWith(
        "target-user",
        "newpassword123",
      );
    });

    it("returns 403 for user without USER_MANAGE claim", async () => {
      mockRoleClaimFindMany([]);

      const res = await request(app)
        .post("/api/v1/users/target-user/reset-password")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ newPassword: "newpassword123" });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Insufficient permissions");
    });

    it("returns 400 for invalid request body", async () => {
      const res = await request(app)
        .post("/api/v1/users/target-user/reset-password")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
    });

    it("returns 404 when target user does not exist", async () => {
      vi.mocked(resetUserPassword).mockResolvedValue({
        success: false,
        error: "User not found",
      });

      const res = await request(app)
        .post("/api/v1/users/nonexistent/reset-password")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ newPassword: "newpassword123" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("User not found");
    });
  });
});
