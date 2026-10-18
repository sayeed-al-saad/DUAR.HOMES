-- Editing a listing · Listers change their own listings; staff check the changes
--
-- Rule: nothing a lister writes reaches the public site without a moderator,
-- except an ordinary price change.
--
--   * Price, and "price negotiable", may change on a live listing and stay
--     live, so listers can lower a price and saved-listing alerts go out. A
--     change to under half or over double the old price goes back to review.
--   * Any other change to a live listing sends it back to review
--     (status pending_review, so it leaves the site until approved). That covers:
--       - the title, description, purpose or lister type;
--       - the property's facts or area, amenities, address or photos;
--       - the contact name, phone or WhatsApp. Switching the number on or off does not.
--
-- These rules are triggers, so they hold however the change is made: through
-- the edit page, or straight through the API with the lister's own token.
-- Staff and the service role are not affected.
--
-- public.update_listing() and public.update_listing_photos() are what the edit
-- page calls. They run as the lister, so row-level security and every guard
-- trigger still apply.

-- ---------------------------------------------------------------------------
-- The address of a listing never changes, except by staff.
-- ---------------------------------------------------------------------------

create or replace function private.guard_listing_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug and not private.is_trusted_context() then
    raise exception 'The listing address is set by the system' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_listing_slug before update on public.property_listings
  for each row execute function private.guard_listing_slug();

-- ---------------------------------------------------------------------------
-- Changes to the listing row itself.
-- ---------------------------------------------------------------------------

create or replace function private.review_listing_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_trusted_context() or old.status <> 'active' or new.status <> 'active' then
    return new;
  end if;

  if (new.title, new.description, new.purpose, new.lister_type)
       is distinct from (old.title, old.description, old.purpose, old.lister_type)
     or new.price > old.price * 2
     or new.price < old.price / 2 then
    new.status := 'pending_review';
  end if;
  return new;
end;
$$;

create trigger review_listing_edit before update on public.property_listings
  for each row execute function private.review_listing_edit();

-- ---------------------------------------------------------------------------
-- Changes to what hangs off a listing: facts, amenities, address, photos, contact.
-- ---------------------------------------------------------------------------

create or replace function private.review_after_lister_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  prop uuid;
  lst  uuid;
begin
  if private.is_trusted_context() then
    return null;
  end if;

  if tg_table_name = 'properties' then
    if (to_jsonb(old) - 'updated_at') = (to_jsonb(new) - 'updated_at') then
      return null;
    end if;
    prop := new.id;
  elsif tg_table_name = 'property_private' then
    if tg_op = 'DELETE' then
      prop := old.property_id;
    else
      if tg_op = 'UPDATE' and old.address_line is not distinct from new.address_line then
        return null;
      end if;
      prop := new.property_id;
    end if;
  elsif tg_table_name = 'property_amenities' then
    if tg_op = 'DELETE' then
      prop := old.property_id;
    else
      prop := new.property_id;
    end if;
  elsif tg_table_name = 'listing_contacts' then
    -- Switching the number on or off is the lister's own business.
    if (old.contact_name, old.phone, old.whatsapp) is not distinct from (new.contact_name, new.phone, new.whatsapp) then
      return null;
    end if;
    lst := new.listing_id;
  else
    if tg_op = 'DELETE' then
      lst := old.listing_id;
    else
      lst := new.listing_id;
    end if;
  end if;

  -- Runs as the lister: row-level security limits this to their own listings.
  update public.property_listings l
     set status = 'pending_review'
   where l.status = 'active'
     and l.origin = 'first_party'
     and l.listed_by_user_id = (select auth.uid())
     and (l.property_id = prop or l.id = lst);

  return null;
end;
$$;

create trigger review_after_lister_edit after update on public.properties
  for each row execute function private.review_after_lister_edit();
create trigger review_after_lister_edit after insert or update or delete on public.property_private
  for each row execute function private.review_after_lister_edit();
