import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Supabase client for public, cacheable reads on the server.
 *
 * It carries no cookies and no user session, so every visitor gets the same
 * answer and the result is safe to cache and prerender. It acts as the `anon`
 * role and can only see what row-level security allows a visitor to see.
 */
export function createSupabasePublicClient(): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      // Caching is decided in one place: the "use cache" functions in
      // src/lib/data/index.ts, with their lifetimes and tags. Without this,
      // Next.js also keeps its own copy of each response made during a build
      // (in .next/cache, for 15 minutes, untagged), and a rebuild soon after a
      // change to the database would show the old data.
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
