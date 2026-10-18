-- One property, one card
--
-- Several listings can describe the same flat: the owner lists it here, an
-- agent posts it on two portals. They already share one row in `properties`
-- once they have been merged (see the next migration). This migration makes
-- search, counts and averages treat each property as one result.
--
-- Within a property and purpose, the active listings are ranked: our own
-- listing first (it has photos and a lister to contact), then the lowest
-- price, then the newest. Rank 1 is the "group lead": the one card search
-- shows. The card also says how many other listings there are and the lowest
-- price among them, and the listing page lists them all.
--
-- Mirrors assignGroups() in src/lib/data/listing-math.ts; scripts/test-db.ts
-- checks that both agree.

create view public.listing_groups
with (security_invoker = true)
as
select
  l.id as listing_id,
  l.property_id,
  l.purpose,
  row_number() over (
    partition by l.property_id, l.purpose
    order by (l.origin = 'first_party') desc, l.price, l.first_seen_at desc, l.id
  ) as group_rank,
  count(*) over (partition by l.property_id, l.purpose) as group_size,
  min(l.price) over (partition by l.property_id, l.purpose) as group_min_price
from public.property_listings l
where l.status = 'active';

comment on view public.listing_groups is
  'Active listings ranked within their property and purpose. group_rank = 1 is the listing search shows.';

-- The views built on listing_cards list its columns at creation, so they are
-- dropped here and created again with the new columns.
drop view public.my_listings;
drop view public.listing_details;
drop view public.listing_search;

-- Same as before, with three columns added at the end.
create or replace view public.listing_cards
with (security_invoker = true)
as
select
  l.id,
  l.slug,
  l.title,
  l.purpose,
  l.origin,
  l.lister_type,
  l.status,
  l.price,
  l.previous_price,
  l.price_changed_at,
  case
    when l.previous_price is not null and l.previous_price > l.price
      then round(((l.previous_price - l.price) / l.previous_price) * 100, 1)
  end as price_drop_percent,
  l.is_verified,
  l.first_seen_at,
  l.last_seen_at,
  l.last_checked_at,
  l.published_at,
  l.view_count,
  l.is_demo,
  l.source_url,
  l.source_listed_at,
  p.id as property_id,
  p.property_type,
  p.category,
  p.size_sqft,
  p.land_size_katha,
  p.bedrooms,
  p.bathrooms,
  case when p.size_sqft > 0 then round(l.price / p.size_sqft) end as price_per_sqft,
  loc.id as location_id,
  loc.slug as location_slug,
  loc.type as location_type,
  loc.name_bn as location_name_bn,
  loc.name_en as location_name_en,
  parent.slug as parent_location_slug,
  parent.name_bn as parent_location_name_bn,
  s.id as source_id,
  s.slug as source_slug,
  s.name as source_name,
  img.url as image_url,
  img.alt_bn as image_alt,
  -- Listings that are not active are never grouped: each stands alone.
  coalesce(g.group_rank = 1, true) as is_group_lead,
  coalesce(g.group_size - 1, 0)::integer as also_listed_count,
  case when g.group_size > 1 then g.group_min_price end as group_min_price
from public.property_listings l
join public.properties p on p.id = l.property_id
join public.locations loc on loc.id = p.location_id
left join public.locations parent on parent.id = loc.parent_id
join public.sources s on s.id = l.source_id
left join public.listing_groups g on g.listing_id = l.id
left join lateral (
  select i.url, i.alt_bn
  from public.listing_images i
  where i.listing_id = l.id
  order by i.is_primary desc, i.sort_order, i.created_at
  limit 1
) img on true;

create view public.listing_search
with (security_invoker = true)
as
select c.*, a.ancestor_slug as place_slug
from public.listing_cards c
join public.location_ancestry a on a.location_id = c.location_id;

comment on view public.listing_search is
  'listing_cards with one row per enclosing place; filter on place_slug.';

create view public.listing_details
with (security_invoker = true)
as
select
  c.*,
  -- External descriptions are dropped on the way in, so this is only ever our own listers' text.
  l.description,
  p.furnishing,
  p.balconies,
  p.floor_number,
  p.total_floors,
  p.parking_spaces,
  coalesce((
    select jsonb_agg(jsonb_build_object('slug', am.slug, 'name_bn', am.name_bn) order by am.sort_order, am.slug)
    from public.property_amenities pa
    join public.amenities am on am.slug = pa.amenity_slug
    where pa.property_id = p.id
  ), '[]'::jsonb) as amenities,
  coalesce((
    select jsonb_agg(jsonb_build_object('price', h.price, 'recorded_at', h.recorded_at) order by h.recorded_at, h.id)
    from public.price_history h
    where h.listing_id = l.id
  ), '[]'::jsonb) as price_history
from public.listing_cards c
join public.property_listings l on l.id = c.id
join public.properties p on p.id = c.property_id;

comment on view public.listing_details is
  'One listing with facts, amenities and price history. Public columns only.';

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
  and (l.listed_by_user_id = (select auth.uid()) or (select private.is_staff()));

