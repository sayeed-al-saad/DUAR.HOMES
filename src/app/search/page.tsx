import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OtherSiteLinks } from "@/components/external/other-site-links";
import { DemoBanner } from "@/components/layout/demo-banner";
import { ListingGrid } from "@/components/listings/listing-grid";
import { Pagination } from "@/components/search/pagination";
import { SearchMap, type MapMarker } from "@/components/search/search-map";
import { ViewToggle } from "@/components/search/view-toggle";
import { SearchFiltersForm } from "@/components/search/search-filters";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getExternalSearchLinks,
  getLocationBySlug,
  getMapAreas,
  getPopularLocations,
  searchListings,
  searchLocations,
  type LocationSummary,
} from "@/lib/data";
import { areaHeading, hasAreaPage } from "@/lib/domain/area-pages";
import { cityOf, matchExternalLinks } from "@/lib/domain/external-links";
import { pageCount, toListingQuery } from "@/lib/domain/listing-query";
import { parseSearchParams } from "@/lib/domain/search-params";
import { MAP_MAX_LISTINGS, type MapResult } from "@/lib/data/types";
import { areaPath, searchPath, type SearchFilters } from "@/lib/domain/urls";
import { formatNumberBn, formatPriceBn, ofLocationBn, toBnDigits } from "@/lib/format/bn";
import { bn } from "@/lib/i18n/bn";

export const metadata: Metadata = {
  title: bn.searchPage.title,
  // Filtered result pages are endless combinations of the same listings.
  // Area pages are the ones meant for search engines.
  robots: { index: false, follow: true },
};

/** The search page. The filter form and the results both depend on the URL, so both stream in. */
export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="page-shell py-8 lg:py-12">
      <h1 className="text-3xl lg:text-4xl">{bn.searchPage.title}</h1>
      <Suspense
        fallback={
          <>
            <Skeleton className="mt-6 h-56 rounded-2xl" />
            <Skeleton className="mt-8 h-96 rounded-2xl" />
          </>
        }
      >
        <SearchBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function locationLabel(location: LocationSummary): string {
  return location.type === "area" && location.parentNameBn ? `${location.nameBn}, ${location.parentNameBn}` : location.nameBn;
}

