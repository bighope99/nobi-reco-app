-- 設定テーブル作成

-- 6.1 曜日通所設定（s_attendance_schedule）
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
CREATE INDEX idx_attendance_schedule_child_id ON s_attendance_schedule(child_id);
CREATE INDEX idx_attendance_schedule_valid_from ON s_attendance_schedule(valid_from);
CREATE INDEX idx_attendance_schedule_is_active ON s_attendance_schedule(is_active) WHERE is_active = true;
