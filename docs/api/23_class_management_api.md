# クラス管理API仕様書

## 概要
クラスの登録・編集・削除機能のAPI仕様を定義します。
クラス名、対象年齢、定員などの管理をサポートします。

---

## エンドポイント一覧

### 1. クラス一覧取得

**エンドポイント**: `GET /api/classes`

**説明**: クラス一覧を取得します。権限に応じてアクセス可能な施設のクラスを返します。

**リクエストパラメータ**:
```typescript
{
  facility_id?: string;  // 施設フィルター（任意）
  search?: string;       // 検索キーワード（クラス名・担任名）
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "classes": [
      {
        "class_id": "uuid-class-1",
        "name": "ひよこ組",
        "facility_id": "uuid-facility-1",
        "facility_name": "ひまわり保育園 本園",
        "age_group": "0歳児",
        "capacity": 12,
        "current_count": 8,
        "staff_count": 3,
        "teachers": ["田中先生", "佐藤先生"],  // 担任リスト
        "room_number": "1-A",
        "color_code": "#FFD700",  // クラスカラー
        "is_active": true,
        "display_order": 1,
        "created_at": "2020-04-01T10:00:00+09:00",
        "updated_at": "2024-01-15T10:00:00+09:00"
      },
      {
        "class_id": "uuid-class-2",
        "name": "りす組",
        "facility_id": "uuid-facility-1",
        "facility_name": "ひまわり保育園 本園",
        "age_group": "1歳児",
        "capacity": 15,
        "current_count": 12,
        "staff_count": 4,
        "teachers": ["山田先生"],
        "room_number": "1-B",
        "color_code": "#FF6B6B",
        "is_active": true,
        "display_order": 2,
        "created_at": "2020-04-01T10:00:00+09:00",
        "updated_at": "2024-01-15T10:00:00+09:00"
      },
      {
        "class_id": "uuid-class-3",
        "name": "うさぎ組",
        "facility_id": "uuid-facility-1",
        "facility_name": "ひまわり保育園 本園",
        "age_group": "2歳児",
        "capacity": 18,
        "current_count": 15,
        "staff_count": 4,
        "teachers": ["鈴木先生", "高橋先生"],
        "room_number": "2-A",
        "color_code": "#4ECDC4",
        "is_active": true,
        "display_order": 3,
        "created_at": "2020-04-01T10:00:00+09:00",
        "updated_at": "2024-01-15T10:00:00+09:00"
      }
    ],
    "total": 3,
    "total_children": 35,
    "total_capacity": 45
  }
}
```

**備考**:
- `facility_id`パラメータが指定されていない場合、ユーザーの権限に応じてアクセス可能な全施設のクラスを返します
- company_adminは複数施設のクラスを取得可能
- facility_adminとstaffは自施設のクラスのみ取得可能

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 自施設のみ

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `500 Internal Server Error`: サーバーエラー

---

### 2. クラス詳細取得

**エンドポイント**: `GET /api/classes/:id`

