import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";

const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is required");
  return secret;
})();

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const BCRYPT_ROUNDS = 12;

const DUMMY_PASSWORD_HASH = "$2b$12$QKooj7sysm30Ge8qpcopGeFnzts.kwkcyUJvYoAW3PFiAuziXMD02";

export const authConfig = {
  refreshGracePeriodMs: 10_000,
};

export interface AccessTokenPayload {
  sub: string;
  roles: string[];
}

export function signAccessToken(userId: string, roleIds: string[]): string {
  return jwt.sign({ sub: userId, roles: roleIds }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
  if (!payload.sub || !Array.isArray(payload.roles)) {
    throw new Error("Invalid token payload");
  }
  return { sub: payload.sub, roles: payload.roles };
}

function generateRefreshTokenValue(): string {
  return crypto.randomBytes(48).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function refreshTokenExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return d;
}

export async function createRefreshToken(userId: string): Promise<{
  tokenValue: string;
  expiresAt: Date;
}> {
  const tokenValue = generateRefreshTokenValue();
  const tokenHash = hashToken(tokenValue);
  const expiresAt = refreshTokenExpiresAt();

  await prisma.refreshToken.create({
    data: { tokenHash, userId, expiresAt },
  });

  return { tokenValue, expiresAt };
}

export async function rotateRefreshToken(
  oldTokenValue: string,
): Promise<{
  tokenValue: string;
  expiresAt: Date;
  userId: string;
  roleIds: string[];
} | null> {
  const oldHash = hashToken(oldTokenValue);

  const existing = await prisma.refreshToken.findFirst({
    where: { tokenHash: oldHash, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: { include: { userRoles: { select: { roleId: true } } } } },
  });

  if (!existing) {
    const revoked = await prisma.refreshToken.findFirst({
      where: { tokenHash: oldHash },
    });
    if (revoked?.revokedAt) {
      const timeSinceRevocation = Date.now() - revoked.revokedAt.getTime();
      if (timeSinceRevocation > authConfig.refreshGracePeriodMs) {
        await prisma.refreshToken.updateMany({
          where: { userId: revoked.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }
    return null;
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  const { tokenValue, expiresAt } = await createRefreshToken(existing.userId);
  return {
    tokenValue,
    expiresAt,
    userId: existing.userId,
    roleIds: existing.user.userRoles.map((ur) => ur.roleId),
  };
}

export async function loginUser(
  email: string,
  password: string,
): Promise<{ userId: string; roleIds: string[] } | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { userRoles: { select: { roleId: true } } },
  });

  if (!user) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    return null;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return {
    userId: user.id,
    roleIds: user.userRoles.map((ur) => ur.roleId),
  };
}

export { BCRYPT_ROUNDS };
