import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthNotConfigured } from "@/components/auth/auth-shell";
import { OwnListingActions } from "@/components/listing-form/own-listing-actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { listingPath } from "@/lib/domain/urls";
import { isSupabaseConfigured } from "@/lib/env";
import { formatDateBn, formatPriceBn } from "@/lib/format/bn";
import { bn, LISTING_STATUS_LABEL, PROPERTY_TYPE_LABEL, PURPOSE_LABEL } from "@/lib/i18n/bn";
import { getMyListings } from "@/lib/listings/server";

export const metadata: Metadata = { title: bn.myListings.title, robots: { index: false } };

const STATUS_VARIANT = {
  pending_review: "amber",
  active: "soft",
  rejected: "flame",
  sold: "neutral",
  rented: "neutral",
  archived: "outline",
} as const;

export default function MyListingsPage({ searchParams }: PageProps<"/account/listings">) {
  return (
    <div className="page-shell py-8 lg:py-12">
      <div className="max-w-3xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl lg:text-4xl">{bn.myListings.title}</h1>
          <Button asChild variant="flame">
            <Link href="/list-property">{bn.myListings.newListing}</Link>
          </Button>
        </div>
        <div className="mt-6">
          {isSupabaseConfigured ? (
            <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
              <OwnListings searchParams={searchParams} />
            </Suspense>
          ) : (
            <AuthNotConfigured />
          )}
        </div>
      </div>
    </div>
  );
}

async function OwnListings({ searchParams }: Pick<PageProps<"/account/listings">, "searchParams">) {
  const user = await requireUser("/account/listings");
  const [{ submitted }, listings] = await Promise.all([searchParams, getMyListings(user)]);

  return (
    <>
      {submitted === "1" || submitted === "photos" ? (
        <Alert variant={submitted === "1" ? "success" : "notice"} role="status" className="mb-5">
          {submitted === "1" ? bn.myListings.submitted : bn.myListings.submittedPhotosFailed}
        </Alert>
      ) : null}

      {listings.length === 0 ? (
        <p className="rounded-2xl bg-cloud px-5 py-8">{bn.myListings.empty}</p>
      ) : (
        <ul className="space-y-3">
          {listings.map((listing) => {
            const status = listing.status as keyof typeof STATUS_VARIANT;
            return (
              <li key={listing.id} className="rounded-2xl border border-line p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-slate">
                      {PROPERTY_TYPE_LABEL[listing.propertyType]} {PURPOSE_LABEL[listing.purpose]} ·{" "}
                      {listing.parentLocationNameBn ? `${listing.locationNameBn}, ${listing.parentLocationNameBn}` : listing.locationNameBn}
                    </p>
                    <h2 className="mt-0.5 text-lg leading-snug">{listing.title}</h2>
                    <p className="font-bold">{formatPriceBn(listing.price)}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{LISTING_STATUS_LABEL[listing.status]}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate">
                  {bn.myListings.statusHelp[status] ?? ""} {bn.myListings.submittedOn(formatDateBn(listing.submittedAt))}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {listing.status === "active" ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={listingPath(listing)}>{bn.myListings.view}</Link>
                    </Button>
                  ) : null}
                  <OwnListingActions listingId={listing.id} status={listing.status} purpose={listing.purpose} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
