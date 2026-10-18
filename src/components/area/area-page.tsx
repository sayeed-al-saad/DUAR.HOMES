import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OtherSiteLinks } from "@/components/external/other-site-links";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { DemoBanner } from "@/components/layout/demo-banner";
import { ListingGrid } from "@/components/listings/listing-grid";
import { JsonLd } from "@/components/seo/json-ld";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getAllLocations,
  getAreaModeCounts,
  getExternalSearchLinks,
  getLocationBySlug,
  getPopularLocations,
  getPriceGuide,
  searchListings,
  type LocationSummary,
  type PriceGuideRow,
} from "@/lib/data";
import { MIN_SAMPLE_FOR_AVERAGE } from "@/lib/data/types";
import { areaHeading, areaTitle, countFor, guideFor, hasAreaPage, isIndexable } from "@/lib/domain/area-pages";
import { cityOf, matchExternalLinks } from "@/lib/domain/external-links";
import { modeFilter, toListingQuery } from "@/lib/domain/listing-query";
import { areaPath, listingPath, PRICE_GUIDE_PATH, SEARCH_MODES, searchPath, type SearchMode } from "@/lib/domain/urls";
import { formatNumberBn, formatPriceBn, inLocationBn, ofLocationBn, toBnDigits } from "@/lib/format/bn";
import { bn } from "@/lib/i18n/bn";
import { absoluteUrl, type Crumb } from "@/lib/seo/structured-data";

/**
 * One page per kind of search and place: /rent/uttara, /buy/dhanmondi,
 * /land/purbachal, /commercial/motijheel. These are the pages meant to be found
 * on search engines, so each carries real listings, the area's average prices
 * and links to the places inside it.
 *
 * The four route files under src/app call createAreaPage with their mode.
 */

type AreaProps = { params: Promise<{ location: string }> };

function usable(value: number | null, count: number): value is number {
  return value !== null && count >= MIN_SAMPLE_FOR_AVERAGE;
}

function averageForMeta(mode: SearchMode, row: PriceGuideRow | undefined): string {
  if (!row) return "";
  if (mode === "rent") {
    const all = [
      [row.rentSmall, row.rentSmallCount],
      [row.rentThree, row.rentThreeCount],
      [row.rentLarge, row.rentLargeCount],
    ] as const;
    const best = [...all].sort((a, b) => b[1] - a[1])[0];
    return usable(best[0], best[1]) ? bn.area.avgRentPart(formatPriceBn(best[0])) : "";
  }
  if (mode === "buy") return usable(row.salePerSqft, row.saleCount) ? bn.area.avgSalePart(formatPriceBn(row.salePerSqft)) : "";
  return "";
}

function PriceFigure({ label, value, count, unit }: { label: string; value: number | null; count: number; unit?: string }) {
  return (
    <div className="rounded-xl bg-background px-4 py-3">
      <p className="text-sm text-slate">{label}</p>
      {usable(value, count) ? (
        <>
          <p className="mt-0.5 text-xl font-bold tabular-nums">
            {formatPriceBn(value)}
            {unit ? <span className="ml-1 text-sm font-normal text-slate">/{unit}</span> : null}
          </p>
          <p className="text-xs text-slate">{bn.prices.sample(toBnDigits(count))}</p>
        </>
      ) : (
        <p className="mt-0.5 text-sm">{bn.prices.tooFew}</p>
      )}
    </div>
  );
}

function AreaPrices({ mode, row }: { mode: SearchMode; row: PriceGuideRow | undefined }) {
  if (!row || mode === "commercial") return null;
  return (
    <section aria-labelledby="area-avg-prices-title" className="mt-10 rounded-2xl bg-cloud p-5 sm:p-6">
      <h2 id="area-avg-prices-title" className="text-2xl">
        {bn.area.pricesTitle}
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {mode === "buy" ? (
          <PriceFigure label={bn.prices.salePerSqft} value={row.salePerSqft} count={row.saleCount} unit={bn.listing.perSqft} />
        ) : null}
        {mode === "rent" ? (
          <>
            <PriceFigure label={bn.prices.rentSmall} value={row.rentSmall} count={row.rentSmallCount} unit={bn.listing.perMonth} />
            <PriceFigure label={bn.prices.rentThree} value={row.rentThree} count={row.rentThreeCount} unit={bn.listing.perMonth} />
            <PriceFigure label={bn.prices.rentLarge} value={row.rentLarge} count={row.rentLargeCount} unit={bn.listing.perMonth} />
          </>
        ) : null}
        {mode === "land" ? <PriceFigure label={bn.prices.landPerKatha} value={row.landPerKatha} count={row.landCount} /> : null}
      </div>
      <p className="mt-3 text-sm text-slate">
        {bn.area.pricesNote}{" "}
        <Link href={PRICE_GUIDE_PATH} className="font-bold text-primary underline underline-offset-4">
          {bn.prices.linkFromHome}
        </Link>
      </p>
    </section>
  );
}

