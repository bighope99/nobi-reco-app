# 職員アカウント管理API仕様書

## 概要
職員アカウントの登録・編集・削除、権限管理のAPI仕様を定義します。
職員の基本情報、ロール設定、クラス担当の管理をサポートします。

---

## エンドポイント一覧

### 1. 職員一覧取得

**エンドポイント**: `GET /api/users`

**説明**: 施設内の職員アカウント一覧を取得します。

**リクエストパラメータ**:
```typescript
{
  role?: string;          // site_admin / company_admin / facility_admin / staff
  is_active?: boolean;    // アクティブ/非アクティブフィルター
  class_id?: string;      // クラスフィルター（担当クラス）
  search?: string;        // 検索キーワード（名前・メール）
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "users": [
      {
        "user_id": "uuid-user-1",
        "email": "[email protected]",
        "name": "田中 花子",
        "name_kana": "タナカ ハナコ",
        "role": "facility_admin",     // site_admin / company_admin / facility_admin / staff
        "phone": "090-1111-2222",
        "hire_date": "2020-04-01",
        "is_active": true,

        // 担当クラス
        "assigned_classes": [
          {
            "class_id": "uuid-class-1",
            "class_name": "ひよこ組",
            "is_main": true  // 主担任
          }
        ],

        // 権限
        "permissions": {
          "can_edit_children": true,
          "can_edit_records": true,
          "can_view_all_classes": true,
          "can_manage_users": true,
          "can_manage_settings": true
        },

        "last_login_at": "2024-01-15T09:00:00+09:00",
        "created_at": "2020-04-01T10:00:00+09:00",
        "updated_at": "2024-01-15T10:00:00+09:00"
      },
      {
        "user_id": "uuid-user-2",
        "email": "[email protected]",
        "name": "佐藤 太郎",
        "name_kana": "サトウ タロウ",
        "role": "staff",
        "phone": "090-2222-3333",
        "hire_date": "2022-04-01",
        "is_active": true,

        "assigned_classes": [
          {
            "class_id": "uuid-class-1",
            "class_name": "ひよこ組",
            "is_main": false  // 副担任
          },
          {
            "class_id": "uuid-class-2",
            "class_name": "りす組",
            "is_main": false
          }
        ],

        "permissions": {
          "can_edit_children": false,
          "can_edit_records": true,
          "can_view_all_classes": false,
          "can_manage_users": false,
          "can_manage_settings": false
        },

        "last_login_at": "2024-01-15T08:30:00+09:00",
        "created_at": "2022-04-01T10:00:00+09:00",
        "updated_at": "2024-01-15T10:00:00+09:00"
      }
    ],
    "total": 2,
    "summary": {
      "total_users": 25,
      "active_users": 23,
      "by_role": {
        "company_admin": 2,
        "facility_admin": 3,
        "staff": 20
      }
    }
  }
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: アクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 2. 職員詳細取得

**エンドポイント**: `GET /api/users/:id`

**説明**: 特定の職員の詳細情報を取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "user_id": "uuid-user-1",
    "email": "[email protected]",
    "name": "田中 花子",
    "name_kana": "タナカ ハナコ",
    "role": "facility_admin",
    "phone": "090-1111-2222",
    "hire_date": "2020-04-01",
    "birth_date": "1985-03-15",
    "is_active": true,

    // 勤務情報
    "employment_info": {
      "position": "主任",
      "employment_type": "full_time",  // full_time / part_time / contract
      "qualifications": [
        "保育士資格",
        "幼稚園教諭一種免許"
      ]
    },

    // 担当クラス（履歴含む）
    "class_assignments": [
      {
        "class_id": "uuid-class-1",
        "class_name": "ひよこ組",
        "is_main": true,
        "start_date": "2024-04-01",
        "end_date": null,
        "is_current": true
      },
      {
        "class_id": "uuid-class-old",
        "class_name": "うさぎ組",
        "is_main": true,
        "start_date": "2023-04-01",
        "end_date": "2024-03-31",
        "is_current": false
      }
    ],

    // 権限詳細
    "permissions": {
      "can_edit_children": true,
      "can_edit_records": true,
      "can_view_all_classes": true,
      "can_manage_users": true,
      "can_manage_settings": true
    },

    // 統計情報
    "statistics": {
      "total_records": 245,
      "total_observations": 89,
      "total_activities": 156,
      "last_record_date": "2024-01-15"
    },

    "last_login_at": "2024-01-15T09:00:00+09:00",
    "created_at": "2020-04-01T10:00:00+09:00",
    "updated_at": "2024-01-15T10:00:00+09:00"
  }
}
```

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 自分自身のみ

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 職員が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 3. 職員新規登録

