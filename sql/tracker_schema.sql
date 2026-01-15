-- Tracker schema for Railway Postgres
-- Usage:
--   psql "$DATABASE_URL" -f sql/tracker_schema.sql

create table if not exists offers (
  id text primary key,
  name text,
  title text,
  created_at timestamptz not null default now()
);

create table if not exists clicks (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  offer_id text references offers(id) on delete set null,
  url text,
  referrer text,
  user_agent text,
  ip text
);

create table if not exists conversions (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  offer_id text references offers(id) on delete set null,
  student_id text,
  student_id_hash text,
  status text,
  reward numeric,
  payout numeric,
  amount numeric,
  commission numeric,

  -- Fraud / audit metadata (captured server-side)
  ip text,
  ip_hash text,
  ip_version smallint,
  country text,
  user_agent text,
  accept_language text,
  origin text,
  referrer text,
  page_url text,
  cf_ray text,
  cf_connecting_ip text,
  cf_ipcountry text,
  x_forwarded_for text,
  request_id text,
  request_headers jsonb
);

create index if not exists clicks_created_at_idx on clicks (created_at desc);
create index if not exists clicks_offer_created_at_idx on clicks (offer_id, created_at desc);

create index if not exists conversions_created_at_idx on conversions (created_at desc);
create index if not exists conversions_offer_created_at_idx on conversions (offer_id, created_at desc);

-- If you already created tables, you can safely re-run this file.
-- Postgres will keep existing columns; for schema drift, apply ALTERs below.
alter table conversions add column if not exists student_id text;
alter table conversions add column if not exists student_id_hash text;
alter table conversions add column if not exists ip text;
alter table conversions add column if not exists ip_hash text;
alter table conversions add column if not exists ip_version smallint;
alter table conversions add column if not exists country text;
alter table conversions add column if not exists user_agent text;
alter table conversions add column if not exists accept_language text;
alter table conversions add column if not exists origin text;
alter table conversions add column if not exists referrer text;
alter table conversions add column if not exists page_url text;
alter table conversions add column if not exists cf_ray text;
alter table conversions add column if not exists cf_connecting_ip text;
alter table conversions add column if not exists cf_ipcountry text;
alter table conversions add column if not exists x_forwarded_for text;
alter table conversions add column if not exists request_id text;
alter table conversions add column if not exists request_headers jsonb;

-- Indexes that depend on newly-added columns must be created after ALTERs.
create index if not exists conversions_ip_hash_created_at_idx on conversions (ip_hash, created_at desc);
create index if not exists conversions_student_id_hash_created_at_idx on conversions (student_id_hash, created_at desc);

