-- Phase 1 · 1 of 7 · Extensions, helper schema and enumerated types
--
-- Enum values are mirrored in src/lib/domain/types.ts. Change both together.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- Helper functions used by security rules live here. The schema is not exposed
-- through the Data API, so nobody can call them directly over HTTP.
create schema if not exists private;

create type public.user_role as enum (
  'member',      -- signed-up visitor
  'owner',       -- lists their own property
  'agent',
  'developer',
  'moderator',   -- staff: reviews listings and reports
  'admin'        -- staff: everything, including sources and roles
);

create type public.location_type as enum (
  'division', 'district', 'city', 'upazila', 'thana', 'area'
);

create type public.location_precision as enum (
  'exact',        -- the lister agreed to show the real pin
  'approximate',  -- pin moved to somewhere nearby
  'area_only'     -- only the neighbourhood is known or shown
);

create type public.property_type as enum (
  'apartment', 'house', 'duplex', 'room',
  'plot', 'land',
  'office', 'shop', 'commercial_space', 'warehouse'
);

create type public.property_category as enum ('residential', 'land', 'commercial');

create type public.furnishing_level as enum ('unfurnished', 'semi_furnished', 'furnished');

create type public.listing_purpose as enum ('sale', 'rent');

create type public.listing_origin as enum (
  'first_party',  -- created on this site by the owner, agent, agency or developer
  'external'      -- facts indexed from another site, always shown with attribution
);

create type public.lister_type as enum ('owner', 'agent', 'agency', 'developer', 'unknown');

create type public.listing_status as enum (
  'draft',
  'pending_review',
  'active',
  'stale',      -- not confirmed at the source for a long time
  'sold',
  'rented',
  'rejected',
  'archived',
  'removed'     -- taken down after a report or a rights-holder request
);

create type public.source_type as enum (
  'first_party', 'portal', 'classifieds', 'agency_site', 'developer_site', 'other'
);

create type public.ingestion_method as enum (
  'manual', 'csv_import', 'api', 'rss_feed', 'partner_feed', 'public_page'
);

create type public.permission_status as enum (
  'not_required',   -- our own data
  'not_requested',
  'requested',
  'granted',
  'denied',
  'revoked'
);

create type public.image_rights_status as enum (
  'owned',              -- uploaded by the lister on this site
  'licensed',
  'source_authorized',  -- the source explicitly allowed us to show it
  'demo_placeholder'
);

create type public.agency_kind as enum ('agency', 'developer');

create type public.alert_frequency as enum ('none', 'instant', 'daily', 'weekly');

create type public.inquiry_status as enum ('new', 'read', 'replied', 'closed', 'spam');

create type public.report_reason as enum (
  'fraud', 'wrong_information', 'duplicate', 'sold_or_rented',
  'offensive', 'copyright', 'privacy', 'other'
);

create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create type public.change_origin as enum ('system', 'ingestion', 'lister', 'staff');

create type public.duplicate_status as enum ('pending', 'merged', 'rejected', 'review_later');

create type public.verification_type as enum (
  'ownership_claim',       -- "এই সম্পত্তি আপনার?"
  'listing_verification',
  'agent_identity',
  'agency_license'
);

create type public.verification_status as enum ('pending', 'needs_info', 'approved', 'rejected');
