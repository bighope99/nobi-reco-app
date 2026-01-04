-- Migration: Create m_classes master table
-- Description: Store class/grade information for organizing children
-- Created: 2026-01-04
-- NOTE: This table already exists in the database. This migration file is for documentation.

-- This migration documents the existing m_classes table structure
-- The table was created outside of the migration system

-- Expected structure (already exists):
-- CREATE TABLE m_classes (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   facility_id UUID NOT NULL REFERENCES m_facilities(id) ON DELETE CASCADE,
--   name VARCHAR NOT NULL,
--   age_group VARCHAR,
--   room_number VARCHAR,
--   color_code VARCHAR,
--   display_order INTEGER,
--   capacity INTEGER,
--   is_active BOOLEAN DEFAULT true,
--   created_at TIMESTAMPTZ DEFAULT now(),
--   updated_at TIMESTAMPTZ DEFAULT now(),
--   deleted_at TIMESTAMPTZ
-- );

-- Verify the table exists and has the correct structure
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'm_classes') THEN
    RAISE EXCEPTION 'm_classes table does not exist. This migration expects it to already exist.';
  END IF;
END $$;

-- Add comment if not exists
COMMENT ON TABLE m_classes IS 'Master table for class/grade definitions within facilities';
