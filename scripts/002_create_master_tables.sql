-- マスタテーブル作成

-- 4.1 会社マスタ（m_companies）
CREATE TABLE IF NOT EXISTS m_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,                    -- 会社名
  name_kana VARCHAR(200),                        -- 会社名カナ
  postal_code VARCHAR(10),                       -- 郵便番号
  address VARCHAR(500),                          -- 住所
  phone VARCHAR(20),                             -- 電話番号
  email VARCHAR(255),                            -- 代表メールアドレス
  is_active BOOLEAN NOT NULL DEFAULT true,       -- 有効/無効
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_companies_is_active ON m_companies(is_active) WHERE deleted_at IS NULL;

-- 4.2 施設マスタ（m_facilities）
CREATE TABLE IF NOT EXISTS m_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES m_companies(id),  -- 所属会社
  name VARCHAR(200) NOT NULL,                           -- 施設名
  name_kana VARCHAR(200),                               -- 施設名カナ
  postal_code VARCHAR(10),                              -- 郵便番号
  address VARCHAR(500),                                 -- 住所
  phone VARCHAR(20),                                    -- 電話番号
  email VARCHAR(255),                                   -- 施設メールアドレス
  capacity INTEGER,                                     -- 定員
  is_active BOOLEAN NOT NULL DEFAULT true,              -- 有効/無効
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_facilities_company_id ON m_facilities(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_facilities_is_active ON m_facilities(is_active) WHERE deleted_at IS NULL;

-- 4.3 クラスマスタ（m_classes）
CREATE TABLE IF NOT EXISTS m_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,                  -- クラス名（例: ひまわり組）
  grade VARCHAR(50),                           -- 学年（例: 年長、小1）
  school_year INTEGER NOT NULL,                -- 年度（例: 2025）
  capacity INTEGER,                            -- 定員
  is_active BOOLEAN NOT NULL DEFAULT true,     -- 有効/無効
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_classes_facility_id ON m_classes(facility_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_classes_school_year ON m_classes(school_year) WHERE deleted_at IS NULL;

-- 4.4 ユーザーマスタ（m_users）
CREATE TABLE IF NOT EXISTS m_users (
  id UUID PRIMARY KEY,  -- auth.users.id と同じ値を使用
  company_id UUID REFERENCES m_companies(id),  -- 所属会社（site_adminはNULL）
  name VARCHAR(100) NOT NULL,                  -- 氏名（漢字）
  name_kana VARCHAR(100),                      -- 氏名（カナ）
  email VARCHAR(255) NOT NULL UNIQUE,          -- メールアドレス（auth.usersと同期）
  role user_role NOT NULL DEFAULT 'staff',     -- 権限
  is_active BOOLEAN NOT NULL DEFAULT true,     -- 有効/無効
  is_retired BOOLEAN NOT NULL DEFAULT false,   -- 退職フラグ
  retired_at TIMESTAMP WITH TIME ZONE,         -- 退職日
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_users_company_id ON m_users(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON m_users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_is_active ON m_users(is_active) WHERE deleted_at IS NULL;

-- 4.5 子どもマスタ（m_children）
CREATE TABLE IF NOT EXISTS m_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),  -- 所属施設
  
  -- 基本情報
  family_name VARCHAR(50) NOT NULL,              -- 姓（漢字）
  given_name VARCHAR(50) NOT NULL,               -- 名（漢字）
  family_name_kana VARCHAR(50),                  -- 姓（カナ）
  given_name_kana VARCHAR(50),                   -- 名（カナ）
  nickname VARCHAR(50),                          -- 呼び名・略称
  gender gender_type,                            -- 性別
  birth_date DATE NOT NULL,                      -- 生年月日
  
  -- 写真・画像
  photo_url TEXT,                                -- 顔写真URL（Supabase Storage）
  photo_permission_public BOOLEAN DEFAULT false, -- 外部公開OK
  photo_permission_share BOOLEAN DEFAULT false,  -- 他の保護者に共有OK
  
  -- 保護者情報
  parent_name VARCHAR(100),                      -- 保護者名
  parent_email VARCHAR(255),                     -- 保護者メールアドレス
  parent_phone VARCHAR(20),                      -- 保護者電話番号
  emergency_contact_name VARCHAR(100),           -- 緊急連絡先名
  emergency_contact_phone VARCHAR(20),           -- 緊急連絡先電話番号
  sibling_id UUID REFERENCES m_children(id),     -- 兄弟姉妹の紐づけ
  
  -- レポート設定
  report_name_permission BOOLEAN DEFAULT true,   -- レポートに名前表示OK
  
  -- 健康・特性情報
  allergies TEXT,                                -- アレルギー情報
  health_notes TEXT,                             -- 健康に関する特記事項
  special_needs TEXT,                            -- 特別な支援が必要な場合の詳細
  child_characteristics TEXT,                    -- 子どもの基本特性
  parent_characteristics TEXT,                   -- 親の特性・要望
  
  -- 在籍情報
  enrollment_status enrollment_status_type NOT NULL DEFAULT 'enrolled',
  enrollment_type enrollment_type NOT NULL DEFAULT 'regular',
  enrolled_at TIMESTAMP WITH TIME ZONE,          -- 入所日
  withdrawn_at TIMESTAMP WITH TIME ZONE,         -- 退所日
  
  -- 共通カラム
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_children_facility_id ON m_children(facility_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_children_enrollment_status ON m_children(enrollment_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_children_birth_date ON m_children(birth_date);
CREATE INDEX idx_children_sibling_id ON m_children(sibling_id) WHERE sibling_id IS NOT NULL;

-- 4.6 観点タグマスタ（m_observation_tags）
CREATE TABLE IF NOT EXISTS m_observation_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,              -- タグ名（例: 自立、社会性）
  name_en VARCHAR(50),                           -- 英語名（将来の国際展開用）
  description TEXT,                              -- 説明
  color VARCHAR(7),                              -- 表示色（HEX: #FF5733）
  sort_order INTEGER NOT NULL DEFAULT 0,         -- 表示順序
  is_active BOOLEAN NOT NULL DEFAULT true,       -- 有効/無効
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_observation_tags_is_active ON m_observation_tags(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_observation_tags_sort_order ON m_observation_tags(sort_order);
