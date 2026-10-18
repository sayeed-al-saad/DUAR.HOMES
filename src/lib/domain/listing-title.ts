import { formatNumberBn, toBnDigits } from "@/lib/format/bn";
import { PROPERTY_TYPE_LABEL } from "@/lib/i18n/bn";
import type { PropertyType, Purpose } from "./types";

export interface TitleFacts {
  propertyType: PropertyType;
  purpose: Purpose;
  bedrooms?: number | null;
  sizeSqft?: number | null;
  landSizeKatha?: number | null;
}

/**
 * Builds a short factual Bangla title from the property's facts.
 *
 * External listings always get a title made this way, so we never copy the
 * wording of someone else's listing.
 */
export function buildListingTitle(facts: TitleFacts): string {
  const typeLabel = PROPERTY_TYPE_LABEL[facts.propertyType];

  switch (facts.propertyType) {
    case "apartment":
    case "house":
    case "duplex":
      return facts.bedrooms ? `${toBnDigits(facts.bedrooms)} বেডের ${typeLabel}` : typeLabel;
    case "room":
      return "এক রুমের সাবলেট";
    case "plot":
    case "land":
      return facts.landSizeKatha ? `${formatNumberBn(facts.landSizeKatha, 2)} কাঠা ${typeLabel}` : typeLabel;
    default:
      return facts.sizeSqft ? `${formatNumberBn(facts.sizeSqft)} বর্গফুটের ${typeLabel}` : typeLabel;
  }
}

const TYPE_SLUG: Record<PropertyType, string> = {
  apartment: "apartment",
  house: "house",
  duplex: "duplex",
  room: "room",
  plot: "plot",
  land: "land",
  office: "office",
  shop: "shop",
  commercial_space: "commercial-space",
  warehouse: "warehouse",
};

/**
 * English, search-friendly slug such as "3-bedroom-apartment-for-sale-k7q2".
 * The suffix keeps slugs unique when two listings share the same facts.
 */
export function buildListingSlug(facts: TitleFacts, uniqueSuffix: string): string {
  const parts: string[] = [];
  if (facts.bedrooms && ["apartment", "house", "duplex"].includes(facts.propertyType)) {
    parts.push(`${facts.bedrooms}-bedroom`);
  }
  if (facts.landSizeKatha && ["plot", "land"].includes(facts.propertyType)) {
    parts.push(`${String(facts.landSizeKatha).replace(".", "-")}-katha`);
  }
  parts.push(TYPE_SLUG[facts.propertyType]);
  parts.push(facts.purpose === "sale" ? "for-sale" : "for-rent");
  parts.push(uniqueSuffix.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  return parts.join("-");
}
