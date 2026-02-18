-- Add optional improvement_points to reviews table
-- Usage:
--   psql "$DATABASE_URL" -f sql/add_improvement_points.sql

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS improvement_points text;

