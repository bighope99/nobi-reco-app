-- 子ども-保護者紐付けテーブル作成
-- 1人の児童に複数の保護者（主たる保護者、緊急連絡先）を紐づけ可能

CREATE TABLE IF NOT EXISTS _child_guardian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES m_guardians(id) ON DELETE CASCADE,

  -- 関係
  relationship VARCHAR(20) DEFAULT '保護者',     -- 父/母/祖父/祖母/その他
  is_primary BOOLEAN NOT NULL DEFAULT false,     -- 主たる連絡先フラグ
  is_emergency_contact BOOLEAN NOT NULL DEFAULT false,  -- 緊急連絡先フラグ

  -- 共通カラム
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 制約
  UNIQUE(child_id, guardian_id)
);

-- インデックス作成
CREATE INDEX idx_child_guardian_child_id ON _child_guardian(child_id);
CREATE INDEX idx_child_guardian_guardian_id ON _child_guardian(guardian_id);
CREATE INDEX idx_child_guardian_is_primary ON _child_guardian(is_primary) WHERE is_primary = true;
CREATE INDEX idx_child_guardian_is_emergency ON _child_guardian(is_emergency_contact) WHERE is_emergency_contact = true;

-- コメント追加
COMMENT ON TABLE _child_guardian IS '子ども-保護者紐付けテーブル';
COMMENT ON COLUMN _child_guardian.is_primary IS '主たる連絡先フラグ（筆頭保護者）';
COMMENT ON COLUMN _child_guardian.is_emergency_contact IS '緊急連絡先フラグ（祖父母等）';
