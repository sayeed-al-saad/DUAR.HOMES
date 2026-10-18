import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthNotConfigured } from "@/components/auth/auth-shell";
import { ReviewActions } from "@/components/listing-form/review-actions";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { formatDateBn, formatNumberBn, formatPriceBn, toBnDigits } from "@/lib/format/bn";
import { bn, LISTER_TYPE_LABEL, PROPERTY_TYPE_LABEL, PURPOSE_LABEL } from "@/lib/i18n/bn";
import { getPendingListings } from "@/lib/listings/server";

export const metadata: Metadata = { title: bn.review.title, robots: { index: false, follow: false } };

export default function ReviewPage() {
  return (
    <div className="page-shell py-8 lg:py-12">
      <h1 className="text-3xl lg:text-4xl">{bn.review.title}</h1>
      <p className="mt-2 max-w-3xl text-slate">{bn.review.intro}</p>
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

function fact(label: string, value: unknown) {
  return value === null || value === undefined || value === "" ? null : (
    <div key={label}>
      <dt className="text-xs text-slate">{label}</dt>
      <dd className="font-bold">{typeof value === "number" ? formatNumberBn(value) : String(value)}</dd>
    </div>
  );
}

async function Queue() {
  await requireRole(["moderator", "admin"], "/admin/listings");
  const pending = await getPendingListings();

  return (
    <>
      <Alert className="mb-5 max-w-3xl">{bn.review.checklist}</Alert>
      {pending.length === 0 ? (
        <p className="rounded-2xl bg-cloud px-5 py-8">{bn.review.empty}</p>
      ) : (
        <ul className="space-y-4">
          {pending.map((listing) => (
            <li key={listing.id} className="rounded-2xl border border-line p-4 sm:p-6">
              <p className="text-xs text-slate">
                {PROPERTY_TYPE_LABEL[listing.propertyType]} {PURPOSE_LABEL[listing.purpose]} ·{" "}
                {listing.parentLocationNameBn ? `${listing.locationNameBn}, ${listing.parentLocationNameBn}` : listing.locationNameBn} ·{" "}
                {formatDateBn(listing.submittedAt)}
              </p>
              <h2 className="mt-1 text-xl">{listing.title}</h2>
              <p className="text-lg font-bold">{formatPriceBn(listing.price)}</p>

              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {fact(bn.listingPage.size, listing.facts.size_sqft === null ? null : Number(listing.facts.size_sqft))}
                {fact(bn.listingPage.land, listing.facts.land_size_katha === null ? null : Number(listing.facts.land_size_katha))}
                {fact(bn.listingPage.bedrooms, listing.facts.bedrooms === null ? null : Number(listing.facts.bedrooms))}
                {fact(bn.listingPage.bathrooms, listing.facts.bathrooms === null ? null : Number(listing.facts.bathrooms))}
                {fact(bn.review.lister, LISTER_TYPE_LABEL[listing.listerType])}
                {fact(bn.review.contactName, listing.contactName)}
                {fact(bn.review.phone, listing.phone)}
                {fact(bn.review.address, listing.addressLine)}
              </dl>

              {listing.description ? <p className="mt-3 max-w-prose whitespace-pre-line text-sm">{listing.description}</p> : null}

              <div className="mt-3">
                {listing.photos.length > 0 ? (
                  <>
                    <p className="text-xs text-slate">{bn.review.photos(toBnDigits(listing.photos.length))}</p>
                    <ul className="mt-1 flex flex-wrap gap-2">
                      {listing.photos.map((url) => (
                        <li key={url}>
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element -- staff-only thumbnails */}
                            <img src={url} alt="" className="h-20 w-28 rounded-lg object-cover" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-xs text-slate">{bn.review.noPhotos}</p>
                )}
              </div>

              <div className="mt-4">
                <ReviewActions listingId={listing.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
