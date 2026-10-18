import { ListingCard } from "@/components/listings/listing-card";
import type { ListingCard as ListingCardData } from "@/lib/data/types";

/** Results laid out as a grid: one column on phones, up to four on wide screens. */
export function ListingGrid({ listings, now, eagerCount = 0 }: { listings: ListingCardData[]; now: Date; eagerCount?: number }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {listings.map((listing, index) => (
        <li key={listing.id} className="min-w-0">
          <ListingCard listing={listing} now={now} eager={index < eagerCount} />
        </li>
      ))}
    </ul>
  );
}
