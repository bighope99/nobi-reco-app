# 子ども登録API仕様書

## 概要
新規児童登録機能のAPI仕様を定義します。
基本情報、所属・契約情報、家庭・連絡先、ケア・権限設定を含む包括的な児童データの新規作成をサポートします。

---

## エンドポイント一覧

### 1. 子ども新規登録

**エンドポイント**: `POST /api/children`

**説明**: 新しい児童を登録します。基本情報、所属、保護者情報、アレルギー情報などを一括で作成します。

**リクエストボディ**:
```typescript
{
  // 基本情報
  "basic_info": {
    "family_name": "田中",
    "given_name": "陽翔",
    "family_name_kana": "タナカ",
    "given_name_kana": "ハルト",
    "nickname": "はるくん",
    "gender": "male",                    // male / female / other
    "birth_date": "2018-05-15",
    "photo": "base64_encoded_image"      // Base64エンコードされた写真データ（任意）
  },

  // 所属・契約
  "affiliation": {
    "enrollment_status": "enrolled",     // enrolled / withdrawn / on_leave / pre_enrollment
    "contract_type": "regular",          // regular / temporary / spot
    "enrollment_date": "2024-04-01",
    "expected_withdrawal_date": null,    // 予定退所日（任意）
    "class_id": "uuid-class-1"          // 所属クラスID
  },

  // 保護者情報（筆頭者）
  "primary_guardian": {
    "family_name": "田中",
    "given_name": "優子",
    "relationship": "母",                 // 母 / 父 / 祖父 / 祖母 / その他
    "phone": "090-1111-2222",
    "email": "[email protected]",
    "address": "東京都渋谷区...",
    "employer": "株式会社〇〇"            // 勤務先（任意）
  },

  // 緊急連絡先リスト（優先順）
  "emergency_contacts": [
    {
      "name": "田中 健一",
      "relationship": "父",
      "phone": "090-2222-3333",
      "priority": 1
    },
    {
      "name": "佐藤 花子",
      "relationship": "祖母",
      "phone": "03-1234-5678",
      "priority": 2
    }
  ],

  // 兄弟紐付け（任意）
  "siblings": [
    {
      "child_id": "uuid-child-10",       // 既存児童のID
      "relationship": "兄"                // 兄 / 姉 / 弟 / 妹
    }
  ],

  // ケア情報
  "care_info": {
    // アレルギー
    "has_allergy": true,
    "allergy_detail": "卵、乳製品（完全除去）",

    // 特性・配慮事項
    "child_characteristics": "大きな音が苦手です",
    "parent_notes": "英語が母国語のため、重要な連絡は英語でお願いします",

    // 医療情報（任意）
    "has_medication": false,
    "medication_detail": null,
    "has_chronic_condition": false,
    "chronic_condition_detail": null
  },

  // 権限・プライバシー設定
  "permissions": {
    "photo_allowed": true,               // HP/SNSへの写真掲載許可
    "report_allowed": true,              // レポートへの記名許可
    "excursion_allowed": true,           // 園外活動許可
    "medical_consent": false             // 緊急時の医療行為同意
  }
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "child_id": "uuid-child-new",
    "name": "田中 陽翔",
    "kana": "タナカ ハルト",
    "class_name": "ひまわり組",
    "enrollment_date": "2024-04-01",
    "photo_url": "https://storage.supabase.co/.../child-photos/uuid-child-new.jpg",

    // 作成された関連データのID
    "guardian_ids": [
      "uuid-guardian-1"
    ],
    "emergency_contact_ids": [
      "uuid-contact-1",
      "uuid-contact-2"
    ],

    "created_at": "2024-01-15T10:00:00+09:00"
  },
  "message": "児童を登録しました"
}
```

**処理内容**:
1. `m_children`テーブルに児童の基本情報を作成
2. 写真がある場合はSupabase Storageにアップロード
3. `m_guardians`テーブルに保護者情報を作成
4. `_child_guardian`テーブルで児童と保護者を紐付け
5. `m_emergency_contacts`テーブルに緊急連絡先を作成
6. 兄弟情報がある場合は`_child_sibling`テーブルに紐付けを作成
7. `_child_class`テーブルでクラス所属を記録
8. アレルギー情報は`m_children`のカラムに保存
9. 権限設定は`m_children`のカラムに保存

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 自施設のみ（※Phase 2では不可に変更予定、管理者のみ）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効なデータ形式、重複する児童情報
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 指定されたclass_idが見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 2. クラス一覧取得

