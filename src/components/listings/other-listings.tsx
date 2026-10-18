import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ListingCard, ListingDetail } from "@/lib/data/types";
import { getFreshness } from "@/lib/domain/freshness";
import { listingPath } from "@/lib/domain/urls";
import { daysBetween, formatPriceBn, toBnDigits } from "@/lib/format/bn";
import { bn, LISTER_TYPE_LABEL } from "@/lib/i18n/bn";
import { FreshnessBadge } from "./freshness-badge";

function sourceLabel(listing: ListingCard): string {
  if (listing.origin === "first_party") {
    const who = listing.listerType !== "unknown" ? ` (${LISTER_TYPE_LABEL[listing.listerType]})` : "";
    return `${bn.listingPage.otherOnSite}${who}`;
  }
  return listing.sourceName;
}

/**
 * "One property, one card": every listing of this property side by side, with
 * its price and where it is from. External ones link to the original.
 */
export function OtherListings({ listing, others, now }: { listing: ListingDetail; others: ListingCard[]; now: Date }) {
  if (others.length === 0) return null;
  const all = [listing, ...others];
  const lowest = Math.min(...all.map((entry) => entry.price));

  return (
    <section aria-labelledby="other-listings-title" className="mt-8">
      <h2 id="other-listings-title" className="text-xl">
        {bn.listingPage.otherTitle}
      </h2>
      <p className="mt-1 text-sm text-slate">{bn.listingPage.otherIntro(toBnDigits(others.length))}</p>
      <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
        {all.map((entry) => {
          const isThis = entry.id === listing.id;
          return (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0">
                <p className="font-bold">{sourceLabel(entry)}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-bold tabular-nums">
                    {formatPriceBn(entry.price)}
                    {entry.purpose === "rent" ? `/${bn.listing.perMonth}` : ""}
                  </span>
                  {entry.price === lowest && all.some((other) => other.price !== lowest) ? (
                    <span className="rounded-full bg-indigo-soft px-2 py-0.5 text-xs font-bold text-indigo-deep">{bn.listingPage.otherLowest}</span>
                  ) : null}
                  <FreshnessBadge freshness={getFreshness(entry, now)} daysSinceCheck={daysBetween(entry.lastCheckedAt, now)} />
                </p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {isThis ? (
                  <span className="text-slate">{bn.listingPage.otherHere}</span>
                ) : (
                  <Link href={listingPath(entry)} className="font-bold text-primary underline underline-offset-4">
                    {bn.listingPage.otherDetails}
                  </Link>
                )}
                {entry.origin === "external" && entry.sourceUrl ? (
                  <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-bold text-primary underline underline-offset-4">
                    {bn.listing.viewOriginal}
                    <ExternalLink aria-hidden className="size-3.5" />
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