export function createAreaPage(mode: SearchMode) {
  async function generateStaticParams() {
    const popular = await getPopularLocations(8);
    const params = popular.filter(hasAreaPage).map((place) => ({ location: place.slug }));
    return params.length > 0 ? params : [{ location: "dhaka" }];
  }

  async function generateMetadata({ params }: AreaProps): Promise<Metadata> {
    const { location } = await params;
    const place = await getLocationBySlug(location);
    if (!place || !hasAreaPage(place)) return { title: bn.errors.notFoundTitle, robots: { index: false } };
    const [counts, guide] = await Promise.all([getAreaModeCounts(), getPriceGuide()]);
    const count = countFor(counts, place.slug, mode);
    return {
      title: { absolute: areaTitle(mode, place) },
      description: bn.area.metaDescription(
        inLocationBn(place.nameBn),
        bn.modeTitles[mode],
        formatNumberBn(count?.count ?? 0),
        averageForMeta(mode, guideFor(guide, place.slug)),
      ),
      alternates: { canonical: areaPath(mode, place.slug) },
      robots: { index: isIndexable(count), follow: true },
      openGraph: { title: areaHeading(mode, place), url: areaPath(mode, place.slug), type: "website" },
    };
  }

  async function AreaBody({ params }: AreaProps) {
    const { location } = await params;
    const place = await getLocationBySlug(location);
    if (!place || !hasAreaPage(place)) notFound();

    const query = toListingQuery({ mode }, place.slug);
    const [result, counts, guide, allPlaces, links] = await Promise.all([
      searchListings(query),
      getAreaModeCounts(),
      getPriceGuide(),
      getAllLocations(),
      getExternalSearchLinks(),
    ]);
    const now = new Date(result.generatedAt);
    const heading = areaHeading(mode, place);

    const inside = allPlaces
      .filter((child: LocationSummary) => child.parentSlug === place.slug && hasAreaPage(child))
      .map((child) => ({ child, count: countFor(counts, child.slug, mode)?.count ?? 0 }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count || (a.child.slug < b.child.slug ? -1 : 1));

    const otherModes = SEARCH_MODES.filter((other) => other !== mode)
      .map((other) => ({ other, count: countFor(counts, place.slug, other)?.count ?? 0 }))
      .filter((entry) => entry.count > 0);

    const filter = modeFilter(mode);
    const otherSites = matchExternalLinks(links, { purpose: filter.purpose ?? null, category: filter.category, citySlug: cityOf(place) });

    const crumbs: Crumb[] = [{ name: bn.area.home, href: "/" }];
    if (place.type === "area" && place.parentSlug && place.parentNameBn) {
      crumbs.push({ name: areaHeading(mode, { nameBn: place.parentNameBn }), href: areaPath(mode, place.parentSlug) });
    }
    crumbs.push({ name: heading });

    return (
      <>
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: heading,
            numberOfItems: result.total,
            itemListElement: result.listings.map((listing, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: absoluteUrl(listingPath(listing)),
            })),
          }}
        />
        {result.containsDemoData ? (
          <div className="mb-4 overflow-hidden rounded-xl">
            <DemoBanner />
          </div>
        ) : null}
        <Breadcrumbs crumbs={crumbs} />
        <h1 className="mt-3 text-3xl leading-tight lg:text-4xl">{heading}</h1>
        <p className="mt-2 text-slate">{result.total > 0 ? bn.area.summary(formatNumberBn(result.total)) : bn.area.none}</p>

        <AreaPrices mode={mode} row={guideFor(guide, place.slug)} />

        {result.listings.length > 0 ? (
          <section aria-labelledby="area-listings-title" className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="area-listings-title" className="text-2xl">
                {bn.area.latest}
              </h2>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                <Link href={searchPath({ mode, location: place.slug })} className="text-sm font-bold text-primary underline underline-offset-4">
                  {bn.area.seeAllFiltered(formatNumberBn(result.total))}
                </Link>
                <Link href={searchPath({ mode, location: place.slug, view: "map" })} className="text-sm font-bold text-primary underline underline-offset-4">
                  {bn.area.onMap}
                </Link>
              </div>
            </div>
            <div className="mt-5">
              <ListingGrid listings={result.listings} now={now} eagerCount={2} />
            </div>
          </section>
        ) : null}

        {inside.length > 0 ? (
          <section aria-labelledby="area-inside-title" className="mt-12">
            <h2 id="area-inside-title" className="text-2xl">
              {bn.area.insideTitle(ofLocationBn(place.nameBn))}
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              {inside.map(({ child, count }) => (
                <li key={child.slug}>
                  <Link href={areaPath(mode, child.slug)} className="flex h-full flex-col rounded-xl bg-cloud px-4 py-3 hover:bg-indigo-soft">
                    <span className="font-bold">{child.nameBn}</span>
                    <span className="text-sm text-slate">{bn.home.listingCount(formatNumberBn(count))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {otherModes.length > 0 ? (
          <section aria-labelledby="area-other-kinds-title" className="mt-12">
            <h2 id="area-other-kinds-title" className="text-2xl">
              {bn.area.otherKinds}
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {otherModes.map(({ other, count }) => (
                <li key={other}>
                  <Link href={areaPath(other, place.slug)} className="inline-flex min-h-11 items-center rounded-full border border-input px-4 font-bold hover:bg-accent">
                    {areaHeading(other, place)} ({toBnDigits(count)})
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {otherSites.length > 0 ? (
          <section aria-labelledby="area-other-sites-title" className="mt-12 max-w-4xl">
            <h2 id="area-other-sites-title" className="text-2xl">
              {bn.area.otherSites}
            </h2>
            <p className="mt-1 mb-4 text-sm text-slate">{bn.otherSites.note}</p>
            <OtherSiteLinks links={otherSites} />
          </section>
        ) : null}
      </>
    );
  }

  function Page(props: AreaProps) {
    return (
      <div className="page-shell py-6 lg:py-10">
        <Suspense
          fallback={
            <>
              <Skeleton className="h-10 w-2/3 rounded-xl" />
              <Skeleton className="mt-8 h-96 rounded-2xl" />
            </>
          }
        >
          <AreaBody params={props.params} />
        </Suspense>
      </div>
    );
  }

  return { Page, generateMetadata, generateStaticParams };
}
