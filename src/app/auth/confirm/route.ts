import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirects";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const EMAIL_LINK_TYPES: readonly string[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

/**
 * Landing point for links in Supabase Auth emails (confirm sign-up, and later
 * password reset). Handles both link styles Supabase can send:
 *   ?code=...                  the default flow
 *   ?token_hash=...&type=...   when the email template links here directly
 * On success the user is signed in and sent on; otherwise back to login with a message.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));

  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const code = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type");

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, request.nextUrl.origin));
    } else if (tokenHash && type && EMAIL_LINK_TYPES.includes(type)) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
      if (!error) return NextResponse.redirect(new URL(next, request.nextUrl.origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=confirm", request.nextUrl.origin));
}
