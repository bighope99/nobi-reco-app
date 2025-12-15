-- 学校マスタテーブル (m_schools)
-- 学童保育施設が連携する小学校を管理

CREATE TABLE IF NOT EXISTS m_schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),

  -- 基本情報
  name VARCHAR(200) NOT NULL,                      -- 学校名（例: 第一小学校）
  name_kana VARCHAR(200),                          -- 学校名カナ
  postal_code VARCHAR(10),                         -- 郵便番号
  address VARCHAR(500),                            -- 住所
  phone VARCHAR(20),                               -- 電話番号

  -- ステータス
  is_active BOOLEAN NOT NULL DEFAULT true,         -- 有効/無効

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_m_schools_facility
  ON m_schools(facility_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_m_schools_name
  ON m_schools(name)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_m_schools_is_active
  ON m_schools(is_active)
  WHERE deleted_at IS NULL;

-- コメント
COMMENT ON TABLE m_schools IS '学校マスタ - 学童保育施設が連携する小学校';
COMMENT ON COLUMN m_schools.facility_id IS '所属施設ID';
COMMENT ON COLUMN m_schools.name IS '学校名（例: 第一小学校）';
COMMENT ON COLUMN m_schools.name_kana IS '学校名カナ';
COMMENT ON COLUMN m_schools.postal_code IS '郵便番号';
COMMENT ON COLUMN m_schools.address IS '住所';
COMMENT ON COLUMN m_schools.phone IS '電話番号';
COMMENT ON COLUMN m_schools.is_active IS '有効/無効フラグ';
COMMENT ON COLUMN m_schools.deleted_at IS '論理削除日時';
