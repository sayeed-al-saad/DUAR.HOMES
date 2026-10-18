import { AMENITIES } from "@/data/amenities";
import {
  DEMO_AGENCIES,
  DEMO_AGENTS,
  DEMO_LISTINGS,
  DEMO_SOURCES,
  FIRST_PARTY_SOURCE,
  type ListingSeed,
  type SourceSeed,
} from "@/data/demo";
import { EXTERNAL_SITES, EXTERNAL_SITES_REVIEWED_ON } from "@/data/external-sites";
import { LOCATIONS, type LocationSeed } from "@/data/locations";
import { buildListingSlug, buildListingTitle } from "@/lib/domain/listing-title";
import type {
  Furnishing,
  ListerType,
  ListingOrigin,
  ListingStatus,
  PropertyType,
  Purpose,
} from "@/lib/domain/types";
import { stableUuid } from "@/lib/ids";

/**
 * Expands the compact seeds in src/data into fully resolved records with ids,
 * slugs and titles. Two things consume the result:
 *   - the demo repository (demo mode), and
 *   - scripts/generate-sql.ts (writes the reference-data migration and seed.sql).
 * Sharing it guarantees both describe exactly the same data.
 */

export interface ResolvedLocation extends LocationSeed {
  id: string;
  parentId: string | null;
}

export interface ResolvedSource extends SourceSeed {
  id: string;
}

export interface ResolvedProperty {
  id: string;
  key: string;
  locationSlug: string;
  locationId: string;
  propertyType: PropertyType;
  sizeSqft: number | null;
  landSizeKatha: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  balconies: number | null;
  floorNumber: number | null;
  totalFloors: number | null;
  furnishing: Furnishing | null;
  parkingSpaces: number | null;
  /** Approximate display point near the area centre, never a real address. */
  latitude: number;
  longitude: number;
  amenities: string[];
}

export interface ResolvedListing {
  id: string;
  key: string;
  propertyId: string;
  propertyKey: string;
  sourceSlug: string;
  sourceId: string;
  origin: ListingOrigin;
  purpose: Purpose;
  title: string;
  slug: string;
  description: string | null;
  price: number;
  previousPrice: number | null;
  priceChangedDaysAgo: number | null;
  listerType: ListerType;
  agencySlug: string | null;
  agentSlug: string | null;
  sourceUrl: string | null;
  sourceListingRef: string | null;
  status: ListingStatus;
  isVerified: boolean;
  firstSeenDaysAgo: number;
  lastCheckedDaysAgo: number;
  viewCount: number;
  imageUrl: string | null;
  imageAlt: string | null;
}

export const locations: ResolvedLocation[] = LOCATIONS.map((location) => ({
  ...location,
  id: stableUuid("location", location.slug),
  parentId: location.parent ? stableUuid("location", location.parent) : null,
}));

export const locationBySlug = new Map(locations.map((location) => [location.slug, location]));

export const sources: ResolvedSource[] = [FIRST_PARTY_SOURCE, ...DEMO_SOURCES].map((source) => ({
  ...source,
  id: stableUuid("source", source.slug),
}));

export const sourceBySlug = new Map(sources.map((source) => [source.slug, source]));

export const agencies = DEMO_AGENCIES.map((agency) => ({
  ...agency,
  id: stableUuid("agency", agency.slug),
  locationId: stableUuid("location", agency.location),
}));

export const agents = DEMO_AGENTS.map((agent) => ({
  ...agent,
  id: stableUuid("agent", agent.slug),
  agencyId: agent.agency ? stableUuid("agency", agent.agency) : null,
}));

/** Small repeatable offset so demo pins do not all sit on the area centre. */
function jitter(key: string, axis: "lat" | "lng"): number {
  let hash = 0;
  for (const char of `${key}:${axis}`) hash = (hash * 31 + char.charCodeAt(0)) % 10_007;
  return Number((((hash / 10_007) - 0.5) * 0.008).toFixed(6));
}

function must<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(`Demo data error: ${message}`);
  return value;
}

function resolveProperty(seed: ListingSeed): ResolvedProperty {
  const location = must(locationBySlug.get(seed.loc), `unknown location "${seed.loc}" in ${seed.key}`);
  for (const amenity of seed.amenities ?? []) {
    must(AMENITIES.find((item) => item.slug === amenity), `unknown amenity "${amenity}" in ${seed.key}`);
  }
  return {
    id: stableUuid("property", seed.key),
    key: seed.key,
    locationSlug: location.slug,
    locationId: location.id,
    propertyType: seed.type,
    sizeSqft: seed.sqft ?? null,
    landSizeKatha: seed.katha ?? null,
    bedrooms: seed.beds ?? null,
    bathrooms: seed.baths ?? null,
    balconies: seed.balconies ?? null,
    floorNumber: seed.floor ?? null,
    totalFloors: seed.floors ?? null,
    furnishing: seed.furnishing ?? null,
    parkingSpaces: seed.parking ?? null,
    latitude: Number((location.latitude + jitter(seed.key, "lat")).toFixed(6)),
    longitude: Number((location.longitude + jitter(seed.key, "lng")).toFixed(6)),
    amenities: seed.amenities ?? [],
  };
}

