/**
 * Shared domain vocabulary.
 *
 * These unions mirror the PostgreSQL enums in
 * supabase/migrations/20261008000100_extensions_and_enums.sql.
 * Keep the two in sync when adding a value.
 */

export const PURPOSES = ["sale", "rent"] as const;
export type Purpose = (typeof PURPOSES)[number];

export const PROPERTY_TYPES = [
  "apartment",
  "house",
  "duplex",
  "room",
  "plot",
  "land",
  "office",
  "shop",
  "commercial_space",
  "warehouse",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_CATEGORIES = ["residential", "land", "commercial"] as const;
export type PropertyCategory = (typeof PROPERTY_CATEGORIES)[number];

export const LISTING_ORIGINS = ["first_party", "external"] as const;
export type ListingOrigin = (typeof LISTING_ORIGINS)[number];

export const LISTER_TYPES = ["owner", "agent", "agency", "developer", "unknown"] as const;
export type ListerType = (typeof LISTER_TYPES)[number];

export const LISTING_STATUSES = [
  "draft",
  "pending_review",
  "active",
  "stale",
  "sold",
  "rented",
  "rejected",
  "archived",
  "removed",
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/** Statuses anyone may see. Sold and rented stay visible so we never imply availability. */
export const PUBLIC_LISTING_STATUSES: readonly ListingStatus[] = ["active", "stale", "sold", "rented"];

/** Why a visitor reports a listing. Matches the report_reason enum in the database. */
export const REPORT_REASONS = ["fraud", "wrong_information", "sold_or_rented", "duplicate", "offensive", "copyright", "privacy", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const FURNISHING_LEVELS = ["unfurnished", "semi_furnished", "furnished"] as const;
export type Furnishing = (typeof FURNISHING_LEVELS)[number];

export const LOCATION_TYPES = ["division", "district", "city", "upazila", "thana", "area"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const LOCATION_PRECISIONS = ["exact", "approximate", "area_only"] as const;
export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number];

export const USER_ROLES = ["member", "owner", "agent", "developer", "moderator", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SOURCE_TYPES = [
  "first_party",
  "portal",
  "classifieds",
  "agency_site",
  "developer_site",
  "other",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const INGESTION_METHODS = [
  "manual",
  "csv_import",
  "api",
  "rss_feed",
  "partner_feed",
  "public_page",
] as const;
export type IngestionMethod = (typeof INGESTION_METHODS)[number];

export const PERMISSION_STATUSES = [
  "not_required",
  "not_requested",
  "requested",
  "granted",
  "denied",
  "revoked",
] as const;
export type PermissionStatus = (typeof PERMISSION_STATUSES)[number];

export const FRESHNESS_LEVELS = ["new", "recently_verified", "old", "likely_inactive"] as const;
export type Freshness = (typeof FRESHNESS_LEVELS)[number];

const CATEGORY_BY_TYPE: Record<PropertyType, PropertyCategory> = {
  apartment: "residential",
  house: "residential",
  duplex: "residential",
  room: "residential",
  plot: "land",
  land: "land",
  office: "commercial",
  shop: "commercial",
  commercial_space: "commercial",
  warehouse: "commercial",
};

/** Same mapping as the generated `properties.category` column. */
export function categoryOf(type: PropertyType): PropertyCategory {
  return CATEGORY_BY_TYPE[type];
}

export function typesInCategory(category: PropertyCategory): PropertyType[] {
  return PROPERTY_TYPES.filter((type) => CATEGORY_BY_TYPE[type] === category);
}
