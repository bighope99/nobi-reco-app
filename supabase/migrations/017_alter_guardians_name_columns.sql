-- m_guardians の名前カラムを TEXT に変更（暗号化対応）
-- AES-256-GCM + Base64url エンコード後のデータは60-80文字程度になるため、VARCHAR(50)では不足
-- 参考: マイグレーション016でphone/emailをTEXTに変更済み

-- family_name カラムを TEXT に変更
ALTER TABLE m_guardians
  ALTER COLUMN family_name TYPE TEXT;

-- given_name カラムを TEXT に変更
ALTER TABLE m_guardians
  ALTER COLUMN given_name TYPE TEXT;

-- family_name_kana カラムを TEXT に変更
ALTER TABLE m_guardians
  ALTER COLUMN family_name_kana TYPE TEXT;

-- given_name_kana カラムを TEXT に変更
ALTER TABLE m_guardians
  ALTER COLUMN given_name_kana TYPE TEXT;

-- コメント更新
COMMENT ON COLUMN m_guardians.family_name IS '姓（AES-256-GCM暗号化、Base64url エンコード）';
COMMENT ON COLUMN m_guardians.given_name IS '名（AES-256-GCM暗号化、Base64url エンコード）';
COMMENT ON COLUMN m_guardians.family_name_kana IS '姓カナ（AES-256-GCM暗号化、Base64url エンコード）';
COMMENT ON COLUMN m_guardians.given_name_kana IS '名カナ（AES-256-GCM暗号化、Base64url エンコード）';
