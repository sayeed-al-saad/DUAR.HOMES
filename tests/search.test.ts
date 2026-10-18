import { describe, expect, it } from "vitest";
import { bundledDemoRepository as repo } from "@/lib/data/demo-repository";
import { MIN_LISTINGS_TO_INDEX, type ListingDetail, type PriceGuideRow } from "@/lib/data/types";
import { areaHeading, isIndexable } from "@/lib/domain/area-pages";
import { modeOf, toListingQuery } from "@/lib/domain/listing-query";
import { compareWithArea } from "@/lib/domain/price-compare";
import { parseSearchParams } from "@/lib/domain/search-params";
import { areaPath, searchPath, SEARCH_MODES, SEARCH_SORTS } from "@/lib/domain/urls";
import { ofLocationBn } from "@/lib/format/bn";

const query = (raw: Record<string, string>, location?: string) => {
  const filters = parseSearchParams(raw);
  return toListingQuery(filters, location ?? filters.location ?? null);
};

describe("turning the URL into a query", () => {
  it("maps each kind of search to sale or rent and a category", () => {
    expect(query({ mode: "buy" })).toMatchObject({ purpose: "sale", category: "residential" });
    expect(query({ mode: "rent" })).toMatchObject({ purpose: "rent", category: "residential" });
    expect(query({ mode: "land" })).toMatchObject({ purpose: "sale", category: "land" });
    expect(query({ mode: "commercial" })).toMatchObject({ category: "commercial" });
    expect(query({ mode: "commercial" }).purpose).toBeUndefined();
    expect(query({ mode: "commercial", purpose: "rent" }).purpose).toBe("rent");
  });

  it("lets a property type decide the category, and drops bedrooms where they make no sense", () => {
    expect(query({ type: "office", beds: "3" })).toMatchObject({ category: "commercial", minBedrooms: undefined });
    expect(query({ mode: "rent", beds: "3" }).minBedrooms).toBe(3);
  });

  it("defaults to newest first, page 1, and keeps sort and page in the address", () => {
    expect(query({})).toMatchObject({ sort: "newest", page: 1, pageSize: 24 });
    expect(parseSearchParams({ sort: "price_asc", page: "3" })).toMatchObject({ sort: "price_asc", page: 3 });
    expect(parseSearchParams({ sort: "nonsense", page: "-2" })).toMatchObject({ sort: undefined, page: undefined });
    expect(searchPath({ mode: "rent", sort: "price_desc", page: 2 })).toBe("/search?mode=rent&sort=price_desc&page=2");
    expect(searchPath({ mode: "rent", page: 1 })).toBe("/search?mode=rent");
    expect(areaPath("rent", "uttara")).toBe("/rent/uttara");
  });

  it("knows which kind of search a listing belongs to", () => {
    expect(modeOf({ purpose: "sale", propertyType: "apartment" })).toBe("buy");
    expect(modeOf({ purpose: "rent", propertyType: "room" })).toBe("rent");
    expect(modeOf({ purpose: "sale", propertyType: "plot" })).toBe("land");
    expect(modeOf({ purpose: "rent", propertyType: "land" })).toBeNull();
    expect(modeOf({ purpose: "rent", propertyType: "shop" })).toBe("commercial");
  });
});

