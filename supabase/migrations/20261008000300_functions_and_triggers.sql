-- Phase 1 · 3 of 7 · Functions and triggers
--
-- Every function pins search_path to '' and uses fully qualified names, so it
-- cannot be tricked by objects in another schema.

-- ---------------------------------------------------------------------------
-- Who is calling?
-- ---------------------------------------------------------------------------

create or replace function private.current_role_name()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select u.role from public.users u where u.id = (select auth.uid());
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_role_name() in ('moderator', 'admin'), false);
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_role_name() = 'admin', false);
$$;

-- True for staff, and for trusted back-end contexts: the service role, and
-- direct database sessions such as migrations and the SQL editor (no JWT).
-- Used by the guard triggers below to decide whether protected columns may change.
create or replace function private.is_trusted_context()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select auth.jwt()) ->> 'role', 'service_role') = 'service_role'
    or private.is_staff();
$$;

revoke all on function private.current_role_name() from public;
revoke all on function private.is_staff() from public;
revoke all on function private.is_admin() from public;
revoke all on function private.is_trusted_context() from public;
grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.current_role_name() to anon, authenticated, service_role;
grant execute on function private.is_staff() to anon, authenticated, service_role;
grant execute on function private.is_admin() to anon, authenticated, service_role;
grant execute on function private.is_trusted_context() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Housekeeping
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.users
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.locations
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.agencies
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.agents
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.sources
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.properties
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.property_private
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.property_listings
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.listing_contacts
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.saved_searches
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.inquiries
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.verification_records
  for each row execute function private.set_updated_at();

-- Keeps locations.search_text in step with the names.
create or replace function private.set_location_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_text := lower(concat_ws(
    ' ',
    new.name_bn,
    new.name_en,
    replace(new.slug, '-', ' '),
    array_to_string(new.alt_names, ' ')
  ));
  return new;
end;
$$;

create trigger set_location_search_text
  before insert or update of name_bn, name_en, slug, alt_names on public.locations
  for each row execute function private.set_location_search_text();

-- ---------------------------------------------------------------------------
-- Sign-up: create the profile row
-- ---------------------------------------------------------------------------

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text := nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '');
begin
  -- The role is always 'member' here. It can never be chosen at sign-up.
  insert into public.users (id, display_name)
  values (new.id, left(requested_name, 80))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Guards: columns ordinary users may not change on rows they own
-- ---------------------------------------------------------------------------

create or replace function private.guard_user_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not private.is_trusted_context() then
    raise exception 'Only staff can change a user role' using errcode = '42501';
  end if;
  if new.role is distinct from old.role
     and (new.role in ('moderator', 'admin') or old.role in ('moderator', 'admin'))
     and (select auth.uid()) is not null
     and not private.is_admin() then
    raise exception 'Only an admin can grant or remove staff roles' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_user_columns before update on public.users
  for each row execute function private.guard_user_columns();

create or replace function private.guard_agency_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_trusted_context() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_verified := false;
    new.verified_at := null;
    new.plan := 'free';
    new.is_demo := false;
    return new;
  end if;
  if new.is_verified is distinct from old.is_verified
     or new.verified_at is distinct from old.verified_at
     or new.plan is distinct from old.plan
     or new.owner_user_id is distinct from old.owner_user_id
     or new.is_demo is distinct from old.is_demo then
    raise exception 'Verification, plan and ownership of an agency are set by staff' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_agency_columns before insert or update on public.agencies
  for each row execute function private.guard_agency_columns();

create or replace function private.guard_agent_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_trusted_context() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_verified := false;
    new.verified_at := null;
    new.plan := 'free';
    new.is_demo := false;
    return new;
  end if;
  if new.is_verified is distinct from old.is_verified
     or new.verified_at is distinct from old.verified_at
     or new.plan is distinct from old.plan
     or new.user_id is distinct from old.user_id
     or new.is_demo is distinct from old.is_demo then
    raise exception 'Verification, plan and ownership of an agent profile are set by staff' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_agent_columns before insert or update on public.agents
  for each row execute function private.guard_agent_columns();

create or replace function private.guard_property_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_trusted_context() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_verified := false;
    new.verified_at := null;
    new.owner_user_id := null;       -- ownership is granted through a reviewed claim
    new.is_demo := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if new.is_verified is distinct from old.is_verified
     or new.verified_at is distinct from old.verified_at
     or new.owner_user_id is distinct from old.owner_user_id
     or new.created_by is distinct from old.created_by
     or new.is_demo is distinct from old.is_demo then
    raise exception 'Verification and ownership of a property are set by staff' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_property_columns before insert or update on public.properties
  for each row execute function private.guard_property_columns();

