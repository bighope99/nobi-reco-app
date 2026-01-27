# のびレコ データベース設計書

## 📋 目次

1. [データベース概要](https://claude.ai/chat/a124b55d-b68a-4833-a41e-f455665f97a7#1-%E3%83%87%E3%83%BC%E3%82%BF%E3%83%99%E3%83%BC%E3%82%B9%E6%A6%82%E8%A6%81)
2. [技術スタック](https://claude.ai/chat/a124b55d-b68a-4833-a41e-f455665f97a7#2-%E6%8A%80%E8%A1%93%E3%82%B9%E3%82%BF%E3%83%83%E3%82%AF)
3. [ENUM型定義](https://claude.ai/chat/a124b55d-b68a-4833-a41e-f455665f97a7#3-enum%E5%9E%8B%E5%AE%9A%E7%BE%A9)
4. [マスタテーブル](https://claude.ai/chat/a124b55d-b68a-4833-a41e-f455665f97a7#4-%E3%83%9E%E3%82%B9%E3%82%BF%E3%83%86%E3%83%BC%E3%83%96%E3%83%AB)
5. [記録テーブル](https://claude.ai/chat/a124b55d-b68a-4833-a41e-f455665f97a7#5-%E8%A8%98%E9%8C%B2%E3%83%86%E3%83%BC%E3%83%96%E3%83%AB)
6. [設定テーブル](https://claude.ai/chat/a124b55d-b68a-4833-a41e-f455665f97a7#6-%E8%A8%AD%E5%AE%9A%E3%83%86%E3%83%BC%E3%83%96%E3%83%AB)
7. [履歴・ログテーブル](https://claude.ai/chat/a124b55d-b68a-4833-a41e-f455665f97a7#7-%E5%B1%A5%E6%AD%B4%E3%83%AD%E3%82%B0%E3%83%86%E3%83%BC%E3%83%96%E3%83%AB)
8. [中間テーブル](https://claude.ai/chat/a124b55d-b68a-4833-a41e-f455665f97a7#8-%E4%B8%AD%E9%96%93%E3%83%86%E3%83%BC%E3%83%96%E3%83%AB)
9. [テーブル関連図](https://claude.ai/chat/a124b55d-b68a-4833-a41e-f455665f97a7#9-%E3%83%86%E3%83%BC%E3%83%96%E3%83%AB%E9%96%A2%E9%80%A3%E5%9B%B3)
10. [インデックス戦略](https://claude.ai/chat/a124b55d-b68a-4833-a41e-f455665f97a7#10-%E3%82%A4%E3%83%B3%E3%83%87%E3%83%83%E3%82%AF%E3%82%B9%E6%88%A6%E7%95%A5)

---

## 1. データベース概要

### 1.1 基本方針

- **RDBMS**: PostgreSQL（Supabase）
- **命名規則**: [06_database_naming_rules.md](https://claude.ai/chat/06_database_naming_rules.md) に準拠
- **認証**: Supabase Auth を使用
- **論理削除**: 全マスタテーブルに `deleted_at` カラムを実装

### 1.2 テーブル分類

|接頭辞|分類|説明|テーブル数|
|---|---|---|---|
|`m_`|マスタ|会社、施設、職員、子ども、学校など基本エンティティ|7|
|`r_`|記録|日々の業務記録|4|
|`s_`|設定|施設設定、スケジュールパターンなど|3|
|`h_`|履歴・ログ|システムログ、監査用データ|1|
|`_`|中間テーブル|多対多リレーションの紐付け|4|

---

## 2. 技術スタック

### 2.1 データベース

- **PostgreSQL 15+**（Supabase経由）
- **拡張機能**:
    - `uuid-ossp`: UUID生成
    - `pg_trgm`: 日本語全文検索

### 2.2 認証

- **Supabase Auth**
    - `auth.users` テーブル（Supabase管理）
    - `m_users` テーブル（業務情報）
    - 両者を `id` で紐づけ

### 2.3 ファイルストレージ

- **Supabase Storage**
    - 子どもの顔写真
    - 活動記録の写真
    - レポートPDF

### 2.4 PostgreSQL関数

#### 学年計算関数（`calculate_grade`）

```sql
CREATE OR REPLACE FUNCTION calculate_grade(birth_date DATE, grade_add INTEGER DEFAULT 0)
RETURNS INTEGER AS $$
BEGIN
  -- 4月1日基準で学年計算（小学校1年生を基準）
  RETURN CASE
    WHEN EXTRACT(MONTH FROM birth_date) >= 4 THEN
      -- 4月以降生まれ：現在年 - 生年 - 6 + 1
      EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM birth_date) - 6 + 1
    ELSE
      -- 1-3月生まれ：現在年 - 生年 - 6
      EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM birth_date) - 6
  END + COALESCE(grade_add, 0);
END;
$$ LANGUAGE plpgsql;
```

**説明**:
- 生年月日から自動的に現在の学年（1-6年生）を計算
- 日本の学校制度に準拠（4月1日基準）
- `grade_add`で留年・飛び級などの特殊ケースに対応
- ダッシュボードの学年フィルタリングで使用

**使用例**:
```sql
-- 2015年5月生まれの子どもの学年を取得
SELECT calculate_grade('2015-05-01'::DATE, 0);  -- 結果: 4（4年生）

-- 2015年2月生まれの子どもの学年を取得
SELECT calculate_grade('2015-02-01'::DATE, 0);  -- 結果: 5（5年生）

-- 学年調整値を使用（+1年）
SELECT calculate_grade('2015-05-01'::DATE, 1);  -- 結果: 5（5年生）
```

#### JWT カスタムクレーム関数（`custom_access_token_hook`）

```sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_claims jsonb;
  current_facility uuid;
BEGIN
  -- Get primary facility for the user
  SELECT facility_id INTO current_facility
  FROM _user_facility
  WHERE user_id = (event->>'user_id')::uuid
    AND is_current = true
    AND is_primary = true
  LIMIT 1;

  -- If no primary facility, get any current facility
  IF current_facility IS NULL THEN
    SELECT facility_id INTO current_facility
    FROM _user_facility
    WHERE user_id = (event->>'user_id')::uuid
      AND is_current = true
    LIMIT 1;
  END IF;

  -- Build custom claims from m_users table
  SELECT jsonb_build_object(
    'role', role,
    'company_id', company_id,
    'current_facility_id', current_facility
  ) INTO user_claims
  FROM m_users
  WHERE id = (event->>'user_id')::uuid
    AND is_active = true
    AND deleted_at IS NULL;

  -- If user not found or inactive, return event unchanged
  IF user_claims IS NULL THEN
    RETURN event;
  END IF;

  -- Add custom claims to app_metadata
  RETURN jsonb_set(
    event,
    '{claims, app_metadata}',
    COALESCE(event->'claims'->'app_metadata', '{}'::jsonb) || user_claims
  );
END;
$$;
```

**説明**:
- Supabase Auth のログイン時に自動実行され、JWTトークンにカスタムクレームを追加
- ユーザーの `role`, `company_id`, `current_facility_id` を JWT の `app_metadata` に埋め込み
- API実行時のDB問い合わせを削減し、パフォーマンスを向上（約40%のクエリ削減）
- セキュリティ: JWTは署名されているため改ざん不可

**使用方法**:
1. Supabase Dashboard > Database > Hooks で設定
2. Event Type: "Custom Access Token"
3. Function: `public.custom_access_token_hook`

**API側での使用例**:
```typescript
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

const metadata = await getAuthenticatedUserMetadata();
// { role, company_id, current_facility_id } がDB問い合わせなしで取得可能
```

**詳細**: `docs/jwt-custom-claims-setup.md` を参照

#### 観察記録タグ更新関数（`update_observation_tags`）

```sql
CREATE OR REPLACE FUNCTION update_observation_tags(
  p_observation_id UUID,
  p_tag_ids TEXT[],
  p_is_auto_tagged BOOLEAN DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete existing tags for this observation
  DELETE FROM _record_tag
  WHERE observation_id = p_observation_id;

  -- Insert new tags if any provided
  IF p_tag_ids IS NOT NULL AND array_length(p_tag_ids, 1) > 0 THEN
    INSERT INTO _record_tag (observation_id, tag_id, is_auto_tagged, confidence_score)
    SELECT
      p_observation_id,
      unnest(p_tag_ids)::uuid,  -- TEXT配列をUUIDにキャスト
      p_is_auto_tagged,
      NULL;
  END IF;

  -- If any error occurs, transaction will be automatically rolled back
EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise the error with detailed context
    RAISE EXCEPTION 'Failed to update observation tags for observation_id %: %',
      p_observation_id, SQLERRM;
END;
$$;
```

**説明**:
- 観察記録（`r_observation`）のタグを原子的（アトミック）に更新
- 既存のタグを削除してから新しいタグを挿入（トランザクション内で実行）
- エラー発生時は自動的にロールバックされ、データ整合性を保証
- AI解析結果のタグ更新時に使用

**重要: UUID型キャストについて**:
- `p_tag_ids` パラメータは `TEXT[]` 型で受け取る（Supabase RPC呼び出しの互換性のため）
- `_record_tag.tag_id` カラムは `UUID` 型
- `unnest(p_tag_ids)` は `TEXT` 型を返すため、明示的に `::uuid` キャストが必要
- キャストがない場合、型不一致エラー（`cannot automatically cast TEXT to UUID`）が発生する

**使用例**:
```sql
-- 観察記録にタグ「social_skills」「leadership」を追加
SELECT update_observation_tags(
  'observation-uuid-here',
  ARRAY['social_skills', 'leadership'],
  true  -- AI自動タグ付け
);

-- タグを全て削除（空配列を渡す）
SELECT update_observation_tags(
  'observation-uuid-here',
  ARRAY[]::TEXT[],
  true
);
```

**API側での使用例**:
```typescript
const { error } = await supabase.rpc('update_observation_tags', {
  p_observation_id: observationId,
  p_tag_ids: ['social_skills', 'leadership'],
  p_is_auto_tagged: true,
});
```

---

## 3. ENUM型定義

### 3.1 ユーザー権限

```sql
CREATE TYPE user_role AS ENUM (
  'site_admin',      -- サイト管理者（全システム管理）
  'company_admin',   -- 会社経営者（自社の全施設管理）
  'facility_admin',  -- 施設管理者（自施設のみ管理）
  'staff'            -- 一般職員（記録入力のみ）
);
```

### 3.2 性別

```sql
CREATE TYPE gender_type AS ENUM (
  'male',
  'female',
  'other'
);
```

### 3.3 在籍状況

```sql
CREATE TYPE enrollment_status_type AS ENUM (
  'enrolled',   -- 在籍中
  'withdrawn'   -- 退所
);
```

### 3.4 契約形態

```sql
CREATE TYPE enrollment_type AS ENUM (
  'regular',    -- 通年
  'temporary',  -- 一時（長期利用）
  'spot'        -- スポット
);
```

### 3.5 出席ステータス

```sql
CREATE TYPE attendance_status_type AS ENUM (
  'scheduled',  -- 予定通り出席
  'absent',     -- 欠席
  'irregular'   -- イレギュラー出席
);
```

### 3.6 チェック方法

```sql
CREATE TYPE check_method_type AS ENUM (
  'qr',      -- QRコード
  'manual'   -- 手動
);
```

---

## 4. マスタテーブル

### 4.1 会社マスタ（`m_companies`）

```sql
CREATE TABLE IF NOT EXISTS m_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,                    -- 会社名
  name_kana VARCHAR(200),                        -- 会社名カナ
  postal_code VARCHAR(10),                       -- 郵便番号
  address VARCHAR(500),                          -- 住所
  phone VARCHAR(20),                             -- 電話番号
  email VARCHAR(255),                            -- 代表メールアドレス
  is_active BOOLEAN NOT NULL DEFAULT true,       -- 有効/無効
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_companies_is_active ON m_companies(is_active) WHERE deleted_at IS NULL;
```

---

### 4.2 施設マスタ（`m_facilities`）

```sql
CREATE TABLE IF NOT EXISTS m_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES m_companies(id),  -- 所属会社
  name VARCHAR(200) NOT NULL,                           -- 施設名
  name_kana VARCHAR(200),                               -- 施設名カナ
  postal_code VARCHAR(10),                              -- 郵便番号
  address VARCHAR(500),                                 -- 住所
  phone VARCHAR(20),                                    -- 電話番号
  email VARCHAR(255),                                   -- 施設メールアドレス
  capacity INTEGER,                                     -- 定員
  is_active BOOLEAN NOT NULL DEFAULT true,              -- 有効/無効
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_facilities_company_id ON m_facilities(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_facilities_is_active ON m_facilities(is_active) WHERE deleted_at IS NULL;
```

---

### 4.3 クラスマスタ（`m_classes`）

```sql
CREATE TABLE IF NOT EXISTS m_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,                  -- クラス名（例: ひまわり組）
  age_group VARCHAR(50),                       -- 対象年齢（例: 0歳児、1-2歳児、混合）
  capacity INTEGER,                            -- 定員
  room_number VARCHAR(20),                     -- 部屋番号
  color_code VARCHAR(7),                       -- クラスカラー（HEX: #RRGGBB）
  display_order INTEGER,                       -- 表示順序
  is_active BOOLEAN NOT NULL DEFAULT true,     -- 有効/無効
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_classes_facility_id ON m_classes(facility_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_classes_display_order ON m_classes(facility_id, display_order) WHERE deleted_at IS NULL;
```

---

### 4.4 ユーザーマスタ（`m_users`）

```sql
CREATE TABLE IF NOT EXISTS m_users (
  id UUID PRIMARY KEY,  -- auth.users.id と同じ値を使用
  company_id UUID REFERENCES m_companies(id),  -- 所属会社（site_adminはNULL）
  name VARCHAR(100) NOT NULL,                  -- 氏名（漢字）
  name_kana VARCHAR(100),                      -- 氏名（カナ）
  email VARCHAR(255) NOT NULL,                 -- メールアドレス（auth.usersと同期、一意制約なし）
  phone VARCHAR(20),                           -- 電話番号
  hire_date DATE,                              -- 入社日
  role user_role NOT NULL DEFAULT 'staff',     -- 権限
  is_active BOOLEAN NOT NULL DEFAULT true,     -- 有効/無効
  is_retired BOOLEAN NOT NULL DEFAULT false,   -- 退職フラグ
  retired_at TIMESTAMP WITH TIME ZONE,         -- 退職日
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_users_company_id ON m_users(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON m_users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_is_active ON m_users(is_active) WHERE deleted_at IS NULL;
```

**認証との連携**:

- `id` は Supabase Auth の `auth.users.id` と同じ値
- ユーザー作成時に `m_users` にも同時登録

---

### 4.5 子どもマスタ（`m_children`）

```sql
CREATE TABLE IF NOT EXISTS m_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),  -- 所属施設
  school_id UUID REFERENCES m_schools(id),       -- 所属学校（フィルタリング用）

  -- 基本情報
  family_name VARCHAR(50) NOT NULL,              -- 姓（漢字）
  given_name VARCHAR(50) NOT NULL,               -- 名（漢字）
  family_name_kana VARCHAR(50),                  -- 姓（カナ）
  given_name_kana VARCHAR(50),                   -- 名（カナ）
  nickname VARCHAR(50),                          -- 呼び名・略称
  gender gender_type,                            -- 性別
  birth_date DATE NOT NULL,                      -- 生年月日
  grade_add INTEGER DEFAULT 0,                   -- 学年調整値（±2年程度、留年・飛び級対応）
  
  -- 写真・画像
  photo_url TEXT,                                -- 顔写真URL（Supabase Storage）
  photo_permission_public BOOLEAN DEFAULT false, -- 外部公開OK
  photo_permission_share BOOLEAN DEFAULT false,  -- 他の保護者に共有OK
  
  -- 保護者情報（DEPRECATED: m_guardians + _child_guardian を使用）
  -- ⚠️ 2026年1月移行済み。今後は m_guardians + _child_guardian テーブルを使用すること。
  parent_name VARCHAR(100),                      -- 保護者名（非推奨・読み取り専用）
  parent_email VARCHAR(255),                     -- 保護者メールアドレス（非推奨・読み取り専用）
  parent_phone VARCHAR(20),                      -- 保護者電話番号（非推奨・読み取り専用）
  emergency_contact_name VARCHAR(100),           -- 緊急連絡先名（非推奨・読み取り専用）
  emergency_contact_phone VARCHAR(20),           -- 緊急連絡先電話番号（非推奨・読み取り専用）
  sibling_id UUID REFERENCES m_children(id),     -- 兄弟姉妹の紐づけ（DEPRECATED: _child_sibling を使用）
  
  -- レポート設定
  report_name_permission BOOLEAN DEFAULT true,   -- レポートに名前表示OK
  
  -- 健康・特性情報
  allergies TEXT,                                -- アレルギー情報
  health_notes TEXT,                             -- 健康に関する特記事項
  special_needs TEXT,                            -- 特別な支援が必要な場合の詳細
  child_characteristics TEXT,                    -- 子どもの基本特性
  parent_characteristics TEXT,                   -- 親の特性・要望
  
  -- 在籍情報
  enrollment_status enrollment_status_type NOT NULL DEFAULT 'enrolled',
  enrollment_type enrollment_type NOT NULL DEFAULT 'regular',
  enrolled_at TIMESTAMP WITH TIME ZONE,          -- 入所日
  withdrawn_at TIMESTAMP WITH TIME ZONE,         -- 退所日
  
  -- 共通カラム
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_children_facility_id ON m_children(facility_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_children_enrollment_status ON m_children(enrollment_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_children_birth_date ON m_children(birth_date);
CREATE INDEX idx_children_sibling_id ON m_children(sibling_id) WHERE sibling_id IS NOT NULL;

-- 学校・学年フィルター用インデックス
CREATE INDEX idx_children_school_id ON m_children(school_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_children_birth_grade_add ON m_children(birth_date, grade_add) WHERE deleted_at IS NULL;

-- フルテキスト検索用インデックス（名前検索）
CREATE INDEX idx_children_name_search ON m_children
  USING gin(to_tsvector('japanese', family_name || ' ' || given_name || ' ' || COALESCE(nickname, '')));
```

---

### 4.6 観点タグマスタ（`m_observation_tags`）

```sql
CREATE TABLE IF NOT EXISTS m_observation_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,              -- タグ名（例: 自立、社会性）
  name_en VARCHAR(50),                           -- 英語名（将来の国際展開用）
  description TEXT,                              -- 説明
  color VARCHAR(7),                              -- 表示色（HEX: #FF5733）
  sort_order INTEGER NOT NULL DEFAULT 0,         -- 表示順序
  is_active BOOLEAN NOT NULL DEFAULT true,       -- 有効/無効
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_observation_tags_is_active ON m_observation_tags(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_observation_tags_sort_order ON m_observation_tags(sort_order);
```

**初期データ**:

```sql
INSERT INTO m_observation_tags (name, name_en, description, color, sort_order) VALUES
  ('自立', 'Independence', '自分でできることが増える', '#4CAF50', 1),
  ('社会性', 'Sociability', '友達と関わる力', '#2196F3', 2),
  ('感情の安定', 'Emotional Stability', '気持ちのコントロール', '#FF9800', 3),
  ('好奇心', 'Curiosity', '新しいことへの興味', '#9C27B0', 4),
  ('表現力', 'Expressiveness', '言葉や身体で伝える力', '#E91E63', 5);
```

---

### 4.7 保護者マスタ（`m_guardians`）

```sql
CREATE TABLE IF NOT EXISTS m_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),

  -- 基本情報（暗号化）
  family_name TEXT NOT NULL,                     -- 姓（漢字）（AES-256-GCM暗号化、Base64url）
  given_name TEXT NOT NULL DEFAULT '',           -- 名（漢字）（AES-256-GCM暗号化、Base64url）
  family_name_kana TEXT,                         -- 姓（カナ）（AES-256-GCM暗号化、Base64url）
  given_name_kana TEXT,                          -- 名（カナ）（AES-256-GCM暗号化、Base64url）

  -- 連絡先（暗号化）
  phone TEXT,                                    -- 電話番号（AES-256-GCM暗号化、Base64url）
  email TEXT,                                    -- メールアドレス（AES-256-GCM暗号化、Base64url）
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
-- 注意: phone, email は暗号化されているため、インデックスは検索に使用不可
-- 検索には s_pii_search_index テーブルのハッシュインデックスを使用

-- フルテキスト検索用インデックス（名前検索）
-- given_name は使用しないため、family_name のみで検索
CREATE INDEX idx_guardians_name_search ON m_guardians
  USING gin(to_tsvector('japanese', family_name));
```

### 保護者情報の管理方針（2026年1月更新）

**氏名の格納方法**:
- `family_name`: 「佐藤 太郎」（姓名まとめて格納）
- `given_name`: '' （空文字列、スキーマ互換性のため保持）
- `family_name_kana`, `given_name_kana`: 空文字列（オプション）

**緊急連絡先の管理**:
- 主たる保護者: `is_primary = true`（`_child_guardian`テーブル）
- 緊急連絡先（祖父母等）: `is_emergency_contact = true`（`_child_guardian`テーブル）
- 1人の児童に複数の保護者を紐づけ可能

**移行方針**:
- `m_children`テーブルの保護者関連カラム（`parent_name`, `parent_email`, `parent_phone`, `emergency_contact_name`, `emergency_contact_phone`）は非推奨（2026年1月移行済み）
- 新規登録・更新は必ず`m_guardians` + `_child_guardian`を使用すること

---

## 5. 記録テーブル

### 5.1 活動記録（`r_activity`）

```sql
CREATE TABLE IF NOT EXISTS r_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),
  class_id UUID REFERENCES m_classes(id),        -- クラス単位の活動の場合

  -- 記録日時
  activity_date DATE NOT NULL,                   -- 活動日（今日の日付）

  -- 活動内容
  title VARCHAR(200),                            -- タイトル（例: 公園で外遊び）
  content TEXT NOT NULL,                         -- 活動内容（本文）
  snack TEXT,                                    -- おやつ
  mentioned_children TEXT[],                     -- メンションされた子供の暗号化トークンの配列

  -- 写真（JSONBで複数枚保存）
  photos JSONB,                                  -- [{url: "...", caption: "..."}, ...]

  -- イベント・日程情報
  event_name TEXT,                               -- 今日の行事・イベント名
  daily_schedule JSONB,                          -- 1日の流れ（JSONBスキーマ参照）
  role_assignments JSONB,                        -- 役割分担（JSONBスキーマ参照）
  special_notes TEXT,                            -- 特記事項（全体を通しての出来事）
  meal JSONB,                                    -- ごはん情報（JSONBスキーマ参照）

  -- 記録者情報
  created_by UUID NOT NULL REFERENCES m_users(id),
  updated_by UUID REFERENCES m_users(id),

  -- リアルタイム編集用
  last_edited_by UUID REFERENCES m_users(id),    -- 最後に編集した人
  last_edited_at TIMESTAMP WITH TIME ZONE,       -- 最後の編集日時

  -- 共通カラム
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_activity_facility_id ON r_activity(facility_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_activity_class_id ON r_activity(class_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_activity_date ON r_activity(activity_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_activity_created_by ON r_activity(created_by);
CREATE INDEX idx_activity_facility_date ON r_activity(facility_id, activity_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_activity_mentioned_children ON r_activity USING GIN (mentioned_children);
```

**JSONBカラムのスキーマ定義**:

| カラム | スキーマ | 説明 |
|--------|----------|------|
| `daily_schedule` | `[{time: string, content: string}, ...]` | 1日の流れを時刻順に記録 |
| `role_assignments` | `[{user_id: string, user_name: string, role: string}, ...]` | 職員の役割分担 |
| `meal` | `{menu: string, items_to_bring: string, notes: string}` | ごはん情報 |

**daily_schedule の例**:
```json
[
  {"time": "09:00", "content": "朝の会"},
  {"time": "10:00", "content": "外遊び"},
  {"time": "12:00", "content": "昼食"},
  {"time": "14:00", "content": "おやつ"},
  {"time": "15:00", "content": "自由時間"}
]
```

**role_assignments の例**:
```json
[
  {"user_id": "uuid-1", "user_name": "田中", "role": "配膳"},
  {"user_id": "uuid-2", "user_name": "佐藤", "role": "見守り"},
  {"user_id": "uuid-3", "user_name": "山田", "role": "片付け"}
]
```

**meal の例**:
```json
{
  "menu": "カレーライス",
  "items_to_bring": "お箸、スプーン",
  "notes": "アレルギー対応食あり"
}
```

---

### 5.2 子ども観察記録（`r_observation`）

```sql
CREATE TABLE IF NOT EXISTS r_observation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id),
  activity_id UUID REFERENCES r_activity(id),    -- 元になった活動記録（ある場合）
  
  -- 記録日時
  observation_date DATE NOT NULL,                -- 観察日
  
  -- 観察内容
  content TEXT NOT NULL,                         -- 観察内容（本文）
  is_fact BOOLEAN DEFAULT true,                  -- 事実か所感か（AIで判定）
  
  -- AI解析結果
  objective TEXT,                                -- AI解析で分離された客観/事実部分
  subjective TEXT,                               -- AI解析で分離された主観/所感部分
  ai_analyzed_at TIMESTAMP WITH TIME ZONE,      -- AI解析実行日時
  is_ai_analyzed BOOLEAN DEFAULT false,          -- AI解析が実行されたかどうか
  
  -- 写真
  photos JSONB,                                  -- [{url: "...", caption: "..."}, ...]
  
  -- 記録者情報
  created_by UUID NOT NULL REFERENCES m_users(id),
  updated_by UUID REFERENCES m_users(id),
  
  -- 共通カラム
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_observation_child_id ON r_observation(child_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_observation_activity_id ON r_observation(activity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_observation_date ON r_observation(observation_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_observation_created_by ON r_observation(created_by);
CREATE INDEX idx_observation_child_date ON r_observation(child_id, observation_date) WHERE deleted_at IS NULL;
```

---

### 5.3 子どもの声記録（`r_voice`）

```sql
CREATE TABLE IF NOT EXISTS r_voice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id),
  
  -- 記録日時
  voice_date DATE NOT NULL,                      -- 記録日
  
  -- 子どもの声
  content TEXT NOT NULL,                         -- 子どもが言ったこと・意見
  context TEXT,                                  -- どんな場面での発言か
  
  -- 記録者情報
  created_by UUID NOT NULL REFERENCES m_users(id),
  
  -- 共通カラム
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_voice_child_id ON r_voice(child_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_voice_date ON r_voice(voice_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_voice_child_date ON r_voice(child_id, voice_date) WHERE deleted_at IS NULL;
```

---

### 5.4 日次出席予定（`r_daily_attendance`）

```sql
CREATE TABLE IF NOT EXISTS r_daily_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),
  child_id UUID NOT NULL REFERENCES m_children(id),
  
  -- 出席予定日
  attendance_date DATE NOT NULL,
  
  -- 出席ステータス
  status attendance_status_type NOT NULL DEFAULT 'scheduled',
  
  -- 備考（欠席理由など）
  note TEXT,
  
  -- 登録者
  created_by UUID NOT NULL REFERENCES m_users(id),
  updated_by UUID REFERENCES m_users(id),
  
  -- 共通カラム
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(child_id, attendance_date)
);

-- インデックス
CREATE INDEX idx_daily_attendance_facility_date ON r_daily_attendance(facility_id, attendance_date);
CREATE INDEX idx_daily_attendance_child_id ON r_daily_attendance(child_id);
CREATE INDEX idx_daily_attendance_date ON r_daily_attendance(attendance_date);
CREATE INDEX idx_daily_attendance_status ON r_daily_attendance(status);
```

---

## 6. 設定テーブル

### 6.1 曜日通所設定（`s_attendance_schedule`）

```sql
CREATE TABLE IF NOT EXISTS s_attendance_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id) ON DELETE CASCADE,
  
  -- 曜日別の通所設定（true = その曜日に来る）
  monday BOOLEAN NOT NULL DEFAULT false,
  tuesday BOOLEAN NOT NULL DEFAULT false,
  wednesday BOOLEAN NOT NULL DEFAULT false,
  thursday BOOLEAN NOT NULL DEFAULT false,
  friday BOOLEAN NOT NULL DEFAULT false,
  saturday BOOLEAN NOT NULL DEFAULT false,
  sunday BOOLEAN NOT NULL DEFAULT false,
  
  -- 有効期間
  valid_from DATE NOT NULL,                      -- 設定開始日
  valid_to DATE,                                 -- 設定終了日（NULL = 無期限）
  
  is_active BOOLEAN NOT NULL DEFAULT true,       -- 有効/無効
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_attendance_schedule_child_id ON s_attendance_schedule(child_id);
CREATE INDEX idx_attendance_schedule_valid_from ON s_attendance_schedule(valid_from);
CREATE INDEX idx_attendance_schedule_is_active ON s_attendance_schedule(is_active) WHERE is_active = true;
```

---

### 6.2 学校マスタ（`m_schools`）

```sql
CREATE TABLE IF NOT EXISTS m_schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),

  -- 基本情報
  name VARCHAR(200) NOT NULL,                      -- 学校名（例: 第一小学校）
  name_kana VARCHAR(200),                          -- 学校名カナ
  postal_code VARCHAR(10),                         -- 郵便番号
  address VARCHAR(500),                            -- 住所
  phone VARCHAR(20),                               -- 電話番号

  -- ステータス
  is_active BOOLEAN NOT NULL DEFAULT true,         -- 有効/無効

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_m_schools_facility
  ON m_schools(facility_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_m_schools_name
  ON m_schools(name)
  WHERE deleted_at IS NULL;
```

**説明**:
- 学童保育施設が連携する小学校を管理
- 1施設に複数の学校が紐づく可能性がある
- 学校ごとに登校時刻のパターンを設定

---

### 6.3 学校登校スケジュール（`s_school_schedules`）

```sql
CREATE TABLE IF NOT EXISTS s_school_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES m_schools(id) ON DELETE CASCADE,

  -- 対象学年（複数選択可能、配列形式）
  grades TEXT[] NOT NULL,  -- 例: ['1', '2', '3'] → 1~3年生

  -- 曜日別登校時刻
  monday_time TIME,                                -- 月曜日の登校時刻
  tuesday_time TIME,                               -- 火曜日の登校時刻
  wednesday_time TIME,                             -- 水曜日の登校時刻
  thursday_time TIME,                              -- 木曜日の登校時刻
  friday_time TIME,                                -- 金曜日の登校時刻
  saturday_time TIME,                              -- 土曜日の登校時刻（通常NULL）
  sunday_time TIME,                                -- 日曜日の登校時刻（通常NULL）

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_s_school_schedules_school
  ON s_school_schedules(school_id)
  WHERE deleted_at IS NULL;

-- 学年配列の検索用GINインデックス
CREATE INDEX idx_s_school_schedules_grades
  ON s_school_schedules USING gin(grades)
  WHERE deleted_at IS NULL;
```

**説明**:
- 学校ごと・学年グループごとの登校時刻パターン
- 例: 「1~2年生は月~金 08:00登校」「3~6年生は月~金 08:00登校」
- 曜日ごとに異なる時刻を設定可能（短縮授業など）
- 時刻がNULLの曜日は「登校なし」を意味する

---

### 6.4 PII検索用ハッシュテーブル（`s_pii_search_index`）

```sql
CREATE TABLE IF NOT EXISTS s_pii_search_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- エンティティ情報
  entity_type VARCHAR(20) NOT NULL,  -- 'child' or 'guardian'
  entity_id UUID NOT NULL,            -- m_children.id or m_guardians.id
  
  -- 検索タイプ
  search_type VARCHAR(20) NOT NULL,   -- 'phone', 'email', 'name', 'name_kana'
  
  -- 検索用データ
  search_hash VARCHAR(64),            -- SHA-256ハッシュ（電話番号・メールアドレス用、64文字）
  normalized_value TEXT,              -- 正規化された値（名前の部分一致検索用）
  
  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 制約
  CONSTRAINT unique_entity_search UNIQUE(entity_type, entity_id, search_type),
  
  -- チェック制約: search_hash と normalized_value のどちらかは必須
  CONSTRAINT check_search_data CHECK (
    (search_hash IS NOT NULL) OR (normalized_value IS NOT NULL)
  )
);

-- インデックス
-- 1. 電話番号・メールアドレスの完全一致検索用（search_hash）
CREATE INDEX idx_pii_search_hash 
  ON s_pii_search_index(search_hash) 
  WHERE search_hash IS NOT NULL;

-- 2. 名前の部分一致検索用（normalized_value、GINインデックスで日本語検索を高速化）
CREATE INDEX idx_pii_search_normalized_value 
  ON s_pii_search_index USING gin(to_tsvector('japanese', normalized_value))
  WHERE normalized_value IS NOT NULL;

-- 3. エンティティ削除時の検索用（entity_type, entity_id）
CREATE INDEX idx_pii_search_entity 
  ON s_pii_search_index(entity_type, entity_id);

-- 4. 検索パフォーマンス向上用（entity_type, search_type, search_hash）
CREATE INDEX idx_pii_search_type_hash 
  ON s_pii_search_index(entity_type, search_type, search_hash)
  WHERE search_hash IS NOT NULL;

-- 5. 名前検索のパフォーマンス向上用（entity_type, search_type, normalized_value）
CREATE INDEX idx_pii_search_type_normalized 
  ON s_pii_search_index(entity_type, search_type, normalized_value)
  WHERE normalized_value IS NOT NULL;
```

**説明**:
- 暗号化されたPIIフィールドの検索を可能にするためのインデックステーブル
- **電話番号・メールアドレス**: `search_hash`（SHA-256ハッシュ）で完全一致検索
- **名前・フリガナ**: `normalized_value`（正規化された値）で部分一致検索（`ilike`）
- エンティティ（児童・保護者）の保存・更新時に自動的に更新される
- 検索時はこのテーブルから`entity_id`を取得し、本体テーブルから詳細情報を取得

**使用例**:
```sql
-- 電話番号で保護者を検索
SELECT entity_id FROM s_pii_search_index
WHERE entity_type = 'guardian'
  AND search_type = 'phone'
  AND search_hash = 'abc123...'  -- 正規化された電話番号のSHA-256ハッシュ
LIMIT 1;

-- 名前で児童を部分一致検索
SELECT entity_id FROM s_pii_search_index
WHERE entity_type = 'child'
  AND search_type = 'name'
  AND normalized_value ILIKE '%田中%';
```

---

## 7. 履歴・ログテーブル

### 7.1 出欠実績ログ（`h_attendance`）

```sql
CREATE TABLE IF NOT EXISTS h_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),
  
  -- チェックイン情報
  checked_in_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- チェックイン日時
  check_in_method check_method_type NOT NULL DEFAULT 'qr',
  
  -- チェックアウト情報（帰宅時）
  checked_out_at TIMESTAMP WITH TIME ZONE,          -- チェックアウト日時
  check_out_method check_method_type,
  
  -- 記録者（手動の場合）
  checked_in_by UUID REFERENCES m_users(id),
  checked_out_by UUID REFERENCES m_users(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_h_attendance_child_id ON h_attendance(child_id);
CREATE INDEX idx_h_attendance_facility_id ON h_attendance(facility_id);
CREATE INDEX idx_h_attendance_checked_in_at ON h_attendance(checked_in_at);
CREATE INDEX idx_h_attendance_facility_date ON h_attendance(facility_id, DATE(checked_in_at));
```

---

## 8. 中間テーブル

### 8.1 職員-施設（`_user_facility`）

```sql
CREATE TABLE IF NOT EXISTS _user_facility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES m_users(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES m_facilities(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,  -- 主担当施設フラグ

  -- 期間管理（退職・異動時に履歴として保持）
  start_date DATE,                             -- 配属開始日
  end_date DATE,                               -- 配属終了日（退職・異動時）
  is_current BOOLEAN NOT NULL DEFAULT true,    -- 現在所属中か

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, facility_id)
);

-- インデックス
CREATE INDEX idx_user_facility_user_id ON _user_facility(user_id);
CREATE INDEX idx_user_facility_facility_id ON _user_facility(facility_id);
CREATE INDEX idx_user_facility_is_primary ON _user_facility(is_primary) WHERE is_primary = true;
CREATE INDEX idx_user_facility_is_current ON _user_facility(user_id, is_current) WHERE is_current = true;
```

---

### 8.2 職員-クラス（`_user_class`）

```sql
CREATE TABLE IF NOT EXISTS _user_class (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES m_users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES m_classes(id) ON DELETE CASCADE,

  -- クラス内での役割
  class_role VARCHAR(20),                      -- 'main' (主担任) / 'sub' (副担任) / 'assistant' (補助) など

  -- 期間管理（担任変更時に履歴として保持）
  start_date DATE NOT NULL,                    -- 担当開始日
  end_date DATE,                               -- 担当終了日
  is_current BOOLEAN NOT NULL DEFAULT true,    -- 現在担当中か

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, class_id, start_date)
);

-- インデックス
CREATE INDEX idx_user_class_user_id ON _user_class(user_id);
CREATE INDEX idx_user_class_class_id ON _user_class(class_id);
CREATE INDEX idx_user_class_is_current ON _user_class(user_id, is_current) WHERE is_current = true;
CREATE INDEX idx_user_class_role ON _user_class(class_role);
```

---

### 8.3 子ども-クラス（`_child_class`）

```sql
CREATE TABLE IF NOT EXISTS _child_class (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES m_classes(id) ON DELETE CASCADE,
  school_year INTEGER NOT NULL,                  -- 年度（例: 2025）
  started_at DATE NOT NULL,                      -- クラス開始日
  ended_at DATE,                                 -- クラス終了日（進級・退所時）
  is_current BOOLEAN NOT NULL DEFAULT true,      -- 現在所属中か
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(child_id, class_id, school_year)
);

-- インデックス
CREATE INDEX idx_child_class_child_id ON _child_class(child_id);
CREATE INDEX idx_child_class_class_id ON _child_class(class_id);
CREATE INDEX idx_child_class_is_current ON _child_class(is_current) WHERE is_current = true;
CREATE INDEX idx_child_class_school_year ON _child_class(school_year);
```

---

### 8.4 子ども-保護者（`_child_guardian`）

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
```

---

### 8.5 子ども-兄弟姉妹（`_child_sibling`）

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
```

### 兄弟紐づけの運用方針（2026年1月更新）

**`relationship` カラムの扱い**:
- デフォルト値: '兄弟'（固定）
- ユーザー要件により、詳細な関係性（兄/姉/弟/妹）は管理しない
- 将来的な拡張のためカラムは保持

**双方向リレーション**:
- 兄弟紐づけ時に自動的に双方向のレコードを作成
- `child_id` と `sibling_id` を入れ替えた2つのレコードが存在
- 例: 太郎と花子が兄弟の場合、以下の2レコードが作成される
  - `(child_id: 太郎, sibling_id: 花子, relationship: '兄弟')`
  - `(child_id: 花子, sibling_id: 太郎, relationship: '兄弟')`

**移行方針**:
- `m_children.sibling_id`カラムは非推奨（2026年1月移行済み）
- 新規登録・更新は必ず`_child_sibling`テーブルを使用すること

---

### 8.6 観察記録-タグ（`_record_tag`）

```sql
CREATE TABLE IF NOT EXISTS _record_tag (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NOT NULL REFERENCES r_observation(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES m_observation_tags(id) ON DELETE CASCADE,
  
  -- AI自動付与か人間が手動で付けたか
  is_auto_tagged BOOLEAN NOT NULL DEFAULT false,
  confidence_score DECIMAL(3,2),                 -- AI信頼度（0.00 - 1.00）
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(observation_id, tag_id)
);

-- インデックス
CREATE INDEX idx_record_tag_observation_id ON _record_tag(observation_id);
CREATE INDEX idx_record_tag_tag_id ON _record_tag(tag_id);
CREATE INDEX idx_record_tag_is_auto ON _record_tag(is_auto_tagged);
```

---

## 9. テーブル関連図

```
m_companies (会社)
  ├─ m_facilities (施設) ← company_id
  │   ├─ m_classes (クラス) ← facility_id
  │   │   ├─ _user_class (職員-クラス)
  │   │   └─ _child_class (子ども-クラス)
  │   │
  │   ├─ m_children (子ども) ← facility_id
  │   │   ├─ s_attendance_schedule (曜日通所設定)
  │   │   ├─ r_daily_attendance (日次出席予定)
  │   │   ├─ r_observation (観察記録)
  │   │   ├─ r_voice (子どもの声)
  │   │   ├─ h_attendance (出欠実績ログ)
  │   │   ├─ _child_class (子ども-クラス)
  │   │   ├─ _child_guardian (子ども-保護者)
  │   │   └─ _child_sibling (子ども-兄弟姉妹)
  │   │
  │   ├─ m_guardians (保護者) ← facility_id
  │   │   └─ _child_guardian (子ども-保護者)
  │   │
  │   ├─ r_activity (活動記録) ← facility_id
  │   ├─ r_daily_attendance (日次出席予定) ← facility_id
  │   └─ _user_facility (職員-施設)
  │
  └─ m_users (職員) ← company_id
      ├─ _user_facility (職員-施設)
      └─ _user_class (職員-クラス)

m_observation_tags (観点タグ)
  └─ _record_tag (観察記録-タグ)

r_observation (観察記録)
  ├─ _record_tag (観察記録-タグ)
  └─ r_activity (活動記録) ← activity_id（元記録）
```

---

## 10. インデックス戦略

### 10.1 基本方針

- **外部キー**: すべての外部キーにインデックス
- **検索条件**: WHERE句で頻繁に使うカラムにインデックス
- **複合インデックス**: 施設+日付など、セットで検索するカラム
- **論理削除**: `WHERE deleted_at IS NULL` を含む部分インデックス

### 10.2 主要な複合インデックス

```sql
-- 施設 × 日付（頻出パターン）
CREATE INDEX idx_activity_facility_date ON r_activity(facility_id, activity_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_observation_child_date ON r_observation(child_id, observation_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_daily_attendance_facility_date ON r_daily_attendance(facility_id, attendance_date);
```

### 10.3 全文検索インデックス

```sql
-- 子ども名前検索
CREATE INDEX idx_children_name_search ON m_children 
  USING gin(to_tsvector('japanese', family_name || ' ' || given_name || ' ' || COALESCE(nickname, '')));
```

---

## 11. 今後の拡張予定

### 11.1 追加予定テーブル（Phase 2以降）

```
h_login                  ログイン履歴
h_data_export            データエクスポート履歴
s_template               定型文・テンプレート
```

**注**: 以下のテーブルは追加実装済み（詳細は`08_database_additions.md`を参照）
- `m_guardians` - 保護者マスタ
- `_child_guardian` - 子ども-保護者紐付け
- `_child_sibling` - 子ども-兄弟姉妹紐付け
- `r_report` - レポート
- `h_report_share` - レポート共有履歴

### 11.2 将来的な機能拡張

- 保護者向けポータル（認証連携が必要）
- 外部提出資料（`r_submission`）
- AIタグ自動付与の学習データ
- レポートテンプレート管理（複数テンプレート対応）

---

## 12. データ整合性ルール

### 12.1 カスケード削除

- **施設削除** → クラス、活動記録も削除
- **子ども削除** → 観察記録、声記録、出席記録も削除
- **ユーザー削除** → 中間テーブルの紐付けを削除

### 12.2 論理削除対象

- `m_companies`
- `m_facilities`
- `m_classes`
- `m_users`
- `m_children`
- `m_observation_tags`
- `r_activity`
- `r_observation`
- `r_voice`

### 12.3 物理削除対象（ログ系）

- `h_attendance`
- `h_login`（将来）
- `h_report_share`（将来）

---

## 13. セキュリティ考慮事項

### 13.1 Row Level Security（RLS）

Supabase の RLS 機能を使用して、以下を実現：

```sql
-- 例: 施設管理者は自施設のデータのみ閲覧可能
CREATE POLICY facility_access ON r_activity
  FOR SELECT
  USING (
    facility_id IN (
      SELECT facility_id FROM _user_facility WHERE user_id = auth.uid()
    )
  );
```

### 13.2 個人情報の暗号化

- 子どもの写真URL
- 保護者の連絡先
- アレルギー情報

→ Supabase Storage の暗号化機能を使用

---

## 14. パフォーマンス考慮事項

### 14.1 想定データ量（5年後）

|テーブル|レコード数|
|---|---|
|`m_children`|10,000件|
|`m_users`|1,000件|
|`m_facilities`|200件|
|`r_activity`|100,000件|
|`r_observation`|500,000件|
|`h_attendance`|1,000,000件|

### 14.2 パーティショニング検討

5年後以降、以下のテーブルは日付でパーティショニング：

- `r_activity`（月単位）
- `r_observation`（月単位）
- `h_attendance`（月単位）

---

## 15. 変更履歴

### Phase 2（2025年1月）

#### `m_classes`テーブルの変更
- **削除**: `school_year`, `grade` - クラスは年度に紐づかないため不要
- **追加**: `age_group`, `room_number`, `color_code`, `display_order`
- **理由**: 保育園では年度ごとにクラスを作り直さず、固定のクラス名を使い続けるため

#### `_user_facility`テーブルの変更
- **追加**: `is_current`, `start_date`, `end_date`
- **理由**: 退職・異動時にデータを履歴として保持するため

#### `_user_class`テーブルの変更
- **削除**: `is_homeroom`
- **追加**: `class_role` ('main'/'sub'/'assistant'), `is_current`, `start_date`, `end_date`
- **理由**:
  - 主担任・副担任を区別するため
  - 拡張性向上（補助、見習いなどの役割を追加可能）
  - 担任変更の履歴を保持するため

**詳細**: `docs/08_02_schema_updates.md` 参照

### ダッシュボード機能拡張（2025年12月13日）

#### `m_children`テーブルの変更
- **追加**: `school_id UUID REFERENCES m_schools(id)` - 所属学校の紐づけ
- **追加**: `grade_add INTEGER DEFAULT 0` - 学年調整値（留年・飛び級対応）
- **理由**: ダッシュボードで学校・学年フィルタリング機能を実装するため

#### PostgreSQL関数の追加
- **追加**: `calculate_grade(birth_date, grade_add)` - 学年自動計算関数
- **理由**:
  - 生年月日から現在の学年を自動計算
  - 日本の学校制度（4月1日基準）に準拠
  - フィルタリング・ソート処理で使用

#### インデックスの追加
- **追加**: `idx_children_school_id` - 学校フィルター用
- **追加**: `idx_children_birth_grade_add` - 学年計算・フィルター用
- **理由**: ダッシュボードのフィルタリング性能を最適化

**詳細**: `docs/api/08_dashboard_api.md` 参照

### AI解析結果保存機能（2025年12月）

#### `r_observation`テーブルの変更
- **追加**: `objective TEXT` - AI解析で分離された客観/事実部分
- **追加**: `subjective TEXT` - AI解析で分離された主観/所感部分
- **追加**: `ai_analyzed_at TIMESTAMP WITH TIME ZONE` - AI解析実行日時
- **追加**: `is_ai_analyzed BOOLEAN DEFAULT false` - AI解析が実行されたかどうか
- **理由**: 
  - `/records/personal/new` でAI解析結果（objective/subjective）を保存するため
  - 元の `content` は保持しつつ、AI解析で分離された客観/主観を別カラムで管理
  - タグは既存の `_record_tag` テーブルにリレーションで保存（変更なし）
### メールアドレス制約の削除（2025年12月31日）

#### `m_users`テーブルの変更
- **削除**: `email`カラムの`UNIQUE`制約
- **理由**: 削除されたユーザー（`deleted_at IS NOT NULL`）が同じメールアドレスで再登録できるようにするため
- **影響**:
  - アクティブなユーザーのメールアドレス重複はアプリケーション層で制御
  - 論理削除されたユーザーのメールアドレスは再利用可能

**マイグレーション**: `remove_unique_email_constraint`

### データベーススキーマの確認と文書化（2026年1月4日）

#### 背景
出席管理API（`app/api/attendance/checkin/route.ts`）の実装において、`m_classes`（クラスマスタ）と`_child_class`（子ども-クラス紐付け）テーブルへの参照が必要であることが判明。しかし、`supabase/migrations`ディレクトリにこれらのテーブルを作成するマイグレーションファイルが存在しなかったため、データベースの実態を調査。

#### 調査結果
**重要な発見**: 両テーブルは**既にSupabaseデータベースに存在**し、正常に稼働中であることを確認。

**`m_classes`テーブル（現行スキーマ）**:
- ✅ テーブル存在確認: 6件のクラスデータが存在（例: きりん組、くま組、ぞう組）
- ✅ カラム構成: `id`, `facility_id`, `name`, `age_group`, `room_number`, `color_code`, `display_order`, `capacity`, `is_active`, `created_at`, `updated_at`, `deleted_at`
- ✅ 外部キー: `facility_id` → `m_facilities(id)` ON DELETE CASCADE
- ✅ インデックス: `facility_id`, `display_order` で検索最適化済み

**`_child_class`テーブル（現行スキーマ）**:
- ✅ テーブル存在確認: 10件の子ども-クラス紐付けデータが存在
- ✅ カラム構成: `id`, `child_id`, `class_id`, `school_year`, `started_at`, `ended_at`, `is_current`, `created_at`, `updated_at`
- ✅ 外部キー:
  - `child_id` → `m_children(id)` ON DELETE CASCADE
  - `class_id` → `m_classes(id)` ON DELETE CASCADE
- ✅ 一意制約: `(child_id, class_id, school_year)`
- ✅ インデックス: `child_id`, `class_id`, `is_current`, `school_year` で検索最適化済み

**推測**: これらのテーブルは、マイグレーション管理システム導入以前に、Supabase DashboardのSQL Editorや別の方法で直接作成された可能性が高い。

#### 対応内容

1. **マイグレーションファイルの作成**（ドキュメント・履歴管理目的）:
   - ✅ `supabase/migrations/005_create_m_classes.sql` を作成
   - ✅ `supabase/migrations/006_create_child_class_relationship.sql` を作成
   - ⚠️ **重要**: これらのマイグレーションファイルは**Supabaseには適用していない**（テーブルは既存のため）
   - 📝 目的: 既存スキーマ構造をマイグレーションファイルとして記録し、今後の変更履歴管理に備える

2. **Supabaseリレーション機能の動作検証**:
   - ✅ 出席チェックインAPI内で以下のネストクエリが正常動作することを確認
   ```typescript
   _child_class (
     class:m_classes (
       id,
       name
     )
   )
   ```
   - ✅ `_child_class` → `m_classes` の関連を `class:m_classes` で参照可能
   - ✅ LEFT JOIN semanticsにより、クラス未割当の子どもも正常に取得可能

3. **スキーマ整合性の確認**:
   - ✅ セクション「4.3 クラスマスタ」および「8.3 子ども-クラス」の定義と実際のスキーマが一致
   - ✅ 外部キー制約、カスケード削除設定も本ドキュメント記載通りに実装済み

#### 今回の作業で実施したこと・しなかったこと

**実施したこと**:
- ✅ 既存テーブルの存在確認とスキーマ調査
- ✅ マイグレーションファイルの作成（ドキュメント目的）
- ✅ APIクエリの動作検証
- ✅ 本ドキュメントへの変更履歴の追記

**実施しなかったこと**:
- ❌ テーブルの作成（既に存在するため不要）
- ❌ インデックスの追加（既に適切に設定済み）
- ❌ Supabaseへのマイグレーション適用（テーブルは既存のため不要）

#### 結論
- データベーススキーマは本ドキュメントの定義通りに正しく構築済み
- マイグレーション管理外で作成されたテーブルを事後的に文書化
- 今後のスキーマ変更は必ずマイグレーションファイル経由で実施し、Supabaseに適用すること

### 活動記録テーブルの拡張（2026年1月13日）

#### `r_activity`テーブルの変更
- **追加**: `event_name TEXT` - 今日の行事・イベント名
- **追加**: `daily_schedule JSONB` - 1日の流れ
- **追加**: `role_assignments JSONB` - 職員の役割分担
- **追加**: `special_notes TEXT` - 特記事項（全体を通しての出来事）
- **追加**: `meal JSONB` - ごはん情報

**理由**:
- 活動記録に日々の業務運営情報を追加し、より詳細な記録を可能にするため
- イベント名、1日のスケジュール、職員の役割分担、食事情報を構造化して保存

**JSONBスキーマ**:
- `daily_schedule`: `[{time: string, content: string}, ...]`
- `role_assignments`: `[{user_id: string, user_name: string, role: string}, ...]`
- `meal`: `{menu: string, items_to_bring: string, notes: string}`

---

### 保護者マスタの暗号化対応（2026年1月24日）

#### `m_guardians`テーブルの変更
- **変更**: `family_name VARCHAR(50)` → `TEXT`（AES-256-GCM暗号化対応）
- **変更**: `given_name VARCHAR(50)` → `TEXT`（AES-256-GCM暗号化対応）
- **変更**: `family_name_kana VARCHAR(50)` → `TEXT`（AES-256-GCM暗号化対応）
- **変更**: `given_name_kana VARCHAR(50)` → `TEXT`（AES-256-GCM暗号化対応）

**理由**:
- AES-256-GCM + Base64url エンコードにより、暗号化後のデータサイズが60-80文字に膨らむ
- `VARCHAR(50)` では暗号化データが切り詰められ、復号時にデータ欠損が発生
- マイグレーション016で `phone`, `email` を TEXT 化済み。名前カラムも同様に対応

**影響**:
- 既存の切り詰められたデータは再保存が必要
- 緊急連絡先「中谷テスト」が「中谷」のみ表示される問題を解決

**マイグレーション**: `017_alter_guardians_name_columns.sql`

---

**作成日**: 2025年1月
**最終更新**: 2026年1月24日
**管理者**: プロジェクトリーダー