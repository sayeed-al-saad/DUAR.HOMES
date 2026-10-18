-- Contact the lister · Signed-in visitors can see a lister's phone number
--
-- A lister chooses, per listing, whether to show their phone number
-- (listing_contacts.show_phone). The number is never part of any public view.
-- A signed-in visitor asks for it through public.reveal_listing_phone(), which:
--
--   * only answers for active listings made on this site, never demo ones
--     (demo numbers could belong to real people);
--   * only when the lister said yes;
--   * at most 20 different listings per account per 24 hours, so nobody can
--     harvest the numbers. Asking again for the same number is free.
--
-- Every reveal is logged in contact_reveals so staff can spot abuse, and
-- listers can see how many people looked at their number.

create table public.contact_reveals (
  user_id           uuid not null references auth.users (id) on delete cascade,
  listing_id        uuid not null references public.property_listings (id) on delete cascade,
  first_revealed_at timestamptz not null default now(),
  last_revealed_at  timestamptz not null default now(),
  times             integer not null default 1 check (times >= 1),
  primary key (user_id, listing_id)
);
comment on table public.contact_reveals is
  'Who saw which lister''s phone number, and when. Staff only; written by reveal_listing_phone().';

create index contact_reveals_recent_idx on public.contact_reveals (user_id, last_revealed_at desc);
create index contact_reveals_listing_idx on public.contact_reveals (listing_id);

alter table public.contact_reveals enable row level security;
revoke all on public.contact_reveals from anon, authenticated;
grant all on public.contact_reveals to service_role;
grant select on public.contact_reveals to authenticated;

create policy "contact_reveals: staff read" on public.contact_reveals
  for select to authenticated
  using ((select private.is_staff()));

-- How many different numbers one account may see in 24 hours.
create or replace function private.daily_reveal_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 20 $$;

-- Can this listing's number be asked for? Safe for anyone: says yes or no, nothing more.
create or replace function public.listing_phone_available(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.property_listings l
    join public.listing_contacts c on c.listing_id = l.id
    where l.id = p_listing_id
      and l.origin = 'first_party'
      and l.status = 'active'
      and not l.is_demo
      and c.show_phone
      and c.phone is not null
  );
$$;

revoke all on function public.listing_phone_available(uuid) from public;
grant execute on function public.listing_phone_available(uuid) to anon, authenticated, service_role;

