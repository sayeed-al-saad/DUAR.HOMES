import { z } from "zod";
import { categoryOf, FURNISHING_LEVELS, PROPERTY_TYPES, PURPOSES, type PropertyType } from "@/lib/domain/types";
import { fromBnDigits } from "@/lib/format/bn";
import { bn } from "@/lib/i18n/bn";

/**
 * What a lister submits, and the rules it must pass. Used by the form in the
 * browser (for quick feedback) and again by the server action (the check that
 * counts). The database enforces its own limits on top.
 */

const e = bn.submit.errors;

export const SUBMITTER_TYPES = ["owner", "agent", "agency", "developer"] as const;
export const MAX_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Anything lower is almost always a typing mistake. */
const PRICE_MIN = { sale: 100_000, rent: 1_000 } as const;
const PRICE_MAX = 50_000_000_000;

/** "০১৭১২-৩৪৫৬৭৮", "+880 1712 345678" → "01712345678". Null when it is not a Bangladeshi mobile number. */
export function normalisePhone(raw: string): string | null {
  const digits = fromBnDigits(raw).replace(/[\s\-().]/g, "");
  const local = digits.replace(/^\+?880/, "0");
  return /^01[3-9]\d{8}$/.test(local) ? local : null;
}

/** Text that looks like it contains a phone number. Contact details belong in the contact fields. */
export function containsPhoneNumber(text: string): boolean {
  const digits = fromBnDigits(text).replace(/[\s\-().]/g, "");
  return /(?:\+?880|0)1[3-9]\d{8}/.test(digits);
}

const blank = (value: unknown) => (typeof value === "string" ? fromBnDigits(value).replace(/,/g, "").trim() : value);
const optionalInt = (min: number, max: number) =>
  z.preprocess((value) => (blank(value) === "" || value === undefined || value === null ? undefined : blank(value)),
    z.coerce.number({ error: e.number }).int(e.number).min(min, e.number).max(max, e.number).optional());
const optionalDecimal = (min: number, max: number) =>
  z.preprocess((value) => (blank(value) === "" || value === undefined || value === null ? undefined : blank(value)),
    z.coerce.number({ error: e.number }).min(min, e.number).max(max, e.number).optional());
const requiredText = (min: number, max: number, short: string) =>
  z.preprocess((value) => (typeof value === "string" ? value.trim() : ""), z.string().min(min, short).max(max, e.tooLong));

/** Whole houses and duplexes have no "which floor": only the building's total floors. */
export function hasFloorNumber(type: PropertyType): boolean {
  return categoryOf(type) !== "land" && type !== "house" && type !== "duplex";
}

/** At least one photo is required. Checked in the browser, where the photos are. */
export const MIN_PHOTOS = 1;

