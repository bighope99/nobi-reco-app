# 子ども編集API仕様書

## 概要
既存児童情報の編集・更新機能のAPI仕様を定義します。
基本情報、所属・契約情報、家庭・連絡先、ケア・権限設定の更新をサポートします。

---

## エンドポイント一覧

### 1. 子ども情報取得（編集用）

**エンドポイント**: `GET /api/children/:id/edit`

**説明**: 編集画面用に児童の詳細情報を取得します。全ての関連データを含みます。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    // 基本情報
    "basic_info": {
      "child_id": "uuid-child-1",
      "family_name": "田中",
      "given_name": "陽翔",
      "family_name_kana": "タナカ",
      "given_name_kana": "ハルト",
      "nickname": "はるくん",
      "gender": "male",
      "birth_date": "2018-05-15",
      "age": 5,
      "photo_url": "https://storage.supabase.co/.../child-photos/uuid-child-1.jpg"
    },

    // 所属・契約
    "affiliation": {
      "enrollment_status": "enrolled",
      "contract_type": "regular",
      "enrollment_date": "2023-04-01",
      "expected_withdrawal_date": null,
      "class_id": "uuid-class-1",
      "class_name": "ひまわり組",
      "class_history": [
        {
          "class_id": "uuid-class-0",
          "class_name": "ひよこ組",
          "start_date": "2023-04-01",
          "end_date": "2024-03-31"
        },
        {
          "class_id": "uuid-class-1",
          "class_name": "ひまわり組",
          "start_date": "2024-04-01",
          "end_date": null,
          "is_current": true
        }
      ]
    },

    // 保護者情報（筆頭者）
    "primary_guardian": {
      "guardian_id": "uuid-guardian-1",
      "family_name": "田中",
      "given_name": "優子",
      "relationship": "母",
      "phone": "090-1111-2222",
      "email": "[email protected]",
      "address": "東京都渋谷区...",
      "employer": "株式会社〇〇"
    },

    // 緊急連絡先リスト
    "emergency_contacts": [
      {
        "contact_id": "uuid-contact-1",
        "name": "田中 健一",
        "relationship": "父",
        "phone": "090-2222-3333",
        "priority": 1
      },
      {
        "contact_id": "uuid-contact-2",
        "name": "佐藤 花子",
        "relationship": "祖母",
        "phone": "03-1234-5678",
        "priority": 2
      }
    ],

    // 兄弟情報
    "siblings": [
      {
        "child_id": "uuid-child-10",
        "name": "田中 結衣",
        "kana": "タナカ ユイ",
        "relationship": "妹",
        "birth_date": "2020-08-20",
        "class_name": "りす組",
        "enrollment_status": "enrolled"
      }
    ],

    // ケア情報
    "care_info": {
      "has_allergy": true,
      "allergy_detail": "卵、乳製品（完全除去）",
      "child_characteristics": "大きな音が苦手です",
      "parent_notes": "英語が母国語のため、重要な連絡は英語でお願いします",
      "has_medication": false,
      "medication_detail": null,
      "has_chronic_condition": false,
      "chronic_condition_detail": null
    },

    // 権限・プライバシー設定
    "permissions": {
      "photo_allowed": true,
      "report_allowed": true,
      "excursion_allowed": true,
      "medical_consent": false
    },

    // メタ情報
    "created_at": "2023-04-01T10:00:00+09:00",
    "updated_at": "2024-01-10T15:30:00+09:00",
    "last_updated_by": "山田 太郎"
  }
}
```

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 自施設のみ（※Phase 2では担当クラスのみに制限予定）

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 児童が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 2. 子ども情報更新

**エンドポイント**: `PUT /api/children/:id`

**説明**: 児童の情報を更新します。部分更新をサポートし、送信されたフィールドのみが更新されます。

**リクエストボディ**:
```typescript
{
  // 基本情報（任意、更新する項目のみ送信）
  "basic_info": {
    "family_name": "田中",
    "given_name": "陽翔",
    "family_name_kana": "タナカ",
    "given_name_kana": "ハルト",
    "nickname": "はるくん",
    "gender": "male",
    "birth_date": "2018-05-15",
    "photo": "base64_encoded_image"      // 写真を更新する場合
  },

  // 所属・契約（任意）
  "affiliation": {
    "enrollment_status": "enrolled",
    "contract_type": "regular",
    "enrollment_date": "2023-04-01",
    "expected_withdrawal_date": null,
    "class_id": "uuid-class-1"           // クラス変更する場合
  },

  // 保護者情報（任意）
  "primary_guardian": {
    "family_name": "田中",
    "given_name": "優子",
    "relationship": "母",
    "phone": "090-1111-2222",
    "email": "[email protected]",
    "address": "東京都渋谷区...",
    "employer": "株式会社〇〇"
  },

  // 緊急連絡先リスト（任意、完全置き換え）
  "emergency_contacts": [
    {
      "contact_id": "uuid-contact-1",    // 既存の場合はID指定
      "name": "田中 健一",
      "relationship": "父",
      "phone": "090-2222-3333",
      "priority": 1
    },
    {
      // 新規の場合はIDなし
      "name": "佐藤 一郎",
      "relationship": "祖父",
      "phone": "03-9999-8888",
      "priority": 3
    }
  ],

  // 兄弟紐付け（任意、完全置き換え）
  "siblings": [
    {
      "child_id": "uuid-child-10",
      "relationship": "妹"
    }
  ],

  // ケア情報（任意）
  "care_info": {
    "has_allergy": true,
    "allergy_detail": "卵、乳製品（完全除去）、キウイ追加",
    "child_characteristics": "大きな音が苦手です",
    "parent_notes": "英語が母国語のため、重要な連絡は英語でお願いします",
    "has_medication": false,
    "medication_detail": null,
    "has_chronic_condition": false,
    "chronic_condition_detail": null
  },

  // 権限・プライバシー設定（任意）
  "permissions": {
    "photo_allowed": true,
    "report_allowed": true,
    "excursion_allowed": true,
    "medical_consent": false
  }
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "child_id": "uuid-child-1",
    "name": "田中 陽翔",
    "kana": "タナカ ハルト",
    "class_name": "ひまわり組",
    "photo_url": "https://storage.supabase.co/.../child-photos/uuid-child-1.jpg",
    "updated_at": "2024-01-15T10:30:00+09:00",

    // 更新された項目のサマリー
    "changes": {
      "basic_info": ["nickname"],
      "care_info": ["allergy_detail"],
      "emergency_contacts": ["added_1", "updated_1"]
    }
  },
  "message": "児童情報を更新しました"
}
```

**処理内容**:
1. 送信されたフィールドのみを更新（部分更新）
2. `m_children`テーブルの該当レコードを更新
3. 写真がある場合は新しい画像をSupabase Storageにアップロード
4. 保護者情報は`m_guardians`テーブルを更新
5. 緊急連絡先は既存を削除して再作成（完全置き換え）
6. 兄弟紐付けは既存を削除して再作成（完全置き換え）
7. クラス変更の場合は`_child_class`テーブルで履歴を管理
8. 更新履歴を`h_child_updates`に記録（Phase 2）

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 自施設のみ（※Phase 2では担当クラスのみ、または不可に制限予定）

**エラーレスポンス**:
- `400 Bad Request`: 無効なデータ形式、必須項目の削除試行
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 児童が見つからない、またはアクセス権限なし
- `409 Conflict`: 他のユーザーが同時に更新中（楽観的ロック）
- `500 Internal Server Error`: サーバーエラー

---

### 3. クラス変更

**エンドポイント**: `PUT /api/children/:id/change-class`

**説明**: 児童のクラスを変更します。クラス履歴を保持します。

**リクエストボディ**:
```typescript
{
  "new_class_id": "uuid-class-2",
  "effective_date": "2024-04-01",       // 変更開始日
  "reason": "年度切り替え"               // 変更理由（任意）
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "child_id": "uuid-child-1",
    "child_name": "田中 陽翔",
    "old_class": {
      "class_id": "uuid-class-1",
      "class_name": "ひまわり組"
    },
    "new_class": {
      "class_id": "uuid-class-2",
      "class_name": "きりん組"
    },
    "effective_date": "2024-04-01",
    "updated_at": "2024-01-15T10:30:00+09:00"
  },
  "message": "クラスを変更しました"
}
```

**処理内容**:
1. 現在のクラス紐付けの`is_current`をfalseに、`end_date`を設定
2. 新しいクラス紐付けを`_child_class`テーブルに作成
3. クラス変更履歴を`h_class_changes`に記録（Phase 2）

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効なクラスID
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: 権限不足（staffユーザー）
- `404 Not Found`: 児童またはクラスが見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 4. 写真削除

**エンドポイント**: `DELETE /api/children/:id/photo`

**説明**: 児童の写真を削除します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "child_id": "uuid-child-1",
    "child_name": "田中 陽翔",
    "photo_url": null,
    "deleted_at": "2024-01-15T10:30:00+09:00"
  },
  "message": "写真を削除しました"
}
```

