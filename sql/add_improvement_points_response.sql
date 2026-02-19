-- Add optional company response fields to reviews table
-- Usage:
--   psql "$DATABASE_URL" -f sql/add_improvement_points_response.sql

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS improvement_points_response text;

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS improvement_points_responded_at timestamptz;

