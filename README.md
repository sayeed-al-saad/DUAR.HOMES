# দুয়ার (Duar)

A Bangladesh property search engine and marketplace. It shows our own listings next to listings from other sources, with every external listing attributed and linked back to where it came from.

"দুয়ার" is a working name. Change it in `src/lib/config/site.ts`.

**Status: Phase 1 of 8 is built.** That is the foundation: project setup, database, Supabase wiring, sign-in, design system, layout, home page and location data. Search results and property detail pages are Phase 2; until then those two pages are placeholders. See [docs/phase-1.md](docs/phase-1.md) for exactly what was built and how it was checked.

**Added since:**

- Buttons that open three real property sites' own listing pages. See [docs/external-sources.md](docs/external-sources.md) for what each site allows.
- Working search with filters and sorting, listing pages, area pages (`/rent/uttara`), a price guide (`/prices`), sitemap, robots.txt and structured data. See [docs/search-and-seo.md](docs/search-and-seo.md).
- "List your property" (`/list-property`): signed-in owners and agents submit a listing with up to 8 photos; it stays hidden until a moderator approves it at `/admin/listings`. Listers manage theirs at `/account/listings`. Needs Supabase; in demo mode the page explains that. See [docs/list-your-property.md](docs/list-your-property.md).
- One card per property (listings of the same flat on several sites are merged by staff at `/admin/duplicates` and shown as one result), a map view of search results (areas only, never exact houses), and price-drop alerts on saved listings (`/account/saved`). See [docs/map-duplicates-alerts.md](docs/map-duplicates-alerts.md).

## Run it

Needs Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no configuration the site runs in **demo mode**: 55 made-up listings, a banner saying so, and login switched off.

## Connect Supabase

1. Create a project at supabase.com.
2. Copy `.env.example` to `.env.local` and fill in the project URL and the publishable (or anon) key.
3. Apply the database. Either:
   - **Supabase CLI:** `npx supabase link --project-ref <ref>`, then `npx supabase db push`. Add `--include-seed` to load the demo listings in the same step.
   - **Dashboard:** open the SQL editor and run each file in `supabase/migrations/` in filename order.
4. Optional, if you did not use `--include-seed`: run `supabase/seed.sql` to load the demo listings. Without them the home page is simply empty.
5. In Authentication → URL Configuration, set the Site URL to your site address and add `<site address>/auth/confirm` to the redirect URLs.
6. Restart `npm run dev`. Sign up through the site, then make yourself an admin from the SQL editor:

   ```sql
   update public.users set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

Before launch, run `supabase/remove_demo_data.sql` once. It deletes every demo row and nothing else.

To work against a local Supabase stack instead (needs Docker): `npx supabase start`, then `npx supabase db reset`, which applies the migrations and the seed. `npx supabase status` prints the URL and keys for `.env.local`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run check` | Type check, lint, unit tests and a production build |
| `npm test` | Unit tests only |
| `npm run db:test` | Applies all migrations and the seed to a throwaway database and tests the security rules. Needs `DATABASE_URL` pointing at any PostgreSQL 15+ server where you can create databases, for example `postgresql://postgres:postgres@127.0.0.1:54322/postgres` with `supabase start` running |
| `npm run db:generate` | Rebuilds `supabase/seed.sql` and the reference-data migration from `src/data/` |
| `npm run demo:art` | Redraws the demo illustrations in `public/demo/` |

## Where things are

