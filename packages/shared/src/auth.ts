import { z } from "zod";

export const loginRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const resetPasswordRequestSchema = z.object({
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