comment on view public.my_listings is
  'Listings made on this site with their lister. Each user sees their own; staff see all.';

grant select on public.listing_groups, public.listing_search, public.listing_details to anon, authenticated, service_role;
revoke all on public.my_listings from anon;
grant select on public.my_listings to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Counts and averages: one property counts once
-- ---------------------------------------------------------------------------

create or replace view public.location_listing_stats
with (security_invoker = true)
as
with recursive ancestry (location_id, ancestor_id) as (
  select id, id from public.locations
  union all
  select a.location_id, l.parent_id
  from ancestry a
  join public.locations l on l.id = a.ancestor_id
  where l.parent_id is not null
)
select
  anc.id as location_id,
  anc.slug,
  anc.type,
  anc.name_bn,
  anc.name_en,
  anc.is_popular,
  anc.sort_order,
  count(l.id) as active_listing_count,
  round(avg(l.price / p.size_sqft) filter (
    where l.purpose = 'sale' and p.category = 'residential' and p.size_sqft > 0
  )) as avg_sale_price_per_sqft,
  count(l.id) filter (
    where l.purpose = 'sale' and p.category = 'residential' and p.size_sqft > 0
  ) as sale_sample_size,
  round(avg(l.price) filter (
    where l.purpose = 'rent' and p.category = 'residential' and p.property_type <> 'room'
  )) as avg_monthly_rent,
  count(l.id) filter (
    where l.purpose = 'rent' and p.category = 'residential' and p.property_type <> 'room'
  ) as rent_sample_size,
  bool_or(coalesce(l.is_demo, false)) as contains_demo_data
from public.locations anc
left join ancestry a on a.ancestor_id = anc.id
left join public.properties p on p.location_id = a.location_id
left join (
  public.property_listings l
  join public.listing_groups g on g.listing_id = l.id and g.group_rank = 1
) on l.property_id = p.id
group by anc.id;

comment on view public.location_listing_stats is
  'Active properties and average asking prices per location, children included. Each property counts once. Estimates only.';

create or replace view public.area_listing_counts
with (security_invoker = true)
as
select
  a.ancestor_slug as slug,
  m.mode,
  count(*) as active_count,
  bool_or(l.is_demo) as contains_demo_data
from public.property_listings l
join public.listing_groups g on g.listing_id = l.id and g.group_rank = 1
join public.properties p on p.id = l.property_id
join public.location_ancestry a on a.location_id = p.location_id
cross join lateral (
  select case
    when p.category = 'residential' and l.purpose = 'sale' then 'buy'
    when p.category = 'residential' then 'rent'
    when p.category = 'land' and l.purpose = 'sale' then 'land'
    when p.category = 'commercial' then 'commercial'
  end as mode
) m
where l.status = 'active' and m.mode is not null
group by a.ancestor_slug, m.mode;

comment on view public.area_listing_counts is
  'Active properties per place (children included) and kind of search: buy, rent, land, commercial. Each property counts once.';

create or replace view public.location_price_guide
with (security_invoker = true)
as
select
  loc.slug,
  loc.type,
  loc.name_bn,
  loc.name_en,
  parent.slug as parent_slug,
  parent.name_bn as parent_name_bn,
  round(avg(l.price / p.size_sqft) filter (
    where p.category = 'residential' and l.purpose = 'sale' and p.size_sqft > 0
  )) as sale_per_sqft,
  count(*) filter (where p.category = 'residential' and l.purpose = 'sale' and p.size_sqft > 0) as sale_count,
  round(avg(l.price) filter (where r.rent_band = 'small')) as rent_small,
  count(*) filter (where r.rent_band = 'small') as rent_small_count,
  round(avg(l.price) filter (where r.rent_band = 'three')) as rent_three,
  count(*) filter (where r.rent_band = 'three') as rent_three_count,
  round(avg(l.price) filter (where r.rent_band = 'large')) as rent_large,
  count(*) filter (where r.rent_band = 'large') as rent_large_count,
  round(avg(l.price / p.land_size_katha) filter (
    where p.category = 'land' and l.purpose = 'sale' and p.land_size_katha > 0
  )) as land_per_katha,
  count(*) filter (where p.category = 'land' and l.purpose = 'sale' and p.land_size_katha > 0) as land_count,
  bool_or(l.is_demo) as contains_demo_data
from public.property_listings l
join public.listing_groups g on g.listing_id = l.id and g.group_rank = 1
join public.properties p on p.id = l.property_id
join public.location_ancestry a on a.location_id = p.location_id
join public.locations loc on loc.id = a.ancestor_id
left join public.locations parent on parent.id = loc.parent_id
cross join lateral (
  select case
    when p.category <> 'residential' or l.purpose <> 'rent' or p.property_type = 'room' or p.bedrooms is null then null
    when p.bedrooms <= 2 then 'small'
    when p.bedrooms = 3 then 'three'
    else 'large'
  end as rent_band
) r
where l.status = 'active'
group by loc.id, parent.id;

comment on view public.location_price_guide is
  'Average asking prices per place with sample sizes: sale per sq ft, monthly rent by bedrooms, land per katha. Each property counts once. Estimates only.';
