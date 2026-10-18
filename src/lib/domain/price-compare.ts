import type { ListingDetail, PriceGuideRow } from "@/lib/data/types";

/**
 * How a listing's asking price compares with the average for its area.
 *
 * Only offered when the average rests on enough listings, and always shown as
 * an estimate. Falls back to the city when the area itself has too few.
 */

export const COMPARE_MIN_SAMPLE = 3;
/** Within this many percent either way counts as "about average". */
export const ABOUT_AVERAGE_PERCENT = 5;

export interface PriceComparison {
  kind: "sale" | "rent";
  /** Positive: above the average. Rounded to a whole percent. */
  percent: number;
  average: number;
  sample: number;
  placeSlug: string;
  placeNameBn: string;
  /** For rent: the bedroom band compared against ("১–২", "৩", "৪+"). */
  band: "small" | "three" | "large" | null;
}

function rentBand(bedrooms: number): "small" | "three" | "large" {
  return bedrooms <= 2 ? "small" : bedrooms === 3 ? "three" : "large";
}

function fromRow(listing: ListingDetail, row: PriceGuideRow): PriceComparison | null {
  if (listing.status !== "active" && listing.status !== "stale") return null;

  if (listing.category === "residential" && listing.purpose === "sale" && listing.sizeSqft && listing.sizeSqft > 0) {
    if (row.salePerSqft === null || row.saleCount < COMPARE_MIN_SAMPLE) return null;
    const own = listing.price / listing.sizeSqft;
    return {
      kind: "sale",
      percent: Math.round(((own - row.salePerSqft) / row.salePerSqft) * 100),
      average: row.salePerSqft,
      sample: row.saleCount,
      placeSlug: row.slug,
      placeNameBn: row.nameBn,
      band: null,
    };
  }

  if (listing.category === "residential" && listing.purpose === "rent" && listing.propertyType !== "room" && listing.bedrooms !== null) {
    const band = rentBand(listing.bedrooms);
    const average = band === "small" ? row.rentSmall : band === "three" ? row.rentThree : row.rentLarge;
    const sample = band === "small" ? row.rentSmallCount : band === "three" ? row.rentThreeCount : row.rentLargeCount;
    if (average === null || sample < COMPARE_MIN_SAMPLE) return null;
    return {
      kind: "rent",
      percent: Math.round(((listing.price - average) / average) * 100),
      average,
      sample,
      placeSlug: row.slug,
      placeNameBn: row.nameBn,
      band,
    };
  }

  return null;
}

export function compareWithArea(listing: ListingDetail, rows: PriceGuideRow[]): PriceComparison | null {
  const own = rows.find((row) => row.slug === listing.locationSlug);
  const result = own ? fromRow(listing, own) : null;
  if (result) return result;
  const parent = listing.parentLocationSlug ? rows.find((row) => row.slug === listing.parentLocationSlug) : undefined;
  return parent ? fromRow(listing, parent) : null;
}
