-- PII検索用ハッシュテーブル (s_pii_search_index)
-- 暗号化されたPIIフィールドの検索を可能にするためのインデックステーブル
-- 電話番号・メールアドレスはSHA-256ハッシュで完全一致検索
-- 名前は正規化された値で部分一致検索（ilike）

CREATE TABLE IF NOT EXISTS s_pii_search_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- エンティティ情報
  entity_type VARCHAR(20) NOT NULL,  -- 'child' or 'guardian'
  entity_id UUID NOT NULL,            -- m_children.id or m_guardians.id
  
  -- 検索タイプ
  search_type VARCHAR(20) NOT NULL,   -- 'phone', 'email', 'name', 'name_kana'
  
  -- 検索用データ
  search_hash VARCHAR(64),            -- SHA-256ハッシュ（電話番号・メールアドレス用、64文字）
  normalized_value TEXT,              -- 正規化された値（名前の部分一致検索用）
  
  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 制約
  CONSTRAINT unique_entity_search UNIQUE(entity_type, entity_id, search_type),
  
  -- チェック制約: search_hash と normalized_value のどちらかは必須
  CONSTRAINT check_search_data CHECK (
    (search_hash IS NOT NULL) OR (normalized_value IS NOT NULL)
  )
);

-- インデックス
-- 1. 電話番号・メールアドレスの完全一致検索用（search_hash）
CREATE INDEX IF NOT EXISTS idx_pii_search_hash 
  ON s_pii_search_index(search_hash) 
  WHERE search_hash IS NOT NULL;

-- 2. 名前の部分一致検索用（normalized_value、GINインデックスで日本語検索を高速化）
CREATE INDEX IF NOT EXISTS idx_pii_search_normalized_value 
  ON s_pii_search_index USING gin(to_tsvector('japanese', normalized_value))
  WHERE normalized_value IS NOT NULL;

-- 3. エンティティ削除時の検索用（entity_type, entity_id）
CREATE INDEX IF NOT EXISTS idx_pii_search_entity 
  ON s_pii_search_index(entity_type, entity_id);

-- 4. 検索パフォーマンス向上用（entity_type, search_type, search_hash）
CREATE INDEX IF NOT EXISTS idx_pii_search_type_hash 
  ON s_pii_search_index(entity_type, search_type, search_hash)
  WHERE search_hash IS NOT NULL;

-- 5. 名前検索のパフォーマンス向上用（entity_type, search_type, normalized_value）
-- ilike検索を高速化するため、B-treeインデックスも追加
CREATE INDEX IF NOT EXISTS idx_pii_search_type_normalized 
  ON s_pii_search_index(entity_type, search_type, normalized_value)
  WHERE normalized_value IS NOT NULL;

-- コメント
COMMENT ON TABLE s_pii_search_index IS 'PII検索用ハッシュテーブル - 暗号化されたPIIフィールドの検索を可能にする';
COMMENT ON COLUMN s_pii_search_index.entity_type IS 'エンティティタイプ: ''child''（児童）または ''guardian''（保護者）';
COMMENT ON COLUMN s_pii_search_index.entity_id IS 'エンティティID: m_children.id または m_guardians.id';
COMMENT ON COLUMN s_pii_search_index.search_type IS '検索タイプ: ''phone''（電話番号）、''email''（メールアドレス）、''name''（名前）、''name_kana''（フリガナ）';
COMMENT ON COLUMN s_pii_search_index.search_hash IS 'SHA-256ハッシュ（64文字）: 電話番号・メールアドレスの完全一致検索用';
COMMENT ON COLUMN s_pii_search_index.normalized_value IS '正規化された値: 名前の部分一致検索用（ilike検索）';
