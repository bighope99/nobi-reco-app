-- 引き継ぎ完了フラグを r_activity テーブルに追加
ALTER TABLE r_activity
  ADD COLUMN IF NOT EXISTS handover_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS handover_completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS handover_completed_by UUID REFERENCES m_users(id);

-- 引き継ぎ完了状態の検索用インデックス
CREATE INDEX IF NOT EXISTS idx_activity_handover_completed
  ON r_activity(handover_completed)
  WHERE deleted_at IS NULL AND handover IS NOT NULL;
