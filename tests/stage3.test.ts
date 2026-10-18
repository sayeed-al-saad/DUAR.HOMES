import { describe, expect, it } from "vitest";
import { bundledDemoRepository as repo, computeAreaStats } from "@/lib/data/demo-repository";
import { assignGroups, compareInGroup, computeMapAreas, otherListingsOf, type PlaceInfo } from "@/lib/data/listing-math";
import type { ListingCard } from "@/lib/data/types";
import { toListingQuery } from "@/lib/domain/listing-query";
import { parseSearchParams } from "@/lib/domain/search-params";
import { searchPath } from "@/lib/domain/urls";

function card(id: string, overrides: Partial<ListingCard> = {}): ListingCard {
  return {
    id,
    slug: `listing-${id}`,
    propertyId: "p1",
    isGroupLead: true,
    alsoListedCount: 0,
    groupMinPrice: null,
    title: "x",
    purpose: "rent",
    origin: "external",
    listerType: "unknown",
    status: "active",
    price: 30_000,
    previousPrice: null,
    priceChangedAt: null,
    priceDropPercent: null,
    propertyType: "apartment",
    category: "residential",
    sizeSqft: 1200,
    landSizeKatha: null,
    bedrooms: 3,
    bathrooms: 2,
    pricePerSqft: null,
    locationSlug: "uttara",
    locationNameBn: "উত্তরা",
    parentLocationNameBn: "ঢাকা",
    sourceName: "s",
    sourceUrl: "https://example.com/1",
    imageUrl: null,
    imageAlt: null,
    isVerified: false,
    firstSeenAt: "2026-10-01T00:00:00.000Z",
    lastCheckedAt: "2026-10-10T00:00:00.000Z",
    viewCount: 0,
    isDemo: true,
    ...overrides,
  };
}

describe("one property, one card", () => {
  it("leads with our own listing, then the lowest price, then the newest", () => {
    const own = card("c", { origin: "first_party", price: 35_000 });
    const cheap = card("b", { price: 28_000 });
    const newer = card("a", { price: 28_000, firstSeenAt: "2026-10-05T00:00:00.000Z" });
    expect([cheap, newer, own].sort(compareInGroup).map((c) => c.id)).toEqual(["c", "a", "b"]);
  });

  it("marks one lead per property and purpose, and counts the rest", () => {
    const grouped = assignGroups([
      card("a", { price: 30_000 }),
      card("b", { price: 28_000 }),
      card("c", { purpose: "sale", price: 9_000_000 }),
      card("d", { propertyId: "p2" }),
      card("e", { status: "sold", price: 1_000 }),
    ]);
    const by = Object.fromEntries(grouped.map((c) => [c.id, c]));
    expect(by.b).toMatchObject({ isGroupLead: true, alsoListedCount: 1, groupMinPrice: 28_000 });
    expect(by.a).toMatchObject({ isGroupLead: false, alsoListedCount: 1, groupMinPrice: 28_000 });
    expect(by.c).toMatchObject({ isGroupLead: true, alsoListedCount: 0, groupMinPrice: null });
    expect(by.d).toMatchObject({ isGroupLead: true, alsoListedCount: 0 });
    // A sold listing is never grouped, so it does not hide or join anything.
    expect(by.e).toMatchObject({ isGroupLead: true, alsoListedCount: 0, groupMinPrice: null });
  });

  it("lists the other listings of the same property in group order", () => {
    const cards = assignGroups([card("a", { price: 30_000 }), card("b", { price: 28_000 }), card("c", { price: 29_000 })]);
    expect(otherListingsOf(cards, cards[1]).map((c) => c.id)).toEqual(["c", "a"]);
  });

  it("shows a merged demo flat once in search, with the other site on its page", async () => {
    const result = await repo.searchListings(toListingQuery(parseSearchParams({ mode: "rent" }), "mirpur"));
    const flats = result.listings.filter((c) => c.bedrooms === 2 && c.sizeSqft === 800);
    expect(flats).toHaveLength(1);
    expect(flats[0]).toMatchObject({ alsoListedCount: 1, price: 16_500, groupMinPrice: 16_500 });
    const detail = (await repo.getListingBySlug(flats[0].slug))!;
    const others = await repo.getOtherListings(detail);
    expect(others).toHaveLength(1);
    expect(others[0]).toMatchObject({ price: 17_500, isGroupLead: false });
  });

  it("counts a merged property once in area figures", async () => {
    const all = await repo.searchListings(toListingQuery({}, "bashundhara"));
    const leads = all.listings.length;
    expect(computeAreaStats("bashundhara")!.activeListingCount).toBe(leads);
    const similar = await repo.getSimilarListings((await repo.getListingBySlug(all.listings.find((c) => c.alsoListedCount > 0)!.slug))!, 10);
    expect(similar.every((c) => c.alsoListedCount === 0 || c.isGroupLead)).toBe(true);
  });
});

describe("search map", () => {
  const place = (slug: string): PlaceInfo | undefined =>
    ({ uttara: { slug, type: "area", nameBn: "উত্তরা", nameEn: "Uttara", parentSlug: "dhaka", parentNameBn: "ঢাকা", ancestors: [slug] } })[slug] as
      | PlaceInfo
      | undefined;
  const point = (slug: string) => (slug === "uttara" ? { latitude: 23.87, longitude: 90.4 } : undefined);

  it("groups by place, keeps the lowest price, and leaves out places without a point", () => {
    const result = computeMapAreas(
      [
        { locationSlug: "uttara", price: 30_000, isDemo: false },
        { locationSlug: "uttara", price: 24_000, isDemo: true },
        { locationSlug: "nowhere", price: 1, isDemo: false },
      ],
      place,
      point,
      true,
    );
    expect(result.areas).toEqual([
      { slug: "uttara", nameBn: "উত্তরা", parentNameBn: "ঢাকা", latitude: 23.87, longitude: 90.4, count: 2, minPrice: 24_000, containsDemoData: true },
    ]);
    expect(result.total).toBe(3);
  });

  it("covers every matching property in demo mode, at the place's centre", async () => {
    const query = toListingQuery(parseSearchParams({ mode: "rent" }), "dhaka");
    const map = await repo.getMapAreas(query);
    const list = await repo.searchListings({ ...query, pageSize: 500 });
    expect(map.total).toBe(list.total);
    expect(map.areas.reduce((sum, area) => sum + area.count, 0)).toBe(list.total);
    expect(map.complete).toBe(true);
    for (const area of map.areas) {
      expect(area.latitude).toBeGreaterThan(20);
      expect(area.longitude).toBeGreaterThan(88);
    }
  });

  it("has its own URL, and drops paging", () => {
    expect(searchPath({ mode: "rent", location: "uttara", view: "map", page: 3 })).toBe("/search?mode=rent&location=uttara&view=map");
    expect(parseSearchParams({ view: "map", page: "3" })).toMatchObject({ view: "map", page: undefined });
    expect(parseSearchParams({ view: "satellite" }).view).toBeUndefined();
  });
});
