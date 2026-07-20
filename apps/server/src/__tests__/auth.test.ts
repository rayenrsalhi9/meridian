import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../app.js";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const TEST_EMAIL = "admin@meridian.local";
const TEST_PASSWORD = "admin123";

beforeAll(async () => {
  await prisma.refreshToken.deleteMany();

  app.get("/api/test/protected", requireAuth, (req, res) => {
    res.json({ user: req.user });
  });
});

afterAll(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.$disconnect();
});

function extractCookie(
  setCookie: string | string[] | undefined,
  name: string,
): string | undefined {
  const cookies = Array.isArray(setCookie)
    ? setCookie
    : setCookie
      ? [setCookie]
      : [];
  for (const c of cookies) {
    if (c.startsWith(`${name}=`)) {
      return c.split(";")[0]?.slice(name.length + 1);
    }
  }
}

describe("POST /api/v1/auth/login", () => {
  it("returns 200 + accessToken for valid credentials", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(typeof res.body.accessToken).toBe("string");
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toBeDefined();
    expect(Array.isArray(res.body.user.roleIds)).toBe(true);
  });

  it("sets a refresh_token httpOnly cookie on success", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    const cookie = extractCookie(res.headers["set-cookie"], "refresh_token");
    expect(cookie).toBeDefined();
    expect(cookie).not.toBe("");
  });

  it("returns 401 for wrong password", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: TEST_EMAIL, password: "wrongpass" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid credentials");
    expect(res.body.accessToken).toBeUndefined();
  });

  it("returns 401 for nonexistent email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@test.com", password: "anything" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid credentials");
  });

  it("returns 400 for invalid email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "not-an-email", password: "xxx" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("returns 400 for missing password", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: TEST_EMAIL });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });
});

describe("POST /api/v1/auth/refresh", () => {
  it("returns 200 + new accessToken with valid refresh token cookie", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    const refreshCookie = extractCookie(
      loginRes.headers["set-cookie"],
      "refresh_token",
    );
    expect(refreshCookie).toBeDefined();

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${refreshCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(typeof res.body.accessToken).toBe("string");
  });

  it("rotates the refresh token (old token becomes invalid)", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    const cookie1 = extractCookie(
      loginRes.headers["set-cookie"],
      "refresh_token",
    );
    expect(cookie1).toBeDefined();

    const refresh1 = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${cookie1}`);
    expect(refresh1.status).toBe(200);

    const cookie2 = extractCookie(
      refresh1.headers["set-cookie"],
      "refresh_token",
    );
    expect(cookie2).toBeDefined();
    expect(cookie2).not.toBe(cookie1);

    const refresh2 = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${cookie1}`);
    expect(refresh2.status).toBe(401);
    expect(refresh2.body.error).toBe("Invalid or expired refresh token");
  });

  it("returns 401 when no refresh token cookie is sent", async () => {
    const res = await request(app).post("/api/v1/auth/refresh");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("No refresh token provided");
  });

  it("handles benign race: immediate reuse within grace period does not mass-revoke", async () => {
    const loginA = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    const cookieA = extractCookie(
      loginA.headers["set-cookie"],
      "refresh_token",
    );
    expect(cookieA).toBeDefined();

    const loginB = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    const cookieB = extractCookie(
      loginB.headers["set-cookie"],
      "refresh_token",
    );
    expect(cookieB).toBeDefined();

    // Rotate cookieA — normal flow
    const refreshRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${cookieA}`);
    expect(refreshRes.status).toBe(200);

    // Immediately reuse revoked cookieA — benign race within grace period
    const reuseRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${cookieA}`);
    expect(reuseRes.status).toBe(401);

    // cookieB should NOT be revoked (within grace period)
    const { createHash } = await import("node:crypto");
    const hashB = createHash("sha256").update(cookieB!).digest("hex");
    const tokenB = await prisma.refreshToken.findFirst({
      where: { tokenHash: hashB },
    });
    expect(tokenB).toBeDefined();
    expect(tokenB!.revokedAt).toBeNull();
  });

  it("detects theft: reusing a revoked token after grace period revokes all other sessions", async () => {
    const { authConfig } = await import("../lib/auth.js");
    const origGrace = authConfig.refreshGracePeriodMs;
    authConfig.refreshGracePeriodMs = 0;
    try {
      const loginA = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
      const cookieA = extractCookie(
        loginA.headers["set-cookie"],
        "refresh_token",
      );
      expect(cookieA).toBeDefined();

      const loginB = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
      const cookieB = extractCookie(
        loginB.headers["set-cookie"],
        "refresh_token",
      );
      expect(cookieB).toBeDefined();

      expect(cookieA).not.toBe(cookieB);

      // Rotate cookieA — normal flow
      const refreshRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", `refresh_token=${cookieA}`);
      expect(refreshRes.status).toBe(200);

      // Reuse revoked cookieA — triggers theft detection
      const reuseRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", `refresh_token=${cookieA}`);
      expect(reuseRes.status).toBe(401);

      // cookieB's token should also be revoked in the DB
      const { createHash } = await import("node:crypto");
      const hashB = createHash("sha256").update(cookieB!).digest("hex");
      const tokenB = await prisma.refreshToken.findFirst({
        where: { tokenHash: hashB },
      });
      expect(tokenB).toBeDefined();
      expect(tokenB!.revokedAt).not.toBeNull();
    } finally {
      authConfig.refreshGracePeriodMs = origGrace;
    }
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("returns 200 and clears the cookie", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(loginRes.status).toBe(200);

    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", loginRes.headers["set-cookie"] as unknown as string);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Logged out");

    const setCookie = res.headers["set-cookie"] ?? "";
    const cookieStr = Array.isArray(setCookie)
      ? setCookie.join(";")
      : setCookie;
    expect(cookieStr).toContain("refresh_token=;");
  });

  it("revokes the refresh token so subsequent refresh requests fail", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    function extractCookie(
      setCookie: string | string[] | undefined,
      name: string,
    ): string | undefined {
      const cookies = Array.isArray(setCookie)
        ? setCookie
        : setCookie
          ? [setCookie]
          : [];
      for (const c of cookies) {
        if (c.startsWith(`${name}=`)) {
          return c.split(";")[0]?.slice(name.length + 1);
        }
      }
    }

    const refreshToken = extractCookie(
      loginRes.headers["set-cookie"],
      "refresh_token",
    );
    expect(refreshToken).toBeDefined();

    const logoutRes = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", `refresh_token=${refreshToken}`);
    expect(logoutRes.status).toBe(200);

    const refreshRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${refreshToken}`);
    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.error).toBe("Invalid or expired refresh token");
  });

  it("returns 200 even when no refresh token cookie is present", async () => {
    const res = await request(app).post("/api/v1/auth/logout");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Logged out");
  });
});

describe("requireAuth middleware", () => {
  it("allows access with a valid access token", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    const { accessToken } = loginRes.body;

    const res = await request(app)
      .get("/api/test/protected")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.userId).toBe(loginRes.body.user.id);
    expect(Array.isArray(res.body.user.roleIds)).toBe(true);
  });

  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app).get("/api/test/protected");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Missing or invalid authorization header");
  });

  it("returns 401 for empty Bearer token", async () => {
    const res = await request(app)
      .get("/api/test/protected")
      .set("Authorization", "Bearer ");

    expect(res.status).toBe(401);
  });

  it("returns 401 for malformed token", async () => {
    const res = await request(app)
      .get("/api/test/protected")
      .set("Authorization", "Bearer not-a-valid-jwt");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid or expired token");
  });

  it("returns 401 for token signed with a different secret", async () => {
    const jwt = await import("jsonwebtoken");
    const fakeToken = jwt.sign({ sub: "fake", roles: [] }, "different-secret", {
      expiresIn: "15m",
    });

    const res = await request(app)
      .get("/api/test/protected")
      .set("Authorization", `Bearer ${fakeToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid or expired token");
  });
});

