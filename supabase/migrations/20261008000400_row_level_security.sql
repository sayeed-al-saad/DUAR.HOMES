-- Phase 1 · 4 of 7 · Row-level security and grants
--
-- Approach:
--   1. Every table has RLS on. No policy means no access.
--   2. Table privileges are granted explicitly, role by role, so the result
--      does not depend on the project's default-privilege settings.
--   3. `anon` (not signed in) can only read public catalogue data and file a report.
--   4. Staff checks call private.is_staff() / private.is_admin(), wrapped in a
--      sub-select so Postgres evaluates them once per statement, not per row.
--   5. The service role bypasses RLS. It is used only by trusted server code
--      (ingestion, admin jobs) and must never reach the browser.

alter table public.users                enable row level security;
alter table public.locations            enable row level security;
alter table public.agencies             enable row level security;
alter table public.agents               enable row level security;
alter table public.sources              enable row level security;
alter table public.amenities            enable row level security;
alter table public.properties           enable row level security;
alter table public.property_private     enable row level security;
alter table public.property_amenities   enable row level security;
alter table public.property_listings    enable row level security;
alter table public.listing_contacts     enable row level security;
alter table public.listing_images       enable row level security;
alter table public.favorites            enable row level security;
alter table public.saved_searches       enable row level security;
alter table public.inquiries            enable row level security;
alter table public.reports              enable row level security;
alter table public.price_history        enable row level security;
alter table public.listing_changes      enable row level security;
alter table public.listing_duplicates   enable row level security;
alter table public.verification_records enable row level security;

-- Start from nothing on our own tables, then grant exactly what each role needs.
-- (Only these tables are touched, so this is safe in a project that has others.)
revoke all on
  public.users, public.locations, public.agencies, public.agents, public.sources,
  public.amenities, public.properties, public.property_private, public.property_amenities,
  public.property_listings, public.listing_contacts, public.listing_images, public.favorites,
  public.saved_searches, public.inquiries, public.reports, public.price_history,
  public.listing_changes, public.listing_duplicates, public.verification_records
from anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;

grant all on
  public.users, public.locations, public.agencies, public.agents, public.sources,
  public.amenities, public.properties, public.property_private, public.property_amenities,
  public.property_listings, public.listing_contacts, public.listing_images, public.favorites,
  public.saved_searches, public.inquiries, public.reports, public.price_history,
  public.listing_changes, public.listing_duplicates, public.verification_records
to service_role;

-- ---------------------------------------------------------------------------
-- users: private. You can see and edit yourself; staff can see everyone.
-- ---------------------------------------------------------------------------

grant select on public.users to authenticated;
grant update (display_name, avatar_path, phone, preferred_language, role) on public.users to authenticated;

create policy "users: read own profile, staff read all" on public.users
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_staff()));

-- Admins may update any profile (to change roles). The guard_user_columns
-- trigger enforces who may set which role.
create policy "users: update own profile, admin update any" on public.users
  for update to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Reference data: readable by everyone, managed by staff
-- ---------------------------------------------------------------------------

grant select on public.locations, public.amenities to anon, authenticated;
grant insert, update, delete on public.locations, public.amenities to authenticated;

create policy "locations: public read" on public.locations
  for select to anon, authenticated using (true);
create policy "locations: staff insert" on public.locations
  for insert to authenticated with check ((select private.is_staff()));
create policy "locations: staff update" on public.locations
  for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "locations: admin delete" on public.locations
  for delete to authenticated using ((select private.is_admin()));

create policy "amenities: public read" on public.amenities
  for select to anon, authenticated using (true);
create policy "amenities: staff insert" on public.amenities
  for insert to authenticated with check ((select private.is_staff()));
create policy "amenities: staff update" on public.amenities
  for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "amenities: admin delete" on public.amenities
  for delete to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- sources: the public sees the name and website only.
-- Internal columns (notes, permission status, ingestion details, errors) are not
-- granted to browser roles at all; staff read them through staff_list_sources().
-- ---------------------------------------------------------------------------

grant select (id, name, slug, website, source_type, active, is_demo) on public.sources to anon, authenticated;
grant insert, update, delete on public.sources to authenticated;

create policy "sources: public read" on public.sources
  for select to anon, authenticated using (true);
create policy "sources: admin insert" on public.sources
  for insert to authenticated with check ((select private.is_admin()));
create policy "sources: admin update" on public.sources
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "sources: admin delete" on public.sources
  for delete to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- agencies and agents: public profiles; the owner edits, staff verify
-- ---------------------------------------------------------------------------

grant select on public.agencies, public.agents to anon, authenticated;
grant insert, update, delete on public.agencies, public.agents to authenticated;

create policy "agencies: public read" on public.agencies
  for select to anon, authenticated using (true);
create policy "agencies: staff insert" on public.agencies
  for insert to authenticated with check ((select private.is_staff()));
create policy "agencies: owner or staff update" on public.agencies
  for update to authenticated
  using (owner_user_id = (select auth.uid()) or (select private.is_staff()))
  with check (owner_user_id = (select auth.uid()) or (select private.is_staff()));
