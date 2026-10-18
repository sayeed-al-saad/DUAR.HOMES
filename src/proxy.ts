import type { NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/session-refresh";

/**
 * Next.js Proxy (called Middleware before Next.js 16). Runs before each page
 * request to keep the Supabase session cookie fresh.
 *
 * This is a convenience check only. Real authorisation happens in the page
 * (src/lib/auth/session.ts) and in the database (row-level security).
 */
export async function proxy(request: NextRequest) {
  return refreshSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets and images.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|demo/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2|txt|xml)$).*)",
  ],
};
