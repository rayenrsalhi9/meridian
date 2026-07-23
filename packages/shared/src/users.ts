import { z } from "zod";
import { passwordSchema } from "./password.js";

export const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  password: passwordSchema,
  roleIds: z.array(z.string().uuid()).min(1, "At least one role is required"),
});

export type CreateUserRequest = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  roleIds: z.array(z.string().uuid()).min(1).optional(),
});

export type UpdateUserRequest = z.infer<typeof updateUserSchema>;