**エンドポイント**: `GET /api/children/classes`

**説明**: 児童登録時に選択可能なクラス一覧を取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "classes": [
      {
        "class_id": "uuid-class-1",
        "name": "ひよこ組",
        "age_group": "0歳児",
        "capacity": 12,
        "current_count": 8
      },
      {
        "class_id": "uuid-class-2",
        "name": "りす組",
        "age_group": "1歳児",
        "capacity": 15,
        "current_count": 12
      },
      {
        "class_id": "uuid-class-3",
        "name": "うさぎ組",
        "age_group": "2歳児",
        "capacity": 18,
        "current_count": 15
      }
    ]
  }
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 自施設のみ

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `500 Internal Server Error`: サーバーエラー

---

### 3. 兄弟検索（電話番号ベース）

**エンドポイント**: `POST /api/children/search-siblings`

**説明**: 保護者の電話番号から既存の児童を検索し、兄弟候補を提示します。

**リクエストボディ**:
```typescript
{
  "phone": "090-1111-2222"
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "found": true,
    "candidates": [
      {
        "child_id": "uuid-child-10",
        "name": "田中 結衣",
        "kana": "タナカ ユイ",
        "birth_date": "2016-03-20",
        "age": 7,
        "class_name": "きりん組",
        "enrollment_status": "enrolled",
        "photo_url": "https://...",
        "guardian_name": "田中 優子",
        "guardian_relationship": "母"
      }
    ],
    "total_found": 1
  }
}
```

**処理内容**:
1. `m_guardians`テーブルで電話番号が一致する保護者を検索
2. `_child_guardian`テーブルで紐付く児童を取得
3. 同一施設内の児童のみを返却
4. 在籍中の児童を優先表示

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 自施設のみ

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足
- `401 Unauthorized`: 認証エラー
- `500 Internal Server Error`: サーバーエラー

---

### 4. 写真アップロード（プレビュー用）

**エンドポイント**: `POST /api/children/upload-photo`

**説明**: 児童の写真を一時アップロードし、プレビューURLを返します。

**リクエストボディ**:
```typescript
{
  "photo": "base64_encoded_image",
  "filename": "child-photo.jpg"
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "temp_url": "https://storage.supabase.co/.../tmp/uuid-temp.jpg",
    "expires_at": "2024-01-15T11:00:00+09:00"  // 1時間後
  }
}
```

**処理内容**:
1. Base64画像をデコード
2. 画像サイズを検証（最大5MB）
3. 画像フォーマットを検証（JPEG, PNG, WEBP）
4. リサイズ（800x800px、アスペクト比維持）
5. Supabase Storageの一時フォルダにアップロード
6. 1時間後に自動削除

**権限別アクセス制御**:
- **site_admin**: 可
- **company_admin**: 可
- **facility_admin**: 可
- **staff**: 可

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効な画像形式、サイズ超過
- `401 Unauthorized`: 認証エラー
- `500 Internal Server Error`: サーバーエラー

---

## データベース要件

### 使用テーブル

#### 1. m_children（子どもマスタ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）

-- 追加カラム（必要に応じて）
ALTER TABLE m_children
ADD COLUMN IF NOT EXISTS nickname VARCHAR(50);

ALTER TABLE m_children
ADD COLUMN IF NOT EXISTS child_characteristics TEXT;

ALTER TABLE m_children
ADD COLUMN IF NOT EXISTS parent_notes TEXT;

ALTER TABLE m_children
ADD COLUMN IF NOT EXISTS has_medication BOOLEAN DEFAULT false;

ALTER TABLE m_children
ADD COLUMN IF NOT EXISTS medication_detail TEXT;

ALTER TABLE m_children
ADD COLUMN IF NOT EXISTS has_chronic_condition BOOLEAN DEFAULT false;

ALTER TABLE m_children
ADD COLUMN IF NOT EXISTS chronic_condition_detail TEXT;

ALTER TABLE m_children
ADD COLUMN IF NOT EXISTS photo_allowed BOOLEAN DEFAULT true;

ALTER TABLE m_children
ADD COLUMN IF NOT EXISTS report_allowed BOOLEAN DEFAULT true;

ALTER TABLE m_children
ADD COLUMN IF NOT EXISTS excursion_allowed BOOLEAN DEFAULT true;

