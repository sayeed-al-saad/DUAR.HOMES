import type { PropertyCategory, PropertyType, Purpose } from "./types";
import type { SearchMode } from "./urls";

/**
 * Choices offered by the search panel. Shared by the home page now and the
 * full search page in Phase 2, so both always offer the same options.
 */

export interface ModeConfig {
  /** What the mode fixes. `null` purpose means the visitor chooses. */
  purpose: Purpose | null;
  category: PropertyCategory;
  types: PropertyType[];
  showBedrooms: boolean;
}

export const MODE_CONFIG: Record<SearchMode, ModeConfig> = {
  buy: { purpose: "sale", category: "residential", types: ["apartment", "house", "duplex"], showBedrooms: true },
  rent: { purpose: "rent", category: "residential", types: ["apartment", "house", "duplex", "room"], showBedrooms: true },
  land: { purpose: "sale", category: "land", types: ["plot", "land"], showBedrooms: false },
  commercial: {
    purpose: null,
    category: "commercial",
    types: ["office", "shop", "commercial_space", "warehouse"],
    showBedrooms: false,
  },
};

const LAKH = 100_000;
const CRORE = 10_000_000;

/** Total price steps for sale, in BDT. */
export const SALE_PRICE_STEPS = [
  20 * LAKH, 30 * LAKH, 40 * LAKH, 50 * LAKH, 60 * LAKH, 80 * LAKH,
  1 * CRORE, 1.25 * CRORE, 1.5 * CRORE, 2 * CRORE, 2.5 * CRORE, 3 * CRORE, 4 * CRORE, 5 * CRORE, 7.5 * CRORE, 10 * CRORE,
];

/** Monthly rent steps, in BDT. */
export const RENT_PRICE_STEPS = [
  5_000, 10_000, 15_000, 20_000, 25_000, 30_000, 40_000, 50_000, 60_000, 80_000,
  1 * LAKH, 1.5 * LAKH, 2 * LAKH, 3 * LAKH, 5 * LAKH,
];

export function priceSteps(purpose: Purpose): number[] {
  return purpose === "rent" ? RENT_PRICE_STEPS : SALE_PRICE_STEPS;
}

/** "At least this many bedrooms". */
export const BEDROOM_OPTIONS = [1, 2, 3, 4, 5];
