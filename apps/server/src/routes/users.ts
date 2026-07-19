import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import {
  changePasswordRequestSchema,
  resetPasswordRequestSchema,
  createUserSchema,
  updateUserSchema,
} from "shared";
import { requireAuth } from "../middleware/auth.js";
import { requireClaim } from "../middleware/requireClaim.js";
import { authConfig } from "../lib/auth.js";
import {
  changeUserPassword,
  resetUserPassword,
} from "../services/password.service.js";
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
} from "../services/user.service.js";

const router = Router();

const changePasswordLimiter = rateLimit({
  windowMs: authConfig.changePasswordRateLimit.windowMs,
  max: authConfig.changePasswordRateLimit.max,
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req.ip ?? "");
    const userId = (req as { user?: { userId: string } }).user?.userId ?? "unknown";
    return `${ip}:${userId}`;
  },
  handler: (_req, res) => {
    res.status(401).json({ error: "Current password is incorrect" });
  },
  standardHeaders: false,
  legacyHeaders: false,
});

router.get("/", requireAuth, requireClaim("USER_MANAGE"), async (req, res) => {
  const includeInactive = req.query.includeInactive === "true";
  const users = await listUsers({ includeInactive });
  res.json(users);
});

router.get("/:id", requireAuth, requireClaim("USER_MANAGE"), async (req, res) => {
  const id = req.params.id as string;
  const user = await getUser(id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

router.post(
  "/",
  requireAuth,
  requireClaim("USER_MANAGE"),
  requireClaim("ROLE_MANAGE"),
  async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const result = await createUser(parsed.data);
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.status(201).json(result);
  },
);

router.put("/:id", requireAuth, requireClaim("USER_MANAGE"), async (req, res, next) => {
  if (req.body?.roleIds !== undefined) {
    return requireClaim("ROLE_MANAGE")(req, res, next);
  }
  next();
}, async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const result = await updateUser(req.params.id as string, parsed.data);
  if ("error" in result) {
    const status =
      result.error === "User not found"
        ? 404
        : result.error === "Email already in use"
          ? 409
          : 400;
    res.status(status).json({ error: result.error });
    return;
  }
  res.json(result);
});

router.delete(
  "/:id",
  requireAuth,
  requireClaim("USER_MANAGE"),
  async (req, res) => {
    const result = await deactivateUser(req.params.id as string);
    if ("error" in result) {
      let status: number;
      if (result.error === "User not found") {
        status = 404;
      } else if (result.error === "User is already deactivated") {
        status = 409;
      } else {
        status = 400;
      }
      res.status(status).json({ error: result.error });
      return;
    }
    res.status(204).end();
  },
);

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
    const result = await resetUserPassword(req.params.id as string, newPassword);

    if (!result.success) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.json({ message: "Password reset successfully" });
  },
);

export default router;
