# 子ども観察記録API仕様書

## 概要
特定の児童に対する観察記録の入力・管理に使用するAPI群の仕様を定義します。
活動記録とは異なり、1人の児童に対する観察やエピソードを個別に記録する機能です。

---

## エンドポイント一覧

### 1. 観察記録の作成

**エンドポイント**: `POST /api/observations`

**説明**: 特定の児童に対する観察記録を作成します。

**リクエストボディ**:
```typescript
{
  "child_id": "uuid-child-1",
  "observation_date": "2023-10-27",        // 観察日（YYYY-MM-DD）
  "category": "社会性・コミュニケーション",  // 観察カテゴリ
  "content": "お友達と協力して絵を描いていました。",  // 観察内容
  "tags": ["id-tag-1", "id-tag-2"]         // タグ（任意）
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "observation_id": "uuid-obs-1",
    "child_id": "uuid-child-1",
    "observation_date": "2023-10-27",
    "category": "社会性・コミュニケーション",
    "content": "お友達と協力して絵を描いていました。",
    "created_at": "2023-10-27T14:30:00+09:00"
  }
}
```

**処理内容**:
1. `r_observation` テーブルに記録を作成
2. タグが指定されている場合は `_record_tag` で紐づけ
3. 作成者情報（`created_by`）はセッションから取得

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス操作可）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、不正な日付、無効なカテゴリ
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 児童が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 2. 観察記録一覧取得

**エンドポイント**: `GET /api/observations`

**説明**: 特定の児童の観察記録一覧を取得します。

**リクエストパラメータ**:
```typescript
{
  child_id: string;         // 児童ID
  category?: string;        // カテゴリフィルター
  start_date?: string;      // 開始日（YYYY-MM-DD）
  end_date?: string;        // 終了日（YYYY-MM-DD）
  limit?: number;           // 取得件数（デフォルト: 20）
  offset?: number;          // オフセット（ページネーション）
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "child": {
      "child_id": "uuid-child-1",
      "name": "田中 陽翔",
      "class_name": "ひまわり組",
      "grade": "6年生",
      "photo_url": "https://..."
    },
    "observations": [
      {
        "observation_id": "uuid-obs-1",
        "observation_date": "2024-01-14",
        "category": "社会性・コミュニケーション",
        "content": "お友達と協力して絵を描いていました。",
        "tags": [
          {
            "tag_id": "uuid-tag-1",
            "tag_name": "協調性"
          }
        ],
        "created_by": "田中先生",
        "created_at": "2024-01-14T15:30:00+09:00"
      },
      {
        "observation_id": "uuid-obs-2",
        "observation_date": "2024-01-13",
        "category": "身体・運動",
        "content": "縄跳びで10回連続で跳べるようになりました。",
        "tags": [
          {
            "tag_id": "uuid-tag-2",
            "tag_name": "挑戦"
          }
        ],
        "created_by": "佐藤先生",
        "created_at": "2024-01-13T14:00:00+09:00"
      }
    ],
    "total": 45,
    "has_more": true
  }
}
```

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス閲覧可）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 児童が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 3. 観察記録の詳細取得

**エンドポイント**: `GET /api/observations/:id`

**説明**: 特定の観察記録の詳細を取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "observation_id": "uuid-obs-1",
    "child_id": "uuid-child-1",
    "child_name": "田中 陽翔",
    "observation_date": "2024-01-14",
    "category": "社会性・コミュニケーション",
    "content": "お友達と協力して絵を描いていました。",
    "tags": [
      {
        "tag_id": "uuid-tag-1",
        "tag_name": "協調性"
      }
    ],
    "created_by": "uuid-user-1",
    "created_by_name": "田中先生",
    "created_at": "2024-01-14T15:30:00+09:00",
    "updated_at": "2024-01-14T15:30:00+09:00"
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
- `404 Not Found`: 記録が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 4. 観察記録の更新

**エンドポイント**: `PUT /api/observations/:id`

