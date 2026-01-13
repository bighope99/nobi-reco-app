-- r_activityテーブルに新規カラムを追加
-- 活動記録の詳細情報（行事・イベント、1日の流れ、役割分担、特記事項、ごはん情報）を管理

-- 新規カラムの追加
ALTER TABLE r_activity
ADD COLUMN event_name TEXT,
ADD COLUMN daily_schedule JSONB,
ADD COLUMN role_assignments JSONB,
ADD COLUMN special_notes TEXT,
ADD COLUMN meal JSONB;

-- カラムコメントの追加
COMMENT ON COLUMN r_activity.event_name IS '今日の行事・イベント名（例: 運動会、遠足）';
COMMENT ON COLUMN r_activity.daily_schedule IS '1日の流れ [{"time": "09:00", "content": "朝の会"}, ...]';
COMMENT ON COLUMN r_activity.role_assignments IS '役割分担 [{"user_id": "uuid", "user_name": "山田太郎", "role": "主担当"}, ...]';
COMMENT ON COLUMN r_activity.special_notes IS '特記事項（全体を通しての出来事・注意事項）';
COMMENT ON COLUMN r_activity.meal IS 'ごはん情報 {"menu": "カレーライス", "items_to_bring": "フォーク", "notes": "アレルギー対応済"}';
