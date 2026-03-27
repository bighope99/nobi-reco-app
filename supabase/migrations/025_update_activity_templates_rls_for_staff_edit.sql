-- Migration 025: s_activity_templates の UPDATE RLS を staff 以上に拡張
-- 編集（PUT）を全スタッフが実行できるよう変更。削除（論理削除）は引き続き facility_admin 以上のみ。
-- API層で削除（deleted_at 更新）と通常編集（name/event_name/daily_schedule 更新）を分離して制御する。

DROP POLICY IF EXISTS "activity_templates_update" ON s_activity_templates;

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
        AND role IN ('staff', 'facility_admin', 'company_admin', 'site_admin')
    )
  );
