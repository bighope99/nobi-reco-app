-- Add 'suspended' (休園中) value to enrollment_status_type enum
ALTER TYPE enrollment_status_type ADD VALUE IF NOT EXISTS 'suspended';
