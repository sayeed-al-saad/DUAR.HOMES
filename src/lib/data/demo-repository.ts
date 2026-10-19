import { AMENITIES } from "@/data/amenities";
import { categoryOf, PUBLIC_LISTING_STATUSES } from "@/lib/domain/types";
import { pricePerSqft } from "@/lib/format/units";
import {
  descendantIds,
  externalLinks,
  listings,
  locationBySlug,
  locations,
  propertyByKey,
  sourceBySlug,
  type ResolvedListing,
  type ResolvedLocation,
} from "./demo-dataset";
import {
  assignGroups,
  computeAreaModeCounts,
  computeMapAreas,
  computePriceGuide,
  matchesQuery,
  otherListingsOf,
  pickSimilar,
  searchCards,
  similarCandidates,
  type MapPoint,
  type PlaceInfo,
} from "./listing-math";
import {
  HOME_PRICE_DROP_SIZE,
  HOME_RAIL_SIZE,
  type AreaStats,
  type ExternalSearchLink,
  type HomePageData,
  type ListingCard,
  type ListingDetail,
  type LocationSummary,
  MAP_MAX_LISTINGS,
  type PriceHistoryPoint,
  type Repository,
} from "./types";

const DAY_MS = 86_400_000;

function daysAgo(now: number, days: number): string {
  return new Date(now - days * DAY_MS).toISOString();
}

function toCard(listing: ResolvedListing, now: number): ListingCard {
  const property = propertyByKey.get(listing.propertyKey)!;
  const location = locationBySlug.get(property.locationSlug)!;
  const parent = location.parent ? locationBySlug.get(location.parent) : undefined;
  const source = sourceBySlug.get(listing.sourceSlug)!;
  const dropped = listing.previousPrice !== null && listing.previousPrice > listing.price;

  return {
    id: listing.id,
    slug: listing.slug,
    propertyId: property.id,
    // Filled by assignGroups().
    isGroupLead: true,
    alsoListedCount: 0,
    groupMinPrice: null,
    title: listing.title,
    purpose: listing.purpose,
    origin: listing.origin,
    listerType: listing.listerType,
    status: listing.status,
    price: listing.price,
    previousPrice: listing.previousPrice,
    priceChangedAt: listing.priceChangedDaysAgo === null ? null : daysAgo(now, listing.priceChangedDaysAgo),
    priceDropPercent: dropped
      ? Number((((listing.previousPrice! - listing.price) / listing.previousPrice!) * 100).toFixed(1))
      : null,
    propertyType: property.propertyType,
    category: categoryOf(property.propertyType),
    sizeSqft: property.sizeSqft,
    landSizeKatha: property.landSizeKatha,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    pricePerSqft: pricePerSqft(listing.price, property.sizeSqft),
    locationSlug: location.slug,
    locationNameBn: location.nameBn,
    parentLocationNameBn: location.type === "area" && parent ? parent.nameBn : null,
    sourceName: source.name,
    sourceUrl: listing.sourceUrl,
    imageUrl: listing.imageUrl,
    imageAlt: listing.imageAlt,
    isVerified: listing.isVerified,
    firstSeenAt: daysAgo(now, listing.firstSeenDaysAgo),
    lastCheckedAt: daysAgo(now, listing.lastCheckedDaysAgo),
    viewCount: listing.viewCount,
    isDemo: true,
  };
}



// ---------------------------------------------------------------------------
// Places, cards and details for search and listing pages
// ---------------------------------------------------------------------------

const placeCache = new Map<string, PlaceInfo>();

/** A location with the chain of places above it. */
export function placeInfo(slug: string): PlaceInfo | undefined {
  const cached = placeCache.get(slug);
  if (cached) return cached;
  const location = locationBySlug.get(slug);
  if (!location) return undefined;
  const ancestors: string[] = [];
  let current: ResolvedLocation | undefined = location;
  while (current) {
    ancestors.push(current.slug);
    current = current.parent ? locationBySlug.get(current.parent) : undefined;
  }
  const parent = location.parent ? locationBySlug.get(location.parent) : undefined;
  const info: PlaceInfo = {
    slug,
    type: location.type,
    nameBn: location.nameBn,
    nameEn: location.nameEn,
    parentSlug: parent?.slug ?? null,
    parentNameBn: parent?.nameBn ?? null,
    ancestors,
  };
  placeCache.set(slug, info);
  return info;
}

const amenityName = new Map(AMENITIES.map((amenity) => [amenity.slug, amenity.nameBn]));
const amenityOrder = new Map(AMENITIES.map((amenity, index) => [amenity.slug, index]));

/** Same points the record_price_history trigger writes when a listing is inserted. */
function historyOf(card: ListingCard): PriceHistoryPoint[] {
  if (card.previousPrice === null) return [{ price: card.price, recordedAt: card.firstSeenAt }];
  return [
    { price: card.previousPrice, recordedAt: card.firstSeenAt },
    { price: card.price, recordedAt: card.priceChangedAt ?? card.firstSeenAt },
  ];
}

