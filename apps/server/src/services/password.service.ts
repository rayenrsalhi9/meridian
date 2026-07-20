import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { logger } from "../lib/logger.js";
import { BCRYPT_ROUNDS } from "../lib/auth.js";

export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    logger.warn({ userId }, "Password change attempted for non-existent user");
    return { success: false, error: "User not found" };
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    logger.warn(
      { userId },
      "Failed password change: incorrect current password",
    );
    return { success: false, error: "Current password is incorrect" };
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  logger.info({ userId }, "Password changed successfully");
  return { success: true };
}

export async function resetUserPassword(
  userId: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    logger.warn({ userId }, "Password reset attempted for non-existent user");
    return { success: false, error: "User not found" };
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  logger.info({ userId }, "Password reset by admin");
  return { success: true };
}
