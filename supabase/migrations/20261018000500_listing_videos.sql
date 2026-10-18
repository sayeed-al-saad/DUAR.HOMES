-- Listing videos · One short video per listing, uploaded by the lister
--
-- The browser uploads the video (and a still frame used as its poster) straight
-- to the listing-videos bucket, into <user id>/<listing id>/..., like photos.
-- Before uploading it blanks the location tags phones write into videos.
--
--   * one video per listing, at most 50 MB (the bucket refuses bigger files)
--     and 2 minutes;
--   * only on listings made here, and only by their lister (or staff);
--   * the row must point at a file the lister uploaded for that listing;
--   * adding, replacing or removing the video of a live listing sends it back
--     to review, like any other change (review_after_lister_edit).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-videos', 'listing-videos', true, 52428800, array['video/mp4', 'video/webm', 'video/quicktime', 'image/webp', 'image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "listing-videos: upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'listing-videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "listing-videos: delete own files, staff any" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'listing-videos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_staff()))
  );

create table public.listing_videos (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid not null unique references public.property_listings (id) on delete cascade,
  url              text not null check (char_length(url) between 1 and 1000),
  storage_path     text not null,
  poster_url       text check (poster_url is null or char_length(poster_url) <= 1000),
  poster_path      text,
  duration_seconds numeric check (duration_seconds is null or (duration_seconds > 0 and duration_seconds <= 125)),
  mime_type        text not null check (mime_type in ('video/mp4', 'video/webm', 'video/quicktime')),
  created_at       timestamptz not null default now()
);
comment on table public.listing_videos is
  'One video per first-party listing, uploaded by its lister. Visible with the listing.';

alter table public.listing_videos enable row level security;
revoke all on public.listing_videos from anon, authenticated;
grant all on public.listing_videos to service_role;
grant select on public.listing_videos to anon, authenticated;
grant insert, delete on public.listing_videos to authenticated;

create policy "listing_videos: read with listing" on public.listing_videos
  for select to anon, authenticated
  using (exists (select 1 from public.property_listings l where l.id = listing_videos.listing_id));

create policy "listing_videos: lister or staff insert" on public.listing_videos
  for insert to authenticated
  with check (exists (
    select 1 from public.property_listings l
    where l.id = listing_videos.listing_id
      and (l.listed_by_user_id = (select auth.uid()) or (select private.is_staff()))
  ));

create policy "listing_videos: lister or staff delete" on public.listing_videos
  for delete to authenticated
  using (exists (
    select 1 from public.property_listings l
    where l.id = listing_videos.listing_id
      and (l.listed_by_user_id = (select auth.uid()) or (select private.is_staff()))
  ));

-- The video (and its poster) must be the lister's own upload for this listing.
create or replace function private.enforce_own_listing_video()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lst public.property_listings%rowtype;
  check_path text;
begin
  select * into lst from public.property_listings l where l.id = new.listing_id;
  if lst.origin <> 'first_party' then
    raise exception 'Videos can only be added to listings made on this site' using errcode = '23514';
  end if;

  foreach check_path in array array_remove(array[new.storage_path, new.poster_path], null) loop
    if (storage.foldername(check_path))[1] is distinct from lst.listed_by_user_id::text
       or (storage.foldername(check_path))[2] is distinct from lst.id::text then
      raise exception 'A video must be in the lister''s folder for this listing' using errcode = '23514';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'listing-videos' and o.name = check_path) then
      raise exception 'The video file has not been uploaded' using errcode = '23514';
    end if;
  end loop;

  if new.url not like '%/storage/v1/object/public/listing-videos/' || new.storage_path then
    raise exception 'A video must be served from the listing-videos bucket' using errcode = '23514';
  end if;
  if (new.poster_path is null) <> (new.poster_url is null)
     or (new.poster_path is not null and new.poster_url not like '%/storage/v1/object/public/listing-videos/' || new.poster_path) then
    raise exception 'The poster must be served from the listing-videos bucket' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger enforce_own_listing_video
  before insert on public.listing_videos
  for each row execute function private.enforce_own_listing_video();

-- A new or removed video on a live listing needs review, like a photo.
create trigger review_after_lister_edit after insert or delete on public.listing_videos
  for each row execute function private.review_after_lister_edit();
