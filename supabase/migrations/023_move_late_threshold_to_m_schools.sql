-- late_threshold_minutes を s_school_schedules から m_schools に移動
-- 学校単位での閾値管理に変更（スケジュール単位から昇格）

-- 1. m_schools に追加
ALTER TABLE m_schools
  ADD COLUMN IF NOT EXISTS late_threshold_minutes INTEGER NOT NULL DEFAULT 30;

COMMENT ON COLUMN m_schools.late_threshold_minutes IS '遅刻とみなす閾値（分）。登校予定時刻からこの時間が経過しても到着しない場合に遅刻扱い。学校全体に適用。';

-- 2. s_school_schedules から削除
ALTER TABLE s_school_schedules
  DROP COLUMN IF EXISTS late_threshold_minutes;