**説明**: 特定のクラスの詳細情報を取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "class_id": "uuid-class-1",
    "name": "ひよこ組",
    "age_group": "0歳児",
    "capacity": 12,
    "current_count": 8,
    "room_number": "1-A",
    "color_code": "#FFD700",
    "is_active": true,
    "display_order": 1,

    // 担当職員
    "staff": [
      {
        "user_id": "uuid-user-1",
        "name": "田中 花子",
        "role": "facility_admin",
        "is_homeroom": true  // 担任
      },
      {
        "user_id": "uuid-user-2",
        "name": "佐藤 太郎",
        "role": "staff",
        "is_homeroom": false  // 副担任
      }
    ],

    // 所属児童
    "children": [
      {
        "child_id": "uuid-child-1",
        "name": "山田 陽翔",
        "birth_date": "2024-05-15",
        "age": 0,
        "photo_url": "https://...",
        "enrollment_status": "enrolled"
      }
      // ... 他の児童
    ],

    "created_at": "2020-04-01T10:00:00+09:00",
    "updated_at": "2024-01-15T10:00:00+09:00"
  }
}
```

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 自施設のみ

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: クラスが見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 3. クラス新規作成

**エンドポイント**: `POST /api/classes`

**説明**: 新しいクラスを作成します。

**リクエストボディ**:
```typescript
{
  "name": "ぱんだ組",
  "age_group": "3歳児",         // 0歳児 / 1歳児 / 2歳児 / 3歳児 / 4歳児 / 5歳児 / 混合
  "capacity": 20,
  "room_number": "2-B",         // 任意
  "color_code": "#9B59B6",      // 任意（HEXカラーコード）
  "display_order": 4            // 任意（表示順）
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "class_id": "uuid-class-new",
    "name": "ぱんだ組",
    "age_group": "3歳児",
    "capacity": 20,
    "current_count": 0,
    "created_at": "2024-01-15T10:00:00+09:00"
  },
  "message": "クラスを作成しました"
}
```

**処理内容**:
1. `m_classes`テーブルに新規レコードを作成
2. `display_order`が未指定の場合は、最大値+1を自動設定
3. `color_code`が未指定の場合は、デフォルトカラーを設定

**権限別アクセス制御**:
- **site_admin**: 不可
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効なデータ形式、重複するクラス名
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: アクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 4. クラス情報更新

**エンドポイント**: `PUT /api/classes/:id`

**説明**: クラスの情報を更新します。

**リクエストボディ**:
```typescript
{
  "name": "ぱんだ組（改）",
  "age_group": "3歳児",
  "capacity": 22,
  "room_number": "2-B",
  "color_code": "#9B59B6",
  "display_order": 4,
  "is_active": true            // クラスの有効/無効
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "class_id": "uuid-class-4",
    "name": "ぱんだ組（改）",
    "updated_at": "2024-01-15T10:00:00+09:00"
  },
  "message": "クラス情報を更新しました"
}
```

**処理内容**:
1. `m_classes`テーブルの該当レコードを更新
2. 変更履歴を`h_class_changes`に記録（Phase 2）

**権限別アクセス制御**:
- **site_admin**: 不可
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効なデータ形式、重複するクラス名
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: クラスが見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 5. クラス削除

**エンドポイント**: `DELETE /api/classes/:id`

**説明**: クラスを削除します（ソフトデリート）。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "class_id": "uuid-class-4",
    "name": "ぱんだ組",
    "deleted_at": "2024-01-15T10:00:00+09:00"
  },
  "message": "クラスを削除しました"
}
```

**処理内容**:
1. `m_classes`テーブルの`deleted_at`を更新（ソフトデリート）
2. 所属児童がいる場合は削除不可（エラー）
3. 担当職員の紐付けを解除（`_user_class`）

**権限別アクセス制御**:
- **site_admin**: 不可
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `400 Bad Request`: 所属児童が存在するため削除不可
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: クラスが見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 6. クラス表示順更新

**エンドポイント**: `PUT /api/classes/order`

**説明**: クラスの表示順を一括更新します。

**リクエストボディ**:
```typescript
{
  "orders": [
    { "class_id": "uuid-class-1", "display_order": 1 },
    { "class_id": "uuid-class-2", "display_order": 2 },
    { "class_id": "uuid-class-3", "display_order": 3 },
    { "class_id": "uuid-class-4", "display_order": 4 }
  ]
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "message": "表示順を更新しました"
}
```

**処理内容**:
1. トランザクション内で`m_classes`テーブルの`display_order`を一括更新

**権限別アクセス制御**:
- **site_admin**: 不可
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効なデータ形式
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: アクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

## データベース要件

### 使用テーブル

#### 1. m_classes（クラスマスタ）
```sql
CREATE TABLE IF NOT EXISTS m_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,                  -- クラス名（例: ひまわり組）
  grade VARCHAR(50),                           -- 学年（例: 年長、小1）
  school_year INTEGER NOT NULL,                -- 年度（例: 2025）
  capacity INTEGER,                            -- 定員
  is_active BOOLEAN NOT NULL DEFAULT true,     -- 有効/無効
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_classes_facility_id ON m_classes(facility_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_classes_school_year ON m_classes(school_year) WHERE deleted_at IS NULL;
```

