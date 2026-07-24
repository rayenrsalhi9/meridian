import { z } from "zod";

export interface PasswordRule {
  label: string
  test: (p: string) => boolean
}

export const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One number", test: (p: string) => /[0-9]/.test(p) },
  { label: "One special character", test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
]

export const passwordSchema = z.string().min(8).regex(/[a-z]/, "Must contain a lowercase letter").regex(/[A-Z]/, "Must contain an uppercase letter").regex(/[0-9]/, "Must contain a number").regex(/[^a-zA-Z0-9]/, "Must contain a special character")
