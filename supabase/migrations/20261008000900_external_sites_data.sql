-- Links out to other sites · 2 of 2 · The sites and their links
--
-- GENERATED FILE. Do not edit by hand.
-- Source: src/data/external-sites.ts
-- Regenerate with: npm run db:generate
--
-- Contents: 3 real property sites and 17 links to their public listing pages.
--
-- The sites are registered with ingestion switched OFF (active = false) and
-- permission_status = not_requested: none of them has given permission for its
-- listings to be shown here. Only links to their own pages are stored.
-- docs/external-sources.md records what each site's robots.txt and terms said.
--
-- Safe to run again: a site that already exists is left exactly as it is (so a
-- permission you have since recorded is not overwritten); links are refreshed.

insert into public.sources
  (id, name, slug, website, source_type, ingestion_method, permission_status, active, allow_images, allow_description, allow_contact, notes, is_demo)
values
  ('2bc20817-8c55-53d3-bc32-a8f26f7f6f68', 'Bikroy', 'bikroy', 'https://bikroy.com', 'classifieds', 'manual', 'not_requested', false, false, false, false, 'Reviewed 2026-10-08. robots.txt allows crawlers on listing pages (blocks only /test, /admin, /crm, /auth/facebook). Terms (bikroy.com/rules.html) apply to anyone who uses the site; section 7.16 says users will not copy, modify or distribute other users'' content without that user''s consent, and 7.17 forbids collecting information about users. Conclusion: link to their public pages only. Do not ingest listings without written permission from Bikroy.', false),
  ('c221b69a-9cc2-51ec-b3de-7c6440622c20', 'bdHousing', 'bdhousing', 'https://www.bdhousing.com', 'portal', 'manual', 'not_requested', false, false, false, false, 'Reviewed 2026-10-08. robots.txt blocks only /admin. Terms (bdhousing.com/terms-conditions) say visitors must not republish, reproduce, duplicate or copy material from the site. The same terms let search engines link to the site without prior approval, provided the link is not misleading and uses no logo or artwork; bdHousing may ask for links to be removed. Conclusion: link only, by name. Do not ingest listings without written permission from bdHousing.', false),
  ('dfb1c3fa-5606-5e8a-8603-c1cbe436aff9', 'Bproperty', 'bproperty', 'https://www.bproperty.com', 'portal', 'manual', 'not_requested', false, false, false, false, 'Reviewed 2026-10-08. robots.txt allows everything except /dashboard. The terms page (bproperty.com/terms-of-use) timed out and could not be read, so what it allows is unknown. Conclusion: link only. Read the terms and get permission before ingesting any listing.', false)
on conflict (slug) do nothing;

insert into public.source_links
  (id, source_id, url, purpose, category, location_id, last_checked_at, sort_order)
