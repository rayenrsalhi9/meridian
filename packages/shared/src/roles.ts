import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(255).optional(),
  claimIds: z.array(z.string().uuid()).min(1, "At least one claim is required"),
});

export type CreateRoleRequest = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(255).optional(),
  claimIds: z.array(z.string().uuid()).min(1).optional(),
});

export type UpdateRoleRequest = z.infer<typeof updateRoleSchema>;
