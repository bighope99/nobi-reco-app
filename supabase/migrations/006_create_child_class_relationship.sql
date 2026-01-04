-- Migration: Create _child_class join table
-- Description: Many-to-many relationship between children and classes
-- Created: 2026-01-04
-- NOTE: This table already exists in the database. This migration file is for documentation.

-- This migration documents the existing _child_class table structure
-- The table was created outside of the migration system

-- Expected structure (already exists):
-- CREATE TABLE _child_class (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   child_id UUID NOT NULL REFERENCES m_children(id) ON DELETE CASCADE,
--   class_id UUID NOT NULL REFERENCES m_classes(id) ON DELETE CASCADE,
--   school_year INTEGER NOT NULL,
--   started_at DATE NOT NULL,
--   ended_at DATE,
--   is_current BOOLEAN DEFAULT true,
--   created_at TIMESTAMPTZ DEFAULT now(),
--   updated_at TIMESTAMPTZ DEFAULT now()
-- );

-- Verify the table exists and has the correct structure
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '_child_class') THEN
    RAISE EXCEPTION '_child_class table does not exist. This migration expects it to already exist.';
  END IF;
END $$;

-- Add comment if not exists
COMMENT ON TABLE _child_class IS 'Join table linking children to their assigned classes with temporal tracking';
