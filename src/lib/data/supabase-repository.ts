import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  LISTER_TYPES,
  LISTING_ORIGINS,
  LISTING_STATUSES,
  LOCATION_TYPES,
  PROPERTY_CATEGORIES,
  PROPERTY_TYPES,
  PURPOSES,
} from "@/lib/domain/types";
import { env } from "@/lib/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { FURNISHING_LEVELS } from "@/lib/domain/types";
import { SEARCH_MODES } from "@/lib/domain/urls";
import {
  computeMapAreas,
  pickSimilar,
  SIMILAR_CANDIDATES,
  similarPlace,
  type MapPoint,
  type PlaceInfo,
} from "./listing-math";
import {
  HOME_PRICE_DROP_SIZE,
  HOME_RAIL_SIZE,
  type AreaModeCount,
  type AreaStats,
  type ExternalSearchLink,
  type HomePageData,
  type ListingCard,
  type ListingDetail,
  type ListingQuery,
  type LocationSummary,
  MAP_MAX_LISTINGS,
  type PriceGuideRow,
  type Repository,
} from "./types";

/**
 * Reads the public site's data from Supabase through the `listing_cards` and
 * `location_listing_stats` views, as the anonymous role. Row-level security
 * decides what comes back; this file never uses the service-role key.
 */

const CARD_COLUMNS = [
  "id", "slug", "property_id", "is_group_lead", "also_listed_count", "group_min_price", "title", "purpose", "origin", "lister_type", "status",
  "price", "previous_price", "price_changed_at", "price_drop_percent",
  "property_type", "category", "size_sqft", "land_size_katha", "bedrooms", "bathrooms", "price_per_sqft",
  "location_slug", "location_type", "location_name_bn", "parent_location_name_bn",
  "source_name", "source_url", "image_url", "image_alt",
  "is_verified", "first_seen_at", "last_checked_at", "view_count", "is_demo",
].join(", ");

const DETAIL_COLUMNS = [
  CARD_COLUMNS, "location_type", "parent_location_slug", "published_at", "description",
  "furnishing", "balconies", "floor_number", "total_floors", "parking_spaces", "amenities", "price_history",
].join(", ");

const GUIDE_COLUMNS =
  "slug, type, name_bn, name_en, parent_slug, parent_name_bn, sale_per_sqft, sale_count, rent_small, rent_small_count, " +
  "rent_three, rent_three_count, rent_large, rent_large_count, land_per_katha, land_count, contains_demo_data";

const AREA_COLUMNS =
  "slug, name_bn, name_en, active_listing_count, avg_sale_price_per_sqft, sale_sample_size, avg_monthly_rent, rent_sample_size, contains_demo_data";

const LOCATION_COLUMNS = "id, slug, type, name_bn, name_en, parent_name_bn, parent_slug";

const LINK_COLUMNS =
  "id, url, purpose, category, location_slug, location_name_bn, source_slug, source_name, source_website, last_checked_at";

type Row = Record<string, unknown>;

