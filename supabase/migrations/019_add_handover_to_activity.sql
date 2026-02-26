ALTER TABLE r_activity ADD COLUMN handover TEXT;
COMMENT ON COLUMN r_activity.handover IS '翌日スタッフへの引継ぎ事項';
