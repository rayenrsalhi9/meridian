import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { loginRequestSchema } from "shared";
import { logger } from "../lib/logger.js";
import {
  loginUser,
  signAccessToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from "../lib/auth.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 10 : 100,
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req.ip ?? "");
    return `${ip}:${(req.body as { email?: string })?.email ?? "unknown"}`;
  },
  handler: (_req, res) => {
    res.status(401).json({ error: "Invalid credentials" });
  },
  standardHeaders: false,
  legacyHeaders: false,
});

const REFRESH_COOKIE = "refresh_token";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/v1/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { email, password } = parsed.data;
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

  const result = await loginUser(email, password);

  if (!result) {
    logger.info({ ip }, "Failed login attempt");
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const accessToken = signAccessToken(result.userId, result.roleIds);
  const refreshToken = await createRefreshToken(result.userId);

  res.cookie(REFRESH_COOKIE, refreshToken.tokenValue, COOKIE_OPTIONS);

  logger.info({ userId: result.userId, ip }, "Successful login");

  res.json({
    accessToken,
    user: {
      id: result.userId,
      roleIds: result.roleIds,
    },
  });
});

router.post("/refresh", async (req, res) => {
  const tokenValue = req.cookies?.[REFRESH_COOKIE];
  if (!tokenValue) {
    res.status(401).json({ error: "No refresh token provided" });
    return;
  }

  const rotated = await rotateRefreshToken(tokenValue);
  if (!rotated) {
    res.clearCookie(REFRESH_COOKIE, COOKIE_OPTIONS);
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }

  const accessToken = signAccessToken(rotated.userId, rotated.roleIds);
  res.cookie(REFRESH_COOKIE, rotated.tokenValue, COOKIE_OPTIONS);

  res.json({ accessToken });
});

router.post("/logout", async (req, res) => {
  const tokenValue = req.cookies?.[REFRESH_COOKIE];

  if (tokenValue) {
    await revokeRefreshToken(tokenValue);
  }

  res.clearCookie(REFRESH_COOKIE, COOKIE_OPTIONS);
  res.status(200).json({ message: "Logged out" });
});

export default router;
