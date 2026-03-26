-- role_name が空白のみを禁止するCHECK制約を追加
ALTER TABLE m_role_presets
  ADD CONSTRAINT chk_m_role_presets_role_name_not_blank
  CHECK (char_length(trim(role_name)) > 0);

-- sort_order の競合を防ぐatomic insert関数
-- INSERT時にSELECT MAX(sort_order)+1をDB側でatomicに採番し、
-- UNIQUE制約違反（role_name重複）の場合は既存レコードを返す
CREATE OR REPLACE FUNCTION insert_role_preset(
  p_facility_id UUID,
  p_role_name   VARCHAR(50)
)
RETURNS TABLE(id UUID, role_name VARCHAR(50), sort_order INTEGER, skipped BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id         UUID;
  v_sort_order INTEGER;
BEGIN
  INSERT INTO m_role_presets AS r (facility_id, role_name, sort_order)
  SELECT
    p_facility_id,
    p_role_name,
    COALESCE((
      SELECT MAX(sort_order)
      FROM m_role_presets
      WHERE facility_id = p_facility_id AND deleted_at IS NULL
      FOR UPDATE
    ), -1) + 1
  RETURNING r.id, r.sort_order
  INTO v_id, v_sort_order;

  RETURN QUERY SELECT v_id, p_role_name, v_sort_order, FALSE;

EXCEPTION WHEN unique_violation THEN
  RETURN QUERY
    SELECT r.id, r.role_name, r.sort_order, TRUE
    FROM m_role_presets r
    WHERE r.facility_id = p_facility_id
      AND r.role_name = p_role_name
      AND r.deleted_at IS NULL;
END;
$$;
