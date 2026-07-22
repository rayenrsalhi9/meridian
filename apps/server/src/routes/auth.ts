import { Router } from "express";
import { loginRequestSchema, updateProfileSchema } from "shared";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db.js";
import {
  loginUser,
  signAccessToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from "../lib/auth.js";
import { parseCookies, parseBody } from "../lib/http.js";
import { rateLimiter } from "../lib/rate-limiter.js";

const router = Router();

const REFRESH_COOKIE = "refresh_token";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/v1/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const loginLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 10 : 100,
  status: 401,
  message: "Invalid credentials",
});

router.post("/login", async (req, res) => {
  if (!loginLimiter(req, res)) return;

  const data = parseBody(loginRequestSchema, req, res);
  if (!data) return;

  const { email, password } = data;
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

  const result = await loginUser(email, password);
  if (!result) {
    console.log("Failed login attempt", { ip });
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const accessToken = signAccessToken(result.userId, result.roleIds);
  const refreshToken = await createRefreshToken(result.userId);

  res.cookie(REFRESH_COOKIE, refreshToken.tokenValue, COOKIE_OPTIONS);
  console.log("Successful login", { userId: result.userId, ip });
  res.json({
    accessToken,
    user: { id: result.userId, roleIds: result.roleIds },
  });
});

router.post("/refresh", async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const tokenValue = cookies[REFRESH_COOKIE];
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
  const cookies = parseCookies(req.headers.cookie);
  const tokenValue = cookies[REFRESH_COOKIE];

  if (tokenValue) {
    await revokeRefreshToken(tokenValue);
  }

  res.clearCookie(REFRESH_COOKIE, COOKIE_OPTIONS);
  res.status(200).json({ message: "Logged out" });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

router.put("/me", requireAuth, async (req, res) => {
  const data = parseBody(updateProfileSchema, req, res);
  if (!data) return;

  const { firstName, lastName } = data;

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { firstName, lastName },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  console.log("Profile updated", { userId: user.id });
  res.json(user);
});

export default router;
