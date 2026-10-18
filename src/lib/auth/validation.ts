import { z } from "zod";
import { bn } from "@/lib/i18n/bn";

const messages = bn.auth.errors;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, messages.invalidEmail)
  .pipe(z.email(messages.invalidEmail));

// 72 bytes is the limit of the bcrypt hashing Supabase Auth uses.
const password = z.string().min(8, messages.shortPassword).max(72, messages.longPassword);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, messages.shortPassword).max(72, messages.longPassword),
});

export const signupSchema = z.object({
  displayName: z.string().trim().min(1, messages.nameRequired).max(80, messages.nameTooLong),
  email,
  password,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/** First error message per field, ready to show under each input. */
export function fieldErrors<T>(error: z.ZodError): FieldErrors<T> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    if (field && !(field in result)) result[field] = issue.message;
  }
  return result as FieldErrors<T>;
}