#### 2. _user_class（職員-クラス紐付け）
```sql
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
```

#### 3. _child_class（子ども-クラス紐付け）
```sql
-- 既に17_child_registration_api.mdで定義済み
-- クラス削除時の参照整合性チェックに使用
```

#### 4. h_class_changes（クラス変更履歴）
```sql
CREATE TABLE IF NOT EXISTS h_class_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES m_classes(id),
  user_id UUID NOT NULL REFERENCES m_users(id),

  -- 変更内容
  field_name VARCHAR(50) NOT NULL,
  old_value TEXT,
  new_value TEXT,

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_h_class_changes_class
  ON h_class_changes(class_id);

CREATE INDEX idx_h_class_changes_created
  ON h_class_changes(created_at DESC);
```

---

## クエリ例

### クラス一覧取得クエリ

```sql
WITH teacher_list AS (
  -- 担任リストを集約
  SELECT
    uc.class_id,
    array_agg(u.name ORDER BY uc.is_homeroom DESC, u.name) as teachers
  FROM _user_class uc
  INNER JOIN m_users u ON uc.user_id = u.id AND u.deleted_at IS NULL
  GROUP BY uc.class_id
)
SELECT
  c.id as class_id,
  c.name,
  c.facility_id,
  f.name as facility_name,
  c.age_group,
  c.capacity,
  c.room_number,
  c.color_code,
  c.is_active,
  c.display_order,

  -- 在籍児童数
  (SELECT COUNT(*)
   FROM _child_class cc
   INNER JOIN m_children ch ON cc.child_id = ch.id
   WHERE cc.class_id = c.id
     AND cc.is_current = true
     AND ch.enrollment_status = 'enrolled'
     AND ch.deleted_at IS NULL
  ) as current_count,

  -- 担当職員数
  (SELECT COUNT(*)
   FROM _user_class uc
   WHERE uc.class_id = c.id
  ) as staff_count,

  -- 担任リスト
  COALESCE(tl.teachers, ARRAY[]::VARCHAR[]) as teachers,

  c.created_at,
  c.updated_at

FROM m_classes c
INNER JOIN m_facilities f ON c.facility_id = f.id AND f.deleted_at IS NULL
LEFT JOIN teacher_list tl ON c.id = tl.class_id

WHERE
  c.deleted_at IS NULL

  -- 施設フィルタ
  AND ($1::UUID IS NULL OR c.facility_id = $1)

  -- 検索フィルタ
  AND (
    $2::VARCHAR IS NULL
    OR c.name ILIKE '%' || $2 || '%'
    OR EXISTS (
      SELECT 1 FROM _user_class uc
      INNER JOIN m_users u ON uc.user_id = u.id
      WHERE uc.class_id = c.id
        AND u.name ILIKE '%' || $2 || '%'
    )
  )

  -- 権限に応じたフィルタ (セッションから取得)
  AND (
    ($3 = 'site_admin') OR
    ($3 = 'company_admin' AND f.company_id = $4) OR
    ($3 = 'facility_admin' AND c.facility_id = $5) OR
    ($3 = 'staff' AND c.facility_id = $5)
  )

ORDER BY f.name, c.display_order ASC, c.created_at ASC;
```

### クラス新規作成クエリ

```sql
-- display_orderの自動採番
WITH next_order AS (
  SELECT COALESCE(MAX(display_order), 0) + 1 as next_order
  FROM m_classes
  WHERE facility_id = $1
    AND deleted_at IS NULL
)
INSERT INTO m_classes (
  facility_id,
  name,
  age_group,
  capacity,
  room_number,
  color_code,
  display_order
)
SELECT
  $1,  -- facility_id
  $2,  -- name
  $3,  -- age_group
  $4,  -- capacity
  $5,  -- room_number
  $6,  -- color_code
  COALESCE($7, next_order)  -- display_order (自動採番またはユーザー指定)
FROM next_order
RETURNING id, name, age_group, capacity, created_at;
```

### クラス削除前チェッククエリ

