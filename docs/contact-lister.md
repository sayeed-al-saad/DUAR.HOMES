# Contact the lister

Migration: `20261018000100_contact_lister.sql`.

A buyer or renter reaches the lister by phone or WhatsApp. There is no message form yet.

## How it works

1. **The lister decides.** The listing form has two boxes:
   - "লগইন করা ব্যবহারকারীদের আমার ফোন নম্বর দেখাতে দিন" (ticked by default, in plain view)
   - "এই নম্বরে WhatsApp আছে"

   The choice is stored in `listing_contacts.show_phone` and `whatsapp`. On "আমার লিস্টিং" the lister can switch the number on or off at any time, and sees how many different people have looked at it ("৩ জন নম্বর দেখেছেন"). They do not see who.
2. **The listing page** asks `listing_phone_available()`. This answers yes or no and nothing more; anyone may call it. It says yes only for an active listing made on this site, not a demo one, whose lister chose to show a phone number.
   - Not signed in: "নম্বর দেখতে লগইন করুন", which goes to the login page and back.
   - Signed in: "নম্বর দেখুন". Pressing it calls `reveal_listing_phone()` through a server action, and shows the name and number with "কল করুন" (`tel:`) and, if given, "WhatsApp" (`wa.me`, with a short message naming the listing).
   - Number hidden: "লিস্টার এই লিস্টিংয়ে ফোন নম্বর দেখাচ্ছেন না।"
   - Demo listing: says there is no number. Demo numbers could belong to real people, so the database never hands them out.

   Every state also shows the warning not to pay any advance before seeing the property and checking the papers.
3. **The number is never in the page HTML.** It only arrives after the button is pressed, so search engines and scrapers reading pages never get it.

## Limits against harvesting

- Only signed-in accounts can reveal a number, and Supabase Auth only lets an account in after its email is confirmed.
- One account can see at most **20 different numbers in 24 hours** (`private.daily_reveal_limit()`). Asking again for a number already seen is free. Past the limit the visitor is told to try tomorrow.
- The lister and staff are neither limited nor counted.
- Every reveal is logged in `contact_reveals` (who, which listing, first and last time, how many times). Only staff can read it, through the SQL editor for now. Deleting an account deletes its rows.

If the limit is too strict or too loose, change the number in `private.daily_reveal_limit()` with a new migration. Also change the "২০" in `bn.contact.dailyLimit` and in the privacy policy.

## Privacy policy

`/privacy` describes all of this: who can see the number, the daily limit, the reveal log and the lister's switch. Keep it in step if the behaviour changes.

## Not built yet

- **A message form** for listers who don't want to show a number. The `inquiries` table already exists for this.
- **A staff page for the reveal log.** Today it is read in the SQL editor:

  ```sql
  select user_id, count(*) as numbers, max(last_revealed_at)
  from contact_reveals group by user_id order by numbers desc limit 20;
  ```

## How it was checked

- `npm run db:test`, section "Contact the lister":
  - only approved, non-demo listings with the lister's permission hand out a number
  - visitors must sign in
  - the reveal is logged, and only staff can read the log
  - the lister and staff are not counted
  - the lister sees the count
  - the 20-a-day limit, and that it resets after 24 hours
  - only the lister can hide the number
  - a rented listing hands out nothing
- **Browser run** against the local Supabase stand-in:
  1. List a property with WhatsApp.
  2. A moderator approves it.
  3. Signed out, the number is not in the HTML.
  4. Sign up from the listing page and come back.
  5. Reveal the number; check the call and WhatsApp links.
  6. The lister sees "১ জন নম্বর দেখেছেন" and hides the number.
  7. The listing page then says it is hidden.
  8. A demo listing says it has no number.
- **Accessibility:** axe scans of the listing page (signed out and with the number shown) and of "my listings" found no violations.
