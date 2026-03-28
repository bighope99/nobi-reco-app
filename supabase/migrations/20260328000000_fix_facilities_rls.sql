-- Migration: m_facilities SELECT ポリシーを修正
-- 複数施設に所属するユーザーが自分の施設一覧を参照できるよう拡張

DROP POLICY IF EXISTS "facilities_select" ON m_facilities;

CREATE POLICY "facilities_select" ON m_facilities
  FOR SELECT TO authenticated
  USING (
    -- 現在の施設
    id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    -- 所属施設（全て）
    OR EXISTS (
      SELECT 1 FROM _user_facility uf
      WHERE uf.facility_id = m_facilities.id
        AND uf.user_id = auth.uid()
        AND uf.is_current = true
    )
    -- site_admin: 全施設
    OR (auth.jwt()->'app_metadata'->>'role') = 'site_admin'
    -- company_admin: 自社施設
    OR (
      (auth.jwt()->'app_metadata'->>'role') = 'company_admin'
      AND company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
    )
  );
