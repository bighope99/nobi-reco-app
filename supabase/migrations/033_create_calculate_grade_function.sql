-- calculate_grade: TypeScript版 calculateGrade() と完全一致する学年計算関数
-- 参考: utils/grade.ts の calculateGrade()
CREATE OR REPLACE FUNCTION calculate_grade(p_birth_date DATE, p_grade_add INTEGER DEFAULT 0)
RETURNS INTEGER AS $$
DECLARE
  v_birth_month INTEGER;
  v_birth_day INTEGER;
  v_is_born_on_or_after_april2 BOOLEAN;
  v_school_entry_year INTEGER;
  v_current_month INTEGER;
  v_current_day INTEGER;
  v_is_current_on_or_after_april2 BOOLEAN;
  v_current_school_year INTEGER;
BEGIN
  IF p_birth_date IS NULL THEN
    RETURN NULL;
  END IF;

  v_birth_month := EXTRACT(MONTH FROM p_birth_date);
  v_birth_day := EXTRACT(DAY FROM p_birth_date);

  -- 4月2日以降生まれかどうか（TS: birthMonth > 3 || (birthMonth === 3 && birthDay >= 2)）
  -- SQL: EXTRACT(MONTH) は 1-indexed なので4月 = 4
  v_is_born_on_or_after_april2 := (v_birth_month > 4) OR (v_birth_month = 4 AND v_birth_day >= 2);

  v_school_entry_year := CASE
    WHEN v_is_born_on_or_after_april2
      THEN EXTRACT(YEAR FROM p_birth_date)::INTEGER + 7
    ELSE
      EXTRACT(YEAR FROM p_birth_date)::INTEGER + 6
  END;

  v_current_month := EXTRACT(MONTH FROM CURRENT_DATE);
  v_current_day := EXTRACT(DAY FROM CURRENT_DATE);

  -- 現在が4月2日以降かどうか
  v_is_current_on_or_after_april2 := (v_current_month > 4) OR (v_current_month = 4 AND v_current_day >= 2);

  v_current_school_year := CASE
    WHEN v_is_current_on_or_after_april2
      THEN EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
    ELSE
      EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER - 1
  END;

  RETURN v_current_school_year - v_school_entry_year + 1 + COALESCE(p_grade_add, 0);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_grade(DATE, INTEGER) IS
  '生年月日と学年調整値から現在の学年を計算する。TypeScript版 calculateGrade() と同一ロジック。4月2日基準。';

-- children_by_grade: 指定施設・学年の child_id 一覧を返すヘルパー関数
-- /api/records/personal の grade フィルターで使用
CREATE OR REPLACE FUNCTION children_by_grade(p_facility_id UUID, p_grade INTEGER)
RETURNS SETOF UUID AS $$
  SELECT id
  FROM m_children
  WHERE facility_id = p_facility_id
    AND deleted_at IS NULL
    AND calculate_grade(birth_date, COALESCE(grade_add, 0)) = p_grade;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION children_by_grade(UUID, INTEGER) IS
  '指定施設の指定学年に該当する child_id 一覧を返す。/api/records/personal の grade フィルターで使用。';
