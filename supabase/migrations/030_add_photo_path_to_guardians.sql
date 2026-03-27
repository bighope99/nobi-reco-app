-- m_guardians に顔写真のストレージパスを追加
-- バケット: guardian-photos（private）
-- 表示時は署名URL経由でアクセスする

ALTER TABLE m_guardians
  ADD COLUMN IF NOT EXISTS photo_path TEXT;

COMMENT ON COLUMN m_guardians.photo_path IS '保護者顔写真のストレージパス（guardian-photosバケット内のパス）。公開URLではなくパスのみ保存し、署名URLで表示する';
