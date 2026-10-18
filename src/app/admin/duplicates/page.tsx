import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DuplicateDecisionButtons, FindDuplicatesButton } from "@/components/admin/duplicate-actions";
import { AuthNotConfigured } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/session";
import { listingPath } from "@/lib/domain/urls";
import { isSupabaseConfigured } from "@/lib/env";
import { formatDateBn, formatPercentBn, formatPriceBn, toBnDigits } from "@/lib/format/bn";
import { formatKathaBn, formatSqftBn } from "@/lib/format/units";
import { bn, PROPERTY_TYPE_LABEL, PURPOSE_LABEL } from "@/lib/i18n/bn";
import { getDuplicatePairs, type DuplicatePair, type DuplicateSide } from "@/lib/listings/duplicates";

export const metadata: Metadata = { title: bn.duplicates.title, robots: { index: false, follow: false } };

export default function DuplicatesPage() {
  return (
    <div className="page-shell py-8 lg:py-12">
      <h1 className="text-3xl lg:text-4xl">{bn.duplicates.title}</h1>
      <p className="mt-2 max-w-3xl text-slate">{bn.duplicates.intro}</p>
      <div className="mt-6">
        {isSupabaseConfigured ? (
          <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
            <Queue />
          </Suspense>
        ) : (
          <AuthNotConfigured />
        )}
      </div>
    </div>
  );
}

function Side({ listing, pair }: { listing: DuplicateSide; pair: DuplicatePair }) {
  return (
    <div className="min-w-0 rounded-xl bg-cloud p-4">
      <p className="text-xs text-slate">{listing.origin === "first_party" ? bn.listingPage.otherOnSite : listing.sourceName}</p>
      <p className="mt-0.5 font-bold">
        <Link href={listingPath({ slug: listing.slug, locationSlug: pair.locationSlug })} className="underline underline-offset-4">
          {listing.title}
        </Link>
      </p>
      <p className="mt-1 font-bold tabular-nums">
        {formatPriceBn(listing.price)}
        {pair.purpose === "rent" ? `/${bn.listing.perMonth}` : ""}
      </p>
      <p className="text-sm">
        {listing.sizeSqft ? formatSqftBn(listing.sizeSqft) : listing.landSizeKatha ? formatKathaBn(listing.landSizeKatha) : null}
      </p>
      <p className="mt-1 text-xs text-slate">{bn.listingPage.firstSeen(formatDateBn(listing.firstSeenAt))}</p>
      {listing.sourceUrl ? (
        <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-primary underline underline-offset-4">
          {bn.listing.viewOriginal}
          <ExternalLink aria-hidden className="size-3.5" />
        </a>
      ) : null}
    </div>
  );
}

async function Queue() {
  await requireRole(["moderator", "admin"], "/admin/duplicates");
  const pairs = await getDuplicatePairs();

  return (
    <>
      <FindDuplicatesButton />
      <Alert className="mt-5 max-w-3xl">{bn.duplicates.checklist}</Alert>
      {pairs.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-cloud px-5 py-8">{bn.duplicates.empty}</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {pairs.map((pair) => {
            const place = pair.parentLocationNameBn ? `${pair.locationNameBn}, ${pair.parentLocationNameBn}` : pair.locationNameBn;
            const signals = [
              pair.signals.sizeDiffPercent !== undefined ? bn.duplicates.sizeDiff(formatPercentBn(pair.signals.sizeDiffPercent)) : null,
              pair.signals.kathaDiffPercent !== undefined ? bn.duplicates.sizeDiff(formatPercentBn(pair.signals.kathaDiffPercent)) : null,
              pair.signals.priceDiffPercent !== undefined ? bn.duplicates.priceDiff(formatPercentBn(pair.signals.priceDiffPercent)) : null,
              pair.signals.sameFloor ? bn.duplicates.sameFloor : null,
              pair.signals.sameSource ? bn.duplicates.sameSource : null,
            ].filter(Boolean);
            return (
              <li key={pair.id} className="rounded-2xl border border-line p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="soft">{bn.duplicates.confidence(formatPercentBn(pair.confidence, 0))}</Badge>
                  {pair.status === "review_later" ? <Badge variant="outline">{bn.duplicates.laterTag}</Badge> : null}
                  <p className="text-sm">
                    {PROPERTY_TYPE_LABEL[pair.propertyType]} {PURPOSE_LABEL[pair.purpose]}
                    {pair.bedrooms ? ` · ${bn.listing.beds(toBnDigits(pair.bedrooms))}` : ""} · {place}
                  </p>
                </div>
                <p className="mt-1 text-xs text-slate">{signals.join(" · ")}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Side listing={pair.a} pair={pair} />
                  <Side listing={pair.b} pair={pair} />
                </div>
                <div className="mt-4">
                  <DuplicateDecisionButtons pairId={pair.id} canLater={pair.status === "pending"} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