create trigger review_after_lister_edit after insert or delete on public.property_amenities
  for each row execute function private.review_after_lister_edit();
create trigger review_after_lister_edit after update on public.listing_contacts
  for each row execute function private.review_after_lister_edit();
create trigger review_after_lister_edit after insert or update or delete on public.listing_images
  for each row execute function private.review_after_lister_edit();

-- ---------------------------------------------------------------------------
-- The edit page: one call saves everything except photos.
-- ---------------------------------------------------------------------------

create or replace function public.update_listing(p_listing_id uuid, p jsonb)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  lst     public.property_listings%rowtype;
  loc     public.locations%rowtype;
  wanted  text[];
  addr    text;
  result  text;
begin
  if me is null then
    raise exception 'Sign in to edit a listing' using errcode = '42501';
  end if;

  select * into lst from public.property_listings l where l.id = p_listing_id and l.listed_by_user_id = me;
  if not found or lst.status not in ('pending_review', 'active') then
    raise exception 'This listing cannot be edited' using errcode = '42501', hint = 'not_editable';
  end if;

  select * into loc from public.locations l where l.slug = p ->> 'location_slug';
  if not found or loc.type in ('division', 'district') then
    raise exception 'Choose an area or city' using errcode = '22023', hint = 'location';
  end if;

  -- Each table is only written when something in it really changed, so an
  -- unchanged form does not send the listing back to review.
  update public.properties pr
     set location_id     = loc.id,
         latitude        = loc.latitude,
         longitude       = loc.longitude,
         property_type   = (p ->> 'property_type')::public.property_type,
         size_sqft       = (p ->> 'size_sqft')::numeric,
         land_size_katha = (p ->> 'land_size_katha')::numeric,
         bedrooms        = (p ->> 'bedrooms')::smallint,
         bathrooms       = (p ->> 'bathrooms')::smallint,
         balconies       = (p ->> 'balconies')::smallint,
         floor_number    = (p ->> 'floor_number')::smallint,
         total_floors    = (p ->> 'total_floors')::smallint,
         furnishing      = (p ->> 'furnishing')::public.furnishing_level,
         parking_spaces  = (p ->> 'parking_spaces')::smallint
   where pr.id = lst.property_id
     and (pr.location_id, pr.property_type, pr.size_sqft, pr.land_size_katha, pr.bedrooms, pr.bathrooms,
          pr.balconies, pr.floor_number, pr.total_floors, pr.furnishing, pr.parking_spaces)
         is distinct from
         (loc.id, (p ->> 'property_type')::public.property_type, (p ->> 'size_sqft')::numeric,
          (p ->> 'land_size_katha')::numeric, (p ->> 'bedrooms')::smallint, (p ->> 'bathrooms')::smallint,
          (p ->> 'balconies')::smallint, (p ->> 'floor_number')::smallint, (p ->> 'total_floors')::smallint,
          (p ->> 'furnishing')::public.furnishing_level, (p ->> 'parking_spaces')::smallint);

  wanted := array(select jsonb_array_elements_text(coalesce(p -> 'amenities', '[]'::jsonb)));
  delete from public.property_amenities a
   where a.property_id = lst.property_id and not (a.amenity_slug = any (wanted));
  insert into public.property_amenities (property_id, amenity_slug)
  select lst.property_id, slug from unnest(wanted) as slug
  on conflict do nothing;

  addr := nullif(btrim(coalesce(p ->> 'address_line', '')), '');
  if addr is null then
    delete from public.property_private pp where pp.property_id = lst.property_id;
  else
    insert into public.property_private as pp (property_id, address_line) values (lst.property_id, addr)
    on conflict (property_id) do update
      set address_line = excluded.address_line
      where pp.address_line is distinct from excluded.address_line;
  end if;

  update public.property_listings l
     set purpose          = (p ->> 'purpose')::public.listing_purpose,
         title            = p ->> 'title',
         description      = nullif(btrim(coalesce(p ->> 'description', '')), ''),
         price            = (p ->> 'price')::numeric,
         price_negotiable = coalesce((p ->> 'price_negotiable')::boolean, false),
         lister_type      = (p ->> 'lister_type')::public.lister_type
   where l.id = p_listing_id
     and (l.purpose, l.title, l.description, l.price, l.price_negotiable, l.lister_type)
         is distinct from
         ((p ->> 'purpose')::public.listing_purpose, p ->> 'title',
          nullif(btrim(coalesce(p ->> 'description', '')), ''), (p ->> 'price')::numeric,
          coalesce((p ->> 'price_negotiable')::boolean, false), (p ->> 'lister_type')::public.lister_type);

  insert into public.listing_contacts as c (listing_id, contact_name, phone, whatsapp, show_phone)
  values (
    p_listing_id,
    nullif(btrim(coalesce(p ->> 'contact_name', '')), ''),
    nullif(p ->> 'phone', ''),
    nullif(p ->> 'whatsapp', ''),
    coalesce((p ->> 'show_phone')::boolean, false)
  )
  on conflict (listing_id) do update
    set contact_name = excluded.contact_name,
        phone        = excluded.phone,
        whatsapp     = excluded.whatsapp,
        show_phone   = excluded.show_phone
    where (c.contact_name, c.phone, c.whatsapp, c.show_phone)
          is distinct from (excluded.contact_name, excluded.phone, excluded.whatsapp, excluded.show_phone);

  select l.status::text into result from public.property_listings l where l.id = p_listing_id;
  return result;
