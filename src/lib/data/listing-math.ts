import { modeOf } from "@/lib/domain/listing-query";
import type { LocationType } from "@/lib/domain/types";
import type { SearchMode } from "@/lib/domain/urls";
import type { AreaModeCount, ListingCard, ListingDetail, ListingQuery, MapArea, MapResult, PriceGuideRow } from "./types";

/**
 * Searching, counting and averaging over listings held in memory (demo mode).
 * Each function mirrors a database view or query in
 * supabase/migrations/20261008001100_search_and_area_views.sql and
 * supabase-repository.ts; scripts/test-db.ts checks that both give the same answers.
 */

/** A place, with the chain of places it sits in. */
export interface PlaceInfo {
  slug: string;
  type: LocationType;
  nameBn: string;
  nameEn: string;
  parentSlug: string | null;
  parentNameBn: string | null;
  /** This place and every place above it, nearest first. */
  ancestors: string[];
}

export type PlaceLookup = (slug: string) => PlaceInfo | undefined;

/** Plain comparison: matches PostgreSQL's ordering of uuids and ISO timestamps. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// One property, one card
// ---------------------------------------------------------------------------

/**
 * Order within a group of active listings for the same property and purpose.
 * Mirrors the window in the listing_groups view: our own listing first (it has
 * photos and a lister to contact), then the lowest price, then the newest.
 */
export function compareInGroup(a: ListingCard, b: ListingCard): number {
  return (
    Number(b.origin === "first_party") - Number(a.origin === "first_party") ||
    a.price - b.price ||
    compare(b.firstSeenAt, a.firstSeenAt) ||
    compare(a.id, b.id)
  );
}

const groupKey = (card: Pick<ListingCard, "propertyId" | "purpose">) => `${card.propertyId}|${card.purpose}`;

/**
 * Fills isGroupLead, alsoListedCount and groupMinPrice. Only active listings
 * are grouped; any other listing stands alone. Returns new objects.
 */
export function assignGroups(cards: ListingCard[]): ListingCard[] {
  const groups = new Map<string, ListingCard[]>();
  for (const card of cards) {
    if (card.status !== "active") continue;
    const key = groupKey(card);
    const group = groups.get(key);
    if (group) group.push(card);
    else groups.set(key, [card]);
  }
  const lead = new Map<string, string>();
  for (const [key, group] of groups) lead.set(key, [...group].sort(compareInGroup)[0].id);

  return cards.map((card) => {
    const group = card.status === "active" ? groups.get(groupKey(card))! : null;
    if (!group || group.length === 1) return { ...card, isGroupLead: true, alsoListedCount: 0, groupMinPrice: null };
    return {
      ...card,
      isGroupLead: lead.get(groupKey(card)) === card.id,
      alsoListedCount: group.length - 1,
      groupMinPrice: Math.min(...group.map((other) => other.price)),
    };
  });
}

/** The other active listings for the same property and purpose, in group order. */
export function otherListingsOf(cards: ListingCard[], listing: Pick<ListingCard, "id" | "propertyId" | "purpose">): ListingCard[] {
  return cards
    .filter(
      (card) =>
        card.status === "active" &&
        card.id !== listing.id &&
        card.propertyId === listing.propertyId &&
        card.purpose === listing.purpose,
    )
    .sort(compareInGroup);
}

function inPlace(card: ListingCard, placeSlug: string, place: PlaceLookup): boolean {
  return place(card.locationSlug)?.ancestors.includes(placeSlug) ?? false;
}

export function matchesQuery(card: ListingCard, query: ListingQuery, place: PlaceLookup): boolean {
  if (card.status !== "active" || !card.isGroupLead) return false;
  if (query.purpose && card.purpose !== query.purpose) return false;
  if (query.category && card.category !== query.category) return false;
  if (query.propertyType && card.propertyType !== query.propertyType) return false;
  if (query.locationSlug && !inPlace(card, query.locationSlug, place)) return false;
  if (query.minBedrooms && (card.bedrooms === null || card.bedrooms < query.minBedrooms)) return false;
  if (query.minPrice !== undefined && card.price < query.minPrice) return false;
  if (query.maxPrice !== undefined && card.price > query.maxPrice) return false;
  if (query.ownerOnly && !(card.origin === "first_party" && card.listerType === "owner")) return false;
  if (query.sort === "price_drop" && !(card.priceDropPercent !== null && card.priceDropPercent > 0)) return false;
  return true;
}

