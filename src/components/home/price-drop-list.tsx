import { ExternalLink, MapPin, TrendingDown } from "lucide-react";
import Link from "next/link";
import { locationLine } from "@/components/listings/listing-card";
import { Badge } from "@/components/ui/badge";
import type { ListingCard } from "@/lib/data/types";
import { listingPath } from "@/lib/domain/urls";
import { daysBetween, formatDaysAgoBn, formatPercentBn, formatPriceBn } from "@/lib/format/bn";
import { bn, PROPERTY_TYPE_LABEL, PURPOSE_LABEL } from "@/lib/i18n/bn";

/**
 * Price drops read as before-and-after figures, so they get their own compact
 * layout instead of the photo card: the two prices are the point.
 */
export function PriceDropList({ listings, now }: { listings: ListingCard[]; now: Date }) {
  if (listings.length === 0) {
    return <p className="rounded-xl bg-background px-4 py-6 text-slate">{bn.home.emptyRail}</p>;
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
      {listings.map((listing) => (
        <li key={listing.id}>
          <article className="relative flex h-full flex-col rounded-2xl border border-line bg-background p-4 hover:border-indigo/50">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="flame">
                <TrendingDown aria-hidden />
                {bn.listing.priceDropped(formatPercentBn(listing.priceDropPercent ?? 0))}
              </Badge>
              {listing.priceChangedAt ? (
                <span className="text-xs text-slate">{formatDaysAgoBn(daysBetween(listing.priceChangedAt, now))}</span>
              ) : null}
            </div>

            <p className="mt-3 flex flex-wrap items-baseline gap-x-2.5">
              <span className="text-2xl leading-tight font-bold text-ink">
                {formatPriceBn(listing.price)}
                {listing.purpose === "rent" ? (
                  <span className="ml-1 text-sm font-normal text-slate">/{bn.listing.perMonth}</span>
                ) : null}
              </span>
              {listing.previousPrice ? (
                <s className="text-sm text-slate">{bn.listing.priceBefore(formatPriceBn(listing.previousPrice))}</s>
              ) : null}
            </p>

            <h3 className="mt-2 text-base leading-snug font-bold">
              <Link href={listingPath(listing)} className="rounded-sm after:absolute after:inset-0 after:rounded-2xl">
                {listing.title}
              </Link>
            </h3>

            <p className="mt-1 flex items-center gap-1 text-sm text-slate">
              <MapPin aria-hidden className="size-4 shrink-0" />
              <span className="truncate">
                {locationLine(listing)}
                <span className="mx-1.5 text-line" aria-hidden>
                  |
                </span>
                {PROPERTY_TYPE_LABEL[listing.propertyType]} {PURPOSE_LABEL[listing.purpose]}
              </span>
            </p>

            <div className="mt-auto flex items-center justify-between gap-3 pt-3 text-xs">
              <p className="truncate text-slate">{bn.listing.source(listing.sourceName)}</p>
              {listing.origin === "external" && listing.sourceUrl ? (
                <a
                  href={listing.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="relative z-10 flex shrink-0 items-center gap-1 rounded-sm font-bold text-indigo-deep underline underline-offset-2"
                >
                  {bn.listing.viewOriginal}
                  <ExternalLink aria-hidden className="size-3.5" />
                </a>
              ) : null}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
