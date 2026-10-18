# List your property

Owners, agents, agencies and developers can list a property on Duar. Nothing they submit is public until a moderator or admin approves it.

This needs Supabase (sign-in, database and photo storage). In demo mode `/list-property` explains that the feature is not connected yet.

## The flow

1. **`/list-property`.** A signed-out visitor is asked to log in or sign up and comes back to the form afterwards. The form asks:
   - what (sale or rent, property type)
   - where (an area chosen from the list, plus an optional exact address)
   - price (with "negotiable")
   - details (size or katha, bedrooms, bathrooms, balconies, floor, furnishing, parking)
   - amenities
   - up to 8 photos
   - a description
   - who is listing (owner, agent, agency or developer) and their phone number
   - an agreement that they have the right to list the property and its photos
2. **Submit.** The server action checks the form again and calls `public.submit_listing()`, which saves the listing as `pending_review`. The browser then:
   - shrinks each photo to at most 1600 px as WebP
   - uploads the photos straight to the `listing-images` bucket under `<user id>/<listing id>/`
   - records them through a second action

   If photos fail, the listing is still saved and the lister is told.
3. **`/account/listings`.** The lister sees each listing with its status: waiting for review, live, rejected, sold, rented or removed. They can mark a live listing sold or rented, or remove it; it leaves search at once.
4. **`/admin/listings`** (moderators and admins only). This is the review queue, oldest first. It shows the facts, photos, phone number and exact address, so the reviewer can check the listing, plus "Approve" and "Reject" buttons. An approved listing appears in search, on area pages and in the sitemap straight away.

## The rules

The rules for the form are written once, in `src/lib/listings/submission-schema.ts`. Both the browser and the server action use them.

| Rule | Why |
| --- | --- |
| Bangladeshi mobile numbers only, stored as `01XXXXXXXXX` | Bangla digits, `+880` and spaces are accepted and normalised |
| No phone numbers in the title or description | Contact details stay in the private contact fields |
| Sale price at least ৳1,00,000; rent at least ৳1,000 | Lower figures are almost always typing mistakes |
| Land needs katha; homes need bedrooms; rooms are for rent only; the floor can't be above the top floor | Keeps listings complete and searchable |
| Facts that don't apply are dropped (no bedrooms on land, and so on) | `relevantFacts()` |
| At most 10 listings per account per day | Stops floods; set in `private.daily_submission_limit()` |

## What the database guarantees

Migration `20261008001200_listing_submissions.sql`, on top of the existing guard triggers and row-level security:

- **`submit_listing` runs as the signed-in user.**
  - Every existing rule applies: the lister is set to the caller, and the status is forced to `pending_review`.
  - The place must be an area or city, not a division or district.
- **The map never shows the house.** The stored point is the area's centre, with `location_precision = 'area_only'`.
- **Phone numbers and addresses stay private.** The phone goes to `listing_contacts`, and the exact address goes to `property_private`. Only the lister and staff can read either table. Neither appears on public pages, in public views or in the API. The only way anyone else gets the number is `reveal_listing_phone()`; see `docs/contact-lister.md`.
- **Photo rows are checked by `enforce_own_listing_photo`.** Every photo row on a listing made here must:
  - be owned or licensed
  - be a file that exists in `listing-images`, in the lister's folder for that listing
  - be served from our own bucket URL

  There can be at most 8 per listing.
- **`my_listings` view.** Each user sees only their own listings; staff see all. It is not granted to anonymous visitors.

Public pages also accept only image URLs from `/demo/` or our own `listing-images` bucket (`safeImageUrl`).

## Editing

Listers can edit their listings; see `docs/editing-listings.md`.

## Not built yet

- **Editing a listing after submitting it.** For now the lister removes it and submits a new one.
- **Email to the lister when their listing is approved or rejected.**
- **A reason shown to the lister when a listing is rejected.**

## How it was checked

- `tests/submission.test.ts`: phone normalisation and every form rule.
- `npm run db:test`, section "List your property":
  - visitors cannot submit
  - a submission is pending even when it asks to be active
  - the address and phone are not readable by others
  - districts are refused
  - `my_listings` scoping
  - photo checks
  - after approval the lister can mark it rented but cannot reopen it
  - the daily limit
- A browser run against a local Supabase stand-in:
  - sign up and fill in the form
  - a phone number in the description is refused
  - two photos are uploaded and stored as WebP in the right folder
  - the listing is hidden before approval
  - an ordinary user is turned away from the review page
  - approval
  - the public page shows the photo but no phone or address
  - the listing appears in search; marking it rented removes it
- An accessibility scan (axe, WCAG 2.1 AA) of all three pages, signed in and signed out, at phone and desktop widths: no violations.
