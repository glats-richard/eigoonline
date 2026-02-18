-- Add optional learning-context fields to reviews table
-- Usage:
--   psql "$DATABASE_URL" -f sql/add_review_learning_fields.sql

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS course_name text;

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS material_unit text;

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS lesson_frequency text;

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS lesson_time_band text;

