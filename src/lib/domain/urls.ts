import type { PropertyCategory, PropertyType, Purpose } from "./types";

/** The four entry points on the home page search panel and main menu. */
export const SEARCH_MODES = ["buy", "rent", "land", "commercial"] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

/** How search results can be ordered. "newest" is the default. */
export const SEARCH_SORTS = ["newest", "price_asc", "price_desc", "popular", "price_drop"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export interface SearchFilters {
  mode?: SearchMode;
  purpose?: Purpose;
  category?: PropertyCategory;
  location?: string;
  propertyType?: PropertyType;
  bedrooms?: number;
  minPrice?: number;
  maxPrice?: number;
  sort?: SearchSort;
  ownerOnly?: boolean;
  /** 1-based results page. */
  page?: number;
  /** Show the results on a map instead of as a list. */
  view?: SearchView;
}

export const SEARCH_VIEWS = ["list", "map"] as const;
export type SearchView = (typeof SEARCH_VIEWS)[number];

/**
 * /property/{area}/{listing-slug}
 * The area segment is there for readers and search engines; the listing slug
 * alone identifies the listing.
 */
export function listingPath(listing: { locationSlug: string; slug: string }): string {
  return `/property/${listing.locationSlug}/${listing.slug}`;
}

/** Builds a /search URL, leaving out anything that is not set. */
export function searchPath(filters: SearchFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.mode) params.set("mode", filters.mode);
  if (filters.purpose) params.set("purpose", filters.purpose);
  if (filters.category) params.set("category", filters.category);
  if (filters.location) params.set("location", filters.location);
  if (filters.propertyType) params.set("type", filters.propertyType);
  if (filters.bedrooms) params.set("beds", String(filters.bedrooms));
  if (filters.minPrice) params.set("min_price", String(filters.minPrice));
  if (filters.maxPrice) params.set("max_price", String(filters.maxPrice));
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.ownerOnly) params.set("owner", "1");
  if (filters.view === "map") params.set("view", "map");
  else if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}

/**
 * Area pages: /buy/uttara, /rent/dhanmondi, /land/purbachal, /commercial/motijheel.
 * One page per kind of search and place. These are the pages meant for search engines.
 */
export function areaPath(mode: SearchMode, locationSlug: string): string {
  return `/${mode}/${locationSlug}`;
}

export const PRICE_GUIDE_PATH = "/prices";
