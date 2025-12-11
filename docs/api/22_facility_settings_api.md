# 施設管理API仕様書

## 概要
施設の一覧表示、詳細情報の取得・更新機能のAPI仕様を定義します。
会社管理者は複数施設を管理でき、施設管理者は自施設のみを管理できます。

---

## エンドポイント一覧

### 1. 施設一覧取得

**エンドポイント**: `GET /api/facilities`

**説明**: ユーザーがアクセス可能な施設の一覧を取得します。

**リクエストパラメータ**:
```typescript
{
  search?: string;  // 検索キーワード（施設名・住所）
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "facilities": [
      {
        "facility_id": "uuid-facility-1",
        "name": "ひまわり保育園 本園",
        "address": "東京都渋谷区〇〇町1-2-3",
        "phone": "03-1234-5678",
        "email": "[email protected]",

        // 統計情報
        "class_count": 5,
        "children_count": 45,
        "staff_count": 12,

        "created_at": "2010-04-01T10:00:00+09:00",
        "updated_at": "2024-01-15T10:00:00+09:00"
      },
      {
        "facility_id": "uuid-facility-2",
        "name": "ひまわり保育園 分園",
        "address": "東京都渋谷区△△町4-5-6",
        "phone": "03-8765-4321",
        "email": "[email protected]",

        "class_count": 3,
        "children_count": 28,
        "staff_count": 8,

        "created_at": "2015-04-01T10:00:00+09:00",
        "updated_at": "2024-01-15T10:00:00+09:00"
      }
    ],
    "total": 2
  }
}
```

**権限別アクセス制御**:
- **site_admin**: 全施設
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 自施設のみ（閲覧のみ）

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `500 Internal Server Error`: サーバーエラー

---

### 2. 施設詳細情報取得

**エンドポイント**: `GET /api/facilities/:facility_id`

**説明**: 特定の施設の詳細情報を取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "facility_id": "uuid-facility-1",
    "name": "ひまわり保育園 本園",
    "address": "東京都渋谷区〇〇町1-2-3",
    "phone": "03-1234-5678",
    "email": "[email protected]",
    "postal_code": "150-0001",
    "fax": "03-1234-5679",
    "website": "https://himawari-hoikuen.example.com",
    "director_name": "山田 太郎",
    "capacity": 120,
    "established_date": "2010-04-01",
    "license_number": "東京都認可第12345号",

    // 運営会社情報
    "company_id": "uuid-company-1",
    "company_name": "株式会社ひまわり保育",

    // 業務時間
    "opening_time": "07:00",
    "closing_time": "19:00",
    "business_days": {
      "monday": true,
      "tuesday": true,
      "wednesday": true,
      "thursday": true,
      "friday": true,
      "saturday": false,
      "sunday": false,
      "national_holidays": false
    },

    // 統計情報
    "current_children_count": 98,
    "current_staff_count": 25,
    "current_classes_count": 6,

    "created_at": "2010-04-01T10:00:00+09:00",
    "updated_at": "2024-01-15T10:00:00+09:00"
  }
}
```

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 自施設のみ（閲覧のみ）

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 施設が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 3. 施設情報更新

**エンドポイント**: `PUT /api/facilities/:facility_id`

**説明**: 施設の基本情報を更新します。

**リクエストボディ**:
```typescript
{
  "name": "ひまわり保育園 本園",
  "address": "東京都渋谷区〇〇町1-2-3",
  "phone": "03-1234-5678",
  "email": "[email protected]",
  "postal_code": "150-0001",
  "fax": "03-1234-5679",           // 任意
  "website": "https://himawari-hoikuen.example.com",  // 任意
  "director_name": "山田 太郎",
  "capacity": 120,

  // 業務時間
  "opening_time": "07:00",
  "closing_time": "19:00",
  "business_days": {
    "monday": true,
    "tuesday": true,
    "wednesday": true,
    "thursday": true,
    "friday": true,
    "saturday": false,
    "sunday": false,
    "national_holidays": false
  }
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "facility_id": "uuid-facility-1",
    "name": "ひまわり保育園 本園",
    "updated_at": "2024-01-15T10:00:00+09:00"
  },
  "message": "施設情報を更新しました"
}
```

**処理内容**:
1. `m_facilities`テーブルの該当レコードを更新
2. 変更履歴を`h_facility_changes`に記録（Phase 2）
3. キャッシュをクリア

**権限別アクセス制御**:
- **site_admin**: 不可（管理ページでのみ実施予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効なデータ形式
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 施設が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 4. 施設新規作成

**エンドポイント**: `POST /api/facilities`

**説明**: 新しい施設を作成します。

**リクエストボディ**:
```typescript
{
  "name": "ひまわり保育園 第三園",
  "address": "東京都渋谷区◇◇町7-8-9",
  "phone": "03-9999-8888",
  "email": "[email protected]",
  "postal_code": "150-0002",
  "fax": "03-9999-8889",           // 任意
  "website": "https://himawari-daisan.example.com",  // 任意
  "director_name": "鈴木 一郎",
  "capacity": 100,
  "established_date": "2025-04-01",  // 任意
  "license_number": "東京都認可第67890号",  // 任意

  // 業務時間
  "opening_time": "07:00",
  "closing_time": "19:00",
  "business_days": {
    "monday": true,
    "tuesday": true,
    "wednesday": true,
    "thursday": true,
    "friday": true,
    "saturday": false,
    "sunday": false,
    "national_holidays": false
  }
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "facility_id": "uuid-facility-new",
    "name": "ひまわり保育園 第三園",
    "created_at": "2025-01-11T10:00:00+09:00"
  },
  "message": "施設を作成しました"
}
```

**処理内容**:
1. `m_facilities`テーブルに新規レコードを作成
2. `company_id`はセッション情報から自動取得
3. 初期状態は`is_active: true`

**権限別アクセス制御**:
- **site_admin**: 不可
- **company_admin**: 自社に施設を追加可能
- **facility_admin**: 不可
- **staff**: 不可

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効なデータ形式
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: 権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 5. 施設ロゴアップロード

**エンドポイント**: `POST /api/facilities/:facility_id/logo`

**説明**: 施設のロゴ画像をアップロードします。

**リクエストボディ**:
```typescript
{
  "logo": "base64_encoded_image",
  "filename": "logo.png"
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "logo_url": "https://storage.supabase.co/.../facility-logos/uuid-facility-1.png",
    "updated_at": "2024-01-15T10:00:00+09:00"
  }
}
```

**処理内容**:
1. Base64画像をデコード
2. 画像サイズを検証（最大2MB）
3. 画像フォーマットを検証（JPEG, PNG, WEBP）
4. リサイズ（400x400px、アスペクト比維持）
5. Supabase Storageにアップロード
6. `m_facilities`テーブルの`logo_url`を更新

**権限別アクセス制御**:
- **site_admin**: 不可
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効な画像形式、サイズ超過
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: アクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

## データベース要件

### 使用テーブル

#### 1. m_facilities（施設マスタ）
```sql
CREATE TABLE IF NOT EXISTS m_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES m_companies(id),

  -- 基本情報
  name VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,
  postal_code VARCHAR(10),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  fax VARCHAR(20),
  website VARCHAR(200),
  logo_url TEXT,

  -- 施設長情報
  director_name VARCHAR(100),

  -- 施設情報
  capacity INTEGER,
  established_date DATE,
  license_number VARCHAR(100),

  -- 業務時間
  opening_time TIME,
  closing_time TIME,
  business_days JSONB,  -- 営業日設定

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_m_facilities_company
  ON m_facilities(company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_m_facilities_name
  ON m_facilities(name)
  WHERE deleted_at IS NULL;
```

#### 2. h_facility_changes（施設変更履歴）
```sql
CREATE TABLE IF NOT EXISTS h_facility_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),
  user_id UUID NOT NULL REFERENCES m_users(id),

  -- 変更内容
  field_name VARCHAR(50) NOT NULL,
  old_value TEXT,
  new_value TEXT,

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_h_facility_changes_facility
  ON h_facility_changes(facility_id);