**説明**: 既存の観察記録を更新します。

**リクエストボディ**:
```typescript
{
  "observation_date": "2024-01-14",
  "category": "社会性・コミュニケーション",
  "content": "お友達と協力して絵を描いていました。（修正）",
  "tags": ["id-tag-1", "id-tag-2"]
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "observation_id": "uuid-obs-1",
    "updated_at": "2024-01-14T16:00:00+09:00"
  }
}
```

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 自分が作成した記録のみ（※Phase 2で実装予定、現在は全記録編集可）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、不正な日付
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 記録が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 5. 観察記録の削除

**エンドポイント**: `DELETE /api/observations/:id`

**説明**: 観察記録を削除します（論理削除）。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "observation_id": "uuid-obs-1",
    "deleted_at": "2024-01-14T17:00:00+09:00"
  }
}
```

**処理内容**:
1. `r_observation` の `deleted_at` を更新
2. 紐づく `_record_tag` も削除

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 自分が作成した記録のみ（※Phase 2で実装予定、現在は全記録削除可）

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 記録が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 6. 観察カテゴリマスタ取得

**エンドポイント**: `GET /api/observations/categories`

**説明**: 観察記録で使用可能なカテゴリ一覧を取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "social",
        "name": "社会性・コミュニケーション",
        "display_order": 1
      },
      {
        "id": "physical",
        "name": "身体・運動",
        "display_order": 2
      },
      {
        "id": "language",
        "name": "言語・表現",
        "display_order": 3
      },
      {
        "id": "cognitive",
        "name": "認知・思考",
        "display_order": 4
      },
      {
        "id": "lifestyle",
        "name": "生活習慣",
        "display_order": 5
      },
      {
        "id": "other",
        "name": "その他",
        "display_order": 6
      }
    ]
  }
}
```

**キャッシュ**: 1時間キャッシュ推奨（マスタデータのため更新頻度が低い）

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `500 Internal Server Error`: サーバーエラー

---

## データベース要件

### 使用テーブル

#### 1. r_observation（観察記録）
```sql
-- 既存のテーブル構造（03_database.mdを参照）

-- カテゴリカラム追加（必要に応じて）
ALTER TABLE r_observation
ADD COLUMN IF NOT EXISTS category VARCHAR(100);

CREATE INDEX idx_r_observation_category
  ON r_observation(category)
  WHERE deleted_at IS NULL;
```

#### 2. m_children（子どもマスタ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
```

#### 3. _record_tag（記録-タグ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
```

