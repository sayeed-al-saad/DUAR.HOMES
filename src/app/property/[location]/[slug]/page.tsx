import { BadgeCheck, ExternalLink, MapPin, TrendingDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { DemoBanner } from "@/components/layout/demo-banner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { locationLine } from "@/components/listings/listing-card";
import { ListingGrid } from "@/components/listings/listing-grid";
import { OtherListings } from "@/components/listings/other-listings";
import { ContactSafety, ContactSlot, ContactSlotFallback } from "@/components/contact/contact-slot";
import { SaveSlot, SaveSlotFallback } from "@/components/saved/save-slot";
import { ListingMedia } from "@/components/listings/listing-media";
import { ListingPrice } from "@/components/listings/listing-price";
import { FreshnessBadge } from "@/components/listings/freshness-badge";
import { JsonLd } from "@/components/seo/json-ld";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getListingBySlug, getOtherListings, getPriceGuide, getSimilarListings, searchListings, type ListingDetail } from "@/lib/data";
import { SIMILAR_LISTINGS } from "@/lib/data/types";
import { areaHeading } from "@/lib/domain/area-pages";
import { getFreshness } from "@/lib/domain/freshness";
import { modeOf, toListingQuery } from "@/lib/domain/listing-query";
import { ABOUT_AVERAGE_PERCENT, compareWithArea } from "@/lib/domain/price-compare";
import { areaPath, listingPath } from "@/lib/domain/urls";
import { daysBetween, formatDateBn, formatPercentBn, formatPriceBn, inLocationBn, toBnDigits } from "@/lib/format/bn";
import { formatKathaBn, formatSqftBn } from "@/lib/format/units";
import { bn, FURNISHING_LABEL, LISTER_TYPE_LABEL, LISTING_STATUS_LABEL, PROPERTY_TYPE_LABEL, PURPOSE_LABEL } from "@/lib/i18n/bn";
import { absoluteUrl, type Crumb } from "@/lib/seo/structured-data";

type Props = PageProps<"/property/[location]/[slug]">;

/** Prerender the newest listing so the route has a shell; every other listing renders on first visit and is then cached. */
export async function generateStaticParams() {
  const { listings } = await searchListings(toListingQuery({}, null));
  const first = listings[0];
  return [first ? { location: first.locationSlug, slug: first.slug } : { location: "dhaka", slug: "none" }];
}

/**
 * Search engines are invited to index only listings made on this site, that are
 * active and real. Listings from other sites already have a page there; demo
 * listings are not real.
 */
function isIndexable(listing: ListingDetail): boolean {
  return listing.origin === "first_party" && listing.status === "active" && !listing.isDemo;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) return { title: bn.errors.notFoundTitle, robots: { index: false } };
  const price = `${formatPriceBn(listing.price)}${listing.purpose === "rent" ? `/${bn.listing.perMonth}` : ""}`;
  const description = `${PROPERTY_TYPE_LABEL[listing.propertyType]} ${PURPOSE_LABEL[listing.purpose]}, ${locationLine(listing)}। ${price}।`;
  return {
    title: `${listing.title}, ${locationLine(listing)}`,
    description,
    alternates: { canonical: listingPath(listing) },
    robots: { index: isIndexable(listing), follow: true },
    openGraph: { title: listing.title, description, type: "website", url: listingPath(listing) },
  };
}