CREATE INDEX idx_h_facility_changes_created
  ON h_facility_changes(created_at DESC);
```

---

## クエリ例

### 施設一覧取得クエリ

```sql
SELECT
  f.id as facility_id,
  f.name,
  f.address,
  f.phone,
  f.email,

  -- 統計情報
  (SELECT COUNT(*) FROM m_classes WHERE facility_id = f.id AND deleted_at IS NULL) as class_count,
  (SELECT COUNT(*) FROM m_children WHERE facility_id = f.id AND enrollment_status = 'enrolled' AND deleted_at IS NULL) as children_count,
  (SELECT COUNT(*) FROM _user_facility uf WHERE uf.facility_id = f.id AND uf.is_current = true) as staff_count,

  f.created_at,
  f.updated_at

FROM m_facilities f
INNER JOIN m_companies c ON f.company_id = c.id

WHERE
  -- 権限に応じたフィルタ
  (
    ($1 = 'site_admin') OR  -- site_adminは全施設
    ($1 = 'company_admin' AND c.id = $2) OR  -- company_adminは自社の全施設
    ($1 = 'facility_admin' AND f.id = $3) OR  -- facility_adminは自施設のみ
    ($1 = 'staff' AND f.id = $3)  -- staffは自施設のみ
  )
  AND f.deleted_at IS NULL

  -- 検索フィルタ
  AND (
    $4::VARCHAR IS NULL
    OR f.name ILIKE '%' || $4 || '%'
    OR f.address ILIKE '%' || $4 || '%'
  )

