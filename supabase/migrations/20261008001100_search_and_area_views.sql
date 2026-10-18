-- Search, listing pages, area pages and the price guide · read models
--
-- All views run with the caller's permissions (security_invoker), so row-level
-- security still decides what a visitor sees. They expose public columns only.
--
-- Each view has an in-memory twin in src/lib/data/listing-math.ts (demo mode);
-- scripts/test-db.ts checks that both give the same answers.
--
-- Fine at MVP scale. With tens of thousands of listings, turn
-- location_ancestry into a table maintained by trigger and the two summary
-- views into materialised views refreshed on a schedule (Phase 8).

-- Every place paired with itself and every place above it.
create view public.location_ancestry
with (security_invoker = true)
as
with recursive ancestry (location_id, ancestor_id, depth) as (
  select id, id, 0 from public.locations
  union all
  select a.location_id, l.parent_id, a.depth + 1
  from ancestry a
  join public.locations l on l.id = a.ancestor_id
  where l.parent_id is not null
)
select a.location_id, a.ancestor_id, anc.slug as ancestor_slug, a.depth
from ancestry a
join public.locations anc on anc.id = a.ancestor_id;

comment on view public.location_ancestry is
  'Each location with itself and all locations above it.';

-- One row per listing and per place it lies in. Filtering on place_slug gives
-- each listing at most once, so "Dhaka" also finds listings in Uttara.
create view public.listing_search
with (security_invoker = true)
as
select c.*, a.ancestor_slug as place_slug
from public.listing_cards c
join public.location_ancestry a on a.location_id = c.location_id;

comment on view public.listing_search is
  'listing_cards with one row per enclosing place; filter on place_slug.';

-- Everything the listing page needs beyond the card. Public columns only:
-- no exact address, no contact details.
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

-- Which kind of search a listing belongs to. Mirrors modeOf() in src/lib/domain/listing-query.ts.
create view public.area_listing_counts
with (security_invoker = true)
as
select
  a.ancestor_slug as slug,
  m.mode,
  count(*) as active_count,
  bool_or(l.is_demo) as contains_demo_data
from public.property_listings l
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
  'Active listings per place (children included) and kind of search: buy, rent, land, commercial.';

-- Asking-price averages per place, children included, each with its sample size.
-- Estimates for orientation, not valuations.
create view public.location_price_guide
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
  'Average asking prices per place with sample sizes: sale per sq ft, monthly rent by bedrooms, land per katha. Estimates only.';

grant select on
  public.location_ancestry,
  public.listing_search,
  public.listing_details,
  public.area_listing_counts,
  public.location_price_guide
to anon, authenticated, service_role;