```sql
-- 所属児童数を確認
SELECT COUNT(*) as child_count
FROM _child_class cc
INNER JOIN m_children c ON cc.child_id = c.id
WHERE cc.class_id = $1
  AND cc.is_current = true
  AND c.enrollment_status = 'enrolled'
  AND c.deleted_at IS NULL;

-- 0の場合のみ削除可能
-- 削除実行
UPDATE m_classes
SET deleted_at = NOW(), updated_at = NOW()
WHERE id = $1
  AND deleted_at IS NULL;

-- 担当職員の紐付けを解除（物理削除）
DELETE FROM _user_class
WHERE class_id = $1;
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
   - クラスの作成・編集・削除が可能

3. **facility_admin（施設管理者）**:
   - 自施設のみアクセス可能
   - クラスの作成・編集・削除が可能

4. **staff（一般職員）**:
   - 自施設のクラス一覧を閲覧のみ可能
   - 作成・編集・削除権限なし

#### 施設IDの取得
- `facility_id`はリクエストパラメータではなく、セッション情報（`current_facility_id`）から自動取得します
- これにより、ユーザーが不正な施設IDを指定することを防止します

#### データ分離
- RLS（Row Level Security）で施設レベルのデータを分離
- クエリ実行時に`facility_id`でフィルタリング

#### エラーハンドリング戦略
- アクセス権限がない場合: `404 Not Found`を返す
- 理由: `403 Forbidden`ではリソースの存在を推測可能になるため、セキュリティ上`404`を優先

### バリデーション
- クラス名: 1〜50文字、必須
- 年齢グループ: 0歳児 / 1歳児 / 2歳児 / 3歳児 / 4歳児 / 5歳児 / 混合 のいずれか
- 定員: 1以上の整数
- カラーコード: #RRGGBBの形式
- 重複チェック: 同一施設内でクラス名が重複しないこと

---

## パフォーマンス考慮事項

### インデックス
```sql
-- 上記のテーブル定義に含まれるインデックスで対応可能
```

### キャッシュ戦略
- クラス一覧: 30分キャッシュ
- クラス詳細: 15分キャッシュ
- 更新時にキャッシュをクリア

---

## エラーハンドリング

### 共通エラーコード
```typescript
{
  "CLASS_NOT_FOUND": "クラスが見つかりません",
  "CLASS_NAME_DUPLICATE": "同じ名前のクラスが既に存在します",
  "INVALID_AGE_GROUP": "無効な年齢グループです",
  "INVALID_CAPACITY": "定員は1以上の整数で指定してください",
  "INVALID_COLOR_CODE": "カラーコードの形式が正しくありません",
  "CLASS_HAS_CHILDREN": "所属児童がいるため削除できません",
  "PERMISSION_DENIED": "クラスを変更する権限がありません"
}
```

---

## UI/UX要件

### クラス一覧画面
```tsx
- クラスカードを一覧表示
- ドラッグ&ドロップで表示順を変更
- クラスカラーで視覚的に区別
- 在籍児童数/定員を表示
```

### クラス作成/編集フォーム
```tsx
1. 基本情報
   - クラス名
   - 年齢グループ
   - 定員

2. 詳細設定
   - 部屋番号
   - クラスカラー（カラーピッカー）
   - 表示順

3. 担当職員（Phase 2）
   - 主担任選択
   - 副担任選択（複数可）
```

### バリデーション
- リアルタイムバリデーション（入力時）
- 必須項目のハイライト表示
- 重複チェック（クラス名）
- 削除時の確認ダイアログ（所属児童数を表示）

---

## 今後の拡張予定

### Phase 2
- クラス変更履歴の表示
- 担当職員の自動割り当て提案
- 過去のクラス編成の履歴管理
- クラス間の児童移動機能

### Phase 3
- クラス写真の登録
- クラス目標・年間計画の管理
- クラスだよりのテンプレート管理
- AIによる最適なクラス編成の提案

---

**作成日**: 2025-01-09
**最終更新**: 2025-01-09
**関連ドキュメント**:
- `03_database.md` - データベース設計
- `04_api.md` - API基本設計
- `22_facility_settings_api.md` - 施設情報設定API
- `24_user_management_api.md` - 職員管理API