**エンドポイント**: `POST /api/users`

**説明**: 新しい職員アカウントを作成します。

**リクエストボディ**:
```typescript
{
  // 基本情報
  "email": "[email protected]",
  "name": "山田 次郎",
  "name_kana": "ヤマダ ジロウ",
  "phone": "090-3333-4444",
  "birth_date": "1990-05-20",      // 任意
  "hire_date": "2024-04-01",

  // ロール・権限
  "role": "staff",                  // facility_admin / staff

  // 勤務情報（任意）
  "position": "保育士",
  "employment_type": "full_time",   // full_time / part_time / contract
  "qualifications": [               // 任意
    "保育士資格"
  ],

  // 担当クラス（任意）
  "assigned_classes": [
    {
      "class_id": "uuid-class-2",
      "is_main": true,
      "start_date": "2024-04-01"
    }
  ],

  // 初期パスワード（任意、未指定の場合は自動生成）
  "initial_password": "TempPass123!"
}
```

**備考**:
- `facility_id`はセッション情報（`current_facility_id`）から自動取得します
- `company_admin`ロールは作成不可（会社レベルでの管理が必要）

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "user_id": "uuid-user-new",
    "email": "[email protected]",
    "name": "山田 次郎",
    "role": "staff",
    "initial_password": "TempPass123!",  // パスワードを返却（初回のみ）
    "password_reset_required": true,
    "created_at": "2024-01-15T10:00:00+09:00"
  },
  "message": "職員アカウントを作成しました。初回ログイン時にパスワード変更が必要です。"
}
```

**処理内容**:
1. `m_users`テーブルに新規レコードを作成
2. Supabase Authにユーザーを作成
3. 初期パスワードを設定（または自動生成）
4. `_user_facility`テーブルで施設と紐付け
5. `_user_class`テーブルでクラス担当を設定
6. 招待メールを送信（Phase 2）

**権限別アクセス制御**:
- **site_admin**: 不可
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効なデータ形式、メールアドレス重複
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: アクセス権限なし、指定されたクラスが見つからない
- `500 Internal Server Error`: サーバーエラー

---

### 4. 職員情報更新

**エンドポイント**: `PUT /api/users/:id`

**説明**: 職員の情報を更新します。

**リクエストボディ**:
```typescript
{
  "name": "山田 次郎",
  "name_kana": "ヤマダ ジロウ",
  "phone": "090-3333-4444",
  "role": "facility_admin",         // ロール変更
  "is_active": true,                // アクティブ/非アクティブ

  // 勤務情報
  "position": "主任",
  "employment_type": "full_time",

  // 担当クラス
  "assigned_classes": [
    {
      "class_id": "uuid-class-2",
      "is_main": true,
      "start_date": "2024-04-01"
    }
  ]
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "user_id": "uuid-user-3",
    "name": "山田 次郎",
    "role": "facility_admin",
    "updated_at": "2024-01-15T10:00:00+09:00"
  },
  "message": "職員情報を更新しました"
}
```

**処理内容**:
1. `m_users`テーブルの該当レコードを更新
2. ロール変更時はSupabase Authのメタデータも更新
3. `_user_class`テーブルでクラス担当を更新
4. 変更履歴を`h_user_changes`に記録（Phase 2）

**権限別アクセス制御**:
- **site_admin**: 不可
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ（自分自身のロール変更は不可）
- **staff**: 自分自身の基本情報のみ（ロール・クラス担当の変更は不可）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効なデータ形式、自分自身のロール変更
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 職員が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 5. 職員削除（無効化）

**エンドポイント**: `DELETE /api/users/:id`

**説明**: 職員アカウントを無効化します（ソフトデリート）。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "user_id": "uuid-user-3",
    "name": "山田 次郎",
    "is_active": false,
    "deactivated_at": "2024-01-15T10:00:00+09:00"
  },
  "message": "職員アカウントを無効化しました"
}
```

