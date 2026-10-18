-- Price-drop alerts
--
-- A signed-in visitor saves a listing (public.favorites). When the asking
-- price of that property falls, on any of its listings, they get an alert in
-- public.notifications, shown on /account/saved and flagged in the header.
--
-- Alerts are written by a trigger in the database, so they cannot be missed,
-- whether the price changed because a lister edited it, staff corrected it or
-- the crawler saw a new price at the source. Sending alerts by email or SMS
-- needs a mail or SMS provider and is not part of this migration.

-- The price when it was saved, to show "down ৳X since you saved it".
alter table public.favorites add column saved_price numeric(14, 2);

create or replace function private.set_saved_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Whatever the client sent, the stored price is the listing's real one.
  select l.price into new.saved_price from public.property_listings l where l.id = new.listing_id;
  return new;
end;
$$;

create trigger set_saved_price before insert on public.favorites
  for each row execute function private.set_saved_price();

-- One row per alert. It holds only facts that are already public (the listing
-- and its prices), and is deleted with the user or the listing.
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  kind        text not null default 'price_drop' check (kind in ('price_drop')),
  listing_id  uuid not null references public.property_listings (id) on delete cascade,
  old_price   numeric(14, 2) not null check (old_price > 0),
  new_price   numeric(14, 2) not null check (new_price > 0),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
comment on table public.notifications is 'Alerts for one user. Written by triggers only; the user can read, mark read and delete their own.';

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_listing_idx on public.notifications (listing_id);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

create policy "notifications: own rows" on public.notifications
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- When an active listing's price falls, everyone who saved any listing of the
-- same property (for the same purpose) hears about it once. The lister is not
-- told about their own change.
create or replace function private.notify_price_drop()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active' or new.price >= old.price then
    return null;
  end if;

  insert into public.notifications (user_id, kind, listing_id, old_price, new_price)
  select distinct f.user_id, 'price_drop', new.id, old.price, new.price
  from public.favorites f
  join public.property_listings saved on saved.id = f.listing_id
  where saved.property_id = new.property_id
    and saved.purpose = new.purpose
    and f.user_id is distinct from new.listed_by_user_id;

  return null;
end;
$$;

create trigger notify_price_drop
  after update of price on public.property_listings
  for each row execute function private.notify_price_drop();

-- What /account/saved shows: each saved listing with its price then and now.
-- favorites and the listing policies limit it to the reader's own saved listings.
create view public.my_saved_listings
with (security_invoker = true)
as
select
  c.*,
  f.saved_price,
  f.created_at as saved_at
from public.favorites f
join public.listing_cards c on c.id = f.listing_id
where f.user_id = (select auth.uid());

comment on view public.my_saved_listings is 'The reader''s saved listings, with the price when each was saved.';

-- Alerts with the listing they are about.
create view public.my_notifications
with (security_invoker = true)
as
select
  n.id,
  n.kind,
  n.old_price,
  n.new_price,
  n.created_at,
  n.read_at,
  c.id as listing_id,
  c.slug,
  c.title,
  c.purpose,
  c.status,
  c.location_slug,
  c.location_name_bn,
  c.parent_location_name_bn,
  c.location_type,
  c.source_name,
  c.origin
from public.notifications n
join public.listing_cards c on c.id = n.listing_id
where n.user_id = (select auth.uid());

comment on view public.my_notifications is 'The reader''s alerts with the listing each is about.';

revoke all on public.my_saved_listings, public.my_notifications from anon;
grant select on public.my_saved_listings, public.my_notifications to authenticated, service_role;