-- Listers manage their own first-party listings but cannot approve, verify,
-- feature or re-source them.
create or replace function private.guard_listing_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_trusted_context() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.origin <> 'first_party' then
      raise exception 'External listings are created by the ingestion system only' using errcode = '42501';
    end if;
    if new.status not in ('draft', 'pending_review') then
      new.status := 'pending_review';
    end if;
    new.listed_by_user_id := (select auth.uid());
    new.is_verified := false;
    new.verified_at := null;
    new.featured_until := null;
    new.view_count := 0;
    new.previous_price := null;
    new.price_changed_at := null;
    new.published_at := null;
    new.source_url := null;
    new.source_listing_ref := null;
    new.source_listed_at := null;
    new.is_demo := false;
    return new;
  end if;

  if new.origin is distinct from old.origin
     or new.source_id is distinct from old.source_id
     or new.property_id is distinct from old.property_id
     or new.listed_by_user_id is distinct from old.listed_by_user_id
     or new.is_verified is distinct from old.is_verified
     or new.verified_at is distinct from old.verified_at
     or new.featured_until is distinct from old.featured_until
     or new.view_count is distinct from old.view_count
     or new.first_seen_at is distinct from old.first_seen_at
     or new.last_seen_at is distinct from old.last_seen_at
     or new.last_checked_at is distinct from old.last_checked_at
     -- Price history is written by track_price_change, which runs after this guard.
     or new.previous_price is distinct from old.previous_price
     or new.price_changed_at is distinct from old.price_changed_at
     or new.published_at is distinct from old.published_at
     or new.source_url is distinct from old.source_url
     or new.source_listing_ref is distinct from old.source_listing_ref
     or new.is_demo is distinct from old.is_demo then
    raise exception 'That field is managed by the system or by staff' using errcode = '42501';
  end if;

  -- A lister may withdraw a listing, close it, or send it back for review.
  -- Only staff can make it active or reverse a staff decision.
  if new.status is distinct from old.status then
    if old.status in ('rejected', 'removed') then
      raise exception 'This listing was closed by staff and cannot be reopened by the lister' using errcode = '42501';
    end if;
    if new.status not in ('draft', 'pending_review', 'sold', 'rented', 'archived') then
      raise exception 'Only staff can set a listing to %', new.status using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_listing_columns before insert or update on public.property_listings
  for each row execute function private.guard_listing_columns();

-- ---------------------------------------------------------------------------
-- Content rules for external listings (copyright and privacy defaults)
-- ---------------------------------------------------------------------------

-- These three run for every writer, including the service role, so the rules
-- hold even if an ingestion adapter has a bug. They are security definer because
-- they must read a source's permission flags, which browser roles cannot see.
create or replace function private.enforce_listing_content_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  src public.sources%rowtype;
begin
  select * into src from public.sources s where s.id = new.source_id;

  if (src.source_type = 'first_party') <> (new.origin = 'first_party') then
    raise exception 'Listing origin (%) does not match its source type (%)', new.origin, src.source_type
      using errcode = '23514';
  end if;

  if new.origin = 'external' then
    -- Never keep a third-party description unless that source has allowed it.
    if not src.allow_description then
      new.description := null;
    end if;
    -- External listings have no account behind them.
    new.listed_by_user_id := null;
  end if;

  if new.status = 'active' and new.published_at is null then
    new.published_at := now();
  end if;

  return new;
end;
$$;

create trigger enforce_listing_content_rules
  before insert or update on public.property_listings
  for each row execute function private.enforce_listing_content_rules();

create or replace function private.enforce_image_rights()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing_origin public.listing_origin;
  images_allowed boolean;
begin
  select l.origin, s.allow_images
    into listing_origin, images_allowed
  from public.property_listings l
  join public.sources s on s.id = l.source_id
  where l.id = new.listing_id;

  if listing_origin = 'external' then
    if not images_allowed then
      raise exception 'This source has not authorised showing its images' using errcode = '23514';
    end if;
    if new.rights_status <> 'source_authorized' then
      raise exception 'Images on external listings must be marked source_authorized' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_image_rights
  before insert or update on public.listing_images
  for each row execute function private.enforce_image_rights();

