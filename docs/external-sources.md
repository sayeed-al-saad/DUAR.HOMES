# Other property sites: what they allow, and what this site does

Reviewed on 8 October 2026.

## Short version

- The site **links out** to three real property sites. There are 17 buttons, each opening that site's own listing page in a new tab.
- By default it **does not show their listings**. The two sites whose terms could be read both restrict copying their content.
- **There is no crawler.** One was built for Bikroy's public listing facts and then removed at the owner's decision (October 2026). Other sites are only linked to.
- The database keeps the choice narrow. Without real permission a site can never have photos, descriptions or contact details stored. A site that says no is switched off automatically and cannot be switched back on.

## What each site says

| Site | robots.txt | Published terms | What this site does |
| --- | --- | --- | --- |
| Bikroy (bikroy.com) | Allows crawlers on listing pages. Blocks only `/test`, `/admin`, `/crm`, `/auth/facebook`. | The terms apply to anyone who uses the site. Section 7.16: users "will not copy, modify, distribute any other User Content without consent of the respective user". Section 7.17 forbids collecting information about users, including phone numbers. | Links only |
| bdHousing (bdhousing.com) | Blocks only `/admin`. | Visitors must not republish, reproduce, duplicate or copy material from the site. Search engines may link to it without prior approval, as long as the link is not misleading and uses no logo. bdHousing may ask for links to be removed. | Links only, by name |
| Bproperty (bproperty.com) | Allows everything except `/dashboard`. | The terms page timed out and could not be read. What it allows is unknown. | Links only |
| PBazaar (pbazaar.com) | Could not be read, so no page on the site was opened. | Not read. | Not included |

Limits of this review:

- The pages were read through an automated reader that summarises what it finds. The quotes above are short extracts, and a summary can miss a clause. Read the full terms yourself before relying on this table.
- This is a description of what the sites publish, not legal advice. Whether copying facts such as price and size from a public advert is lawful in Bangladesh is a question for a lawyer.
- Terms change. The review date is stored with each site in `sources.notes`.

Where the pages are: [Bikroy robots.txt](https://bikroy.com/robots.txt), [Bikroy terms](https://bikroy.com/rules.html), [bdHousing robots.txt](https://www.bdhousing.com/robots.txt), [bdHousing terms](https://www.bdhousing.com/terms-conditions), [Bproperty robots.txt](https://www.bproperty.com/robots.txt), [Bproperty terms](https://www.bproperty.com/terms-of-use).

## What is on the site now

- **Home page:** a section called "অন্য সাইটে খুঁজুন" with the 17 buttons, grouped by site.
- **Search page:** a block called "এই সার্চটি অন্য সাইটে দেখুন" that offers only the links matching the search. Someone looking to rent in Dhanmondi gets the Dhaka rent pages, not Sylhet or land.
- **Listing cards from other sources** (demo ones today) have a clear "মূল লিস্টিং দেখুন" button and an "অন্য সাইট" tag.
- Sites are named in text only. No logos.

Each link was opened on the review date and confirmed to be a working listing page. Four candidate links that returned "not found" or timed out were left out.

### Add, change or retire a link

- Edit `src/data/external-sites.ts`, then run `npm run db:generate`. This rewrites `supabase/migrations/20261008000900_external_sites_data.sql`, which is safe to run again.
- To hide a broken link at once in a live database: `update public.source_links set is_working = false where url = '...';`

## Showing real listings from a site

**Only with the site's written permission.** Record it and switch the site on:

```sql
update public.sources
set permission_status = 'granted',
    active = true,
    notes = notes || ' Permission received from <name> on <date>, by <email or contract reference>.'
where slug = 'bikroy';
```

Leave `allow_images`, `allow_description` and `allow_contact` off unless the permission covers them.

Each listing then appears with the site's name and a "মূল লিস্টিং দেখুন" button. Until then, the database refuses the listing with the message "Source ... is not enabled".

## Ways to get real listings

1. **Ask the sites.** A partner feed or written permission is the lasting answer, and it is what the `permission_status` field is for. Nothing found suggests any of the three offers a public API; the only Bikroy tools that turned up are unofficial scrapers run by other people.
2. **Take listings from owners and agents directly.** That is Phase 7 of the brief, and it needs nobody's permission but theirs.

## How this change was checked

| Check | Result |
| --- | --- |
| Type check, lint, production build | Clean |
| Unit tests | 62 pass (10 new: link data, descriptions, matching, dates) |
| Database test | 72 pass (9 new: the two new migrations apply, real sites are off, no real listings stored, a switched-off site cannot receive listings or be switched on without permission, visitors can read but not change links, broken links disappear, staff can manage links) |
| Migrations applied with the Supabase CLI | All nine plus the seed apply cleanly |
| Site run against PostgREST on the test database | Same home page as demo mode; visitors cannot write to the links table over HTTP |
| Browser checks | 14 pass in demo mode, 23 in database mode, including that all 17 buttons go only to the three sites |
| Accessibility scan | 0 violations |

Not verified: that the 17 links still work after the review date, and anything about these sites beyond what the table states.

