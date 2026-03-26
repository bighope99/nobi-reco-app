-- m_role_presets の管理ポリシーを修正
-- company_admin が自社の全施設を管理できるよう、RLS を拡張する
-- (旧ポリシーは current_facility_id のみで判定していたため company_admin が複数施設を管理できなかった)

DROP POLICY IF EXISTS "facility_admin can manage role presets" ON m_role_presets;

-- facility_admin: 自施設のみ
CREATE POLICY "facility_admin can manage role presets"
  ON m_role_presets FOR ALL
  USING (
    (auth.jwt()->'app_metadata'->>'role') = 'facility_admin'
    AND facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
  )
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') = 'facility_admin'
    AND facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
  );

-- company_admin: 自社の全施設
CREATE POLICY "company_admin can manage role presets"
  ON m_role_presets FOR ALL
  USING (
    (auth.jwt()->'app_metadata'->>'role') = 'company_admin'
    AND facility_id IN (
      SELECT id FROM m_facilities
      WHERE company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') = 'company_admin'
    AND facility_id IN (
      SELECT id FROM m_facilities
      WHERE company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
        AND deleted_at IS NULL
    )
  );

-- site_admin: 全施設
CREATE POLICY "site_admin can manage role presets"
  ON m_role_presets FOR ALL
  USING (
    (auth.jwt()->'app_metadata'->>'role') = 'site_admin'
  )
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') = 'site_admin'
  );
