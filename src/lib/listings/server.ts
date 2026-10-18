import "server-only";
import type { CurrentUser } from "@/lib/auth/session";
import { LISTER_TYPES, LISTING_STATUSES, PROPERTY_TYPES, PURPOSES, type ListerType, type ListingStatus, type PropertyType, type Purpose } from "@/lib/domain/types";
import { buildListingSlug, buildListingTitle } from "@/lib/domain/listing-title";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { relevantFacts, type Submission } from "./submission-schema";

/**
 * Listing work done as the signed-in user: submitting, managing your own
 * listings, and (for staff) reviewing. Every call runs with the user's own
 * session, so row-level security and the guard triggers decide what is allowed.
 */

export type SubmitResult =
  | { ok: true; listingId: string; slug: string }
  | { ok: false; reason: "daily_limit" | "location" | "failed" };

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function submitListing(raw: Submission): Promise<SubmitResult> {
  const data = relevantFacts(raw);
  const facts = {
    propertyType: data.propertyType,
    purpose: data.purpose,
    bedrooms: data.bedrooms ?? null,
    sizeSqft: data.sizeSqft ?? null,
    landSizeKatha: data.landSizeKatha ?? null,
  };
  const title = data.title || buildListingTitle(facts);

  const supabase = await createSupabaseServerClient();
  const { data: rows, error } = await supabase.rpc("submit_listing", {
    p: {
      purpose: data.purpose,
      property_type: data.propertyType,
      location_slug: data.locationSlug,
      address_line: data.addressLine,
      price: data.price,
      price_negotiable: data.priceNegotiable,
      size_sqft: data.sizeSqft ?? null,
      land_size_katha: data.landSizeKatha ?? null,
      bedrooms: data.bedrooms ?? null,
      bathrooms: data.bathrooms ?? null,
      balconies: data.balconies ?? null,
      floor_number: data.floorNumber ?? null,
      total_floors: data.totalFloors ?? null,
      furnishing: data.furnishing ?? null,
      parking_spaces: data.parkingSpaces ?? null,
      amenities: data.amenities,
      title,
      slug: buildListingSlug(facts, randomSuffix()),
      description: data.description,
      lister_type: data.listerType,
      contact_name: data.contactName,
      phone: data.phone,
    },
  });

  if (error) {
    if (error.hint === "daily_limit") return { ok: false, reason: "daily_limit" };
    if (error.hint === "location") return { ok: false, reason: "location" };
    console.error("submit_listing failed:", error.code, error.message);
    return { ok: false, reason: "failed" };
  }
  const row = (rows as Array<{ listing_id: string; listing_slug: string }>)[0];
  return { ok: true, listingId: row.listing_id, slug: row.listing_slug };
}

/** Records photos the browser has uploaded to <user id>/<listing id>/. */
export async function attachPhotos(user: CurrentUser, listingId: string, paths: string[], alt: string): Promise<number> {
  const prefix = `${user.id}/${listingId}/`;
  const safe = paths.filter((path) => path.startsWith(prefix) && /^[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\.(jpg|png|webp)$/i.test(path));
  if (safe.length === 0) return 0;

  const supabase = await createSupabaseServerClient();
  const rows = safe.slice(0, 8).map((path, index) => ({
    listing_id: listingId,
    url: supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl,
    storage_path: path,
    alt_bn: alt.slice(0, 200),
    sort_order: index,
    is_primary: index === 0,
    rights_status: "owned",
  }));
  const { error, count } = await supabase.from("listing_images").insert(rows, { count: "exact" });
  if (error) {
    console.error("attaching photos failed:", error.code, error.message);
    return 0;
  }
  return count ?? rows.length;
}

export interface OwnListing {
  id: string;
  slug: string;
  title: string;
  status: ListingStatus;
  purpose: Purpose;
  propertyType: PropertyType;
  price: number;
  locationSlug: string;
  locationNameBn: string;
  parentLocationNameBn: string | null;
  imageUrl: string | null;
  submittedAt: string;
  listerType: ListerType;
  description: string | null;
  listedByUserId: string;
}

type Row = Record<string, unknown>;

function oneOf<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function toOwn(row: Row): OwnListing {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    status: oneOf(LISTING_STATUSES, row.status, "pending_review"),
    purpose: oneOf(PURPOSES, row.purpose, "sale"),
    propertyType: oneOf(PROPERTY_TYPES, row.property_type, "apartment"),
    price: Number(row.price),
    locationSlug: String(row.location_slug),
    locationNameBn: String(row.location_name_bn),
    parentLocationNameBn: row.location_type === "area" && typeof row.parent_location_name_bn === "string" ? row.parent_location_name_bn : null,
    imageUrl: typeof row.image_url === "string" ? row.image_url : null,
    submittedAt: String(row.submitted_at),
    listerType: oneOf(LISTER_TYPES, row.lister_type, "owner"),
    description: typeof row.description === "string" ? row.description : null,
    listedByUserId: String(row.listed_by_user_id),
  };
}

