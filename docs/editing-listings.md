# Editing a listing

Migration: `20261018000200_listing_edits.sql`. Page: `/account/listings/<id>/edit`, linked as "সম্পাদনা করুন" on "আমার লিস্টিং".

## What a lister can edit

Every field of the listing form, with the same rules as a new listing:

- purpose, type, area, address
- price and "negotiable", size
- rooms, floor, furnishing, parking, amenities
- photos: remove, or add up to 8 in total
- title and description
- contact name, phone, WhatsApp, and whether the number is shown

Only listings waiting for review or live on the site can be edited. Sold, rented, withdrawn or rejected ones cannot: list the property again instead.

## When an edit needs review

Nothing a lister writes reaches the public site without a moderator, with one exception.

| Change to a live listing | What happens |
|---|---|
| Price, within half to double the old price; "negotiable" | Stays live. Price history is recorded and people who saved it get a price-drop alert. |
| Price to under half or over double | Back to review |
| Title, description, purpose, lister type | Back to review |
| Type, area, size, rooms, floor, furnishing, parking | Back to review |
| Amenities, address | Back to review |
| Photos added, removed or reordered | Back to review |
| Contact name, phone, WhatsApp | Back to review |
| Showing or hiding the number | Stays live |

"Back to review" means the status becomes `pending_review`. The listing leaves search, area pages and the sitemap until a moderator approves it again in `/admin/listings`. The edit page explains this before saving. After saving, "আমার লিস্টিং" says which of the two happened.

Edits to a listing already waiting for review just update it.

## How it is enforced

The rules are database triggers, so they hold however the change is made: through the edit page, or straight through the API with the lister's own login. Before this migration the API allowed a lister to change a live listing's text and facts without review. That gap is now closed.

- `review_listing_edit`: changes to the listing row (text, purpose, lister type, big price jumps).
- `review_after_lister_edit`: changes to:
  - the property's facts
  - amenities
  - the private address
  - photos
  - the contact name, phone or WhatsApp
- `guard_listing_slug`: the listing's web address can only be changed by staff.

Staff and the service role are not affected: a moderator's correction stays live.

## How saving works

1. `update_listing(listing_id, form)` saves everything except photos in one transaction. It runs as the lister, so row-level security and every guard apply. It only writes a table when something in it really changed, so saving an unchanged form keeps the listing live.
2. If the photos changed:
   1. The browser uploads new photos the same way as a new listing: redrawn without GPS data, into `<user id>/<listing id>/`.
   2. `update_listing_photos(listing_id, keep, new, alt)` keeps the chosen photos in order, adds the new ones after them, and makes the first one the cover.
   3. The server then deletes the files of removed photos from storage.

## Known limit

If staff have merged another listing onto the lister's property (see `docs/map-duplicates-alerts.md`), a facts edit changes the shared property. The lister's own listing goes back to review, but the other listing's page shows the new facts at once. Those are usually another site's listings, which are not the group lead, so they rarely appear as a card.

The review queue does not yet mark which listings are edits rather than new submissions.

## How it was checked

- `npm run db:test`, section "Editing a listing":
  - an unchanged save stays live
  - a price drop stays live and is recorded; a drop to under half goes to review
  - description, bedrooms, area, amenities, address and phone each go to review, and are off the site meanwhile
  - the saved values are correct, and the property is still placed at the area centre
  - switching the number on or off stays live
  - changes made straight through the API are caught: title, size, amenity
  - the web address cannot be changed
  - staff edits stay live
  - another user, a visitor, a district-level area and a rented listing are all refused
  - photos are added, removed and reordered, and the first is the cover
  - someone else's photo path is refused
- **Browser run** against the local Supabase stand-in:
  1. List a flat with two photos.
  2. Open the edit page from "আমার লিস্টিং". Every field is filled in, including the private address.
  3. Lower the price: it stays live, and the new price shows on the listing page at once.
  4. Change the description, remove a photo and add one: it goes back to review, and is off search.
     - The kept photo becomes the cover.
     - The removed file is deleted from storage.
  5. A rented listing shows "cannot be edited".
  6. Another user cannot open the page or see the address.
- An axe scan of the edit page found no violations.
