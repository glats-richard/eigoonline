-- Run this to add nickname column to reviews table
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS nickname text;
