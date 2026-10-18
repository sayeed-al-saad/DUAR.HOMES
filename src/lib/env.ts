/**
 * Environment access in one place.
 *
 * NEXT_PUBLIC_ values are safe in the browser. The Supabase publishable (anon)
 * key is designed to be public: row-level security is what protects the data.
 * The service-role key must never get a NEXT_PUBLIC_ name.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// Newer projects issue a "publishable" key; older ones call it the "anon" key.
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Map tiles for the search map. The default is OpenStreetMap's own tile
 * server, which is free for light use under its tile usage policy
 * (https://operations.osmfoundation.org/policies/tiles/). For real traffic,
 * point these at a tile provider you have an account with.
 */
const mapTileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const mapAttribution =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const env = { supabaseUrl, supabaseKey, mapTileUrl, mapAttribution } as const;

export const isSupabaseConfigured = supabaseUrl.length > 0 && supabaseKey.length > 0;

export type DataSourceKind = "demo" | "supabase";

/**
 * Where listings come from.
 *   DATA_SOURCE=demo      bundled demo data (default when Supabase is not set up)
 *   DATA_SOURCE=supabase  the database (default once Supabase is set up)
 * Setting DATA_SOURCE=demo with Supabase configured gives working login on top
 * of demo listings, which is handy before the database has been seeded.
 */
export function dataSourceKind(): DataSourceKind {
  const requested = process.env.DATA_SOURCE;
  if (requested === "demo") return "demo";
  if (requested === "supabase") {
    if (!isSupabaseConfigured) {
      throw new Error("DATA_SOURCE=supabase needs NEXT_PUBLIC_SUPABASE_URL and a Supabase key. See .env.example.");
    }
    return "supabase";
  }
  return isSupabaseConfigured ? "supabase" : "demo";
}
