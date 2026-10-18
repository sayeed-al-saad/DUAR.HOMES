import { ListingCard } from "@/components/listings/listing-card";
import type { ListingCard as ListingCardData } from "@/lib/data/types";
import { bn } from "@/lib/i18n/bn";

interface ListingRailProps {
  listings: ListingCardData[];
  now: Date;
  /** How many leading images to load immediately (only for the first rail on the page). */
  eagerCount?: number;
}

/** Swipeable row on phones, grid on larger screens. Layout lives in globals.css (.listing-rail). */
export function ListingRail({ listings, now, eagerCount = 0 }: ListingRailProps) {
  if (listings.length === 0) {
    return <p className="rounded-xl bg-cloud px-4 py-6 text-slate">{bn.home.emptyRail}</p>;
  }

  return (
    <ul className="listing-rail">
      {listings.map((listing, index) => (
        <li key={listing.id} className="min-w-0">
          <ListingCard listing={listing} now={now} eager={index < eagerCount} />
        </li>
      ))}
    </ul>
  );
}
