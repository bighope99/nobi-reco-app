-- Migration 020: h_attendance に JST日付の生成カラムとユニーク制約を追加
-- 同一児童・施設・日付に対するチェックイン記録の重複を防ぐ

-- 既存の重複レコードを削除（最新のレコードを残す）
DELETE FROM h_attendance
WHERE id NOT IN (
  SELECT DISTINCT ON (child_id, facility_id, (checked_in_at AT TIME ZONE 'Asia/Tokyo')::date)
    id
  FROM h_attendance
  ORDER BY child_id, facility_id, (checked_in_at AT TIME ZONE 'Asia/Tokyo')::date, checked_in_at DESC
);

-- JST日付の生成カラムを追加（stored: checked_in_at から自動計算）
ALTER TABLE h_attendance
ADD COLUMN checked_in_date DATE GENERATED ALWAYS AS (
  (checked_in_at AT TIME ZONE 'Asia/Tokyo')::date
) STORED;

-- ユニーク制約を追加（同一児童・施設・日付でチェックインは1件のみ）
ALTER TABLE h_attendance
ADD CONSTRAINT h_attendance_unique_child_facility_date
UNIQUE (child_id, facility_id, checked_in_date);
