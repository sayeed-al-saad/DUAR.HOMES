import type { MetadataRoute } from "next";
import { getAllLocations, getAreaModeCounts, getDataTimestamp, getIndexableListings, getPriceGuide } from "@/lib/data";
import { countFor, hasAreaPage, isIndexable } from "@/lib/domain/area-pages";
import { areaPath, listingPath, PRICE_GUIDE_PATH, SEARCH_MODES } from "@/lib/domain/urls";
import { absoluteUrl } from "@/lib/seo/structured-data";

/**
 * Only pages worth finding: the home page, the price guide once it has real
 * data, area pages with enough real listings, and listings made on this site.
 * Pages marked noindex are never listed here.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [places, counts, guide, listings, stamp] = await Promise.all([
    getAllLocations(),
    getAreaModeCounts(),
    getPriceGuide(),
    getIndexableListings(),
    getDataTimestamp(),
  ]);

  const entries: MetadataRoute.Sitemap = [{ url: absoluteUrl("/"), lastModified: stamp, changeFrequency: "daily", priority: 1 }];

  entries.push({ url: absoluteUrl("/list-property"), lastModified: stamp, changeFrequency: "monthly", priority: 0.6 });

  const guideHasRealData = guide.length > 0 && !guide.some((row) => row.containsDemoData);
  if (guideHasRealData) {
    entries.push({ url: absoluteUrl(PRICE_GUIDE_PATH), lastModified: stamp, changeFrequency: "weekly", priority: 0.8 });
  }

  for (const place of places) {
    if (!hasAreaPage(place)) continue;
    for (const mode of SEARCH_MODES) {
      if (!isIndexable(countFor(counts, place.slug, mode))) continue;
      entries.push({ url: absoluteUrl(areaPath(mode, place.slug)), lastModified: stamp, changeFrequency: "daily", priority: 0.7 });
    }
  }

  for (const listing of listings) {
    entries.push({ url: absoluteUrl(listingPath(listing)), lastModified: listing.updatedAt, changeFrequency: "weekly", priority: 0.5 });
  }

  return entries;
}