**処理内容**:
1. Supabase Storageから画像ファイルを削除
2. `m_children`の`photo_url`をnullに更新

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 自施設のみ（※Phase 2では担当クラスのみに制限予定）

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 児童が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 5. 保護者追加

**エンドポイント**: `POST /api/children/:id/guardians`

**説明**: 児童に新しい保護者を追加します（副保護者など）。

**リクエストボディ**:
```typescript
{
  "family_name": "田中",
  "given_name": "健一",
  "relationship": "父",
  "phone": "090-2222-3333",
  "email": "[email protected]",
  "is_primary": false,
  "emergency_contact": true
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "guardian_id": "uuid-guardian-2",
    "child_id": "uuid-child-1",
    "name": "田中 健一",
    "relationship": "父",
    "is_primary": false,
    "created_at": "2024-01-15T10:30:00+09:00"
  },
  "message": "保護者を追加しました"
}
```

**処理内容**:
1. `m_guardians`テーブルに保護者を作成
2. `_child_guardian`テーブルで児童と紐付け

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 自施設のみ（※Phase 2では不可に制限予定）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 児童が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 6. 保護者削除

**エンドポイント**: `DELETE /api/children/:id/guardians/:guardianId`

**説明**: 児童から保護者の紐付けを削除します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "child_id": "uuid-child-1",
    "guardian_id": "uuid-guardian-2",
    "deleted_at": "2024-01-15T10:30:00+09:00"
  },
  "message": "保護者を削除しました"
}
```

**処理内容**:
1. `_child_guardian`テーブルから紐付けを削除
2. 主保護者（is_primary=true）の削除は拒否

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `400 Bad Request`: 主保護者の削除試行
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: 権限不足（staffユーザー）
- `404 Not Found`: 児童または保護者が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

## データベース要件

### 使用テーブル

#### 1. m_children（子どもマスタ）
```sql
-- 既存のテーブル構造（17_child_registration_api.mdを参照）
```

#### 2. m_guardians（保護者マスタ）
```sql
-- 既存のテーブル構造（17_child_registration_api.mdを参照）
```

#### 3. _child_guardian（子ども-保護者紐付け）
```sql
-- 既存のテーブル構造（17_child_registration_api.mdを参照）
```

#### 4. m_emergency_contacts（緊急連絡先）
```sql
-- 既存のテーブル構造（17_child_registration_api.mdを参照）
```

#### 5. _child_class（子ども-クラス紐付け）
```sql
-- 既存のテーブル構造（17_child_registration_api.mdを参照）
```

#### 6. h_child_updates（児童情報更新履歴）- Phase 2で実装
```sql
CREATE TABLE IF NOT EXISTS h_child_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id),

  -- 更新情報
  updated_by UUID NOT NULL REFERENCES m_users(id),
  updated_fields JSONB,                -- 更新されたフィールドのリスト
  old_values JSONB,                    -- 更新前の値
  new_values JSONB,                    -- 更新後の値

  -- タイムスタンプ
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_h_child_updates_child
  ON h_child_updates(child_id);