export const submissionSchema = z
  .object({
    purpose: z.enum(PURPOSES, { error: e.required }),
    propertyType: z.enum(PROPERTY_TYPES, { error: e.required }),
    locationSlug: z.string({ error: e.chooseLocation }).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, e.chooseLocation),
    addressLine: requiredText(5, 300, e.address),
    price: z.preprocess(blank, z.coerce.number({ error: e.price }).int(e.price).positive(e.price).max(PRICE_MAX, e.price)),
    priceNegotiable: z.boolean().default(false),
    sizeSqft: optionalInt(100, 1_000_000),
    landSizeKatha: optionalDecimal(0.5, 100_000),
    bedrooms: optionalInt(0, 20),
    bathrooms: optionalInt(0, 20),
    balconies: optionalInt(0, 20),
    floorNumber: optionalInt(0, 150),
    totalFloors: optionalInt(1, 150),
    furnishing: z.enum(FURNISHING_LEVELS).optional(),
    parkingSpaces: optionalInt(0, 50),
    amenities: z.array(z.string().regex(/^[a-z0-9_]+$/)).max(30).default([]),
    title: requiredText(10, 120, e.titleShort),
    description: requiredText(30, 2000, e.descriptionShort),
    listerType: z.enum(SUBMITTER_TYPES, { error: e.required }),
    contactName: z.preprocess((value) => (typeof value === "string" ? value.trim() : ""), z.string().min(1, e.required).max(80, e.tooLong)),
    phone: z.string({ error: e.phone }).transform((value, ctx) => {
      const phone = normalisePhone(value);
      if (!phone) ctx.addIssue({ code: "custom", message: e.phone });
      return phone ?? "";
    }),
    showPhone: z.boolean().default(false),
    hasWhatsapp: z.boolean().default(false),
    agree: z.literal(true, { error: e.agree }),
  })
  .superRefine((data, ctx) => {
    const category = categoryOf(data.propertyType);
    if (data.propertyType === "room" && data.purpose !== "rent") {
      ctx.addIssue({ code: "custom", path: ["purpose"], message: e.required });
    }
    if (data.price < PRICE_MIN[data.purpose]) ctx.addIssue({ code: "custom", path: ["price"], message: e.priceLow });
    if (category === "land" && !data.landSizeKatha) ctx.addIssue({ code: "custom", path: ["landSizeKatha"], message: e.katha });
    // Everything the form shows for this kind of property must be filled in (0 is a fine answer).
    const need = (key: keyof typeof data, message: string) => {
      if (data[key] === undefined) ctx.addIssue({ code: "custom", path: [key], message });
    };
    if (category !== "land") {
      need("sizeSqft", e.size);
      need("bathrooms", e.required);
      need("totalFloors", e.required);
      need("furnishing", e.choose);
      need("parkingSpaces", e.zeroOk);
      if (hasFloorNumber(data.propertyType)) need("floorNumber", e.zeroOk);
    }
    if (category === "residential") need("balconies", e.zeroOk);
    if (category === "residential" && data.propertyType !== "room" && data.bedrooms === undefined) {
      ctx.addIssue({ code: "custom", path: ["bedrooms"], message: e.bedrooms });
    }
    if (data.floorNumber !== undefined && data.totalFloors !== undefined && data.floorNumber > data.totalFloors) {
      ctx.addIssue({ code: "custom", path: ["floorNumber"], message: e.floor });
    }
    if (containsPhoneNumber(data.description)) ctx.addIssue({ code: "custom", path: ["description"], message: e.phoneInText });
    if (containsPhoneNumber(data.title)) ctx.addIssue({ code: "custom", path: ["title"], message: e.phoneInText });
  });

export type SubmissionInput = z.input<typeof submissionSchema>;
export type Submission = z.output<typeof submissionSchema>;
export type SubmissionErrors = Partial<Record<keyof Submission | "form", string>>;

export function submissionErrors(error: z.ZodError): SubmissionErrors {
  const errors: SubmissionErrors = {};
  for (const issue of error.issues) {
    const key = (issue.path[0] ?? "form") as keyof SubmissionErrors;
    errors[key] ??= issue.message;
  }
  return errors;
}

/** Drops facts that do not apply to the kind of property, so nothing odd is stored. */
export function relevantFacts(data: Submission): Submission {
  const category = categoryOf(data.propertyType);
  const residential = category === "residential";
  return {
    ...data,
    landSizeKatha: category === "land" ? data.landSizeKatha : undefined,
    sizeSqft: category === "land" ? undefined : data.sizeSqft,
    bedrooms: residential && data.propertyType !== "room" ? data.bedrooms : undefined,
    bathrooms: category === "land" ? undefined : data.bathrooms,
    balconies: residential ? data.balconies : undefined,
    floorNumber: hasFloorNumber(data.propertyType) ? data.floorNumber : undefined,
    totalFloors: category === "land" ? undefined : data.totalFloors,
    furnishing: category === "land" ? undefined : data.furnishing,
    parkingSpaces: category === "land" ? undefined : data.parkingSpaces,
  };
}
