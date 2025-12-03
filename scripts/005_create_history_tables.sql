-- 履歴・ログテーブル作成

-- 7.1 出欠実績ログ（h_attendance）
CREATE TABLE IF NOT EXISTS h_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),
  
  -- チェックイン情報
  checked_in_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- チェックイン日時
  check_in_method check_method_type NOT NULL DEFAULT 'qr',
  
  -- チェックアウト情報（帰宅時）
  checked_out_at TIMESTAMP WITH TIME ZONE,          -- チェックアウト日時
  check_out_method check_method_type,
  
  -- 記録者（手動の場合）
  checked_in_by UUID REFERENCES m_users(id),
  checked_out_by UUID REFERENCES m_users(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_h_attendance_child_id ON h_attendance(child_id);
CREATE INDEX idx_h_attendance_facility_id ON h_attendance(facility_id);
CREATE INDEX idx_h_attendance_checked_in_at ON h_attendance(checked_in_at);
CREATE INDEX idx_h_attendance_facility_date ON h_attendance(facility_id, DATE(checked_in_at));
