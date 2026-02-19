-- Add optional other_comment to reviews table
-- Usage:
--   psql "$DATABASE_URL" -f sql/add_review_other_comment.sql

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS other_comment text;

