-- Removes every demo row loaded by supabase/seed.sql.
--
-- Run it once, before launch, in the Supabase SQL editor or with psql.
-- Real locations, amenities and your own listings are not touched.
-- Deleting a listing also deletes its images, price history, favourites,
-- reports and inquiries (they cascade).

begin;

delete from public.property_listings where is_demo;
delete from public.properties where is_demo;
delete from public.agents where is_demo;
delete from public.agencies where is_demo;
delete from public.sources where is_demo;

-- Anything left behind means a real row is still attached to a demo row.
do $$
declare
  leftover integer;
begin
  select
    (select count(*) from public.property_listings where is_demo)
    + (select count(*) from public.properties where is_demo)
    + (select count(*) from public.listing_images where is_demo)
    + (select count(*) from public.agents where is_demo)
    + (select count(*) from public.agencies where is_demo)
    + (select count(*) from public.sources where is_demo)
  into leftover;

  if leftover > 0 then
    raise exception 'Demo cleanup incomplete: % demo rows remain', leftover;
  end if;
end;
$$;

commit;