/** Same ORDER BY as supabase-repository.ts, including the final tie-break on id. */
export function sortCards(cards: ListingCard[], sort: ListingQuery["sort"]): ListingCard[] {
  const byId = (a: ListingCard, b: ListingCard) => compare(a.id, b.id);
  const sorted = [...cards];
  switch (sort) {
    case "price_asc":
      return sorted.sort((a, b) => a.price - b.price || byId(a, b));
    case "price_desc":
      return sorted.sort((a, b) => b.price - a.price || byId(a, b));
    case "popular":
      return sorted.sort((a, b) => b.viewCount - a.viewCount || compare(b.firstSeenAt, a.firstSeenAt) || byId(a, b));
    case "price_drop":
      return sorted.sort(
        (a, b) =>
          compare(b.priceChangedAt ?? "", a.priceChangedAt ?? "") ||
          (b.priceDropPercent ?? 0) - (a.priceDropPercent ?? 0) ||
          byId(a, b),
      );
    case "newest":
    default:
      return sorted.sort((a, b) => compare(b.firstSeenAt, a.firstSeenAt) || byId(a, b));
  }
}

export function searchCards(cards: ListingCard[], query: ListingQuery, place: PlaceLookup) {
  const matching = sortCards(
    cards.filter((card) => matchesQuery(card, query, place)),
    query.sort,
  );
  const start = (query.page - 1) * query.pageSize;
  return { listings: matching.slice(start, start + query.pageSize), total: matching.length };
}

/** Where to look for similar listings: the city around an area, or the place itself. */
export function similarPlace(listing: Pick<ListingDetail, "locationSlug" | "locationType" | "parentLocationSlug">): string {
  return listing.locationType === "area" && listing.parentLocationSlug ? listing.parentLocationSlug : listing.locationSlug;
}

/** How many candidates are read before putting the same-area ones first. */
export const SIMILAR_CANDIDATES = 30;

/** Same kind, same place first, then newest. */
export function pickSimilar(candidates: ListingCard[], listing: ListingDetail, limit: number): ListingCard[] {
  return candidates
    .filter((card) => card.id !== listing.id && card.propertyId !== listing.propertyId)
    .map((card, index) => ({ card, index, same: card.locationSlug === listing.locationSlug ? 0 : 1 }))
    .sort((a, b) => a.same - b.same || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.card);
}

export function similarCandidates(cards: ListingCard[], listing: ListingDetail, place: PlaceLookup): ListingCard[] {
  const query: ListingQuery = {
    purpose: listing.purpose,
    category: listing.category,
    locationSlug: similarPlace(listing),
    sort: "newest",
    page: 1,
    pageSize: SIMILAR_CANDIDATES,
  };
  return sortCards(
    cards.filter((card) => card.propertyId !== listing.propertyId && matchesQuery(card, query, place)),
    "newest",
  ).slice(0, SIMILAR_CANDIDATES);
}

