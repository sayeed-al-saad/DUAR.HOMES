import type { SearchMode, SearchSort } from "@/lib/domain/urls";
import type {
  Furnishing,
  ListerType,
  ListingOrigin,
  ListingStatus,
  LocationType,
  PropertyCategory,
  PropertyType,
  Purpose,
} from "@/lib/domain/types";

/**
 * What the UI knows about data. Pages and components depend on these shapes
 * and on the `Repository` interface, never on Supabase directly, so the
 * backing store can be swapped (demo data today, Supabase in production,
 * a search index later).
 */

/** Everything a property card needs. One row per listing. */
export interface ListingCard {
  id: string;
  slug: string;
  /** The physical property. Several listings (from different sites) can share one. */
  propertyId: string;
  /**
   * True for the one listing that stands for its property in search, counts
   * and averages ("one property, one card"). Always true for listings that are
   * not active. See listing-math.ts assignGroups() and the listing_groups view.
   */
  isGroupLead: boolean;
  /** How many other active listings describe the same property for the same purpose. */
  alsoListedCount: number;
  /** Lowest asking price across those listings and this one; null when there are none. */
  groupMinPrice: number | null;
  title: string;
  purpose: Purpose;
  origin: ListingOrigin;
  listerType: ListerType;
  status: ListingStatus;

  /** BDT. Total price for sale, monthly rent for rent. */
  price: number;
  previousPrice: number | null;
  priceChangedAt: string | null;
  priceDropPercent: number | null;

  propertyType: PropertyType;
  category: PropertyCategory;
  sizeSqft: number | null;
  landSizeKatha: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  pricePerSqft: number | null;

  locationSlug: string;
  locationNameBn: string;
  /** City or district the area belongs to, when that adds information. */
  parentLocationNameBn: string | null;

  sourceName: string;
  /** Original listing on the source site. Always set for external listings. */
  sourceUrl: string | null;

  /** Only set when we hold the right to show the image. */
  imageUrl: string | null;
  imageAlt: string | null;

  isVerified: boolean;
  firstSeenAt: string;
  lastCheckedAt: string;
  viewCount: number;
  isDemo: boolean;
}

export interface LocationSummary {
  id: string;
  slug: string;
  type: LocationType;
  nameBn: string;
  nameEn: string;
  parentNameBn: string | null;
  /** Slug of the place this one sits in. Filled for single lookups and the full list; may be missing from search suggestions. */
  parentSlug?: string | null;
}

/**
 * A link to another site's own public listing page. It is only a link:
 * nothing from that page is stored or shown here.
 */
export interface ExternalSearchLink {
  id: string;
  url: string;
  /** null when the page mixes sale and rent. */
  purpose: Purpose | null;
  /** null when the page mixes property kinds. */
  category: PropertyCategory | null;
  /** null when the page covers all of Bangladesh. */
  locationSlug: string | null;
  locationNameBn: string | null;
  sourceSlug: string;
  sourceName: string;
  sourceWebsite: string | null;
  lastCheckedAt: string;
}

/** Listing counts and asking-price averages for one place, children included. */
export interface AreaStats {
  slug: string;
  nameBn: string;
  nameEn: string;
  activeListingCount: number;
  /** Mean asking price per sq ft across residential sale listings. */
  avgSalePricePerSqft: number | null;
  saleSampleSize: number;
  /** Mean asking monthly rent across residential rent listings (rooms excluded). */
  avgMonthlyRent: number | null;
  rentSampleSize: number;
}

/** What the search page asks for. Built from the URL by src/lib/domain/listing-query.ts. */
export interface ListingQuery {
  purpose?: Purpose;
  category?: PropertyCategory;
  propertyType?: PropertyType;
  /** One of our location slugs. Matches that place and every place inside it. */
  locationSlug?: string;
  minBedrooms?: number;
  minPrice?: number;
  maxPrice?: number;
  ownerOnly?: boolean;
  sort: SearchSort;
  /** 1-based. */
  page: number;
  pageSize: number;
}

/** One page of search results. Only active listings are ever returned. */
export interface SearchResult {
  listings: ListingCard[];
  /** Matching listings across all pages. */
  total: number;
  page: number;
  pageSize: number;
  containsDemoData: boolean;
  generatedAt: string;
}

export interface PriceHistoryPoint {
  price: number;
  recordedAt: string;
}

