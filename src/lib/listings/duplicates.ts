import "server-only";
import { PROPERTY_TYPES, PURPOSES, type PropertyType, type Purpose } from "@/lib/domain/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Staff work on duplicate listings, as the signed-in user. The database
 * functions check the role again; nothing here grants anything.
 */

type Row = Record<string, unknown>;

export interface DuplicateSide {
  id: string;
  slug: string;
  title: string;
  origin: "first_party" | "external";
  sourceName: string;
  sourceUrl: string | null;
  price: number;
  sizeSqft: number | null;
  landSizeKatha: number | null;
  firstSeenAt: string;
}

export interface DuplicatePair {
  id: string;
  confidence: number;
  status: "pending" | "review_later";
  signals: {
    sizeDiffPercent?: number;
    kathaDiffPercent?: number;
    priceDiffPercent?: number;
    sameFloor?: boolean;
    sameSource?: boolean;
  };
  purpose: Purpose;
  propertyType: PropertyType;
  bedrooms: number | null;
  locationSlug: string;
  locationNameBn: string;
  parentLocationNameBn: string | null;
  isDemo: boolean;
  a: DuplicateSide;
  b: DuplicateSide;
}

const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));

function side(row: Row, prefix: "a" | "b"): DuplicateSide {
  const get = (key: string) => row[`${prefix}_${key}`];
  return {
    id: String(get("id")),
    slug: String(get("slug")),
    title: String(get("title")),
    origin: get("origin") === "first_party" ? "first_party" : "external",
    sourceName: String(get("source_name")),
    sourceUrl: typeof get("source_url") === "string" && String(get("source_url")).startsWith("https://") ? String(get("source_url")) : null,
    price: Number(get("price")),
    sizeSqft: num(get("size_sqft")),
    landSizeKatha: num(get("land_size_katha")),
    firstSeenAt: String(get("first_seen_at")),
  };
}

export async function getDuplicatePairs(): Promise<DuplicatePair[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("duplicate_review")
    .select("*")
    .in("status", ["pending", "review_later"])
    .order("status")
    .order("confidence", { ascending: false })
    .order("created_at")
    .limit(100);
  if (error) throw new Error(`Could not load the duplicate queue: ${error.message}`);
  return (data as Row[]).map((row) => {
    const signals = (row.signals ?? {}) as Row;
    return {
      id: String(row.id),
      confidence: Number(row.confidence),
      status: row.status === "review_later" ? "review_later" : "pending",
      signals: {
        sizeDiffPercent: num(signals.size_diff_percent) ?? undefined,
        kathaDiffPercent: num(signals.katha_diff_percent) ?? undefined,
        priceDiffPercent: num(signals.price_diff_percent) ?? undefined,
        sameFloor: signals.same_floor === true,
        sameSource: signals.same_source === true,
      },
      purpose: PURPOSES.includes(row.purpose as Purpose) ? (row.purpose as Purpose) : "sale",
      propertyType: PROPERTY_TYPES.includes(row.property_type as PropertyType) ? (row.property_type as PropertyType) : "apartment",
      bedrooms: num(row.bedrooms),
      locationSlug: String(row.location_slug),
      locationNameBn: String(row.location_name_bn),
      parentLocationNameBn: typeof row.parent_location_name_bn === "string" ? row.parent_location_name_bn : null,
      isDemo: row.is_demo === true,
      a: side(row, "a"),
      b: side(row, "b"),
    };
  });
}

/** Looks for new likely pairs. Returns how many were added, or null on failure. */
export async function findDuplicateCandidates(): Promise<number | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("find_duplicate_candidates");
  if (error) {
    console.error("duplicate search failed:", error.code, error.message);
    return null;
  }
  return Number(data ?? 0);
}

export const DUPLICATE_DECISIONS = ["merged", "rejected", "review_later"] as const;
export type DuplicateDecision = (typeof DUPLICATE_DECISIONS)[number];

export async function resolveDuplicate(pairId: string, decision: DuplicateDecision): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("resolve_duplicate", { pair_id: pairId, decision });
  if (error) console.error("duplicate decision failed:", error.code, error.message);
  return !error;
}
