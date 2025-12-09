# 子ども一覧API仕様書

## 概要
児童台帳の一覧表示・検索・フィルタリング機能のAPI仕様を定義します。
所属中/退所済みのステータス管理、詳細検索、ソート機能を提供します。

---

## エンドポイント一覧

### 1. 子ども一覧取得

**エンドポイント**: `GET /api/children`

**説明**: 施設内の児童一覧を取得します（検索・フィルタ・ソート対応）。

**リクエストパラメータ**:
```typescript
{
  status?: string;          // enrollment_status: enrolled / withdrawn
  class_id?: string;        // クラスフィルター
  search?: string;          // 検索キーワード（名前・かな・保護者名）
  has_allergy?: boolean;    // アレルギー有無フィルター
  has_sibling?: boolean;    // 兄弟有無フィルター
  contract_type?: string;   // regular / temporary / spot

  // ソート
  sort_by?: string;         // name / grade / class_name / contract_type / allergy / siblings
  sort_order?: string;      // asc / desc

  // ページネーション
  limit?: number;           // 取得件数（デフォルト: 50）
  offset?: number;          // オフセット
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    // サマリー
    "summary": {
      "total_children": 25,
      "enrolled_count": 22,
      "withdrawn_count": 3,
      "has_allergy_count": 5,
      "has_sibling_count": 8
    },

    // 児童一覧
    "children": [
      {
        "child_id": "uuid-child-1",
        "name": "田中 陽翔",
        "kana": "たなか はると",
        "gender": "male",            // male / female / other
        "birth_date": "2013-05-15",
        "age": 10,
        "grade": "5年生",
        "class_id": "uuid-class-1",
        "class_name": "ひまわり組",
        "photo_url": "https://...",

        // 在籍状況
        "enrollment_status": "enrolled",  // enrolled / withdrawn
        "contract_type": "regular",       // regular / temporary / spot
        "enrollment_date": "2020-04-01",
        "withdrawal_date": null,

        // 保護者情報
        "parent_name": "田中 優子",
        "parent_phone": "090-1111-2222",
        "parent_email": "[email protected]",

        // 兄弟情報
        "siblings": [
          {
            "child_id": "uuid-child-10",
            "name": "田中 結衣",
            "grade": "1年生"
          }
        ],
        "has_sibling": true,

        // アレルギー
        "has_allergy": true,
        "allergy_detail": "卵、乳製品、ピーナッツ、そば、エビ、カニ、ゴマ",

        // 許可設定
        "photo_allowed": true,
        "report_allowed": true,

        "created_at": "2020-04-01T10:00:00+09:00",
        "updated_at": "2024-01-10T10:00:00+09:00"
      },
      {
        "child_id": "uuid-child-2",
        "name": "鈴木 さくら",
        "kana": "すずき さくら",
        "gender": "female",
        "birth_date": "2015-08-20",
        "age": 8,
        "grade": "3年生",
        "class_id": "uuid-class-2",
        "class_name": "さくら組",
        "photo_url": "https://...",

        "enrollment_status": "enrolled",
        "contract_type": "regular",
        "enrollment_date": "2022-04-01",
        "withdrawal_date": null,

        "parent_name": "鈴木 大輔",
        "parent_phone": "090-3333-4444",
        "parent_email": "[email protected]",

        "siblings": [],
        "has_sibling": false,

        "has_allergy": false,
        "allergy_detail": null,

        "photo_allowed": true,
        "report_allowed": false,

        "created_at": "2022-04-01T10:00:00+09:00",
        "updated_at": "2024-01-10T10:00:00+09:00"
      }
    ],

    // フィルター用データ
    "filters": {
      "classes": [
        {
          "class_id": "uuid-class-1",
          "class_name": "ひまわり組",
          "children_count": 18
        },
        {
          "class_id": "uuid-class-2",
          "class_name": "さくら組",
          "children_count": 7
        }
      ],
      "contract_types": [
        { "type": "regular", "label": "通年", "count": 20 },
        { "type": "temporary", "label": "一時", "count": 3 },
        { "type": "spot", "label": "スポット", "count": 2 }
      ]
    },

    "total": 25,
    "has_more": false
  }
}
```

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス閲覧可）

**エラーレスポンス**:
- `400 Bad Request`: 無効なパラメータ
- `401 Unauthorized`: 認証エラー
- `500 Internal Server Error`: サーバーエラー

---

### 2. 子ども詳細取得

**エンドポイント**: `GET /api/children/:id`

