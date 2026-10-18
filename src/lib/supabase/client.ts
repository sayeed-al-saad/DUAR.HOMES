"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let browserClient: SupabaseClient | undefined;

/**
 * Supabase client for Client Components. One instance per browser tab.
 *
 * Nothing in Phase 1 needs it (forms use Server Actions, which keeps the
 * Supabase library out of the JavaScript sent to phones). It is here for
 * features that need the browser: realtime updates and direct image uploads.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  browserClient ??= createBrowserClient(env.supabaseUrl, env.supabaseKey);
  return browserClient;
}
