<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project notes (Duar, Bangladesh property search)

Read `README.md` and `docs/phase-1.md` first. The build brief is `docs/brief.txt`. Work one phase at a time and do not rewrite working code.

Conventions that are easy to break by accident:

- **Bangla text** lives in `src/lib/i18n/bn.ts`. Components never contain hard-coded user-facing strings. Numbers and prices go through `src/lib/format/bn.ts`.
- **Data access** goes through `src/lib/data/index.ts`. Pages and components do not import Supabase or `src/data/*` directly. Every function there has a demo implementation and a Supabase implementation; keep both in step (the database test compares them).
- **Enums** exist twice: `src/lib/domain/types.ts` and `supabase/migrations/*_extensions_and_enums.sql`. Change both.
- **Schema changes** are new migration files. Never edit a migration that has been applied. `*_reference_data.sql` and `seed.sql` are generated: edit `src/data/*` and run `npm run db:generate`.
- **Third-party content**: external listings carry facts and a link back, nothing else. The database enforces this with triggers and constraints; do not work around them. There is no crawler, by the owner's decision: do not add one, or any scraping of other sites, without the owner asking for it and the site's written permission.
- **Real third-party sites** are registered in `src/data/external-sites.ts`. They are off by default. Other sites are only linked to (`source_links`). A site's listings may be stored only once its written permission is recorded; the database refuses otherwise. Read `docs/external-sources.md` before adding a site.
- **The service-role key** is never used by the site. Nothing under `src/app` or `src/components` may use it.
- **Search and area figures** exist twice: database views (`*_search_and_area_views.sql`) and `src/lib/data/listing-math.ts` for demo mode. Change both; `npm run db:test` compares them.
- **Indexing**: only area pages with enough real listings, the price guide with real data, and our own listings are indexable. Don't add indexable pages without real content (see `docs/search-and-seo.md`).
- **Listings made here** (`docs/list-your-property.md`): the form rules live once in `src/lib/listings/submission-schema.ts`, used by the browser and the server action. A new listing always starts as `pending_review`; never add a path that publishes without a moderator. Lister phone numbers and exact addresses stay in `listing_contacts` and `property_private`. Photos go from the browser straight to the `listing-images` bucket under `<user id>/<listing id>/`; the database checks every photo row against the uploaded file.
- **One property, one card** (`docs/map-duplicates-alerts.md`): search, rails, counts and averages use only the group lead (`is_group_lead`). The ranking exists twice, in the `listing_groups` view and `assignGroups()` in listing-math.ts; change both. Merging is always a staff decision, never automatic. The map draws places at their centre; never put a property's own coordinates on a public page.
- **Private data** (`users`, `property_private`, `listing_contacts`, internal `sources` columns) must never be added to a public view or returned from a public route.
- **Lister edits** (`docs/editing-listings.md`): any change to a live listing except an ordinary price change sends it back to `pending_review`, enforced by triggers. Keep it that way; never add a path that lets lister changes go live unreviewed.
- **Listing videos** (`docs/list-your-property.md`): one per listing, ≤ 50 MB and 2 minutes, uploaded to `listing-videos/<user id>/<listing id>/` after the browser blanks the location tags (`src/lib/listings/video.ts`). Never upload the original file unscrubbed, and never preload videos on public pages.
- **Lister phone numbers** reach visitors only through `reveal_listing_phone()` (signed in, lister's permission, daily limit; see `docs/contact-lister.md`). Never render a number into page HTML before the visitor presses the button.
- **Caching**: this app uses Cache Components. Anything that reads cookies, headers or `searchParams` sits inside `<Suspense>`; cached reads use `"use cache"`.
- **Demo rows** are flagged `is_demo`. Keep it that way so `supabase/remove_demo_data.sql` keeps working.

Before finishing any change, run `npm run check`, and `npm run db:test` if anything under `supabase/` or `src/data/` changed.
