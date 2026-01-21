-- Reviews schema for Railway Postgres
-- Usage:
--   psql "$DATABASE_URL" -f sql/reviews_schema.sql

create table if not exists reviews (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  school_id text not null,
  status text not null default 'pending',
  -- Featured slot for homepage snippets (admin-selected). Use 1..5; NULL = not featured.
  featured_rank smallint,
  -- Approximate continuation period in months (required for new submissions).
  duration_months smallint not null check (duration_months >= 1 and duration_months <= 240),
  overall_rating numeric(3,1) not null check (overall_rating >= 1 and overall_rating <= 5),
  teacher_quality numeric(3,1) not null check (teacher_quality >= 1 and teacher_quality <= 5),
  material_quality numeric(3,1) not null check (material_quality >= 1 and material_quality <= 5),
  connection_quality numeric(3,1) not null check (connection_quality >= 1 and connection_quality <= 5),
  -- Added rating axes: price and satisfaction
  price_rating numeric(3,1) not null check (price_rating >= 1 and price_rating <= 5),
  satisfaction_rating numeric(3,1) not null check (satisfaction_rating >= 1 and satisfaction_rating <= 5),
  body text not null,
  -- Privacy: collect birth year/month only (no birth day).
  birth_year smallint not null check (birth_year >= 1900 and birth_year <= 2100),
  birth_month smallint not null check (birth_month >= 1 and birth_month <= 12),
  age text, -- legacy (do not use for new submissions)
  email text,
  ip text,
  ip_hash text,
  ip_version smallint,
  user_agent text,
  referrer text,
  review_comment text
);

create index if not exists reviews_school_id_status_created_at_idx on reviews (school_id, status, created_at desc);
create index if not exists reviews_school_id_status_featured_idx on reviews (school_id, status, featured_rank asc, created_at desc);
create index if not exists reviews_status_created_at_idx on reviews (status, created_at desc);
create index if not exists reviews_ip_hash_created_at_idx on reviews (ip_hash, created_at desc);

-- Enforce one review per featured slot (1..5) per school.
-- Max 5 is enforced by limiting UI/API to 1..5 plus this uniqueness.
create unique index if not exists reviews_featured_slot_unique
  on reviews (school_id, featured_rank)
  where featured_rank is not null;

-- If you already created tables, you can safely re-run this file.
-- Postgres will keep existing columns; for schema drift, apply ALTERs below.
alter table reviews add column if not exists school_id text;
alter table reviews add column if not exists status text;
alter table reviews add column if not exists featured_rank smallint;
-- NOTE: existing tables may have old rows; keep NULL-able during migration if needed.
alter table reviews add column if not exists duration_months smallint;
alter table reviews add column if not exists overall_rating numeric(3,1);
alter table reviews add column if not exists teacher_quality numeric(3,1);
alter table reviews add column if not exists material_quality numeric(3,1);
alter table reviews add column if not exists connection_quality numeric(3,1);
alter table reviews add column if not exists price_rating numeric(3,1);
alter table reviews add column if not exists satisfaction_rating numeric(3,1);
alter table reviews add column if not exists body text;
alter table reviews add column if not exists birth_year smallint;
alter table reviews add column if not exists birth_month smallint;
alter table reviews add column if not exists age text;
alter table reviews add column if not exists email text;
alter table reviews add column if not exists ip text;
alter table reviews add column if not exists ip_hash text;
alter table reviews add column if not exists ip_version smallint;
alter table reviews add column if not exists user_agent text;
alter table reviews add column if not exists referrer text;
alter table reviews add column if not exists review_comment text;
