import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { env } from "@/lib/env";

/**
 * Supabase client that acts as the signed-in user, for Server Components,
 * Server Actions and Route Handlers. Create a new one for every request.
 *
 * Reading cookies makes the caller render at request time, so keep calls
 * inside a <Suspense> boundary or behind an action.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  // The auth client reads the clock when it starts (to check the session's
  // expiry). Cookies alone can be available while a page is prefetched, so
  // also wait for a real request before starting it.
  await connection();
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. src/proxy.ts refreshes the
          // session on the way in, so there is nothing to do here.
        }
      },
    },
  });
}
