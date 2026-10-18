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

## Required fields

Every field on the listing form is required except amenities and the photo order. That includes the address, title (at least 10 characters), description (at least 30) and at least one photo.

- The title and description boxes show an example as a placeholder.
- For flats, houses and commercial space, every fact the form shows is required: size, bathrooms, total floors, furnishing and parking, plus balconies for homes. 0 is accepted where a property has none.
- Floor number is asked only for flats, rooms and commercial units, not for whole houses or duplexes.
- Land and plots need only their size in katha.

The rules live in `src/lib/listings/submission-schema.ts`, used by both the browser and the server. The photo minimum (`MIN_PHOTOS`) is checked in the browser, where the photos are. Moderators see "ছবি নেই" in the review queue if a listing somehow arrives without one.

## Reports

A visitor can report any listing they can see ("এই লিস্টিংয়ে সমস্যা? রিপোর্ট করুন" under the listing box), signed in or not. Staff handle reports at `/admin/reports`.

- **On the account page:** staff see a link to that page with the number of open reports.
- **On the reports page:** reports are grouped by listing, the most reported first. Each group shows the reason, details, the reporter's optional contact, and whether they were signed in.
- **Actions:** "লিস্টিং সরিয়ে দিন" takes the listing down for good (status `removed`). "সমাধান হয়েছে" and "বাদ দিন" close the reports and leave the listing up. All three close every open report on that listing at once, through `handle_listing_reports()`.

Limits, enforced by the database (migration `20261018000300_listing_reports.sql`):

- A signed-in account can file at most 10 reports a day, and only one open report per listing. Its account is always recorded.
- Visitors who are not signed in can file at most 5 open reports per listing between them, and 30 an hour across the whole site.
- A listing that has been taken down cannot be reported any more.

## Edited listings in the review queue

A listing waiting for review that was approved before (it has `published_at`) is an edit of a live listing. The queue marks it "সম্পাদিত" and reminds the moderator that rejecting it closes the listing for good.

## Video

A lister can add **one video** per listing, next to the photos. It is optional. Limits: **50 MB and 2 minutes**; MP4, MOV (iPhone) or WebM. Migration: `20261018000500_listing_videos.sql`.

**Uploading.** The video goes the same way as photos: from the browser straight to the public `listing-videos` bucket, into `<user id>/<listing id>/`. Before upload, the browser does two things (`src/lib/listings/video.ts`):

- **Removes the filming location.** Phones write it into the video's `moov` box as an ISO 6709 string (iPhone `com.apple.quicktime.location`, Android `©xyz`). Every such string has its digits replaced with zeros. The length stays the same, so the file still plays. Unit tests: `tests/video.test.ts`.
- **Saves a still frame** from about one second in, as the poster. Visitors see the poster first, and the video only downloads when they press play (`preload="none"`). That saves mobile data and the free plan's bandwidth.

**Rules in the database** (`listing_videos`, one row per listing):

- The file must be the lister's own upload for that listing, in the video bucket.
- At most 2 minutes, and only on listings made here.
- Adding, replacing or removing the video of a live listing sends it back to review, like a photo change.
- The bucket itself refuses files over 50 MB and any other file type.

**Where it shows:**

- **Listing page:** a "ভিডিও" section above the description.
- **Review queue:** a player, so moderators can check it.
- **Edit page:** the current video, which the lister can remove or replace. Replaced files are deleted from storage.

**Costs.** Supabase's free plan has 1 GB of storage and 5 GB of downloads a month. At 50 MB per video, that is roughly 20 maximum-size videos of storage. Most phone clips of a minute or less are 10 to 30 MB. Watch Storage in the Supabase dashboard, and move to the Pro plan ($25 a month: 100 GB storage, 250 GB downloads) when it gets close.

**Known limit.** Some phones record HEVC (H.265). A few browsers cannot play it, mostly Chrome on older Android and on Windows. The form refuses a video the lister's own browser cannot open. For best results, MP4 (H.264) works everywhere.

## Areas

`src/data/locations.ts` lists:

- 150 neighbourhoods in Dhaka city, including Mirpur sections 1 to 14, Old Dhaka, Badda/Vatara, Mohammadpur housing areas and the airport side
- 38 in Chattogram
- 28 in Sylhet

Uttara sectors are search spellings of Uttara, not separate areas. Coordinates are approximate area centres, used only to place map pins.

Adding more areas:

1. Edit the file and run `npm run db:generate`.
2. Copy the regenerated `insert into public.locations …` statement into a new migration, as `20261018000400_more_areas.sql` does, so existing databases get the new rows too.