describe("search results", () => {
  it("returns only active listings of the right kind, inside the chosen place", async () => {
    const result = await repo.searchListings(query({ mode: "rent" }, "dhaka"));
    expect(result.total).toBeGreaterThan(0);
    for (const card of result.listings) {
      expect(card.status).toBe("active");
      expect(card.purpose).toBe("rent");
      expect(card.category).toBe("residential");
    }
    const sylhet = await repo.searchListings(query({ mode: "rent" }, "sylhet"));
    const dhakaIds = new Set(result.listings.map((card) => card.id));
    expect(sylhet.listings.some((card) => dhakaIds.has(card.id))).toBe(false);
  });

  it("finds listings in an area when searching its city", async () => {
    const city = await repo.searchListings({ ...query({ mode: "rent" }, "dhaka"), pageSize: 500 });
    const area = await repo.searchListings({ ...query({ mode: "rent" }, "uttara"), pageSize: 500 });
    expect(area.total).toBeGreaterThan(0);
    const cityIds = new Set(city.listings.map((card) => card.id));
    expect(area.listings.every((card) => cityIds.has(card.id))).toBe(true);
  });

  it("applies bedrooms, price and owner filters", async () => {
    const result = await repo.searchListings({ ...query({ mode: "rent", beds: "3", min_price: "20000", max_price: "60000", owner: "1" }), pageSize: 500 });
    for (const card of result.listings) {
      expect(card.bedrooms).toBeGreaterThanOrEqual(3);
      expect(card.price).toBeGreaterThanOrEqual(20_000);
      expect(card.price).toBeLessThanOrEqual(60_000);
      expect(card.origin).toBe("first_party");
      expect(card.listerType).toBe("owner");
    }
  });

  it("sorts as asked", async () => {
    const asc = await repo.searchListings({ ...query({ sort: "price_asc" }), pageSize: 500 });
    expect(asc.listings.map((c) => c.price)).toEqual([...asc.listings.map((c) => c.price)].sort((a, b) => a - b));
    const desc = await repo.searchListings({ ...query({ sort: "price_desc" }), pageSize: 500 });
    expect(desc.listings.map((c) => c.price)).toEqual([...desc.listings.map((c) => c.price)].sort((a, b) => b - a));
    const newest = await repo.searchListings({ ...query({}), pageSize: 500 });
    const dates = newest.listings.map((c) => c.firstSeenAt);
    expect(dates).toEqual([...dates].sort().reverse());
    const drops = await repo.searchListings({ ...query({ sort: "price_drop" }), pageSize: 500 });
    expect(drops.total).toBeGreaterThan(0);
    expect(drops.listings.every((c) => (c.priceDropPercent ?? 0) > 0)).toBe(true);
  });

  it("pages without gaps or repeats", async () => {
    const all = await repo.searchListings({ ...query({}), pageSize: 500 });
    const pages = [];
    for (let page = 1; page <= Math.ceil(all.total / 10); page += 1) {
      pages.push(...(await repo.searchListings({ ...query({}), page, pageSize: 10 })).listings.map((c) => c.id));
    }
    expect(pages).toEqual(all.listings.map((c) => c.id));
    expect((await repo.searchListings({ ...query({}), page: 99, pageSize: 10 })).listings).toEqual([]);
  });

  it("every sort option is offered", () => {
    expect(SEARCH_SORTS).toEqual(["newest", "price_asc", "price_desc", "popular", "price_drop"]);
  });
});

describe("area counts agree with search", () => {
  it("each place and kind counts exactly the listings a search returns", async () => {
    const counts = await repo.getAreaModeCounts();
    expect(counts.length).toBeGreaterThan(10);
    for (const entry of counts) {
      const result = await repo.searchListings({ ...query({ mode: entry.mode }, entry.slug), pageSize: 1 });
      expect(result.total, `${entry.mode} ${entry.slug}`).toBe(entry.count);
    }
  });

  it("only offers pages to search engines with enough real listings", () => {
    expect(isIndexable(undefined)).toBe(false);
    expect(isIndexable({ slug: "x", mode: "rent", count: MIN_LISTINGS_TO_INDEX, containsDemoData: false })).toBe(true);
    expect(isIndexable({ slug: "x", mode: "rent", count: MIN_LISTINGS_TO_INDEX - 1, containsDemoData: false })).toBe(false);
    expect(isIndexable({ slug: "x", mode: "rent", count: 50, containsDemoData: true })).toBe(false);
  });

  it("names area pages in natural Bangla", () => {
    expect(areaHeading("rent", { nameBn: "উত্তরা" })).toBe("উত্তরায় ফ্ল্যাট ও বাড়ি ভাড়া");
    expect(areaHeading("buy", { nameBn: "মিরপুর" })).toBe("মিরপুরে ফ্ল্যাট ও বাড়ি বিক্রি");
    expect(ofLocationBn("ঢাকা")).toBe("ঢাকার");
    expect(ofLocationBn("মিরপুর")).toBe("মিরপুরের");
    expect(ofLocationBn("ধানমন্ডি")).toBe("ধানমন্ডির");
  });
});

