ALTER TABLE r_activity ADD COLUMN handover TEXT;
COMMENT ON COLUMN r_activity.handover IS '翌日スタッフへの引継ぎ事項';

CREATE INDEX IF NOT EXISTS idx_activity_handover_lookup
  ON r_activity (facility_id, activity_date DESC)
  WHERE handover IS NOT NULL AND deleted_at IS NULL;
