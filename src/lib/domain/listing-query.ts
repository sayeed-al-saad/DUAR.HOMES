import type { ListingQuery } from "@/lib/data/types";
import { SEARCH_PAGE_SIZE } from "@/lib/data/types";
import { MODE_CONFIG } from "./search-options";
import { categoryOf, type PropertyCategory, type PropertyType, type Purpose } from "./types";
import type { SearchFilters, SearchMode } from "./urls";

/**
 * Turns what the visitor chose (the URL) into the query the data layer runs.
 * Shared by the search page and the area pages, so both mean the same thing
 * by "rent in Uttara".
 */

/** What a kind of search fixes. Land means land for sale; commercial covers sale and rent. */
export function modeFilter(mode: SearchMode): { purpose?: Purpose; category: PropertyCategory } {
  const config = MODE_CONFIG[mode];
  return config.purpose ? { purpose: config.purpose, category: config.category } : { category: config.category };
}

/** Which kind of search a listing belongs to, or null (land offered for rent). Mirrors the area_listing_counts view. */
export function modeOf(listing: { purpose: Purpose; propertyType: PropertyType }): SearchMode | null {
  const category = categoryOf(listing.propertyType);
  if (category === "residential") return listing.purpose === "sale" ? "buy" : "rent";
  if (category === "land") return listing.purpose === "sale" ? "land" : null;
  return "commercial";
}

export function toListingQuery(filters: SearchFilters, locationSlug: string | null = filters.location ?? null): ListingQuery {
  const fromMode: { purpose?: Purpose; category?: PropertyCategory } = filters.mode ? modeFilter(filters.mode) : {};
  // A chosen property type implies its category; an explicit category or purpose refines the mode.
  const category = filters.propertyType ? categoryOf(filters.propertyType) : (filters.category ?? fromMode.category);
  const purpose = filters.purpose ?? fromMode.purpose;
  const showsBedrooms = category === undefined || category === "residential";

  return {
    purpose,
    category,
    propertyType: filters.propertyType,
    locationSlug: locationSlug ?? undefined,
    minBedrooms: showsBedrooms ? filters.bedrooms : undefined,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    ownerOnly: filters.ownerOnly,
    sort: filters.sort ?? "newest",
    page: filters.page ?? 1,
    pageSize: SEARCH_PAGE_SIZE,
  };
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
