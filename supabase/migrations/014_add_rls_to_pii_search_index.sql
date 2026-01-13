-- RLSポリシーをs_pii_search_indexテーブルに追加
-- 施設間のPII検索インデックス漏洩を防止

-- RLSを有効化
ALTER TABLE s_pii_search_index ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーのアクセスポリシー
-- entity_typeがchildの場合、m_childrenのfacility_idでフィルタ
-- entity_typeがguardianの場合、m_guardiansのfacility_idでフィルタ
-- JWTのapp_metadata.current_facility_idと一致する施設のPII検索インデックスのみアクセス可能

CREATE POLICY "Users can access search index for their facility children"
ON s_pii_search_index
FOR ALL
TO authenticated
USING (
  (entity_type = 'child' AND EXISTS (
    SELECT 1 FROM m_children c
    WHERE c.id = s_pii_search_index.entity_id
    AND c.facility_id::text = (auth.jwt() -> 'app_metadata' ->> 'current_facility_id')
  ))
  OR
  (entity_type = 'guardian' AND EXISTS (
    SELECT 1 FROM m_guardians g
    WHERE g.id = s_pii_search_index.entity_id
    AND g.facility_id::text = (auth.jwt() -> 'app_metadata' ->> 'current_facility_id')
  ))
)
WITH CHECK (
  (entity_type = 'child' AND EXISTS (
    SELECT 1 FROM m_children c
    WHERE c.id = s_pii_search_index.entity_id
    AND c.facility_id::text = (auth.jwt() -> 'app_metadata' ->> 'current_facility_id')
  ))
  OR
  (entity_type = 'guardian' AND EXISTS (
    SELECT 1 FROM m_guardians g
    WHERE g.id = s_pii_search_index.entity_id
    AND g.facility_id::text = (auth.jwt() -> 'app_metadata' ->> 'current_facility_id')
  ))
);

-- service_roleは全アクセス許可
-- バックグラウンド処理やシステム管理タスクで必要
CREATE POLICY "Service role has full access to search index"
ON s_pii_search_index
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- コメント
COMMENT ON POLICY "Users can access search index for their facility children" ON s_pii_search_index IS
'認証済みユーザーは、自分の施設（JWT app_metadata.current_facility_id）に所属する児童・保護者のPII検索インデックスのみアクセス可能';

COMMENT ON POLICY "Service role has full access to search index" ON s_pii_search_index IS
'service_roleは全てのPII検索インデックスに無制限でアクセス可能（システム管理用）';