**説明**: 特定の児童の詳細情報を取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    // 基本情報
    "child_id": "uuid-child-1",
    "name": "田中 陽翔",
    "kana": "たなか はると",
    "gender": "male",
    "birth_date": "2013-05-15",
    "age": 10,
    "grade": "5年生",
    "class_id": "uuid-class-1",
    "class_name": "ひまわり組",
    "photo_url": "https://...",

    // 在籍状況
    "enrollment_status": "enrolled",
    "contract_type": "regular",
    "enrollment_date": "2020-04-01",
    "withdrawal_date": null,

    // 保護者情報（詳細）
    "guardians": [
      {
        "guardian_id": "uuid-guardian-1",
        "name": "田中 優子",
        "relationship": "母",        // 母 / 父 / 祖父 / 祖母 / その他
        "phone": "090-1111-2222",
        "email": "[email protected]",
        "is_primary": true,          // 主たる連絡先
        "emergency_contact": true
      },
      {
        "guardian_id": "uuid-guardian-2",
        "name": "田中 健一",
        "relationship": "父",
        "phone": "090-2222-3333",
        "email": "[email protected]",
        "is_primary": false,
        "emergency_contact": true
      }
    ],

    // 兄弟情報（詳細）
    "siblings": [
      {
        "child_id": "uuid-child-10",
        "name": "田中 結衣",
        "kana": "たなか ゆい",
        "grade": "1年生",
        "class_name": "ちゅうりっぷ組",
        "relationship": "妹"
      }
    ],

    // 医療・アレルギー情報
    "medical_info": {
      "has_allergy": true,
      "allergy_detail": "卵、乳製品、ピーナッツ、そば、エビ、カニ、ゴマ",
      "has_medication": false,
      "medication_detail": null,
      "has_chronic_condition": false,
      "chronic_condition_detail": null,
      "special_notes": "アナフィラキシーの可能性あり。エピペン常備。"
    },

    // 許可設定
    "permissions": {
      "photo_allowed": true,
      "report_allowed": true,
      "excursion_allowed": true,
      "swimming_allowed": false
    },

    // 通所予定パターン
    "attendance_schedule": {
      "monday": true,
      "tuesday": true,
      "wednesday": true,
      "thursday": true,
      "friday": false,
      "saturday": false,
      "sunday": false
    },

    // 統計情報
    "statistics": {
      "total_attendance_days": 180,
      "total_observations": 45,
      "total_activities": 120,
      "last_observation_date": "2024-01-10"
    },

    "created_at": "2020-04-01T10:00:00+09:00",
    "updated_at": "2024-01-10T10:00:00+09:00"
  }
}
```

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス閲覧可）

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 児童が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 3. 子どもステータス更新

**エンドポイント**: `PUT /api/children/:id/status`

**説明**: 児童の在籍ステータスを更新します（退所/復帰）。

**リクエストボディ**:
```typescript
{
  "enrollment_status": "withdrawn",  // enrolled / withdrawn
  "withdrawal_date": "2024-03-31",   // 退所日（退所時のみ）
  "withdrawal_reason": "転居のため", // 退所理由（任意）
  "note": "備考"                      // 備考（任意）
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "child_id": "uuid-child-1",
    "child_name": "田中 陽翔",
    "enrollment_status": "withdrawn",
    "withdrawal_date": "2024-03-31",
    "updated_at": "2024-01-15T10:00:00+09:00"
  }
}
```

**処理内容**:
1. `m_children` の `enrollment_status` を更新
2. 退所の場合は `withdrawal_date` を記録
3. 変更履歴を `h_child_status_changes` に記録（Phase 2）

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効なステータス
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: 権限不足（staffユーザー）
- `404 Not Found`: 児童が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

## データベース要件

### 使用テーブル

#### 1. m_children（子どもマスタ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）

-- 追加カラム（必要に応じて）
ALTER TABLE m_children
ADD COLUMN IF NOT EXISTS contract_type VARCHAR(20) DEFAULT 'regular';
-- contract_type: 'regular' | 'temporary' | 'spot'

ALTER TABLE m_children
ADD COLUMN IF NOT EXISTS withdrawal_date DATE;

ALTER TABLE m_children
ADD COLUMN IF NOT EXISTS withdrawal_reason TEXT;

CREATE INDEX idx_m_children_enrollment_status
  ON m_children(enrollment_status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_m_children_contract_type
  ON m_children(contract_type)
  WHERE deleted_at IS NULL;
```

