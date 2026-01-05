-- 子ども-兄弟姉妹紐付けテーブル作成
-- 双方向リレーション: child_id と sibling_id を入れ替えた2つのレコードが存在

CREATE TABLE IF NOT EXISTS _child_sibling (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id) ON DELETE CASCADE,
  sibling_id UUID NOT NULL REFERENCES m_children(id) ON DELETE CASCADE,

  -- 関係
  relationship VARCHAR(20) DEFAULT '兄弟',       -- デフォルト「兄弟」（将来の拡張用に保持）

  -- 共通カラム
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 制約
  UNIQUE(child_id, sibling_id),
  CHECK (child_id != sibling_id)
);

-- インデックス作成
CREATE INDEX idx_child_sibling_child_id ON _child_sibling(child_id);
CREATE INDEX idx_child_sibling_sibling_id ON _child_sibling(sibling_id);

-- コメント追加
COMMENT ON TABLE _child_sibling IS '子ども-兄弟姉妹紐付けテーブル（双方向リレーション）';
COMMENT ON COLUMN _child_sibling.relationship IS 'デフォルト「兄弟」（詳細な関係性は管理しない）';