export default function ListingPage({ params }: Props) {
  return (
    <div className="page-shell py-6 lg:py-10">
      <Suspense
        fallback={
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Skeleton className="aspect-[4/3] rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        }
      >
        <ListingBody params={params} />
      </Suspense>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0 sm:block sm:border-b-0 sm:py-0">
      <dt className="text-sm text-slate">{label}</dt>
      <dd className="text-right font-bold sm:mt-0.5 sm:text-left">{value}</dd>
    </div>
  );
}

function factsOf(listing: ListingDetail): Array<[string, string]> {
  const facts: Array<[string, string]> = [
    [bn.listingPage.type, PROPERTY_TYPE_LABEL[listing.propertyType]],
    [bn.listingPage.purpose, PURPOSE_LABEL[listing.purpose]],
  ];
  if (listing.category === "land" && listing.landSizeKatha) facts.push([bn.listingPage.land, formatKathaBn(listing.landSizeKatha)]);
  if (listing.sizeSqft) facts.push([bn.listingPage.size, formatSqftBn(listing.sizeSqft)]);
  if (listing.bedrooms) facts.push([bn.listingPage.bedrooms, toBnDigits(listing.bedrooms)]);
  if (listing.bathrooms) facts.push([bn.listingPage.bathrooms, toBnDigits(listing.bathrooms)]);
  if (listing.balconies) facts.push([bn.listingPage.balconies, toBnDigits(listing.balconies)]);
  if (listing.floorNumber !== null) {
    facts.push([
      bn.listingPage.floor,
      listing.totalFloors
        ? bn.listingPage.floorOf(toBnDigits(listing.floorNumber), toBnDigits(listing.totalFloors))
        : bn.listingPage.floorOnly(toBnDigits(listing.floorNumber)),
    ]);
  }
  if (listing.furnishing) facts.push([bn.listingPage.furnishing, FURNISHING_LABEL[listing.furnishing]]);
  if (listing.parkingSpaces) facts.push([bn.listingPage.parking, bn.listingPage.parkingCount(toBnDigits(listing.parkingSpaces))]);
  return facts;
}

function structuredData(listing: ListingDetail): Record<string, unknown> {
  const residence =
    listing.propertyType === "apartment" || listing.propertyType === "room"
      ? "Apartment"
      : listing.propertyType === "house" || listing.propertyType === "duplex"
        ? "SingleFamilyResidence"
        : "Place";
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: listing.title,
    url: absoluteUrl(listingPath(listing)),
    datePosted: listing.publishedAt ?? listing.firstSeenAt,
    offers: {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: "BDT",
      businessFunction: listing.purpose === "sale" ? "http://purl.org/goodrelations/v1#Sell" : "http://purl.org/goodrelations/v1#LeaseOut",
    },
    about: {
      "@type": residence,
      ...(listing.bedrooms ? { numberOfBedrooms: listing.bedrooms } : {}),
      ...(listing.sizeSqft ? { floorSize: { "@type": "QuantitativeValue", value: listing.sizeSqft, unitCode: "FTK" } } : {}),
      address: { "@type": "PostalAddress", addressLocality: locationLine(listing), addressCountry: "BD" },
    },
  };
}

