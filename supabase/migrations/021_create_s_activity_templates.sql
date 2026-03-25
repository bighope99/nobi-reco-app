-- Migration 021: 活動記録テンプレートテーブルを作成
-- staff以上がテンプレートを作成でき、facility_admin以上のみ削除可能

CREATE TABLE s_activity_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),
  name VARCHAR(100) NOT NULL,
  event_name TEXT,
  daily_schedule JSONB,
  created_by UUID NOT NULL REFERENCES m_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_s_activity_templates_facility_id ON s_activity_templates(facility_id) WHERE deleted_at IS NULL;

-- RLS有効化
ALTER TABLE s_activity_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: 同一施設のスタッフのみ参照可能
CREATE POLICY "activity_templates_select" ON s_activity_templates
  FOR SELECT
  USING (
    facility_id IN (
      SELECT uf.facility_id
      FROM _user_facility uf
      WHERE uf.user_id = auth.uid()
        AND uf.is_current = true
    )
    AND deleted_at IS NULL
  );

-- INSERT: staff以上（同一施設）
CREATE POLICY "activity_templates_insert" ON s_activity_templates
  FOR INSERT
  WITH CHECK (
    facility_id IN (
      SELECT uf.facility_id
      FROM _user_facility uf
      WHERE uf.user_id = auth.uid()
        AND uf.is_current = true
    )
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM m_users
      WHERE id = auth.uid()
        AND role IN ('staff', 'facility_admin', 'company_admin', 'site_admin')
    )
  );

-- UPDATE: facility_admin以上のみ（論理削除用）
CREATE POLICY "activity_templates_update" ON s_activity_templates
  FOR UPDATE
  USING (
    facility_id IN (
      SELECT uf.facility_id
      FROM _user_facility uf
      WHERE uf.user_id = auth.uid()
        AND uf.is_current = true
    )
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM m_users
      WHERE id = auth.uid()
        AND role IN ('facility_admin', 'company_admin', 'site_admin')
    )
  );
