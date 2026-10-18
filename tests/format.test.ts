import { describe, expect, it } from "vitest";
import {
  daysBetween,
  formatAmountBn,
  formatDaysAgoBn,
  formatNumberBn,
  formatPercentBn,
  formatPriceBn,
  fromBnDigits,
  inLocationBn,
  toBnDigits,
} from "@/lib/format/bn";
import { formatKathaBn, formatSqftBn, kathaToSqft, pricePerSqft, sqftToKatha } from "@/lib/format/units";

describe("Bangla digits", () => {
  it("converts both ways", () => {
    expect(toBnDigits(1234567890)).toBe("১২৩৪৫৬৭৮৯০");
    expect(toBnDigits("3 bed")).toBe("৩ bed");
    expect(fromBnDigits("৪৫,০০০")).toBe("45,000");
  });
});

describe("numbers", () => {
  it("groups the South Asian way", () => {
    expect(formatNumberBn(950)).toBe("৯৫০");
    expect(formatNumberBn(1650)).toBe("১,৬৫০");
    expect(formatNumberBn(45000)).toBe("৪৫,০০০");
    expect(formatNumberBn(1250000)).toBe("১২,৫০,০০০");
    expect(formatNumberBn(123456789)).toBe("১২,৩৪,৫৬,৭৮৯");
  });

  it("keeps decimals only when asked and only when needed", () => {
    expect(formatNumberBn(2.5, 2)).toBe("২.৫");
    expect(formatNumberBn(3, 2)).toBe("৩");
    expect(formatNumberBn(2.5)).toBe("৩");
  });
});

describe("prices", () => {
  it("uses lakh and crore the way people say them", () => {
    expect(formatAmountBn(45_000)).toBe("৪৫,০০০");
    expect(formatAmountBn(100_000)).toBe("১ লাখ");
    expect(formatAmountBn(8_800_000)).toBe("৮৮ লাখ");
    expect(formatAmountBn(140_000)).toBe("১.৪ লাখ");
    expect(formatAmountBn(10_000_000)).toBe("১ কোটি");
    expect(formatAmountBn(24_500_000)).toBe("২.৪৫ কোটি");
    expect(formatAmountBn(37_500_000)).toBe("৩.৭৫ কোটি");
  });

  it("adds the taka sign", () => {
    expect(formatPriceBn(55_000)).toBe("৳ ৫৫,০০০");
    expect(formatPriceBn(58_000_000)).toBe("৳ ৫.৮ কোটি");
  });

  it("formats percentages", () => {
    expect(formatPercentBn(6.5)).toBe("৬.৫%");
    expect(formatPercentBn(10)).toBe("১০%");
  });
});

describe("relative days", () => {
  it("counts whole days and never goes negative", () => {
    expect(daysBetween("2026-10-01T00:00:00Z", "2026-10-08T12:00:00Z")).toBe(7);
    expect(daysBetween("2026-10-08T00:00:00Z", "2026-10-01T00:00:00Z")).toBe(0);
  });

  it("reads naturally", () => {
    expect(formatDaysAgoBn(0)).toBe("আজ");
    expect(formatDaysAgoBn(1)).toBe("গতকাল");
    expect(formatDaysAgoBn(5)).toBe("৫ দিন আগে");
    expect(formatDaysAgoBn(21)).toBe("৩ সপ্তাহ আগে");
    expect(formatDaysAgoBn(90)).toBe("৩ মাস আগে");
    expect(formatDaysAgoBn(800)).toBe("২ বছর আগে");
  });
});

describe("locative ending for place names", () => {
  it.each([
    ["ঢাকা", "ঢাকায়"],
    ["উত্তরা", "উত্তরায়"],
    ["মিরপুর", "মিরপুরে"],
    ["গুলশান", "গুলশানে"],
    ["সিলেট", "সিলেটে"],
    ["ধানমন্ডি", "ধানমন্ডিতে"],
    ["বনানী", "বনানীতে"],
    ["খুলশী", "খুলশীতে"],
    ["বসুন্ধরা আবাসিক এলাকা", "বসুন্ধরা আবাসিক এলাকায়"],
    ["GEC", "GEC-এ"],
  ])("%s → %s", (name, expected) => {
    expect(inLocationBn(name)).toBe(expected);
  });
});

describe("units", () => {
  it("converts katha and square feet", () => {
    expect(kathaToSqft(5)).toBe(3600);
    expect(sqftToKatha(1440)).toBe(2);
  });

  it("formats sizes", () => {
    expect(formatSqftBn(1650)).toBe("১,৬৫০ বর্গফুট");
    expect(formatKathaBn(2.5)).toBe("২.৫ কাঠা");
  });

  it("gives price per sq ft, or null when it cannot be worked out", () => {
    expect(pricePerSqft(24_500_000, 1650)).toBe(14848);
    expect(pricePerSqft(24_500_000, null)).toBeNull();
    expect(pricePerSqft(24_500_000, 0)).toBeNull();
  });
});
