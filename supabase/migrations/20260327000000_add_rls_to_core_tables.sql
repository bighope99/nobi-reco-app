-- Migration: コアテーブルへのRLS有効化
-- 対象: m_companies, m_facilities, m_users, m_observation_tags,
--        r_observation, r_daily_attendance

-- ============================================================
-- m_companies（会社マスタ）
-- ============================================================
ALTER TABLE m_companies ENABLE ROW LEVEL SECURITY;

-- SELECT: 認証済みユーザーが自分の会社のみ参照
CREATE POLICY "companies_select" ON m_companies
  FOR SELECT TO authenticated
  USING (
    id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
    OR (auth.jwt()->'app_metadata'->>'role') = 'site_admin'
  );

-- INSERT/UPDATE/DELETE: site_admin のみ
CREATE POLICY "companies_modify" ON m_companies
  FOR ALL TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'site_admin')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'site_admin');

-- service_role: 全アクセス許可
CREATE POLICY "companies_service_role" ON m_companies
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- m_facilities（施設マスタ）
-- ============================================================
ALTER TABLE m_facilities ENABLE ROW LEVEL SECURITY;

-- SELECT: 認証済みユーザーが自施設のみ参照
CREATE POLICY "facilities_select" ON m_facilities
  FOR SELECT TO authenticated
  USING (
    id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    OR (auth.jwt()->'app_metadata'->>'role') = 'site_admin'
    OR (
      (auth.jwt()->'app_metadata'->>'role') = 'company_admin'
      AND company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
    )
  );

-- INSERT/UPDATE/DELETE: company_admin(自社) または site_admin
CREATE POLICY "facilities_modify" ON m_facilities
  FOR ALL TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') = 'site_admin'
    OR (
      (auth.jwt()->'app_metadata'->>'role') = 'company_admin'
      AND company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
    )
  )
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') = 'site_admin'
    OR (
      (auth.jwt()->'app_metadata'->>'role') = 'company_admin'
      AND company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
    )
  );

-- service_role: 全アクセス許可
CREATE POLICY "facilities_service_role" ON m_facilities
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- m_users（ユーザーマスタ）
-- ============================================================
ALTER TABLE m_users ENABLE ROW LEVEL SECURITY;

-- SELECT: 自分自身 OR 同一施設のメンバー OR 上位管理者
CREATE POLICY "users_select" ON m_users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (auth.jwt()->'app_metadata'->>'role') IN ('site_admin', 'company_admin')
    OR EXISTS (
      SELECT 1 FROM _user_facility uf1
      JOIN _user_facility uf2 ON uf1.facility_id = uf2.facility_id
      WHERE uf1.user_id = auth.uid()
        AND uf1.is_current = true
        AND uf2.user_id = m_users.id
    )
  );

-- INSERT: facility_admin 以上
CREATE POLICY "users_insert" ON m_users
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
  );

-- UPDATE: 自分自身 OR facility_admin 以上
CREATE POLICY "users_update" ON m_users
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
  );

-- service_role: 全アクセス許可
CREATE POLICY "users_service_role" ON m_users
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- m_observation_tags（観察タグマスタ）
-- ============================================================
ALTER TABLE m_observation_tags ENABLE ROW LEVEL SECURITY;

-- SELECT: 認証済みユーザー全員（タグはシステム共通）
CREATE POLICY "observation_tags_select" ON m_observation_tags
  FOR SELECT TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE: site_admin のみ
CREATE POLICY "observation_tags_modify" ON m_observation_tags
  FOR ALL TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'site_admin')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'site_admin');

-- service_role: 全アクセス許可
CREATE POLICY "observation_tags_service_role" ON m_observation_tags
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- r_observation（観察記録）
-- ============================================================
ALTER TABLE r_observation ENABLE ROW LEVEL SECURITY;

-- SELECT: 自施設の子どものレコードのみ（論理削除済みを除く）
CREATE POLICY "observation_select" ON r_observation
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM m_children c
      WHERE c.id = r_observation.child_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
    AND deleted_at IS NULL
  );

-- INSERT: staff 以上が自施設の子どものレコードのみ
CREATE POLICY "observation_insert" ON r_observation
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM m_children c
      WHERE c.id = child_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

-- UPDATE: 自分が作成 OR facility_admin 以上（自施設）
CREATE POLICY "observation_update" ON r_observation
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM m_children c
      WHERE c.id = r_observation.child_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
    AND (
      created_by = auth.uid()
      OR (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
    )
  );

-- service_role: 全アクセス許可
CREATE POLICY "observation_service_role" ON r_observation
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- r_daily_attendance（日次出席）
-- ============================================================
ALTER TABLE r_daily_attendance ENABLE ROW LEVEL SECURITY;

-- SELECT: 自施設のレコードのみ（論理削除済みを除く）
CREATE POLICY "daily_attendance_select" ON r_daily_attendance
  FOR SELECT TO authenticated
  USING (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    AND deleted_at IS NULL
  );

-- INSERT: staff 以上が自施設のみ
CREATE POLICY "daily_attendance_insert" ON r_daily_attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
  );

-- UPDATE: staff 以上が自施設のみ（論理削除済みを除く）
CREATE POLICY "daily_attendance_update" ON r_daily_attendance
  FOR UPDATE TO authenticated
  USING (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    AND deleted_at IS NULL
  );

-- service_role: 全アクセス許可
CREATE POLICY "daily_attendance_service_role" ON r_daily_attendance
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
