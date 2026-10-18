import { daysBetween } from "@/lib/format/bn";
import type { Freshness, ListingStatus } from "./types";

/**
 * Freshness says how recently we confirmed a listing still exists at its
 * source. It never says a property is available: only the lister knows that.
 *
 * Thresholds live here so the ingestion work in Phase 5 can tune them in one
 * place.
 */
export const FRESHNESS_RULES = {
  /** First seen within this many days counts as new. */
  newWithinDays: 7,
  /** Checked within this many days counts as recently verified. */
  verifiedWithinDays: 14,
  /** Not checked for longer than this is treated as probably gone. */
  inactiveAfterDays: 45,
} as const;

export interface FreshnessInput {
  status: ListingStatus;
  firstSeenAt: string | Date;
  lastCheckedAt: string | Date;
}

export function getFreshness(listing: FreshnessInput, now: Date = new Date()): Freshness {
  if (listing.status === "stale") return "likely_inactive";

  const daysSinceCheck = daysBetween(listing.lastCheckedAt, now);
  if (daysSinceCheck > FRESHNESS_RULES.inactiveAfterDays) return "likely_inactive";
  if (daysSinceCheck > FRESHNESS_RULES.verifiedWithinDays) return "old";

  const daysSinceFirstSeen = daysBetween(listing.firstSeenAt, now);
  if (daysSinceFirstSeen <= FRESHNESS_RULES.newWithinDays) return "new";

  return "recently_verified";
}
