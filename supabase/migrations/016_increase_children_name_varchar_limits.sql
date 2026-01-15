-- Migration: Increase VARCHAR limits for m_children name fields
-- Purpose: Accommodate encrypted PII data which requires more storage space than plaintext
-- Encrypted data typically expands to 2-3x the original size due to encryption overhead

ALTER TABLE m_children
  ALTER COLUMN family_name TYPE VARCHAR(255),
  ALTER COLUMN given_name TYPE VARCHAR(255),
  ALTER COLUMN family_name_kana TYPE VARCHAR(255),
  ALTER COLUMN given_name_kana TYPE VARCHAR(255);

-- Add comment to document the change
COMMENT ON COLUMN m_children.family_name IS 'Family name (encrypted PII, VARCHAR(255) to accommodate encryption overhead)';
COMMENT ON COLUMN m_children.given_name IS 'Given name (encrypted PII, VARCHAR(255) to accommodate encryption overhead)';
COMMENT ON COLUMN m_children.family_name_kana IS 'Family name in kana (encrypted PII, VARCHAR(255) to accommodate encryption overhead)';
COMMENT ON COLUMN m_children.given_name_kana IS 'Given name in kana (encrypted PII, VARCHAR(255) to accommodate encryption overhead)';