function detailOf(card: ListingCard, extra: Partial<ListingDetail>): ListingDetail {
  const place = placeInfo(card.locationSlug);
  return {
    ...card,
    video: null,
    description: null,
    furnishing: null,
    balconies: null,
    floorNumber: null,
    totalFloors: null,
    parkingSpaces: null,
    amenities: [],
    locationType: place?.type ?? "area",
    parentLocationSlug: place?.parentSlug ?? null,
    publishedAt: card.firstSeenAt,
    priceHistory: historyOf(card),
    generatedAt: new Date().toISOString(),
    ...extra,
  };
}

function bundledDetail(listing: ResolvedListing, card: ListingCard): ListingDetail {
  const property = propertyByKey.get(listing.propertyKey)!;
  return detailOf(card, {
    description: listing.description,
    furnishing: property.furnishing,
    balconies: property.balconies,
    floorNumber: property.floorNumber,
    totalFloors: property.totalFloors,
    parkingSpaces: property.parkingSpaces,
    amenities: [...property.amenities]
      .sort((a, b) => (amenityOrder.get(a) ?? 0) - (amenityOrder.get(b) ?? 0) || (a < b ? -1 : 1))
      .map((slug) => ({ slug, nameBn: amenityName.get(slug) ?? slug })),
  });
}