ORDER BY f.name;
```

### 施設詳細情報取得クエリ

```sql
SELECT
  f.id as facility_id,
  f.name,
  f.address,
  f.postal_code,
  f.phone,
  f.email,
  f.fax,
  f.website,
  f.logo_url,
  f.director_name,
  f.capacity,
  f.established_date,
  f.license_number,
  f.opening_time,
  f.closing_time,
  f.business_days,

  -- 運営会社情報
  c.id as company_id,
  c.name as company_name,

  -- 統計情報
  (SELECT COUNT(*) FROM m_children WHERE facility_id = f.id AND enrollment_status = 'enrolled' AND deleted_at IS NULL) as current_children_count,
  (SELECT COUNT(*) FROM m_users WHERE facility_id = f.id AND deleted_at IS NULL) as current_staff_count,
  (SELECT COUNT(*) FROM m_classes WHERE facility_id = f.id AND deleted_at IS NULL) as current_classes_count,

  f.created_at,
  f.updated_at

FROM m_facilities f
INNER JOIN m_companies c ON f.company_id = c.id
WHERE f.id = $1  -- facility_id (from session)
  AND f.deleted_at IS NULL;
```

### 施設情報更新クエリ

```sql
UPDATE m_facilities
SET
  name = $2,
  address = $3,
  postal_code = $4,
  phone = $5,
  email = $6,
  fax = $7,
  website = $8,
  director_name = $9,
  capacity = $10,
  opening_time = $11,
  closing_time = $12,
  business_days = $13,
  updated_at = NOW()
WHERE id = $1  -- facility_id (from session)
  AND deleted_at IS NULL
RETURNING id, name, updated_at;
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
   - 複数施設の横断的な管理が可能

3. **facility_admin（施設管理者）**:
   - 自施設のみアクセス可能
   - 施設情報の更新が可能

4. **staff（一般職員）**:
   - 自施設の情報を閲覧のみ可能
   - 更新権限なし

#### 施設IDの取得
- `facility_id`はリクエストパラメータではなく、セッション情報（`current_facility_id`）から自動取得します
- これにより、ユーザーが不正な施設IDを指定することを防止します

#### データ分離
- RLS（Row Level Security）で施設レベルのデータを分離
- クエリ実行時に`facility_id`または`company_id`でフィルタリング

#### エラーハンドリング戦略
- アクセス権限がない場合: `404 Not Found`を返す
- 理由: `403 Forbidden`ではリソースの存在を推測可能になるため、セキュリティ上`404`を優先

### バリデーション
- 電話番号: 正規表現で形式チェック
- メールアドレス: RFC 5322準拠の形式チェック
- 郵便番号: 7桁の数字形式をチェック
- 営業時間: opening_time < closing_timeの検証
- 定員: 正の整数のみ許可

---

## パフォーマンス考慮事項

### インデックス
```sql
-- 上記のテーブル定義に含まれるインデックスで対応可能
```

### キャッシュ戦略
- 施設情報: 1時間キャッシュ
- 統計情報: 30分キャッシュ
- 更新時にキャッシュをクリア

### 画像処理
- ロゴ画像は非同期処理で最適化
- リサイズはサーバー側で実行
- Supabase Storageの自動最適化機能を活用

---

## エラーハンドリング

### 共通エラーコード
```typescript
{
  "FACILITY_NOT_FOUND": "施設が見つかりません",
  "INVALID_PHONE_FORMAT": "電話番号の形式が正しくありません",
  "INVALID_EMAIL_FORMAT": "メールアドレスの形式が正しくありません",
  "INVALID_POSTAL_CODE": "郵便番号の形式が正しくありません",
  "INVALID_BUSINESS_HOURS": "営業時間が無効です",
  "INVALID_CAPACITY": "定員は正の整数で指定してください",
  "LOGO_TOO_LARGE": "ロゴ画像のサイズが大きすぎます（最大2MB）",
  "INVALID_LOGO_FORMAT": "ロゴ画像の形式が無効です（JPEG, PNG, WEBPのみ）",
  "PERMISSION_DENIED": "施設情報を更新する権限がありません"
}
```

---

## UI/UX要件

### 入力フォーム構成
```tsx
// セクション構成
1. 基本情報
   - 施設名
   - 施設長名
   - ロゴ画像

2. 連絡先情報
   - 郵便番号
   - 住所
   - 電話番号
   - FAX番号
   - メールアドレス
   - ウェブサイトURL

3. 施設情報
   - 定員
   - 設立年月日
   - 認可番号

4. 業務時間
   - 開園時間
   - 閉園時間
   - 営業日設定
```

### バリデーション
- リアルタイムバリデーション（入力時）
- 必須項目のハイライト表示
- エラーメッセージの即座表示
- 郵便番号から住所の自動入力（Phase 2）

---

## 今後の拡張予定

### Phase 2
- 施設変更履歴の表示
- 郵便番号から住所の自動入力
- 複数ロゴ画像の管理（カラー版、モノクロ版）
- 施設紹介文・特色の追加

### Phase 3
- 施設の写真ギャラリー
- 保護者向け施設紹介ページの自動生成
- QRコード付き名刺・パンフレット生成
- 多言語対応（施設情報の翻訳）

---

**作成日**: 2025-01-09
**最終更新**: 2025-01-09
**関連ドキュメント**:
- `03_database.md` - データベース設計
- `04_api.md` - API基本設計
- `23_class_management_api.md` - クラス管理API
- `24_user_management_api.md` - 職員管理API
