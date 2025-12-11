-- 曜日通所設定テーブル (s_attendance_schedule)
-- 児童の曜日ベースの通所予定パターンを管理

CREATE TABLE IF NOT EXISTS s_attendance_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id) ON DELETE CASCADE,

  -- 曜日別の通所設定（true = その曜日に来る）
  monday BOOLEAN NOT NULL DEFAULT false,
  tuesday BOOLEAN NOT NULL DEFAULT false,
  wednesday BOOLEAN NOT NULL DEFAULT false,
  thursday BOOLEAN NOT NULL DEFAULT false,
  friday BOOLEAN NOT NULL DEFAULT false,
  saturday BOOLEAN NOT NULL DEFAULT false,
  sunday BOOLEAN NOT NULL DEFAULT false,

  -- 有効期間
  valid_from DATE NOT NULL,                      -- 設定開始日
  valid_to DATE,                                 -- 設定終了日（NULL = 無期限）

  is_active BOOLEAN NOT NULL DEFAULT true,       -- 有効/無効
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_attendance_schedule_child_id ON s_attendance_schedule(child_id);
CREATE INDEX IF NOT EXISTS idx_attendance_schedule_valid_from ON s_attendance_schedule(valid_from);
CREATE INDEX IF NOT EXISTS idx_attendance_schedule_is_active ON s_attendance_schedule(is_active) WHERE is_active = true;

-- コメント
COMMENT ON TABLE s_attendance_schedule IS '曜日ベースの通所予定パターン設定';
COMMENT ON COLUMN s_attendance_schedule.child_id IS '児童ID';
COMMENT ON COLUMN s_attendance_schedule.monday IS '月曜日の通所予定';
COMMENT ON COLUMN s_attendance_schedule.tuesday IS '火曜日の通所予定';
COMMENT ON COLUMN s_attendance_schedule.wednesday IS '水曜日の通所予定';
COMMENT ON COLUMN s_attendance_schedule.thursday IS '木曜日の通所予定';
COMMENT ON COLUMN s_attendance_schedule.friday IS '金曜日の通所予定';
COMMENT ON COLUMN s_attendance_schedule.saturday IS '土曜日の通所予定';
COMMENT ON COLUMN s_attendance_schedule.sunday IS '日曜日の通所予定';
COMMENT ON COLUMN s_attendance_schedule.valid_from IS '設定の有効期間開始日';
COMMENT ON COLUMN s_attendance_schedule.valid_to IS '設定の有効期間終了日（NULLの場合は無期限）';
COMMENT ON COLUMN s_attendance_schedule.is_active IS '有効/無効フラグ';
