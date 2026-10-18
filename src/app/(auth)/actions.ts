"use server";

import type { AuthError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/redirects";
import { fieldErrors, loginSchema, signupSchema, type FieldErrors, type LoginInput, type SignupInput } from "@/lib/auth/validation";
import { siteConfig } from "@/lib/config/site";
import { isSupabaseConfigured } from "@/lib/env";
import { bn } from "@/lib/i18n/bn";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Login, sign-up and logout as Server Actions.
 *
 * Passwords go from the form straight to the server and on to Supabase Auth;
 * they are never stored or logged here, and never echoed back to the form.
 * Supabase applies its own rate limits to these endpoints.
 */

export interface AuthFormState {
  status: "idle" | "error" | "check_email";
  message?: string;
  errors?: FieldErrors<SignupInput>;
  /** Non-secret values to refill the form after an error. */
  values?: { email?: string; displayName?: string };
}

const messages = bn.auth.errors;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function messageFor(error: AuthError): string {
  if (error.status === 429 || error.code?.startsWith("over_")) return messages.rateLimited;
  switch (error.code) {
    case "invalid_credentials":
      return messages.invalidCredentials;
    case "email_not_confirmed":
      return messages.emailNotConfirmed;
    case "user_already_exists":
    case "email_exists":
      return messages.alreadyRegistered;
    case "weak_password":
      return messages.shortPassword;
    case "validation_failed":
    case "email_address_invalid":
      return messages.invalidEmail;
    default:
      return messages.generic;
  }
}

export async function loginAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured) return { status: "error", message: bn.auth.notConfigured };

  const email = text(formData, "email");
  const parsed = loginSchema.safeParse({ email, password: text(formData, "password") });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors<LoginInput>(parsed.error), values: { email } };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { status: "error", message: messageFor(error), values: { email } };
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function signupAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured) return { status: "error", message: bn.auth.notConfigured };

  const email = text(formData, "email");
  const displayName = text(formData, "displayName");
  const parsed = signupSchema.safeParse({ displayName, email, password: text(formData, "password") });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors<SignupInput>(parsed.error), values: { email, displayName } };
  }

  const next = safeNextPath(formData.get("next"));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Only the display name. The account role is fixed to "member" in the database.
      data: { display_name: parsed.data.displayName },
      // Kept free of query parameters so it matches the redirect allow-list in
      // Supabase exactly. After confirming, the user lands on their account page.
      emailRedirectTo: `${siteConfig.url}/auth/confirm`,
    },
  });

  if (error) {
    return { status: "error", message: messageFor(error), values: { email, displayName } };
  }

  // With email confirmation switched off in Supabase, the user is signed in at once.
  if (data.session) redirect(next);

  // Same answer whether or not the address was already registered, so the
  // form cannot be used to find out who has an account.
  return { status: "check_email" };
}

export async function logoutAction(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
