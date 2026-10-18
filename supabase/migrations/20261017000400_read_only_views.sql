-- Views are read-only
--
-- On Supabase, new objects in the public schema get every privilege for anon
-- and authenticated by default. None of these views can be written through
-- (they join several tables), but they should say so plainly: each role gets
-- SELECT and nothing else. Private views stay closed to anon.

revoke all on
  public.listing_cards, public.location_listing_stats, public.location_summaries,
  public.external_search_links, public.location_ancestry, public.listing_groups,
  public.listing_search, public.listing_details, public.area_listing_counts,
  public.location_price_guide, public.my_listings, public.duplicate_review,
  public.my_saved_listings, public.my_notifications
from anon, authenticated;

grant select on
  public.listing_cards, public.location_listing_stats, public.location_summaries,
  public.external_search_links, public.location_ancestry, public.listing_groups,
  public.listing_search, public.listing_details, public.area_listing_counts,
  public.location_price_guide
to anon, authenticated;

grant select on
  public.my_listings, public.duplicate_review, public.my_saved_listings, public.my_notifications
to authenticated;

-- The same default gave visitors EXECUTE on the staff-only source list. It
-- already refuses anyone who is not staff; this makes the permission say so too.
revoke execute on function public.staff_list_sources() from anon;
