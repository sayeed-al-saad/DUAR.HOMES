-- Phase 1 · 5 of 7 · Read models for the public site
--
-- These views run with the caller's own permissions (security_invoker), so
-- row-level security on the underlying tables still decides what is visible.
-- They select only public columns: no exact address, no contact details, no
-- internal source fields.

create view public.listing_cards
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
  img.alt_bn as image_alt
from public.property_listings l
join public.properties p on p.id = l.property_id
join public.locations loc on loc.id = p.location_id
left join public.locations parent on parent.id = loc.parent_id
join public.sources s on s.id = l.source_id
left join lateral (
  select i.url, i.alt_bn
  from public.listing_images i
  where i.listing_id = l.id
  order by i.is_primary desc, i.sort_order, i.created_at
  limit 1
) img on true;

comment on view public.listing_cards is
  'One row per listing with everything a property card needs. Public columns only.';

-- Listing counts and asking-price averages per place, rolled up so that a city
-- includes its areas and a district includes its city.
--
-- These are averages of asking prices on active listings. They are estimates
-- for orientation, not valuations. If one property has several active listings
-- it is counted once per listing until duplicate merging arrives in Phase 6.
--
-- Fine at MVP scale. When listings reach the tens of thousands, turn this into
-- a materialised view refreshed on a schedule (Phase 8).
create view public.location_listing_stats
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
left join public.property_listings l on l.property_id = p.id and l.status = 'active'
group by anc.id;

comment on view public.location_listing_stats is
  'Active listing counts and average asking prices per location, children included. Estimates only.';

-- A place together with the name of the place it sits in ("ধানমন্ডি, ঢাকা").
create view public.location_summaries
with (security_invoker = true)
as
select
  l.id,
  l.slug,
  l.type,
  l.name_bn,
  l.name_en,
  l.is_popular,
  l.sort_order,
  p.slug as parent_slug,
  p.name_bn as parent_name_bn
from public.locations l
left join public.locations p on p.id = l.parent_id;

grant select on public.listing_cards, public.location_listing_stats, public.location_summaries
  to anon, authenticated, service_role;
