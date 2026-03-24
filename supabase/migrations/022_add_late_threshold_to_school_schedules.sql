-- m_schools に遅刻閾値カラムを追加（学校単位で管理）
-- デフォルト: 30分

ALTER TABLE m_schools
  ADD COLUMN late_threshold_minutes INTEGER NOT NULL DEFAULT 30;

COMMENT ON COLUMN m_schools.late_threshold_minutes IS '遅刻とみなす閾値（分）。登校予定時刻からこの時間が経過しても到着しない場合に遅刻扱い。学校全体に適用。';