describe("listing pages", () => {
  it("finds a listing by its address and leaves out what is not public", async () => {
    const [first] = (await repo.searchListings(query({}))).listings;
    const detail = await repo.getListingBySlug(first.slug);
    expect(detail?.id).toBe(first.id);
    expect(detail?.priceHistory.length).toBeGreaterThan(0);
    expect(await repo.getListingBySlug("no-such-listing")).toBeNull();
  });

  it("never shows a description for a listing from another site", async () => {
    const all = await repo.searchListings({ ...query({}), pageSize: 500 });
    for (const card of all.listings.filter((c) => c.origin === "external")) {
      expect((await repo.getListingBySlug(card.slug))?.description).toBeNull();
    }
  });

  it("suggests similar listings of the same kind, never the listing itself", async () => {
    const [first] = (await repo.searchListings(query({ mode: "rent" }, "dhaka"))).listings;
    const detail = (await repo.getListingBySlug(first.slug))!;
    const similar = await repo.getSimilarListings(detail, 4);
    expect(similar.length).toBeGreaterThan(0);
    expect(similar.every((c) => c.id !== detail.id && c.purpose === detail.purpose && c.category === detail.category)).toBe(true);
  });
});

describe("price guide and comparisons", () => {
  it("counts every figure's sample and covers cities with their areas", async () => {
    const guide = await repo.getPriceGuide();
    const dhaka = guide.find((row) => row.slug === "dhaka")!;
    const uttara = guide.find((row) => row.slug === "uttara");
    expect(dhaka.saleCount).toBeGreaterThan(0);
    if (uttara) expect(dhaka.saleCount).toBeGreaterThanOrEqual(uttara.saleCount);
    for (const row of guide) {
      if (row.saleCount === 0) expect(row.salePerSqft).toBeNull();
      if (row.rentThreeCount === 0) expect(row.rentThree).toBeNull();
    }
  });

  const row = (over: Partial<PriceGuideRow>): PriceGuideRow => ({
    slug: "uttara", type: "area", nameBn: "উত্তরা", nameEn: "Uttara", parentSlug: "dhaka", parentNameBn: "ঢাকা",
    salePerSqft: null, saleCount: 0, rentSmall: null, rentSmallCount: 0, rentThree: null, rentThreeCount: 0,
    rentLarge: null, rentLargeCount: 0, landPerKatha: null, landCount: 0, containsDemoData: false, ...over,
  });
  const listing = (over: Partial<ListingDetail>) => ({
    status: "active", category: "residential", purpose: "rent", propertyType: "apartment", bedrooms: 3,
    price: 27_000, sizeSqft: 1200, locationSlug: "uttara", parentLocationSlug: "dhaka", ...over,
  }) as ListingDetail;

  it("compares with the area's average when it rests on enough listings, else the city's, else not at all", () => {
    expect(compareWithArea(listing({}), [row({ rentThree: 30_000, rentThreeCount: 5 })])).toMatchObject({ percent: -10, placeSlug: "uttara", band: "three" });
    expect(
      compareWithArea(listing({}), [row({ rentThree: 30_000, rentThreeCount: 2 }), row({ slug: "dhaka", nameBn: "ঢাকা", rentThree: 25_000, rentThreeCount: 9 })]),
    ).toMatchObject({ percent: 8, placeSlug: "dhaka" });
    expect(compareWithArea(listing({}), [row({ rentThree: 30_000, rentThreeCount: 2 })])).toBeNull();
    expect(compareWithArea(listing({ purpose: "sale", price: 12_000_000 }), [row({ salePerSqft: 10_000, saleCount: 4 })])).toMatchObject({ kind: "sale", percent: 0 });
    expect(compareWithArea(listing({ status: "sold" }), [row({ rentThree: 30_000, rentThreeCount: 5 })])).toBeNull();
    expect(compareWithArea(listing({ propertyType: "room" }), [row({ rentSmall: 9_000, rentSmallCount: 5 })])).toBeNull();
  });

  it("lists every kind of search for area pages", () => {
    expect(SEARCH_MODES).toEqual(["buy", "rent", "land", "commercial"]);
  });
});