CREATE INDEX idx_h_child_updates_updated_by
  ON h_child_updates(updated_by);

CREATE INDEX idx_h_child_updates_updated_at
  ON h_child_updates(updated_at DESC);
```

---

## クエリ例

### 児童情報更新クエリ

```sql
-- トランザクション開始
BEGIN;

-- 1. 児童マスタを更新（部分更新）
UPDATE m_children
SET
  family_name = COALESCE($2, family_name),
  given_name = COALESCE($3, given_name),
  family_name_kana = COALESCE($4, family_name_kana),
  given_name_kana = COALESCE($5, given_name_kana),
  nickname = COALESCE($6, nickname),
  gender = COALESCE($7, gender),
  birth_date = COALESCE($8, birth_date),
  photo_url = COALESCE($9, photo_url),
  has_allergy = COALESCE($10, has_allergy),
  allergy_detail = COALESCE($11, allergy_detail),
  child_characteristics = COALESCE($12, child_characteristics),
  parent_notes = COALESCE($13, parent_notes),
  updated_at = NOW()
WHERE id = $1
  AND facility_id = $14  -- facility_id (from session)
  AND deleted_at IS NULL
RETURNING id, updated_at;

-- 2. 保護者情報を更新
UPDATE m_guardians
SET
  family_name = COALESCE($15, family_name),
  given_name = COALESCE($16, given_name),
  phone = COALESCE($17, phone),
  email = COALESCE($18, email),
  address = COALESCE($19, address),
  employer = COALESCE($20, employer),
  updated_at = NOW()
WHERE id = (
  SELECT guardian_id
  FROM _child_guardian
  WHERE child_id = $1 AND is_primary = true
  LIMIT 1
);

-- 3. 緊急連絡先を更新（完全置き換え）
DELETE FROM m_emergency_contacts
WHERE child_id = $1;

