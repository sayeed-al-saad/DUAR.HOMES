import { Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthNotConfigured } from "@/components/auth/auth-shell";
import { ListingForm } from "@/components/listing-form/listing-form";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { getAmenities, getLocationBySlug, getPopularLocations } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { bn } from "@/lib/i18n/bn";
import { EDITABLE_STATUSES, getListingForEdit } from "@/lib/listings/server";

const t = bn.editListing;

export const metadata: Metadata = { title: t.title, robots: { index: false } };

export default function EditListingPage({ params }: PageProps<"/account/listings/[id]/edit">) {
  return (
    <div className="page-shell py-8 lg:py-12">
      <div className="max-w-3xl">
        <Link href="/account/listings" className="text-sm text-slate hover:text-ink hover:underline">
          ← {t.back}
        </Link>
        <h1 className="mt-3 text-3xl lg:text-4xl">{t.title}</h1>
        <div className="mt-6">
          {isSupabaseConfigured ? (
            <Suspense fallback={<Skeleton className="h-[40rem] rounded-2xl" />}>
              <EditForm params={params} />
            </Suspense>
          ) : (
            <AuthNotConfigured />
          )}
        </div>
      </div>
    </div>
  );
}

async function EditForm({ params }: Pick<PageProps<"/account/listings/[id]/edit">, "params">) {
  const { id } = await params;
  const user = await requireUser(`/account/listings/${id}/edit`);
  const listing = await getListingForEdit(user, id);

  if (!listing) {
    return <Alert variant="error">{t.notFound}</Alert>;
  }
  if (!(EDITABLE_STATUSES as readonly string[]).includes(listing.status)) {
    return (
      <Alert variant="notice">
        <AlertTitle>{t.closedTitle}</AlertTitle>
        <p className="mt-1">{t.closed}</p>
      </Alert>
    );
  }

  const [popularLocations, amenities, location] = await Promise.all([
    getPopularLocations(8),
    getAmenities(),
    listing.locationSlug ? getLocationBySlug(listing.locationSlug) : Promise.resolve(null),
  ]);

  return (
    <>
      <div className="mb-6 rounded-2xl bg-cloud p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Info aria-hidden className="size-5 text-indigo" />
          {t.rulesTitle}
        </h2>
        <ul className="mt-2 list-disc space-y-1 ps-6 text-sm">
          {t.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>
      <ListingForm
        popularLocations={popularLocations}
        amenities={amenities}
        defaultName={user.displayName ?? ""}
        edit={{ listingId: listing.id, status: listing.status, values: listing.values, location, photos: listing.photos }}
      />
    </>
  );
}
