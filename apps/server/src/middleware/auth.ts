import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/auth.js";
import { prisma } from "../db.js";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = header.slice(7);

  // TODO(MVP): This DB lookup on every request is an accepted tradeoff for
  // MVP simplicity. If this becomes a bottleneck, introduce a cache layer
  // (e.g., Redis) rather than removing the check — JWT-only verification
  // would miss users deactivated after the token was issued.
  try {
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isActive: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    req.user = { userId: payload.sub, roleIds: payload.roles };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