create policy "agencies: admin delete" on public.agencies
  for delete to authenticated using ((select private.is_admin()));

create policy "agents: public read" on public.agents
  for select to anon, authenticated using (true);
create policy "agents: staff insert" on public.agents
  for insert to authenticated with check ((select private.is_staff()));
create policy "agents: self or staff update" on public.agents
  for update to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()))
  with check (user_id = (select auth.uid()) or (select private.is_staff()));
create policy "agents: admin delete" on public.agents
  for delete to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- property_listings
-- ---------------------------------------------------------------------------

grant select on public.property_listings to anon, authenticated;
grant insert, update, delete on public.property_listings to authenticated;

-- Sold and rented listings stay readable so the page can say so plainly.
-- One select policy per role keeps the checks cheap.
create policy "listings: visitors read visible" on public.property_listings
  for select to anon
  using (status in ('active', 'stale', 'sold', 'rented'));

create policy "listings: users read visible and own, staff read all" on public.property_listings
  for select to authenticated
  using (
    status in ('active', 'stale', 'sold', 'rented')
    or listed_by_user_id = (select auth.uid())
    or (select private.is_staff())
  );

-- The guard_listing_columns trigger fixes the owner, status and protected fields.
create policy "listings: signed-in users create first-party" on public.property_listings
  for insert to authenticated
  with check (origin = 'first_party' or (select private.is_staff()));

create policy "listings: lister or staff update" on public.property_listings
  for update to authenticated
  using (listed_by_user_id = (select auth.uid()) or (select private.is_staff()))
  with check (listed_by_user_id = (select auth.uid()) or (select private.is_staff()));

create policy "listings: lister deletes drafts, admin deletes any" on public.property_listings
  for delete to authenticated
  using (
    (listed_by_user_id = (select auth.uid()) and status = 'draft')
    or (select private.is_admin())
  );

-- ---------------------------------------------------------------------------
-- properties: public once a visible listing points at them
-- ---------------------------------------------------------------------------

grant select on public.properties, public.property_amenities to anon, authenticated;
grant insert, update, delete on public.properties, public.property_amenities to authenticated;

-- The sub-query runs under the reader's own listing policies.
create policy "properties: visitors read when listed" on public.properties
  for select to anon
  using (exists (select 1 from public.property_listings l where l.property_id = properties.id));

create policy "properties: users read listed and own, staff read all" on public.properties
  for select to authenticated
  using (
    created_by = (select auth.uid())
    or owner_user_id = (select auth.uid())
    or (select private.is_staff())
    or exists (select 1 from public.property_listings l where l.property_id = properties.id)
  );

create policy "properties: signed-in users create" on public.properties
  for insert to authenticated
  with check (true);

create policy "properties: creator, owner or staff update" on public.properties
  for update to authenticated
  using (
    created_by = (select auth.uid())
    or owner_user_id = (select auth.uid())
    or (select private.is_staff())
  )
  with check (
    created_by = (select auth.uid())
    or owner_user_id = (select auth.uid())
    or (select private.is_staff())
  );

create policy "properties: admin delete" on public.properties
  for delete to authenticated using ((select private.is_admin()));

create policy "property_amenities: read with property" on public.property_amenities
  for select to anon, authenticated
  using (exists (select 1 from public.properties p where p.id = property_amenities.property_id));

create policy "property_amenities: editor insert" on public.property_amenities
  for insert to authenticated
  with check (exists (
    select 1 from public.properties p
    where p.id = property_amenities.property_id
      and (p.created_by = (select auth.uid()) or p.owner_user_id = (select auth.uid()) or (select private.is_staff()))
  ));

create policy "property_amenities: editor delete" on public.property_amenities
  for delete to authenticated
  using (exists (
    select 1 from public.properties p
    where p.id = property_amenities.property_id
      and (p.created_by = (select auth.uid()) or p.owner_user_id = (select auth.uid()) or (select private.is_staff()))
  ));

-- ---------------------------------------------------------------------------
-- property_private and listing_contacts: never public
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.property_private, public.listing_contacts to authenticated;

create policy "property_private: owner or staff all" on public.property_private
  for all to authenticated
  using (exists (
    select 1 from public.properties p
    where p.id = property_private.property_id
      and (p.created_by = (select auth.uid()) or p.owner_user_id = (select auth.uid()) or (select private.is_staff()))
  ))
  with check (exists (
    select 1 from public.properties p
    where p.id = property_private.property_id
      and (p.created_by = (select auth.uid()) or p.owner_user_id = (select auth.uid()) or (select private.is_staff()))
  ));

create policy "listing_contacts: lister or staff all" on public.listing_contacts
  for all to authenticated
  using (exists (
    select 1 from public.property_listings l
    where l.id = listing_contacts.listing_id
      and (l.listed_by_user_id = (select auth.uid()) or (select private.is_staff()))
  ))
  with check (exists (
    select 1 from public.property_listings l
    where l.id = listing_contacts.listing_id
      and (l.listed_by_user_id = (select auth.uid()) or (select private.is_staff()))
  ));

-- ---------------------------------------------------------------------------
-- listing_images and price_history: visible with their listing
-- ---------------------------------------------------------------------------

