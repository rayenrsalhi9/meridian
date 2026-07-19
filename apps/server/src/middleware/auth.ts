import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/auth.js";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = header.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = { userId: payload.sub, roleIds: payload.roles };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
