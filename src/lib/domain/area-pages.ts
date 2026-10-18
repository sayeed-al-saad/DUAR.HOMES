import { MIN_LISTINGS_TO_INDEX, type AreaModeCount, type LocationSummary, type PriceGuideRow } from "@/lib/data/types";
import { inLocationBn } from "@/lib/format/bn";
import { bn } from "@/lib/i18n/bn";
import type { SearchMode } from "./urls";

/**
 * Rules for area pages (/rent/uttara and so on): what they are called, and
 * whether search engines are invited to index them.
 */

/** "উত্তরায় ফ্ল্যাট ও বাড়ি ভাড়া" */
export function areaHeading(mode: SearchMode, place: Pick<LocationSummary, "nameBn">): string {
  return `${inLocationBn(place.nameBn)} ${bn.modeTitles[mode]}`;
}

/** "উত্তরায় ফ্ল্যাট ও বাড়ি ভাড়া | Flats for rent in Uttara" */
export function areaTitle(mode: SearchMode, place: Pick<LocationSummary, "nameBn" | "nameEn">): string {
  return `${areaHeading(mode, place)} | ${bn.modeTitlesEn[mode](place.nameEn)}`;
}

export function countFor(counts: AreaModeCount[], slug: string, mode: SearchMode): AreaModeCount | undefined {
  return counts.find((entry) => entry.slug === slug && entry.mode === mode);
}

/**
 * Only pages with enough real listings are offered to search engines. A page
 * with two listings, or only demo listings, is thin content: it still works
 * for visitors but carries "noindex" and stays out of the sitemap.
 */
export function isIndexable(count: AreaModeCount | undefined): boolean {
  return Boolean(count && count.count >= MIN_LISTINGS_TO_INDEX && !count.containsDemoData);
}

/** Place types that get area pages. Divisions and districts are too broad to be useful pages. */
export const AREA_PAGE_TYPES = ["city", "upazila", "thana", "area"] as const;

export function hasAreaPage(place: Pick<LocationSummary, "type">): boolean {
  return (AREA_PAGE_TYPES as readonly string[]).includes(place.type);
}

export function guideFor(rows: PriceGuideRow[], slug: string): PriceGuideRow | undefined {
  return rows.find((row) => row.slug === slug);
}