**処理内容**:
1. `m_users`テーブルの`is_active`をfalseに更新
2. `deleted_at`を設定（ソフトデリート）
3. Supabase Authのアカウントを無効化
4. `_user_class`の`is_current`をfalseに更新
5. 作成した記録データは保持（作成者情報として残る）

**権限別アクセス制御**:
- **site_admin**: 不可
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ（自分自身の削除は不可）
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `400 Bad Request`: 自分自身の削除、最後の管理者の削除
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 職員が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 6. パスワードリセット

**エンドポイント**: `POST /api/users/:id/reset-password`

**説明**: 職員のパスワードをリセットし、一時パスワードを発行します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "user_id": "uuid-user-3",
    "email": "[email protected]",
    "temporary_password": "TempPass456!",
    "password_reset_required": true,
    "reset_at": "2024-01-15T10:00:00+09:00"
  },
  "message": "パスワードをリセットしました。一時パスワードをユーザーに通知してください。"
}
```

**処理内容**:
1. 一時パスワードを自動生成
2. Supabase Authのパスワードを更新
3. パスワード変更フラグを設定
4. パスワードリセット通知メールを送信（Phase 2）

**権限別アクセス制御**:
- **site_admin**: 不可
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 職員が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 7. ロール一覧取得

**エンドポイント**: `GET /api/users/roles`

**説明**: 利用可能なロールと権限の一覧を取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "roles": [
      {
        "role": "company_admin",
        "label": "会社管理者",
        "description": "複数施設を横断的に管理",
        "permissions": {
          "can_edit_children": true,
          "can_edit_records": true,
          "can_view_all_classes": true,
          "can_manage_users": true,
          "can_manage_settings": true,
          "can_manage_facilities": true
        }
      },
      {
        "role": "facility_admin",
        "label": "施設管理者",
        "description": "施設の全機能を管理",
        "permissions": {
          "can_edit_children": true,
          "can_edit_records": true,
          "can_view_all_classes": true,
          "can_manage_users": true,
          "can_manage_settings": true,
          "can_manage_facilities": false
        }
      },
      {
        "role": "staff",
        "label": "一般職員",
        "description": "担当クラスの記録を作成",
        "permissions": {
          "can_edit_children": false,
          "can_edit_records": true,
          "can_view_all_classes": false,
          "can_manage_users": false,
          "can_manage_settings": false,
          "can_manage_facilities": false
        }
      }
    ]
  }
}
```

**権限別アクセス制御**:
- **site_admin**: 可
- **company_admin**: 可
- **facility_admin**: 可
- **staff**: 可

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `500 Internal Server Error`: サーバーエラー

---

## データベース要件

### 使用テーブル

#### 1. m_users（ユーザーマスタ）
```sql
CREATE TABLE IF NOT EXISTS m_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES m_companies(id),

  -- 基本情報
  email VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_kana VARCHAR(100),
  phone VARCHAR(20),
  birth_date DATE,

  -- 認証情報
  supabase_user_id UUID UNIQUE,  -- Supabase AuthのユーザーID
  password_reset_required BOOLEAN DEFAULT true,

  -- ロール
  role VARCHAR(20) NOT NULL,  -- site_admin / company_admin / facility_admin / staff

  -- 勤務情報
  hire_date DATE,
  position VARCHAR(50),
  employment_type VARCHAR(20),  -- full_time / part_time / contract
  qualifications TEXT[],         -- 資格の配列

  -- ステータス
  is_active BOOLEAN DEFAULT true,

  -- タイムスタンプ
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_m_users_email
  ON m_users(email)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_m_users_role
  ON m_users(role)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_m_users_supabase
  ON m_users(supabase_user_id)
  WHERE deleted_at IS NULL;
```

#### 2. _user_facility（ユーザー-施設紐付け）
```sql
CREATE TABLE IF NOT EXISTS _user_facility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES m_users(id),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),

  -- 期間
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (user_id, facility_id, start_date)
);

CREATE INDEX idx_user_facility_user
  ON _user_facility(user_id);

CREATE INDEX idx_user_facility_facility
  ON _user_facility(facility_id);

CREATE INDEX idx_user_facility_current
  ON _user_facility(user_id, is_current)
  WHERE is_current = true;
```

