import { Router } from "express";
import {
  changePasswordRequestSchema,
  resetPasswordRequestSchema,
  createUserSchema,
  updateUserSchema,
} from "shared";
import { requireAuth } from "../middleware/auth.js";
import { requireClaim } from "../middleware/requireClaim.js";
import { resolveClaims } from "../services/authorization.service.js";
import { rateLimiter } from "../lib/rate-limiter.js";
import { parseBody } from "../lib/http.js";
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

const changePasswordLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 10 : 100,
  keyGenerator: (req) => {
    const ip = req.ip ?? "unknown";
    const userId =
      (req as { user?: { userId: string } }).user?.userId ?? "unknown";
    return `${ip}:${userId}`;
  },
});

router.get("/", requireAuth, requireClaim("USER_MANAGE"), async (req, res) => {
  const includeInactive = req.query.includeInactive === "true";
  const users = await listUsers({ includeInactive });
  res.json(users);
});

router.get(
  "/:id",
  requireAuth,
  requireClaim("USER_MANAGE"),
  async (req, res) => {
    const id = req.params.id as string;
    const user = await getUser(id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  },
);

router.post(
  "/",
  requireAuth,
  requireClaim("USER_MANAGE"),
  requireClaim("ROLE_MANAGE"),
  async (req, res) => {
    const data = parseBody(createUserSchema, req, res);
    if (!data) return;

    const result = await createUser(data);
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.status(201).json(result);
  },
);

router.put(
  "/:id",
  requireAuth,
  requireClaim("USER_MANAGE"),
  async (req, res) => {
    const data = parseBody(updateUserSchema, req, res);
    if (!data) return;

    if (data.roleIds !== undefined) {
      const claims = await resolveClaims(req.user!.roleIds);
      if (!claims.has("ROLE_MANAGE")) {
        res.status(403).json({ error: "Insufficient permissions" });
        return;
      }
    }

    const result = await updateUser(req.params.id as string, data);
    if ("error" in result) {
      const status =
        result.error === "User not found"
          ? 404
          : result.error === "Email already in use"
            ? 409
            : result.error === "User is already deactivated"
              ? 409
              : 400;
      res.status(status).json(result);
      return;
    }
    res.json(result);
  },
);

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
      res.status(status).json(result);
      return;
    }
    res.status(204).end();
  },
);

router.post(
  "/:id/change-password",
  requireAuth,
  async (req, res) => {
    if (!changePasswordLimiter(req, res)) return;
    if (req.user!.userId !== req.params.id) {
      res.status(403).json({ error: "You can only change your own password" });
      return;
    }

    const pwData = parseBody(changePasswordRequestSchema, req, res);
    if (!pwData) return;

    const { currentPassword, newPassword } = pwData;
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
    const data = parseBody(resetPasswordRequestSchema, req, res);
    if (!data) return;

    const { newPassword } = data;
    const result = await resetUserPassword(
      req.params.id as string,
      newPassword,
    );

    if (!result.success) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.json({ message: "Password reset successfully" });
  },
);

export default router;
