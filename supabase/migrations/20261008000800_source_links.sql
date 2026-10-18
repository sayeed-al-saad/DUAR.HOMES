-- Links out to other sites · 1 of 2 · Table, view and one tightened rule
--
-- `source_links` holds links to OTHER sites' own public listing pages
-- ("flats for rent in Dhaka on <site>"). The site shows them as buttons that
-- open the other site. It is a directory of links, not copied content: no
-- listing from another site is stored here.
--
-- A link can exist for a source that is switched off. Switching a source on
-- (`sources.active`) is about ingesting its listings, which needs permission.
-- Linking to a public page does not.

create table public.source_links (
  id              uuid primary key default gen_random_uuid(),
  source_id       uuid not null references public.sources (id) on delete cascade,
  url             text not null check (url ~ '^https://' and char_length(url) <= 500),
  -- null purpose or category means the page mixes them.
  purpose         public.listing_purpose,
  category        public.property_category,
  -- null means the page covers all of Bangladesh.
  location_id     uuid references public.locations (id) on delete set null,
  -- When someone last opened the link and confirmed it shows listings.
  last_checked_at timestamptz not null default now(),
  -- Set to false when a link stops working; it then disappears from the site.
  is_working      boolean not null default true,
  sort_order      integer not null default 1000,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (source_id, url)
);
comment on table public.source_links is
  'Links to other sites'' public listing pages. Shown as outbound buttons. No third-party content is stored.';

create index source_links_location_idx on public.source_links (location_id);

create trigger set_updated_at before update on public.source_links
  for each row execute function private.set_updated_at();

alter table public.source_links enable row level security;

revoke all on public.source_links from anon, authenticated;
grant all on public.source_links to service_role;
grant select on public.source_links to anon, authenticated;
grant insert, update, delete on public.source_links to authenticated;

create policy "source_links: visitors read working links" on public.source_links
  for select to anon
  using (is_working);

create policy "source_links: users read working links, staff read all" on public.source_links
  for select to authenticated
  using (is_working or (select private.is_staff()));

create policy "source_links: staff insert" on public.source_links
  for insert to authenticated with check ((select private.is_staff()));

create policy "source_links: staff update" on public.source_links
  for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy "source_links: admin delete" on public.source_links
  for delete to authenticated using ((select private.is_admin()));

-- What the public site reads: the link plus the names it needs to label it.
create view public.external_search_links
with (security_invoker = true)
as
select
  k.id,
  k.url,
  k.purpose,
  k.category,
  k.last_checked_at,
  k.sort_order,
  loc.slug as location_slug,
  loc.name_bn as location_name_bn,
  s.slug as source_slug,
  s.name as source_name,
  s.website as source_website
from public.source_links k
join public.sources s on s.id = k.source_id
left join public.locations loc on loc.id = k.location_id
where k.is_working;

comment on view public.external_search_links is
  'Working outbound links to other sites'' listing pages, with source and location names.';

grant select on public.external_search_links to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tightened rule: listings can only be ingested from a source that is switched
-- on. A source can only be switched on once its permission is settled (see the
-- check constraint on `sources`), so this closes the gap between "we know about
-- this site" and "we are allowed to show its listings".
-- ---------------------------------------------------------------------------

create or replace function private.enforce_listing_content_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  src public.sources%rowtype;
begin
  select * into src from public.sources s where s.id = new.source_id;

  if (src.source_type = 'first_party') <> (new.origin = 'first_party') then
    raise exception 'Listing origin (%) does not match its source type (%)', new.origin, src.source_type
      using errcode = '23514';
  end if;

  if new.origin = 'external' then
    -- New listings are accepted only from a source that has been enabled.
    -- Existing rows can still be updated (for example marked stale) after a
    -- source is switched off.
    if tg_op = 'INSERT' and not src.active then
      raise exception 'Source "%" is not enabled. Settle its permission and switch it on before adding its listings.', src.name
        using errcode = '23514';
    end if;
    -- Never keep a third-party description unless that source has allowed it.
    if not src.allow_description then
      new.description := null;
    end if;
    -- External listings have no account behind them.
    new.listed_by_user_id := null;
  end if;

  if new.status = 'active' and new.published_at is null then
    new.published_at := now();
  end if;

  return new;
end;
$$;
