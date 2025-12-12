# 中間テーブル時系列追跡機能追加仕様書

## 📋 目次

1. [変更概要](#1-変更概要)
2. [背景と目的](#2-背景と目的)
3. [変更対象テーブル](#3-変更対象テーブル)
4. [マイグレーション手順](#4-マイグレーション手順)
5. [データ移行スクリプト](#5-データ移行スクリプト)
6. [API仕様への影響](#6-api仕様への影響)
7. [ロールバック手順](#7-ロールバック手順)

---

## 1. 変更概要

### 1.1 背景

現在の`_user_facility`および`_user_class`テーブルには時系列情報がないため、以下の課題があります：

- ❌ 職員の施設・クラス配属履歴を追跡できない
- ❌ 配属変更時に既存レコードを削除する必要がある（データロスト）
- ❌ 「ある時点でどの職員がどの施設・クラスに配属されていたか」を照会できない
- ❌ `_child_class`テーブルとの構造不整合（`_child_class`には時系列情報がある）

### 1.2 解決策

`_user_facility`と`_user_class`に以下のカラムを追加し、`_child_class`と同様の時系列追跡機能を実装します：

```
school_year    年度（例: 2025）
started_at     配属開始日
ended_at       配属終了日（NULL = 現在も継続中）
is_current     現在配属中かどうか（true/false）
```

### 1.3 変更後のメリット

- ✅ 職員の配属履歴を完全に保持（監査トレール）
- ✅ レコード削除せずに配属変更を管理可能
- ✅ 過去の任意時点での配属状況を照会可能
- ✅ 全中間テーブルの構造が統一され、保守性向上

---

## 2. 背景と目的

### 2.1 現在の問題

#### 例: 職員Aの施設配属変更

**現状の実装（時系列追跡なし）:**

```sql
-- 2024年度: 職員Aが施設Xに配属
INSERT INTO _user_facility (user_id, facility_id, is_primary)
VALUES ('user-a-id', 'facility-x-id', true);

-- 2025年度: 職員Aが施設Yに異動
-- → 既存レコードを削除しなければならない（データロスト）
DELETE FROM _user_facility WHERE user_id = 'user-a-id' AND facility_id = 'facility-x-id';
INSERT INTO _user_facility (user_id, facility_id, is_primary)
VALUES ('user-a-id', 'facility-y-id', true);
```

**問題点:**
- 職員Aが2024年度に施設Xに所属していた記録が消える
- 監査ログが残らない
- 過去のレポートやデータとの整合性が取れなくなる

**改善後の実装（時系列追跡あり）:**

```sql
-- 2024年度: 職員Aが施設Xに配属
INSERT INTO _user_facility (user_id, facility_id, school_year, is_primary, started_at, is_current)
VALUES ('user-a-id', 'facility-x-id', 2024, true, '2024-04-01', true);

-- 2025年度: 職員Aが施設Yに異動
-- → 既存レコードを終了させ、新規レコードを追加（履歴保持）
UPDATE _user_facility
SET ended_at = '2025-03-31', is_current = false
WHERE user_id = 'user-a-id' AND facility_id = 'facility-x-id' AND school_year = 2024;

INSERT INTO _user_facility (user_id, facility_id, school_year, is_primary, started_at, is_current)
VALUES ('user-a-id', 'facility-y-id', 2025, true, '2025-04-01', true);
```

**メリット:**
- 職員Aの全配属履歴が保持される
- 「2024年度の施設Xの職員は誰だったか？」を照会可能
- 削除操作が不要

---

### 2.2 `_child_class`との整合性

現在、`_child_class`テーブルには既に時系列追跡機能が実装されています：

```sql
CREATE TABLE IF NOT EXISTS _child_class (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES m_classes(id) ON DELETE CASCADE,
  school_year INTEGER NOT NULL,                  -- ✅ 年度
  started_at DATE NOT NULL,                      -- ✅ クラス開始日
  ended_at DATE,                                 -- ✅ クラス終了日
  is_current BOOLEAN NOT NULL DEFAULT true,      -- ✅ 現在所属中か
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(child_id, class_id, school_year)
);
```

**目標:** `_user_facility`と`_user_class`も同様の構造にし、システム全体で統一されたデータモデルを実現する。

---

## 3. 変更対象テーブル

### 3.1 `_user_facility` (職員-施設)

#### 変更前

```sql
CREATE TABLE IF NOT EXISTS _user_facility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES m_users(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES m_facilities(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,  -- 主担当施設フラグ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, facility_id)
);
```

#### 変更後

```sql
CREATE TABLE IF NOT EXISTS _user_facility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES m_users(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES m_facilities(id) ON DELETE CASCADE,
  school_year INTEGER NOT NULL,                -- ✅ 追加: 年度
  is_primary BOOLEAN NOT NULL DEFAULT false,   -- 主担当施設フラグ
  started_at DATE NOT NULL,                    -- ✅ 追加: 配属開始日
  ended_at DATE,                               -- ✅ 追加: 配属終了日
  is_current BOOLEAN NOT NULL DEFAULT true,    -- ✅ 追加: 現在配属中か
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, facility_id, school_year)    -- ✅ 変更: school_year追加
);
```

#### 追加インデックス

```sql
CREATE INDEX idx_user_facility_is_current ON _user_facility(is_current) WHERE is_current = true;
CREATE INDEX idx_user_facility_school_year ON _user_facility(school_year);
```

---

### 3.2 `_user_class` (職員-クラス)

#### 変更前

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
```

#### 変更後

```sql
CREATE TABLE IF NOT EXISTS _user_class (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES m_users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES m_classes(id) ON DELETE CASCADE,
  school_year INTEGER NOT NULL,                -- ✅ 追加: 年度
  is_homeroom BOOLEAN NOT NULL DEFAULT false,  -- 担任フラグ
  started_at DATE NOT NULL,                    -- ✅ 追加: 担当開始日
  ended_at DATE,                               -- ✅ 追加: 担当終了日
  is_current BOOLEAN NOT NULL DEFAULT true,    -- ✅ 追加: 現在担当中か
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, class_id, school_year)       -- ✅ 変更: school_year追加
);
```

#### 追加インデックス

```sql
CREATE INDEX idx_user_class_is_current ON _user_class(is_current) WHERE is_current = true;
CREATE INDEX idx_user_class_school_year ON _user_class(school_year);
```

---

## 4. マイグレーション手順

### 4.1 実行順序

```bash
# Step 1: UNIQUE制約を削除
psql -U your_user -d your_database -f 01_drop_constraints.sql

# Step 2: 新規カラムを追加
psql -U your_user -d your_database -f 02_add_columns.sql

# Step 3: 既存データにデフォルト値を設定
psql -U your_user -d your_database -f 03_populate_data.sql

# Step 4: NOT NULL制約を追加
psql -U your_user -d your_database -f 04_add_not_null_constraints.sql

# Step 5: 新しいUNIQUE制約を追加
psql -U your_user -d your_database -f 05_add_constraints.sql

# Step 6: インデックスを追加
psql -U your_user -d your_database -f 06_add_indexes.sql

# Step 7: データ整合性チェック
psql -U your_user -d your_database -f 07_data_validation.sql
```

**重要:** 本番環境での実行前に、必ずステージング環境でテストしてください。

---

## 5. データ移行スクリプト

### 5.1 01_drop_constraints.sql

**目的:** 既存のUNIQUE制約を削除（school_yearを追加するため）

```sql
-- _user_facility のUNIQUE制約を削除
ALTER TABLE _user_facility DROP CONSTRAINT IF EXISTS _user_facility_user_id_facility_id_key;

-- _user_class のUNIQUE制約を削除
ALTER TABLE _user_class DROP CONSTRAINT IF EXISTS _user_class_user_id_class_id_key;

-- 実行ログ
SELECT 'Constraints dropped successfully' AS status;
```

---

### 5.2 02_add_columns.sql

**目的:** 新規カラムを追加（NULL許容で追加し、後でNOT NULL制約を追加）

```sql
BEGIN;

-- _user_facility に新規カラムを追加
ALTER TABLE _user_facility
  ADD COLUMN IF NOT EXISTS school_year INTEGER,
  ADD COLUMN IF NOT EXISTS started_at DATE,
  ADD COLUMN IF NOT EXISTS ended_at DATE,
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT true;

-- _user_class に新規カラムを追加
ALTER TABLE _user_class
  ADD COLUMN IF NOT EXISTS school_year INTEGER,
  ADD COLUMN IF NOT EXISTS started_at DATE,
  ADD COLUMN IF NOT EXISTS ended_at DATE,
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT true;

COMMIT;

-- 実行ログ
SELECT 'Columns added successfully' AS status;
```

---

### 5.3 03_populate_data.sql

**目的:** 既存レコードにデフォルト値を設定

```sql
BEGIN;

-- 現在の年度を計算（4月始まりの年度）
-- 例: 2025年1月 → 2024年度、2025年4月 → 2025年度
DO $$
DECLARE
  current_school_year INTEGER;
BEGIN
  current_school_year := CASE
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN EXTRACT(YEAR FROM CURRENT_DATE)
    ELSE EXTRACT(YEAR FROM CURRENT_DATE) - 1
  END;

  -- _user_facility の既存レコードにデフォルト値を設定
  UPDATE _user_facility
  SET
    school_year = current_school_year,
    started_at = COALESCE(started_at, created_at::DATE),  -- 開始日がNULLなら作成日を使用
    is_current = COALESCE(is_current, true)               -- NULLならtrueに設定
  WHERE school_year IS NULL;

  -- _user_class の既存レコードにデフォルト値を設定
  UPDATE _user_class
  SET
    school_year = current_school_year,
    started_at = COALESCE(started_at, created_at::DATE),  -- 開始日がNULLなら作成日を使用
    is_current = COALESCE(is_current, true)               -- NULLならtrueに設定
  WHERE school_year IS NULL;
END $$;

COMMIT;

-- 実行ログ
SELECT 'Data populated successfully' AS status;
SELECT COUNT(*) AS user_facility_updated FROM _user_facility WHERE is_current = true;
SELECT COUNT(*) AS user_class_updated FROM _user_class WHERE is_current = true;
```

---

### 5.4 04_add_not_null_constraints.sql

**目的:** NOT NULL制約を追加

```sql
BEGIN;

-- _user_facility にNOT NULL制約を追加
ALTER TABLE _user_facility
  ALTER COLUMN school_year SET NOT NULL,
  ALTER COLUMN started_at SET NOT NULL,
  ALTER COLUMN is_current SET NOT NULL;

-- _user_class にNOT NULL制約を追加
ALTER TABLE _user_class
  ALTER COLUMN school_year SET NOT NULL,
  ALTER COLUMN started_at SET NOT NULL,
  ALTER COLUMN is_current SET NOT NULL;

COMMIT;

-- 実行ログ
SELECT 'NOT NULL constraints added successfully' AS status;
```

---

### 5.5 05_add_constraints.sql

**目的:** 新しいUNIQUE制約を追加

```sql
BEGIN;

-- _user_facility に新しいUNIQUE制約を追加
ALTER TABLE _user_facility
  ADD CONSTRAINT _user_facility_user_facility_year_unique
  UNIQUE (user_id, facility_id, school_year);

-- _user_class に新しいUNIQUE制約を追加
ALTER TABLE _user_class
  ADD CONSTRAINT _user_class_user_class_year_unique
  UNIQUE (user_id, class_id, school_year);

COMMIT;

-- 実行ログ
SELECT 'UNIQUE constraints added successfully' AS status;
```

---

### 5.6 06_add_indexes.sql

**目的:** 新規インデックスを追加

```sql
-- _user_facility のインデックス追加
CREATE INDEX IF NOT EXISTS idx_user_facility_is_current
  ON _user_facility(is_current)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_user_facility_school_year
  ON _user_facility(school_year);

-- _user_class のインデックス追加
CREATE INDEX IF NOT EXISTS idx_user_class_is_current
  ON _user_class(is_current)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_user_class_school_year
  ON _user_class(school_year);

-- 実行ログ
SELECT 'Indexes added successfully' AS status;
```

---

### 5.7 07_data_validation.sql

**目的:** データ整合性チェック

```sql
-- 1. school_yearがNULLのレコードがないことを確認
SELECT
  '_user_facility' AS table_name,
  COUNT(*) AS null_school_year_count
FROM _user_facility
WHERE school_year IS NULL

UNION ALL

SELECT
  '_user_class' AS table_name,
  COUNT(*) AS null_school_year_count
FROM _user_class
WHERE school_year IS NULL;

-- 2. started_atがNULLのレコードがないことを確認
SELECT
  '_user_facility' AS table_name,
  COUNT(*) AS null_started_at_count
FROM _user_facility
WHERE started_at IS NULL

UNION ALL

SELECT
  '_user_class' AS table_name,
  COUNT(*) AS null_started_at_count
FROM _user_class
WHERE started_at IS NULL;

-- 3. is_currentがtrueのレコード数を表示
SELECT
  '_user_facility' AS table_name,
  COUNT(*) AS current_count
FROM _user_facility
WHERE is_current = true

UNION ALL

SELECT
  '_user_class' AS table_name,
  COUNT(*) AS current_count
FROM _user_class
WHERE is_current = true;

-- 4. 同一ユーザー・同一施設・同一年度で複数is_current=trueがないか確認
SELECT
  user_id,
  facility_id,
  school_year,
  COUNT(*) AS duplicate_count
FROM _user_facility
WHERE is_current = true
GROUP BY user_id, facility_id, school_year
HAVING COUNT(*) > 1;

-- 5. 同一ユーザー・同一クラス・同一年度で複数is_current=trueがないか確認
SELECT
  user_id,
  class_id,
  school_year,
  COUNT(*) AS duplicate_count
FROM _user_class
WHERE is_current = true
GROUP BY user_id, class_id, school_year
HAVING COUNT(*) > 1;

-- 実行ログ
SELECT 'Data validation completed' AS status;
```

---

## 6. API仕様への影響

### 6.1 影響を受けるAPI

以下のAPIエンドポイントは、時系列情報の取り扱いが変更されます：

| エンドポイント | 変更内容 |
|---------------|----------|
| `GET /api/users` | ユーザー一覧取得時に`is_current = true`でフィルタ |
| `GET /api/users/:id` | ユーザー詳細取得時に配属履歴も含める |
| `POST /api/users/:id/facilities` | 職員の施設配属時に年度・開始日を必須化 |
| `PUT /api/users/:id/facilities` | 施設配属変更時に既存レコードを終了させる |
| `POST /api/users/:id/classes` | 職員のクラス配属時に年度・開始日を必須化 |
| `PUT /api/users/:id/classes` | クラス配属変更時に既存レコードを終了させる |
| `GET /api/classes/:id` | クラス詳細取得時に`is_current = true`でフィルタ |
| `GET /api/facilities/:id` | 施設詳細取得時に`is_current = true`でフィルタ |

### 6.2 クエリ例の変更

#### 変更前（is_currentなし）

```typescript
// 職員の現在の配属施設を取得
const { data: userFacility } = await supabase
  .from('_user_facility')
  .select('facility_id')
  .eq('user_id', userId)
  .eq('is_primary', true)  // ❌ これだけでは過去のレコードも含まれる
  .single();
```

#### 変更後（is_currentあり）

```typescript
// 職員の現在の配属施設を取得
const { data: userFacility } = await supabase
  .from('_user_facility')
  .select('facility_id')
  .eq('user_id', userId)
  .eq('is_current', true)   // ✅ 現在の配属のみ
  .eq('is_primary', true)
  .single();

// 職員の配属履歴を取得
const { data: facilityHistory } = await supabase
  .from('_user_facility')
  .select(`
    school_year,
    started_at,
    ended_at,
    is_primary,
    m_facilities (id, name)
  `)
  .eq('user_id', userId)
  .order('school_year', { ascending: false });
```

### 6.3 レコード更新の変更

#### 変更前（削除して再作成）

```typescript
// 職員のクラス配属を変更（削除 → 再作成）
// ❌ 履歴が消える
await supabase
  .from('_user_class')
  .delete()
  .eq('user_id', userId);

await supabase
  .from('_user_class')
  .insert({
    user_id: userId,
    class_id: newClassId,
    is_homeroom: true,
  });
```

#### 変更後（履歴保持）

```typescript
// 職員のクラス配属を変更（既存レコード終了 → 新規レコード追加）
// ✅ 履歴が保持される

// Step 1: 既存の配属を終了
await supabase
  .from('_user_class')
  .update({
    ended_at: '2025-03-31',
    is_current: false,
  })
  .eq('user_id', userId)
  .eq('is_current', true);

// Step 2: 新規配属を追加
await supabase
  .from('_user_class')
  .insert({
    user_id: userId,
    class_id: newClassId,
    school_year: 2025,
    is_homeroom: true,
    started_at: '2025-04-01',
    is_current: true,
  });
```

---

## 7. ロールバック手順

### 7.1 カラム削除（緊急時）

```sql
BEGIN;

-- _user_facility から追加カラムを削除
ALTER TABLE _user_facility
  DROP COLUMN IF EXISTS school_year,
  DROP COLUMN IF EXISTS started_at,
  DROP COLUMN IF EXISTS ended_at,
  DROP COLUMN IF EXISTS is_current;

-- _user_class から追加カラムを削除
ALTER TABLE _user_class
  DROP COLUMN IF EXISTS school_year,
  DROP COLUMN IF EXISTS started_at,
  DROP COLUMN IF EXISTS ended_at,
  DROP COLUMN IF EXISTS is_current;

-- 元のUNIQUE制約を復元
ALTER TABLE _user_facility
  DROP CONSTRAINT IF EXISTS _user_facility_user_facility_year_unique,
  ADD CONSTRAINT _user_facility_user_id_facility_id_key UNIQUE (user_id, facility_id);

ALTER TABLE _user_class
  DROP CONSTRAINT IF EXISTS _user_class_user_class_year_unique,
  ADD CONSTRAINT _user_class_user_id_class_id_key UNIQUE (user_id, class_id);

COMMIT;

-- 実行ログ
SELECT 'Rollback completed' AS status;
```

**警告:** ロールバック実行時は、追加されたカラムのデータが完全に失われます。必ずバックアップを取得してから実行してください。

---

## 8. まとめ

### 8.1 変更内容の確認

- ✅ `_user_facility`に時系列追跡カラムを追加
- ✅ `_user_class`に時系列追跡カラムを追加
- ✅ `_child_class`との構造統一を実現
- ✅ 職員配属履歴の完全保持を実現
- ✅ APIクエリの一貫性向上

### 8.2 実行後の確認事項

1. すべてのマイグレーションスクリプトが正常に実行されたか
2. データ整合性チェックでエラーがないか
3. 既存APIが正常に動作するか（特に`is_current = true`でフィルタ）
4. 新規配属登録・変更機能が正常に動作するか

### 8.3 関連ドキュメント

- `docs/03_database.md` - データベース設計書（更新済み）
- `docs/99_db_reference_rules.md` - データベース参照ルール
- `docs/api/22_facility_settings_api.md` - 施設設定API（要更新）
- `docs/api/23_class_management_api.md` - クラス管理API（要更新）
- `docs/api/24_user_management_api.md` - ユーザー管理API（要更新）

---

**作成日**: 2025-12-12
**最終更新**: 2025-12-12
**管理者**: プロジェクトリーダー
