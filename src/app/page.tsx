import { AreaPrices } from "@/components/home/area-prices";
import { Hero } from "@/components/home/hero";
import { ListingRail } from "@/components/home/listing-rail";
import { PopularAreas } from "@/components/home/popular-areas";
import { PriceDropList } from "@/components/home/price-drop-list";
import { HomeSection } from "@/components/home/section";
import { WhyUs } from "@/components/home/why-us";
import { DemoBanner } from "@/components/layout/demo-banner";
import { OtherSiteLinks, latestCheck } from "@/components/external/other-site-links";
import { getExternalSearchLinks, getHomePageData, getPopularLocations } from "@/lib/data";
import { formatDateBn } from "@/lib/format/bn";
import { PRICE_GUIDE_PATH, searchPath } from "@/lib/domain/urls";
import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/config/site";
import { JsonLd } from "@/components/seo/json-ld";
import { siteData } from "@/lib/seo/structured-data";
import { bn } from "@/lib/i18n/bn";

export const metadata: Metadata = {
  title: { absolute: `${bn.seo.homeTitle} | ${siteConfig.name}` },
  alternates: { canonical: "/" },
};

/**
 * Home page. Everything here comes from cached data, so the whole page is
 * prerendered and served as static HTML; only the login button in the header
 * is filled in per visitor.
 */
export default async function HomePage() {
  const [data, popularLocations, otherSiteLinks] = await Promise.all([
    getHomePageData(),
    getPopularLocations(8),
    getExternalSearchLinks(),
  ]);
  const linksChecked = latestCheck(otherSiteLinks);
  // One fixed "now" for the page, so freshness labels match the data they describe.
  const now = new Date(data.generatedAt);

  return (
    <>
      <JsonLd data={siteData()} />
      {data.containsDemoData ? <DemoBanner /> : null}

      <Hero popularLocations={popularLocations} />

      <HomeSection
        id="popular"
        title={bn.home.popularListings}
        hint={bn.home.popularListingsHint}
        seeAllHref={searchPath({ sort: "popular" })}
      >
        <ListingRail listings={data.popular} now={now} eagerCount={2} />
      </HomeSection>

      <HomeSection
        id="new"
        title={bn.home.newListings}
        hint={bn.home.newListingsHint}
        seeAllHref={searchPath({ sort: "newest" })}
      >
        <ListingRail listings={data.newest} now={now} />
      </HomeSection>

      <HomeSection
        id="price-drops"
        title={bn.home.priceDrops}
        hint={bn.home.priceDropsHint}
        seeAllHref={searchPath({ sort: "price_drop" })}
        tone="cloud"
      >
        <PriceDropList listings={data.priceDrops} now={now} />
      </HomeSection>

      <HomeSection
        id="owner"
        title={bn.home.ownerListings}
        hint={bn.home.ownerListingsHint}
        seeAllHref={searchPath({ ownerOnly: true })}
      >
        <ListingRail listings={data.ownerDirect} now={now} />
      </HomeSection>

      {otherSiteLinks.length > 0 ? (
        <HomeSection id="other-sites" title={bn.otherSites.title} hint={bn.otherSites.hint} tone="cloud">
          <OtherSiteLinks links={otherSiteLinks} />
          <p className="mt-3 max-w-3xl text-sm text-slate">
            {bn.otherSites.note}
            {linksChecked ? ` ${bn.otherSites.lastChecked(formatDateBn(linksChecked))}` : null}
          </p>
        </HomeSection>
      ) : null}

      <HomeSection id="areas" title={bn.home.popularAreas} hint={bn.home.popularAreasHint}>
        <PopularAreas areas={data.popularAreas} />
      </HomeSection>

      <HomeSection id="area-prices" title={bn.home.areaPrices} hint={bn.home.areaPricesHint}>
        <AreaPrices areas={data.popularAreas} showDemoNote={data.containsDemoData} />
        <p className="mt-5">
          <Link href={PRICE_GUIDE_PATH} className="font-bold text-primary underline underline-offset-4">
            {bn.prices.linkFromHome}
          </Link>
        </p>
      </HomeSection>

      <HomeSection id="why" title={bn.home.whyUs} tone="cloud">
        <WhyUs />
      </HomeSection>
    </>
  );
}
