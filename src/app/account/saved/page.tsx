import { BellRing, TrendingDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthNotConfigured } from "@/components/auth/auth-shell";
import { MarkReadButton } from "@/components/saved/mark-read-button";
import { UnsaveButton } from "@/components/saved/unsave-button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { listingPath } from "@/lib/domain/urls";
import { isSupabaseConfigured } from "@/lib/env";
import { formatDateBn, formatPriceBn, toBnDigits } from "@/lib/format/bn";
import { bn } from "@/lib/i18n/bn";
import { getPriceAlerts, getSavedListings } from "@/lib/saved/server";

export const metadata: Metadata = { title: bn.saved.title, robots: { index: false } };

export default function SavedPage() {
  return (
    <div className="page-shell py-8 lg:py-12">
      <div className="max-w-3xl">
        <h1 className="text-3xl lg:text-4xl">{bn.saved.title}</h1>
        <p className="mt-2 text-slate">{bn.saved.intro}</p>
        <div className="mt-6">
          {isSupabaseConfigured ? (
            <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
              <SavedBody />
            </Suspense>
          ) : (
            <AuthNotConfigured />
          )}
        </div>
      </div>
    </div>
  );
}

const perMonth = (purpose: string) => (purpose === "rent" ? `/${bn.listing.perMonth}` : "");

async function SavedBody() {
  await requireUser("/account/saved");
  const [alerts, saved] = await Promise.all([getPriceAlerts(), getSavedListings()]);
  const unread = alerts.filter((alert) => !alert.read).length;

  return (
    <>
      <section aria-labelledby="alerts-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="alerts-title" className="flex items-center gap-2 text-2xl">
            <BellRing aria-hidden className="size-6 text-flame" />
            {bn.saved.alertsTitle}
            {unread > 0 ? <Badge variant="flame">{bn.saved.newCount(toBnDigits(unread))}</Badge> : null}
          </h2>
          {unread > 0 ? <MarkReadButton /> : null}
        </div>
        {alerts.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-cloud px-5 py-6">{bn.saved.noAlerts}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {alerts.map((alert) => (
              <li key={alert.id} className={alert.read ? "px-4 py-3" : "bg-flame-soft px-4 py-3"}>
                <p className="flex flex-wrap items-center gap-2 font-bold">
                  <TrendingDown aria-hidden className="size-4 text-flame-deep" />
                  <Link href={listingPath(alert)} className="underline underline-offset-4">
                    {bn.saved.dropped(alert.title)}
                  </Link>
                  {!alert.read ? <span className="text-xs text-flame-deep">{bn.saved.unread}</span> : null}
                </p>
                <p className="mt-0.5 text-sm">
                  <span className="tabular-nums">
                    {bn.saved.droppedFromTo(formatPriceBn(alert.oldPrice), formatPriceBn(alert.newPrice) + perMonth(alert.purpose))}
                  </span>
                  {alert.origin === "external" ? ` · ${bn.saved.onSource(alert.sourceName)}` : ""} · {formatDateBn(alert.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate">{bn.saved.emailNote}</p>
      </section>

      <section aria-labelledby="saved-title" className="mt-10">
        <h2 id="saved-title" className="text-2xl">
          {bn.saved.listTitle}
        </h2>
        {saved.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-cloud px-5 py-6">{bn.saved.empty}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {saved.map((listing) => {
              const change = listing.savedPrice === null ? 0 : listing.price - listing.savedPrice;
              const place = listing.parentLocationNameBn ? `${listing.locationNameBn}, ${listing.parentLocationNameBn}` : listing.locationNameBn;
              return (
                <li key={listing.id} className="rounded-2xl border border-line p-4 sm:p-5">
                  <p className="text-xs text-slate">
                    {place} · {listing.sourceName}
                  </p>
                  <h3 className="mt-0.5 text-lg leading-snug">
                    {listing.status === "active" ? (
                      <Link href={listingPath(listing)} className="underline-offset-4 hover:underline">
                        {listing.title}
                      </Link>
                    ) : (
                      listing.title
                    )}
                  </h3>
                  <p className="font-bold tabular-nums">
                    {formatPriceBn(listing.price)}
                    {perMonth(listing.purpose)}
                  </p>
                  <p className="mt-1 text-sm">
                    {change < 0 ? (
                      <span className="font-bold text-flame-deep">{bn.saved.downSince(formatPriceBn(-change))}</span>
                    ) : change > 0 ? (
                      <span className="text-slate">{bn.saved.upSince(formatPriceBn(change))}</span>
                    ) : listing.savedPrice !== null ? (
                      <span className="text-slate">{bn.saved.savedAt(formatPriceBn(listing.savedPrice))}</span>
                    ) : null}
                    {listing.alsoListedCount > 0 && listing.groupMinPrice !== null && listing.groupMinPrice < listing.price ? (
                      <span className="block text-indigo-deep">
                        {bn.listing.alsoListedFrom(toBnDigits(listing.alsoListedCount), formatPriceBn(listing.groupMinPrice))}
                      </span>
                    ) : null}
                  </p>
                  {listing.status !== "active" ? <p className="mt-1 text-sm text-slate">{bn.saved.notActive}</p> : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <UnsaveButton listingId={listing.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
