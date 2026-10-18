# Phase 1: foundation

> This is the record of Phase 1 as delivered. Several changes were made afterwards, at the owner's request:
>
> 1. Links out to other property sites, which adds one table, one view and two migrations. See [external-sources.md](external-sources.md).
> 2. A crawler for Bikroy's public listing facts was added and later removed at the owner's decision (October 2026). Its migration, code, page and tests are gone; other sites are only linked to.
> 3. Search, listing pages, area pages and the price guide. See [search-and-seo.md](search-and-seo.md).
> 4. "List your property" with staff approval, which adds one migration, `/list-property`, `/account/listings` and `/admin/listings`. See [list-your-property.md](list-your-property.md).
> 5. One card per property, a map view and price-drop alerts. See [map-duplicates-alerts.md](map-duplicates-alerts.md).

Scope from the brief: project setup, database, Supabase, authentication foundation, design system, layout, home page, basic location data. No external ingestion, no search results, no detail page.

## What was built

**Project.** Next.js 16.4 (App Router, Cache Components), TypeScript strict, Tailwind CSS 4, shadcn/ui-style components, Supabase client libraries, zod for validation, vitest for unit tests.

**Database** (`supabase/migrations/`, seven files, applied in order):

1. Enumerated types.
2. Twenty tables. The sixteen the brief lists, plus four that exist to keep things normalised or private: `amenities`, `property_amenities`, `property_private` (exact address and pin) and `listing_contacts` (lister phone numbers).
3. Functions and triggers: profile creation on sign-up, price history, the content rules for external listings, and guards that stop listers approving or verifying their own listings.
4. Row-level security on every table, with explicit grants per role.
5. Three public views: `listing_cards`, `location_listing_stats`, `location_summaries`.
6. Reference data: 186 locations (8 divisions, all 64 districts, 12 cities, 5 upazilas, 97 neighbourhoods) and 19 amenities.
7. Storage buckets for listing photos, avatars and verification documents, with upload rules.

A physical property and an online listing are separate tables. The demo data includes one flat listed by two sources to show it.

**Supabase wiring.** Three clients (`src/lib/supabase/`): a cookie-less one for cached public reads, a per-request one that acts as the signed-in user, and a browser one reserved for later. `src/proxy.ts` refreshes the session on each request.

**Authentication.** Email and password sign-up, login, logout, email-confirmation landing route, a protected `/account` page, role helpers, and `requireUser` / `requireRole` for later phases. New accounts are always `member`; roles can only be changed by staff, in the database.

**Design system.** Tokens in `globals.css`, Anek Bangla self-hosted, button, input, select, badge, card, alert, skeleton and label components, header, footer, and a bottom menu for phones.

**Home page.** Hero with the search panel (four modes, location autocomplete in Bangla or English, type, bedrooms, price range) and all seven sections from the brief. It is prerendered and cached for a minute.

**Location data.** Database-driven. `src/data/locations.ts` is the single source; a script turns it into the reference-data migration.

**Demo data.** 55 listings across the ten areas the brief names, on four made-up sources using reserved example domains. All flagged `is_demo`; one script removes them.

## Decisions worth knowing about

- **Demo mode.** With no Supabase keys the site runs on the bundled demo data, so it can be seen immediately. The same data is what `seed.sql` loads, and a test confirms both paths render the same page.
- **Content rules live in the database.** Triggers refuse third-party images and contacts and drop third-party descriptions unless a source's flags allow them, even for the service role.
- **Private columns are in separate tables** rather than hidden by convention, so they cannot leak through a careless `select *`.
- **Two placeholder pages.** `/search` and `/property/...` exist so that nothing on the home page leads to a 404. They are clearly marked and are replaced in Phase 2.
- **Two static font weights** instead of the variable font: about 150 KB of fonts in total instead of roughly 200 KB. The variable file that also carries a width axis is 448 KB, so it was ruled out.
- **Email and password only** for now. Most Bangladeshi users will expect phone OTP; that needs an SMS provider and is a decision for you.
- **Extra tables and fields for later phases** (`listing_changes`, `listing_duplicates`, `verification_records`, `featured_until`, `plan`) exist in the schema as the brief asks, but nothing writes to them yet.

## How it was checked

