import { z } from "zod";

const email = z.string().trim().min(1, "Enter your email").email("Enter a valid email address");
const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .regex(/[A-Za-z]/, "Include a letter")
  .regex(/\d/, "Include a number");

export const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password") });

export const signupSchema = z
  .object({
    displayName: z.string().trim().min(2, "Enter your name").max(80),
    email,
    password,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export const resetSchema = z.object({ email });

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
export type ResetValues = z.infer<typeof resetSchema>;
