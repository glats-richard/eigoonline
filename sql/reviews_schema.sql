-- Reviews schema for Railway Postgres
-- Usage:
--   psql "$DATABASE_URL" -f sql/reviews_schema.sql

create table if not exists reviews (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  school_id text not null,
  status text not null default 'pending',
  overall_rating numeric(3,1) not null check (overall_rating >= 1 and overall_rating <= 5),
  teacher_quality numeric(3,1) not null check (teacher_quality >= 1 and teacher_quality <= 5),
  material_quality numeric(3,1) not null check (material_quality >= 1 and material_quality <= 5),
  connection_quality numeric(3,1) not null check (connection_quality >= 1 and connection_quality <= 5),
  body text not null,
  age text,
  email text,
  ip text,
  ip_hash text,
  ip_version smallint,
  user_agent text,
  referrer text,
  review_comment text
);

create index if not exists reviews_school_id_status_created_at_idx on reviews (school_id, status, created_at desc);
create index if not exists reviews_status_created_at_idx on reviews (status, created_at desc);
create index if not exists reviews_ip_hash_created_at_idx on reviews (ip_hash, created_at desc);

-- If you already created tables, you can safely re-run this file.
-- Postgres will keep existing columns; for schema drift, apply ALTERs below.
alter table reviews add column if not exists school_id text;
alter table reviews add column if not exists status text;
alter table reviews add column if not exists overall_rating numeric(3,1);
alter table reviews add column if not exists teacher_quality numeric(3,1);
alter table reviews add column if not exists material_quality numeric(3,1);
alter table reviews add column if not exists connection_quality numeric(3,1);
alter table reviews add column if not exists body text;
alter table reviews add column if not exists age text;
alter table reviews add column if not exists email text;
alter table reviews add column if not exists ip text;
alter table reviews add column if not exists ip_hash text;
alter table reviews add column if not exists ip_version smallint;
alter table reviews add column if not exists user_agent text;
alter table reviews add column if not exists referrer text;
alter table reviews add column if not exists review_comment text;