| Check | Result |
| --- | --- |
| Type check, lint | Clean |
| Unit tests (`npm test`) | 52 pass: Bangla number and price formatting, freshness rules, URLs, search parameter validation, redirect safety, input validation, demo data integrity |
| Database test (`npm run db:test`) on PostgreSQL 16 | 63 pass: migrations apply, re-run safely, RLS on every table, visitor, user, staff and service-role behaviour, content rules, impossible values rejected, demo cleanup |
| Migrations applied with the Supabase CLI (`db push --include-seed`, CLI 2.120) | All seven plus the seed apply cleanly |
| Site run against PostgREST 13 (the engine behind Supabase's Data API) on the test database | Home page shows the same 30 listing links in the same order as demo mode; private tables refuse access over HTTP |
| Browser checks, demo mode and database mode | 12 and 21 pass: sections present, no sideways scroll on a phone, external links attributed and safe, autocomplete, search form, sign-up, login, logout, protected page, open-redirect attempts |
| Accessibility scan (axe-core, WCAG 2 A and AA) | 0 violations on home, search, login and account |
| Page weight, first visit on a phone | About 390 KB transferred: script 169 KB, fonts 150 KB, HTML 27 KB, images 25 KB, CSS 7 KB |
| Development server | All routes load with no warnings |

### Not verified

- **A real Supabase project.** Nothing was run against Supabase's hosted service. The database was tested on plain PostgreSQL with small stand-ins for Supabase's `auth` and `storage` schemas (`scripts/sql/supabase-stubs.sql`).
- **Real Supabase Auth.** Sign-up, login and logout were exercised against a stand-in that imitates the Auth API's responses. Confirmation emails, the confirmation link round trip and token refresh against the real service are untested.
- **Storage uploads.** The upload rules were tested as SQL policies, not through the Storage API.
- **Real devices.** Screens were checked in headless Chromium at phone and desktop sizes, not on an actual low-end Android phone or a throttled network.
- **Location coordinates** are approximate centre points written from general knowledge, not from a survey dataset. Good enough for placing a pin; verify before using them for distance calculations.
- **Bangla wording** was written with care for natural Bangladeshi usage but has not been reviewed by a native-speaking editor.

## Known limits

- `location_listing_stats` is a plain view. Fine now; make it a materialised view when listings reach the tens of thousands (Phase 8).
- A property with two active listings is counted twice in area averages until duplicates are merged (Phase 6).
- No rate limiting of our own yet (Phase 8). Supabase Auth applies its own limits to login and sign-up.
- No Content-Security-Policy header yet (Phase 8). Basic security headers are set.
- `npm audit` reports 5 high-severity advisories, all in the lint tooling that ships with Next.js (`eslint-config-next`). `npm audit --omit=dev` is clean: nothing that runs in production is affected.

## Next prompt

```
Continue the Duar project. Read AGENTS.md, README.md and docs/phase-1.md first,
and inspect the current code before changing anything.

Implement PHASE 2 only: search, filters, property cards, property details, pagination.

1. Search page at /search, replacing the placeholder. Read filters with
   parseSearchParams. Add the remaining filters from the brief: bathrooms,
   minimum and maximum size, furnishing, parking, amenities, verified only,
   owner/direct only, source, freshness. Sorting, pagination, and a list/grid
   toggle. Reuse the existing ListingCard and HeroSearch pieces; extend them
   rather than rewriting.
2. Add searchListings() and getListingBySlug() to the Repository interface,
   with both the demo and the Supabase implementation, and a database function
   or view for the search query with the indexes it needs. New SQL goes in a
   new migration file.
3. Property details page at /property/[location]/[slug], replacing the
   placeholder: title, price, property facts, location, amenities, price per
   sq ft, source, original URL, last checked date, listing status, report
   listing form (writes to the reports table), similar and nearby properties,
   area statistics, and the "এই দামের তুলনা" section with asking price, estimated
   price per sq ft, comparable range and a simple market-position indicator.
   Label every estimate as an estimate. No map yet (Phase 3): show the area name.
4. Keep all Bangla strings in src/lib/i18n/bn.ts.
5. Extend the unit tests, scripts/test-db.ts and the checks so the new queries
   are covered in both data modes. Run npm run check and npm run db:test and
   fix anything that fails.

Do not start maps, favourites, saved searches or SEO pages (Phase 3).
When done, write docs/phase-2.md in the same form as docs/phase-1.md: what
changed, how it was checked, what was not verified, and the Phase 3 prompt.
```
