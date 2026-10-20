import { describe, expect, it } from "vitest";
import { privacyPolicy, termsOfUse, LEGAL_UPDATED_AT } from "@/lib/legal/content";

const site = { name: "দুয়ার", contactEmail: "info@duar.homes" };

describe.each([
  ["privacy", privacyPolicy(site)],
  ["terms", termsOfUse(site)],
])("%s page", (_, doc) => {
  it("has unique section ids for the contents links", () => {
    const ids = doc.sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z-]+$/);
  });

  it("tells people how to reach us", () => {
    expect(JSON.stringify(doc)).toContain(site.contactEmail);
  });

  it("has no empty sections", () => {
    for (const section of doc.sections) expect(section.blocks.length).toBeGreaterThan(0);
  });
});

describe("legal pages", () => {
  it("has a valid date", () => {
    expect(Number.isNaN(Date.parse(LEGAL_UPDATED_AT))).toBe(false);
  });

  it("promises the privacy rules the site actually keeps", () => {
    const text = JSON.stringify(privacyPolicy(site));
    expect(text).toContain("GPS");
    expect(text).toContain("বিক্রি করি না");
    expect(text).toContain("Supabase");
  });

  it("makes no guarantee about listings", () => {
    const text = JSON.stringify(termsOfUse(site));
    expect(text).toContain("নিশ্চয়তা দিতে পারি না");
    expect(text).toContain("ব্রোকার");
  });
});
