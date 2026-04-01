-- Migration: 残りテーブルへのRLS有効化
-- 対象: m_children, m_classes, m_guardians, m_schools, r_activity,
--        h_attendance, r_report, h_report_share, r_voice,
--        s_attendance_schedule, _child_guardian, _child_class, _child_sibling,
--        _record_tag, s_school_schedules, _user_class, _user_facility

-- ============================================================
-- m_children（子どもマスタ）
-- ============================================================
ALTER TABLE m_children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "children_select" ON m_children
  FOR SELECT TO authenticated
  USING (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    OR (auth.jwt()->'app_metadata'->>'role') IN ('company_admin', 'site_admin')
  );

CREATE POLICY "children_modify" ON m_children
  FOR ALL TO authenticated
  USING (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    AND (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
  )
  WITH CHECK (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    AND (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
  );

CREATE POLICY "children_service_role" ON m_children
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- m_classes（クラスマスタ）
-- ============================================================
ALTER TABLE m_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "classes_select" ON m_classes
  FOR SELECT TO authenticated
  USING (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    OR (auth.jwt()->'app_metadata'->>'role') IN ('company_admin', 'site_admin')
  );

CREATE POLICY "classes_modify" ON m_classes
  FOR ALL TO authenticated
  USING (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    AND (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
  )
  WITH CHECK (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    AND (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
  );

CREATE POLICY "classes_service_role" ON m_classes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- m_guardians（保護者マスタ）
-- ============================================================
ALTER TABLE m_guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guardians_select" ON m_guardians
  FOR SELECT TO authenticated
  USING (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
  );

CREATE POLICY "guardians_insert" ON m_guardians
  FOR INSERT TO authenticated
  WITH CHECK (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    AND (auth.jwt()->'app_metadata'->>'role') IN ('staff', 'facility_admin', 'company_admin', 'site_admin')
  );

CREATE POLICY "guardians_update" ON m_guardians
  FOR UPDATE TO authenticated
  USING (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    AND (auth.jwt()->'app_metadata'->>'role') IN ('staff', 'facility_admin', 'company_admin', 'site_admin')
  );

CREATE POLICY "guardians_service_role" ON m_guardians
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- m_schools（学校マスタ）
-- ============================================================
ALTER TABLE m_schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schools_select" ON m_schools
  FOR SELECT TO authenticated
  USING (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    OR (auth.jwt()->'app_metadata'->>'role') IN ('company_admin', 'site_admin')
  );

CREATE POLICY "schools_modify" ON m_schools
  FOR ALL TO authenticated
  USING (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    AND (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
  )
  WITH CHECK (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    AND (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
  );

CREATE POLICY "schools_service_role" ON m_schools
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- r_activity（活動記録）
-- ============================================================
ALTER TABLE r_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_select" ON r_activity
  FOR SELECT TO authenticated
  USING (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
  );

CREATE POLICY "activity_insert" ON r_activity
  FOR INSERT TO authenticated
  WITH CHECK (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    AND (auth.jwt()->'app_metadata'->>'role') IN ('staff', 'facility_admin', 'company_admin', 'site_admin')
  );

CREATE POLICY "activity_update" ON r_activity
  FOR UPDATE TO authenticated
  USING (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    AND (auth.jwt()->'app_metadata'->>'role') IN ('staff', 'facility_admin', 'company_admin', 'site_admin')
  );

CREATE POLICY "activity_service_role" ON r_activity
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- h_attendance（出欠実績ログ）
-- ============================================================
ALTER TABLE h_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "h_attendance_select" ON h_attendance
  FOR SELECT TO authenticated
  USING (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
  );

CREATE POLICY "h_attendance_insert" ON h_attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    AND (auth.jwt()->'app_metadata'->>'role') IN ('staff', 'facility_admin', 'company_admin', 'site_admin')
  );

CREATE POLICY "h_attendance_update" ON h_attendance
  FOR UPDATE TO authenticated
  USING (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    AND (auth.jwt()->'app_metadata'->>'role') IN ('staff', 'facility_admin', 'company_admin', 'site_admin')
  );

CREATE POLICY "h_attendance_service_role" ON h_attendance
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- r_report（レポート）
-- ============================================================
ALTER TABLE r_report ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_select" ON r_report
  FOR SELECT TO authenticated
  USING (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
  );

CREATE POLICY "report_modify" ON r_report
  FOR ALL TO authenticated
  USING (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    AND (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
  )
  WITH CHECK (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    AND (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
  );

CREATE POLICY "report_service_role" ON r_report
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- h_report_share（レポート共有履歴）
-- ============================================================
ALTER TABLE h_report_share ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_share_select" ON h_report_share
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM r_report rr
      WHERE rr.id = h_report_share.report_id
        AND rr.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "report_share_insert" ON h_report_share
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
    AND EXISTS (
      SELECT 1 FROM r_report rr
      WHERE rr.id = report_id
        AND rr.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "report_share_service_role" ON h_report_share
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- r_voice（子どもの声記録）
-- ============================================================
ALTER TABLE r_voice ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_select" ON r_voice
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM m_children c
      WHERE c.id = r_voice.child_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "voice_insert" ON r_voice
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('staff', 'facility_admin', 'company_admin', 'site_admin')
    AND EXISTS (
      SELECT 1 FROM m_children c
      WHERE c.id = child_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "voice_update" ON r_voice
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('staff', 'facility_admin', 'company_admin', 'site_admin')
    AND EXISTS (
      SELECT 1 FROM m_children c
      WHERE c.id = r_voice.child_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "voice_service_role" ON r_voice
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- s_attendance_schedule（曜日通所設定）
-- ============================================================
ALTER TABLE s_attendance_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_schedule_select" ON s_attendance_schedule
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM m_children c
      WHERE c.id = s_attendance_schedule.child_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "attendance_schedule_insert" ON s_attendance_schedule
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('staff', 'facility_admin', 'company_admin', 'site_admin')
    AND EXISTS (
      SELECT 1 FROM m_children c
      WHERE c.id = child_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "attendance_schedule_update" ON s_attendance_schedule
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('staff', 'facility_admin', 'company_admin', 'site_admin')
    AND EXISTS (
      SELECT 1 FROM m_children c
      WHERE c.id = s_attendance_schedule.child_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "attendance_schedule_service_role" ON s_attendance_schedule
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- _child_guardian（子ども-保護者）
-- ============================================================
ALTER TABLE _child_guardian ENABLE ROW LEVEL SECURITY;

CREATE POLICY "child_guardian_select" ON _child_guardian
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM m_children c
      WHERE c.id = _child_guardian.child_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "child_guardian_insert" ON _child_guardian
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('staff', 'facility_admin', 'company_admin', 'site_admin')
    AND EXISTS (
      SELECT 1 FROM m_children c
      WHERE c.id = child_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "child_guardian_update" ON _child_guardian
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('staff', 'facility_admin', 'company_admin', 'site_admin')
    AND EXISTS (
      SELECT 1 FROM m_children c
      WHERE c.id = _child_guardian.child_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "child_guardian_service_role" ON _child_guardian
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- _child_class（子ども-クラス）
-- ============================================================
ALTER TABLE _child_class ENABLE ROW LEVEL SECURITY;

CREATE POLICY "child_class_select" ON _child_class
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM m_children c
      WHERE c.id = _child_class.child_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "child_class_modify" ON _child_class
  FOR ALL TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
    AND EXISTS (
      SELECT 1 FROM m_children c
      WHERE c.id = _child_class.child_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  )
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
    AND EXISTS (
      SELECT 1 FROM m_children c
      WHERE c.id = child_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "child_class_service_role" ON _child_class
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- _child_sibling（子ども-兄弟姉妹）
-- ============================================================
ALTER TABLE _child_sibling ENABLE ROW LEVEL SECURITY;

CREATE POLICY "child_sibling_select" ON _child_sibling
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM m_children c
      WHERE c.id = _child_sibling.child_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "child_sibling_modify" ON _child_sibling
  FOR ALL TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
    AND EXISTS (
      SELECT 1 FROM m_children c
      WHERE c.id = _child_sibling.child_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  )
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
    AND EXISTS (
      SELECT 1 FROM m_children c
      WHERE c.id = child_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "child_sibling_service_role" ON _child_sibling
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- _record_tag（観察記録-タグ）
-- ============================================================
ALTER TABLE _record_tag ENABLE ROW LEVEL SECURITY;

CREATE POLICY "record_tag_select" ON _record_tag
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM r_observation ro
      JOIN m_children c ON c.id = ro.child_id
      WHERE ro.id = _record_tag.observation_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "record_tag_modify" ON _record_tag
  FOR ALL TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('staff', 'facility_admin', 'company_admin', 'site_admin')
    AND EXISTS (
      SELECT 1 FROM r_observation ro
      JOIN m_children c ON c.id = ro.child_id
      WHERE ro.id = _record_tag.observation_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  )
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('staff', 'facility_admin', 'company_admin', 'site_admin')
    AND EXISTS (
      SELECT 1 FROM r_observation ro
      JOIN m_children c ON c.id = ro.child_id
      WHERE ro.id = observation_id
        AND c.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "record_tag_service_role" ON _record_tag
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- s_school_schedules（学校登校スケジュール）
-- ============================================================
ALTER TABLE s_school_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_schedules_select" ON s_school_schedules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM m_schools ms
      WHERE ms.id = s_school_schedules.school_id
        AND ms.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "school_schedules_modify" ON s_school_schedules
  FOR ALL TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
    AND EXISTS (
      SELECT 1 FROM m_schools ms
      WHERE ms.id = s_school_schedules.school_id
        AND ms.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  )
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
    AND EXISTS (
      SELECT 1 FROM m_schools ms
      WHERE ms.id = school_id
        AND ms.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "school_schedules_service_role" ON s_school_schedules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- _user_class（職員-クラス）
-- ============================================================
ALTER TABLE _user_class ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_class_select" ON _user_class
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM m_classes mc
      WHERE mc.id = _user_class.class_id
        AND mc.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "user_class_modify" ON _user_class
  FOR ALL TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
    AND EXISTS (
      SELECT 1 FROM m_classes mc
      WHERE mc.id = _user_class.class_id
        AND mc.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  )
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
    AND EXISTS (
      SELECT 1 FROM m_classes mc
      WHERE mc.id = class_id
        AND mc.facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    )
  );

CREATE POLICY "user_class_service_role" ON _user_class
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- _user_facility（職員-施設）
-- NOTE: m_users の RLS サブクエリ内で参照されるため、
--       自施設メンバー全員 OR 自分自身が見えるポリシーにする
-- ============================================================
ALTER TABLE _user_facility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_facility_select" ON _user_facility
  FOR SELECT TO authenticated
  USING (
    facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
    OR user_id = auth.uid()
  );

CREATE POLICY "user_facility_modify" ON _user_facility
  FOR ALL TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
    AND facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
  )
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('facility_admin', 'company_admin', 'site_admin')
    AND facility_id = (auth.jwt()->'app_metadata'->>'current_facility_id')::uuid
  );

CREATE POLICY "user_facility_service_role" ON _user_facility
  FOR ALL TO service_role USING (true) WITH CHECK (true);
