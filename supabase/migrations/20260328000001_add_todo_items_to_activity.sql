-- r_activity に todo_items カラムを追加
ALTER TABLE r_activity ADD COLUMN IF NOT EXISTS todo_items JSONB;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_activity_todo_items
  ON r_activity(id)
  WHERE deleted_at IS NULL AND todo_items IS NOT NULL;
