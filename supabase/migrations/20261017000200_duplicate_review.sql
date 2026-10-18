-- Finding and merging duplicate listings
--
-- 1. public.find_duplicate_candidates() compares active listings that are in
--    the same place, of the same kind and purpose, with the same number of
--    bedrooms, a size within 7% and a price within 15%. Likely pairs go into
--    listing_duplicates as "pending", with a confidence score and the signals
--    behind it. Nothing is merged automatically.
-- 2. Staff look at each pair on /admin/duplicates and call
--    public.resolve_duplicate(): "merged" moves both listings onto one
--    property, so search shows them as one card; "rejected" keeps them apart
--    and the pair is not suggested again.
-- 3. public.split_listing() undoes a wrong merge: the listing gets its own
--    copy of the property again.
--
-- All three are for staff (and for the crawler, which runs as the service role).

create or replace function public.find_duplicate_candidates()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  added integer;
begin
  if not private.is_trusted_context() then
    raise exception 'Only staff can look for duplicates' using errcode = '42501';
  end if;

  with pairs as (
    select
      la.id as a_id,
      lb.id as b_id,
      -- Relative differences: 0 means identical.
      case when pa.size_sqft > 0 and pb.size_sqft > 0
        then abs(pa.size_sqft - pb.size_sqft) / greatest(pa.size_sqft, pb.size_sqft) end as size_diff,
      case when pa.land_size_katha > 0 and pb.land_size_katha > 0
        then abs(pa.land_size_katha - pb.land_size_katha) / greatest(pa.land_size_katha, pb.land_size_katha) end as katha_diff,
      abs(la.price - lb.price) / greatest(la.price, lb.price) as price_diff,
      pa.floor_number is not null and pa.floor_number = pb.floor_number as same_floor,
      la.source_id = lb.source_id as same_source
    from public.property_listings la
    join public.properties pa on pa.id = la.property_id
    join public.properties pb
      on pb.location_id = pa.location_id
     and pb.property_type = pa.property_type
     and pb.bedrooms is not distinct from pa.bedrooms
     and pb.id <> pa.id
    join public.property_listings lb
      on lb.property_id = pb.id
     and lb.purpose = la.purpose
     and lb.status = 'active'
     and lb.is_demo = la.is_demo
     and la.id < lb.id
    where la.status = 'active'
  ),
  scored as (
    select
      a_id,
      b_id,
      size_diff,
      katha_diff,
      price_diff,
      same_floor,
      same_source,
      least(100, round(
        40
        + 30 * (1 - coalesce(size_diff, katha_diff) / 0.07)
        + 20 * (1 - price_diff / 0.15)
        + case when same_floor then 10 else 0 end
      , 2)) as confidence
    from pairs
    -- A size (or land area) on both sides is required: without it, too many flats look alike.
    where coalesce(size_diff, katha_diff) is not null
      and coalesce(size_diff, katha_diff) <= 0.07
      and price_diff <= 0.15
  )
  insert into public.listing_duplicates (listing_a_id, listing_b_id, confidence, signals)
  select
    a_id,
    b_id,
    confidence,
    jsonb_strip_nulls(jsonb_build_object(
      'size_diff_percent', round(size_diff * 100, 1),
      'katha_diff_percent', round(katha_diff * 100, 1),
      'price_diff_percent', round(price_diff * 100, 1),
      'same_floor', same_floor,
      'same_source', same_source
    ))
  from scored
  where confidence >= 60
  on conflict (listing_a_id, listing_b_id) do nothing;

  get diagnostics added = row_count;
  return added;
end;
$$;

revoke all on function public.find_duplicate_candidates() from public, anon;
grant execute on function public.find_duplicate_candidates() to authenticated, service_role;

