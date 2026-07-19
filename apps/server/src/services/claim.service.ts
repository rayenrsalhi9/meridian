import { prisma } from "../db.js";

export async function listClaims() {
  const claims = await prisma.claim.findMany({
    select: { id: true, key: true },
    orderBy: { key: "asc" },
  });
  return claims;
}