/** Everything the listing page shows. Public facts only: no address, no contact details. */
export interface ListingDetail extends ListingCard {
  /** Only ever set for listings made on this site. External descriptions are never stored. */
  description: string | null;
  furnishing: Furnishing | null;
  balconies: number | null;
  floorNumber: number | null;
  totalFloors: number | null;
  parkingSpaces: number | null;
  amenities: Array<{ slug: string; nameBn: string }>;
  locationType: LocationType;
  parentLocationSlug: string | null;
  publishedAt: string | null;
  priceHistory: PriceHistoryPoint[];
  /** When the data was read. Freshness labels are computed against this, so cached pages stay consistent. */
  generatedAt: string;
}

/** Active listings per place and kind of search, counting every place inside it. */
export interface AreaModeCount {
  slug: string;
  mode: SearchMode;
  count: number;
  containsDemoData: boolean;
}

/**
 * Asking-price averages for one place, children included. Every figure comes
 * with the number of listings it rests on. Estimates, not valuations.
 */
export interface PriceGuideRow {
  slug: string;
  type: LocationType;
  nameBn: string;
  nameEn: string;
  parentSlug: string | null;
  parentNameBn: string | null;
  /** Residential sale, per square foot. */
  salePerSqft: number | null;
  saleCount: number;
  /** Monthly rent, residential, rooms excluded, by bedrooms: 1–2, 3, 4 or more. */
  rentSmall: number | null;
  rentSmallCount: number;
  rentThree: number | null;
  rentThreeCount: number;
  rentLarge: number | null;
  rentLargeCount: number;
  /** Land for sale, per katha. */
  landPerKatha: number | null;
  landCount: number;
  containsDemoData: boolean;
}

/**
 * One place on the search map: how many matching properties it has and the
 * lowest asking price among them. The point is the place's centre, never a
 * property's real position.
 */
export interface MapArea {
  slug: string;
  nameBn: string;
  parentNameBn: string | null;
  latitude: number;
  longitude: number;
  count: number;
  minPrice: number;
  containsDemoData: boolean;
}

export interface MapResult {
  areas: MapArea[];
  /** Matching properties across all places. */
  total: number;
  /** False when there were more matches than the map reads (MAP_MAX_LISTINGS). */
  complete: boolean;
}

/** A listing page worth listing in the sitemap. */
export interface IndexableListing {
  slug: string;
  locationSlug: string;
  updatedAt: string;
}

export interface HomePageData {
  popular: ListingCard[];
  newest: ListingCard[];
  priceDrops: ListingCard[];
  ownerDirect: ListingCard[];
  popularAreas: AreaStats[];
  /** True when any of the above came from demo rows. */
  containsDemoData: boolean;
  generatedAt: string;
}

export interface Repository {
  readonly kind: "demo" | "supabase";
  getHomePageData(): Promise<HomePageData>;
  searchLocations(query: string, limit?: number): Promise<LocationSummary[]>;
  getPopularLocations(limit?: number): Promise<LocationSummary[]>;
  getLocationBySlug(slug: string): Promise<LocationSummary | null>;
  /** Amenities a lister can tick, in display order. */
  getAmenities(): Promise<Array<{ slug: string; nameBn: string }>>;
  /** Every place, in display order. */
  getAllLocations(): Promise<LocationSummary[]>;
  getExternalSearchLinks(): Promise<ExternalSearchLink[]>;
  searchListings(query: ListingQuery): Promise<SearchResult>;
  /** Any listing a visitor may see (active, stale, sold or rented), or null. */
  getListingBySlug(slug: string): Promise<ListingDetail | null>;
  /** Active listings of the same kind in the same place or the city around it. */
  getSimilarListings(listing: ListingDetail, limit: number): Promise<ListingCard[]>;
  /** The other active listings of the same property and purpose, best first. */
  getOtherListings(listing: ListingDetail): Promise<ListingCard[]>;
  /** Every place with matching properties, for the search map. Paging and sort are ignored. */
  getMapAreas(query: ListingQuery): Promise<MapResult>;
  getAreaModeCounts(): Promise<AreaModeCount[]>;
  /** Every place with at least one active listing. */
  getPriceGuide(): Promise<PriceGuideRow[]>;
  /** Our own listings, active and real: the only listing pages search engines are invited to index. */
  getIndexableListings(limit: number): Promise<IndexableListing[]>;
}

export const HOME_RAIL_SIZE = 8;
export const HOME_PRICE_DROP_SIZE = 6;
/** Averages built from fewer listings than this are not shown. */
export const MIN_SAMPLE_FOR_AVERAGE = 2;
/** An area page is offered to search engines only once it has at least this many real, active listings. */
export const MIN_LISTINGS_TO_INDEX = 5;
export const SEARCH_PAGE_SIZE = 24;
export const SIMILAR_LISTINGS = 4;
/** The map reads at most this many matching listings; past it, it says the map is incomplete. */
export const MAP_MAX_LISTINGS = 5000;