const OWN_COLUMNS =
  "id, slug, title, status, purpose, property_type, price, location_slug, location_name_bn, location_type, parent_location_name_bn, image_url, submitted_at, lister_type, description, listed_by_user_id";

export async function getMyListings(user: CurrentUser): Promise<OwnListing[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("my_listings")
    .select(OWN_COLUMNS)
    .eq("listed_by_user_id", user.id)
    .order("submitted_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Could not load your listings: ${error.message}`);
  return (data as Row[]).map(toOwn);
}

/** The statuses a lister may set on their own listing. The database enforces the same list. */
export const LISTER_STATUS_CHANGES = ["sold", "rented", "archived"] as const;
export type ListerStatusChange = (typeof LISTER_STATUS_CHANGES)[number];

export async function setOwnListingStatus(user: CurrentUser, listingId: string, status: ListerStatusChange): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("property_listings")
    .update({ status }, { count: "exact" })
    .eq("id", listingId)
    .eq("listed_by_user_id", user.id);
  if (error) console.error("status change failed:", error.code, error.message);
  return !error && (count ?? 0) > 0;
}

export interface PendingListing extends OwnListing {
  addressLine: string | null;
  contactName: string | null;
  phone: string | null;
  photos: string[];
  facts: Row;
}

/** Staff only: listings waiting for review, with the private details needed to check them. */
export async function getPendingListings(): Promise<PendingListing[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("my_listings")
    .select(`${OWN_COLUMNS}, property_id, size_sqft, land_size_katha, bedrooms, bathrooms`)
    .eq("status", "pending_review")
    .order("submitted_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(`Could not load the review queue: ${error.message}`);
  const rows = data as Row[];
  if (rows.length === 0) return [];

  const ids = rows.map((row) => String(row.id));
  const propertyIds = rows.map((row) => String(row.property_id));
  const [contacts, addresses, images] = await Promise.all([
    supabase.from("listing_contacts").select("listing_id, contact_name, phone").in("listing_id", ids),
    supabase.from("property_private").select("property_id, address_line").in("property_id", propertyIds),
    supabase.from("listing_images").select("listing_id, url, sort_order").in("listing_id", ids).order("sort_order"),
  ]);
  const contactBy = new Map(((contacts.data ?? []) as Row[]).map((row) => [String(row.listing_id), row]));
  const addressBy = new Map(((addresses.data ?? []) as Row[]).map((row) => [String(row.property_id), row]));

  return rows.map((row) => {
    const contact = contactBy.get(String(row.id));
    const address = addressBy.get(String(row.property_id));
    return {
      ...toOwn(row),
      addressLine: typeof address?.address_line === "string" ? address.address_line : null,
      contactName: typeof contact?.contact_name === "string" ? contact.contact_name : null,
      phone: typeof contact?.phone === "string" ? contact.phone : null,
      photos: ((images.data ?? []) as Row[]).filter((image) => image.listing_id === row.id).map((image) => String(image.url)),
      facts: row,
    };
  });
}

export async function reviewListing(listingId: string, decision: "active" | "rejected"): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("property_listings")
    .update({ status: decision }, { count: "exact" })
    .eq("id", listingId)
    .eq("status", "pending_review");
  if (error) console.error("review failed:", error.code, error.message);
  return !error && (count ?? 0) > 0;
}
