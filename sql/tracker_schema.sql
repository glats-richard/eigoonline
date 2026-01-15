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
  status text,
  reward numeric,
  payout numeric,
  amount numeric,
  commission numeric
);

create index if not exists clicks_created_at_idx on clicks (created_at desc);
create index if not exists clicks_offer_created_at_idx on clicks (offer_id, created_at desc);

create index if not exists conversions_created_at_idx on conversions (created_at desc);
create index if not exists conversions_offer_created_at_idx on conversions (offer_id, created_at desc);

