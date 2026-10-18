import { BadgeCheck, Bath, BedDouble, ExternalLink, Layers, MapPin, Scaling, TrendingDown } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ListingCard as ListingCardData } from "@/lib/data/types";
import { getFreshness } from "@/lib/domain/freshness";
import { listingPath } from "@/lib/domain/urls";
import { daysBetween, formatPercentBn, formatPriceBn, toBnDigits } from "@/lib/format/bn";
import { formatKathaBn, formatSqftBn } from "@/lib/format/units";
import { bn, LISTER_TYPE_LABEL, PROPERTY_TYPE_LABEL, PURPOSE_LABEL } from "@/lib/i18n/bn";
import { FreshnessBadge } from "./freshness-badge";
import { ListingMedia } from "./listing-media";
import { ListingPrice } from "./listing-price";

interface ListingCardProps {
  listing: ListingCardData;
  /** The moment the data was read. Passed in so cached pages render consistently. */
  now: Date;
  /** Load the image immediately. Set for the first cards on the page only. */
  eager?: boolean;
}

export function locationLine(listing: Pick<ListingCardData, "locationNameBn" | "parentLocationNameBn">): string {
  return listing.parentLocationNameBn ? `${listing.locationNameBn}, ${listing.parentLocationNameBn}` : listing.locationNameBn;
}

/** "সূত্র: দুয়ার (মালিক)" for our own listings, "সূত্র: <site>" for external ones. */
function sourceLine(listing: ListingCardData): string {
  if (listing.origin === "first_party" && listing.listerType !== "unknown") {
    return bn.listing.source(`${listing.sourceName} (${LISTER_TYPE_LABEL[listing.listerType]})`);
  }
  return bn.listing.source(listing.sourceName);
}

export function ListingCard({ listing, now, eager = false }: ListingCardProps) {
  const freshness = getFreshness(listing, now);
  const daysSinceCheck = daysBetween(listing.lastCheckedAt, now);
  const isExternal = listing.origin === "external";

  return (
    <article className="relative flex h-full flex-col rounded-2xl border border-line bg-card p-2.5 hover:border-indigo/50">
      <div className="relative">
        <ListingMedia listing={listing} eager={eager} />
        <Badge variant="onImage" className="absolute top-2 left-2">
          {PROPERTY_TYPE_LABEL[listing.propertyType]} {PURPOSE_LABEL[listing.purpose]}
        </Badge>
        {listing.isVerified ? (
          <Badge className="absolute top-2 right-2" title={bn.listing.verifiedHint}>
            <BadgeCheck aria-hidden />
            {bn.listing.verified}
          </Badge>
        ) : isExternal ? (
          <Badge variant="onImage" className="absolute top-2 right-2" title={bn.listing.externalTag}>
            <ExternalLink aria-hidden />
            {bn.listing.externalChip}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-1.5 pt-3 pb-1">
        <ListingPrice price={listing.price} purpose={listing.purpose} />

        {listing.priceDropPercent ? (
          <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-flame-deep">
            <TrendingDown aria-hidden className="size-3.5" />
            {bn.listing.priceDropped(formatPercentBn(listing.priceDropPercent))}
          </p>
        ) : null}

        {listing.alsoListedCount > 0 ? (
          <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-indigo" title={bn.listing.alsoListedHint}>
            <Layers aria-hidden className="size-3.5 shrink-0" />
            {listing.groupMinPrice !== null && listing.groupMinPrice < listing.price
              ? bn.listing.alsoListedFrom(toBnDigits(listing.alsoListedCount), formatPriceBn(listing.groupMinPrice))
              : bn.listing.alsoListed(toBnDigits(listing.alsoListedCount))}
          </p>
        ) : null}

        <h3 className="mt-1.5 text-base leading-snug font-bold">
          {/* The link stretches over the whole card; other links sit above it. */}
          <Link href={listingPath(listing)} className="line-clamp-2 rounded-sm after:absolute after:inset-0 after:rounded-2xl">
            {listing.title}
          </Link>
        </h3>

        <p className="mt-1 flex items-center gap-1 text-sm text-slate">
          <MapPin aria-hidden className="size-4 shrink-0" />
          <span className="truncate">{locationLine(listing)}</span>
        </p>

        <ul className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-sm text-ink">
          {listing.bedrooms ? (
            <li className="flex items-center gap-1">
              <BedDouble aria-hidden className="size-4 text-slate" />
              {bn.listing.beds(toBnDigits(listing.bedrooms))}
            </li>
          ) : null}
          {listing.bathrooms ? (
            <li className="flex items-center gap-1">
              <Bath aria-hidden className="size-4 text-slate" />
              {bn.listing.baths(toBnDigits(listing.bathrooms))}
            </li>
          ) : null}
          {listing.landSizeKatha && listing.category === "land" ? (
            <li className="flex items-center gap-1">
              <Scaling aria-hidden className="size-4 text-slate" />
              {formatKathaBn(listing.landSizeKatha)}
            </li>
          ) : listing.sizeSqft ? (
            <li className="flex items-center gap-1">
              <Scaling aria-hidden className="size-4 text-slate" />
              {formatSqftBn(listing.sizeSqft)}
            </li>
          ) : null}
        </ul>

        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between gap-2 border-t border-line pt-2.5">
            <p className="truncate text-xs text-slate">{sourceLine(listing)}</p>
            <FreshnessBadge freshness={freshness} daysSinceCheck={daysSinceCheck} />
          </div>

          {isExternal && listing.sourceUrl ? (
            <Button asChild variant="outline" size="sm" className="relative z-10 mt-2.5 w-full">
              <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
                {bn.listing.viewOriginal}
                <ExternalLink aria-hidden className="size-4" />
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
