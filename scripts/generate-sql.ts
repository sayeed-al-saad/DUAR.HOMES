/**
 * Writes the SQL files that are derived from src/data:
 *
 *   supabase/migrations/20261008000600_reference_data.sql
 *       locations, amenities and the first-party source. Real reference data,
 *       needed in every environment.
 *
 *   supabase/migrations/20261008000900_external_sites_data.sql
 *       real property sites (switched off for ingestion) and the links out to
 *       their public listing pages.
 *
 *   supabase/seed.sql
 *       DEMO listings, sources, agencies and agents. Every row is is_demo = true.
 *
 * Run with `npm run db:generate` after editing anything in src/data.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { AMENITIES } from "../src/data/amenities";
import {
  agencies,
  agents,
  externalLinks,
  externalSites,
  listings,
  locations,
  properties,
  sources,
} from "../src/lib/data/demo-dataset";

const root = resolve(__dirname, "..");

type Value = string | number | boolean | null | string[];

function literal(value: Value): string {
  if (value === null) return "null";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    if (value.length === 0) return "'{}'::text[]";
    return `array[${value.map((item) => literal(item)).join(", ")}]::text[]`;
  }
  return `'${value.replace(/'/g, "''")}'`;
}

/** SQL expression passed through untouched. */
class Raw {
  constructor(readonly sql: string) {}
}

function daysAgo(days: number | null): Raw | null {
  if (days === null) return null;
  return new Raw(days === 0 ? "now()" : `now() - interval '${days} days'`);
}

function row(values: Array<Value | Raw>): string {
  return `  (${values.map((value) => (value instanceof Raw ? value.sql : literal(value))).join(", ")})`;
}

function insert(table: string, columns: string[], rows: string[], conflict: string): string {
  if (rows.length === 0) return "";
  return `insert into ${table}\n  (${columns.join(", ")})\nvalues\n${rows.join(",\n")}\n${conflict};\n`;
}

function header(lines: string[]): string {
  return `${lines.map((line) => `-- ${line}`.trimEnd()).join("\n")}\n\n`;
}

// ---------------------------------------------------------------------------
// Reference data migration
// ---------------------------------------------------------------------------

const firstPartySource = sources.find((source) => source.sourceType === "first_party")!;

const referenceSql =
  header([
    "Phase 1 · 6 of 7 · Reference data",
    "",
    "GENERATED FILE. Do not edit by hand.",
    "Source: src/data/locations.ts, src/data/amenities.ts, src/data/demo.ts (FIRST_PARTY_SOURCE)",
    "Regenerate with: npm run db:generate",
    "",
    `Contents: ${locations.length} locations, ${AMENITIES.length} amenities, the first-party source.`,
    "Safe to run again: existing rows are updated in place.",
  ]) +
  insert(
    "public.locations",
    ["id", "parent_id", "type", "slug", "name_bn", "name_en", "alt_names", "latitude", "longitude", "is_popular", "sort_order"],
    locations.map((location) =>
      row([
        location.id,
        location.parentId,
        location.type,
        location.slug,
        location.nameBn,
        location.nameEn,
        location.altNames,
        location.latitude,
        location.longitude,
        location.isPopular,
        location.sortOrder,
      ]),
    ),
    [
      "on conflict (slug) do update set",
      "  parent_id = excluded.parent_id,",
      "  type = excluded.type,",
      "  name_bn = excluded.name_bn,",
      "  name_en = excluded.name_en,",
      "  alt_names = excluded.alt_names,",
      "  latitude = excluded.latitude,",
      "  longitude = excluded.longitude,",
      "  is_popular = excluded.is_popular,",
      "  sort_order = excluded.sort_order",
    ].join("\n"),
  ) +
  "\n" +
  insert(
    "public.amenities",
    ["slug", "name_bn", "name_en", "sort_order"],
    AMENITIES.map((amenity, index) => row([amenity.slug, amenity.nameBn, amenity.nameEn, (index + 1) * 10])),
    "on conflict (slug) do update set\n  name_bn = excluded.name_bn,\n  name_en = excluded.name_en,\n  sort_order = excluded.sort_order",
  ) +
  "\n" +
  "-- Listings created on this site belong to this source.\n" +
  insert(
    "public.sources",
    [
      "id", "name", "slug", "website", "source_type", "ingestion_method", "permission_status", "active",
      "allow_images", "allow_description", "allow_contact", "notes", "is_demo",
    ],
    [
      row([
        firstPartySource.id,
        firstPartySource.name,
        firstPartySource.slug,
        firstPartySource.website,
        firstPartySource.sourceType,
        firstPartySource.ingestionMethod,
        firstPartySource.permissionStatus,
        firstPartySource.active,
        firstPartySource.allowImages,
        firstPartySource.allowDescription,
        firstPartySource.allowContact,
        firstPartySource.notes,
        false,
      ]),
    ],
    "on conflict (slug) do nothing",
  );

