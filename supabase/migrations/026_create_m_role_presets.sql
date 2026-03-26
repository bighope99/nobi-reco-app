-- 役割プリセットマスタテーブル
CREATE TABLE m_role_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id) ON DELETE CASCADE,
  role_name VARCHAR(50) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_role_presets_facility_id ON m_role_presets(facility_id) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX idx_role_presets_facility_role ON m_role_presets(facility_id, role_name) WHERE deleted_at IS NULL;

ALTER TABLE m_role_presets ENABLE ROW LEVEL SECURITY;

-- 施設メンバー全員が自施設のプリセットを読み取れる
CREATE POLICY "facility members can read role presets"
  ON m_role_presets FOR SELECT
  USING (facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid);

-- facility_admin 以上が自施設のプリセットを管理できる（挿入・更新・削除）
CREATE POLICY "facility_admin can manage role presets"
  ON m_role_presets FOR ALL
  USING (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    AND (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
  )
  WITH CHECK (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    AND (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
  );
