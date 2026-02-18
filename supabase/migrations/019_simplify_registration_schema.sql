-- ============================================================
-- Migration 019: 会社登録簡素化 & スタッフ記録者選択のスキーマ変更
-- ============================================================

-- 1. m_users.email を nullable に変更
-- メールなしスタッフ登録を可能にする（名前のみのエントリ）
ALTER TABLE m_users ALTER COLUMN email DROP NOT NULL;

-- 2. 記録テーブルに recorded_by カラムを追加
-- created_by: APIを叩いたログインユーザー（監査用、変更なし）
-- recorded_by: 実際に記録を書いたスタッフ（業務上の意味）

ALTER TABLE r_activity ADD COLUMN recorded_by UUID REFERENCES m_users(id);
ALTER TABLE r_observation ADD COLUMN recorded_by UUID REFERENCES m_users(id);
ALTER TABLE r_voice ADD COLUMN recorded_by UUID REFERENCES m_users(id);

-- インデックス
CREATE INDEX idx_activity_recorded_by ON r_activity(recorded_by) WHERE recorded_by IS NOT NULL;
CREATE INDEX idx_observation_recorded_by ON r_observation(recorded_by) WHERE recorded_by IS NOT NULL;
CREATE INDEX idx_voice_recorded_by ON r_voice(recorded_by) WHERE recorded_by IS NOT NULL;