async function SearchBody({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const filters = parseSearchParams(await searchParams);

  // A chosen place, or the best match for what was typed.
  let location = filters.location ? await getLocationBySlug(filters.location) : null;
  let typedNotice: string | null = null;
  if (!location && filters.q) {
    const [match] = await searchLocations(filters.q, 1);
    location = match ? await getLocationBySlug(match.slug) : null;
    typedNotice = location
      ? bn.searchPage.placeMatched(filters.q, ofLocationBn(location.nameBn))
      : bn.searchPage.placeUnknown(filters.q);
  }

  const query = toListingQuery(filters, location?.slug ?? null);
  const isMap = filters.view === "map";
  const [result, map, popularLocations, allLinks] = await Promise.all([
    isMap ? null : searchListings(query),
    isMap ? getMapAreas(query) : null,
    getPopularLocations(8),
    getExternalSearchLinks(),
  ]);
  const total = result ? result.total : (map?.total ?? 0);
  const containsDemoData = result ? result.containsDemoData : (map?.areas.some((area) => area.containsDemoData) ?? false);
  const here: SearchFilters = { ...filters, location: location?.slug };
  const otherSites = matchExternalLinks(allLinks, {
    purpose: query.purpose ?? null,
    category: query.category ?? null,
    citySlug: cityOf(location),
  });
  const areaLink = location && filters.mode && hasAreaPage(location) ? areaPath(filters.mode, location.slug) : null;

  return (
    <>
      <div className="mt-5">
        <SearchFiltersForm
          // A new URL means new starting values for the form.
          key={JSON.stringify(filters)}
          initial={filters}
          initialLocation={location}
          initialText={location ? locationLabel(location) : (filters.q ?? "")}
          popularLocations={popularLocations}
        />
      </div>

      {typedNotice ? (
        <Alert variant="notice" className="mt-4">
          {typedNotice}
        </Alert>
      ) : null}

      {containsDemoData ? (
        <div className="mt-4 overflow-hidden rounded-xl">
          <DemoBanner />
        </div>
      ) : null}

      <section aria-labelledby="results-title" className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div>
            <h2 id="results-title" className="text-2xl">
              {bn.searchPage.resultCount(formatNumberBn(total))}
            </h2>
            {result && result.total > 0 ? (
              <p className="text-sm text-slate tabular-nums">
                {bn.searchPage.showing(
                  toBnDigits((result.page - 1) * result.pageSize + 1),
                  toBnDigits((result.page - 1) * result.pageSize + result.listings.length),
                  formatNumberBn(result.total),
                )}
              </p>
            ) : null}
          </div>
          <ViewToggle
            listHref={searchPath({ ...here, view: undefined })}
            mapHref={searchPath({ ...here, view: "map", page: undefined })}
            current={isMap ? "map" : "list"}
          />
        </div>
        <p className="mt-1 text-xs text-slate">{bn.searchPage.resultNote}</p>
        {areaLink && filters.mode && location ? (
          <p className="mt-1 text-sm">
            <Link href={areaLink} className="font-bold text-primary underline underline-offset-4">
              {bn.searchPage.areaPageLink(areaHeading(filters.mode, location))}
            </Link>
          </p>
        ) : null}

        {map ? (
          <MapView map={map} here={here} />
        ) : result ? (
          <>
            <div className="mt-5">
              {result.listings.length > 0 ? (
                <ListingGrid listings={result.listings} now={new Date(result.generatedAt)} eagerCount={2} />
              ) : (
                <div className="rounded-2xl bg-cloud px-5 py-8">
                  <p className="text-lg font-bold">{bn.searchPage.emptyTitle}</p>
                  <p className="mt-1 text-slate">{bn.searchPage.emptyBody}</p>
                </div>
              )}
            </div>
            <Pagination page={result.page} pages={pageCount(result.total, result.pageSize)} hrefFor={(page) => searchPath({ ...here, page })} />
          </>
        ) : null}
      </section>

      {otherSites.length > 0 ? (
        // Its own id: the home page's section may still be in the document, kept hidden by the router.
        <section aria-labelledby="search-other-sites-title" className="mt-12 max-w-4xl">
          <h2 id="search-other-sites-title" className="text-2xl">
            {bn.otherSites.searchTitle}
          </h2>
          <p className="mt-1 mb-4 text-sm text-slate">{bn.otherSites.note}</p>
          <OtherSiteLinks links={otherSites} />
        </section>
      ) : null}
    </>
  );
}

/** The map, and the same places as a plain list under it (for screen readers, and if the map cannot load). */
function MapView({ map, here }: { map: MapResult; here: SearchFilters }) {
  const markers: MapMarker[] = map.areas.map((area) => ({
    ...area,
    href: searchPath({ ...here, location: area.slug, view: undefined, page: undefined }),
  }));
  if (markers.length === 0) {
    return (
      <div className="mt-5 rounded-2xl bg-cloud px-5 py-8">
        <p className="text-lg font-bold">{bn.searchPage.emptyTitle}</p>
        <p className="mt-1 text-slate">{bn.map.empty}</p>
      </div>
    );
  }
  return (
    <div className="mt-5">
      {!map.complete ? (
        <Alert variant="notice" className="mb-3">
          {bn.map.incomplete(formatNumberBn(MAP_MAX_LISTINGS))}
        </Alert>
      ) : null}
      <SearchMap markers={markers} />
      <p className="mt-2 text-xs text-slate">{bn.map.note}</p>
      <h3 className="mt-6 text-lg">{bn.map.listTitle}</h3>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {markers.map((marker) => (
          <li key={marker.slug}>
            <Link
              href={marker.href}
              className="flex items-baseline justify-between gap-3 rounded-xl border border-line px-4 py-3 hover:border-indigo/50"
            >
              <span className="min-w-0 truncate font-bold">
                {marker.parentNameBn ? `${marker.nameBn}, ${marker.parentNameBn}` : marker.nameBn}
              </span>
              <span className="shrink-0 text-right text-sm">
                {bn.map.count(toBnDigits(marker.count))}
                <span className="block text-xs text-slate">{bn.map.from(formatPriceBn(marker.minPrice))}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
