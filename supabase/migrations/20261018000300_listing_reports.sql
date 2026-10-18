-- Reporting a listing · Visitors flag problems; staff handle them
--
-- The reports table and its permissions exist since the first migration:
-- anyone may file a report on a listing they can see; only the reporter and
-- staff can read it. This adds:
--
--   * limits, so nobody can flood the queue:
--       - a signed-in user: at most 10 reports a day, and one open report per listing;
--       - visitors who are not signed in, together: at most 5 open reports per
--         listing, and 30 an hour across the site;
--   * the reporter's account is always recorded when signed in, whatever the
--     client sends;
--   * public.handle_listing_reports(): staff close every open report on a
--     listing in one step, optionally taking the listing off the site.

create or replace function private.limit_reports()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me    uuid := (select auth.uid());
  total integer;
begin
  if private.is_trusted_context() then
    return new;
  end if;

  new.status := 'open';
  new.resolution_note := null;
  new.resolved_by := null;
  new.resolved_at := null;

  if me is not null then
    new.reporter_user_id := me;
    select count(*) into total
      from public.reports r
     where r.reporter_user_id = me and r.created_at > now() - interval '1 day';
    if total >= 10 then
      raise exception 'Too many reports today' using errcode = 'P0001', hint = 'daily_limit';
    end if;
    if exists (
      select 1 from public.reports r
       where r.reporter_user_id = me and r.listing_id = new.listing_id and r.status in ('open', 'reviewing')
    ) then
      raise exception 'You have already reported this listing' using errcode = 'P0001', hint = 'already_reported';
    end if;
  else
    new.reporter_user_id := null;
    select count(*) into total
      from public.reports r
     where r.reporter_user_id is null and r.listing_id = new.listing_id and r.status in ('open', 'reviewing');
    if total >= 5 then
      raise exception 'This listing has already been reported' using errcode = 'P0001', hint = 'already_reported';
    end if;
    select count(*) into total
      from public.reports r
     where r.reporter_user_id is null and r.created_at > now() - interval '1 hour';
    if total >= 30 then
      raise exception 'Too many reports right now' using errcode = 'P0001', hint = 'busy';
    end if;
  end if;

  return new;
end;
$$;

create trigger limit_reports before insert on public.reports
  for each row execute function private.limit_reports();

-- Staff: close all open reports on a listing, and take the listing down if needed.
create or replace function public.handle_listing_reports(
  p_listing_id     uuid,
  p_outcome        public.report_status,
  p_note           text default null,
  p_remove_listing boolean default false
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  closed integer;
begin
  if not private.is_staff() then
    raise exception 'Only staff can handle reports' using errcode = '42501';
  end if;
  if p_outcome not in ('resolved', 'dismissed') then
    raise exception 'Choose resolved or dismissed' using errcode = '22023';
  end if;

  if p_remove_listing then
    update public.property_listings l set status = 'removed' where l.id = p_listing_id;
  end if;

  update public.reports r
     set status          = p_outcome,
         resolution_note = nullif(btrim(coalesce(p_note, '')), ''),
         resolved_by     = (select auth.uid()),
         resolved_at     = now()
   where r.listing_id = p_listing_id and r.status in ('open', 'reviewing');
  get diagnostics closed = row_count;
  return closed;
end;
$$;

revoke all on function public.handle_listing_reports(uuid, public.report_status, text, boolean) from public, anon;
grant execute on function public.handle_listing_reports(uuid, public.report_status, text, boolean) to authenticated, service_role;