create or replace function private.enforce_contact_rights()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing_origin public.listing_origin;
  contact_allowed boolean;
begin
  select l.origin, s.allow_contact
    into listing_origin, contact_allowed
  from public.property_listings l
  join public.sources s on s.id = l.source_id
  where l.id = new.listing_id;

  if listing_origin = 'external' and not contact_allowed then
    raise exception 'Contact details from this source may not be stored' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger enforce_contact_rights
  before insert or update on public.listing_contacts
  for each row execute function private.enforce_contact_rights();

-- Inquiries only make sense for our own listings, and always go to the lister.
create or replace function private.prepare_inquiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing public.property_listings%rowtype;
begin
  select * into listing from public.property_listings l where l.id = new.listing_id;

  if listing.origin <> 'first_party' or listing.status <> 'active' then
    raise exception 'Inquiries can only be sent for active listings posted on this site' using errcode = '23514';
  end if;

  new.recipient_user_id := listing.listed_by_user_id;
  new.status := 'new';
  return new;
end;
$$;

create trigger prepare_inquiry before insert on public.inquiries
  for each row execute function private.prepare_inquiry();

-- ---------------------------------------------------------------------------
-- Price history
-- ---------------------------------------------------------------------------

create or replace function private.track_price_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.price is distinct from old.price then
    new.previous_price := old.price;
    new.price_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger track_price_change before update of price on public.property_listings
  for each row execute function private.track_price_change();

create or replace function private.record_price_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Seed and import rows may arrive with a known earlier price.
    if new.previous_price is not null then
      insert into public.price_history (listing_id, price, previous_price, recorded_at)
      values (new.id, new.previous_price, null, new.first_seen_at);
    end if;
    insert into public.price_history (listing_id, price, previous_price, recorded_at)
    values (new.id, new.price, new.previous_price, coalesce(new.price_changed_at, new.first_seen_at));
  elsif new.price is distinct from old.price then
    insert into public.price_history (listing_id, price, previous_price, recorded_at)
    values (new.id, new.price, old.price, coalesce(new.price_changed_at, now()));
  end if;
  return null;
end;
$$;

create trigger record_price_history
  after insert or update of price on public.property_listings
  for each row execute function private.record_price_history();

-- ---------------------------------------------------------------------------
-- Public helpers
-- ---------------------------------------------------------------------------

-- Autocomplete for the location box. Matches Bangla or English, any known spelling.
create or replace function public.search_locations(search_query text, max_results integer default 8)
returns table (
  id             uuid,
  slug           text,
  type           public.location_type,
  name_bn        text,
  name_en        text,
  parent_name_bn text
)
language sql
stable
set search_path = ''
as $$
  with input as (
    select
      lower(btrim(regexp_replace(coalesce(search_query, ''), '\s+', ' ', 'g'))) as needle,
      least(greatest(coalesce(max_results, 8), 1), 20) as max_rows
  ),
  pattern as (
    select
      needle,
      max_rows,
      -- Treat % and _ as ordinary characters.
      replace(replace(replace(needle, '\', '\\'), '%', '\%'), '_', '\_') as escaped
    from input
  )
  select l.id, l.slug, l.type, l.name_bn, l.name_en, p.name_bn
  from pattern
  join public.locations l
    on pattern.needle = ''
    or l.search_text like '%' || pattern.escaped || '%'
  left join public.locations p on p.id = l.parent_id
  where pattern.needle <> '' or l.is_popular
  order by
    (lower(l.name_bn) = pattern.needle or lower(l.name_en) = pattern.needle) desc,
    (lower(l.name_bn) like pattern.escaped || '%' or lower(l.name_en) like pattern.escaped || '%') desc,
    l.is_popular desc,
    l.sort_order,
    l.name_en
  limit (select max_rows from pattern);
$$;

comment on function public.search_locations(text, integer) is
  'Location autocomplete. Empty query returns the popular places.';

-- Staff-only: the full source record, including internal notes.
create or replace function public.staff_list_sources()
returns setof public.sources
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'Staff only' using errcode = '42501';
  end if;
  return query select s.* from public.sources s order by s.name;
end;
$$;

revoke all on function public.staff_list_sources() from public;
revoke all on function public.search_locations(text, integer) from public;
grant execute on function public.staff_list_sources() to authenticated, service_role;
grant execute on function public.search_locations(text, integer) to anon, authenticated, service_role;