// ---------------------------------------------------------------------------
// Demo seed
// ---------------------------------------------------------------------------

const demoSources = sources.filter((source) => source.isDemo);

const seedSql =
  header([
    "DEMO DATA. Not real properties, people, companies or websites.",
    "",
    "GENERATED FILE. Do not edit by hand.",
    "Source: src/data/demo.ts",
    "Regenerate with: npm run db:generate",
    "",
    `Contents: ${demoSources.length} demo sources, ${agencies.length} agencies, ${agents.length} agents,`,
    `${properties.length} properties and ${listings.length} listings. Every row has is_demo = true.`,
    "Dates are relative to the moment this file runs, so freshness labels look right.",
    "",
    "Remove all of it later with: supabase/remove_demo_data.sql",
    "Safe to run again: rows that already exist are skipped.",
  ]) +
  "begin;\n\n" +
  insert(
    "public.sources",
    [
      "id", "name", "slug", "website", "source_type", "ingestion_method", "permission_status", "active",
      "allow_images", "allow_description", "allow_contact", "last_checked", "last_success_at", "notes", "is_demo",
    ],
    demoSources.map((source) =>
      row([
        source.id,
        source.name,
        source.slug,
        source.website,
        source.sourceType,
        source.ingestionMethod,
        source.permissionStatus,
        source.active,
        source.allowImages,
        source.allowDescription,
        source.allowContact,
        source.active ? new Raw("now()") : null,
        source.active ? new Raw("now()") : null,
        source.notes,
        true,
      ]),
    ),
    "on conflict (id) do nothing",
  ) +
  "\n" +
  insert(
    "public.agencies",
    ["id", "kind", "name", "slug", "location_id", "is_verified", "verified_at", "is_demo"],
    agencies.map((agency) =>
      row([
        agency.id,
        agency.kind,
        agency.name,
        agency.slug,
        agency.locationId,
        agency.isVerified,
        agency.isVerified ? new Raw("now()") : null,
        true,
      ]),
    ),
    "on conflict (id) do nothing",
  ) +
  "\n" +
  insert(
    "public.agents",
    ["id", "agency_id", "display_name", "slug", "is_verified", "verified_at", "is_demo"],
    agents.map((agent) =>
      row([
        agent.id,
        agent.agencyId,
        agent.displayName,
        agent.slug,
        agent.isVerified,
        agent.isVerified ? new Raw("now()") : null,
        true,
      ]),
    ),
    "on conflict (id) do nothing",
  ) +
  "\n" +
  insert(
    "public.properties",
    [
      "id", "location_id", "property_type", "size_sqft", "land_size_katha", "bedrooms", "bathrooms", "balconies",
      "floor_number", "total_floors", "furnishing", "parking_spaces", "latitude", "longitude", "location_precision", "is_demo",
    ],
    properties.map((property) =>
      row([
        property.id,
        property.locationId,
        property.propertyType,
        property.sizeSqft,
        property.landSizeKatha,
        property.bedrooms,
        property.bathrooms,
        property.balconies,
        property.floorNumber,
        property.totalFloors,
        property.furnishing,
        property.parkingSpaces,
        property.latitude,
        property.longitude,
        "approximate",
        true,
      ]),
    ),
    "on conflict (id) do nothing",
  ) +
  "\n" +
  insert(
    "public.property_amenities",
    ["property_id", "amenity_slug"],
    properties.flatMap((property) => property.amenities.map((amenity) => row([property.id, amenity]))),
    "on conflict do nothing",
  ) +
  "\n" +
  insert(
    "public.property_listings",
    [
      "id", "property_id", "source_id", "origin", "purpose", "title", "slug", "description", "price",
      "previous_price", "price_changed_at", "lister_type", "agent_id", "agency_id", "source_url",
      "source_listing_ref", "source_listed_at", "status", "is_verified", "verified_at", "first_seen_at",
      "last_seen_at", "last_checked_at", "published_at", "view_count", "is_demo",
    ],
    listings.map((listing) => {
      const agent = agents.find((item) => item.slug === listing.agentSlug);
      const agency = agencies.find((item) => item.slug === listing.agencySlug);
      const published = ["active", "stale", "sold", "rented"].includes(listing.status);
      return row([
        listing.id,
        listing.propertyId,
        listing.sourceId,
        listing.origin,
        listing.purpose,
        listing.title,
        listing.slug,
        listing.description,
        listing.price,
        listing.previousPrice,
        daysAgo(listing.priceChangedDaysAgo),
        listing.listerType,
        agent ? agent.id : null,
        agency ? agency.id : null,
        listing.sourceUrl,
        listing.sourceListingRef,
        listing.origin === "external" ? daysAgo(listing.firstSeenDaysAgo) : null,
        listing.status,
        listing.isVerified,
        listing.isVerified ? daysAgo(listing.lastCheckedDaysAgo) : null,
        daysAgo(listing.firstSeenDaysAgo),
        daysAgo(listing.lastCheckedDaysAgo),
        daysAgo(listing.lastCheckedDaysAgo),
        published ? daysAgo(listing.firstSeenDaysAgo) : null,
        listing.viewCount,
        true,
      ]);
    }),
    "on conflict (id) do nothing",
  ) +
  "\n" +
  "-- Illustrations from /public/demo. Only first-party demo listings have one;\n" +
  "-- external listings never carry an image because their sources have not allowed it.\n" +
  insert(
    "public.listing_images",
    ["id", "listing_id", "url", "alt_bn", "width", "height", "sort_order", "is_primary", "rights_status", "is_demo"],
    listings
      .filter((listing) => listing.imageUrl !== null)
      .map((listing) =>
        row([
          // Same uuid shape as the listing id, with a different leading block.
          `d0d0d0d0-${listing.id.slice(9)}`,
          listing.id,
          listing.imageUrl,
          listing.imageAlt,
          800,
          600,
          0,
          true,
          "demo_placeholder",
          true,
        ]),
      ),
    "on conflict (id) do nothing",
  ) +
  "\ncommit;\n";

