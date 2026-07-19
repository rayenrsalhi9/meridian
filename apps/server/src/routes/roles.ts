import { Router } from "express";
import { createRoleSchema, updateRoleSchema } from "shared";
import { requireAuth } from "../middleware/auth.js";
import { requireClaim } from "../middleware/requireClaim.js";
import { Prisma } from "../generated/prisma/client.js";
import {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
} from "../services/role.service.js";

function isUniqueConstraintError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

const router = Router();

router.use(requireAuth, requireClaim("ROLE_MANAGE"));

router.get("/", async (_req, res) => {
  const roles = await listRoles();
  res.json(roles);
});

router.get("/:id", async (req, res) => {
  const role = await getRole(req.params.id);
  if (!role) {
    res.status(404).json({ error: "Role not found" });
    return;
  }
  res.json(role);
});

router.post("/", async (req, res) => {
  const parsed = createRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const role = await createRole(parsed.data);
    res.status(201).json(role);
  } catch (err: unknown) {
    if (isUniqueConstraintError(err)) {
      res.status(409).json({ error: "A role with this name already exists" });
      return;
    }
    throw err;
  }
});

router.put("/:id", async (req, res) => {
  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const result = await updateRole(req.params.id, parsed.data);
    if (!result) {
      res.status(404).json({ error: "Role not found" });
      return;
    }
    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (err: unknown) {
    if (isUniqueConstraintError(err)) {
      res.status(409).json({ error: "A role with this name already exists" });
      return;
    }
    throw err;
  }
});

router.delete("/:id", async (req, res) => {
  const result = await deleteRole(req.params.id);
  if ("error" in result) {
    const statusCode = result.error === "Role not found" ? 404 : 400;
    res.status(statusCode).json({ error: result.error });
    return;
  }
  res.status(204).end();
});

export default router;
