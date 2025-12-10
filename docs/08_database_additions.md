# データベース追加・変更仕様書

## 📋 目次

1. [変更概要](#1-変更概要)
2. [保護者管理テーブル](#2-保護者管理テーブル)
3. [レポート管理テーブル](#3-レポート管理テーブル)
4. [マイグレーション手順](#4-マイグレーション手順)
5. [データ移行スクリプト](#5-データ移行スクリプト)

---

## 1. 変更概要

### 1.1 背景

既存の`m_children`テーブルには保護者情報が直接格納されていましたが、以下の要件に対応するため、保護者マスタテーブルと中間テーブルを新規作成します：

- **複数保護者対応**: 1児童に対して複数の保護者（父、母、祖父母等）を登録可能に
- **保護者情報の一元管理**: 兄弟姉妹で同じ保護者情報を共有
- **緊急連絡先の優先順位管理**: 主たる連絡先、緊急連絡先のフラグ管理
- **レポート保存・履歴管理**: 生成したレポートをDBに保存し、共有履歴を記録

### 1.2 追加テーブル一覧

| テーブル名 | 種別 | 説明 |
|-----------|------|------|
| `m_guardians` | マスタ | 保護者マスタ |
| `_child_guardian` | 中間 | 子ども-保護者の紐付け |
| `_child_sibling` | 中間 | 子ども-兄弟姉妹の紐付け |
| `r_report` | 記録 | 生成されたレポート |
| `h_report_share` | 履歴 | レポート共有履歴 |

### 1.3 既存テーブルの変更

| テーブル名 | 変更内容 |
|-----------|----------|
| `m_children` | 保護者関連カラムを非推奨化（DEPRECATED）<br>※互換性のため削除はせず残す |

---

## 2. 保護者管理テーブル

### 2.1 保護者マスタ（`m_guardians`）

**目的**: 保護者の基本情報を一元管理

```sql
CREATE TABLE IF NOT EXISTS m_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),

  -- 基本情報
  family_name VARCHAR(50) NOT NULL,              -- 姓（漢字）
  given_name VARCHAR(50) NOT NULL,               -- 名（漢字）
  family_name_kana VARCHAR(50),                  -- 姓（カナ）
  given_name_kana VARCHAR(50),                   -- 名（カナ）

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

-- インデックス
CREATE INDEX idx_guardians_facility_id ON m_guardians(facility_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_guardians_phone ON m_guardians(phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_guardians_email ON m_guardians(email) WHERE deleted_at IS NULL;

-- フルテキスト検索用インデックス（名前検索）
CREATE INDEX idx_guardians_name_search ON m_guardians
  USING gin(to_tsvector('japanese', family_name || ' ' || given_name));

-- コメント
COMMENT ON TABLE m_guardians IS '保護者マスタ';
COMMENT ON COLUMN m_guardians.facility_id IS '所属施設ID';
COMMENT ON COLUMN m_guardians.phone IS '電話番号（暗号化推奨）';
COMMENT ON COLUMN m_guardians.email IS 'メールアドレス（暗号化推奨）';
```

---

### 2.2 子ども-保護者（`_child_guardian`）

**目的**: 子どもと保護者の多対多の関係を管理

```sql
CREATE TABLE IF NOT EXISTS _child_guardian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES m_guardians(id) ON DELETE CASCADE,

  -- 関係
  relationship VARCHAR(20),                      -- 父 / 母 / 祖父 / 祖母 / その他
  is_primary BOOLEAN NOT NULL DEFAULT false,     -- 主たる連絡先
  is_emergency_contact BOOLEAN NOT NULL DEFAULT false,  -- 緊急連絡先

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(child_id, guardian_id)
);

-- インデックス
CREATE INDEX idx_child_guardian_child_id ON _child_guardian(child_id);
CREATE INDEX idx_child_guardian_guardian_id ON _child_guardian(guardian_id);
CREATE INDEX idx_child_guardian_is_primary ON _child_guardian(is_primary) WHERE is_primary = true;
CREATE INDEX idx_child_guardian_is_emergency ON _child_guardian(is_emergency_contact) WHERE is_emergency_contact = true;

-- コメント
COMMENT ON TABLE _child_guardian IS '子ども-保護者の紐付けテーブル';
COMMENT ON COLUMN _child_guardian.relationship IS '続柄: 父 / 母 / 祖父 / 祖母 / その他';
COMMENT ON COLUMN _child_guardian.is_primary IS '主たる連絡先フラグ（1児童につき1人のみtrueを推奨）';
COMMENT ON COLUMN _child_guardian.is_emergency_contact IS '緊急連絡先フラグ';
```

**制約**:
- 1児童に対して`is_primary = true`の保護者は1人のみを推奨（アプリケーションレベルで制御）
- 緊急連絡先（`is_emergency_contact = true`）は複数設定可能

---

### 2.3 子ども-兄弟姉妹（`_child_sibling`）

**目的**: 兄弟姉妹の関係を明示的に管理

```sql
CREATE TABLE IF NOT EXISTS _child_sibling (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id) ON DELETE CASCADE,
  sibling_id UUID NOT NULL REFERENCES m_children(id) ON DELETE CASCADE,

  -- 関係
  relationship VARCHAR(20),                      -- 兄 / 姉 / 弟 / 妹

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(child_id, sibling_id),
  CHECK (child_id != sibling_id)
);

-- インデックス
CREATE INDEX idx_child_sibling_child_id ON _child_sibling(child_id);
CREATE INDEX idx_child_sibling_sibling_id ON _child_sibling(sibling_id);

-- コメント
COMMENT ON TABLE _child_sibling IS '子ども-兄弟姉妹の紐付けテーブル';
COMMENT ON COLUMN _child_sibling.relationship IS '続柄: 兄 / 姉 / 弟 / 妹';
```

**注意**:
- 双方向の登録が必要（例: AがBの兄の場合、BもAの弟として登録）
- `m_children.sibling_id`は非推奨（DEPRECATED）となり、このテーブルで管理

---

## 3. レポート管理テーブル

### 3.1 レポート（`r_report`）

**目的**: 生成されたレポートを保存・管理

```sql
CREATE TABLE IF NOT EXISTS r_report (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),
  child_id UUID NOT NULL REFERENCES m_children(id),

  -- レポート情報
  report_title VARCHAR(200) NOT NULL,            -- レポートタイトル
  report_type VARCHAR(50) NOT NULL,              -- レポート種別（monthly / quarterly / annual / custom）
  period_start DATE NOT NULL,                    -- 対象期間（開始）
  period_end DATE NOT NULL,                      -- 対象期間（終了）

  -- ファイル情報
  file_url TEXT NOT NULL,                        -- PDFファイルURL（Supabase Storage）
  file_size_bytes BIGINT,                        -- ファイルサイズ（バイト）
  thumbnail_url TEXT,                            -- サムネイルURL

  -- 生成情報
  template_id UUID,                              -- 使用テンプレートID（将来拡張用）
  generated_by UUID NOT NULL REFERENCES m_users(id),  -- 生成者
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- ステータス
  is_finalized BOOLEAN NOT NULL DEFAULT false,   -- 確定フラグ
  finalized_at TIMESTAMP WITH TIME ZONE,         -- 確定日時

  -- 共有設定
  is_shareable BOOLEAN NOT NULL DEFAULT true,    -- 共有可能フラグ
  expiration_date DATE,                          -- 有効期限

  -- メタデータ
  observation_count INTEGER,                     -- 含まれる観察記録数
  photo_count INTEGER,                           -- 含まれる写真数
  metadata JSONB,                                -- その他のメタデータ

  -- 共通カラム
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_report_facility_id ON r_report(facility_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_report_child_id ON r_report(child_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_report_generated_by ON r_report(generated_by);
CREATE INDEX idx_report_generated_at ON r_report(generated_at);
CREATE INDEX idx_report_period ON r_report(period_start, period_end) WHERE deleted_at IS NULL;
CREATE INDEX idx_report_type ON r_report(report_type) WHERE deleted_at IS NULL;

-- コメント
COMMENT ON TABLE r_report IS '生成されたレポート';
COMMENT ON COLUMN r_report.report_type IS 'レポート種別: monthly / quarterly / annual / custom';
COMMENT ON COLUMN r_report.is_finalized IS '確定フラグ（確定後は編集不可）';
COMMENT ON COLUMN r_report.is_shareable IS '共有可能フラグ';
```

**レポート種別**:
- `monthly`: 月次レポート
- `quarterly`: 四半期レポート
- `annual`: 年次レポート
- `custom`: カスタム期間レポート

---

### 3.2 レポート共有履歴（`h_report_share`）

**目的**: レポートの共有履歴を記録（監査ログ）

```sql
CREATE TABLE IF NOT EXISTS h_report_share (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES r_report(id) ON DELETE CASCADE,

  -- 共有情報
  shared_by UUID NOT NULL REFERENCES m_users(id),     -- 共有者（職員）
  shared_to VARCHAR(255),                             -- 共有先（保護者メールアドレス等）
  share_method VARCHAR(50) NOT NULL,                  -- 共有方法（email / download / print）

  -- 共有詳細
  share_note TEXT,                                    -- 共有時のメモ
  access_count INTEGER DEFAULT 0,                     -- アクセス回数（将来の保護者ポータル用）
  last_accessed_at TIMESTAMP WITH TIME ZONE,          -- 最終アクセス日時

  -- 共有日時
  shared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_report_share_report_id ON h_report_share(report_id);
CREATE INDEX idx_report_share_shared_by ON h_report_share(shared_by);
CREATE INDEX idx_report_share_shared_at ON h_report_share(shared_at);
CREATE INDEX idx_report_share_shared_to ON h_report_share(shared_to);

-- コメント
COMMENT ON TABLE h_report_share IS 'レポート共有履歴（監査ログ）';
COMMENT ON COLUMN h_report_share.share_method IS '共有方法: email / download / print';
COMMENT ON COLUMN h_report_share.access_count IS 'アクセス回数（将来の保護者ポータル用）';
```

**共有方法**:
- `email`: メール送信
- `download`: 職員がダウンロード
- `print`: 印刷

---

## 4. マイグレーション手順

### 4.1 実行順序

```bash
# Step 1: 新規テーブル作成
psql -U your_user -d your_database -f 01_create_guardians_tables.sql

# Step 2: レポートテーブル作成
psql -U your_user -d your_database -f 02_create_report_tables.sql

# Step 3: 既存データの移行
psql -U your_user -d your_database -f 03_migrate_existing_data.sql

# Step 4: データ整合性チェック
psql -U your_user -d your_database -f 04_data_validation.sql
```

### 4.2 01_create_guardians_tables.sql

```sql
-- 保護者マスタテーブル作成
CREATE TABLE IF NOT EXISTS m_guardians (
  -- （上記の定義を参照）
);

-- 子ども-保護者紐付けテーブル作成
CREATE TABLE IF NOT EXISTS _child_guardian (
  -- （上記の定義を参照）
);

-- 子ども-兄弟姉妹紐付けテーブル作成
CREATE TABLE IF NOT EXISTS _child_sibling (
  -- （上記の定義を参照）
);

-- インデックス作成
-- （上記の定義を参照）

-- 実行ログ
SELECT 'Guardians tables created successfully' AS status;
```

### 4.3 02_create_report_tables.sql

```sql
-- レポートテーブル作成
CREATE TABLE IF NOT EXISTS r_report (
  -- （上記の定義を参照）
);

-- レポート共有履歴テーブル作成
CREATE TABLE IF NOT EXISTS h_report_share (
  -- （上記の定義を参照）
);

-- インデックス作成
-- （上記の定義を参照）

-- 実行ログ
SELECT 'Report tables created successfully' AS status;
```

### 4.4 ロールバック手順

```sql
-- テーブル削除（逆順）
DROP TABLE IF EXISTS h_report_share CASCADE;
DROP TABLE IF EXISTS r_report CASCADE;
DROP TABLE IF EXISTS _child_sibling CASCADE;
DROP TABLE IF EXISTS _child_guardian CASCADE;
DROP TABLE IF EXISTS m_guardians CASCADE;

-- 実行ログ
SELECT 'Rollback completed' AS status;
```

---

## 5. データ移行スクリプト

### 5.1 03_migrate_existing_data.sql

**目的**: 既存の`m_children`テーブルから保護者情報を`m_guardians`に移行

```sql
BEGIN;

-- Step 1: 既存の保護者情報から保護者マスタを作成
INSERT INTO m_guardians (
  id,
  facility_id,
  family_name,
  given_name,
  phone,
  email,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid() AS id,
  c.facility_id,
  -- 氏名を分割（仮処理: スペースで分割、なければ全体を姓として扱う）
  CASE
    WHEN position(' ' in c.parent_name) > 0
    THEN substring(c.parent_name from 1 for position(' ' in c.parent_name) - 1)
    ELSE c.parent_name
  END AS family_name,
  CASE
    WHEN position(' ' in c.parent_name) > 0
    THEN substring(c.parent_name from position(' ' in c.parent_name) + 1)
    ELSE ''
  END AS given_name,
  c.parent_phone AS phone,
  c.parent_email AS email,
  NOW() AS created_at,
  NOW() AS updated_at
FROM m_children c
WHERE c.deleted_at IS NULL
  AND c.parent_name IS NOT NULL
  AND c.parent_name != ''
ON CONFLICT DO NOTHING;

-- Step 2: 子どもと保護者の紐付けを作成
WITH matched_guardians AS (
  SELECT
    c.id AS child_id,
    g.id AS guardian_id,
    c.parent_name,
    c.parent_phone,
    c.parent_email
  FROM m_children c
  LEFT JOIN m_guardians g
    ON c.facility_id = g.facility_id
    AND (
      -- 電話番号またはメールアドレスでマッチング
      (c.parent_phone IS NOT NULL AND g.phone = c.parent_phone)
      OR
      (c.parent_email IS NOT NULL AND g.email = c.parent_email)
    )
  WHERE c.deleted_at IS NULL
    AND g.deleted_at IS NULL
    AND (c.parent_name IS NOT NULL AND c.parent_name != '')
)
INSERT INTO _child_guardian (
  child_id,
  guardian_id,
  relationship,
  is_primary,
  is_emergency_contact,
  created_at,
  updated_at
)
SELECT
  child_id,
  guardian_id,
  '保護者' AS relationship,  -- デフォルト値
  true AS is_primary,
  true AS is_emergency_contact,
  NOW() AS created_at,
  NOW() AS updated_at
FROM matched_guardians
WHERE guardian_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 3: 兄弟姉妹の紐付けを作成（sibling_idが設定されている場合）
INSERT INTO _child_sibling (
  child_id,
  sibling_id,
  relationship,
  created_at
)
SELECT
  c1.id AS child_id,
  c1.sibling_id AS sibling_id,
  '兄弟姉妹' AS relationship,  -- デフォルト値
  NOW() AS created_at
FROM m_children c1
WHERE c1.deleted_at IS NULL
  AND c1.sibling_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM m_children c2
    WHERE c2.id = c1.sibling_id
      AND c2.deleted_at IS NULL
  )
ON CONFLICT DO NOTHING;

-- Step 4: 逆方向の兄弟姉妹紐付けも作成（双方向）
INSERT INTO _child_sibling (
  child_id,
  sibling_id,
  relationship,
  created_at
)
SELECT
  c1.sibling_id AS child_id,
  c1.id AS sibling_id,
  '兄弟姉妹' AS relationship,
  NOW() AS created_at
FROM m_children c1
WHERE c1.deleted_at IS NULL
  AND c1.sibling_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM m_children c2
    WHERE c2.id = c1.sibling_id
      AND c2.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM _child_sibling cs
    WHERE cs.child_id = c1.sibling_id
      AND cs.sibling_id = c1.id
  )
ON CONFLICT DO NOTHING;

COMMIT;

-- 実行ログ
SELECT 'Data migration completed' AS status;
SELECT COUNT(*) AS guardians_created FROM m_guardians WHERE deleted_at IS NULL;
SELECT COUNT(*) AS child_guardian_links FROM _child_guardian;
SELECT COUNT(*) AS sibling_links FROM _child_sibling;
```

### 5.2 04_data_validation.sql

**目的**: データ整合性チェック

```sql
-- 1. 保護者が紐づいていない子どものチェック
SELECT
  c.id,
  c.family_name || ' ' || c.given_name AS child_name,
  c.parent_name,
  c.parent_email
FROM m_children c
LEFT JOIN _child_guardian cg ON c.id = cg.child_id
WHERE c.deleted_at IS NULL
  AND c.parent_name IS NOT NULL
  AND c.parent_name != ''
  AND cg.id IS NULL
ORDER BY c.family_name;

-- 2. 主たる連絡先が複数設定されている子どものチェック
SELECT
  child_id,
  COUNT(*) AS primary_guardian_count
FROM _child_guardian
WHERE is_primary = true
GROUP BY child_id
HAVING COUNT(*) > 1;

-- 3. 保護者が存在しない紐付けのチェック
SELECT
  cg.id,
  cg.child_id,
  cg.guardian_id
FROM _child_guardian cg
LEFT JOIN m_guardians g ON cg.guardian_id = g.id
WHERE g.id IS NULL;

-- 4. 兄弟姉妹の双方向チェック
SELECT
  cs1.child_id,
  cs1.sibling_id
FROM _child_sibling cs1
WHERE NOT EXISTS (
  SELECT 1 FROM _child_sibling cs2
  WHERE cs2.child_id = cs1.sibling_id
    AND cs2.sibling_id = cs1.child_id
);

-- 実行ログ
SELECT 'Data validation completed' AS status;
```

---

## 6. API仕様への影響

### 6.1 影響を受けるAPI

以下のAPIエンドポイントは保護者情報の取得方法が変更されます：

| エンドポイント | 変更内容 |
|---------------|----------|
| `GET /api/children` | 子ども一覧に保護者情報（複数対応）を含める |
| `GET /api/children/:id` | 子ども詳細に全保護者のリストを含める |
| `POST /api/children` | 子ども登録時に保護者情報も同時登録 |
| `PUT /api/children/:id` | 保護者情報の更新API追加 |
| `GET /api/dashboard/summary` | ダッシュボードで主たる連絡先を表示 |

詳細は別途APIドキュメントを更新してください。

### 6.2 新規APIエンドポイント

以下のAPIエンドポイントを新規追加してください：

```
POST   /api/guardians              保護者登録
GET    /api/guardians/:id          保護者詳細取得
PUT    /api/guardians/:id          保護者情報更新
DELETE /api/guardians/:id          保護者削除（論理削除）
GET    /api/children/:id/guardians 子どもの保護者一覧取得
POST   /api/children/:id/guardians 子どもに保護者を追加
DELETE /api/children/:id/guardians/:guardian_id 子どもから保護者を削除

GET    /api/reports                レポート一覧取得
POST   /api/reports                レポート生成・保存
GET    /api/reports/:id            レポート詳細取得
DELETE /api/reports/:id            レポート削除（論理削除）
POST   /api/reports/:id/share      レポート共有
GET    /api/reports/:id/history    レポート共有履歴取得
```

---

## 7. 今後の拡張

### 7.1 保護者ポータル機能（Phase 3以降）

- 保護者用の認証テーブル追加
- レポートのオンライン閲覧機能
- アクセスカウント機能の実装

### 7.2 レポートテンプレート管理（Phase 2以降）

```sql
CREATE TABLE IF NOT EXISTS s_report_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID REFERENCES m_facilities(id),
  template_name VARCHAR(100) NOT NULL,
  template_type VARCHAR(50) NOT NULL,
  layout_config JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
```

---

**作成日**: 2025年1月10日
**最終更新**: 2025年1月10日
**管理者**: プロジェクトリーダー
