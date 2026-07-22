import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { BCRYPT_ROUNDS } from "../lib/auth.js";

async function updatePassword(userId: string, newPassword: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) return false;

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

  return true;
}

export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) {
    console.warn("Password change attempted for non-existent user", { userId });
    return { success: false, error: "User not found" };
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    console.warn("Failed password change: incorrect current password", { userId });
    return { success: false, error: "Current password is incorrect" };
  }

  const ok = await updatePassword(userId, newPassword);
  if (ok) console.log("Password changed successfully", { userId });
  return { success: ok };
}

export async function resetUserPassword(
  userId: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const ok = await updatePassword(userId, newPassword);
  if (!ok) {
    console.warn("Password reset attempted for non-existent user", { userId });
    return { success: false, error: "User not found" };
  }
  console.log("Password reset by admin", { userId });
  return { success: true };
}
