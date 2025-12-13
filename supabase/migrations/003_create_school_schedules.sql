-- 学校登校スケジュールテーブル (s_school_schedules)
-- 学校ごと・学年グループごとの登校時刻パターンを管理

CREATE TABLE IF NOT EXISTS s_school_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES m_schools(id) ON DELETE CASCADE,

  -- 対象学年（複数選択可能、配列形式）
  grades TEXT[] NOT NULL,  -- 例: ARRAY['1', '2', '3'] → 1~3年生

  -- 曜日別登校時刻
  monday_time TIME,                                -- 月曜日の登校時刻
  tuesday_time TIME,                               -- 火曜日の登校時刻
  wednesday_time TIME,                             -- 水曜日の登校時刻
  thursday_time TIME,                              -- 木曜日の登校時刻
  friday_time TIME,                                -- 金曜日の登校時刻
  saturday_time TIME,                              -- 土曜日の登校時刻（通常NULL）
  sunday_time TIME,                                -- 日曜日の登校時刻（通常NULL）

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_s_school_schedules_school
  ON s_school_schedules(school_id)
  WHERE deleted_at IS NULL;

-- 学年配列の検索用GINインデックス
CREATE INDEX IF NOT EXISTS idx_s_school_schedules_grades
  ON s_school_schedules USING gin(grades)
  WHERE deleted_at IS NULL;

-- コメント
COMMENT ON TABLE s_school_schedules IS '学校登校スケジュール - 学年グループごとの登校時刻パターン';
COMMENT ON COLUMN s_school_schedules.school_id IS '学校ID';
COMMENT ON COLUMN s_school_schedules.grades IS '対象学年の配列（例: ARRAY[''1'', ''2'', ''3''] → 1~3年生）';
COMMENT ON COLUMN s_school_schedules.monday_time IS '月曜日の登校時刻';
COMMENT ON COLUMN s_school_schedules.tuesday_time IS '火曜日の登校時刻';
COMMENT ON COLUMN s_school_schedules.wednesday_time IS '水曜日の登校時刻';
COMMENT ON COLUMN s_school_schedules.thursday_time IS '木曜日の登校時刻';
COMMENT ON COLUMN s_school_schedules.friday_time IS '金曜日の登校時刻';
COMMENT ON COLUMN s_school_schedules.saturday_time IS '土曜日の登校時刻（通常NULL）';
COMMENT ON COLUMN s_school_schedules.sunday_time IS '日曜日の登校時刻（通常NULL）';
COMMENT ON COLUMN s_school_schedules.deleted_at IS '論理削除日時';