create or replace function public.reveal_listing_phone(p_listing_id uuid)
returns table (contact_name text, phone text, whatsapp text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me       uuid := (select auth.uid());
  lister   uuid;
  contact  public.listing_contacts%rowtype;
  recent   integer;
begin
  if me is null then
    raise exception 'Sign in to see the phone number' using errcode = '42501', hint = 'sign_in';
  end if;

  if not public.listing_phone_available(p_listing_id) then
    raise exception 'This number is not available' using errcode = 'P0002', hint = 'unavailable';
  end if;

  select l.listed_by_user_id into lister from public.property_listings l where l.id = p_listing_id;
  select * into contact from public.listing_contacts c where c.listing_id = p_listing_id;

  -- The lister and staff are neither counted nor limited.
  if lister is distinct from me and not private.is_staff() then
    if not exists (
      select 1 from public.contact_reveals r
      where r.user_id = me and r.listing_id = p_listing_id and r.last_revealed_at > now() - interval '1 day'
    ) then
      select count(*) into recent
      from public.contact_reveals r
      where r.user_id = me and r.last_revealed_at > now() - interval '1 day';
      if recent >= private.daily_reveal_limit() then
        raise exception 'Too many numbers today' using errcode = 'P0001', hint = 'daily_limit';
      end if;
    end if;

    insert into public.contact_reveals as r (user_id, listing_id)
    values (me, p_listing_id)
    on conflict (user_id, listing_id) do update
      set last_revealed_at = now(), times = r.times + 1;
  end if;

  return query select contact.contact_name, contact.phone, contact.whatsapp;
end;
$$;

revoke all on function public.reveal_listing_phone(uuid) from public, anon;
grant execute on function public.reveal_listing_phone(uuid) to authenticated, service_role;

-- For "my listings": how many different people have seen the number of each of my listings.
create or replace function public.my_listing_reveal_counts()
returns table (listing_id uuid, people integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.listing_id, count(*)::integer
  from public.contact_reveals r
  join public.property_listings l on l.id = r.listing_id
  where l.listed_by_user_id = (select auth.uid())
  group by r.listing_id;
$$;

revoke all on function public.my_listing_reveal_counts() from public, anon;
grant execute on function public.my_listing_reveal_counts() to authenticated, service_role;

-- Submissions now record whether the lister wants their number shown.
create or replace function public.submit_listing(p jsonb)
returns table (listing_id uuid, listing_slug text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me            uuid := (select auth.uid());
  loc           public.locations%rowtype;
  first_party   uuid;
  new_property  uuid;
  new_listing   uuid;
  recent        integer;
  amenity       text;
begin
  if me is null then
    raise exception 'Sign in to list a property' using errcode = '42501';
  end if;

  select count(*) into recent
  from public.property_listings l
  where l.listed_by_user_id = me and l.created_at > now() - interval '1 day';
  if recent >= private.daily_submission_limit() then
    raise exception 'Too many listings submitted today' using errcode = 'P0001', hint = 'daily_limit';
  end if;

  select * into loc from public.locations l where l.slug = p ->> 'location_slug';
  if not found or loc.type in ('division', 'district') then
    raise exception 'Choose an area or city' using errcode = '22023', hint = 'location';
  end if;

  -- Only these columns of sources are readable by signed-in users.
  select s.id into first_party from public.sources s where s.source_type = 'first_party' order by s.slug limit 1;

  insert into public.properties
    (location_id, property_type, size_sqft, land_size_katha, bedrooms, bathrooms, balconies,
     floor_number, total_floors, furnishing, parking_spaces, latitude, longitude, location_precision)
  values (
    loc.id,
    (p ->> 'property_type')::public.property_type,
    (p ->> 'size_sqft')::numeric,
    (p ->> 'land_size_katha')::numeric,
    (p ->> 'bedrooms')::smallint,
    (p ->> 'bathrooms')::smallint,
    (p ->> 'balconies')::smallint,
    (p ->> 'floor_number')::smallint,
    (p ->> 'total_floors')::smallint,
    (p ->> 'furnishing')::public.furnishing_level,
    (p ->> 'parking_spaces')::smallint,
    -- The map shows the area, never the house: the area's centre point.
    loc.latitude,
    loc.longitude,
    'area_only'
  )
  returning id into new_property;

  for amenity in select jsonb_array_elements_text(coalesce(p -> 'amenities', '[]'::jsonb)) loop
    insert into public.property_amenities (property_id, amenity_slug) values (new_property, amenity)
    on conflict do nothing;
  end loop;

  -- The exact address is kept private: only the lister and staff can read it.
  if coalesce(btrim(p ->> 'address_line'), '') <> '' then
    insert into public.property_private (property_id, address_line) values (new_property, btrim(p ->> 'address_line'));
  end if;

  insert into public.property_listings
    (property_id, source_id, origin, purpose, title, slug, description, price, price_negotiable, lister_type, status)
  values (
    new_property, first_party, 'first_party',
    (p ->> 'purpose')::public.listing_purpose,
    p ->> 'title',
    p ->> 'slug',
    nullif(btrim(coalesce(p ->> 'description', '')), ''),
    (p ->> 'price')::numeric,
    coalesce((p ->> 'price_negotiable')::boolean, false),
    (p ->> 'lister_type')::public.lister_type,
    'pending_review'
  )
  returning id into new_listing;

  -- Contact details stay private. The phone number is only ever handed out by
  -- public.reveal_listing_phone(), and only when the lister chose to show it.
  insert into public.listing_contacts (listing_id, contact_name, phone, whatsapp, show_phone)
  values (
    new_listing,
    nullif(btrim(coalesce(p ->> 'contact_name', '')), ''),
    nullif(p ->> 'phone', ''),
    nullif(p ->> 'whatsapp', ''),
    coalesce((p ->> 'show_phone')::boolean, false)
  );

  return query select l.id, l.slug from public.property_listings l where l.id = new_listing;
end;
$$;

revoke all on function public.submit_listing(jsonb) from public, anon;
grant execute on function public.submit_listing(jsonb) to authenticated, service_role;