async function ListingBody({ params }: Pick<Props, "params">) {
  const { location, slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) notFound();
  // The area part of the address is for readers; send old or mistyped ones to the real address.
  if (location !== listing.locationSlug) permanentRedirect(listingPath(listing));

  const [guide, similar, others] = await Promise.all([
    getPriceGuide(),
    getSimilarListings(listing, SIMILAR_LISTINGS),
    listing.status === "active" ? getOtherListings(listing) : Promise.resolve([]),
  ]);
  // One fixed "now", read with the data, so freshness labels match what is cached.
  const now = new Date(listing.generatedAt);
  const comparison = compareWithArea(listing, guide);
  const mode = modeOf(listing);
  const isExternal = listing.origin === "external";
  const facts = factsOf(listing);
  const statusNote =
    listing.status === "sold"
      ? bn.listingPage.statusSold
      : listing.status === "rented"
        ? bn.listingPage.statusRented
        : listing.status === "stale"
          ? bn.listingPage.statusStale
          : null;

  const crumbs: Crumb[] = [{ name: bn.area.home, href: "/" }];
  if (mode && listing.parentLocationSlug && listing.locationType === "area" && listing.parentLocationNameBn) {
    crumbs.push({ name: areaHeading(mode, { nameBn: listing.parentLocationNameBn }), href: areaPath(mode, listing.parentLocationSlug) });
  }
  if (mode) crumbs.push({ name: areaHeading(mode, { nameBn: listing.locationNameBn }), href: areaPath(mode, listing.locationSlug) });
  crumbs.push({ name: listing.title });

  const bands = { small: "১–২", three: "৩", large: "৪+" } as const;

  return (
    <>
      <JsonLd data={structuredData(listing)} />
      {listing.isDemo ? (
        <div className="mb-4 overflow-hidden rounded-xl">
          <DemoBanner />
        </div>
      ) : null}
      <Breadcrumbs crumbs={crumbs} />

      {statusNote ? (
        <Alert variant="notice" className="mt-4">
          <strong>{LISTING_STATUS_LABEL[listing.status]}।</strong> {statusNote}
        </Alert>
      ) : null}

      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
        <div className="min-w-0">
          <ListingMedia
            listing={listing}
            eager
            sizes="(min-width: 1024px) 760px, 100vw"
            // Without a photo, a slim band is enough to say where the photos are.
            className={listing.imageUrl ? "rounded-2xl" : "aspect-[3/1] rounded-2xl sm:aspect-[4/1]"}
          />

          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant="soft">
              {PROPERTY_TYPE_LABEL[listing.propertyType]} {PURPOSE_LABEL[listing.purpose]}
            </Badge>
            {listing.isVerified ? (
              <Badge title={bn.listing.verifiedHint}>
                <BadgeCheck aria-hidden />
                {bn.listing.verified}
              </Badge>
            ) : null}
            {isExternal ? (
              <Badge variant="outline">
                <ExternalLink aria-hidden />
                {bn.listing.externalTag}
              </Badge>
            ) : null}
          </div>

          <h1 className="mt-3 text-3xl leading-tight lg:text-4xl">{listing.title}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-slate">
            <MapPin aria-hidden className="size-4 shrink-0" />
            {locationLine(listing)}
          </p>

          <div className="mt-4">
            <ListingPrice price={listing.price} purpose={listing.purpose} className="text-3xl" />
            {listing.pricePerSqft && listing.purpose === "sale" ? (
              <p className="mt-1 text-sm text-slate">{bn.listingPage.pricePerSqft(formatPriceBn(listing.pricePerSqft))}</p>
            ) : null}
            {listing.priceDropPercent && listing.previousPrice ? (
              <p className="mt-1 flex items-center gap-1 text-sm font-bold text-flame-deep">
                <TrendingDown aria-hidden className="size-4" />
                {bn.listing.priceDropped(formatPercentBn(listing.priceDropPercent))} · {bn.listing.priceBefore(formatPriceBn(listing.previousPrice))}
              </p>
            ) : null}
          </div>

          <OtherListings listing={listing} others={others} now={now} />

          <section aria-labelledby="facts-title" className="mt-8">
            <h2 id="facts-title" className="text-xl">
              {bn.listingPage.facts}
            </h2>
            <dl className="mt-3 grid rounded-2xl border border-line px-4 py-2 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-4 sm:py-4">
              {facts.map(([label, value]) => (
                <Fact key={label} label={label} value={value} />
              ))}
            </dl>
          </section>

          {comparison ? (
            <section aria-labelledby="compare-title" className="mt-8 rounded-2xl bg-cloud p-5">
              <h2 id="compare-title" className="text-xl">
                {bn.listingPage.compareTitle}
              </h2>
              <p className="mt-2 text-lg font-bold">
                {Math.abs(comparison.percent) <= ABOUT_AVERAGE_PERCENT
                  ? bn.listingPage.compareSame
                  : comparison.percent < 0
                    ? bn.listingPage.compareBelow(formatPercentBn(Math.abs(comparison.percent), 0))
                    : bn.listingPage.compareAbove(formatPercentBn(comparison.percent, 0))}
              </p>
              <p className="mt-1 text-sm">
                {comparison.kind === "sale"
                  ? bn.listingPage.compareSaleBasis(inLocationBn(comparison.placeNameBn), formatPriceBn(comparison.average), toBnDigits(comparison.sample))
                  : bn.listingPage.compareRentBasis(
                      inLocationBn(comparison.placeNameBn),
                      bands[comparison.band ?? "small"],
                      formatPriceBn(comparison.average),
                      toBnDigits(comparison.sample),
                    )}
              </p>
              <p className="mt-2 text-xs text-slate">{bn.listingPage.compareNote}</p>
            </section>
          ) : null}

          {listing.amenities.length > 0 ? (
            <section aria-labelledby="amenities-title" className="mt-8">
              <h2 id="amenities-title" className="text-xl">
                {bn.listingPage.amenities}
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {listing.amenities.map((amenity) => (
                  <li key={amenity.slug} className="rounded-full bg-cloud px-3 py-1 text-sm">
                    {amenity.nameBn}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {listing.description ? (
            <section aria-labelledby="description-title" className="mt-8">
              <h2 id="description-title" className="text-xl">
                {bn.listingPage.description}
              </h2>
              <p className="mt-2 max-w-prose whitespace-pre-line">{listing.description}</p>
            </section>
          ) : null}

          {listing.priceHistory.length > 1 ? (
            <section aria-labelledby="history-title" className="mt-8">
              <h2 id="history-title" className="text-xl">
                {bn.listingPage.historyTitle}
              </h2>
              <ol className="mt-3 max-w-md divide-y divide-line rounded-2xl border border-line">
                {[...listing.priceHistory].reverse().map((point, index) => (
                  <li key={`${point.recordedAt}-${index}`} className="flex justify-between gap-4 px-4 py-2.5">
                    <span className="text-sm text-slate">{formatDateBn(point.recordedAt)}</span>
                    <span className="font-bold tabular-nums">{formatPriceBn(point.price)}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>

        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-line p-5">
            <h2 className="text-lg">{bn.listingPage.sourceTitle}</h2>
            <p className="mt-2 text-sm">
              {isExternal
                ? bn.listingPage.externalBody(listing.sourceName)
                : bn.listingPage.firstPartyBody(LISTER_TYPE_LABEL[listing.listerType])}
            </p>
            {isExternal && listing.sourceUrl ? (
              <Button asChild variant="flame" className="mt-4 w-full">
                <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
                  {bn.listing.viewOriginal}
                  <ExternalLink aria-hidden className="size-4" />
                </a>
              </Button>
            ) : listing.status === "active" ? (
              <div className="mt-4">
                <Suspense fallback={<ContactSlotFallback />}>
                  <ContactSlot listingId={listing.id} path={listingPath(listing)} isDemo={listing.isDemo} />
                </Suspense>
                <ContactSafety />
              </div>
            ) : null}

            {listing.status === "active" ? (
              <div className="mt-4">
                <Suspense fallback={<SaveSlotFallback />}>
                  <SaveSlot listingId={listing.id} returnTo={listingPath(listing)} />
                </Suspense>
              </div>
            ) : null}

            <div className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate">{bn.listingPage.lastChecked(formatDateBn(listing.lastCheckedAt))}</span>
                <FreshnessBadge freshness={getFreshness(listing, now)} daysSinceCheck={daysBetween(listing.lastCheckedAt, now)} />
              </div>
              <p className="text-slate">{bn.listingPage.firstSeen(formatDateBn(listing.firstSeenAt))}</p>
              <p className="pt-2 text-xs text-slate">{bn.listingPage.availabilityNote}</p>
            </div>
          </div>
        </aside>
      </div>

      {similar.length > 0 ? (
        <section aria-labelledby="similar-title" className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="similar-title" className="text-2xl">
              {bn.listingPage.similarTitle}
            </h2>
            {mode ? (
              <Link href={areaPath(mode, listing.parentLocationSlug && listing.locationType === "area" ? listing.parentLocationSlug : listing.locationSlug)} className="text-sm font-bold text-primary underline underline-offset-4">
                {bn.home.seeAll}
              </Link>
            ) : null}
          </div>
          <div className="mt-5">
            <ListingGrid listings={similar} now={now} />
          </div>
        </section>
      ) : null}
    </>
  );
}
