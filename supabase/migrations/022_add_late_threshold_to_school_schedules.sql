-- s_school_schedules に遅刻閾値カラムを追加
-- 学校スケジュールごとに遅刻閾値を設定可能にする（デフォルト: 30分）

ALTER TABLE s_school_schedules
  ADD COLUMN late_threshold_minutes INTEGER NOT NULL DEFAULT 30;

-- コメント
COMMENT ON COLUMN s_school_schedules.late_threshold_minutes IS '遅刻とみなす閾値（分）。登校予定時刻からこの時間が経過しても到着しない場合に遅刻扱い';