function fail(what: string, error: PostgrestError): never {
  throw new Error(
    `Could not load ${what} from Supabase: ${error.message}. ` +
      "Check that every file in supabase/migrations has been applied to this project.",
  );
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Narrows a database value to one of the known enum members, with a safe fallback. */
function oneOf<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * Only images from our own storage bucket or the bundled demo pictures are
 * shown. A row pointing anywhere else is ignored rather than trusted.
 */
/** Only files from our own video bucket are ever played. */
function safeVideo(row: Row | null): ListingDetail["video"] {
  const prefix = `${env.supabaseUrl}/storage/v1/object/public/listing-videos/`;
  const ok = (value: unknown) => (env.supabaseUrl && typeof value === "string" && value.startsWith(prefix) ? value : null);
  const url = ok(row?.url);
  return url ? { url, posterUrl: ok(row?.poster_url) } : null;
}

function safeImageUrl(value: unknown): string | null {
  const url = stringOrNull(value);
  if (!url) return null;
  if (url.startsWith("/demo/")) return url;
  return env.supabaseUrl && url.startsWith(`${env.supabaseUrl}/storage/v1/object/public/listing-images/`) ? url : null;
}

function toCard(row: Row): ListingCard {
  return {
    id: String(row.id),
    slug: String(row.slug),
    propertyId: String(row.property_id),
    isGroupLead: row.is_group_lead !== false,
    alsoListedCount: Number(row.also_listed_count ?? 0),
    groupMinPrice: numberOrNull(row.group_min_price),
    title: String(row.title),
    purpose: oneOf(PURPOSES, row.purpose, "sale"),
    origin: oneOf(LISTING_ORIGINS, row.origin, "external"),
    listerType: oneOf(LISTER_TYPES, row.lister_type, "unknown"),
    status: oneOf(LISTING_STATUSES, row.status, "active"),
    price: Number(row.price),
    previousPrice: numberOrNull(row.previous_price),
    priceChangedAt: stringOrNull(row.price_changed_at),
    priceDropPercent: numberOrNull(row.price_drop_percent),
    propertyType: oneOf(PROPERTY_TYPES, row.property_type, "apartment"),
    category: oneOf(PROPERTY_CATEGORIES, row.category, "residential"),
    sizeSqft: numberOrNull(row.size_sqft),
    landSizeKatha: numberOrNull(row.land_size_katha),
    bedrooms: numberOrNull(row.bedrooms),
    bathrooms: numberOrNull(row.bathrooms),
    pricePerSqft: numberOrNull(row.price_per_sqft),
    locationSlug: String(row.location_slug),
    locationNameBn: String(row.location_name_bn),
    parentLocationNameBn: row.location_type === "area" ? stringOrNull(row.parent_location_name_bn) : null,
    sourceName: String(row.source_name),
    sourceUrl: stringOrNull(row.source_url),
    imageUrl: safeImageUrl(row.image_url),
    imageAlt: stringOrNull(row.image_alt),
    isVerified: row.is_verified === true,
    firstSeenAt: String(row.first_seen_at),
    lastCheckedAt: String(row.last_checked_at),
    viewCount: Number(row.view_count ?? 0),
    isDemo: row.is_demo === true,
  };
}

function toDetail(row: Row): ListingDetail {
  const amenities = Array.isArray(row.amenities) ? (row.amenities as Row[]) : [];
  const history = Array.isArray(row.price_history) ? (row.price_history as Row[]) : [];
  return {
    ...toCard(row),
    description: stringOrNull(row.description),
    furnishing: row.furnishing === null ? null : oneOf(FURNISHING_LEVELS, row.furnishing, "unfurnished"),
    balconies: numberOrNull(row.balconies),
    floorNumber: numberOrNull(row.floor_number),
    totalFloors: numberOrNull(row.total_floors),
    parkingSpaces: numberOrNull(row.parking_spaces),
    amenities: amenities.map((item) => ({ slug: String(item.slug), nameBn: String(item.name_bn) })),
    locationType: oneOf(LOCATION_TYPES, row.location_type, "area"),
    parentLocationSlug: stringOrNull(row.parent_location_slug),
    publishedAt: stringOrNull(row.published_at),
    priceHistory: history.map((point) => ({ price: Number(point.price), recordedAt: String(point.recorded_at) })),
    video: null,
    generatedAt: new Date().toISOString(),
  };
}

function toGuideRow(row: Row): PriceGuideRow {
  const count = (value: unknown) => Number(value ?? 0);
  return {
    slug: String(row.slug),
    type: oneOf(LOCATION_TYPES, row.type, "area"),
    nameBn: String(row.name_bn),
    nameEn: String(row.name_en),
    parentSlug: stringOrNull(row.parent_slug),
    parentNameBn: stringOrNull(row.parent_name_bn),
    salePerSqft: numberOrNull(row.sale_per_sqft),
    saleCount: count(row.sale_count),
    rentSmall: numberOrNull(row.rent_small),
    rentSmallCount: count(row.rent_small_count),
    rentThree: numberOrNull(row.rent_three),
    rentThreeCount: count(row.rent_three_count),
    rentLarge: numberOrNull(row.rent_large),
    rentLargeCount: count(row.rent_large_count),
    landPerKatha: numberOrNull(row.land_per_katha),
    landCount: count(row.land_count),
    containsDemoData: row.contains_demo_data === true,
  };
}

function toAreaStats(row: Row): AreaStats {
  return {
    slug: String(row.slug),
    nameBn: String(row.name_bn),
    nameEn: String(row.name_en),
    activeListingCount: Number(row.active_listing_count ?? 0),
    avgSalePricePerSqft: numberOrNull(row.avg_sale_price_per_sqft),
    saleSampleSize: Number(row.sale_sample_size ?? 0),
    avgMonthlyRent: numberOrNull(row.avg_monthly_rent),
    rentSampleSize: Number(row.rent_sample_size ?? 0),
  };
}

function toLocationSummary(row: Row): LocationSummary {
  return {
    id: String(row.id),
    slug: String(row.slug),
    type: oneOf(LOCATION_TYPES, row.type, "area"),
    nameBn: String(row.name_bn),
    nameEn: String(row.name_en),
    parentNameBn: stringOrNull(row.parent_name_bn),
    parentSlug: stringOrNull(row.parent_slug),
  };
}

function toExternalLink(row: Row): ExternalSearchLink {
  return {
    id: String(row.id),
    url: String(row.url),
    purpose: row.purpose === null ? null : oneOf(PURPOSES, row.purpose, "sale"),
    category: row.category === null ? null : oneOf(PROPERTY_CATEGORIES, row.category, "residential"),
    locationSlug: stringOrNull(row.location_slug),
    locationNameBn: stringOrNull(row.location_name_bn),
    sourceSlug: String(row.source_slug),
    sourceName: String(row.source_name),
    sourceWebsite: stringOrNull(row.source_website),
    lastCheckedAt: String(row.last_checked_at),
  };
}

/** Applies the search filters. Keep in step with matchesQuery() in listing-math.ts. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyQuery<T extends { eq: any; gte: any; lte: any; gt: any }>(builder: T, query: ListingQuery): T {
  // One property, one card: only the listing that stands for its property.
  let q = builder.eq("status", "active").eq("is_group_lead", true);
  if (query.locationSlug) q = q.eq("place_slug", query.locationSlug);
  if (query.purpose) q = q.eq("purpose", query.purpose);
  if (query.category) q = q.eq("category", query.category);
  if (query.propertyType) q = q.eq("property_type", query.propertyType);
  if (query.minBedrooms) q = q.gte("bedrooms", query.minBedrooms);
  if (query.minPrice !== undefined) q = q.gte("price", query.minPrice);
  if (query.maxPrice !== undefined) q = q.lte("price", query.maxPrice);
  if (query.ownerOnly) q = q.eq("origin", "first_party").eq("lister_type", "owner");
  if (query.sort === "price_drop") q = q.gt("price_drop_percent", 0);
  return q;
}

/** Same order as sortCards() in listing-math.ts, ending with id so pages never overlap. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applySort<T extends { order: any }>(builder: T, sort: ListingQuery["sort"]): T {
  switch (sort) {
    case "price_asc":
      return builder.order("price", { ascending: true }).order("id");
    case "price_desc":
      return builder.order("price", { ascending: false }).order("id");
    case "popular":
      return builder.order("view_count", { ascending: false }).order("first_seen_at", { ascending: false }).order("id");
    case "price_drop":
      return builder
        .order("price_changed_at", { ascending: false })
        .order("price_drop_percent", { ascending: false })
        .order("id");
    default:
      return builder.order("first_seen_at", { ascending: false }).order("id");
  }
}

export const supabaseRepository: Repository = {
  kind: "supabase",

  async getHomePageData(): Promise<HomePageData> {
    const supabase = createSupabasePublicClient();
    const activeCards = () =>
      supabase.from("listing_cards").select(CARD_COLUMNS).eq("status", "active").eq("is_group_lead", true);

    // Keep these ORDER BY clauses in step with the sorts in demo-repository.ts.
    const [popular, newest, priceDrops, ownerDirect, areas] = await Promise.all([
      activeCards()
        .order("view_count", { ascending: false })
        .order("first_seen_at", { ascending: false })
        .order("id")
        .limit(HOME_RAIL_SIZE),
      activeCards()
        .order("first_seen_at", { ascending: false })
        .order("view_count", { ascending: false })
        .order("id")
        .limit(HOME_RAIL_SIZE),
      activeCards()
        .gt("price_drop_percent", 0)
        .order("price_changed_at", { ascending: false })
        .order("price_drop_percent", { ascending: false })
        .order("id")
        .limit(HOME_PRICE_DROP_SIZE),
      activeCards()
        .eq("origin", "first_party")
        .eq("lister_type", "owner")
        .order("view_count", { ascending: false })
        .order("first_seen_at", { ascending: false })
        .order("id")
        .limit(HOME_RAIL_SIZE),
      supabase.from("location_listing_stats").select(AREA_COLUMNS).eq("is_popular", true).order("sort_order"),
    ]);

    if (popular.error) fail("popular listings", popular.error);
    if (newest.error) fail("new listings", newest.error);
    if (priceDrops.error) fail("price drops", priceDrops.error);
    if (ownerDirect.error) fail("owner listings", ownerDirect.error);
    if (areas.error) fail("area statistics", areas.error);

    const cards = (rows: unknown) => (rows as Row[]).map(toCard);
    const areaRows = areas.data as unknown as Row[];

    const data = {
      popular: cards(popular.data),
      newest: cards(newest.data),
      priceDrops: cards(priceDrops.data),
      ownerDirect: cards(ownerDirect.data),
      popularAreas: areaRows.map(toAreaStats),
    };

    return {
      ...data,
      containsDemoData:
        [...data.popular, ...data.newest, ...data.priceDrops, ...data.ownerDirect].some((card) => card.isDemo) ||
        areaRows.some((row) => row.contains_demo_data === true),
      generatedAt: new Date().toISOString(),
    };
  },

  async searchLocations(query: string, limit = 8): Promise<LocationSummary[]> {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase.rpc("search_locations", { search_query: query, max_results: limit });
    if (error) fail("locations", error);
    return (data as Row[]).map(toLocationSummary);
  },

  async getPopularLocations(limit = 10): Promise<LocationSummary[]> {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("location_summaries")
      .select(LOCATION_COLUMNS)
      .eq("is_popular", true)
      .order("sort_order")
      .limit(limit);
    if (error) fail("popular locations", error);
    return (data as unknown as Row[]).map(toLocationSummary);
  },

  async getLocationBySlug(slug: string): Promise<LocationSummary | null> {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("location_summaries")
      .select(LOCATION_COLUMNS)
      .eq("slug", slug)
      .maybeSingle();
    if (error) fail("location", error);
    return data ? toLocationSummary(data as unknown as Row) : null;
  },

  async getExternalSearchLinks(): Promise<ExternalSearchLink[]> {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("external_search_links")
      .select(LINK_COLUMNS)
      .order("sort_order")
      .order("id");
    if (error) fail("links to other sites", error);
    // Only https links are ever rendered, whatever the table holds.
    return (data as unknown as Row[]).map(toExternalLink).filter((link) => link.url.startsWith("https://"));
  },

  async getAmenities() {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase.from("amenities").select("slug, name_bn").order("sort_order").order("slug");
    if (error) fail("amenities", error);
    return (data as Row[]).map((row) => ({ slug: String(row.slug), nameBn: String(row.name_bn) }));
  },

  async getAllLocations() {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase.from("location_summaries").select(LOCATION_COLUMNS).order("sort_order").order("slug");
    if (error) fail("locations", error);
    return (data as unknown as Row[]).map(toLocationSummary);
  },

  async searchListings(query) {
    const supabase = createSupabasePublicClient();
    // Without a place, read the cards directly; with one, the view that repeats each card per enclosing place.
    const from = query.locationSlug ? "listing_search" : "listing_cards";
    const start = (query.page - 1) * query.pageSize;
    const { data, error, count } = await applySort(
      applyQuery(supabase.from(from).select(CARD_COLUMNS, { count: "exact" }), query),
      query.sort,
    ).range(start, start + query.pageSize - 1);
    // Asking for a page past the end is not an error worth failing the page over.
    if (error && error.code !== "PGRST103") fail("search results", error);
    const listings = error ? [] : (data as unknown as Row[]).map(toCard);
    return {
      listings,
      total: count ?? 0,
      page: query.page,
      pageSize: query.pageSize,
      containsDemoData: listings.some((card) => card.isDemo),
      generatedAt: new Date().toISOString(),
    };
  },

  async getListingBySlug(slug) {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("listing_details")
      .select(DETAIL_COLUMNS)
      .eq("slug", slug)
      .in("status", ["active", "stale", "sold", "rented"])
      .maybeSingle();
    if (error) fail("listing", error);
    if (!data) return null;
    const detail = toDetail(data as unknown as Row);
    if (detail.origin !== "first_party") return detail;
    const { data: video } = await supabase.from("listing_videos").select("url, poster_url").eq("listing_id", detail.id).maybeSingle();
    return { ...detail, video: safeVideo(video as Row | null) };
  },

  async getSimilarListings(listing, limit) {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("listing_search")
      .select(CARD_COLUMNS)
      .eq("status", "active")
      .eq("place_slug", similarPlace(listing))
      .eq("purpose", listing.purpose)
      .eq("category", listing.category)
      .eq("is_group_lead", true)
      .neq("property_id", listing.propertyId)
      .order("first_seen_at", { ascending: false })
      .order("id")
      .limit(SIMILAR_CANDIDATES);
    if (error) fail("similar listings", error);
    return pickSimilar((data as unknown as Row[]).map(toCard), listing, limit);
  },

  async getOtherListings(listing) {
    const supabase = createSupabasePublicClient();
    // Same order as compareInGroup() in listing-math.ts.
    const { data, error } = await supabase
      .from("listing_cards")
      .select(CARD_COLUMNS)
      .eq("status", "active")
      .eq("property_id", listing.propertyId)
      .eq("purpose", listing.purpose)
      .neq("id", listing.id)
      .order("price")
      .order("first_seen_at", { ascending: false })
      .order("id");
    if (error) fail("other listings of this property", error);
    const cards = (data as unknown as Row[]).map(toCard);
    // First-party listings first; the sort above is stable within each side.
    return [...cards.filter((card) => card.origin === "first_party"), ...cards.filter((card) => card.origin !== "first_party")];
  },

  async getMapAreas(query) {
    const supabase = createSupabasePublicClient();
    const from = query.locationSlug ? "listing_search" : "listing_cards";
    const [matches, places] = await Promise.all([
      applyQuery(supabase.from(from).select("location_slug, price, is_demo", { count: "exact" }), query)
        .order("id")
        .limit(MAP_MAX_LISTINGS),
      supabase.from("locations").select("slug, type, name_bn, name_en, latitude, longitude, parent:parent_id (slug, name_bn)"),
    ]);
    if (matches.error) fail("map", matches.error);
    if (places.error) fail("places for the map", places.error);

    const info = new Map<string, { place: PlaceInfo; point: MapPoint | undefined }>();
    for (const row of places.data as unknown as Row[]) {
      const parent = (Array.isArray(row.parent) ? row.parent[0] : row.parent) as Row | null;
      const latitude = numberOrNull(row.latitude);
      const longitude = numberOrNull(row.longitude);
      info.set(String(row.slug), {
        place: {
          slug: String(row.slug),
          type: oneOf(LOCATION_TYPES, row.type, "area"),
          nameBn: String(row.name_bn),
          nameEn: String(row.name_en),
          parentSlug: parent ? String(parent.slug) : null,
          parentNameBn: parent ? String(parent.name_bn) : null,
          ancestors: [],
        },
        point: latitude !== null && longitude !== null ? { latitude, longitude } : undefined,
      });
    }
    const rows = (matches.data as unknown as Row[]).map((row) => ({
      locationSlug: String(row.location_slug),
      price: Number(row.price),
      isDemo: row.is_demo === true,
    }));
    const total = matches.count ?? rows.length;
    const result = computeMapAreas(
      rows,
      (slug) => info.get(slug)?.place,
      (slug) => info.get(slug)?.point,
      total <= rows.length,
    );
    return { ...result, total };
  },

  async getAreaModeCounts() {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("area_listing_counts")
      .select("slug, mode, active_count, contains_demo_data")
      .order("slug")
      .order("mode");
    if (error) fail("area counts", error);
    return (data as Row[]).map(
      (row): AreaModeCount => ({
        slug: String(row.slug),
        mode: oneOf(SEARCH_MODES, row.mode, "buy"),
        count: Number(row.active_count ?? 0),
        containsDemoData: row.contains_demo_data === true,
      }),
    );
  },

  async getPriceGuide() {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase.from("location_price_guide").select(GUIDE_COLUMNS).order("slug");
    if (error) fail("price guide", error);
    return (data as unknown as Row[]).map(toGuideRow);
  },

  async getIndexableListings(limit) {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("listing_cards")
      .select("slug, location_slug, last_checked_at")
      .eq("status", "active")
      .eq("origin", "first_party")
      .eq("is_demo", false)
      .order("last_checked_at", { ascending: false })
      .limit(limit);
    if (error) fail("listings for the sitemap", error);
    return (data as Row[]).map((row) => ({
      slug: String(row.slug),
      locationSlug: String(row.location_slug),
      updatedAt: String(row.last_checked_at),
    }));
  },
};