#### 2. m_guardians（保護者マスタ）
```sql
CREATE TABLE IF NOT EXISTS m_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),

  -- 基本情報
  family_name VARCHAR(50) NOT NULL,
  given_name VARCHAR(50) NOT NULL,
  family_name_kana VARCHAR(50),
  given_name_kana VARCHAR(50),

  -- 連絡先
  phone VARCHAR(20),
  email VARCHAR(100),
  address TEXT,

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_m_guardians_facility
  ON m_guardians(facility_id)
  WHERE deleted_at IS NULL;
```

#### 3. _child_guardian（子ども-保護者紐付け）
```sql
CREATE TABLE IF NOT EXISTS _child_guardian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id),
  guardian_id UUID NOT NULL REFERENCES m_guardians(id),

  -- 関係
  relationship VARCHAR(20),  -- 母 / 父 / 祖父 / 祖母 / その他
  is_primary BOOLEAN DEFAULT false,
  emergency_contact BOOLEAN DEFAULT false,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (child_id, guardian_id)
);

CREATE INDEX idx_child_guardian_child
  ON _child_guardian(child_id);

CREATE INDEX idx_child_guardian_guardian
  ON _child_guardian(guardian_id);
```

#### 4. _child_sibling（兄弟関係）
```sql
CREATE TABLE IF NOT EXISTS _child_sibling (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id),
  sibling_id UUID NOT NULL REFERENCES m_children(id),

  -- 関係
  relationship VARCHAR(20),  // 兄 / 姉 / 弟 / 妹

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (child_id, sibling_id),
  CHECK (child_id != sibling_id)
);

CREATE INDEX idx_child_sibling_child
  ON _child_sibling(child_id);

CREATE INDEX idx_child_sibling_sibling
  ON _child_sibling(sibling_id);
```

#### 5. m_classes（クラスマスタ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
```

---

## クエリ例

### 子ども一覧取得クエリ

```sql
-- 児童一覧を取得（検索・フィルタ・ソート対応）
WITH child_siblings AS (
  -- 兄弟情報を集約
  SELECT
    cs.child_id,
    json_agg(
      json_build_object(
        'child_id', sib.id,
        'name', sib.family_name || ' ' || sib.given_name,
        'grade', sib.grade
      )
      ORDER BY sib.birth_date
    ) as siblings,
    COUNT(*) as sibling_count
  FROM _child_sibling cs
  INNER JOIN m_children sib ON cs.sibling_id = sib.id AND sib.deleted_at IS NULL
  GROUP BY cs.child_id
),
child_guardians AS (
  -- 主たる保護者を取得
  SELECT DISTINCT ON (cg.child_id)
    cg.child_id,
    g.family_name || ' ' || g.given_name as parent_name,
    g.phone as parent_phone,
    g.email as parent_email
  FROM _child_guardian cg
  INNER JOIN m_guardians g ON cg.guardian_id = g.id AND g.deleted_at IS NULL
  WHERE cg.is_primary = true
  ORDER BY cg.child_id, cg.created_at
)
SELECT
  c.id as child_id,
  c.family_name || ' ' || c.given_name as name,
  c.family_name_kana || ' ' || c.given_name_kana as kana,
  c.gender,
  c.birth_date,
  EXTRACT(YEAR FROM AGE(c.birth_date)) as age,
  c.grade,
  cl.id as class_id,
  cl.name as class_name,
  c.photo_url,

  -- 在籍状況
  c.enrollment_status,
  c.contract_type,
  c.enrollment_date,
  c.withdrawal_date,

  -- 保護者情報
  cg.parent_name,
  cg.parent_phone,
  cg.parent_email,

  -- 兄弟情報
  COALESCE(csib.siblings, '[]'::json) as siblings,
  COALESCE(csib.sibling_count, 0) > 0 as has_sibling,

  -- アレルギー
  c.has_allergy,
  c.allergy_detail,

  -- 許可設定
  c.photo_allowed,
  c.report_allowed,

  c.created_at,
  c.updated_at

FROM m_children c
INNER JOIN _child_class cc ON c.id = cc.child_id AND cc.is_current = true
INNER JOIN m_classes cl ON cc.class_id = cl.id
LEFT JOIN child_siblings csib ON c.id = csib.child_id
LEFT JOIN child_guardians cg ON c.id = cg.child_id

