import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import {
  changePasswordRequestSchema,
  resetPasswordRequestSchema,
} from "shared";
import { requireAuth } from "../middleware/auth.js";
import { requireClaim } from "../middleware/requireClaim.js";
import { authConfig } from "../lib/auth.js";
import {
  changeUserPassword,
  resetUserPassword,
} from "../services/password.service.js";

const router = Router();

const changePasswordLimiter = rateLimit({
  windowMs: authConfig.changePasswordRateLimit.windowMs,
  max: authConfig.changePasswordRateLimit.max,
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req);
    const userId = (req as { user?: { userId: string } }).user?.userId ?? "unknown";
    return `${ip}:${userId}`;
  },
  handler: (_req, res) => {
    res.status(401).json({ error: "Current password is incorrect" });
  },
  standardHeaders: false,
  legacyHeaders: false,
});

router.post(
  "/:id/change-password",
  requireAuth,
  changePasswordLimiter,
  async (req, res) => {
    if (req.user!.userId !== req.params.id) {
      res.status(403).json({ error: "You can only change your own password" });
      return;
    }

    const parsed = changePasswordRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { currentPassword, newPassword } = parsed.data;
    const result = await changeUserPassword(
      req.params.id,
      currentPassword,
      newPassword,
    );

    if (!result.success) {
      const status =
        result.error === "Current password is incorrect" ? 401 : 404;
      res.status(status).json({ error: result.error });
      return;
    }

    res.json({ message: "Password changed successfully" });
  },
);

router.post(
  "/:id/reset-password",
  requireAuth,
  requireClaim("USER_MANAGE"),
  async (req, res) => {
    const parsed = resetPasswordRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { newPassword } = parsed.data;
    const result = await resetUserPassword(req.params.id, newPassword);

    if (!result.success) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.json({ message: "Password reset successfully" });
  },
);

export default router;
