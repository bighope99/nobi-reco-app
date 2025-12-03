-- 記録テーブル作成

-- 5.1 活動記録（r_activity）
CREATE TABLE IF NOT EXISTS r_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),
  class_id UUID REFERENCES m_classes(id),        -- クラス単位の活動の場合
  
  -- 記録日時
  activity_date DATE NOT NULL,                   -- 活動日（今日の日付）
  
  -- 活動内容
  title VARCHAR(200),                            -- タイトル（例: 公園で外遊び）
  content TEXT NOT NULL,                         -- 活動内容（本文）
  snack TEXT,                                    -- おやつ
  
  -- 写真（JSONBで複数枚保存）
  photos JSONB,                                  -- [{url: "...", caption: "..."}, ...]
  
  -- 記録者情報
  created_by UUID NOT NULL REFERENCES m_users(id),
  updated_by UUID REFERENCES m_users(id),
  
  -- リアルタイム編集用
  last_edited_by UUID REFERENCES m_users(id),    -- 最後に編集した人
  last_edited_at TIMESTAMP WITH TIME ZONE,       -- 最後の編集日時
  
  -- 共通カラム
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_activity_facility_id ON r_activity(facility_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_activity_class_id ON r_activity(class_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_activity_date ON r_activity(activity_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_activity_created_by ON r_activity(created_by);
CREATE INDEX idx_activity_facility_date ON r_activity(facility_id, activity_date) WHERE deleted_at IS NULL;

-- 5.2 子ども観察記録（r_observation）
CREATE TABLE IF NOT EXISTS r_observation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id),
  activity_id UUID REFERENCES r_activity(id),    -- 元になった活動記録（ある場合）
  
  -- 記録日時
  observation_date DATE NOT NULL,                -- 観察日
  
  -- 観察内容
  content TEXT NOT NULL,                         -- 観察内容（本文）
  is_fact BOOLEAN DEFAULT true,                  -- 事実か所感か（AIで判定）
  
  -- 写真
  photos JSONB,                                  -- [{url: "...", caption: "..."}, ...]
  
  -- 記録者情報
  created_by UUID NOT NULL REFERENCES m_users(id),
  updated_by UUID REFERENCES m_users(id),
  
  -- 共通カラム
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_observation_child_id ON r_observation(child_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_observation_activity_id ON r_observation(activity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_observation_date ON r_observation(observation_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_observation_created_by ON r_observation(created_by);
CREATE INDEX idx_observation_child_date ON r_observation(child_id, observation_date) WHERE deleted_at IS NULL;

-- 5.3 子どもの声記録（r_voice）
CREATE TABLE IF NOT EXISTS r_voice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id),
  
  -- 記録日時
  voice_date DATE NOT NULL,                      -- 記録日
  
  -- 子どもの声
  content TEXT NOT NULL,                         -- 子どもが言ったこと・意見
  context TEXT,                                  -- どんな場面での発言か
  
  -- 記録者情報
  created_by UUID NOT NULL REFERENCES m_users(id),
  
  -- 共通カラム
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_voice_child_id ON r_voice(child_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_voice_date ON r_voice(voice_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_voice_child_date ON r_voice(child_id, voice_date) WHERE deleted_at IS NULL;

-- 5.4 日次出席予定（r_daily_attendance）
CREATE TABLE IF NOT EXISTS r_daily_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),
  child_id UUID NOT NULL REFERENCES m_children(id),
  
  -- 出席予定日
  attendance_date DATE NOT NULL,
  
  -- 出席ステータス
  status attendance_status_type NOT NULL DEFAULT 'scheduled',
  
  -- 備考（欠席理由など）
  note TEXT,
  
  -- 登録者
  created_by UUID NOT NULL REFERENCES m_users(id),
  updated_by UUID REFERENCES m_users(id),
  
  -- 共通カラム
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(child_id, attendance_date)
);

-- インデックス
CREATE INDEX idx_daily_attendance_facility_date ON r_daily_attendance(facility_id, attendance_date);
CREATE INDEX idx_daily_attendance_child_id ON r_daily_attendance(child_id);
CREATE INDEX idx_daily_attendance_date ON r_daily_attendance(attendance_date);
CREATE INDEX idx_daily_attendance_status ON r_daily_attendance(status);