export const properties: ResolvedProperty[] = DEMO_LISTINGS.filter((seed) => !seed.sameAs).map(resolveProperty);

export const propertyByKey = new Map(properties.map((property) => [property.key, property]));

export const listings: ResolvedListing[] = DEMO_LISTINGS.map((seed) => {
  const property = must(propertyByKey.get(seed.sameAs ?? seed.key), `unknown property for ${seed.key}`);
  const source = must(sourceBySlug.get(seed.source), `unknown source "${seed.source}" in ${seed.key}`);
  const origin: ListingOrigin = source.sourceType === "first_party" ? "first_party" : "external";

  if (origin === "external" && (seed.title || seed.description || seed.art)) {
    throw new Error(`Demo data error: external listing ${seed.key} must not carry a title, description or image`);
  }

  const facts = {
    propertyType: property.propertyType,
    purpose: seed.purpose,
    bedrooms: property.bedrooms,
    sizeSqft: property.sizeSqft,
    landSizeKatha: property.landSizeKatha,
  };
  const title = seed.title ?? buildListingTitle(facts);

  return {
    id: stableUuid("listing", seed.key),
    key: seed.key,
    propertyId: property.id,
    propertyKey: property.key,
    sourceSlug: source.slug,
    sourceId: source.id,
    origin,
    purpose: seed.purpose,
    title,
    slug: buildListingSlug(facts, seed.key),
    description: seed.description ?? null,
    price: seed.price,
    previousPrice: seed.prev ? seed.prev[0] : null,
    priceChangedDaysAgo: seed.prev ? seed.prev[1] : null,
    listerType: seed.lister,
    agencySlug: seed.agency ?? null,
    agentSlug: seed.agent ?? null,
    sourceUrl: origin === "external" ? `${source.website}/demo-listing/${seed.key}` : null,
    sourceListingRef: origin === "external" ? `demo-${seed.key}` : null,
    status: seed.status ?? "active",
    isVerified: seed.verified ?? false,
    firstSeenDaysAgo: seed.seen,
    lastCheckedDaysAgo: seed.checked,
    viewCount: seed.views,
    imageUrl: seed.art ? `/demo/${seed.art}.svg` : null,
    imageAlt: seed.art ? `${title} (ডেমো ছবি)` : null,
  };
});

/** Ids of a location and everything beneath it. */
export function descendantIds(rootSlug: string): Set<string> {
  const root = locationBySlug.get(rootSlug);
  const ids = new Set<string>();
  if (!root) return ids;
  const queue = [root.id];
  while (queue.length > 0) {
    const current = queue.pop() as string;
    ids.add(current);
    for (const location of locations) {
      if (location.parentId === current) queue.push(location.id);
    }
  }
  return ids;
}

/**
 * Real property sites and the links out to their public listing pages
 * (src/data/external-sites.ts). Real data, never flagged as demo.
 */
export const externalSites = EXTERNAL_SITES.map((site) => ({
  ...site,
  id: stableUuid("source", site.slug),
}));

export interface ResolvedExternalLink {
  id: string;
  sourceId: string;
  sourceSlug: string;
  sourceName: string;
  sourceWebsite: string;
  url: string;
  purpose: Purpose | null;
  category: "residential" | "land" | "commercial" | null;
  locationSlug: string | null;
  locationId: string | null;
  locationNameBn: string | null;
  lastCheckedAt: string;
  sortOrder: number;
}

export const externalLinks: ResolvedExternalLink[] = externalSites.flatMap((site, siteIndex) =>
  site.links.map((link, linkIndex) => {
    if (!link.url.startsWith(`${site.website}/`)) {
      throw new Error(`External link ${link.url} is not on ${site.website}`);
    }
    const location = link.location
      ? must(locationBySlug.get(link.location), `unknown location "${link.location}" for ${link.url}`)
      : null;
    return {
      id: stableUuid("source-link", link.url),
      sourceId: site.id,
      sourceSlug: site.slug,
      sourceName: site.name,
      sourceWebsite: site.website,
      url: link.url,
      purpose: link.purpose,
      category: link.category,
      locationSlug: location ? location.slug : null,
      locationId: location ? location.id : null,
      locationNameBn: location ? location.nameBn : null,
      lastCheckedAt: `${EXTERNAL_SITES_REVIEWED_ON}T00:00:00.000Z`,
      sortOrder: (siteIndex + 1) * 100 + linkIndex,
    };
  }),
);