#### 3. _user_class（職員-クラス紐付け）
```sql
-- 既に23_class_management_api.mdで定義済み
```

#### 4. h_user_changes（ユーザー変更履歴）
```sql
CREATE TABLE IF NOT EXISTS h_user_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES m_users(id),
  changed_by UUID NOT NULL REFERENCES m_users(id),

  -- 変更内容
  field_name VARCHAR(50) NOT NULL,
  old_value TEXT,
  new_value TEXT,

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_h_user_changes_user
  ON h_user_changes(user_id);

CREATE INDEX idx_h_user_changes_created
  ON h_user_changes(created_at DESC);
```

---

## クエリ例

### 職員一覧取得クエリ

```sql
WITH user_classes AS (
  -- 担当クラスを集約
  SELECT
    uc.user_id,
    json_agg(
      json_build_object(
        'class_id', c.id,
        'class_name', c.name,
        'is_main', uc.is_main
      )
      ORDER BY c.display_order
    ) FILTER (WHERE uc.is_current = true) as classes
  FROM _user_class uc
  INNER JOIN m_classes c ON uc.class_id = c.id AND c.deleted_at IS NULL
  WHERE uc.is_current = true
  GROUP BY uc.user_id
)
SELECT
  u.id as user_id,
  u.email,
  u.name,
  u.name_kana,
  u.role,
  u.phone,
  u.hire_date,
  u.is_active,
  u.position,
  u.employment_type,

  -- 担当クラス
  COALESCE(uc.classes, '[]'::json) as assigned_classes,

  u.last_login_at,
  u.created_at,
  u.updated_at

FROM m_users u
INNER JOIN _user_facility uf ON u.id = uf.user_id AND uf.is_current = true
LEFT JOIN user_classes uc ON u.id = uc.user_id

WHERE uf.facility_id = $1  -- facility_id (from session)
  AND u.deleted_at IS NULL

  -- フィルター
  AND ($2::VARCHAR IS NULL OR u.role = $2)  -- role filter
  AND ($3::BOOLEAN IS NULL OR u.is_active = $3)  -- is_active filter
  AND (
    $4::VARCHAR IS NULL
    OR u.name ILIKE '%' || $4 || '%'
    OR u.email ILIKE '%' || $4 || '%'
  )  -- search filter

ORDER BY u.role, u.name;
```

### 職員新規作成クエリ

