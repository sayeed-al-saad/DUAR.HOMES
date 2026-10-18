import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirects";
import { hasAnyRole, isAdmin, isLister, isStaff } from "@/lib/auth/roles";
import { loginSchema, signupSchema } from "@/lib/auth/validation";
import { getFreshness } from "@/lib/domain/freshness";
import { buildListingSlug, buildListingTitle } from "@/lib/domain/listing-title";
import { parseSearchParams } from "@/lib/domain/search-params";
import { categoryOf, PROPERTY_TYPES, typesInCategory } from "@/lib/domain/types";
import { listingPath, searchPath } from "@/lib/domain/urls";

const NOW = new Date("2026-10-08T06:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

describe("freshness", () => {
  it("is new in the first week", () => {
    expect(getFreshness({ status: "active", firstSeenAt: daysAgo(3), lastCheckedAt: daysAgo(1) }, NOW)).toBe("new");
  });

  it("is recently verified when older but checked within two weeks", () => {
    expect(getFreshness({ status: "active", firstSeenAt: daysAgo(30), lastCheckedAt: daysAgo(10) }, NOW)).toBe("recently_verified");
  });

  it("is old when not checked for more than two weeks", () => {
    expect(getFreshness({ status: "active", firstSeenAt: daysAgo(30), lastCheckedAt: daysAgo(20) }, NOW)).toBe("old");
  });

  it("is likely inactive after 45 days without a check, or when marked stale", () => {
    expect(getFreshness({ status: "active", firstSeenAt: daysAgo(60), lastCheckedAt: daysAgo(50) }, NOW)).toBe("likely_inactive");
    expect(getFreshness({ status: "stale", firstSeenAt: daysAgo(2), lastCheckedAt: daysAgo(0) }, NOW)).toBe("likely_inactive");
  });

  it("does not call a just-seen listing new if nobody has checked it for weeks", () => {
    expect(getFreshness({ status: "active", firstSeenAt: daysAgo(5), lastCheckedAt: daysAgo(16) }, NOW)).toBe("old");
  });
});

describe("property categories", () => {
  it("puts every type in exactly one category", () => {
    const all = [...typesInCategory("residential"), ...typesInCategory("land"), ...typesInCategory("commercial")];
    expect(all.sort()).toEqual([...PROPERTY_TYPES].sort());
    expect(categoryOf("plot")).toBe("land");
    expect(categoryOf("shop")).toBe("commercial");
    expect(categoryOf("room")).toBe("residential");
  });
});

describe("generated listing titles and slugs", () => {
  it("describes the property from its facts", () => {
    expect(buildListingTitle({ propertyType: "apartment", purpose: "sale", bedrooms: 3 })).toBe("৩ বেডের ফ্ল্যাট");
    expect(buildListingTitle({ propertyType: "plot", purpose: "sale", landSizeKatha: 2.5 })).toBe("২.৫ কাঠা প্লট");
    expect(buildListingTitle({ propertyType: "office", purpose: "rent", sizeSqft: 1800 })).toBe("১,৮০০ বর্গফুটের অফিস");
    expect(buildListingTitle({ propertyType: "house", purpose: "rent" })).toBe("বাড়ি");
  });

  it("builds URL-safe English slugs", () => {
    expect(buildListingSlug({ propertyType: "apartment", purpose: "sale", bedrooms: 3 }, "dhn-s1")).toBe(
      "3-bedroom-apartment-for-sale-dhn-s1",
    );
    expect(buildListingSlug({ propertyType: "plot", purpose: "sale", landSizeKatha: 2.5 }, "X_1")).toBe("2-5-katha-plot-for-sale-x-1");
    expect(buildListingSlug({ propertyType: "commercial_space", purpose: "rent" }, "a")).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe("URLs", () => {
  it("builds listing paths in the /property/{area}/{slug} shape", () => {
    expect(listingPath({ locationSlug: "uttara", slug: "3-bedroom-apartment-for-sale-utt-s1" })).toBe(
      "/property/uttara/3-bedroom-apartment-for-sale-utt-s1",
    );
  });

  it("leaves unset filters out of search URLs", () => {
    expect(searchPath()).toBe("/search");
    expect(searchPath({ mode: "rent", location: "dhanmondi", bedrooms: 3, maxPrice: 60000 })).toBe(
      "/search?mode=rent&location=dhanmondi&beds=3&max_price=60000",
    );
  });
});

describe("search parameter parsing", () => {
  it("accepts well-formed values", () => {
    expect(
      parseSearchParams({ mode: "buy", location: "dhanmondi", type: "apartment", beds: "3", min_price: "5000000", max_price: "20000000" }),
    ).toMatchObject({ mode: "buy", location: "dhanmondi", propertyType: "apartment", bedrooms: 3, minPrice: 5_000_000, maxPrice: 20_000_000 });
  });

  it("drops anything malformed instead of failing", () => {
    const parsed = parseSearchParams({
      mode: "steal",
      location: "../../etc/passwd",
      type: "castle",
      beds: "-4",
      min_price: "abc",
      max_price: "1e99",
      sort: "'; drop table",
      owner: "yes",
    });
    expect(Object.values(parsed).every((value) => value === undefined)).toBe(true);
  });

  it("swaps a reversed price range and takes the first of repeated values", () => {
    expect(parseSearchParams({ min_price: "90000", max_price: "20000" })).toMatchObject({ minPrice: 20_000, maxPrice: 90_000 });
    expect(parseSearchParams({ mode: ["rent", "buy"] }).mode).toBe("rent");
  });
});

describe("redirect targets", () => {
  it("allows paths on this site", () => {
    expect(safeNextPath("/account")).toBe("/account");
    expect(safeNextPath("/search?mode=rent")).toBe("/search?mode=rent");
  });

  it("refuses anything that could leave the site", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined, 42]) {
      expect(safeNextPath(bad)).toBe("/account");
    }
  });
});

describe("roles", () => {
  it("separates members, listers and staff", () => {
    expect(isStaff("moderator")).toBe(true);
    expect(isStaff("agent")).toBe(false);
    expect(isAdmin("moderator")).toBe(false);
    expect(isAdmin("admin")).toBe(true);
    expect(isLister("owner")).toBe(true);
    expect(isLister("member")).toBe(false);
    expect(hasAnyRole("developer", ["agent", "developer"])).toBe(true);
  });
});

describe("sign-up and login validation", () => {
  it("normalises the email address", () => {
    const parsed = loginSchema.parse({ email: "  Someone@Example.COM ", password: "x" });
    expect(parsed.email).toBe("someone@example.com");
  });

  it("rejects bad input with a Bangla message", () => {
    const result = signupSchema.safeParse({ displayName: " ", email: "not-an-email", password: "short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain("আপনার নাম লিখুন।");
      expect(messages).toContain("সঠিক ইমেইল ঠিকানা লিখুন।");
      expect(messages).toContain("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।");
    }
  });

  it("accepts a normal sign-up", () => {
    expect(signupSchema.safeParse({ displayName: "রহিম", email: "rahim@example.com", password: "long-enough-1" }).success).toBe(true);
  });
});
