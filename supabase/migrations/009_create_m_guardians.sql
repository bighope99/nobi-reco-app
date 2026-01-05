-- 保護者マスタテーブル作成
-- 保護者氏名は「姓名まとめて」family_name に格納（例: 「佐藤 太郎」）

CREATE TABLE IF NOT EXISTS m_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),

  -- 基本情報（姓名まとめて格納）
  family_name VARCHAR(50) NOT NULL,              -- 例: 「佐藤 太郎」
  given_name VARCHAR(50) NOT NULL DEFAULT '',    -- 空文字列（互換性のため保持）
  family_name_kana VARCHAR(50) DEFAULT '',       -- 姓（カナ）※オプション
  given_name_kana VARCHAR(50) DEFAULT '',        -- 名（カナ）※オプション

  -- 連絡先
  phone VARCHAR(20),                             -- 電話番号
  email VARCHAR(255),                            -- メールアドレス
  postal_code VARCHAR(10),                       -- 郵便番号
  address TEXT,                                  -- 住所

  -- 備考
  notes TEXT,                                    -- 特記事項

  -- 共通カラム
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_guardians_facility_id ON m_guardians(facility_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_guardians_phone ON m_guardians(phone) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_guardians_email ON m_guardians(email) WHERE deleted_at IS NULL;

-- フルテキスト検索用インデックス（名前検索）
CREATE INDEX IF NOT EXISTS idx_guardians_name_search ON m_guardians
  USING gin(to_tsvector('japanese', family_name));

-- コメント追加
COMMENT ON TABLE m_guardians IS '保護者マスタテーブル';
COMMENT ON COLUMN m_guardians.family_name IS '保護者氏名（姓名まとめて格納）例: 「佐藤 太郎」';
COMMENT ON COLUMN m_guardians.given_name IS '名（空文字列、互換性のため保持）';