values
  ('da708f68-3539-59de-9b62-4fb2c781b65f', (select id from public.sources where slug = 'bikroy'), 'https://bikroy.com/en/ads/dhaka/apartment-rentals', 'rent', 'residential', 'ed6e1af5-29ed-5a7c-9a94-c53fdb96b90f', '2026-10-08T00:00:00.000Z'::timestamptz, 100),
  ('31a26b21-a35d-55a5-a413-bf39a71fd352', (select id from public.sources where slug = 'bikroy'), 'https://bikroy.com/dhaka/houses-apartments-for-sale', 'sale', 'residential', 'ed6e1af5-29ed-5a7c-9a94-c53fdb96b90f', '2026-10-08T00:00:00.000Z'::timestamptz, 101),
  ('fe457bc4-96c6-57c9-80fc-dc80f5c5a142', (select id from public.sources where slug = 'bikroy'), 'https://bikroy.com/dhaka/land-and-plots-for-sale', 'sale', 'land', 'ed6e1af5-29ed-5a7c-9a94-c53fdb96b90f', '2026-10-08T00:00:00.000Z'::timestamptz, 102),
  ('628b5aae-3d04-53c7-809e-0aaad70fa87f', (select id from public.sources where slug = 'bikroy'), 'https://bikroy.com/dhaka/commercial-property-for-rent', 'rent', 'commercial', 'ed6e1af5-29ed-5a7c-9a94-c53fdb96b90f', '2026-10-08T00:00:00.000Z'::timestamptz, 103),
  ('6baa4196-be39-5c22-9658-cc9dd7d25cf6', (select id from public.sources where slug = 'bikroy'), 'https://bikroy.com/chattogram/houses-apartments-for-rent', 'rent', 'residential', '9abe9687-489e-5f63-98b8-fdd0f997445e', '2026-10-08T00:00:00.000Z'::timestamptz, 104),
  ('0606c6f5-88c0-5451-b5d6-c07b86922535', (select id from public.sources where slug = 'bikroy'), 'https://bikroy.com/en/ads/sylhet/apartments-for-sale', 'sale', 'residential', 'e99a9c5a-af01-5ed0-a3f9-c42820d22aaf', '2026-10-08T00:00:00.000Z'::timestamptz, 105),
  ('3f41a707-29fa-5bdf-b2d5-617f64ce826c', (select id from public.sources where slug = 'bikroy'), 'https://bikroy.com/en/ads/sylhet/property', null, null, 'e99a9c5a-af01-5ed0-a3f9-c42820d22aaf', '2026-10-08T00:00:00.000Z'::timestamptz, 106),
  ('d8b5dcfb-d7bc-54dd-91e3-edf037ce0fc5', (select id from public.sources where slug = 'bikroy'), 'https://bikroy.com/houses-apartments-for-rent', 'rent', 'residential', null, '2026-10-08T00:00:00.000Z'::timestamptz, 107),
  ('96ba6c63-8365-5695-a218-cc796c0392bd', (select id from public.sources where slug = 'bikroy'), 'https://bikroy.com/houses-apartments-for-sale', 'sale', 'residential', null, '2026-10-08T00:00:00.000Z'::timestamptz, 108),
  ('5b6c4619-6131-5b6a-a3e4-b6e068c8bfc1', (select id from public.sources where slug = 'bikroy'), 'https://bikroy.com/land-and-plots-for-sale', 'sale', 'land', null, '2026-10-08T00:00:00.000Z'::timestamptz, 109),
  ('bd731ae7-6c9c-559d-bb97-2f0c867b3bde', (select id from public.sources where slug = 'bikroy'), 'https://bikroy.com/en/ads/bangladesh/commercial-property-rentals', 'rent', 'commercial', null, '2026-10-08T00:00:00.000Z'::timestamptz, 110),
  ('9d14c55b-d82d-57f0-bf31-ba1975ca9063', (select id from public.sources where slug = 'bdhousing'), 'https://www.bdhousing.com/homes/listings/Rent/Residential/Apartment', 'rent', 'residential', null, '2026-10-08T00:00:00.000Z'::timestamptz, 200),
  ('08a95a23-a1ba-5796-bcdc-589e43d81e1c', (select id from public.sources where slug = 'bdhousing'), 'https://www.bdhousing.com/homes/listings/Sale/Residential/Apartment', 'sale', 'residential', null, '2026-10-08T00:00:00.000Z'::timestamptz, 201),
  ('d18bb4a1-5282-55a4-b6a3-9ec3b0965c2e', (select id from public.sources where slug = 'bdhousing'), 'https://www.bdhousing.com/homes/listings/Sale/Land/commercial-plot', 'sale', 'land', null, '2026-10-08T00:00:00.000Z'::timestamptz, 202),
  ('84ff9452-d30c-5e17-a19a-882b0c795610', (select id from public.sources where slug = 'bproperty'), 'https://www.bproperty.com/category/apartment?city=dhaka', null, 'residential', 'ed6e1af5-29ed-5a7c-9a94-c53fdb96b90f', '2026-10-08T00:00:00.000Z'::timestamptz, 300),
  ('1ab26aff-9210-5f30-b10a-3467b1bfe234', (select id from public.sources where slug = 'bproperty'), 'https://www.bproperty.com/for-sale?category=apartment&cities=dhaka', 'sale', 'residential', null, '2026-10-08T00:00:00.000Z'::timestamptz, 301),
  ('6c5dea90-b341-536a-b091-42e6e7290188', (select id from public.sources where slug = 'bproperty'), 'https://www.bproperty.com/for-sale', 'sale', null, null, '2026-10-08T00:00:00.000Z'::timestamptz, 302)
on conflict (source_id, url) do update set
  purpose = excluded.purpose,
  category = excluded.category,
  location_id = excluded.location_id,
  last_checked_at = excluded.last_checked_at,
  sort_order = excluded.sort_order;