/** Mirrors the area_listing_counts view. */
export function computeAreaModeCounts(cards: ListingCard[], place: PlaceLookup): AreaModeCount[] {
  const counts = new Map<string, AreaModeCount>();
  for (const card of cards) {
    if (card.status !== "active" || !card.isGroupLead) continue;
    const mode = modeOf(card);
    if (!mode) continue;
    for (const slug of place(card.locationSlug)?.ancestors ?? []) {
      const key = `${slug}|${mode}`;
      const entry = counts.get(key) ?? { slug, mode: mode as SearchMode, count: 0, containsDemoData: false };
      entry.count += 1;
      entry.containsDemoData ||= card.isDemo;
      counts.set(key, entry);
    }
  }
  return [...counts.values()].sort((a, b) => compare(a.slug, b.slug) || compare(a.mode, b.mode));
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/** Mirrors the location_price_guide view. */
export function computePriceGuide(cards: ListingCard[], place: PlaceLookup): PriceGuideRow[] {
  interface Bucket {
    sale: number[];
    small: number[];
    three: number[];
    large: number[];
    land: number[];
    count: number;
    demo: boolean;
  }
  const buckets = new Map<string, Bucket>();

  for (const card of cards) {
    if (card.status !== "active" || !card.isGroupLead) continue;
    for (const slug of place(card.locationSlug)?.ancestors ?? []) {
      const bucket = buckets.get(slug) ?? { sale: [], small: [], three: [], large: [], land: [], count: 0, demo: false };
      bucket.count += 1;
      bucket.demo ||= card.isDemo;
      if (card.category === "residential" && card.purpose === "sale" && card.sizeSqft && card.sizeSqft > 0) {
        bucket.sale.push(card.price / card.sizeSqft);
      }
      if (card.category === "residential" && card.purpose === "rent" && card.propertyType !== "room" && card.bedrooms !== null) {
        if (card.bedrooms <= 2) bucket.small.push(card.price);
        else if (card.bedrooms === 3) bucket.three.push(card.price);
        else bucket.large.push(card.price);
      }
      if (card.category === "land" && card.purpose === "sale" && card.landSizeKatha && card.landSizeKatha > 0) {
        bucket.land.push(card.price / card.landSizeKatha);
      }
      buckets.set(slug, bucket);
    }
  }

  const rows: PriceGuideRow[] = [];
  for (const [slug, bucket] of buckets) {
    const info = place(slug);
    if (!info) continue;
    rows.push({
      slug,
      type: info.type,
      nameBn: info.nameBn,
      nameEn: info.nameEn,
      parentSlug: info.parentSlug,
      parentNameBn: info.parentNameBn,
      salePerSqft: mean(bucket.sale),
      saleCount: bucket.sale.length,
      rentSmall: mean(bucket.small),
      rentSmallCount: bucket.small.length,
      rentThree: mean(bucket.three),
      rentThreeCount: bucket.three.length,
      rentLarge: mean(bucket.large),
      rentLargeCount: bucket.large.length,
      landPerKatha: mean(bucket.land),
      landCount: bucket.land.length,
      containsDemoData: bucket.demo,
    });
  }
  return rows.sort((a, b) => compare(a.slug, b.slug));
}

// ---------------------------------------------------------------------------
// Search map
// ---------------------------------------------------------------------------

export interface MapPoint {
  latitude: number;
  longitude: number;
}

/** What the map needs from one matching listing. */
export type MapRow = Pick<ListingCard, "locationSlug" | "price" | "isDemo">;

/**
 * Groups matching listings by the place they are in. Each place is drawn at
 * its own centre: the map never shows where a property really is.
 * Places without a known point are left off. Sorted by count, then name.
 */
export function computeMapAreas(
  rows: MapRow[],
  place: PlaceLookup,
  point: (slug: string) => MapPoint | undefined,
  complete: boolean,
): MapResult {
  const areas = new Map<string, MapArea>();
  for (const row of rows) {
    const existing = areas.get(row.locationSlug);
    if (existing) {
      existing.count += 1;
      existing.minPrice = Math.min(existing.minPrice, row.price);
      existing.containsDemoData ||= row.isDemo;
      continue;
    }
    const info = place(row.locationSlug);
    const at = point(row.locationSlug);
    if (!info || !at) continue;
    areas.set(row.locationSlug, {
      slug: row.locationSlug,
      nameBn: info.nameBn,
      parentNameBn: info.type === "area" ? info.parentNameBn : null,
      latitude: at.latitude,
      longitude: at.longitude,
      count: 1,
      minPrice: row.price,
      containsDemoData: row.isDemo,
    });
  }
  return {
    areas: [...areas.values()].sort((a, b) => b.count - a.count || compare(a.slug, b.slug)),
    total: rows.length,
    complete,
  };
}
