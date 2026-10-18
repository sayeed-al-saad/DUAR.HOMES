import { describe, expect, it } from "vitest";
import {
  containsPhoneNumber,
  normalisePhone,
  relevantFacts,
  submissionErrors,
  submissionSchema,
  type SubmissionInput,
} from "@/lib/listings/submission-schema";

const flat: SubmissionInput = {
  purpose: "rent",
  propertyType: "apartment",
  locationSlug: "uttara",
  addressLine: "  Road 7, Sector 4  ",
  price: "৩২,০০০",
  priceNegotiable: false,
  sizeSqft: "1250",
  bedrooms: "3",
  bathrooms: "2",
  balconies: "2",
  floorNumber: "4",
  totalFloors: "6",
  furnishing: "semi_furnished",
  parkingSpaces: "0",
  amenities: ["lift"],
  title: "South-facing 3 bed flat in Uttara",
  description: "South-facing flat near the park, five minutes from the main road.",
  listerType: "owner",
  contactName: "Rahim",
  phone: "+880 1712-345678",
  agree: true,
};

const errorsFor = (input: Record<string, unknown>) => {
  const result = submissionSchema.safeParse({ ...flat, ...input });
  return result.success ? {} : submissionErrors(result.error);
};

describe("normalisePhone", () => {
  it.each([
    ["01712345678", "01712345678"],
    ["+8801712345678", "01712345678"],
    ["880 1712 345678", "01712345678"],
    ["০১৭১২-৩৪৫৬৭৮", "01712345678"],
    ["(017) 1234.5678", "01712345678"],
  ])("%s → %s", (raw, expected) => expect(normalisePhone(raw)).toBe(expected));

  it.each(["", "0171234567", "017123456789", "01212345678", "02-9123456", "+44 7700 900123"])("rejects %s", (raw) =>
    expect(normalisePhone(raw)).toBeNull(),
  );
});

describe("containsPhoneNumber", () => {
  it("finds numbers written in many ways", () => {
    expect(containsPhoneNumber("Call 01712345678 today")).toBe(true);
    expect(containsPhoneNumber("ফোন: ০১৭১২-৩৪৫৬৭৮")).toBe(true);
    expect(containsPhoneNumber("whatsapp +880 1812 345 678")).toBe(true);
  });
  it("leaves prices and sizes alone", () => {
    expect(containsPhoneNumber("1250 sqft, 3 beds, 32000 per month, built 2019")).toBe(false);
    expect(containsPhoneNumber("৳ ১,২০,০০,০০০")).toBe(false);
  });
});

describe("submissionSchema", () => {
  it("accepts a complete flat and normalises it", () => {
    const data = submissionSchema.parse(flat);
    expect(data.price).toBe(32_000);
    expect(data.bedrooms).toBe(3);
    expect(data.phone).toBe("01712345678");
    expect(data.addressLine).toBe("Road 7, Sector 4");
  });

  it("needs the agreement", () => expect(errorsFor({ agree: false })).toHaveProperty("agree"));
  it("needs a valid phone", () => expect(errorsFor({ phone: "12345" })).toHaveProperty("phone"));
  it("needs a place, not free text", () => expect(errorsFor({ locationSlug: "Uttara, Dhaka" })).toHaveProperty("locationSlug"));
  it("refuses prices that are almost certainly typos", () => {
    expect(errorsFor({ price: "500" })).toHaveProperty("price");
    expect(errorsFor({ purpose: "sale", price: "50000" })).toHaveProperty("price");
    expect(errorsFor({ purpose: "sale", price: "1,20,00,000" })).toEqual({});
  });
  it("needs bedrooms for homes but not for rooms", () => {
    expect(errorsFor({ bedrooms: "" })).toHaveProperty("bedrooms");
    expect(errorsFor({ propertyType: "room", bedrooms: "" })).toEqual({});
  });
  it("rents rooms only", () => expect(errorsFor({ propertyType: "room", purpose: "sale", price: "500000" })).toHaveProperty("purpose"));
  it("needs katha for land", () => {
    expect(errorsFor({ propertyType: "plot", purpose: "sale", price: "5000000", bedrooms: "" })).toHaveProperty("landSizeKatha");
    expect(errorsFor({ propertyType: "plot", purpose: "sale", price: "5000000", landSizeKatha: "3.5" })).toEqual({});
  });
  it("keeps the floor within the building", () => expect(errorsFor({ floorNumber: "8" })).toHaveProperty("floorNumber"));
  it("keeps phone numbers out of the title and description", () => {
    expect(errorsFor({ description: "Call ০১৭১২৩৪৫৬৭৮" })).toHaveProperty("description");
    expect(errorsFor({ title: "Flat 01812345678" })).toHaveProperty("title");
  });
});

describe("relevantFacts", () => {
  it("drops facts that do not apply to land", () => {
    const land = relevantFacts(
      submissionSchema.parse({ ...flat, propertyType: "plot", purpose: "sale", price: "5000000", landSizeKatha: "3" }),
    );
    expect(land.landSizeKatha).toBe(3);
    expect(land.bedrooms).toBeUndefined();
    expect(land.sizeSqft).toBeUndefined();
    expect(land.floorNumber).toBeUndefined();
  });
});

describe("phone choices", () => {
  it("keep the number hidden unless the lister says otherwise", () => {
    const parsed = submissionSchema.parse(flat);
    expect(parsed.showPhone).toBe(false);
    expect(parsed.hasWhatsapp).toBe(false);
  });

  it("pass the lister's choices through", () => {
    const parsed = submissionSchema.parse({ ...flat, showPhone: true, hasWhatsapp: true });
    expect(parsed.showPhone).toBe(true);
    expect(parsed.hasWhatsapp).toBe(true);
  });
});

describe("required fields", () => {
  it("needs an address, a real title and a real description", () => {
    const errors = errorsFor({ addressLine: " ", title: "ফ্ল্যাট", description: "ভালো ফ্ল্যাট" });
    expect(errors).toHaveProperty("addressLine");
    expect(errors).toHaveProperty("title");
    expect(errors).toHaveProperty("description");
  });

  it("needs every fact shown for a flat, but 0 is a fine answer", () => {
    for (const key of ["sizeSqft", "bathrooms", "balconies", "floorNumber", "totalFloors", "parkingSpaces"]) {
      expect(errorsFor({ [key]: "" }), key).toHaveProperty(key);
    }
    expect(errorsFor({ furnishing: undefined })).toHaveProperty("furnishing");
    expect(errorsFor({ balconies: "০", parkingSpaces: "0" })).toEqual({});
  });

  it("does not ask which floor a whole house is on, and drops it if sent", () => {
    const house = { propertyType: "house", floorNumber: "" };
    expect(errorsFor(house)).toEqual({});
    const parsed = submissionSchema.parse({ ...flat, ...house, floorNumber: "3" });
    expect(relevantFacts(parsed).floorNumber).toBeUndefined();
  });

  it("asks a plot only for its size in katha, not flat facts", () => {
    const plot = {
      propertyType: "plot",
      purpose: "sale",
      price: "5000000",
      landSizeKatha: "3",
      sizeSqft: "",
      bedrooms: "",
      bathrooms: "",
      balconies: "",
      floorNumber: "",
      totalFloors: "",
      furnishing: undefined,
      parkingSpaces: "",
    };
    expect(errorsFor(plot)).toEqual({});
  });
});
