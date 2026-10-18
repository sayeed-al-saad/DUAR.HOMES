import { Badge } from "@/components/ui/badge";
import type { Freshness } from "@/lib/domain/types";
import { formatDaysAgoBn } from "@/lib/format/bn";
import { bn, FRESHNESS_LABEL } from "@/lib/i18n/bn";

const VARIANT: Record<Freshness, "soft" | "neutral" | "amber" | "outline"> = {
  new: "soft",
  recently_verified: "neutral",
  old: "amber",
  likely_inactive: "outline",
};

/**
 * How recently we confirmed the listing at its source. The wording is about
 * checking, never about availability.
 */
export function FreshnessBadge({ freshness, daysSinceCheck }: { freshness: Freshness; daysSinceCheck: number }) {
  return (
    <Badge variant={VARIANT[freshness]} title={bn.listing.checked(formatDaysAgoBn(daysSinceCheck))}>
      {FRESHNESS_LABEL[freshness]}
    </Badge>
  );
}
