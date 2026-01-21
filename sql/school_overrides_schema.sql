-- School overrides schema (for /tracker content management)
-- Usage:
--   psql "$DATABASE_URL" -f sql/school_overrides_schema.sql

create table if not exists school_overrides (
  school_id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists school_overrides_updated_at_idx on school_overrides (updated_at desc);

