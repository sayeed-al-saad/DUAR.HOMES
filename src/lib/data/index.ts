import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { dataSourceKind } from "@/lib/env";
import { demoRepository } from "./demo-repository";
import { supabaseRepository } from "./supabase-repository";
import type {
  AreaModeCount,
  ExternalSearchLink,
  HomePageData,
  IndexableListing,
  ListingCard,
  ListingDetail,
  ListingQuery,
  LocationSummary,
  MapResult,
  PriceGuideRow,
  Repository,
  SearchResult,
} from "./types";

export type {
  AreaModeCount,
  AreaStats,
  ExternalSearchLink,
  HomePageData,
  ListingCard,
  ListingDetail,
  ListingQuery,
  LocationSummary,
  MapArea,
  MapResult,
  PriceGuideRow,
  SearchResult,
} from "./types";

/**
 * The one place pages get data from.
 *
 * Each function is cached on the server, so the home page is built once and
 * reused for every visitor until its lifetime runs out. To refresh sooner
 * after a change, call `revalidateTag` with the matching tag.
 */

export const CACHE_TAGS = {
  listings: "listings",
  locations: "locations",
  externalLinks: "external-links",
} as const;

function repository(): Repository {
  return dataSourceKind() === "supabase" ? supabaseRepository : demoRepository;
}

/** True when the site is running on bundled demo data rather than a database. */
export function isDemoMode(): boolean {
  return dataSourceKind() === "demo";
}

export async function getHomePageData(): Promise<HomePageData> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.listings);
  return repository().getHomePageData();
}

export async function getPopularLocations(limit = 10): Promise<LocationSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.locations);
  return repository().getPopularLocations(limit);
}

export async function getLocationBySlug(slug: string): Promise<LocationSummary | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.locations);
  return repository().getLocationBySlug(slug);
}

/** Links out to other sites' public listing pages. They change rarely. */
export async function getExternalSearchLinks(): Promise<ExternalSearchLink[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.externalLinks);
  return repository().getExternalSearchLinks();
}

const MAX_QUERY_LENGTH = 60;

async function cachedLocationSearch(cleanQuery: string, limit: number): Promise<LocationSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.locations);
  return repository().searchLocations(cleanQuery, limit);
}

/** Autocomplete for the location box. An empty query returns the popular places. */
export async function searchLocations(query: string, limit = 8): Promise<LocationSummary[]> {
  // Normalising before the cached call keeps near-identical queries on one cache entry.
  const cleaned = query.normalize("NFC").trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH).toLowerCase();
  return cachedLocationSearch(cleaned, Math.min(Math.max(Math.trunc(limit) || 8, 1), 12));
}

/** One page of search results. Cached per distinct query. */
export async function searchListings(query: ListingQuery): Promise<SearchResult> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.listings);
  return repository().searchListings(query);
}

export async function getListingBySlug(slug: string): Promise<ListingDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.listings);
  return repository().getListingBySlug(slug);
}

export async function getSimilarListings(listing: ListingDetail, limit: number): Promise<ListingCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.listings);
  return repository().getSimilarListings(listing, limit);
}

/** The other active listings of the same property and purpose ("also listed on"). */
export async function getOtherListings(listing: ListingDetail): Promise<ListingCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.listings);
  return repository().getOtherListings(listing);
}

/** Matching properties per place, for the search map. Cached per distinct query; paging and sort are ignored. */
export async function getMapAreas(query: ListingQuery): Promise<MapResult> {
  // Page and sort do not change the map, so they are fixed to keep one cache entry per search.
  return cachedMapAreas({ ...query, page: 1, sort: "newest" });
}

async function cachedMapAreas(query: ListingQuery): Promise<MapResult> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.listings);
  return repository().getMapAreas(query);
}

export async function getAreaModeCounts(): Promise<AreaModeCount[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.listings);
  return repository().getAreaModeCounts();
}

export async function getPriceGuide(): Promise<PriceGuideRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.listings);
  return repository().getPriceGuide();
}

export async function getIndexableListings(limit = 5000): Promise<IndexableListing[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.listings);
  return repository().getIndexableListings(limit);
}

/** Every place in the database, for resolving area pages. Changes rarely. */
export async function getAllLocations(): Promise<LocationSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.locations);
  return repository().getAllLocations();
}

/** When cached listing data was last read. Shown as "হালনাগাদ" on the price guide. */
export async function getDataTimestamp(): Promise<string> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.listings);
  return new Date().toISOString();
}

export async function getAmenities(): Promise<Array<{ slug: string; nameBn: string }>> {
  "use cache";
  cacheLife("days");
  cacheTag(CACHE_TAGS.locations);
  return repository().getAmenities();
}
