import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../db.js", () => ({
  prisma: {
    role: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    roleClaim: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    claim: { findMany: vi.fn() },
    userRole: { deleteMany: vi.fn(), createMany: vi.fn(), create: vi.fn() },
    user: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../services/password.service.js", () => ({
  changeUserPassword: vi.fn(),
  resetUserPassword: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password"),
    compare: vi.fn(),
  },
  hash: vi.fn().mockResolvedValue("hashed-password"),
  compare: vi.fn(),
}));

import { prisma } from "../db.js";
import {
  resolveClaims,
  resetForTests,
  claimCache,
} from "../services/authorization.service.js";
import app from "../app.js";
import { signAccessToken } from "../lib/auth.js";

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001";
const adminToken = signAccessToken("admin-user", [ADMIN_ROLE_ID]);
const userToken = signAccessToken("regular-user", ["user-role"]);

const CLAIM_ID_1 = "00000000-0000-0000-0000-000000000010";
const CLAIM_ID_2 = "00000000-0000-0000-0000-000000000011";
const CLAIM_ID_3 = "00000000-0000-0000-0000-000000000012";
const CLAIM_ID_4 = "00000000-0000-0000-0000-000000000013";

const ROLE_ID_1 = "00000000-0000-0000-0000-000000000020";
const ROLE_ID_2 = "00000000-0000-0000-0000-000000000021";
const USER_ID_1 = "00000000-0000-0000-0000-000000000030";
const USER_ID_2 = "00000000-0000-0000-0000-000000000031";

const ADMIN_CLAIMS = [
  { id: "rc-1", roleId: ADMIN_ROLE_ID, claimId: CLAIM_ID_1, createdAt: new Date(), claim: { key: "ROLE_MANAGE" } },
  { id: "rc-2", roleId: ADMIN_ROLE_ID, claimId: CLAIM_ID_2, createdAt: new Date(), claim: { key: "USER_MANAGE" } },
] as never;

function mockAdminClaims() {
  vi.mocked(prisma.roleClaim.findMany).mockResolvedValue(ADMIN_CLAIMS);
}

function mockNoClaims() {
  vi.mocked(prisma.roleClaim.findMany).mockResolvedValue([] as never);
}

/** Create a $transaction mock that invokes the callback with a fake tx object */
function mockTransactionCallback(tx: Record<string, unknown>) {
  (prisma.$transaction as any).mockImplementation(
    async (fn: (tx: unknown) => unknown) => fn(tx),
  );
}

/** Build a tx object with mock methods for role tests */
function roleTx(overrides?: Record<string, unknown>) {
  return {
    role: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    },
    roleClaim: {
      findMany: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: { findMany: vi.fn() },
    ...overrides,
  };
}

/** Build a tx object with mock methods for user tests */
function userTx(overrides?: Record<string, unknown>) {
  return {
    user: {
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    },
    userRole: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    ...overrides,
  };
}

beforeEach(() => {
  resetForTests();
  vi.resetAllMocks();
  // Default mock so requireAuth (which now calls prisma.user.findUnique) passes
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ isActive: true } as never);
});

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