INSERT INTO m_emergency_contacts (
  child_id,
  name,
  relationship,
  phone,
  priority
)
SELECT
  $1,
  contact->>'name',
  contact->>'relationship',
  contact->>'phone',
  (contact->>'priority')::INTEGER
FROM json_array_elements($21::json) AS contact;

-- 4. 更新履歴を記録（Phase 2）
INSERT INTO h_child_updates (
  child_id,
  updated_by,
  updated_fields,
  old_values,
  new_values
) VALUES (
  $1,
  $22,  -- user_id (from session)
  $23,  -- updated_fields (JSON array)
  $24,  -- old_values (JSON object)
  $25   -- new_values (JSON object)
);

COMMIT;
```

### クラス変更クエリ

```sql
-- トランザクション開始
BEGIN;

-- 1. 現在のクラス紐付けを終了
UPDATE _child_class
SET
  is_current = false,
  end_date = $3,  -- effective_date
  updated_at = NOW()
WHERE child_id = $1
  AND is_current = true;

-- 2. 新しいクラス紐付けを作成
INSERT INTO _child_class (
  child_id,
  class_id,
  start_date,
  is_current
) VALUES (
  $1,  -- child_id
  $2,  -- new_class_id
  $3,  -- effective_date
  true
);

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
   - 自社が運営する全施設にアクセス可能
   - 複数施設を横断的に管理

3. **facility_admin（施設管理者）**:
   - 自施設のみアクセス可能
   - 全クラスのデータを閲覧・編集可能

4. **staff（一般職員）**:
   - 現在: 自施設の全児童を編集可能
   - Phase 2: 担当クラスのみ編集可能に制限予定

#### 施設IDの取得
- `facility_id`はリクエストパラメータではなく、セッション情報（`current_facility_id`）から自動取得します
- これにより、ユーザーが不正な施設IDを指定することを防止します

#### データ分離
- RLS（Row Level Security）で施設レベルのデータを分離
- クエリ実行時に`facility_id`でフィルタリング

#### エラーハンドリング戦略
- アクセス権限がない場合: `404 Not Found`を返す
- 理由: `403 Forbidden`ではリソースの存在を推測可能になるため、セキュリティ上`404`を優先

### 個人情報保護
- 保護者の連絡先は暗号化して保存（Phase 2）
- 更新履歴は監査用に保持（Phase 2）
- 写真データの削除時はStorage上のファイルも確実に削除

### 楽観的ロック
- 同時編集の検出に`updated_at`を使用
- 更新時に`updated_at`が変更されている場合は409エラーを返す

---

## パフォーマンス考慮事項

### インデックス
```sql
-- 上記のテーブル定義に含まれるインデックスで対応可能
```

### トランザクション管理
- 複数テーブルの更新は全てトランザクションで保護
- エラー時は全てロールバック

### キャッシュ無効化
- 児童情報更新後は関連キャッシュを無効化
- 一覧ページのキャッシュも更新

---

## エラーハンドリング

### 共通エラーコード
```typescript
{
  "CHILD_NOT_FOUND": "児童が見つかりません",
  "CONCURRENT_UPDATE": "他のユーザーが更新中です。再度読み込んでください",
  "CANNOT_DELETE_PRIMARY_GUARDIAN": "主保護者は削除できません",
  "INVALID_CLASS": "指定されたクラスが見つかりません",
  "PHOTO_UPDATE_FAILED": "写真のアップロードに失敗しました",
  "CANNOT_CHANGE_BIRTH_DATE": "生年月日は変更できません"
}
```

---

## UI/UX要件

### 編集フォーム構成
- 登録フォームと同じレイアウト
- 既存データを初期値として表示
- 変更箇所をハイライト表示
- 変更前・変更後の差分表示（オプション）

### バリデーション
- リアルタイムバリデーション
- 必須項目の削除防止
- 重複チェック（名前+生年月日）

### 変更追跡
- 保存前の確認ダイアログ（変更箇所の表示）
- 自動保存（5分ごと）
- 離脱時の確認ダイアログ

### 履歴表示
- 更新履歴の表示（いつ・誰が・何を変更したか）- Phase 2
- 変更前後の値の比較表示 - Phase 2

---

## 今後の拡張予定

### Phase 2
- 更新履歴の詳細表示
- 変更の取り消し（ロールバック）
- 一括編集機能
- バージョン管理

### Phase 3
- AIによる変更提案
- 自動補完・入力補助
- 変更通知（保護者への通知）
- 多言語対応

---

**作成日**: 2025-01-09
**最終更新**: 2025-01-09
**関連ドキュメント**:
- `03_database.md` - データベース設計
- `04_api.md` - API基本設計
- `16_children_list_api.md` - 子ども一覧API
- `17_child_registration_api.md` - 子ども登録API
