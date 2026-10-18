-- List your property · Owners and agents submit listings; staff approve them
--
-- A signed-in user submits a listing through public.submit_listing(). It runs
-- as that user, so every existing rule still applies: the guard triggers set
-- the lister, force the status to "pending_review" and clear anything only
-- staff may set. Nothing appears on the site until a moderator or admin sets
-- the listing to "active".
--
-- Photos are uploaded by the browser straight to the listing-images bucket,
-- into <user id>/<listing id>/..., and then recorded in listing_images. The
-- trigger below makes sure a photo row can only ever point at a file the
-- lister uploaded for that listing.

-- How many listings one account may submit in a day. Stops floods, not people.
create or replace function private.daily_submission_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 10 $$;

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

  -- Contact details are private too; show_phone stays off until the contact feature exists.
  insert into public.listing_contacts (listing_id, contact_name, phone, whatsapp, show_phone)
  values (
    new_listing,
    nullif(btrim(coalesce(p ->> 'contact_name', '')), ''),
    nullif(p ->> 'phone', ''),
    nullif(p ->> 'whatsapp', ''),
    false
  );

  return query select l.id, l.slug from public.property_listings l where l.id = new_listing;
end;
$$;

revoke all on function public.submit_listing(jsonb) from public, anon;
grant execute on function public.submit_listing(jsonb) to authenticated, service_role;

-- A photo on a listing made here must be a file its lister uploaded for that
-- listing, served from our own bucket. At most 8 per listing.
create or replace function private.enforce_own_listing_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lst public.property_listings%rowtype;
  folders text[];
  photos integer;
begin
  select * into lst from public.property_listings l where l.id = new.listing_id;
  if lst.origin <> 'first_party' or new.is_demo then
    return new;
  end if;

  if new.rights_status not in ('owned', 'licensed') then
    raise exception 'Photos on listings made here must belong to the lister' using errcode = '23514';
  end if;
  if new.storage_path is null then
    raise exception 'A photo must be an uploaded file' using errcode = '23514';
  end if;
  folders := storage.foldername(new.storage_path);
  if folders[1] is distinct from lst.listed_by_user_id::text or folders[2] is distinct from lst.id::text then
    raise exception 'A photo must be in the lister''s folder for this listing' using errcode = '23514';
  end if;
  if new.url not like '%/storage/v1/object/public/listing-images/' || new.storage_path then
    raise exception 'A photo must be served from the listing-images bucket' using errcode = '23514';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'listing-images' and o.name = new.storage_path) then
    raise exception 'The photo file has not been uploaded' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    select count(*) into photos from public.listing_images i where i.listing_id = new.listing_id;
    if photos >= 8 then
      raise exception 'At most 8 photos per listing' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_own_listing_photo
  before insert or update on public.listing_images
  for each row execute function private.enforce_own_listing_photo();

-- What a lister sees on "my listings", and staff in the review queue:
-- the card plus who listed it and when. Row-level security limits each user
-- to their own rows; staff see all.
create view public.my_listings
with (security_invoker = true)
as
select
  c.*,
  l.listed_by_user_id,
  l.created_at as submitted_at,
  l.description
from public.listing_cards c
join public.property_listings l on l.id = c.id
where l.origin = 'first_party'
  -- listing_cards also shows everyone's public listings; this view is only ever about your own.
  and (l.listed_by_user_id = (select auth.uid()) or (select private.is_staff()));

comment on view public.my_listings is
  'Listings made on this site with their lister. Each user sees their own; staff see all.';

revoke all on public.my_listings from anon;
grant select on public.my_listings to authenticated, service_role;