describe("Roles API", () => {
  describe("authorization", () => {
    it("returns 401 without auth token", async () => {
      const res = await request(app).get("/api/v1/roles");
      expect(res.status).toBe(401);
    });

    it("returns 403 without ROLE_MANAGE claim", async () => {
      mockNoClaims();
      const res = await request(app)
        .get("/api/v1/roles")
        .set("Authorization", `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });

    it("returns 200 with ROLE_MANAGE claim", async () => {
      mockAdminClaims();
      vi.mocked(prisma.role.findMany).mockResolvedValue([] as never);
      const res = await request(app)
        .get("/api/v1/roles")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/v1/roles", () => {
    it("lists all roles with claim keys and user counts", async () => {
      mockAdminClaims();
      vi.mocked(prisma.role.findMany).mockResolvedValue([
        {
          id: ROLE_ID_1, name: "Admin", description: "Administrator role",
          createdAt: new Date("2025-01-01"), updatedAt: new Date("2025-01-01"),
          roleClaims: [{ claim: { key: "USER_MANAGE" } }, { claim: { key: "ROLE_MANAGE" } }],
          userRoles: [{ userId: "u1" }, { userId: "u2" }],
        },
        {
          id: ROLE_ID_2, name: "Editor", description: null,
          createdAt: new Date("2025-01-02"), updatedAt: new Date("2025-01-02"),
          roleClaims: [{ claim: { key: "DOCUMENT_CREATE" } }],
          userRoles: [],
        },
      ] as never);

      const res = await request(app)
        .get("/api/v1/roles")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe("Admin");
      expect(res.body[0].claims).toEqual(["USER_MANAGE", "ROLE_MANAGE"]);
      expect(res.body[0].userCount).toBe(2);
      expect(res.body[1].name).toBe("Editor");
      expect(res.body[1].claims).toEqual(["DOCUMENT_CREATE"]);
      expect(res.body[1].userCount).toBe(0);
    });
  });

  describe("GET /api/v1/roles/:id", () => {
    it("returns a single role with full claim list", async () => {
      mockAdminClaims();
      vi.mocked(prisma.role.findUnique).mockResolvedValue({
        id: ROLE_ID_1, name: "Admin", description: "Administrator role",
        createdAt: new Date(), updatedAt: new Date(),
        roleClaims: [
          { claim: { id: CLAIM_ID_1, key: "USER_MANAGE" } },
          { claim: { id: CLAIM_ID_2, key: "ROLE_MANAGE" } },
        ],
        userRoles: [{ userId: "u1" }],
      } as never);

      const res = await request(app)
        .get(`/api/v1/roles/${ROLE_ID_1}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Admin");
      expect(res.body.claims).toHaveLength(2);
      expect(res.body.claims[0]).toEqual({ id: CLAIM_ID_1, key: "USER_MANAGE" });
      expect(res.body.userCount).toBe(1);
    });

    it("returns 404 for non-existent role", async () => {
      mockAdminClaims();
      vi.mocked(prisma.role.findUnique).mockResolvedValue(null);
      const res = await request(app)
        .get("/api/v1/roles/nonexistent")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/roles", () => {
    it("creates a role with claims", async () => {
      mockAdminClaims();
      vi.mocked(prisma.role.create).mockResolvedValue({
        id: ROLE_ID_2, name: "Moderator", description: "Moderator role",
        createdAt: new Date(), updatedAt: new Date(),
        roleClaims: [{ claim: { id: CLAIM_ID_3, key: "CHAT_MODERATE" } }],
      } as never);

      const res = await request(app)
        .post("/api/v1/roles")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Moderator", description: "Moderator role", claimIds: [CLAIM_ID_3] });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Moderator");
      expect(res.body.claims).toHaveLength(1);
      expect(res.body.claims[0].key).toBe("CHAT_MODERATE");
    });

    it("returns 400 for invalid body", async () => {
      mockAdminClaims();
      const res = await request(app)
        .post("/api/v1/roles")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "" });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/v1/roles/:id", () => {
    it("updates role name, description, and claims", async () => {
      const tx = roleTx({
        role: {
          findUnique: vi.fn().mockResolvedValueOnce({ id: ROLE_ID_1, name: "Old Name" }),
          update: vi.fn().mockResolvedValue(undefined),
        },
        roleClaim: {
          findMany: vi.fn().mockResolvedValueOnce([]),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        user: { findMany: vi.fn().mockResolvedValueOnce([]) },
      });
      vi.mocked(prisma.roleClaim.findMany)
        .mockResolvedValueOnce(ADMIN_CLAIMS);
      vi.mocked(prisma.claim.findMany).mockResolvedValueOnce([
        { id: CLAIM_ID_1, key: "USER_MANAGE" },
      ] as never);
      mockTransactionCallback(tx);
      vi.mocked(prisma.role.findUnique).mockResolvedValueOnce({
        id: ROLE_ID_1, name: "New Name", description: "Updated desc",
        createdAt: new Date(), updatedAt: new Date(),
        roleClaims: [{ claim: { id: CLAIM_ID_1, key: "USER_MANAGE" } }],
        userRoles: [],
      } as never);

      const res = await request(app)
        .put(`/api/v1/roles/${ROLE_ID_1}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "New Name", description: "Updated desc", claimIds: [CLAIM_ID_1] });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("New Name");
    });

    it("invalidates cache after update", async () => {
      const tx = roleTx({
        role: {
          findUnique: vi.fn().mockResolvedValueOnce({ id: ROLE_ID_1, name: "Some Role" }),
          update: vi.fn().mockResolvedValue(undefined),
        },
        roleClaim: {
          findMany: vi.fn().mockResolvedValueOnce([]),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        user: { findMany: vi.fn().mockResolvedValueOnce([]) },
      });
      vi.mocked(prisma.roleClaim.findMany)
        .mockResolvedValueOnce(ADMIN_CLAIMS);
      vi.mocked(prisma.claim.findMany).mockResolvedValueOnce([
        { id: CLAIM_ID_1, key: "USER_MANAGE" },
      ] as never);
      mockTransactionCallback(tx);
      vi.mocked(prisma.role.findUnique).mockResolvedValueOnce({
        id: ROLE_ID_1, name: "Updated",
        roleClaims: [], userRoles: [],
      } as never);

      const callsBefore = vi.mocked(prisma.roleClaim.findMany).mock.calls.length;

      await request(app)
        .put(`/api/v1/roles/${ROLE_ID_1}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Updated", claimIds: [CLAIM_ID_1] });

      vi.mocked(prisma.roleClaim.findMany).mockResolvedValue([
        { roleId: ROLE_ID_1, id: "rc-new", claimId: CLAIM_ID_4, createdAt: new Date(), claim: { key: "POST_UPDATE_CLAIM" } },
      ] as never);

      const claims = await resolveClaims([ROLE_ID_1]);
      expect(claims.has("POST_UPDATE_CLAIM")).toBe(true);
      // findMany should be called again because cache was invalidated
      expect(vi.mocked(prisma.roleClaim.findMany).mock.calls.length).toBeGreaterThan(callsBefore);
    });

    it("returns 404 for non-existent role", async () => {
      const tx = roleTx({
        role: { findUnique: vi.fn().mockResolvedValueOnce(null) },
      });
      vi.mocked(prisma.roleClaim.findMany)
        .mockResolvedValueOnce(ADMIN_CLAIMS);
      mockTransactionCallback(tx);
      const res = await request(app)
        .put("/api/v1/roles/nonexistent")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "New Name", claimIds: [CLAIM_ID_1] });
      expect(res.status).toBe(404);
    });

    it("blocks removing admin claims from role when it would leave zero admins", async () => {
      const tx = roleTx({
        role: {
          findUnique: vi.fn().mockResolvedValueOnce({ id: ADMIN_ROLE_ID, name: "Admin" }),
          update: vi.fn(),
        },
        roleClaim: {
          findMany: vi.fn().mockResolvedValueOnce(ADMIN_CLAIMS),
          deleteMany: vi.fn(),
          createMany: vi.fn(),
        },
        user: {
          findMany: vi.fn()
            .mockResolvedValueOnce([
              { id: USER_ID_1, userRoles: [{ roleId: ADMIN_ROLE_ID }, { roleId: ROLE_ID_2 }] },
              { id: USER_ID_2, userRoles: [{ roleId: ADMIN_ROLE_ID }] },
            ] as never)
            .mockResolvedValueOnce([] as never),
        },
      });
      vi.mocked(prisma.roleClaim.findMany)
        .mockResolvedValueOnce(ADMIN_CLAIMS)     // for requireClaim
        .mockResolvedValueOnce([] as never);       // for resolveClaims([ROLE_ID_2])
      vi.mocked(prisma.claim.findMany).mockResolvedValueOnce([
        { id: CLAIM_ID_3, key: "DOCUMENT_CREATE" },
      ] as never);
      mockTransactionCallback(tx);

      const res = await request(app)
        .put(`/api/v1/roles/${ADMIN_ROLE_ID}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ claimIds: [CLAIM_ID_3] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Cannot remove administrative privileges from the last admin user");
    });
  });

  describe("DELETE /api/v1/roles/:id", () => {
    it("deletes a role with cascade-unassign and cache invalidation", async () => {
      mockAdminClaims();
      vi.mocked(prisma.role.findUnique).mockResolvedValue({ id: ROLE_ID_1, name: "ToDelete" } as never);

      const txMock = {
        user: { findMany: vi.fn() },
        userRole: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
        roleClaim: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
        role: { delete: vi.fn().mockResolvedValue({ id: ROLE_ID_1 }) },
      };
      (prisma.$transaction as any).mockImplementation(
        async (fn: (tx: typeof txMock) => unknown) => fn(txMock),
      );

      const res = await request(app)
        .delete(`/api/v1/roles/${ROLE_ID_1}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
      expect(txMock.userRole.deleteMany).toHaveBeenCalledWith({ where: { roleId: ROLE_ID_1 } });
      expect(txMock.roleClaim.deleteMany).toHaveBeenCalledWith({ where: { roleId: ROLE_ID_1 } });
      expect(txMock.role.delete).toHaveBeenCalledWith({ where: { id: ROLE_ID_1 } });
      expect(claimCache.get(ROLE_ID_1)).toBeUndefined();
    });

    it("returns 404 for non-existent role", async () => {
      mockAdminClaims();
      vi.mocked(prisma.role.findUnique).mockResolvedValue(null);
      const res = await request(app)
        .delete("/api/v1/roles/nonexistent")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it("blocks deleting role that is the last source of admin claims", async () => {
      mockAdminClaims();
      vi.mocked(prisma.role.findUnique).mockResolvedValueOnce({ id: ADMIN_ROLE_ID, name: "Admin" } as never);

      const tx = {
        user: {
          findMany: vi.fn()
            .mockResolvedValueOnce([
              { id: USER_ID_1, userRoles: [{ roleId: ADMIN_ROLE_ID }] },
            ] as never),
        },
        userRole: { deleteMany: vi.fn() },
        roleClaim: { deleteMany: vi.fn() },
        role: { delete: vi.fn() },
      };
      (prisma.$transaction as any).mockImplementation(
        async (fn: (tx: typeof tx) => unknown) => fn(tx),
      );

      const res = await request(app)
        .delete(`/api/v1/roles/${ADMIN_ROLE_ID}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Cannot remove administrative privileges from the last admin user");
      expect(tx.role.delete).not.toHaveBeenCalled();
      expect(tx.userRole.deleteMany).not.toHaveBeenCalled();
      expect(tx.roleClaim.deleteMany).not.toHaveBeenCalled();
    });

    it("deletes role with admin claims when another user independently has admin", async () => {
      const OTHER_ADMIN_CLAIMS = [
        { id: "rc-other", roleId: ROLE_ID_2, claimId: CLAIM_ID_4, createdAt: new Date(), claim: { key: "ROLE_MANAGE" } },
      ] as never;
      vi.mocked(prisma.roleClaim.findMany)
        .mockResolvedValueOnce(ADMIN_CLAIMS)      // for requireClaim
        .mockResolvedValueOnce(OTHER_ADMIN_CLAIMS); // for resolveClaims([ROLE_ID_2])

      vi.mocked(prisma.role.findUnique).mockResolvedValueOnce({ id: ADMIN_ROLE_ID, name: "Admin" } as never);

      const tx = {
        user: {
          findMany: vi.fn()
            .mockResolvedValueOnce([
              { id: USER_ID_1, userRoles: [{ roleId: ADMIN_ROLE_ID }] },
              { id: USER_ID_2, userRoles: [{ roleId: ROLE_ID_2 }] },
            ] as never)
            .mockResolvedValueOnce([
              { id: USER_ID_2, userRoles: [{ roleId: ROLE_ID_2 }] },
            ] as never),
        },
        userRole: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
        roleClaim: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
        role: { delete: vi.fn().mockResolvedValue({ id: ADMIN_ROLE_ID }) },
      };
      (prisma.$transaction as any).mockImplementation(
        async (fn: (tx: typeof tx) => unknown) => fn(tx),
      );

      const res = await request(app)
        .delete(`/api/v1/roles/${ADMIN_ROLE_ID}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
      expect(tx.role.delete).toHaveBeenCalledWith({ where: { id: ADMIN_ROLE_ID } });
      expect(tx.userRole.deleteMany).toHaveBeenCalledWith({ where: { roleId: ADMIN_ROLE_ID } });
      expect(tx.roleClaim.deleteMany).toHaveBeenCalledWith({ where: { roleId: ADMIN_ROLE_ID } });
    });
  });
});

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

describe("Claims API", () => {
  describe("authorization", () => {
    it("returns 401 without auth token", async () => {
      const res = await request(app).get("/api/v1/claims");
      expect(res.status).toBe(401);
    });
    it("returns 403 without ROLE_MANAGE claim", async () => {
      mockNoClaims();
      const res = await request(app)
        .get("/api/v1/claims")
        .set("Authorization", `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/v1/claims", () => {
    it("returns all seeded claims as flat array", async () => {
      mockAdminClaims();
      vi.mocked(prisma.claim.findMany).mockResolvedValue([
        { id: CLAIM_ID_1, key: "USER_MANAGE" },
        { id: CLAIM_ID_2, key: "ROLE_MANAGE" },
        { id: CLAIM_ID_3, key: "DOCUMENT_CREATE" },
      ] as never);

      const res = await request(app)
        .get("/api/v1/claims")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(res.body[0]).toEqual({ id: CLAIM_ID_1, key: "USER_MANAGE" });
    });
  });
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

describe("Users API", () => {
  describe("authorization", () => {
    it("GET returns 401 without auth", async () => {
      const res = await request(app).get("/api/v1/users");
      expect(res.status).toBe(401);
    });
    it("GET returns 403 without USER_MANAGE", async () => {
      mockNoClaims();
      const res = await request(app)
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/v1/users", () => {
    it("lists active users by default, excludes passwordHash", async () => {
      mockAdminClaims();
      vi.mocked(prisma.user.findMany).mockResolvedValue([{
        id: USER_ID_1, email: "active@test.com", firstName: "Active",
        lastName: "User", isActive: true, createdAt: new Date(), updatedAt: new Date(),
        userRoles: [{ role: { id: ROLE_ID_1, name: "Admin" } }],
      }] as never);

      const res = await request(app)
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).not.toHaveProperty("passwordHash");
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it("includes inactive users when ?includeInactive=true", async () => {
      mockAdminClaims();
      vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
      await request(app)
        .get("/api/v1/users?includeInactive=true")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  describe("GET /api/v1/users/:id", () => {
    it("returns a single user with roles", async () => {
      mockAdminClaims();
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: USER_ID_1, email: "test@test.com", firstName: "Test",
        lastName: "User", isActive: true, createdAt: new Date(), updatedAt: new Date(),
        userRoles: [{ role: { id: ROLE_ID_1, name: "Admin" } }],
      } as never);

      const res = await request(app)
        .get(`/api/v1/users/${USER_ID_1}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe("test@test.com");
      expect(res.body.roles).toHaveLength(1);
    });

    it("returns 404 for non-existent user", async () => {
      mockAdminClaims();
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ isActive: true } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      const res = await request(app)
        .get("/api/v1/users/nonexistent")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/users", () => {
    it("creates a user with roles", async () => {
      mockAdminClaims();
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ isActive: true } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      const createdUser = {
        id: USER_ID_2, email: "new@test.com", firstName: "New",
        lastName: "User", isActive: true, createdAt: new Date(), updatedAt: new Date(),
        userRoles: [{ role: { id: ROLE_ID_1, name: "Editor" } }],
      };
      (prisma.$transaction as any).mockImplementation(
        async (fn: (tx: unknown) => unknown) => fn({ user: { create: vi.fn().mockResolvedValue(createdUser) } }),
      );

      const res = await request(app)
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ email: "new@test.com", firstName: "New", lastName: "User", password: "password123", roleIds: [ROLE_ID_1] });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe("new@test.com");
      expect(res.body.roles).toHaveLength(1);
    });

    it("returns 400 for invalid body", async () => {
      mockAdminClaims();
      const res = await request(app)
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ email: "bad" });
      expect(res.status).toBe(400);
    });

    it("returns 409 for duplicate email", async () => {
      mockAdminClaims();
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ isActive: true } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "existing", email: "dup@test.com" } as never);
      const res = await request(app)
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ email: "dup@test.com", firstName: "Dup", lastName: "User", password: "password123", roleIds: [ROLE_ID_1] });
      expect(res.status).toBe(409);
    });
  });

  describe("PUT /api/v1/users/:id", () => {
    it("updates profile fields and replaces roles", async () => {
      mockAdminClaims();
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ isActive: true } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: USER_ID_1, email: "old@test.com" } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      const tx = userTx({
        user: {
          findMany: vi.fn().mockResolvedValueOnce([
            { id: "other-admin", userRoles: [{ roleId: ADMIN_ROLE_ID }] },
          ] as never),
          update: vi.fn().mockResolvedValue(undefined),
        },
      });
      mockTransactionCallback(tx);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: USER_ID_1, email: "updated@test.com", firstName: "Updated",
        lastName: "User", isActive: true, createdAt: new Date(), updatedAt: new Date(),
        userRoles: [{ role: { id: ROLE_ID_2, name: "NewRole" } }],
      } as never);

      const res = await request(app)
        .put(`/api/v1/users/${USER_ID_1}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ email: "updated@test.com", firstName: "Updated", roleIds: [ROLE_ID_2] });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe("updated@test.com");
      expect(res.body.roles).toHaveLength(1);
    });

    it("does not allow password changes through this route", async () => {
      mockAdminClaims();
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ isActive: true } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: USER_ID_1, email: "test@test.com" } as never);
      mockTransactionCallback(userTx());
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: USER_ID_1, email: "test@test.com", firstName: "NewName",
        lastName: "User", isActive: true, createdAt: new Date(), updatedAt: new Date(), userRoles: [],
      } as never);

      const res = await request(app)
        .put(`/api/v1/users/${USER_ID_1}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ firstName: "NewName", password: "shouldnotwork" });
      expect(res.status).toBe(200);
      expect(res.body.firstName).toBe("NewName");
    });

    it("returns 404 for non-existent user", async () => {
      mockAdminClaims();
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ isActive: true } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      const res = await request(app)
        .put("/api/v1/users/nonexistent")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ firstName: "Test" });
      expect(res.status).toBe(404);
    });

    it("rejects role assignment without ROLE_MANAGE (privilege escalation) - POST", async () => {
      const userOnlyToken = signAccessToken("user-mgr", ["user-mgr-role"]);
      mockNoClaims();

      const res = await request(app)
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${userOnlyToken}`)
        .send({ email: "test@test.com", firstName: "Test", lastName: "User", password: "password123", roleIds: [ROLE_ID_2] });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Insufficient permissions");
    });

    it("rejects role assignment in PUT without ROLE_MANAGE (privilege escalation)", async () => {
      const userOnlyToken = signAccessToken("user-mgr", ["user-mgr-role"]);
      mockNoClaims();

      const res = await request(app)
        .put(`/api/v1/users/${USER_ID_1}`)
        .set("Authorization", `Bearer ${userOnlyToken}`)
        .send({ firstName: "Test", roleIds: [ROLE_ID_2] });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Insufficient permissions");
    });

    it("allows non-role field update without ROLE_MANAGE", async () => {
      vi.mocked(prisma.roleClaim.findMany).mockResolvedValueOnce([
        { id: "rc-um", roleId: "user-mgr-role", claimId: "c-um", createdAt: new Date(), claim: { key: "USER_MANAGE" } },
      ] as never);
      const userOnlyToken = signAccessToken("user-mgr", ["user-mgr-role"]);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ isActive: true } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: USER_ID_1, email: "old@test.com" } as never);
      mockTransactionCallback(userTx());
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: USER_ID_1, email: "updated@test.com", firstName: "Updated",
        lastName: "User", isActive: true, createdAt: new Date(), updatedAt: new Date(), userRoles: [],
      } as never);

      const res = await request(app)
        .put(`/api/v1/users/${USER_ID_1}`)
        .set("Authorization", `Bearer ${userOnlyToken}`)
        .send({ firstName: "Updated" });
      expect(res.status).toBe(200);
    });

    it("blocks removing last admin via role replacement in updateUser", async () => {
      mockAdminClaims();
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ isActive: true } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: USER_ID_1, email: "admin@test.com" } as never);
      const tx = userTx({
        user: {
          findMany: vi.fn().mockResolvedValueOnce([] as never),
          update: vi.fn(),
        },
        userRole: { deleteMany: vi.fn(), createMany: vi.fn() },
      });
      mockTransactionCallback(tx);

      const res = await request(app)
        .put(`/api/v1/users/${USER_ID_1}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ roleIds: [ROLE_ID_2] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Cannot remove administrative privileges from the last admin user");
    });
  });

  describe("DELETE /api/v1/users/:id", () => {
    it("soft-deletes a user and revokes refresh tokens", async () => {
      mockAdminClaims();
      const tx = {
        user: {
          findUnique: vi.fn().mockResolvedValueOnce({ id: USER_ID_1, isActive: true }),
          findMany: vi.fn().mockResolvedValueOnce([
            { id: "other-admin", userRoles: [{ roleId: ADMIN_ROLE_ID }] },
          ]),
          update: vi.fn().mockResolvedValue(undefined),
        },
        userRole: {
          findMany: vi.fn().mockResolvedValueOnce([{ roleId: ADMIN_ROLE_ID }] as never),
        },
        refreshToken: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      };
      mockTransactionCallback(tx);

      const res = await request(app)
        .delete(`/api/v1/users/${USER_ID_1}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
      expect(tx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: USER_ID_1 }, data: { isActive: false } }),
      );
      expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID_1, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("blocks deactivation of the last user with admin claims", async () => {
      mockAdminClaims();
      const tx = {
        user: {
          findUnique: vi.fn().mockResolvedValueOnce({ id: USER_ID_1, isActive: true }),
          findMany: vi.fn().mockResolvedValueOnce([]),
        },
        userRole: {
          findMany: vi.fn().mockResolvedValueOnce([{ roleId: ADMIN_ROLE_ID }] as never),
        },
      };
      mockTransactionCallback(tx);

      const res = await request(app)
        .delete(`/api/v1/users/${USER_ID_1}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Cannot remove administrative privileges from the last admin user");
    });

    it("returns 409 when user already deactivated", async () => {
      mockAdminClaims();
      const tx = {
        user: {
          findUnique: vi.fn().mockResolvedValueOnce({ id: USER_ID_1, isActive: false }),
        },
      };
      mockTransactionCallback(tx);

      const res = await request(app)
        .delete(`/api/v1/users/${USER_ID_1}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(409);
    });

    it("returns 404 for non-existent user", async () => {
      mockAdminClaims();
      const tx = {
        user: {
          findUnique: vi.fn().mockResolvedValueOnce(null),
        },
      };
      mockTransactionCallback(tx);

      const res = await request(app)
        .delete("/api/v1/users/nonexistent")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