#### 4. m_observation_tags（タグマスタ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
```

#### 5. m_observation_categories（観察カテゴリマスタ）- 新規テーブル（将来実装）
```sql
CREATE TABLE IF NOT EXISTS m_observation_categories (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 初期データ
INSERT INTO m_observation_categories (id, name, display_order) VALUES
  ('social', '社会性・コミュニケーション', 1),
  ('physical', '身体・運動', 2),
  ('language', '言語・表現', 3),
  ('cognitive', '認知・思考', 4),
  ('lifestyle', '生活習慣', 5),
  ('other', 'その他', 6);
```

**備考**: MVP段階では不要。カテゴリはハードコードで対応。Phase 2でテーブル化を検討。

---

## クエリ例

### 観察記録一覧取得クエリ

```sql
-- 児童の観察記録一覧を取得
SELECT
  ro.id as observation_id,
  ro.observation_date,
  ro.category,
  ro.content,
  ro.created_at,
  ro.updated_at,

  -- 作成者情報
  u.id as created_by,
  u.family_name || ' ' || u.given_name as created_by_name,

  -- タグ情報
  COALESCE(
    json_agg(
      json_build_object(
        'tag_id', mot.id,
        'tag_name', mot.name
      )
    ) FILTER (WHERE mot.id IS NOT NULL),
    '[]'::json
  ) as tags

FROM r_observation ro
INNER JOIN m_children c ON ro.child_id = c.id
LEFT JOIN m_users u ON ro.created_by = u.id
LEFT JOIN _record_tag rt ON ro.id = rt.record_id AND rt.record_type = 'observation'
LEFT JOIN m_observation_tags mot ON rt.tag_id = mot.id AND mot.deleted_at IS NULL

WHERE ro.child_id = $1  -- child_id
  AND c.facility_id = $2  -- facility_id (from session)
  AND ro.deleted_at IS NULL
  AND c.deleted_at IS NULL

  -- フィルター条件
  AND ($3::VARCHAR IS NULL OR ro.category = $3)  -- category filter
  AND ($4::DATE IS NULL OR ro.observation_date >= $4)  -- start_date
  AND ($5::DATE IS NULL OR ro.observation_date <= $5)  -- end_date

GROUP BY ro.id, u.id
ORDER BY ro.observation_date DESC, ro.created_at DESC
LIMIT $6 OFFSET $7;  -- limit, offset
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
   - 更新・削除は自分が作成した記録のみ（Phase 2で実装予定）

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

### 入力検証
- `content`: 最大5,000文字
- `category`: カテゴリマスタに存在する値のみ許可
- `observation_date`: YYYY-MM-DD形式、未来日は不可
- `child_id`: UUID形式、対象施設に存在する児童のみ

---

## パフォーマンス考慮事項

### インデックス
```sql
-- 既存のインデックスで対応可能

-- 追加推奨インデックス
CREATE INDEX idx_r_observation_child_category
  ON r_observation(child_id, category)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_r_observation_child_date_range
  ON r_observation(child_id, observation_date DESC)
  WHERE deleted_at IS NULL;
```

### キャッシュ戦略
- カテゴリマスタ: 1時間キャッシュ
- タグマスタ: 1時間キャッシュ
- 観察記録: キャッシュしない（リアルタイム性重視）

---

## エラーハンドリング

### 共通エラーコード
```typescript
{
  "OBSERVATION_NOT_FOUND": "観察記録が見つかりません",
  "CHILD_NOT_FOUND": "児童が見つかりません",
  "INVALID_CATEGORY": "無効なカテゴリです",
  "FUTURE_DATE_NOT_ALLOWED": "未来日は指定できません",
  "PERMISSION_DENIED": "この記録を編集する権限がありません"
}
```

---

## UI/UX要件

### カテゴリ選択
```tsx
// カテゴリはSelect componentで選択
<Select value={category} onValueChange={setCategory}>
  <SelectTrigger>
    <SelectValue placeholder="カテゴリを選択" />
  </SelectTrigger>
  <SelectContent>
    {observationCategories.map((cat) => (
      <SelectItem key={cat.id} value={cat.id}>
        {cat.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 過去記録の表示
- 日付の新しい順に表示
- カテゴリでフィルタリング可能
- 無限スクロールまたはページネーション

---

## 活動記録との違い

### 活動記録（r_activity）
- **対象**: クラス全体の活動
- **内容**: 複数の子どもが登場する包括的な記録
- **メンション**: `@たなか はると` のように子どもを明示的に言及
- **AI機能**: メンションされた児童ごとに個別記録を自動抽出

### 観察記録（r_observation）
- **対象**: 特定の1人の子ども
- **内容**: その子どもに特化した観察やエピソード
- **カテゴリ**: 6つの発達領域でカテゴリ分類
- **AI機能**: なし（直接記録）

---

## 今後の拡張予定

### Phase 2
- カテゴリマスタのテーブル化（`m_observation_categories`）
- 写真添付機能
- 音声入力機能
- テンプレート機能（定型文）

### Phase 3
- AIによる観察記録の下書き生成
- 過去の記録からのサジェスト
- カテゴリ間の関連性分析
- 成長曲線との連携

---

**作成日**: 2025-01-09
**最終更新**: 2025-01-09
**関連ドキュメント**:
- `03_database.md` - データベース設計
- `04_api.md` - API基本設計
- `10_activity_record_api.md` - 活動記録API（違いを参照）
