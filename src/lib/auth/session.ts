import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { USER_ROLES, type UserRole } from "@/lib/domain/types";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasAnyRole } from "./roles";

/** The little we pass around about the signed-in user. No tokens, no phone number. */
export interface CurrentUser {
  id: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  createdAt: string | null;
}

/**
 * The signed-in user, or null.
 *
 * The identity comes from a verified token (getClaims checks the signature or
 * asks the Auth server), never from an unverified cookie. `cache` makes several
 * components on one page share a single lookup.
 *
 * Reads cookies, so call it from inside a <Suspense> boundary, a Server Action
 * or a Route Handler.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!isSupabaseConfigured) return null;

  // Visitors without a session cookie need no network call at all.
  const cookieStore = await cookies();
  const hasSession = cookieStore.getAll().some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));
  if (!hasSession) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  // Row-level security lets a user read only their own profile row.
  const { data: profile } = await supabase
    .from("users")
    .select("display_name, role, created_at")
    .eq("id", claims.sub)
    .maybeSingle();

  const role = USER_ROLES.includes(profile?.role) ? (profile?.role as UserRole) : "member";

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    displayName: profile?.display_name ?? null,
    role,
    createdAt: profile?.created_at ?? null,
  };
});

/** For pages that need a signed-in user. Sends everyone else to the login page. */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/** For pages limited to certain roles, such as the admin area in Phase 4. */
export async function requireRole(allowed: readonly UserRole[], returnTo: string): Promise<CurrentUser> {
  const user = await requireUser(returnTo);
  if (!hasAnyRole(user.role, allowed)) redirect("/");
  return user;
}