ALTER TABLE m_children
ADD COLUMN IF NOT EXISTS medical_consent BOOLEAN DEFAULT false;
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
  employer VARCHAR(100),

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_m_guardians_facility
  ON m_guardians(facility_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_m_guardians_phone
  ON m_guardians(phone)
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

#### 4. m_emergency_contacts（緊急連絡先）
```sql
CREATE TABLE IF NOT EXISTS m_emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id),

  -- 連絡先情報
  name VARCHAR(100) NOT NULL,
  relationship VARCHAR(20),
  phone VARCHAR(20) NOT NULL,
  priority INTEGER DEFAULT 1,

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_emergency_contacts_child
  ON m_emergency_contacts(child_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_emergency_contacts_priority
  ON m_emergency_contacts(child_id, priority)
  WHERE deleted_at IS NULL;
```

#### 5. _child_sibling（兄弟関係）
```sql
CREATE TABLE IF NOT EXISTS _child_sibling (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id),
  sibling_id UUID NOT NULL REFERENCES m_children(id),

  -- 関係
  relationship VARCHAR(20),  -- 兄 / 姉 / 弟 / 妹

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (child_id, sibling_id),
  CHECK (child_id != sibling_id)
);

CREATE INDEX idx_child_sibling_child
  ON _child_sibling(child_id);

CREATE INDEX idx_child_sibling_sibling
  ON _child_sibling(sibling_id);
```

#### 6. _child_class（子ども-クラス紐付け）
```sql
CREATE TABLE IF NOT EXISTS _child_class (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id),
  class_id UUID NOT NULL REFERENCES m_classes(id),

  -- クラス所属期間
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_child_class_child
  ON _child_class(child_id);

CREATE INDEX idx_child_class_class
  ON _child_class(class_id);

CREATE INDEX idx_child_class_current
  ON _child_class(child_id, is_current)
  WHERE is_current = true;
```

---

## クエリ例

### 児童登録クエリ

```sql
-- トランザクション開始
BEGIN;

-- 1. 児童マスタに挿入
INSERT INTO m_children (
  id,
  facility_id,
  family_name,
  given_name,
  family_name_kana,
  given_name_kana,
  nickname,
  gender,
  birth_date,
  photo_url,
  enrollment_status,
  contract_type,
  enrollment_date,
  has_allergy,
  allergy_detail,
  child_characteristics,
  parent_notes,
  photo_allowed,
  report_allowed,
  excursion_allowed,
  medical_consent
) VALUES (
  gen_random_uuid(),
  $1,  -- facility_id (from session)
  $2,  -- family_name
  $3,  -- given_name
  $4,  -- family_name_kana
  $5,  -- given_name_kana
  $6,  -- nickname
  $7,  -- gender
  $8,  -- birth_date
  $9,  -- photo_url
  $10, -- enrollment_status
  $11, -- contract_type
  $12, -- enrollment_date
  $13, -- has_allergy
  $14, -- allergy_detail
  $15, -- child_characteristics
  $16, -- parent_notes
  $17, -- photo_allowed
  $18, -- report_allowed
  $19, -- excursion_allowed
  $20  -- medical_consent
)
RETURNING id;

-- 2. 保護者マスタに挿入
INSERT INTO m_guardians (
  id,
  facility_id,
  family_name,
  given_name,
  phone,
  email,
  address,
  employer
) VALUES (
  gen_random_uuid(),
  $1,  -- facility_id
  $21, -- guardian_family_name
  $22, -- guardian_given_name
  $23, -- phone
  $24, -- email
  $25, -- address
  $26  -- employer
)
RETURNING id;

-- 3. 子ども-保護者紐付け
INSERT INTO _child_guardian (
  child_id,
  guardian_id,
  relationship,
  is_primary,
  emergency_contact
) VALUES (
  $27, -- child_id (from step 1)
  $28, -- guardian_id (from step 2)
  $29, -- relationship
  true,
  true
);

-- 4. 緊急連絡先を挿入（複数）
INSERT INTO m_emergency_contacts (
  child_id,
  name,
  relationship,
  phone,
  priority
)
SELECT
  $27, -- child_id
  contact->>'name',
  contact->>'relationship',
  contact->>'phone',
  (contact->>'priority')::INTEGER
FROM json_array_elements($30::json) AS contact;

-- 5. クラス紐付け
INSERT INTO _child_class (
  child_id,
  class_id,
  start_date,
  is_current
) VALUES (
  $27, -- child_id
  $31, -- class_id
  $32, -- enrollment_date
  true
);

-- 6. 兄弟紐付け（任意、双方向に挿入）
INSERT INTO _child_sibling (child_id, sibling_id, relationship)
SELECT
  $27,
  sibling->>'child_id',
  sibling->>'relationship'
FROM json_array_elements($33::json) AS sibling
WHERE $33 IS NOT NULL;

INSERT INTO _child_sibling (child_id, sibling_id, relationship)
SELECT
  sibling->>'child_id',
  $27,
  CASE sibling->>'relationship'
    WHEN '兄' THEN '弟'
    WHEN '姉' THEN '妹'
    WHEN '弟' THEN '兄'
    WHEN '妹' THEN '姉'
  END
FROM json_array_elements($33::json) AS sibling
WHERE $33 IS NOT NULL;

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
   - 現在: 自施設の全児童を登録可能
   - Phase 2: 児童登録は管理者のみに制限予定

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
- アレルギー情報は厳重に管理し、必要な職員のみアクセス可能
- 写真データはSupabase Storageに保存し、署名付きURLで配信

### バリデーション
- 電話番号: 正規表現で形式チェック
- メールアドレス: RFC 5322準拠の形式チェック
- 生年月日: 過去の日付のみ許可、未来の日付は拒否
- 画像ファイル: サイズ、形式、内容の検証

---

## パフォーマンス考慮事項

### インデックス
```sql
-- 上記のテーブル定義に含まれるインデックスで対応可能
```

### トランザクション管理
- 児童登録は複数テーブルへの挿入を伴うため、トランザクションで一貫性を保証
- エラー時は全てロールバック

### 画像処理
- 画像アップロードは非同期処理（オプション）
- リサイズはサーバー側で実行し、クライアント負荷を軽減
- Supabase Storageの自動最適化機能を活用

---

## エラーハンドリング

### 共通エラーコード
```typescript
{
  "CHILD_ALREADY_EXISTS": "同じ名前・生年月日の児童が既に登録されています",
  "INVALID_CLASS": "指定されたクラスが見つかりません",
  "INVALID_PHONE_FORMAT": "電話番号の形式が正しくありません",
  "INVALID_EMAIL_FORMAT": "メールアドレスの形式が正しくありません",
  "INVALID_BIRTH_DATE": "生年月日が無効です",
  "PHOTO_TOO_LARGE": "画像ファイルのサイズが大きすぎます（最大5MB）",
  "INVALID_PHOTO_FORMAT": "画像ファイルの形式が無効です（JPEG, PNG, WEBPのみ）",
  "SIBLING_NOT_FOUND": "指定された兄弟が見つかりません"
}
```

---

## UI/UX要件

### 入力フォーム構成
```tsx
// セクション構成
1. 基本情報
   - 写真アップロード
   - 氏名（漢字・フリガナ）
   - 呼び名（愛称）
   - 性別
   - 生年月日

2. 所属・契約
   - ステータス
   - 契約形態
   - 在籍期間
   - クラス

3. 家庭・連絡先
   - 保護者情報（筆頭者）
   - 緊急連絡先リスト（動的追加）
   - 兄弟検索・紐付け

4. ケア・権限設定
   - アレルギー有無・詳細
   - 特性・配慮事項
   - 保護者の状況・要望
   - 権限・プライバシー設定
```

### バリデーション
- リアルタイムバリデーション（入力時）
- 必須項目のハイライト表示
- エラーメッセージの即座表示
- 重複チェック（名前+生年月日）

### 進捗保存
- 一時保存機能（下書き保存）
- 自動保存（5分ごと）
- 離脱時の確認ダイアログ

---

## 今後の拡張予定

### Phase 2
- OCRによる書類自動入力
- 顔写真の自動トリミング・補正
- 保護者アカウント自動作成
- メール通知（登録完了通知）

### Phase 3
- 音声入力対応
- 多言語対応（保護者情報）
- AIによる入力補助
- 一括登録（CSV）との統合

---

**作成日**: 2025-01-09
**最終更新**: 2025-01-09
**関連ドキュメント**:
- `03_database.md` - データベース設計
- `04_api.md` - API基本設計
- `16_children_list_api.md` - 子ども一覧API
- `18_child_edit_api.md` - 子ども編集API
