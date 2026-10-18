import { z } from "zod";
import { PROPERTY_CATEGORIES, PROPERTY_TYPES, PURPOSES } from "./types";
import { SEARCH_MODES, SEARCH_SORTS, SEARCH_VIEWS, type SearchFilters } from "./urls";

/**
 * Turns raw URL query values into validated search filters.
 *
 * Anything malformed is dropped rather than rejected, so a mangled link still
 * opens a useful page. The search page builds its query from this output.
 */

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const optional = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(first, schema.optional().catch(undefined));

const MAX_PRICE = 100_000_000_000;

const schema = z.object({
  mode: optional(z.enum(SEARCH_MODES)),
  purpose: optional(z.enum(PURPOSES)),
  category: optional(z.enum(PROPERTY_CATEGORIES)),
  location: optional(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80)),
  q: optional(z.string().trim().min(1).max(60)),
  type: optional(z.enum(PROPERTY_TYPES)),
  beds: optional(z.coerce.number().int().min(1).max(10)),
  min_price: optional(z.coerce.number().int().positive().max(MAX_PRICE)),
  max_price: optional(z.coerce.number().int().positive().max(MAX_PRICE)),
  sort: optional(z.enum(SEARCH_SORTS)),
  owner: optional(z.literal("1")),
  page: optional(z.coerce.number().int().min(1).max(500)),
  view: optional(z.enum(SEARCH_VIEWS)),
});

export interface ParsedSearch extends SearchFilters {
  /** Free-text place name typed without choosing a suggestion. */
  q?: string;
}

export function parseSearchParams(raw: Record<string, string | string[] | undefined>): ParsedSearch {
  const parsed = schema.parse(raw);
  let minPrice = parsed.min_price;
  let maxPrice = parsed.max_price;
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  return {
    mode: parsed.mode,
    purpose: parsed.purpose,
    category: parsed.category,
    location: parsed.location,
    q: parsed.q,
    propertyType: parsed.type,
    bedrooms: parsed.beds,
    minPrice,
    maxPrice,
    sort: parsed.sort,
    ownerOnly: parsed.owner === "1" ? true : undefined,
    page: parsed.view === "map" ? undefined : parsed.page,
    view: parsed.view === "map" ? "map" : undefined,
  };
}
