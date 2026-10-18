import { formatNumberBn } from "./bn";

/**
 * 1 katha = 720 sq ft is the standard used for Dhaka and most city housing
 * projects. Some districts use local katha sizes, so listings store the katha
 * figure the lister gave as well as the converted square feet.
 */
export const SQFT_PER_KATHA = 720;

export function kathaToSqft(katha: number): number {
  return katha * SQFT_PER_KATHA;
}

export function sqftToKatha(sqft: number): number {
  return sqft / SQFT_PER_KATHA;
}

export function formatSqftBn(sqft: number): string {
  return `${formatNumberBn(sqft)} বর্গফুট`;
}

export function formatKathaBn(katha: number): string {
  return `${formatNumberBn(katha, 2)} কাঠা`;
}

/** Price per square foot, or null when it cannot be calculated honestly. */
export function pricePerSqft(price: number, sqft: number | null | undefined): number | null {
  if (!sqft || sqft <= 0 || price <= 0) return null;
  return Math.round(price / sqft);
}
