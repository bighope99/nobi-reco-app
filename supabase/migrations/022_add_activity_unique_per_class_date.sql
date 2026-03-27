-- 同一施設×クラス×日付での活動記録重複を防ぐUNIQUE制約
-- 削除済みレコード（deleted_at IS NOT NULL）は除外するPartial Unique Index
-- class_id が NULL の場合（クラスなし施設）も1件のみ許可

-- class_id あり の場合
CREATE UNIQUE INDEX IF NOT EXISTS idx_r_activity_unique_facility_class_date
  ON r_activity (facility_id, class_id, activity_date)
  WHERE deleted_at IS NULL AND class_id IS NOT NULL;

-- class_id なし（NULL）の場合
CREATE UNIQUE INDEX IF NOT EXISTS idx_r_activity_unique_facility_null_class_date
  ON r_activity (facility_id, activity_date)
  WHERE deleted_at IS NULL AND class_id IS NULL;