end;
$$;

revoke all on function public.update_listing(uuid, jsonb) from public, anon;
grant execute on function public.update_listing(uuid, jsonb) to authenticated, service_role;

-- Photos: keep these (in this order), add these new uploads after them.
-- p_new is a list of {"path": ..., "url": ...}; the photo trigger checks each
-- one is the lister's own upload for this listing. Returns the photo count.
create or replace function public.update_listing_photos(p_listing_id uuid, p_keep uuid[], p_new jsonb, p_alt text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  lst    public.property_listings%rowtype;
  total  integer;
begin
  if me is null then
    raise exception 'Sign in to edit a listing' using errcode = '42501';
  end if;
  select * into lst from public.property_listings l where l.id = p_listing_id and l.listed_by_user_id = me;
  if not found or lst.status not in ('pending_review', 'active') then
    raise exception 'This listing cannot be edited' using errcode = '42501', hint = 'not_editable';
  end if;

  delete from public.listing_images i
   where i.listing_id = p_listing_id and not (i.id = any (coalesce(p_keep, '{}')));

  update public.listing_images i set is_primary = false where i.listing_id = p_listing_id and i.is_primary;

  insert into public.listing_images (listing_id, url, storage_path, alt_bn, sort_order, is_primary, rights_status)
  select p_listing_id, item ->> 'url', item ->> 'path', left(coalesce(p_alt, ''), 200), 1000 + n::integer, false, 'owned'
  from jsonb_array_elements(coalesce(p_new, '[]'::jsonb)) with ordinality as t(item, n);

  -- Kept photos first, in the order given, then the new ones. The first is the cover.
  with ordered as (
    select i.id,
           (row_number() over (order by coalesce(array_position(p_keep, i.id), 100000), i.sort_order) - 1)::integer as n
    from public.listing_images i
    where i.listing_id = p_listing_id
  )
  update public.listing_images i
     set sort_order = o.n, is_primary = (o.n = 0)
    from ordered o
   where i.id = o.id;

  select count(*) into total from public.listing_images i where i.listing_id = p_listing_id;
  return total;
end;
$$;

revoke all on function public.update_listing_photos(uuid, uuid[], jsonb, text) from public, anon;
grant execute on function public.update_listing_photos(uuid, uuid[], jsonb, text) to authenticated, service_role;