function toSummary(location: ResolvedLocation): LocationSummary {
  const parent = location.parent ? locationBySlug.get(location.parent) : undefined;
  return {
    id: location.id,
    slug: location.slug,
    type: location.type,
    nameBn: location.nameBn,
    nameEn: location.nameEn,
    parentNameBn: parent ? parent.nameBn : null,
    parentSlug: parent ? parent.slug : null,
  };
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/** Every bundled demo listing a visitor may see, grouped. */
function bundledCards(now: number): ListingCard[] {
  return assignGroups(
    listings.filter((listing) => PUBLIC_LISTING_STATUSES.includes(listing.status)).map((listing) => toCard(listing, now)),
  );
}

/**
 * Mirrors the `location_listing_stats` view: one property counts once.
 * scripts/test-db.ts checks the two agree. `cards` defaults to the bundled demo data.
 */
export function computeAreaStats(slug: string, cards: ListingCard[] = bundledCards(Date.now())): AreaStats | null {
  const location = locationBySlug.get(slug);
  if (!location) return null;
  const ids = descendantIds(slug);

  const active = cards.filter(
    (card) => card.status === "active" && card.isGroupLead && ids.has(locationBySlug.get(card.locationSlug)?.id ?? ""),
  );

  const salePerSqft: number[] = [];
  const rents: number[] = [];
  for (const card of active) {
    if (card.category !== "residential") continue;
    if (card.purpose === "sale" && card.sizeSqft && card.sizeSqft > 0) {
      salePerSqft.push(card.price / card.sizeSqft);
    }
    if (card.purpose === "rent" && card.propertyType !== "room") {
      rents.push(card.price);
    }
  }

  return {
    slug: location.slug,
    nameBn: location.nameBn,
    nameEn: location.nameEn,
    activeListingCount: active.length,
    avgSalePricePerSqft: mean(salePerSqft),
    saleSampleSize: salePerSqft.length,
    avgMonthlyRent: mean(rents),
    rentSampleSize: rents.length,
  };
}

/** The point a place is drawn at on the map: its centre. */
function locationPoint(slug: string): MapPoint | undefined {
  const location = locationBySlug.get(slug);
  return location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
    ? { latitude: location.latitude, longitude: location.longitude }
    : undefined;
}

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function popularLocations(): ResolvedLocation[] {
  return locations.filter((location) => location.isPopular).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Builds the demo-mode repository from the bundled demo data. */
export function createDemoRepository(): Repository {
  /** Every listing a visitor may see. */
  function allCards(now: number): ListingCard[] {
    return bundledCards(now);
  }

  return {
    kind: "demo",

    async getHomePageData(): Promise<HomePageData> {
      const now = Date.now();
      const cards = allCards(now);
      const active = cards.filter((card) => card.status === "active" && card.isGroupLead);

      // Tie-breakers match the ORDER BY clauses in supabase-repository.ts exactly,
      // so both data sources produce the same page from the same rows.
      const byId = (a: ListingCard, b: ListingCard) => a.id.localeCompare(b.id);
      const byViews = [...active].sort(
        (a, b) => b.viewCount - a.viewCount || b.firstSeenAt.localeCompare(a.firstSeenAt) || byId(a, b),
      );
      const byNewest = [...active].sort(
        (a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt) || b.viewCount - a.viewCount || byId(a, b),
      );
      const drops = active
        .filter((card) => card.priceDropPercent !== null)
        .sort(
          (a, b) =>
            (b.priceChangedAt ?? "").localeCompare(a.priceChangedAt ?? "") ||
            (b.priceDropPercent ?? 0) - (a.priceDropPercent ?? 0) ||
            byId(a, b),
        );
      const owners = byViews.filter((card) => card.origin === "first_party" && card.listerType === "owner");

      return {
        popular: byViews.slice(0, HOME_RAIL_SIZE),
        newest: byNewest.slice(0, HOME_RAIL_SIZE),
        priceDrops: drops.slice(0, HOME_PRICE_DROP_SIZE),
        ownerDirect: owners.slice(0, HOME_RAIL_SIZE),
        popularAreas: popularLocations().map((location) => computeAreaStats(location.slug, cards)!),
        containsDemoData: true,
        generatedAt: new Date(now).toISOString(),
      };
    },

    async searchLocations(query: string, limit = 8): Promise<LocationSummary[]> {
      const needle = normalise(query);
      if (needle.length === 0) return popularLocations().slice(0, limit).map(toSummary);

      const scored: Array<{ location: ResolvedLocation; score: number }> = [];
      for (const location of locations) {
        const names = [location.nameBn, location.nameEn, location.slug.replace(/-/g, " "), ...location.altNames].map(normalise);
        let score = 0;
        if (names.some((name) => name === needle)) score = 3;
        else if (names.some((name) => name.startsWith(needle))) score = 2;
        else if (names.some((name) => name.includes(needle))) score = 1;
        if (score > 0) scored.push({ location, score });
      }

      return scored
        .sort(
          (a, b) =>
            b.score - a.score ||
            Number(b.location.isPopular) - Number(a.location.isPopular) ||
            a.location.sortOrder - b.location.sortOrder,
        )
        .slice(0, limit)
        .map((entry) => toSummary(entry.location));
    },

    async getPopularLocations(limit = 10): Promise<LocationSummary[]> {
      return popularLocations().slice(0, limit).map(toSummary);
    },

    async getLocationBySlug(slug: string): Promise<LocationSummary | null> {
      const location = locationBySlug.get(slug);
      return location ? toSummary(location) : null;
    },

    async getExternalSearchLinks(): Promise<ExternalSearchLink[]> {
      return [...externalLinks]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((link) => ({
          id: link.id,
          url: link.url,
          purpose: link.purpose,
          category: link.category,
          locationSlug: link.locationSlug,
          locationNameBn: link.locationNameBn,
          sourceSlug: link.sourceSlug,
          sourceName: link.sourceName,
          sourceWebsite: link.sourceWebsite,
          lastCheckedAt: link.lastCheckedAt,
        }));
    },

    async getAmenities() {
      return AMENITIES.map((amenity) => ({ slug: amenity.slug, nameBn: amenity.nameBn }));
    },

    async getAllLocations() {
      return [...locations].sort((a, b) => a.sortOrder - b.sortOrder || (a.slug < b.slug ? -1 : 1)).map(toSummary);
    },

    async searchListings(query) {
      const now = Date.now();
      const { listings: page, total } = searchCards(allCards(now), query, placeInfo);
      return {
        listings: page,
        total,
        page: query.page,
        pageSize: query.pageSize,
        containsDemoData: page.some((card) => card.isDemo),
        generatedAt: new Date(now).toISOString(),
      };
    },

    async getListingBySlug(slug) {
      const now = Date.now();
      const card = allCards(now).find((candidate) => candidate.slug === slug);
      if (!card) return null;
      const bundled = listings.find((listing) => listing.slug === slug);
      return bundled ? bundledDetail(bundled, card) : detailOf(card, {});
    },

    async getSimilarListings(listing, limit) {
      return pickSimilar(similarCandidates(allCards(Date.now()), listing, placeInfo), listing, limit);
    },

    async getOtherListings(listing) {
      return otherListingsOf(allCards(Date.now()), listing);
    },

    async getMapAreas(query) {
      const matching = allCards(Date.now()).filter((card) => matchesQuery(card, query, placeInfo));
      const complete = matching.length <= MAP_MAX_LISTINGS;
      return computeMapAreas(matching.slice(0, MAP_MAX_LISTINGS), placeInfo, locationPoint, complete);
    },

    async getAreaModeCounts() {
      return computeAreaModeCounts(allCards(Date.now()), placeInfo);
    },

    async getPriceGuide() {
      return computePriceGuide(allCards(Date.now()), placeInfo);
    },

    async getIndexableListings(limit) {
      return allCards(Date.now())
        .filter((card) => card.status === "active" && card.origin === "first_party" && !card.isDemo)
        .slice(0, limit)
        .map((card) => ({ slug: card.slug, locationSlug: card.locationSlug, updatedAt: card.lastCheckedAt }));
    },
  };
}

/** What the site uses in demo mode. */
export const demoRepository: Repository = createDemoRepository();

/** The same repository, under the name the tests use. */
export const bundledDemoRepository: Repository = demoRepository;

/** Exposed for tests: every demo listing a visitor is allowed to see. */
export function publicDemoListingCount(): number {
  return listings.filter((listing) => PUBLIC_LISTING_STATUSES.includes(listing.status)).length;
}
