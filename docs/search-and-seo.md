# Search, listing pages, area pages and the price guide

Added on 16 October 2026 (stage 1 of the owner's list: search results, listing page, area pages, technical SEO, price guide).

## Pages

| Address | What it is | Indexed by search engines? |
| --- | --- | --- |
| `/search?...` | Search results with filters (place, kind, type, bedrooms, price), five sort orders, 24 per page | No. Endless filter combinations; `robots.txt` also keeps crawlers out |
| `/property/{area}/{slug}` | Listing page: facts, comparison with the area average, amenities, price history, source and "মূল লিস্টিং দেখুন", similar listings | Only listings made on this site that are active and real. Listings from other sites and demo listings carry `noindex` |
| `/buy/{place}`, `/rent/{place}`, `/land/{place}`, `/commercial/{place}` | Area pages: heading, count, average prices, latest listings, places inside, other kinds, links to other sites | Only with at least 5 real active listings (`MIN_LISTINGS_TO_INDEX`). Others still work for visitors but carry `noindex` and stay out of the sitemap |
| `/prices` | Price guide: average asking price per square foot, rent by bedrooms, land per katha, for every city and area with enough listings, each with its sample size | Once it has real (not demo) data |
| `/sitemap.xml` | Home, price guide, qualifying area pages, our own listings | |
| `/robots.txt` | Allows everything public; closes `/search`, `/account`, `/login`, `/signup`, `/auth/`, `/api/` | |

With demo data, everything except the home page is `noindex`, on purpose. Real data switches pages on automatically as they qualify.

## Technical SEO

- Every page has a Bangla title, a description and a canonical address. Area and price pages add the English search phrase to the title ("উত্তরায় ফ্ল্যাট ও বাড়ি ভাড়া | Flats for rent in Uttara").
- Structured data (schema.org JSON-LD): `WebSite` and `Organization` on the home page, `BreadcrumbList` wherever breadcrumbs show, `ItemList` on area pages, `RealEstateListing` on listing pages, `Dataset` on the price guide.
- A listing opened under the wrong area address redirects to the right one.
- Set `NEXT_PUBLIC_SITE_URL` to the real address before going live: canonical tags, the sitemap and structured data use it.

## How the data is kept consistent

Search, counts and averages exist twice: as database views (`supabase/migrations/20261008001100_search_and_area_views.sql`) and as in-memory functions for demo mode (`src/lib/data/listing-math.ts`). `npm run db:test` runs ten searches, the area counts, the full price guide and five listing pages through both and requires the same answers. Change both together.

## Known limits

- An unknown listing or area address shows the Bangla "not found" page with `noindex`, but with HTTP status 200 rather than 404, because the page streams in after its frame. Search engines treat `noindex` correctly; a 404 status would need the address checked before streaming.
- The views recalculate on every read. Fine for thousands of listings; at tens of thousands, materialise them (Phase 8).
- The map, merging duplicate listings and price-drop alerts are stage 3.
