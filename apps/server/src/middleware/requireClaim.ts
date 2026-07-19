import type { Request, Response, NextFunction } from "express";
import { resolveClaims } from "../services/authorization.service.js";

export function requireClaim(claimKey: string) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const claims = await resolveClaims(req.user.roleIds);
    if (!claims.has(claimKey)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    next();
  };
}
