import type { PropertyCategory, Purpose, SourceType } from "@/lib/domain/types";

/**
 * REAL property sites and REAL links to their public listing pages.
 *
 * What this is: a register of other Bangladeshi property sites, with links
 * that take a visitor straight to that site's own search pages.
 *
 * What this is not: copied listings. Nothing from these sites is stored here,
 * no prices, no titles, no photos, no phone numbers. See docs/external-sources.md
 * for what each site's robots.txt and published terms said when they were read.
 *
 * Every URL below was opened and confirmed to be a working listing page on the
 * review date. Sites change their URLs; re-check before relying on them.
 *
 * `npm run db:generate` turns this file into
 * supabase/migrations/20261008000900_external_sites_data.sql.
 */

export const EXTERNAL_SITES_REVIEWED_ON = "2026-10-08";

export interface ExternalLinkSeed {
  url: string;
  /** null means the page mixes sale and rent. */
  purpose: Purpose | null;
  /** null means the page mixes property kinds. */
  category: PropertyCategory | null;
  /** One of our location slugs, or null for all of Bangladesh. */
  location: string | null;
}

export interface ExternalSiteSeed {
  slug: string;
  name: string;
  website: string;
  sourceType: SourceType;
  /** Internal notes: what was checked and what it said. Stored in sources.notes. */
  reviewNotes: string;
  links: ExternalLinkSeed[];
}

export const EXTERNAL_SITES: ExternalSiteSeed[] = [
  {
    slug: "bikroy",
    name: "Bikroy",
    website: "https://bikroy.com",
    sourceType: "classifieds",
    reviewNotes:
      "Reviewed 2026-10-08. robots.txt allows crawlers on listing pages (blocks only /test, /admin, /crm, /auth/facebook). " +
      "Terms (bikroy.com/rules.html) apply to anyone who uses the site; section 7.16 says users will not copy, modify or " +
      "distribute other users' content without that user's consent, and 7.17 forbids collecting information about users. " +
      "Conclusion: link to their public pages only. Do not ingest listings without written permission from Bikroy.",
    links: [
      { url: "https://bikroy.com/en/ads/dhaka/apartment-rentals", purpose: "rent", category: "residential", location: "dhaka" },
      { url: "https://bikroy.com/dhaka/houses-apartments-for-sale", purpose: "sale", category: "residential", location: "dhaka" },
      { url: "https://bikroy.com/dhaka/land-and-plots-for-sale", purpose: "sale", category: "land", location: "dhaka" },
      { url: "https://bikroy.com/dhaka/commercial-property-for-rent", purpose: "rent", category: "commercial", location: "dhaka" },
      { url: "https://bikroy.com/chattogram/houses-apartments-for-rent", purpose: "rent", category: "residential", location: "chattogram" },
      { url: "https://bikroy.com/en/ads/sylhet/apartments-for-sale", purpose: "sale", category: "residential", location: "sylhet" },
      { url: "https://bikroy.com/en/ads/sylhet/property", purpose: null, category: null, location: "sylhet" },
      { url: "https://bikroy.com/houses-apartments-for-rent", purpose: "rent", category: "residential", location: null },
      { url: "https://bikroy.com/houses-apartments-for-sale", purpose: "sale", category: "residential", location: null },
      { url: "https://bikroy.com/land-and-plots-for-sale", purpose: "sale", category: "land", location: null },
      { url: "https://bikroy.com/en/ads/bangladesh/commercial-property-rentals", purpose: "rent", category: "commercial", location: null },
    ],
  },
  {
    slug: "bdhousing",
    name: "bdHousing",
    website: "https://www.bdhousing.com",
    sourceType: "portal",
    reviewNotes:
      "Reviewed 2026-10-08. robots.txt blocks only /admin. Terms (bdhousing.com/terms-conditions) say visitors must not " +
      "republish, reproduce, duplicate or copy material from the site. The same terms let search engines link to the site " +
      "without prior approval, provided the link is not misleading and uses no logo or artwork; bdHousing may ask for links " +
      "to be removed. Conclusion: link only, by name. Do not ingest listings without written permission from bdHousing.",
    links: [
      { url: "https://www.bdhousing.com/homes/listings/Rent/Residential/Apartment", purpose: "rent", category: "residential", location: null },
      { url: "https://www.bdhousing.com/homes/listings/Sale/Residential/Apartment", purpose: "sale", category: "residential", location: null },
      { url: "https://www.bdhousing.com/homes/listings/Sale/Land/commercial-plot", purpose: "sale", category: "land", location: null },
    ],
  },
  {
    slug: "bproperty",
    name: "Bproperty",
    website: "https://www.bproperty.com",
    sourceType: "portal",
    reviewNotes:
      "Reviewed 2026-10-08. robots.txt allows everything except /dashboard. The terms page (bproperty.com/terms-of-use) " +
      "timed out and could not be read, so what it allows is unknown. " +
      "Conclusion: link only. Read the terms and get permission before ingesting any listing.",
    links: [
      { url: "https://www.bproperty.com/category/apartment?city=dhaka", purpose: null, category: "residential", location: "dhaka" },
      { url: "https://www.bproperty.com/for-sale?category=apartment&cities=dhaka", purpose: "sale", category: "residential", location: null },
      { url: "https://www.bproperty.com/for-sale", purpose: "sale", category: null, location: null },
    ],
  },
];