grant select on public.listing_images, public.price_history to anon, authenticated;
grant insert, update, delete on public.listing_images to authenticated;

create policy "listing_images: read with listing" on public.listing_images
  for select to anon, authenticated
  using (exists (select 1 from public.property_listings l where l.id = listing_images.listing_id));

create policy "listing_images: lister or staff insert" on public.listing_images
  for insert to authenticated
  with check (
    is_demo = false
    and exists (
      select 1 from public.property_listings l
      where l.id = listing_images.listing_id
        and (l.listed_by_user_id = (select auth.uid()) or (select private.is_staff()))
    )
  );

create policy "listing_images: lister or staff update" on public.listing_images
  for update to authenticated
  using (exists (
    select 1 from public.property_listings l
    where l.id = listing_images.listing_id
      and (l.listed_by_user_id = (select auth.uid()) or (select private.is_staff()))
  ))
  with check (
    is_demo = false
    and exists (
      select 1 from public.property_listings l
      where l.id = listing_images.listing_id
        and (l.listed_by_user_id = (select auth.uid()) or (select private.is_staff()))
    )
  );

create policy "listing_images: lister or staff delete" on public.listing_images
  for delete to authenticated
  using (exists (
    select 1 from public.property_listings l
    where l.id = listing_images.listing_id
      and (l.listed_by_user_id = (select auth.uid()) or (select private.is_staff()))
  ));

-- Rows are written by the record_price_history trigger only.
create policy "price_history: read with listing" on public.price_history
  for select to anon, authenticated
  using (exists (select 1 from public.property_listings l where l.id = price_history.listing_id));

-- ---------------------------------------------------------------------------
-- favorites and saved_searches: strictly personal
-- ---------------------------------------------------------------------------

grant select, insert, delete on public.favorites to authenticated;
grant select, insert, update, delete on public.saved_searches to authenticated;

-- You can only favourite a listing you are able to see.
create policy "favorites: own rows" on public.favorites
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.property_listings l where l.id = favorites.listing_id)
  );

create policy "saved_searches: own rows" on public.saved_searches
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- inquiries: between the sender and the lister
-- ---------------------------------------------------------------------------

grant select, insert on public.inquiries to authenticated;
grant update (status) on public.inquiries to authenticated;

create policy "inquiries: sender creates" on public.inquiries
  for insert to authenticated
  with check (sender_user_id = (select auth.uid()));

create policy "inquiries: sender, recipient or staff read" on public.inquiries
  for select to authenticated
  using (
    sender_user_id = (select auth.uid())
    or recipient_user_id = (select auth.uid())
    or (select private.is_staff())
  );

create policy "inquiries: recipient or staff update status" on public.inquiries
  for update to authenticated
  using (recipient_user_id = (select auth.uid()) or (select private.is_staff()))
  with check (recipient_user_id = (select auth.uid()) or (select private.is_staff()));

-- ---------------------------------------------------------------------------
-- reports: anyone can file one; only staff and the reporter can read it
-- ---------------------------------------------------------------------------

grant insert (listing_id, reason, details, reporter_contact) on public.reports to anon;
grant insert (listing_id, reason, details, reporter_contact, reporter_user_id) on public.reports to authenticated;
grant select on public.reports to authenticated;
grant update (status, resolution_note, resolved_by, resolved_at) on public.reports to authenticated;

-- The listing must be one the reporter can actually see.
create policy "reports: visitors file a report" on public.reports
  for insert to anon
  with check (
    reporter_user_id is null
    and status = 'open'
    and exists (select 1 from public.property_listings l where l.id = reports.listing_id)
  );

create policy "reports: users file a report" on public.reports
  for insert to authenticated
  with check (
    (reporter_user_id is null or reporter_user_id = (select auth.uid()))
    and status = 'open'
    and exists (select 1 from public.property_listings l where l.id = reports.listing_id)
  );

create policy "reports: reporter or staff read" on public.reports
  for select to authenticated
  using (reporter_user_id = (select auth.uid()) or (select private.is_staff()));

create policy "reports: staff resolve" on public.reports
  for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

-- ---------------------------------------------------------------------------
-- Staff-only working tables
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.listing_changes, public.listing_duplicates to authenticated;

create policy "listing_changes: staff all" on public.listing_changes
  for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy "listing_duplicates: staff all" on public.listing_duplicates
  for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

-- ---------------------------------------------------------------------------
-- verification_records: the applicant and staff
-- ---------------------------------------------------------------------------

grant select on public.verification_records to authenticated;
grant insert (type, property_id, listing_id, agent_id, agency_id, requested_by, applicant_note, document_paths)
  on public.verification_records to authenticated;
grant update (status, applicant_note, document_paths, reviewer_note, reviewed_by, reviewed_at)
  on public.verification_records to authenticated;

create policy "verification: applicant creates" on public.verification_records
  for insert to authenticated
  with check (requested_by = (select auth.uid()) and status = 'pending');

create policy "verification: applicant or staff read" on public.verification_records
  for select to authenticated
  using (requested_by = (select auth.uid()) or (select private.is_staff()));

create policy "verification: staff review" on public.verification_records
  for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));
