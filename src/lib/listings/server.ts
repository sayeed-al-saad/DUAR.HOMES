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

/** The form's answers as the database functions expect them. Shared by submitting and editing. */
function listingPayload(raw: Submission) {
  const data = relevantFacts(raw);
  const facts = {
    propertyType: data.propertyType,
    purpose: data.purpose,
    bedrooms: data.bedrooms ?? null,
    sizeSqft: data.sizeSqft ?? null,
    landSizeKatha: data.landSizeKatha ?? null,
  };
  return {
    facts,
    payload: {
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
      title: data.title || buildListingTitle(facts),
      description: data.description,
      lister_type: data.listerType,
      contact_name: data.contactName,
      phone: data.phone,
      whatsapp: data.hasWhatsapp ? data.phone : null,
      show_phone: data.showPhone,
    },
  };
}

export async function submitListing(raw: Submission): Promise<SubmitResult> {
  const { facts, payload } = listingPayload(raw);
  const supabase = await createSupabaseServerClient();
  const { data: rows, error } = await supabase.rpc("submit_listing", {
    p: { ...payload, slug: buildListingSlug(facts, randomSuffix()) },
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

// ---------------------------------------------------------------------------
// Editing your own listing
// ---------------------------------------------------------------------------

/** Listings their lister can still edit. The database enforces the same list. */
export const EDITABLE_STATUSES = ["pending_review", "active"] as const;

export interface EditableListing {
  id: string;
  slug: string;
  status: ListingStatus;
  locationSlug: string;
  photos: Array<{ id: string; url: string }>;
  /** The form's starting values, in the same shape the form submits. */
  values: {
    purpose: Purpose;
    propertyType: PropertyType;
    addressLine: string;
    price: string;
    priceNegotiable: boolean;
    sizeSqft: string;
    landSizeKatha: string;
    bedrooms: string;
    bathrooms: string;
    balconies: string;
    floorNumber: string;
    totalFloors: string;
    furnishing: string;
    parkingSpaces: string;
    amenities: string[];
    title: string;
    description: string;
    listerType: ListerType;
    contactName: string;
    phone: string;
    showPhone: boolean;
    hasWhatsapp: boolean;
  };
}

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);

/** One of the user's own listings with everything the edit form needs, or null. */
export async function getListingForEdit(user: CurrentUser, listingId: string): Promise<EditableListing | null> {
  if (!isUuid(listingId)) return null;
  const supabase = await createSupabaseServerClient();
  const { data: listing } = await supabase
    .from("property_listings")
    .select("id, slug, status, purpose, title, description, price, price_negotiable, lister_type, property_id")
    .eq("id", listingId)
    .eq("listed_by_user_id", user.id)
    .maybeSingle();
  if (!listing) return null;
  const row = listing as Row;
  const propertyId = String(row.property_id);

  const [property, amenities, address, contact, images] = await Promise.all([
    supabase
      .from("properties")
      .select("property_type, size_sqft, land_size_katha, bedrooms, bathrooms, balconies, floor_number, total_floors, furnishing, parking_spaces, locations(slug)")
      .eq("id", propertyId)
      .maybeSingle(),
    supabase.from("property_amenities").select("amenity_slug").eq("property_id", propertyId),
    supabase.from("property_private").select("address_line").eq("property_id", propertyId).maybeSingle(),
    supabase.from("listing_contacts").select("contact_name, phone, whatsapp, show_phone").eq("listing_id", listingId).maybeSingle(),
    supabase.from("listing_images").select("id, url, sort_order").eq("listing_id", listingId).order("sort_order"),
  ]);
  const facts = (property.data ?? {}) as Row;
  const place = facts.locations as { slug?: unknown } | null;
  const phone = (contact.data ?? {}) as Row;

  return {
    id: listingId,
    slug: String(row.slug),
    status: oneOf(LISTING_STATUSES, row.status, "pending_review"),
    locationSlug: text(place?.slug),
    photos: ((images.data ?? []) as Row[]).map((image) => ({ id: String(image.id), url: String(image.url) })),
    values: {
      purpose: oneOf(PURPOSES, row.purpose, "rent"),
      propertyType: oneOf(PROPERTY_TYPES, facts.property_type, "apartment"),
      addressLine: text((address.data as Row | null)?.address_line),
      price: text(row.price === null ? "" : Number(row.price)),
      priceNegotiable: row.price_negotiable === true,
      sizeSqft: text(facts.size_sqft === null || facts.size_sqft === undefined ? "" : Number(facts.size_sqft)),
      landSizeKatha: text(facts.land_size_katha === null || facts.land_size_katha === undefined ? "" : Number(facts.land_size_katha)),
      bedrooms: text(facts.bedrooms),
      bathrooms: text(facts.bathrooms),
      balconies: text(facts.balconies),
      floorNumber: text(facts.floor_number),
      totalFloors: text(facts.total_floors),
      furnishing: text(facts.furnishing),
      parkingSpaces: text(facts.parking_spaces),
      amenities: ((amenities.data ?? []) as Row[]).map((amenity) => String(amenity.amenity_slug)),
      title: text(row.title),
      description: text(row.description),
      listerType: oneOf(LISTER_TYPES, row.lister_type, "owner"),
      contactName: text(phone.contact_name),
      phone: text(phone.phone),
      showPhone: phone.show_phone === true,
      hasWhatsapp: typeof phone.whatsapp === "string" && phone.whatsapp.length > 0,
    },
  };
}

export type UpdateResult = { ok: true; status: ListingStatus } | { ok: false; reason: "not_editable" | "location" | "failed" };

/** Saves the edit form (everything but photos). Returns the listing's status afterwards. */
export async function updateListing(listingId: string, raw: Submission): Promise<UpdateResult> {
  if (!isUuid(listingId)) return { ok: false, reason: "not_editable" };
  const { payload } = listingPayload(raw);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_listing", { p_listing_id: listingId, p: payload });
  if (error) {
    if (error.hint === "not_editable") return { ok: false, reason: "not_editable" };
    if (error.hint === "location") return { ok: false, reason: "location" };
    console.error("update_listing failed:", error.code, error.message);
    return { ok: false, reason: "failed" };
  }
  return { ok: true, status: oneOf(LISTING_STATUSES, data, "pending_review") };
}

/**
 * Saves the photo list: keep these existing photos in this order, then add the
 * new uploads. Files of removed photos are deleted from storage afterwards.
 * Returns the number of photos now on the listing, or null on failure.
 */
export async function updateListingPhotos(user: CurrentUser, listingId: string, keep: string[], newPaths: string[], alt: string): Promise<number | null> {
  if (!isUuid(listingId)) return null;
  const prefix = `${user.id}/${listingId}/`;
  const added = newPaths.filter((path) => path.startsWith(prefix) && /^[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\.(jpg|png|webp)$/i.test(path));
  const kept = keep.filter(isUuid);
  const supabase = await createSupabaseServerClient();

  const { data: before } = await supabase.from("listing_images").select("id, storage_path").eq("listing_id", listingId);
  const removed = ((before ?? []) as Row[])
    .filter((image) => !kept.includes(String(image.id)) && typeof image.storage_path === "string")
    .map((image) => String(image.storage_path))
    .filter((path) => path.startsWith(prefix));

  const { data, error } = await supabase.rpc("update_listing_photos", {
    p_listing_id: listingId,
    p_keep: kept,
    p_new: added.map((path) => ({ path, url: supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl })),
    p_alt: alt.slice(0, 200),
  });
  if (error) {
    console.error("update_listing_photos failed:", error.code, error.message);
    return null;
  }
  if (removed.length > 0) {
    const { error: removeError } = await supabase.storage.from("listing-images").remove(removed);
    if (removeError) console.error("removing old photo files failed:", removeError.message);
  }
  return Number(data);
}
