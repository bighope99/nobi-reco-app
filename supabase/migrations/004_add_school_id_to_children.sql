-- m_childrenテーブルにschool_idカラムとgrade_addカラムを追加
-- ダッシュボード機能拡張：学校・学年フィルタリング対応

-- school_idカラムを追加（存在しない場合のみ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'm_children' AND column_name = 'school_id'
  ) THEN
    ALTER TABLE m_children
      ADD COLUMN school_id UUID REFERENCES m_schools(id);

    -- インデックスを作成
    CREATE INDEX idx_children_school_id
      ON m_children(school_id)
      WHERE deleted_at IS NULL;

    -- コメント追加
    COMMENT ON COLUMN m_children.school_id IS '所属学校ID（フィルタリング用）';
  END IF;
END $$;

-- grade_addカラムを追加（存在しない場合のみ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'm_children' AND column_name = 'grade_add'
  ) THEN
    ALTER TABLE m_children
      ADD COLUMN grade_add INTEGER DEFAULT 0;

    -- インデックスを作成
    CREATE INDEX idx_children_birth_grade_add
      ON m_children(birth_date, grade_add)
      WHERE deleted_at IS NULL;

    -- コメント追加
    COMMENT ON COLUMN m_children.grade_add IS '学年調整値（±2年程度、留年・飛び級対応）';
  END IF;
END $$;