```sql
-- トランザクション開始
BEGIN;

-- 1. ユーザーマスタに挿入
INSERT INTO m_users (
  id,
  company_id,
  email,
  name,
  name_kana,
  phone,
  birth_date,
  role,
  hire_date,
  position,
  employment_type,
  qualifications,
  password_reset_required
) VALUES (
  gen_random_uuid(),
  $1,  -- company_id (from session)
  $2,  -- email
  $3,  -- name
  $4,  -- name_kana
  $5,  -- phone
  $6,  -- birth_date
  $7,  -- role
  $8,  -- hire_date
  $9,  -- position
  $10, -- employment_type
  $11, -- qualifications
  true
)
RETURNING id;

-- 2. 施設との紐付け
INSERT INTO _user_facility (
  user_id,
  facility_id,
  start_date,
  is_current
) VALUES (
  $12, -- user_id (from step 1)
  $13, -- facility_id (from session)
  $14, -- start_date (hire_date)
  true
);

-- 3. クラス担当を設定（任意）
INSERT INTO _user_class (
  user_id,
  class_id,
  is_main,
  start_date,
  is_current
)
SELECT
  $12,  -- user_id
  class_assignment->>'class_id',
  (class_assignment->>'is_main')::BOOLEAN,
  (class_assignment->>'start_date')::DATE,
  true
FROM json_array_elements($15::json) AS class_assignment
WHERE $15 IS NOT NULL;

COMMIT;
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
   - 自社が運営する全施設のユーザーを管理
   - 全ての管理操作が可能

3. **facility_admin（施設管理者）**:
   - 自施設のユーザーを管理
   - 自分自身のロール変更・削除は不可

4. **staff（一般職員）**:
   - 自分自身の基本情報の閲覧・編集のみ可能
   - ロール・クラス担当の変更は不可

#### 施設IDの取得
- `facility_id`はリクエストパラメータではなく、セッション情報（`current_facility_id`）から自動取得します
- これにより、ユーザーが不正な施設IDを指定することを防止します

#### データ分離
- RLS（Row Level Security）で施設レベル・会社レベルのデータを分離
- クエリ実行時に`facility_id`または`company_id`でフィルタリング

#### エラーハンドリング戦略
- アクセス権限がない場合: `404 Not Found`を返す
- 理由: `403 Forbidden`ではリソースの存在を推測可能になるため、セキュリティ上`404`を優先

### パスワードセキュリティ
- 初期パスワードは自動生成（英大小文字・数字・記号を含む12文字以上）
- 初回ログイン時にパスワード変更を強制
- パスワードはSupabase Authで暗号化管理
- パスワードリセットは管理者のみ実行可能

### バリデーション
- メールアドレス: RFC 5322準拠の形式チェック、重複チェック
- 電話番号: 正規表現で形式チェック
- ロール: 許可されたロールのみ設定可能
- 自己操作の制限: 自分自身のロール変更・削除を防止
- 最後の管理者保護: 施設に管理者が1人の場合は削除不可

---

## パフォーマンス考慮事項

### インデックス
```sql
-- 上記のテーブル定義に含まれるインデックスで対応可能
```

### キャッシュ戦略
- ユーザー一覧: 10分キャッシュ
- ユーザー詳細: 15分キャッシュ
- ロール一覧: 1時間キャッシュ
- 更新時にキャッシュをクリア

---

## エラーハンドリング

### 共通エラーコード
```typescript
{
  "USER_NOT_FOUND": "職員が見つかりません",
  "EMAIL_ALREADY_EXISTS": "このメールアドレスは既に使用されています",
  "INVALID_EMAIL_FORMAT": "メールアドレスの形式が正しくありません",
  "INVALID_PHONE_FORMAT": "電話番号の形式が正しくありません",
  "INVALID_ROLE": "無効なロールです",
  "CANNOT_MODIFY_SELF_ROLE": "自分自身のロールを変更することはできません",
  "CANNOT_DELETE_SELF": "自分自身を削除することはできません",
  "CANNOT_DELETE_LAST_ADMIN": "最後の管理者を削除することはできません",
  "CLASS_NOT_FOUND": "指定されたクラスが見つかりません",
  "PERMISSION_DENIED": "職員情報を変更する権限がありません"
}
```

---

## UI/UX要件

### 職員一覧画面
```tsx
- 職員カードまたはテーブル表示
- ロールバッジで視覚的に区別
- 担当クラスの表示
- 検索・フィルター機能
```

### 職員登録/編集フォーム
```tsx
1. 基本情報
   - 氏名（漢字・カナ）
   - メールアドレス
   - 電話番号
   - 生年月日

2. 勤務情報
   - 入社日
   - 役職
   - 雇用形態
   - 資格（複数選択）

3. ロール・権限
   - ロール選択
   - 権限プレビュー

4. クラス担当
   - 担当クラス選択（複数可）
   - 主担任/副担任の指定
```

### バリデーション
- リアルタイムバリデーション（入力時）
- 必須項目のハイライト表示
- メールアドレスの重複チェック
- 削除時の確認ダイアログ（作成した記録数を表示）

---

## 今後の拡張予定

### Phase 2
- ユーザー変更履歴の表示
- 招待メール自動送信
- パスワードリセット通知メール
- 2段階認証（2FA）
- シングルサインオン（SSO）

### Phase 3
- 勤怠管理との連携
- 職員の顔写真登録
- 勤務シフト管理
- 職員間メッセージング
- 多要素認証（MFA）

---

**作成日**: 2025-01-09
**最終更新**: 2025-01-09
**関連ドキュメント**:
- `03_database.md` - データベース設計
- `04_api.md` - API基本設計
- `22_facility_settings_api.md` - 施設情報設定API
- `23_class_management_api.md` - クラス管理API