WHERE c.facility_id = $1  -- facility_id (from session)
  AND c.deleted_at IS NULL
  AND cl.deleted_at IS NULL

  -- フィルター条件
  AND ($2::VARCHAR IS NULL OR c.enrollment_status = $2)  -- status filter
  AND ($3::UUID IS NULL OR cl.id = $3)  -- class_id filter
  AND ($4::VARCHAR IS NULL OR c.contract_type = $4)  -- contract_type filter
  AND ($5::BOOLEAN IS NULL OR c.has_allergy = $5)  -- has_allergy filter
  AND ($6::BOOLEAN IS NULL OR (COALESCE(csib.sibling_count, 0) > 0) = $6)  -- has_sibling filter
  AND (
    $7::VARCHAR IS NULL
    OR c.family_name ILIKE '%' || $7 || '%'
    OR c.given_name ILIKE '%' || $7 || '%'
    OR c.family_name_kana ILIKE '%' || $7 || '%'
    OR c.given_name_kana ILIKE '%' || $7 || '%'
    OR cg.parent_name ILIKE '%' || $7 || '%'
  )  -- search filter

-- ソート（動的に構築）
ORDER BY
  CASE WHEN $8 = 'name' AND $9 = 'asc' THEN c.family_name_kana || c.given_name_kana END ASC,
  CASE WHEN $8 = 'name' AND $9 = 'desc' THEN c.family_name_kana || c.given_name_kana END DESC,
  CASE WHEN $8 = 'grade' AND $9 = 'asc' THEN c.grade END ASC,
  CASE WHEN $8 = 'grade' AND $9 = 'desc' THEN c.grade END DESC,
  c.id

LIMIT $10 OFFSET $11;  -- limit, offset
```

---

## セキュリティ

### アクセス制御

#### 権限管理
本APIは以下の4つのロールに対応しています：

1. **site_admin（サイト管理者）**:
   - 自分の施設のみアクセス可能
   - 用途: 管理ページでの利用（Phase 2で実装予定）

2. **company_admin（会社管理者）**:
   - 自社が運営する全施設にアクセス可能
   - 複数施設を横断的に管理

3. **facility_admin（施設管理者）**:
   - 自施設のみアクセス可能
   - 全クラスのデータを閲覧・編集可能

4. **staff（一般職員）**:
   - 現在: 自施設の全クラスにアクセス可能
   - Phase 2: 担当クラスのみアクセス可能に制限予定（`_user_class`テーブルで管理）
   - ステータス変更は不可（管理者のみ）

#### 施設IDの取得
- `facility_id`はリクエストパラメータではなく、セッション情報（`current_facility_id`）から自動取得します
- これにより、ユーザーが不正な施設IDを指定することを防止します
- **複数施設の切り替え機能はPhase 2で実装予定**

#### データ分離
- RLS（Row Level Security）で施設レベルのデータを分離
- クエリ実行時に`facility_id`でフィルタリング
- staffユーザーの場合、Phase 2で`_user_class`テーブルを使用したクラス単位の制限を実装予定

#### エラーハンドリング戦略
- アクセス権限がない場合: `404 Not Found`を返す
- 理由: `403 Forbidden`ではリソースの存在を推測可能になるため、セキュリティ上`404`を優先

### 個人情報保護
- 保護者の連絡先は暗号化して保存（Phase 2）
- アレルギー情報は厳重に管理
- 退所児童の情報は一定期間後に匿名化（Phase 3）

---

## パフォーマンス考慮事項

### インデックス
```sql
-- 上記のテーブル定義に含まれるインデックスで対応可能
```

### キャッシュ戦略
- 児童一覧: 5分キャッシュ
- 児童詳細: 10分キャッシュ
- フィルター用マスタ: 1時間キャッシュ

---

## エラーハンドリング

### 共通エラーコード
```typescript
{
  "CHILD_NOT_FOUND": "児童が見つかりません",
  "INVALID_STATUS": "無効なステータスです",
  "WITHDRAWAL_DATE_REQUIRED": "退所日を指定してください",
  "CANNOT_CHANGE_STATUS": "ステータスを変更する権限がありません"
}
```

---

## 今後の拡張予定

### Phase 2
- ステータス変更履歴の記録（`h_child_status_changes`）
- 保護者情報の暗号化
- 複数保護者の管理
- 兄弟の自動検出・提案

### Phase 3
- 顔写真のAI検索
- 退所児童の匿名化
- CSVエクスポート
- 一括編集機能

---

**作成日**: 2025-01-09
**最終更新**: 2025-01-09
**関連ドキュメント**:
- `03_database.md` - データベース設計
- `04_api.md` - API基本設計
