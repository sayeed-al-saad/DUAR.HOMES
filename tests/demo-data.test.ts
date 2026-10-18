import { describe, expect, it } from "vitest";
import { listings, locations, properties, sources } from "@/lib/data/demo-dataset";
import { bundledDemoRepository as demoRepository, computeAreaStats, publicDemoListingCount } from "@/lib/data/demo-repository";
import { HOME_PRICE_DROP_SIZE, HOME_RAIL_SIZE } from "@/lib/data/types";

describe("location reference data", () => {
  it("has 8 divisions and 64 districts", () => {
    expect(locations.filter((location) => location.type === "division")).toHaveLength(8);
    expect(locations.filter((location) => location.type === "district")).toHaveLength(64);
  });

  it("has unique, URL-safe slugs and a valid parent for everything below a division", () => {
    const slugs = new Set(locations.map((location) => location.slug));
    expect(slugs.size).toBe(locations.length);
    for (const location of locations) {
      expect(location.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      if (location.type === "division") expect(location.parent).toBeNull();
      else expect(slugs.has(location.parent as string)).toBe(true);
    }
  });

  it("keeps every coordinate inside Bangladesh", () => {
    for (const location of locations) {
      expect(location.latitude).toBeGreaterThan(20.5);
      expect(location.latitude).toBeLessThan(26.7);
      expect(location.longitude).toBeGreaterThan(88);
      expect(location.longitude).toBeLessThan(92.7);
    }
  });

  it("covers the areas the brief asks for", () => {
    const slugs = new Set(locations.map((location) => location.slug));
    for (const wanted of ["dhaka", "uttara", "bashundhara", "mirpur", "dhanmondi", "mohammadpur", "gulshan", "banani", "chattogram", "sylhet"]) {
      expect(slugs.has(wanted)).toBe(true);
    }
  });
});

describe("demo listings", () => {
  it("never give an external listing a description, an image or a lister-written title", () => {
    for (const listing of listings.filter((item) => item.origin === "external")) {
      expect(listing.description).toBeNull();
      expect(listing.imageUrl).toBeNull();
      expect(listing.sourceUrl).toMatch(/^https:\/\/([a-z]+\.)?example\.(com|org|net)\//);
    }
  });

  it("use only reserved example domains for made-up sources", () => {
    for (const source of sources.filter((item) => item.isDemo)) {
      expect(source.website).toMatch(/^https:\/\/([a-z]+\.)?example\.(com|org|net)$/);
    }
  });

  it("have unique slugs and sensible numbers", () => {
    expect(new Set(listings.map((listing) => listing.slug)).size).toBe(listings.length);
    for (const listing of listings) {
      expect(listing.price).toBeGreaterThan(0);
      if (listing.previousPrice !== null) expect(listing.previousPrice).not.toBe(listing.price);
      expect(listing.lastCheckedDaysAgo).toBeLessThanOrEqual(listing.firstSeenDaysAgo);
    }
    for (const property of properties) {
      if (property.floorNumber && property.totalFloors) expect(property.floorNumber).toBeLessThanOrEqual(property.totalFloors);
    }
  });

  it("include a property listed by two sources", () => {
    const byProperty = new Map<string, Set<string>>();
    for (const listing of listings) {
      byProperty.set(listing.propertyId, (byProperty.get(listing.propertyId) ?? new Set()).add(listing.sourceSlug));
    }
    expect([...byProperty.values()].some((set) => set.size > 1)).toBe(true);
  });
});

describe("demo repository", () => {
  it("fills every home page section from active listings only", async () => {
    const home = await demoRepository.getHomePageData();
    expect(home.popular).toHaveLength(HOME_RAIL_SIZE);
    expect(home.newest).toHaveLength(HOME_RAIL_SIZE);
    expect(home.priceDrops).toHaveLength(HOME_PRICE_DROP_SIZE);
    expect(home.ownerDirect).toHaveLength(HOME_RAIL_SIZE);
    expect(home.popularAreas).toHaveLength(10);
    expect(home.containsDemoData).toBe(true);

    const everything = [...home.popular, ...home.newest, ...home.priceDrops, ...home.ownerDirect];
    expect(everything.every((card) => card.status === "active")).toBe(true);
    expect(home.priceDrops.every((card) => (card.priceDropPercent ?? 0) > 0)).toBe(true);
    expect(home.ownerDirect.every((card) => card.origin === "first_party" && card.listerType === "owner")).toBe(true);
    expect(home.popular[0].viewCount).toBeGreaterThanOrEqual(home.popular[1].viewCount);
  });

  it("hides the listing that is waiting for review", () => {
    expect(publicDemoListingCount()).toBe(listings.length - 1);
  });

  it("rolls city statistics up from their areas", () => {
    const dhaka = computeAreaStats("dhaka")!;
    const dhanmondi = computeAreaStats("dhanmondi")!;
    expect(dhaka.activeListingCount).toBeGreaterThan(dhanmondi.activeListingCount);
    expect(dhanmondi.avgSalePricePerSqft).toBe(Math.round((24_500_000 / 1650 + 36_000_000 / 2200) / 2));
    expect(dhanmondi.avgMonthlyRent).toBe(46_500);
  });

  it("finds places in Bangla, English and older spellings", async () => {
    expect((await demoRepository.searchLocations("ধানম"))[0].slug).toBe("dhanmondi");
    expect((await demoRepository.searchLocations("gulsh"))[0].slug).toBe("gulshan");
    expect((await demoRepository.searchLocations("chittagong"))[0].slug).toBe("chattogram");
    expect(await demoRepository.searchLocations("zzzz")).toEqual([]);
    expect((await demoRepository.searchLocations("")).length).toBeGreaterThan(0);
  });
});
