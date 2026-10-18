import { describe, expect, it } from "vitest";
import { EXTERNAL_SITES, EXTERNAL_SITES_REVIEWED_ON } from "@/data/external-sites";
import { externalLinks, listings, locationBySlug, sources } from "@/lib/data/demo-dataset";
import { bundledDemoRepository as demoRepository } from "@/lib/data/demo-repository";
import type { ExternalSearchLink } from "@/lib/data/types";
import { cityOf, describeLinkBn, groupBySource, matchExternalLinks } from "@/lib/domain/external-links";
import { formatDateBn } from "@/lib/format/bn";

describe("register of real sites", () => {
  it("links only to https pages on the site it names, once each, in places we know", () => {
    const seen = new Set<string>();
    for (const site of EXTERNAL_SITES) {
      expect(site.website).toMatch(/^https:\/\/[a-z0-9.-]+$/);
      expect(site.reviewNotes).toContain(`Reviewed ${EXTERNAL_SITES_REVIEWED_ON}`);
      expect(site.links.length).toBeGreaterThan(0);
      for (const link of site.links) {
        expect(link.url.startsWith(`${site.website}/`)).toBe(true);
        expect(seen.has(link.url)).toBe(false);
        seen.add(link.url);
        if (link.location) expect(locationBySlug.has(link.location)).toBe(true);
      }
    }
    expect(externalLinks).toHaveLength(seen.size);
  });

  it("is kept apart from demo data, and no listing comes from a real site", () => {
    const realSlugs = new Set(EXTERNAL_SITES.map((site) => site.slug));
    expect(sources.some((source) => realSlugs.has(source.slug))).toBe(false);
    expect(listings.some((listing) => realSlugs.has(listing.sourceSlug))).toBe(false);
  });
});

describe("describing a link", () => {
  it("says where, what and whether it is sale or rent", () => {
    expect(describeLinkBn({ locationNameBn: "ঢাকা", category: "residential", purpose: "rent" })).toBe("ঢাকায় ফ্ল্যাট ও বাড়ি ভাড়া");
    expect(describeLinkBn({ locationNameBn: null, category: "land", purpose: "sale" })).toBe("সারা দেশে জমি ও প্লট বিক্রি");
    expect(describeLinkBn({ locationNameBn: "সিলেট", category: null, purpose: null })).toBe("সিলেটে সব প্রপার্টি");
    expect(describeLinkBn({ locationNameBn: "চট্টগ্রাম", category: "commercial", purpose: "rent" })).toBe(
      "চট্টগ্রামে কমার্শিয়াল প্রপার্টি ভাড়া",
    );
  });
});

describe("matching links to a search", () => {
  const load = () => demoRepository.getExternalSearchLinks();
  const urls = (links: ExternalSearchLink[]) => links.map((link) => link.url);

  it("puts the city page first when someone is renting a flat in Dhaka", async () => {
    const matched = matchExternalLinks(await load(), { purpose: "rent", category: "residential", citySlug: "dhaka" });
    expect(matched[0].url).toBe("https://bikroy.com/en/ads/dhaka/apartment-rentals");
    expect(matched.every((link) => link.purpose !== "sale")).toBe(true);
    expect(matched.every((link) => link.category === null || link.category === "residential")).toBe(true);
    expect(matched.every((link) => link.locationSlug === null || link.locationSlug === "dhaka")).toBe(true);
  });

  it("never offers one city's page to someone searching another city or no city", async () => {
    const sylhet = matchExternalLinks(await load(), { purpose: "sale", category: "residential", citySlug: "sylhet" });
    expect(urls(sylhet)).toContain("https://bikroy.com/en/ads/sylhet/apartments-for-sale");
    expect(sylhet.some((link) => link.locationSlug === "dhaka")).toBe(false);

    const anywhere = matchExternalLinks(await load(), { purpose: "sale", category: "land" });
    expect(anywhere.every((link) => link.locationSlug === null)).toBe(true);
    expect(urls(anywhere)).toContain("https://bikroy.com/land-and-plots-for-sale");
  });

  it("returns at most the asked number per site", async () => {
    const all = await load();
    const one = matchExternalLinks(all, {}, 1);
    expect(groupBySource(one).every((group) => group.links.length === 1)).toBe(true);
    expect(groupBySource(matchExternalLinks(all, { citySlug: "dhaka" }, 2)).every((group) => group.links.length <= 2)).toBe(true);
  });

  it("works out the city for a neighbourhood, a city, and anything larger", () => {
    expect(cityOf({ slug: "dhanmondi", type: "area", parentSlug: "dhaka" })).toBe("dhaka");
    expect(cityOf({ slug: "chattogram", type: "city", parentSlug: "chattogram-district" })).toBe("chattogram");
    expect(cityOf({ slug: "dhaka-division", type: "division", parentSlug: null })).toBeNull();
    expect(cityOf(null)).toBeNull();
  });
});

describe("demo repository", () => {
  it("serves every link with its site name and review date", async () => {
    const links = await demoRepository.getExternalSearchLinks();
    expect(links).toHaveLength(externalLinks.length);
    expect(new Set(links.map((link) => link.sourceName))).toEqual(new Set(["Bikroy", "bdHousing", "Bproperty"]));
    expect(links.every((link) => link.lastCheckedAt.startsWith(EXTERNAL_SITES_REVIEWED_ON))).toBe(true);
  });

  it("returns the parent slug when one location is looked up", async () => {
    expect((await demoRepository.getLocationBySlug("dhanmondi"))?.parentSlug).toBe("dhaka");
  });
});

describe("Bangla dates", () => {
  it("formats in Bangladesh time", () => {
    expect(formatDateBn("2026-10-08T00:00:00.000Z")).toBe("৮ অক্টোবর ২০২৬");
    // 19:30 UTC on the 7th is already the 8th in Dhaka.
    expect(formatDateBn("2026-10-07T19:30:00.000Z")).toBe("৮ অক্টোবর ২০২৬");
    expect(formatDateBn("2026-01-01T10:00:00.000Z")).toBe("১ জানুয়ারি ২০২৬");
  });
});