// ---------------------------------------------------------------------------
// Real external sites and the links out to them
// ---------------------------------------------------------------------------

const externalSql =
  header([
    "Links out to other sites · 2 of 2 · The sites and their links",
    "",
    "GENERATED FILE. Do not edit by hand.",
    "Source: src/data/external-sites.ts",
    "Regenerate with: npm run db:generate",
    "",
    `Contents: ${externalSites.length} real property sites and ${externalLinks.length} links to their public listing pages.`,
    "",
    "The sites are registered with ingestion switched OFF (active = false) and",
    "permission_status = not_requested: none of them has given permission for its",
    "listings to be shown here. Only links to their own pages are stored.",
    "docs/external-sources.md records what each site's robots.txt and terms said.",
    "",
    "Safe to run again: a site that already exists is left exactly as it is (so a",
    "permission you have since recorded is not overwritten); links are refreshed.",
  ]) +
  insert(
    "public.sources",
    [
      "id", "name", "slug", "website", "source_type", "ingestion_method", "permission_status", "active",
      "allow_images", "allow_description", "allow_contact", "notes", "is_demo",
    ],
    externalSites.map((site) =>
      row([site.id, site.name, site.slug, site.website, site.sourceType, "manual", "not_requested", false, false, false, false, site.reviewNotes, false]),
    ),
    "on conflict (slug) do nothing",
  ) +
  "\n" +
  insert(
    "public.source_links",
    ["id", "source_id", "url", "purpose", "category", "location_id", "last_checked_at", "sort_order"],
    externalLinks.map((link) =>
      row([
        link.id,
        // Looked up by slug, so this also works if the site row was created earlier with another id.
        new Raw(`(select id from public.sources where slug = ${literal(link.sourceSlug)})`),
        link.url,
        link.purpose,
        link.category,
        link.locationId,
        new Raw(`'${link.lastCheckedAt}'::timestamptz`),
        link.sortOrder,
      ]),
    ),
    [
      "on conflict (source_id, url) do update set",
      "  purpose = excluded.purpose,",
      "  category = excluded.category,",
      "  location_id = excluded.location_id,",
      "  last_checked_at = excluded.last_checked_at,",
      "  sort_order = excluded.sort_order",
    ].join("\n"),
  );

writeFileSync(resolve(root, "supabase/migrations/20261008000600_reference_data.sql"), referenceSql);
writeFileSync(resolve(root, "supabase/migrations/20261008000900_external_sites_data.sql"), externalSql);
writeFileSync(resolve(root, "supabase/seed.sql"), seedSql);

console.log(`reference data: ${locations.length} locations, ${AMENITIES.length} amenities`);
console.log(`external sites: ${externalSites.length} sites, ${externalLinks.length} links`);
console.log(`demo seed: ${properties.length} properties, ${listings.length} listings`);
