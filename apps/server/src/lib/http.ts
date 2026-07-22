import type { Request, Response } from "express";
import type { ZodSchema } from "zod";

export function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((c) => {
      const eq = c.indexOf("=");
      return eq === -1
        ? [c.trim(), ""]
        : [c.slice(0, eq).trim(), c.slice(eq + 1).trim()];
    }),
  );
}

export function parseBody<T>(schema: ZodSchema<T>, req: Request, res: Response): T | null {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      details: parsed.error.flatten().fieldErrors,
    });
    return null;
  }
  return parsed.data;
}
