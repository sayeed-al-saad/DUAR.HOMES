import type {
  Furnishing,
  IngestionMethod,
  ListerType,
  ListingStatus,
  PermissionStatus,
  PropertyType,
  Purpose,
  SourceType,
} from "@/lib/domain/types";

/**
 * DEMO DATA. Nothing in this file describes a real property, person, company
 * or website.
 *
 * It exists so the site has something to show before real listings arrive.
 * Every row it produces is flagged `is_demo = true` in the database, and
 * supabase/remove_demo_data.sql deletes all of it in one go.
 *
 * `npm run db:generate` turns this file into supabase/seed.sql.
 */

export interface SourceSeed {
  slug: string;
  name: string;
  website: string | null;
  sourceType: SourceType;
  ingestionMethod: IngestionMethod;
  permissionStatus: PermissionStatus;
  active: boolean;
  allowImages: boolean;
  allowDescription: boolean;
  allowContact: boolean;
  notes: string;
  isDemo: boolean;
}

/** Our own listings. This is the one row here that is not demo data. */
export const FIRST_PARTY_SOURCE: SourceSeed = {
  slug: "duar",
  name: "দুয়ার",
  website: null,
  sourceType: "first_party",
  ingestionMethod: "manual",
  permissionStatus: "not_required",
  active: true,
  allowImages: true,
  allowDescription: true,
  allowContact: true,
  notes: "Listings created on this site by owners, agents, agencies and developers.",
  isDemo: false,
};

/**
 * Made-up external sources on reserved example domains. They show how
 * attribution and per-source permissions work without naming a real portal.
 */
export const DEMO_SOURCES: SourceSeed[] = [
  {
    slug: "demo-portal-ka",
    name: "ডেমো পোর্টাল ক",
    website: "https://example.com",
    sourceType: "portal",
    ingestionMethod: "partner_feed",
    permissionStatus: "granted",
    active: true,
    allowImages: false,
    allowDescription: false,
    allowContact: false,
    notes: "DEMO. Stands in for a portal that has agreed to share basic listing facts through a feed.",
    isDemo: true,
  },
  {
    slug: "demo-portal-kha",
    name: "ডেমো পোর্টাল খ",
    website: "https://example.org",
    sourceType: "classifieds",
    ingestionMethod: "public_page",
    permissionStatus: "granted",
    active: true,
    allowImages: false,
    allowDescription: false,
    allowContact: false,
    notes: "DEMO. Stands in for a classifieds site that permits indexing of its public listing pages.",
    isDemo: true,
  },
  {
    slug: "demo-agency-feed",
    name: "ডেমো এজেন্সি ফিড",
    website: "https://example.net",
    sourceType: "agency_site",
    ingestionMethod: "rss_feed",
    permissionStatus: "granted",
    active: true,
    allowImages: false,
    allowDescription: false,
    allowContact: false,
    notes: "DEMO. Stands in for an agency that publishes its own listing feed.",
    isDemo: true,
  },
  {
    slug: "demo-source-off",
    name: "ডেমো সোর্স (বন্ধ)",
    website: "https://off.example.com",
    sourceType: "portal",
    ingestionMethod: "public_page",
    permissionStatus: "not_requested",
    active: false,
    allowImages: false,
    allowDescription: false,
    allowContact: false,
    notes: "DEMO. A source that stays switched off because permission has not been arranged.",
    isDemo: true,
  },
];

export interface AgencySeed {
  slug: string;
  name: string;
  kind: "agency" | "developer";
  location: string;
  isVerified: boolean;
}

export const DEMO_AGENCIES: AgencySeed[] = [
  { slug: "demo-nilachol-properties", name: "নীলাচল প্রপার্টিজ (ডেমো)", kind: "agency", location: "gulshan", isVerified: true },
  { slug: "demo-shapla-developers", name: "শাপলা ডেভেলপারস (ডেমো)", kind: "developer", location: "bashundhara", isVerified: true },
];

export interface AgentSeed {
  slug: string;
  displayName: string;
  agency: string | null;
  isVerified: boolean;
}

export const DEMO_AGENTS: AgentSeed[] = [
  { slug: "demo-agent-ka", displayName: "ডেমো এজেন্ট ক", agency: "demo-nilachol-properties", isVerified: true },
  { slug: "demo-agent-kha", displayName: "ডেমো এজেন্ট খ", agency: null, isVerified: false },
];

