-- Phase 1 · 2 of 7 · Core tables
--
-- The model keeps two ideas apart:
--   properties         a physical flat, house, plot or commercial unit
--   property_listings  one advert for a property, from one source
-- One property can have many listings (our own plus several external ones).
--
-- Anything that must stay private sits in its own table (property_private,
-- listing_contacts) so that row-level security can protect it outright instead
-- of relying on callers to leave columns out.

-- ---------------------------------------------------------------------------
-- People and organisations
-- ---------------------------------------------------------------------------

-- Profile for each auth.users row. Private: only the user and staff can read it.
create table public.users (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text check (char_length(display_name) between 1 and 80),
  avatar_path        text,
  phone              text check (phone is null or phone ~ '^\+?[0-9]{8,15}$'),
  role               public.user_role not null default 'member',
  preferred_language text not null default 'bn' check (preferred_language in ('bn', 'en')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on table public.users is 'Private profile for each signed-up user. Never exposed publicly.';

-- ---------------------------------------------------------------------------
-- Locations (database-driven; nothing is hardcoded in components)
-- ---------------------------------------------------------------------------

create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.locations (id) on delete restrict,
  type        public.location_type not null,
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_bn     text not null check (char_length(name_bn) between 1 and 120),
  name_en     text not null check (char_length(name_en) between 1 and 120),
  alt_names   text[] not null default '{}',
  -- Lowercased names and spellings, kept up to date by a trigger. Powers autocomplete.
  search_text text not null default '',
  latitude    numeric(9, 6) check (latitude between 20 and 27),
  longitude   numeric(9, 6) check (longitude between 88 and 93),
  is_popular  boolean not null default false,
  sort_order  integer not null default 1000,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (parent_id is distinct from id),
  check ((type = 'division') = (parent_id is null))
);
comment on table public.locations is 'Bangladesh places: division > district > city/upazila/thana > area.';
comment on column public.locations.alt_names is 'Other Bangla and English spellings, used to normalise location names.';

create index locations_parent_idx on public.locations (parent_id);
create index locations_type_idx on public.locations (type);
create index locations_popular_idx on public.locations (sort_order) where is_popular;
create index locations_search_trgm_idx on public.locations using gin (search_text extensions.gin_trgm_ops);

create table public.agencies (
  id            uuid primary key default gen_random_uuid(),
  kind          public.agency_kind not null default 'agency',
  name          text not null check (char_length(name) between 2 and 120),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description   text check (char_length(description) <= 2000),
  logo_path     text,
  website       text check (website is null or website ~ '^https?://'),
  -- Business contact details the agency chose to publish.
  public_phone  text check (public_phone is null or public_phone ~ '^\+?[0-9]{8,15}$'),
  public_email  text check (public_email is null or public_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  location_id   uuid references public.locations (id) on delete set null,
  owner_user_id uuid references public.users (id) on delete set null,
  is_verified   boolean not null default false,
  verified_at   timestamptz,
  -- Reserved for future plans (agency plans, developer packages). Nothing reads it yet.
  plan          text not null default 'free',
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.agencies is 'Real-estate agencies and developers (see kind).';

create index agencies_owner_idx on public.agencies (owner_user_id);
create index agencies_location_idx on public.agencies (location_id);

create table public.agents (
  id            uuid primary key default gen_random_uuid(),
  -- Null until a person claims the profile.
  user_id       uuid unique references public.users (id) on delete set null,
  agency_id     uuid references public.agencies (id) on delete set null,
  display_name  text not null check (char_length(display_name) between 2 and 80),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  bio           text check (char_length(bio) <= 1000),
  photo_path    text,
  public_phone  text check (public_phone is null or public_phone ~ '^\+?[0-9]{8,15}$'),
  whatsapp      text check (whatsapp is null or whatsapp ~ '^\+?[0-9]{8,15}$'),
  is_verified   boolean not null default false,
  verified_at   timestamptz,
  plan          text not null default 'free',
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.agents is 'Public profile of an individual agent. Contact fields are only what the agent chose to publish.';

create index agents_agency_idx on public.agents (agency_id);

-- ---------------------------------------------------------------------------
-- Sources: where listings come from, and what each source lets us show
-- ---------------------------------------------------------------------------

create table public.sources (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(name) between 1 and 120),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  website           text check (website is null or website ~ '^https?://'),
  source_type       public.source_type not null,
  ingestion_method  public.ingestion_method not null default 'manual',
  permission_status public.permission_status not null default 'not_requested',
  active            boolean not null default false,
  -- What the rights holder has explicitly allowed. All off until someone turns them on.
  allow_images      boolean not null default false,
  allow_description boolean not null default false,
  allow_contact     boolean not null default false,
  last_checked      timestamptz,
  last_success_at   timestamptz,
  last_error        text,
  notes             text,
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- A source cannot be switched on until its permission question is settled.
  constraint sources_active_needs_permission
    check (not active or permission_status in ('not_required', 'granted')),
  constraint sources_first_party_needs_no_permission
    check ((source_type = 'first_party') = (permission_status = 'not_required'))
);
comment on table public.sources is 'Listing sources. Each has its own adapter and can be enabled or disabled independently.';
comment on column public.sources.allow_images is 'True only when the source has explicitly authorised showing its photos.';
comment on column public.sources.allow_description is 'True only when the source has explicitly authorised showing its description text.';
comment on column public.sources.allow_contact is 'True only when the source has explicitly authorised showing contact details.';
comment on column public.sources.notes is 'Internal. Never readable by the public.';

-- ---------------------------------------------------------------------------
-- Amenities
-- ---------------------------------------------------------------------------

create table public.amenities (
  slug       text primary key check (slug ~ '^[a-z0-9_]+$'),
  name_bn    text not null,
  name_en    text not null,
  sort_order integer not null default 1000
);

-- ---------------------------------------------------------------------------
-- Properties and listings
-- ---------------------------------------------------------------------------

create table public.properties (
  id                 uuid primary key default gen_random_uuid(),
  location_id        uuid not null references public.locations (id) on delete restrict,
  property_type      public.property_type not null,
  category           public.property_category generated always as (
    case
      when property_type in ('plot', 'land') then 'land'::public.property_category
      when property_type in ('office', 'shop', 'commercial_space', 'warehouse') then 'commercial'::public.property_category
      else 'residential'::public.property_category
    end
  ) stored,
  size_sqft          numeric(10, 2) check (size_sqft > 0 and size_sqft <= 5000000),
  land_size_katha    numeric(10, 2) check (land_size_katha > 0 and land_size_katha <= 100000),
  bedrooms           smallint check (bedrooms between 0 and 50),
  bathrooms          smallint check (bathrooms between 0 and 50),
  balconies          smallint check (balconies between 0 and 30),
  floor_number       smallint check (floor_number between -5 and 150),
  total_floors       smallint check (total_floors between 1 and 150),
  furnishing         public.furnishing_level,
  parking_spaces     smallint check (parking_spaces between 0 and 500),
  year_built         smallint check (year_built between 1800 and 2100),
  -- Public display point. For anything other than 'exact' it is deliberately not the real spot.
  latitude           numeric(9, 6) check (latitude between 20 and 27),
  longitude          numeric(9, 6) check (longitude between 88 and 93),
  location_precision public.location_precision not null default 'area_only',
  owner_user_id      uuid references public.users (id) on delete set null,
  created_by         uuid references public.users (id) on delete set null,
  is_verified        boolean not null default false,
  verified_at        timestamptz,
  is_demo            boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (floor_number is null or total_floors is null or floor_number <= total_floors)
);
comment on table public.properties is 'A physical property. Listings point at it; several listings may describe the same property.';
comment on column public.properties.is_demo is 'Demo row. supabase/remove_demo_data.sql deletes these.';

create index properties_location_idx on public.properties (location_id);
create index properties_type_idx on public.properties (property_type);
create index properties_category_idx on public.properties (category);
create index properties_bedrooms_idx on public.properties (bedrooms);
create index properties_owner_idx on public.properties (owner_user_id);
create index properties_created_by_idx on public.properties (created_by);

-- Exact address and coordinates. Owner and staff only.
create table public.property_private (
  property_id        uuid primary key references public.properties (id) on delete cascade,
  address_line       text check (char_length(address_line) <= 300),
  address_normalized text,
  exact_latitude     numeric(9, 6) check (exact_latitude between 20 and 27),
  exact_longitude    numeric(9, 6) check (exact_longitude between 88 and 93),
  internal_notes     text,
  updated_at         timestamptz not null default now()
);
comment on table public.property_private is 'Exact address and pin. Never public; the public map uses properties.latitude/longitude.';

create table public.property_amenities (
  property_id  uuid not null references public.properties (id) on delete cascade,
  amenity_slug text not null references public.amenities (slug) on delete cascade,
  primary key (property_id, amenity_slug)
);

create index property_amenities_amenity_idx on public.property_amenities (amenity_slug);

create table public.property_listings (
  id                 uuid primary key default gen_random_uuid(),
  property_id        uuid not null references public.properties (id) on delete cascade,
  source_id          uuid not null references public.sources (id) on delete restrict,
  origin             public.listing_origin not null,
  purpose            public.listing_purpose not null,
  -- For external listings this is a factual title we generate, never the source's wording.
  title              text not null check (char_length(title) between 3 and 160),
  slug               text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description        text check (char_length(description) <= 5000),
  -- BDT. Total price for sale, monthly rent for rent.
  price              numeric(14, 2) not null check (price > 0 and price <= 100000000000),
  price_negotiable   boolean not null default false,
  previous_price     numeric(14, 2),
  price_changed_at   timestamptz,
  lister_type        public.lister_type not null default 'unknown',
  listed_by_user_id  uuid references public.users (id) on delete set null,
  agent_id           uuid references public.agents (id) on delete set null,
  agency_id          uuid references public.agencies (id) on delete set null,
  -- External listings: where the original lives, and when the source says it was posted.
  source_url         text check (source_url is null or source_url ~ '^https?://'),
  source_listing_ref text,
  source_listed_at   timestamptz,
  status             public.listing_status not null default 'pending_review',
  is_verified        boolean not null default false,
  verified_at        timestamptz,
  -- Reserved for future featured placements. Nothing reads it yet.
  featured_until     timestamptz,
  -- Freshness. last_seen_at: last time the listing was present at its source.
  -- last_checked_at: last time we looked, whether or not it was there.
  first_seen_at      timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  last_checked_at    timestamptz not null default now(),
  published_at       timestamptz,
  expires_at         timestamptz,
  view_count         integer not null default 0 check (view_count >= 0),
  is_demo            boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint listings_external_needs_source_url
    check (origin = 'first_party' or source_url is not null),
  constraint listings_source_ref_unique unique (source_id, source_listing_ref)
);
comment on table public.property_listings is 'One advert for a property from one source. External rows hold facts and a link back, nothing more.';

create index listings_property_idx on public.property_listings (property_id);
create index listings_source_idx on public.property_listings (source_id);
create index listings_status_purpose_idx on public.property_listings (status, purpose);
create index listings_active_newest_idx on public.property_listings (first_seen_at desc) where status = 'active';
create index listings_active_popular_idx on public.property_listings (view_count desc) where status = 'active';
create index listings_active_price_idx on public.property_listings (purpose, price) where status = 'active';
create index listings_price_drop_idx on public.property_listings (price_changed_at desc)
  where status = 'active' and previous_price is not null;
create index listings_last_checked_idx on public.property_listings (last_checked_at);
create index listings_lister_idx on public.property_listings (listed_by_user_id);
create index listings_agent_idx on public.property_listings (agent_id);
create index listings_agency_idx on public.property_listings (agency_id);

-- Phone and WhatsApp a first-party lister chose to give. Kept apart so it can be
-- released one listing at a time (Phase 7) instead of being readable in bulk.
create table public.listing_contacts (
  listing_id   uuid primary key references public.property_listings (id) on delete cascade,
  contact_name text check (char_length(contact_name) <= 80),
  phone        text check (phone is null or phone ~ '^\+?[0-9]{8,15}$'),
  whatsapp     text check (whatsapp is null or whatsapp ~ '^\+?[0-9]{8,15}$'),
  show_phone   boolean not null default false,
  updated_at   timestamptz not null default now()
);
comment on table public.listing_contacts is 'Voluntarily provided contact details for first-party listings. Never filled from third-party sites without authorisation.';

create table public.listing_images (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.property_listings (id) on delete cascade,
  -- Full URL or site path used to display the image.
  url           text not null check (char_length(url) between 1 and 1000),
  -- Path inside the listing-images storage bucket, for images uploaded here.
  storage_path  text,
  alt_bn        text check (char_length(alt_bn) <= 200),
  width         integer check (width > 0),
  height        integer check (height > 0),
  sort_order    integer not null default 0,
  is_primary    boolean not null default false,
  rights_status public.image_rights_status not null,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now()
);
comment on table public.listing_images is 'Only images we have the right to show. A trigger blocks images for external listings unless the source allows them.';

create index listing_images_listing_idx on public.listing_images (listing_id, is_primary desc, sort_order);
create unique index listing_images_one_primary_idx on public.listing_images (listing_id) where is_primary;

-- ---------------------------------------------------------------------------
-- Things users do
-- ---------------------------------------------------------------------------

create table public.favorites (
  user_id    uuid not null references public.users (id) on delete cascade,
  listing_id uuid not null references public.property_listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index favorites_listing_idx on public.favorites (listing_id);

create table public.saved_searches (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 100),
  filters          jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  alert_frequency  public.alert_frequency not null default 'none',
  last_notified_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index saved_searches_user_idx on public.saved_searches (user_id);

-- Messages to the lister of a first-party listing.
create table public.inquiries (
  id                uuid primary key default gen_random_uuid(),
  listing_id        uuid not null references public.property_listings (id) on delete cascade,
  sender_user_id    uuid references public.users (id) on delete set null,
  recipient_user_id uuid references public.users (id) on delete set null,
  sender_name       text not null check (char_length(sender_name) between 1 and 80),
  sender_phone      text check (sender_phone is null or sender_phone ~ '^\+?[0-9]{8,15}$'),
  sender_email      text check (sender_email is null or sender_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  message           text not null check (char_length(message) between 1 and 2000),
  status            public.inquiry_status not null default 'new',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index inquiries_listing_idx on public.inquiries (listing_id);
create index inquiries_sender_idx on public.inquiries (sender_user_id);
create index inquiries_recipient_idx on public.inquiries (recipient_user_id, status);

-- Anyone can report a listing, including rights holders without an account.
create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid not null references public.property_listings (id) on delete cascade,
  reporter_user_id uuid references public.users (id) on delete set null,
  reason           public.report_reason not null,
  details          text check (char_length(details) <= 2000),
  reporter_contact text check (char_length(reporter_contact) <= 200),
  status           public.report_status not null default 'open',
  resolution_note  text,
  resolved_by      uuid references public.users (id) on delete set null,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now()
);

create index reports_listing_idx on public.reports (listing_id);
create index reports_open_idx on public.reports (created_at desc) where status in ('open', 'reviewing');
create index reports_reporter_idx on public.reports (reporter_user_id);
create index reports_resolved_by_idx on public.reports (resolved_by);

-- ---------------------------------------------------------------------------
-- History, duplicates and verification
-- ---------------------------------------------------------------------------

create table public.price_history (
  id             uuid primary key default gen_random_uuid(),
  listing_id     uuid not null references public.property_listings (id) on delete cascade,
  price          numeric(14, 2) not null check (price > 0),
  previous_price numeric(14, 2),
  recorded_at    timestamptz not null default now()
);
comment on table public.price_history is 'Written by a trigger whenever a listing price is set or changes.';

create index price_history_listing_idx on public.price_history (listing_id, recorded_at desc);

-- Field-level audit trail. Populated from Phase 5 (change tracking).
create table public.listing_changes (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.property_listings (id) on delete cascade,
  field      text not null,
  old_value  jsonb,
  new_value  jsonb,
  origin     public.change_origin not null default 'system',
  changed_by uuid references public.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index listing_changes_listing_idx on public.listing_changes (listing_id, changed_at desc);
create index listing_changes_changed_by_idx on public.listing_changes (changed_by);

-- Candidate pairs from duplicate detection (Phase 6). Stored once per pair, smaller id first.
create table public.listing_duplicates (
  id           uuid primary key default gen_random_uuid(),
  listing_a_id uuid not null references public.property_listings (id) on delete cascade,
  listing_b_id uuid not null references public.property_listings (id) on delete cascade,
  -- 0 to 100, e.g. 87.00 means "87% likely the same property".
  confidence   numeric(5, 2) not null check (confidence between 0 and 100),
  -- Which signals matched and how strongly, e.g. {"location": 1, "price": 0.9}.
  signals      jsonb not null default '{}'::jsonb,
  status       public.duplicate_status not null default 'pending',
  reviewed_by  uuid references public.users (id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  check (listing_a_id < listing_b_id),
  unique (listing_a_id, listing_b_id)
);

create index listing_duplicates_b_idx on public.listing_duplicates (listing_b_id);
create index listing_duplicates_reviewed_by_idx on public.listing_duplicates (reviewed_by);
create index listing_duplicates_pending_idx on public.listing_duplicates (confidence desc) where status = 'pending';

-- Ownership claims and verification requests, reviewed by staff.
create table public.verification_records (
  id             uuid primary key default gen_random_uuid(),
  type           public.verification_type not null,
  property_id    uuid references public.properties (id) on delete cascade,
  listing_id     uuid references public.property_listings (id) on delete cascade,
  agent_id       uuid references public.agents (id) on delete cascade,
  agency_id      uuid references public.agencies (id) on delete cascade,
  requested_by   uuid references public.users (id) on delete set null,
  status         public.verification_status not null default 'pending',
  applicant_note text check (char_length(applicant_note) <= 2000),
  -- Paths inside the private verification-docs storage bucket.
  document_paths text[] not null default '{}',
  reviewer_note  text,
  reviewed_by    uuid references public.users (id) on delete set null,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Each record is about exactly one thing.
  check (num_nonnulls(property_id, listing_id, agent_id, agency_id) = 1)
);

create index verification_property_idx on public.verification_records (property_id);
create index verification_listing_idx on public.verification_records (listing_id);
create index verification_agent_idx on public.verification_records (agent_id);
create index verification_agency_idx on public.verification_records (agency_id);
create index verification_requester_idx on public.verification_records (requested_by);
create index verification_reviewed_by_idx on public.verification_records (reviewed_by);
create index verification_pending_idx on public.verification_records (created_at) where status in ('pending', 'needs_info');
