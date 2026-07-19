import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireClaim } from "../middleware/requireClaim.js";
import { listClaims } from "../services/claim.service.js";

const router = Router();

router.get("/", requireAuth, requireClaim("ROLE_MANAGE"), async (_req, res) => {
  const claims = await listClaims();
  res.json(claims);
});

export default router;