export interface ListingSeed {
  /** Stable key. Ids and slugs are derived from it. */
  key: string;
  /** Reuse the physical property of another listing (one property, several listings). */
  sameAs?: string;
  loc: string;
  type: PropertyType;
  purpose: Purpose;
  /** BDT. Total price for sale, monthly rent for rent. */
  price: number;
  /** Earlier asking price and how many days ago it changed. */
  prev?: [price: number, daysAgo: number];
  sqft?: number;
  katha?: number;
  beds?: number;
  baths?: number;
  balconies?: number;
  floor?: number;
  floors?: number;
  furnishing?: Furnishing;
  parking?: number;
  amenities?: string[];
  source: string;
  lister: ListerType;
  agency?: string;
  agent?: string;
  verified?: boolean;
  /** Days since the listing was first seen. */
  seen: number;
  /** Days since it was last checked. */
  checked: number;
  views: number;
  status?: ListingStatus;
  /** Demo illustration in /public/demo. First-party listings only. */
  art?: string;
  /** Lister-written title. First-party listings only; others get a factual generated title. */
  title?: string;
  description?: string;
}

const FLAT = ["lift", "generator", "parking", "security_guard", "gas_line"];
const FLAT_PLUS = [...FLAT, "cctv", "intercom", "fire_safety", "rooftop"];
const LUXURY = [...FLAT_PLUS, "gym", "community_hall", "swimming_pool"];
const BASIC = ["security_guard", "water_supply"];
const OFFICE = ["lift", "generator", "parking", "cctv", "fire_safety", "air_conditioning"];
const PLOT = ["boundary_wall", "road_access"];

