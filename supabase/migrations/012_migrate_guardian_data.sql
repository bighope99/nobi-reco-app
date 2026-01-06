-- 既存の保護者データを m_guardians に移行
-- m_children.parent_* → m_guardians + _child_guardian

DO $$
DECLARE
  child_record RECORD;
  v_guardian_id UUID;
  existing_guardian_id UUID;
BEGIN
  -- parent_phone が存在する児童をループ（電話番号ベースでグループ化）
  FOR child_record IN
    SELECT DISTINCT ON (facility_id, parent_phone)
      id AS child_id,
      facility_id,
      parent_phone,
      parent_email
    FROM m_children
    WHERE parent_phone IS NOT NULL
      AND parent_phone != ''
      AND deleted_at IS NULL
    ORDER BY facility_id, parent_phone, created_at ASC
  LOOP
    -- 既に同じ電話番号の保護者が存在するかチェック
    SELECT id INTO existing_guardian_id
    FROM m_guardians
    WHERE facility_id = child_record.facility_id
      AND phone = child_record.parent_phone
      AND deleted_at IS NULL
    LIMIT 1;

    IF existing_guardian_id IS NOT NULL THEN
      -- 既存の保護者を使用
      v_guardian_id := existing_guardian_id;
    ELSE
      -- 新規保護者レコードを作成
      INSERT INTO m_guardians (
        facility_id,
        family_name,
        given_name,
        phone,
        email
      ) VALUES (
        child_record.facility_id,
        '保護者',  -- デフォルト氏名（後で手動更新が必要）
        '',
        child_record.parent_phone,
        child_record.parent_email
      )
      RETURNING id INTO v_guardian_id;
    END IF;

    -- 同じ電話番号を持つすべての子どもを保護者に紐付け
    INSERT INTO _child_guardian (
      child_id,
      guardian_id,
      relationship,
      is_primary,
      is_emergency_contact
    )
    SELECT
      mc.id,
      v_guardian_id,
      '保護者',
      true,
      true
    FROM m_children mc
    WHERE mc.facility_id = child_record.facility_id
      AND mc.parent_phone = child_record.parent_phone
      AND mc.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM _child_guardian cg
        WHERE cg.child_id = mc.id
          AND cg.guardian_id = v_guardian_id
      );
  END LOOP;

  END LOOP;

  RAISE NOTICE 'Guardian data migration completed';
END $$;