-- Merges or rejects one suggested pair.
create or replace function public.resolve_duplicate(pair_id uuid, decision public.duplicate_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pair     public.listing_duplicates%rowtype;
  la       public.property_listings%rowtype;
  lb       public.property_listings%rowtype;
  keeper   uuid;
  other    uuid;
begin
  if not private.is_trusted_context() then
    raise exception 'Only staff can merge listings' using errcode = '42501';
  end if;
  if decision not in ('merged', 'rejected', 'review_later') then
    raise exception 'Decide merged, rejected or review_later' using errcode = '22023';
  end if;

  select * into pair from public.listing_duplicates d where d.id = pair_id for update;
  if not found then
    raise exception 'No such duplicate pair' using errcode = 'P0002';
  end if;

  if decision = 'merged' then
    select * into la from public.property_listings l where l.id = pair.listing_a_id;
    select * into lb from public.property_listings l where l.id = pair.listing_b_id;

    -- Keep the property our own lister described; otherwise the older listing's.
    if lb.origin = 'first_party' and la.origin <> 'first_party' then
      keeper := lb.property_id;
      other := la.property_id;
    elsif la.origin = 'first_party' and lb.origin <> 'first_party' then
      keeper := la.property_id;
      other := lb.property_id;
    elsif la.first_seen_at <= lb.first_seen_at then
      keeper := la.property_id;
      other := lb.property_id;
    else
      keeper := lb.property_id;
      other := la.property_id;
    end if;

    if keeper <> other then
      -- Facts missing on the kept property are filled from the other one.
      update public.properties k
      set size_sqft = coalesce(k.size_sqft, o.size_sqft),
          land_size_katha = coalesce(k.land_size_katha, o.land_size_katha),
          bathrooms = coalesce(k.bathrooms, o.bathrooms),
          balconies = coalesce(k.balconies, o.balconies),
          floor_number = coalesce(k.floor_number, o.floor_number),
          total_floors = case when k.floor_number is null then coalesce(k.total_floors, o.total_floors) else k.total_floors end,
          furnishing = coalesce(k.furnishing, o.furnishing),
          parking_spaces = coalesce(k.parking_spaces, o.parking_spaces),
          year_built = coalesce(k.year_built, o.year_built)
      from public.properties o
      where k.id = keeper and o.id = other;

      insert into public.property_amenities (property_id, amenity_slug)
      select keeper, pa.amenity_slug from public.property_amenities pa where pa.property_id = other
      on conflict do nothing;

      -- Every listing of the other property moves, so nothing is left behind.
      -- The other property row itself stays (it may hold a lister's private address).
      update public.property_listings set property_id = keeper where property_id = other;
    end if;

    -- Pairs that are now on one property are settled too.
    update public.listing_duplicates d
    set status = 'merged', reviewed_by = (select auth.uid()), reviewed_at = now()
    where d.status in ('pending', 'review_later')
      and exists (
        select 1 from public.property_listings x join public.property_listings y on y.property_id = x.property_id
        where x.id = d.listing_a_id and y.id = d.listing_b_id
      );
  end if;

  update public.listing_duplicates
  set status = decision, reviewed_by = (select auth.uid()), reviewed_at = now()
  where id = pair_id;
end;
$$;

revoke all on function public.resolve_duplicate(uuid, public.duplicate_status) from public, anon;
grant execute on function public.resolve_duplicate(uuid, public.duplicate_status) to authenticated, service_role;

-- Undoes a merge for one listing: it gets its own copy of the property's facts.
create or replace function public.split_listing(listing_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  lst       public.property_listings%rowtype;
  new_id    uuid;
begin
  if not private.is_trusted_context() then
    raise exception 'Only staff can split listings' using errcode = '42501';
  end if;

  select * into lst from public.property_listings l where l.id = split_listing.listing_id;
  if not found then
    raise exception 'No such listing' using errcode = 'P0002';
  end if;
  if (select count(*) from public.property_listings l where l.property_id = lst.property_id) < 2 then
    raise exception 'This listing already has a property of its own' using errcode = '22023';
  end if;

  insert into public.properties
    (location_id, property_type, size_sqft, land_size_katha, bedrooms, bathrooms, balconies, floor_number,
     total_floors, furnishing, parking_spaces, year_built, latitude, longitude, location_precision, is_demo)
  select location_id, property_type, size_sqft, land_size_katha, bedrooms, bathrooms, balconies, floor_number,
         total_floors, furnishing, parking_spaces, year_built, latitude, longitude, location_precision, is_demo
  from public.properties p where p.id = lst.property_id
  returning id into new_id;

  insert into public.property_amenities (property_id, amenity_slug)
  select new_id, pa.amenity_slug from public.property_amenities pa where pa.property_id = lst.property_id;

  update public.property_listings set property_id = new_id where id = lst.id;

  -- The pair is open for review again.
  update public.listing_duplicates d
  set status = 'review_later', reviewed_by = (select auth.uid()), reviewed_at = now()
  where d.status = 'merged' and (d.listing_a_id = lst.id or d.listing_b_id = lst.id);

  return new_id;
end;
$$;

revoke all on function public.split_listing(uuid) from public, anon;
grant execute on function public.split_listing(uuid) to authenticated, service_role;

-- The review queue: both listings of each open pair, side by side.
-- listing_duplicates is staff-only, so everyone else gets no rows.
create view public.duplicate_review
with (security_invoker = true)
as
select
  d.id,
  d.confidence,
  d.signals,
  d.status,
  d.created_at,
  a.id as a_id, a.slug as a_slug, a.title as a_title, a.origin as a_origin, a.source_name as a_source_name,
  a.source_url as a_source_url, a.price as a_price, a.size_sqft as a_size_sqft, a.land_size_katha as a_land_size_katha,
  a.image_url as a_image_url, a.first_seen_at as a_first_seen_at, a.property_id as a_property_id,
  b.id as b_id, b.slug as b_slug, b.title as b_title, b.origin as b_origin, b.source_name as b_source_name,
  b.source_url as b_source_url, b.price as b_price, b.size_sqft as b_size_sqft, b.land_size_katha as b_land_size_katha,
  b.image_url as b_image_url, b.first_seen_at as b_first_seen_at, b.property_id as b_property_id,
  a.purpose, a.property_type, a.bedrooms, a.location_slug, a.location_name_bn, a.parent_location_name_bn, a.is_demo
from public.listing_duplicates d
join public.listing_cards a on a.id = d.listing_a_id
join public.listing_cards b on b.id = d.listing_b_id;

comment on view public.duplicate_review is
  'Suggested duplicate pairs with both listings. Staff only (through listing_duplicates).';

revoke all on public.duplicate_review from anon;
grant select on public.duplicate_review to authenticated, service_role;
