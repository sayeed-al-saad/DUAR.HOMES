import "server-only";
import type { CurrentUser } from "@/lib/auth/session";
import { LISTING_STATUSES, PURPOSES, type ListingOrigin, type ListingStatus, type Purpose } from "@/lib/domain/types";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Saved listings and price-drop alerts, read and written as the signed-in
 * user. Row-level security (and the my_* views) limit every query to the
 * user's own rows; the alerts themselves are written by a database trigger,
 * never from here.
 */

type Row = Record<string, unknown>;

function oneOf<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Same rule as the public pages: only our own bucket or the bundled demo pictures. */
function safeImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.startsWith("/demo/")) return value;
  return env.supabaseUrl && value.startsWith(`${env.supabaseUrl}/storage/v1/object/public/listing-images/`) ? value : null;
}

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);

export async function isListingSaved(user: CurrentUser, listingId: string): Promise<boolean> {
  if (!isUuid(listingId)) return false;
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("favorites")
    .select("listing_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("listing_id", listingId);
  if (error) console.error("saved check failed:", error.code, error.message);
  return (count ?? 0) > 0;
}

export async function setListingSaved(user: CurrentUser, listingId: string, saved: boolean): Promise<boolean> {
  if (!isUuid(listingId)) return false;
  const supabase = await createSupabaseServerClient();
  if (saved) {
    // The database fills in the price at the moment of saving.
    const { error } = await supabase.from("favorites").upsert(
      { user_id: user.id, listing_id: listingId },
      { onConflict: "user_id,listing_id", ignoreDuplicates: true },
    );
    if (error) console.error("save failed:", error.code, error.message);
    return !error;
  }
  const { error } = await supabase.from("favorites").delete().eq("user_id", user.id).eq("listing_id", listingId);
  if (error) console.error("unsave failed:", error.code, error.message);
  return !error;
}

export interface SavedListing {
  id: string;
  slug: string;
  title: string;
  purpose: Purpose;
  status: ListingStatus;
  price: number;
  savedPrice: number | null;
  savedAt: string;
  locationSlug: string;
  locationNameBn: string;
  parentLocationNameBn: string | null;
  sourceName: string;
  imageUrl: string | null;
  alsoListedCount: number;
  groupMinPrice: number | null;
}

export async function getSavedListings(): Promise<SavedListing[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("my_saved_listings")
    .select(
      "id, slug, title, purpose, status, price, saved_price, saved_at, location_slug, location_name_bn, location_type, parent_location_name_bn, source_name, image_url, also_listed_count, group_min_price",
    )
    .order("saved_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Could not load your saved listings: ${error.message}`);
  return (data as Row[]).map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    purpose: oneOf(PURPOSES, row.purpose, "sale"),
    status: oneOf(LISTING_STATUSES, row.status, "active"),
    price: Number(row.price),
    savedPrice: row.saved_price === null ? null : Number(row.saved_price),
    savedAt: String(row.saved_at),
    locationSlug: String(row.location_slug),
    locationNameBn: String(row.location_name_bn),
    parentLocationNameBn: row.location_type === "area" && typeof row.parent_location_name_bn === "string" ? row.parent_location_name_bn : null,
    sourceName: String(row.source_name),
    // Same rule as the public pages: only our bucket or the demo pictures.
    imageUrl: safeImageUrl(row.image_url),
    alsoListedCount: Number(row.also_listed_count ?? 0),
    groupMinPrice: row.group_min_price === null || row.group_min_price === undefined ? null : Number(row.group_min_price),
  }));
}

export interface PriceAlert {
  id: string;
  oldPrice: number;
  newPrice: number;
  createdAt: string;
  read: boolean;
  listingId: string;
  slug: string;
  title: string;
  purpose: Purpose;
  locationSlug: string;
  sourceName: string;
  origin: ListingOrigin;
}

export async function getPriceAlerts(limit = 50): Promise<PriceAlert[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("my_notifications")
    .select("id, old_price, new_price, created_at, read_at, listing_id, slug, title, purpose, location_slug, source_name, origin")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load your alerts: ${error.message}`);
  return (data as Row[]).map((row) => ({
    id: String(row.id),
    oldPrice: Number(row.old_price),
    newPrice: Number(row.new_price),
    createdAt: String(row.created_at),
    read: row.read_at !== null,
    listingId: String(row.listing_id),
    slug: String(row.slug),
    title: String(row.title),
    purpose: oneOf(PURPOSES, row.purpose, "sale"),
    locationSlug: String(row.location_slug),
    sourceName: String(row.source_name),
    origin: row.origin === "first_party" ? "first_party" : "external",
  }));
}

export async function countUnreadAlerts(user: CurrentUser): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}

export async function markAllAlertsRead(user: CurrentUser): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) console.error("mark read failed:", error.code, error.message);
  return !error;
}