export const DEMO_LISTINGS: ListingSeed[] = [
  // Dhanmondi
  {
    key: "dhn-s1", loc: "dhanmondi", type: "apartment", purpose: "sale", price: 24_500_000,
    sqft: 1650, beds: 3, baths: 3, balconies: 2, floor: 5, floors: 9, furnishing: "unfurnished", parking: 1,
    amenities: FLAT_PLUS, source: "duar", lister: "owner", verified: true, seen: 2, checked: 0, views: 640,
    art: "apartment-01", title: "লেকের কাছে দক্ষিণমুখী ৩ বেডের ফ্ল্যাট",
    description: "ডেমো বিবরণ। লেকের কাছাকাছি শান্ত রাস্তায় দক্ষিণমুখী ফ্ল্যাট। দুই পাশে বারান্দা, আলো-বাতাস ভালো।",
  },
  {
    key: "dhn-s2", loc: "dhanmondi", type: "apartment", purpose: "sale", price: 36_000_000, prev: [38_500_000, 6],
    sqft: 2200, beds: 4, baths: 4, floor: 7, floors: 12, parking: 2, amenities: FLAT,
    source: "demo-portal-ka", lister: "agent", seen: 20, checked: 3, views: 210,
  },
  {
    key: "dhn-r1", loc: "dhanmondi", type: "apartment", purpose: "rent", price: 55_000,
    sqft: 1450, beds: 3, baths: 3, balconies: 2, floor: 3, floors: 8, furnishing: "unfurnished", parking: 1,
    amenities: FLAT, source: "duar", lister: "owner", seen: 5, checked: 1, views: 820, art: "apartment-02",
    title: "পরিবারের জন্য ৩ বেডের খোলামেলা ফ্ল্যাট",
  },
  {
    key: "dhn-r2", loc: "dhanmondi", type: "apartment", purpose: "rent", price: 38_000,
    sqft: 1100, beds: 2, baths: 2, floor: 2, floors: 6, amenities: BASIC,
    source: "demo-portal-kha", lister: "unknown", seen: 30, checked: 18, views: 95,
  },

  // Gulshan
  {
    key: "gul-s1", loc: "gulshan", type: "apartment", purpose: "sale", price: 58_000_000,
    sqft: 2400, beds: 4, baths: 4, balconies: 3, floor: 9, floors: 14, furnishing: "semi_furnished", parking: 2,
    amenities: LUXURY, source: "duar", lister: "developer", agency: "demo-shapla-developers", verified: true,
    seen: 12, checked: 2, views: 930, art: "apartment-03", title: "লেকভিউ ৪ বেডের নতুন ফ্ল্যাট",
    description: "ডেমো বিবরণ। নতুন ভবনের উঁচু তলায় চার বেডের ফ্ল্যাট। জিম, কমিউনিটি হল আর দুটি গাড়ির পার্কিং আছে।",
  },
  {
    key: "gul-s2", loc: "gulshan", type: "apartment", purpose: "sale", price: 42_000_000,
    sqft: 1900, beds: 3, baths: 3, floor: 4, floors: 10, parking: 1, amenities: FLAT_PLUS,
    source: "demo-portal-ka", lister: "agency", seen: 40, checked: 10, views: 300,
  },
  {
    key: "gul-r1", loc: "gulshan", type: "apartment", purpose: "rent", price: 140_000,
    sqft: 2200, beds: 3, baths: 4, balconies: 2, floor: 6, floors: 12, furnishing: "furnished", parking: 2,
    amenities: LUXURY, source: "duar", lister: "agent", agent: "demo-agent-ka", agency: "demo-nilachol-properties",
    verified: true, seen: 3, checked: 0, views: 700, art: "apartment-04", title: "আসবাবসহ ৩ বেডের ফ্ল্যাট",
  },
  {
    key: "gul-r2", loc: "gulshan", type: "apartment", purpose: "rent", price: 95_000, prev: [110_000, 2],
    sqft: 1800, beds: 3, baths: 3, floor: 5, floors: 9, furnishing: "semi_furnished", parking: 1, amenities: FLAT_PLUS,
    source: "demo-agency-feed", lister: "agent", seen: 9, checked: 4, views: 150,
  },
  {
    key: "gul-c1", loc: "gulshan", type: "office", purpose: "rent", price: 250_000,
    sqft: 3200, baths: 4, floor: 8, floors: 16, parking: 3, amenities: OFFICE,
    source: "duar", lister: "agency", agency: "demo-nilachol-properties", seen: 15, checked: 5, views: 260,
    art: "commercial-01", title: "মূল সড়কের পাশে ৩,২০০ বর্গফুটের অফিস",
  },
  {
    key: "gul-sold", loc: "gulshan", type: "apartment", purpose: "sale", price: 39_500_000,
    sqft: 1750, beds: 3, baths: 3, floor: 3, floors: 9, parking: 1, amenities: FLAT,
    source: "duar", lister: "owner", seen: 70, checked: 12, views: 410, status: "sold", art: "apartment-05",
    title: "৩ বেডের ফ্ল্যাট",
  },

  // Banani
  {
    key: "ban-s1", loc: "banani", type: "apartment", purpose: "sale", price: 33_000_000,
    sqft: 1750, beds: 3, baths: 3, balconies: 2, floor: 6, floors: 10, parking: 1, amenities: FLAT_PLUS,
    source: "duar", lister: "owner", seen: 1, checked: 0, views: 180, art: "apartment-06",
    title: "৩ বেডের রেডি ফ্ল্যাট",
  },
  {
    key: "ban-s2", loc: "banani", type: "apartment", purpose: "sale", price: 29_000_000,
    sqft: 1600, beds: 3, baths: 3, floor: 2, floors: 7, parking: 1, amenities: FLAT,
    source: "demo-portal-kha", lister: "unknown", seen: 60, checked: 50, views: 60,
  },
  {
    key: "ban-r1", loc: "banani", type: "apartment", purpose: "rent", price: 75_000, prev: [82_000, 4],
    sqft: 1500, beds: 3, baths: 3, balconies: 2, floor: 4, floors: 9, furnishing: "semi_furnished", parking: 1,
    amenities: FLAT_PLUS, source: "duar", lister: "owner", verified: true, seen: 6, checked: 1, views: 540,
    art: "apartment-07", title: "৩ বেডের ফ্ল্যাট, আংশিক আসবাবসহ",
  },
  {
    key: "ban-r2", loc: "banani", type: "apartment", purpose: "rent", price: 60_000,
    sqft: 1300, beds: 2, baths: 2, floor: 3, floors: 8, parking: 1, amenities: FLAT,
    source: "demo-portal-ka", lister: "agent", seen: 14, checked: 6, views: 120,
  },
  {
    key: "ban-c1", loc: "banani", type: "shop", purpose: "sale", price: 18_000_000,
    sqft: 450, floor: 1, floors: 6, amenities: ["generator", "cctv", "fire_safety"],
    source: "demo-portal-ka", lister: "agency", seen: 25, checked: 8, views: 75,
  },

  // Uttara
  {
    key: "utt-s1", loc: "uttara", type: "apartment", purpose: "sale", price: 13_500_000,
    sqft: 1500, beds: 3, baths: 3, balconies: 2, floor: 4, floors: 8, parking: 1, amenities: FLAT_PLUS,
    source: "duar", lister: "owner", verified: true, seen: 4, checked: 0, views: 760, art: "apartment-08",
    title: "পার্কের পাশে ৩ বেডের ফ্ল্যাট",
    description: "ডেমো বিবরণ। সেক্টরের ভেতরে পার্কের পাশে ফ্ল্যাট। স্কুল আর বাজার হাঁটা দূরত্বে।",
  },
  {
    key: "utt-s2", loc: "uttara", type: "apartment", purpose: "sale", price: 16_200_000, prev: [17_500_000, 9],
    sqft: 1800, beds: 4, baths: 3, floor: 6, floors: 9, parking: 1, amenities: FLAT,
    source: "demo-agency-feed", lister: "agency", seen: 18, checked: 2, views: 240,
  },
  {
    key: "utt-r1", loc: "uttara", type: "apartment", purpose: "rent", price: 32_000,
    sqft: 1350, beds: 3, baths: 3, balconies: 2, floor: 2, floors: 7, parking: 1, amenities: FLAT,
    source: "duar", lister: "owner", seen: 0, checked: 0, views: 150, art: "apartment-01",
    title: "৩ বেডের ফ্ল্যাট, মাসের শুরু থেকে খালি",
  },
  {
    key: "utt-r2", loc: "uttara", type: "apartment", purpose: "rent", price: 24_000,
    sqft: 1050, beds: 2, baths: 2, floor: 5, floors: 6, amenities: BASIC,
    source: "demo-portal-kha", lister: "unknown", seen: 22, checked: 16, views: 88,
  },
  {
    // Probably the same flat as utt-r2, posted by another site. Not merged yet:
    // in the database it shows up as a suggested duplicate for staff to review.
    key: "utt-r2d", loc: "uttara", type: "apartment", purpose: "rent", price: 25_000,
    sqft: 1080, beds: 2, baths: 2, floor: 5, floors: 6, amenities: BASIC,
    source: "demo-agency-feed", lister: "agent", seen: 4, checked: 1, views: 35,
  },
  {
    key: "utt-l1", loc: "uttara", type: "plot", purpose: "sale", price: 45_000_000,
    katha: 3, amenities: PLOT, source: "duar", lister: "owner", verified: true, seen: 10, checked: 3, views: 330,
    art: "land-01", title: "৩ কাঠার দক্ষিণমুখী প্লট",
  },

  // Bashundhara
  {
    key: "bas-s1", loc: "bashundhara", type: "apartment", purpose: "sale", price: 19_500_000,
    sqft: 1950, beds: 3, baths: 4, balconies: 3, floor: 7, floors: 10, parking: 1, amenities: LUXURY,
    source: "duar", lister: "developer", agency: "demo-shapla-developers", verified: true, seen: 7, checked: 1,
    views: 880, art: "apartment-02", title: "নতুন ভবনে ৩ বেডের ফ্ল্যাট",
  },
  {
    // The same physical flat as bas-s1, seen on another site at a slightly different price.
    key: "bas-s1x", sameAs: "bas-s1", loc: "bashundhara", type: "apartment", purpose: "sale", price: 19_800_000,
    source: "demo-portal-ka", lister: "agent", seen: 5, checked: 2, views: 40,
  },
  {
    key: "bas-s2", loc: "bashundhara", type: "apartment", purpose: "sale", price: 14_800_000,
    sqft: 1550, beds: 3, baths: 3, floor: 3, floors: 8, parking: 1, amenities: FLAT,
    source: "demo-portal-ka", lister: "agent", seen: 11, checked: 5, views: 190,
  },
  {
    key: "bas-r1", loc: "bashundhara", type: "apartment", purpose: "rent", price: 42_000,
    sqft: 1600, beds: 3, baths: 3, balconies: 2, floor: 5, floors: 9, parking: 1, amenities: FLAT_PLUS,
    source: "duar", lister: "agent", agent: "demo-agent-kha", seen: 2, checked: 0, views: 410, art: "apartment-03",
    title: "বিশ্ববিদ্যালয়ের কাছে ৩ বেডের ফ্ল্যাট",
  },
  {
    key: "bas-r2", loc: "bashundhara", type: "apartment", purpose: "rent", price: 30_000, prev: [34_000, 1],
    sqft: 1250, beds: 3, baths: 2, floor: 4, floors: 8, amenities: FLAT,
    source: "demo-portal-kha", lister: "unknown", seen: 8, checked: 3, views: 132,
  },
  {
    key: "bas-l1", loc: "bashundhara", type: "plot", purpose: "sale", price: 52_500_000,
    katha: 5, amenities: PLOT, source: "demo-portal-ka", lister: "agent", seen: 35, checked: 12, views: 170,
  },

  // Mirpur
  {
    key: "mir-s1", loc: "mirpur", type: "apartment", purpose: "sale", price: 8_800_000, prev: [9_500_000, 2],
    sqft: 1250, beds: 3, baths: 2, balconies: 2, floor: 3, floors: 7, parking: 1, amenities: FLAT,
    source: "duar", lister: "owner", seen: 3, checked: 1, views: 690, art: "apartment-04",
    title: "মেট্রো স্টেশনের কাছে ৩ বেডের ফ্ল্যাট",
  },
  {
    key: "mir-s2", loc: "mirpur", type: "apartment", purpose: "sale", price: 7_200_000,
    sqft: 1050, beds: 2, baths: 2, floor: 5, floors: 6, amenities: BASIC,
    source: "demo-portal-kha", lister: "unknown", seen: 28, checked: 20, views: 77,
  },
  {
    key: "mir-r1", loc: "mirpur", type: "apartment", purpose: "rent", price: 20_000,
    sqft: 950, beds: 2, baths: 2, balconies: 1, floor: 2, floors: 6, amenities: ["gas_line", "water_supply", "security_guard"],
    source: "duar", lister: "owner", verified: true, seen: 1, checked: 0, views: 905, art: "apartment-05",
    title: "ছোট পরিবারের জন্য ২ বেডের ফ্ল্যাট",
  },
  {
    key: "mir-r2", loc: "mirpur", type: "apartment", purpose: "rent", price: 16_500,
    sqft: 800, beds: 2, baths: 1, floor: 4, floors: 6, amenities: BASIC,
    source: "demo-agency-feed", lister: "agent", seen: 6, checked: 2, views: 140,
  },
  {
    // The same flat as mir-r2, on a second site at a higher rent. Already merged: one card.
    key: "mir-r2x", sameAs: "mir-r2", loc: "mirpur", type: "apartment", purpose: "rent", price: 17_500,
    source: "demo-portal-kha", lister: "unknown", seen: 3, checked: 1, views: 22,
  },
  {
    key: "mir-rm1", loc: "mirpur", type: "room", purpose: "rent", price: 7_500,
    sqft: 180, beds: 1, baths: 1, floor: 3, floors: 6, furnishing: "semi_furnished", amenities: BASIC,
    source: "duar", lister: "owner", seen: 4, checked: 2, views: 320, art: "apartment-06",
    title: "চাকরিজীবীর জন্য এক রুমের সাবলেট",
  },

  // Mohammadpur
  {
    key: "moh-s1", loc: "mohammadpur", type: "apartment", purpose: "sale", price: 10_500_000,
    sqft: 1300, beds: 3, baths: 3, balconies: 2, floor: 6, floors: 9, parking: 1, amenities: FLAT_PLUS,
    source: "duar", lister: "agent", agent: "demo-agent-ka", agency: "demo-nilachol-properties", verified: true,
    seen: 9, checked: 2, views: 350, art: "apartment-07", title: "৩ বেডের ফ্ল্যাট, রেজিস্ট্রির জন্য প্রস্তুত",
  },
  {
    key: "moh-s2", loc: "mohammadpur", type: "apartment", purpose: "sale", price: 9_200_000,
    sqft: 1150, beds: 3, baths: 2, floor: 4, floors: 7, amenities: FLAT,
    source: "demo-portal-ka", lister: "agent", seen: 16, checked: 7, views: 110,
  },
  {
    key: "moh-r1", loc: "mohammadpur", type: "apartment", purpose: "rent", price: 25_000,
    sqft: 1100, beds: 2, baths: 2, balconies: 2, floor: 3, floors: 6, amenities: ["gas_line", "water_supply", "security_guard", "parking"],
    source: "duar", lister: "owner", seen: 5, checked: 0, views: 480, art: "apartment-08",
    title: "২ বেডের ফ্ল্যাট, দুই পাশে বারান্দা",
  },
  {
    key: "moh-r2", loc: "mohammadpur", type: "apartment", purpose: "rent", price: 19_000, prev: [21_000, 1],
    sqft: 900, beds: 2, baths: 2, floor: 5, floors: 6, amenities: BASIC,
    source: "demo-portal-kha", lister: "unknown", seen: 3, checked: 1, views: 66,
  },

  // Elsewhere in Dhaka
  {
    key: "bad-r1", loc: "badda", type: "apartment", purpose: "rent", price: 22_000,
    sqft: 1000, beds: 2, baths: 2, balconies: 1, floor: 4, floors: 7, amenities: FLAT,
    source: "duar", lister: "owner", seen: 2, checked: 1, views: 210, art: "apartment-01",
    title: "২ বেডের ফ্ল্যাট, লিফট ও জেনারেটরসহ",
  },
  {
    key: "ram-s1", loc: "rampura", type: "apartment", purpose: "sale", price: 7_800_000,
    sqft: 1100, beds: 3, baths: 2, floor: 5, floors: 8, amenities: FLAT,
    source: "demo-agency-feed", lister: "agent", seen: 13, checked: 4, views: 98,
  },
  {
    key: "khi-h1", loc: "khilgaon", type: "house", purpose: "sale", price: 32_000_000,
    sqft: 2800, katha: 2.5, beds: 6, baths: 5, floors: 3, parking: 1, amenities: ["gas_line", "water_supply", "boundary_wall", "rooftop"],
    source: "duar", lister: "owner", seen: 21, checked: 6, views: 260, art: "house-01",
    title: "আড়াই কাঠা জমিতে তিনতলা বাড়ি",
  },
  {
    key: "tej-c1", loc: "tejgaon", type: "commercial_space", purpose: "rent", price: 380_000,
    sqft: 5000, baths: 4, floor: 2, floors: 10, parking: 4, amenities: OFFICE,
    source: "duar", lister: "agency", agency: "demo-nilachol-properties", verified: true, seen: 8, checked: 2,
    views: 190, art: "commercial-02", title: "৫,০০০ বর্গফুটের খোলা কমার্শিয়াল ফ্লোর",
  },
  {
    key: "mot-c1", loc: "motijheel", type: "office", purpose: "sale", price: 27_500_000,
    sqft: 1400, baths: 2, floor: 9, floors: 20, amenities: OFFICE,
    source: "demo-portal-ka", lister: "agency", seen: 45, checked: 30, views: 54,
  },
  {
    key: "pur-l1", loc: "purbachal", type: "plot", purpose: "sale", price: 37_500_000, prev: [40_000_000, 3],
    katha: 5, amenities: PLOT, source: "duar", lister: "owner", seen: 6, checked: 1, views: 720, art: "land-02",
    title: "৫ কাঠার কর্নার প্লট",
  },
  {
    key: "pur-l2", loc: "purbachal", type: "plot", purpose: "sale", price: 21_000_000,
    katha: 3, amenities: PLOT, source: "demo-portal-kha", lister: "unknown", seen: 19, checked: 9, views: 130,
  },

  // Chattogram
  {
    key: "khu-s1", loc: "khulshi", type: "apartment", purpose: "sale", price: 14_500_000,
    sqft: 1500, beds: 3, baths: 3, balconies: 2, floor: 5, floors: 9, parking: 1, amenities: FLAT_PLUS,
    source: "duar", lister: "owner", verified: true, seen: 5, checked: 1, views: 430, art: "apartment-02",
    title: "পাহাড়ের দিকে মুখ করা ৩ বেডের ফ্ল্যাট",
  },
  {
    key: "nas-s1", loc: "nasirabad", type: "apartment", purpose: "sale", price: 11_000_000,
    sqft: 1350, beds: 3, baths: 3, floor: 3, floors: 8, parking: 1, amenities: FLAT,
    source: "demo-portal-ka", lister: "agent", seen: 17, checked: 5, views: 115,
  },
  {
    key: "khu-r1", loc: "khulshi", type: "apartment", purpose: "rent", price: 35_000,
    sqft: 1400, beds: 3, baths: 3, balconies: 2, floor: 4, floors: 8, parking: 1, amenities: FLAT,
    source: "duar", lister: "agent", agent: "demo-agent-kha", seen: 2, checked: 0, views: 300, art: "apartment-03",
    title: "৩ বেডের ফ্ল্যাট, গাড়ি রাখার জায়গাসহ",
  },
  {
    key: "hal-r1", loc: "halishahar", type: "apartment", purpose: "rent", price: 18_000,
    sqft: 1000, beds: 2, baths: 2, floor: 2, floors: 6, amenities: BASIC,
    source: "demo-portal-kha", lister: "unknown", seen: 12, checked: 8, views: 70,
  },
  {
    key: "agr-c1", loc: "agrabad", type: "office", purpose: "rent", price: 120_000,
    sqft: 1800, baths: 2, floor: 5, floors: 12, parking: 1, amenities: OFFICE,
    source: "duar", lister: "agency", agency: "demo-nilachol-properties", seen: 10, checked: 3, views: 160,
    art: "commercial-03", title: "বাণিজ্যিক এলাকায় ১,৮০০ বর্গফুটের অফিস",
  },
  {
    key: "pan-d1", loc: "panchlaish", type: "duplex", purpose: "sale", price: 45_000_000,
    sqft: 3200, beds: 5, baths: 5, balconies: 3, floors: 2, parking: 2, amenities: ["gas_line", "water_supply", "garden", "boundary_wall", "generator"],
    source: "duar", lister: "owner", seen: 14, checked: 4, views: 280, art: "house-02",
    title: "বাগানসহ ৫ বেডের ডুপ্লেক্স",
  },

  // Sylhet
  {
    key: "upo-s1", loc: "uposhohor", type: "apartment", purpose: "sale", price: 8_200_000,
    sqft: 1400, beds: 3, baths: 3, balconies: 2, floor: 3, floors: 7, parking: 1, amenities: FLAT,
    source: "duar", lister: "owner", seen: 3, checked: 1, views: 390, art: "apartment-04",
    title: "দক্ষিণ দিক খোলা ৩ বেডের ফ্ল্যাট",
  },
  {
    key: "zin-s1", loc: "zindabazar", type: "apartment", purpose: "sale", price: 9_500_000,
    sqft: 1500, beds: 3, baths: 3, floor: 6, floors: 10, parking: 1, amenities: FLAT,
    source: "demo-agency-feed", lister: "agency", seen: 26, checked: 11, views: 85,
  },
  {
    key: "upo-r1", loc: "uposhohor", type: "apartment", purpose: "rent", price: 18_000,
    sqft: 1200, beds: 3, baths: 2, balconies: 2, floor: 2, floors: 6, amenities: ["gas_line", "water_supply", "parking"],
    source: "duar", lister: "owner", verified: true, seen: 1, checked: 0, views: 270, art: "apartment-05",
    title: "৩ বেডের ফ্ল্যাট, নিরিবিলি ব্লকে",
  },
  {
    key: "amb-r1", loc: "ambarkhana", type: "apartment", purpose: "rent", price: 14_000, prev: [15_500, 2],
    sqft: 950, beds: 2, baths: 2, floor: 3, floors: 5, amenities: BASIC,
    source: "demo-portal-kha", lister: "unknown", seen: 7, checked: 3, views: 60,
  },
  {
    key: "shi-h1", loc: "shibgonj-sylhet", type: "house", purpose: "rent", price: 30_000,
    sqft: 2000, beds: 4, baths: 3, floors: 2, parking: 1, amenities: ["gas_line", "water_supply", "garden", "boundary_wall"],
    source: "duar", lister: "owner", seen: 16, checked: 5, views: 140, art: "house-03",
    title: "উঠানসহ ৪ বেডের দোতলা বাড়ি",
  },
  {
    key: "akh-l1", loc: "akhalia", type: "land", purpose: "sale", price: 12_000_000,
    katha: 10, amenities: ["road_access"], source: "demo-portal-ka", lister: "agent", seen: 33, checked: 14, views: 45,
  },

  // Not public: waiting for review. Proves that hidden statuses stay hidden.
  {
    key: "dhn-pending", loc: "dhanmondi", type: "apartment", purpose: "rent", price: 48_000,
    sqft: 1300, beds: 3, baths: 2, floor: 4, floors: 7, amenities: FLAT,
    source: "duar", lister: "owner", seen: 0, checked: 0, views: 0, status: "pending_review", art: "apartment-06",
    title: "৩ বেডের ফ্ল্যাট (যাচাইয়ের অপেক্ষায়)",
  },
];
