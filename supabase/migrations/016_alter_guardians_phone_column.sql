-- m_guardians.phone カラムのサイズを拡張
-- 暗号化された電話番号はVARCHAR(20)を超えるため、TEXTに変更

-- phone カラムを TEXT に変更（暗号化された値を格納するため）
ALTER TABLE m_guardians
  ALTER COLUMN phone TYPE TEXT;

-- email カラムも同様に TEXT に変更（暗号化対応）
ALTER TABLE m_guardians
  ALTER COLUMN email TYPE TEXT;

-- コメント更新
COMMENT ON COLUMN m_guardians.phone IS '電話番号（AES-256-GCM暗号化、Base64url エンコード）';
COMMENT ON COLUMN m_guardians.email IS 'メールアドレス（AES-256-GCM暗号化、Base64url エンコード）';
