# Map, one card per property, and price-drop alerts

Three features added together. Migrations:

- `20261017000100_one_card_per_property.sql`
- `20261017000200_duplicate_review.sql`
- `20261017000300_price_drop_alerts.sql`

## One property, one card

The same flat is often listed several times: the owner lists it here, and an agent posts it on two portals. When those listings point at the same row in `properties`, the site treats them as one result.

**How listings are ranked.** For each property and purpose, the active listings are ranked in this order:

1. our own listing first (it has photos and a lister to contact)
2. then the lowest price
3. then the newest

The first one is the *group lead*. Two views do this ranking:

- `listing_groups` computes it in the database.
- `assignGroups()` in `src/lib/data/listing-math.ts` does the same in demo mode.

`npm run db:test` checks that both give the same answers.

**What changes in search.** Search, home-page rails and "similar listings" show only group leads. A lead's card says "আরও ১টি লিস্টিংয়ে আছে", plus the lowest price when another listing is cheaper. The listing page has a section, "এই প্রপার্টির অন্য লিস্টিং", that shows:

- each listing's source and price
- how fresh it is
- a link to its page here
- for external listings, "মূল লিস্টিং দেখুন"

**Counts and averages.** Area counts, the price guide and the home-page area figures count each property once. This removes the old known limit where a property with two listings was counted twice.

Listings that are not active (sold, rented, stale) are never grouped.

### How listings get merged

Nothing is merged automatically. A wrong merge would hide a real listing, so a person decides.

1. **Suggestions.** `public.find_duplicate_candidates()` looks for active listings that match on all of these:
   - same place, type and purpose
   - same number of bedrooms
   - size (or land area) within 7%
   - price within 15%

   Both listings must have a size. Demo listings are only paired with demo listings. Each pair gets a confidence score from 60 to 100 and the signals behind it (size and price differences, same floor, same site). The function runs:
   - after a moderator approves a listing
   - when staff press "নতুন সম্ভাব্য ডুপ্লিকেট খুঁজুন"
2. **Review.** `/admin/duplicates` (moderators and admins only) shows each pair side by side, with links to both listing pages and to the originals. Staff choose one of three actions:
   - **একই প্রপার্টি, মিলিয়ে দিন** (merge). Both listings move onto one property. Our own lister's property is kept if there is one; otherwise the older one. Missing facts on the kept property are filled in from the other. The other property row is kept, because it may hold a lister's private address.
   - **আলাদা প্রপার্টি** (reject). The pair is never suggested again.
   - **পরে দেখব** (later). The pair stays in the queue, marked for later.
3. **Undo.** `public.split_listing(listing_id)` gives a listing its own copy of the property again and puts the pair back in the queue. It has no button yet; staff run it from the SQL editor.

All three functions refuse anyone who is not staff or the service role.

## Map view

The search page has a "তালিকা / ম্যাপ" switch. The map view (`/search?…&view=map`) shows one marker per place. Each marker gives the number of matching properties and the lowest price. Clicking a marker opens a popup, and the popup links to the list for that place. Under the map, the same places are listed as plain links, for screen readers and in case the map cannot load. Area pages link to their map too.

**Privacy: the map shows areas, not houses.** Each marker sits at the place's centre (from `locations`). A property's own coordinates are never used. Listings made here are already stored with the area centre (`location_precision = 'area_only'`).

**Technical details:**

- The map uses Leaflet, loaded only in the browser and only in map view.
- The mouse wheel does not zoom (the page scrolls past the map). On phones, one finger scrolls the page.
- The map reads at most 5,000 matching listings. Past that, it says the map is incomplete.

### Map tiles

By default the map uses OpenStreetMap's own tile server. That is fine for testing and light use, but its [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) does not allow heavy traffic. Before launch:

1. Pick a tile provider that offers OpenStreetMap-based tiles, such as MapTiler, Stadia Maps or Thunderforest. Most have a free tier.
2. Set `NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_MAP_ATTRIBUTION` (see `.env.example`).

## Price-drop alerts

A signed-in visitor presses "সেভ করুন" on a listing page.

**When the price falls.** If the asking price of that property falls on any of its listings, a database trigger (`notify_price_drop`) writes an alert to `notifications`. This includes the other sites' listings of the same flat. It works the same whether the change came from:

- the lister
- staff

The lister is not alerted about their own change. A price rise sends nothing.

**Where alerts appear:**

- A number on a flame-coloured badge next to the account name in the header, linking to `/account/saved`.
- `/account/saved`, which shows:
  - the alerts, newest first, with "সব পড়া হয়েছে" (mark all read)
  - each saved listing with its price now and how much it has changed since it was saved (`favorites.saved_price`, filled in by the database)
  - the lowest price among other listings of the same property

**Privacy and permissions:**

- Alerts hold only public facts.
- A user can read, mark read and delete only their own alerts. They cannot write or change one.
- Visitors who are not signed in have no access to any of it.

**Not built yet: email and SMS.** Alerts are not sent by email or SMS. That needs an email or SMS provider: for example Resend or Amazon SES for email, or a Bangladeshi SMS gateway. The alerts table is ready for a sender to read from.

## How it was checked

**Unit tests** (`tests/stage3.test.ts`):

- group order and lead
- counts
- the merged demo flat showing once, with the other site on its page
- map grouping and totals
- the map URL

**Database tests** (`npm run db:test`, 107 checks):

- the groups match demo mode, listing by listing
- the map counts match demo mode
- visitors and members cannot search, merge or split duplicates
- the likely Uttara pair is suggested once
- a pair already on one property is never suggested
- merging shows one card and lowers the area count
- splitting restores both
- a rejected pair stays rejected
- saving records the real price
- a drop alerts everyone who saved the property, including through another site's listing; a rise alerts nobody
- alerts are private and can only be marked read or deleted

**Browser run against a local Supabase stand-in:**

- one card per property in Mirpur
- the other site's price shown on the listing page
- one map pin per area, and a pin leads to that area's list
- sign up and save a listing
- a price drop shows in the header and on `/account/saved`
- marking read clears the badge
- an ordinary user is turned away from the duplicate queue
- a moderator finds and merges the Uttara pair, and search shows one card straight away

**Accessibility:** an axe scan (WCAG 2.1 AA) of these pages at phone and desktop widths found no violations:

- the search map
- search results
- a listing page, signed out and signed in
- `/account/saved`
- `/admin/duplicates`
- `/account`

Map tiles could not be loaded in the test environment, so the map was checked with a blank background. Markers, popups and links were all tested.