describe("isActive enforcement", () => {
  const tempEmail = "temp-deactivated@test.local";
  const tempPassword = "TempPass123!";
  let tempUserId: string;
  let tempAccessToken: string;
  let tempRefreshToken: string | undefined;

  beforeAll(async () => {
    const bcrypt = await import("bcryptjs");
    const { BCRYPT_ROUNDS } = await import("../lib/auth.js");
    const hash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: tempEmail,
        passwordHash: hash,
        firstName: "Temp",
        lastName: "User",
      },
    });
    tempUserId = user.id;

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: tempEmail, password: tempPassword });

    tempAccessToken = loginRes.body.accessToken;
    tempRefreshToken = extractCookie(
      loginRes.headers["set-cookie"],
      "refresh_token",
    );

    await prisma.user.update({
      where: { id: tempUserId },
      data: { isActive: false },
    });
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { userId: tempUserId } });
    await prisma.user.delete({ where: { id: tempUserId } }).catch(() => {});
  });

  it("rejects login for deactivated user with generic error", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: tempEmail, password: tempPassword });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid credentials");
    expect(res.body.accessToken).toBeUndefined();
  });

  it("rejects access token issued before deactivation", async () => {
    const res = await request(app)
      .get("/api/test/protected")
      .set("Authorization", `Bearer ${tempAccessToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid or expired token");
  });

  it("rejects refresh token rotation for deactivated user and revokes the token", async () => {
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${tempRefreshToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid or expired refresh token");

    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256").update(tempRefreshToken!).digest("hex");
    const revoked = await prisma.refreshToken.findFirst({
      where: { tokenHash: hash },
    });
    expect(revoked).toBeDefined();
    expect(revoked!.revokedAt).not.toBeNull();
  });
});