```
src/
  app/                    pages and routes
    page.tsx              home page
    (auth)/               login, sign-up and their server actions
    account/              signed-in area (protected): "my listings", saved listings and alerts
    list-property/        the list-your-property form and its server actions
    admin/listings/       review queue for moderators and admins
    admin/duplicates/     duplicate pairs for staff to merge or keep apart
    auth/confirm/         landing point for email confirmation links
    api/locations/        location autocomplete
    search/, property/    PLACEHOLDERS until Phase 2
    globals.css           design tokens: colours, type scale, radii
    fonts.ts              self-hosted Anek Bangla
  components/
    ui/                   shadcn/ui-style building blocks
    layout/               header, footer, phone bottom menu, logo
    home/                 hero, search panel, home page sections
    listings/             property card
    external/             buttons that open other sites' listing pages
    listing-form/         the listing form, photo upload, lister and reviewer buttons
    saved/                save button and the saved-listings page parts
    admin/                staff-only controls
    search/               filters, pagination, list/map switch and the map
    location/             location autocomplete box
    auth/                 login and sign-up forms
  lib/
    i18n/bn.ts            every Bangla string on the site
    format/               Bangla numbers, prices (lakh/crore), dates, katha/sq ft
    domain/               shared vocabulary, freshness rules, URLs, search options
    data/                 the data layer: one interface, demo and Supabase versions
    auth/                 current user, roles, input validation, safe redirects
    listings/             submission rules (shared by form and server), listing actions, duplicate review
    saved/                saved listings and price-drop alerts
    supabase/             server, browser and public clients; session refresh
    config/site.ts        site name and description
  data/                   location reference data, DEMO listings, and the register of real
                          sites we link to (source for the SQL)
  proxy.ts                keeps the login session fresh (Next.js 16 name for middleware)
supabase/
  migrations/             schema, triggers, row-level security, views, reference data, storage
  seed.sql                DEMO data (generated)
  remove_demo_data.sql    deletes all demo data
scripts/                  SQL generator, database test, illustration generator
tests/                    unit tests
docs/                     the brief and per-phase notes
```

## How the content rules are enforced

The brief sets conservative rules for anything taken from other sites. They are enforced in the database, so a mistake in application code cannot break them.

| Rule | Where it is enforced |
| --- | --- |
| External listings store only facts plus a link back | `property_listings` has no column for third-party photos or contacts; `enforce_listing_content_rules` drops a description unless the source allows it |
| No third-party photos unless authorised | `enforce_image_rights` trigger, driven by `sources.allow_images` (off by default) |
| No third-party phone numbers | `enforce_contact_rights` trigger, driven by `sources.allow_contact` (off by default) |
| Every external listing links to the original | Check constraint: an external listing must have `source_url`. Cards show the source name and a "মূল লিস্টিং দেখুন" link |
| A source cannot be switched on without permission | Check constraint `sources_active_needs_permission` |
| No listing is accepted from a source that is switched off | `enforce_listing_content_rules` refuses the insert, for every role |
| Real sites we have no agreement with are linked to, not copied | `source_links` holds only URLs; the real sites are registered with `active = false` |
| Each source can be enabled or disabled on its own | `sources.active`, one row per source |
| Titles of external listings are ours, not copied | `buildListingTitle` generates them from the facts |
| Private user data never reaches the public | `users`, `property_private` and `listing_contacts` have no public grant at all; public pages read only the `listing_cards`, `location_listing_stats` and `location_summaries` views |
| Freshness never claims availability | Labels describe when a listing was last checked; see `src/lib/domain/freshness.ts` |
| Listings made here stay hidden until staff approve them | Guard triggers force `pending_review` and the lister on insert; only moderators and admins can set `active` (`submit_listing`, row-level security) |
| A lister's phone number and exact address are never public | Stored in `listing_contacts` and `property_private`; only the lister and staff can read them. The public map point is the area's centre |
| Photos on our own listings are files the lister uploaded | `enforce_own_listing_photo` trigger: owned or licensed, in the lister's own folder for that listing, served from our bucket, at most 8 |
| Price figures are labelled as estimates | Home page area averages show their sample size and a disclaimer |

There is no crawler. Listings come from owners, agents and developers on this site; other sites are only linked to. A crawler was built and then removed at the owner's decision (October 2026).

## Design

- **Palette:** indigo (নীল) for the brand, one warm accent taken from the krishnachura flower for the search button and price drops, and a cool off-white. No green or yellow, so it cannot be confused with the existing portals. Tokens are in `src/app/globals.css`.
- **Type:** Anek Bangla in two weights, self-hosted. Two static weights were chosen over the variable font because they are a smaller download: about 150 KB of fonts in total instead of about 200 KB.
- **Built for slow phones:** the home page is prerendered and served as static HTML; images are lazy; there are no animations; the hero illustration is never downloaded on phones.
- **Components** follow shadcn/ui conventions (`components.json` is set up), so `npx shadcn add <component>` works for anything further.

## Data flow in one paragraph

Pages call functions in `src/lib/data/index.ts`. Those are cached on the server and choose between two implementations of the same interface: bundled demo data, or Supabase read as the anonymous role through public views. Row-level security decides what comes back. Nothing in Phase 1 uses the service-role key.
