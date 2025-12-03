-- 中間テーブル作成

-- 8.1 職員-施設（_user_facility）
CREATE TABLE IF NOT EXISTS _user_facility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES m_users(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES m_facilities(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,  -- 主担当施設フラグ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, facility_id)
);

-- インデックス
CREATE INDEX idx_user_facility_user_id ON _user_facility(user_id);
CREATE INDEX idx_user_facility_facility_id ON _user_facility(facility_id);
CREATE INDEX idx_user_facility_is_primary ON _user_facility(is_primary) WHERE is_primary = true;

-- 8.2 職員-クラス（_user_class）
CREATE TABLE IF NOT EXISTS _user_class (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES m_users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES m_classes(id) ON DELETE CASCADE,
  is_homeroom BOOLEAN NOT NULL DEFAULT false,  -- 担任フラグ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, class_id)
);

-- インデックス
CREATE INDEX idx_user_class_user_id ON _user_class(user_id);
CREATE INDEX idx_user_class_class_id ON _user_class(class_id);
CREATE INDEX idx_user_class_is_homeroom ON _user_class(is_homeroom) WHERE is_homeroom = true;

-- 8.3 子ども-クラス（_child_class）
CREATE TABLE IF NOT EXISTS _child_class (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES m_classes(id) ON DELETE CASCADE,
  school_year INTEGER NOT NULL,                  -- 年度（例: 2025）
  started_at DATE NOT NULL,                      -- クラス開始日
  ended_at DATE,                                 -- クラス終了日（進級・退所時）
  is_current BOOLEAN NOT NULL DEFAULT true,      -- 現在所属中か
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(child_id, class_id, school_year)
);

-- インデックス
CREATE INDEX idx_child_class_child_id ON _child_class(child_id);
CREATE INDEX idx_child_class_class_id ON _child_class(class_id);
CREATE INDEX idx_child_class_is_current ON _child_class(is_current) WHERE is_current = true;
CREATE INDEX idx_child_class_school_year ON _child_class(school_year);

-- 8.4 観察記録-タグ（_record_tag）
CREATE TABLE IF NOT EXISTS _record_tag (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NOT NULL REFERENCES r_observation(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES m_observation_tags(id) ON DELETE CASCADE,
  
  -- AI自動付与か人間が手動で付けたか
  is_auto_tagged BOOLEAN NOT NULL DEFAULT false,
  confidence_score DECIMAL(3,2),                 -- AI信頼度（0.00 - 1.00）
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(observation_id, tag_id)
);

-- インデックス
CREATE INDEX idx_record_tag_observation_id ON _record_tag(observation_id);
CREATE INDEX idx_record_tag_tag_id ON _record_tag(tag_id);
CREATE INDEX idx_record_tag_is_auto ON _record_tag(is_auto_tagged);
