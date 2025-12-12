# データベーススキーマ更新 - Phase 2

## 概要
設定画面でのデータ取得問題を解決するため、以下のテーブルを更新します。

### 更新の背景

1. **`_user_facility.is_current`が存在しない**
   - 退職・異動時にデータを履歴として残せない
   - API実装で`.eq('is_current', true)`が使えない

2. **担任・副担任の区別ができない**
   - `_user_class.is_homeroom`だけでは主担任と副担任を区別不可
   - 拡張性が低い（見習い、補助などの役割追加が困難）

3. **クラスに不要なカラムがある**
   - `m_classes.school_year`: 保育園のクラスは年度に紐づかない
   - `m_classes.grade`: `age_group`と重複

---

## 🔄 変更内容

### 1. `m_classes`テーブルの更新

#### 削除するカラム
- `school_year` - クラスは年度に紐づかないため不要
- `grade` - `age_group`と重複

#### 追加するカラム
- `room_number` - 部屋番号
- `color_code` - クラスカラー（HEX形式）
- `display_order` - 表示順序

```sql
-- school_year, gradeを削除
ALTER TABLE m_classes
  DROP COLUMN IF EXISTS school_year,
  DROP COLUMN IF EXISTS grade;

-- 新しいカラムを追加
ALTER TABLE m_classes
  ADD COLUMN age_group VARCHAR(50),
  ADD COLUMN room_number VARCHAR(20),
  ADD COLUMN color_code VARCHAR(7),
  ADD COLUMN display_order INTEGER;

-- インデックスの削除と追加
DROP INDEX IF EXISTS idx_classes_school_year;
CREATE INDEX idx_classes_display_order ON m_classes(facility_id, display_order) WHERE deleted_at IS NULL;
```

---

### 2. `_user_facility`テーブルの更新

#### 追加するカラム
- `start_date` - 配属開始日
- `end_date` - 配属終了日（退職・異動時）
- `is_current` - 現在所属中か

```sql
-- 期間管理カラムを追加
ALTER TABLE _user_facility
  ADD COLUMN start_date DATE,
  ADD COLUMN end_date DATE,
  ADD COLUMN is_current BOOLEAN NOT NULL DEFAULT true;

-- 既存データに対してis_current = trueを設定
UPDATE _user_facility SET is_current = true WHERE is_current IS NULL;

-- インデックス追加
CREATE INDEX idx_user_facility_is_current
  ON _user_facility(user_id, is_current)
  WHERE is_current = true;
```

---

### 3. `_user_class`テーブルの更新

#### 削除するカラム
- `is_homeroom` - `class_role`に置き換え

#### 追加するカラム
- `class_role` - クラス内での役割（'main', 'sub', 'assistant'など）
- `start_date` - 担当開始日
- `end_date` - 担当終了日
- `is_current` - 現在担当中か

```sql
-- is_homeroomを削除
ALTER TABLE _user_class
  DROP COLUMN IF EXISTS is_homeroom;

-- 新しいカラムを追加
ALTER TABLE _user_class
  ADD COLUMN class_role VARCHAR(20),
  ADD COLUMN start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN end_date DATE,
  ADD COLUMN is_current BOOLEAN NOT NULL DEFAULT true;

-- 既存データに対してis_current = trueを設定
UPDATE _user_class SET is_current = true WHERE is_current IS NULL;

-- ユニーク制約の変更（user_id, class_id → user_id, class_id, start_date）
ALTER TABLE _user_class DROP CONSTRAINT IF EXISTS _user_class_user_id_class_id_key;
ALTER TABLE _user_class ADD CONSTRAINT _user_class_user_id_class_id_start_date_key
  UNIQUE (user_id, class_id, start_date);

-- インデックスの削除と追加
DROP INDEX IF EXISTS idx_user_class_is_homeroom;
CREATE INDEX idx_user_class_is_current
  ON _user_class(user_id, is_current)
  WHERE is_current = true;
CREATE INDEX idx_user_class_role ON _user_class(class_role);
```

---

## 📝 実行手順

### 1. バックアップ

```sql
-- バックアップ（念のため）
CREATE TABLE m_classes_backup AS SELECT * FROM m_classes;
CREATE TABLE _user_facility_backup AS SELECT * FROM _user_facility;
CREATE TABLE _user_class_backup AS SELECT * FROM _user_class;
```

### 2. マイグレーション実行

```sql
-- ===================================
-- 1. m_classesの更新
-- ===================================

-- school_year, gradeを削除
ALTER TABLE m_classes
  DROP COLUMN IF EXISTS school_year,
  DROP COLUMN IF EXISTS grade;

-- 新しいカラムを追加
ALTER TABLE m_classes
  ADD COLUMN IF NOT EXISTS age_group VARCHAR(50),
  ADD COLUMN IF NOT EXISTS room_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS color_code VARCHAR(7),
  ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- インデックスの削除と追加
DROP INDEX IF EXISTS idx_classes_school_year;
CREATE INDEX IF NOT EXISTS idx_classes_display_order
  ON m_classes(facility_id, display_order)
  WHERE deleted_at IS NULL;

-- ===================================
-- 2. _user_facilityの更新
-- ===================================

-- 期間管理カラムを追加
ALTER TABLE _user_facility
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN;

-- 既存データに対してデフォルト値を設定
UPDATE _user_facility
SET is_current = true
WHERE is_current IS NULL;

-- is_currentをNOT NULLに変更
ALTER TABLE _user_facility
  ALTER COLUMN is_current SET NOT NULL,
  ALTER COLUMN is_current SET DEFAULT true;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_user_facility_is_current
  ON _user_facility(user_id, is_current)
  WHERE is_current = true;

-- ===================================
-- 3. _user_classの更新
-- ===================================

-- 新しいカラムを追加（start_dateはデフォルト値付き）
ALTER TABLE _user_class
  ADD COLUMN IF NOT EXISTS class_role VARCHAR(20),
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN;

-- 既存データに対してデフォルト値を設定
UPDATE _user_class
SET
  start_date = COALESCE(start_date, created_at::DATE, CURRENT_DATE),
  is_current = COALESCE(is_current, true)
WHERE start_date IS NULL OR is_current IS NULL;

-- start_dateとis_currentをNOT NULLに変更
ALTER TABLE _user_class
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN is_current SET NOT NULL,
  ALTER COLUMN is_current SET DEFAULT true;

-- is_homeroomを削除
ALTER TABLE _user_class
  DROP COLUMN IF EXISTS is_homeroom;

-- ユニーク制約の変更
ALTER TABLE _user_class
  DROP CONSTRAINT IF EXISTS _user_class_user_id_class_id_key;

ALTER TABLE _user_class
  ADD CONSTRAINT _user_class_user_id_class_id_start_date_key
  UNIQUE (user_id, class_id, start_date);

-- インデックスの削除と追加
DROP INDEX IF EXISTS idx_user_class_is_homeroom;

CREATE INDEX IF NOT EXISTS idx_user_class_is_current
  ON _user_class(user_id, is_current)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_user_class_role
  ON _user_class(class_role);
```

### 3. 確認

```sql
-- テーブル構造の確認
\d m_classes
\d _user_facility
\d _user_class

-- データの確認
SELECT COUNT(*) FROM m_classes;
SELECT COUNT(*) FROM _user_facility WHERE is_current = true;
SELECT COUNT(*) FROM _user_class WHERE is_current = true;
```

---

## 🔍 影響範囲

### 影響を受けるAPI

1. **GET /api/facilities**
   - `_user_facility.is_current`を使用（修正済み）

2. **GET /api/classes**
   - `_user_class.is_current`を使用（修正済み）

3. **GET /api/classes/[id]**
   - `class_role`で主担任・副担任を区別（要修正）

### 影響を受けるページ

1. **/settings/facility**
   - 職員数カウントで`is_current`使用

2. **/settings/classes**
   - 担任リスト表示で`class_role`使用

3. **/settings/classes/[class_id]**
   - 担任追加・編集で`class_role`使用

---

## ✅ テストケース

### 1. `_user_facility`のテスト

```sql
-- 現在所属中の職員を追加
INSERT INTO _user_facility (user_id, facility_id, is_current, start_date)
VALUES ('user-1', 'facility-1', true, '2024-04-01');

-- 退職した職員（履歴として残る）
INSERT INTO _user_facility (user_id, facility_id, is_current, start_date, end_date)
VALUES ('user-2', 'facility-1', false, '2020-04-01', '2024-03-31');

-- 現在所属中の職員のみ取得できるか確認
SELECT * FROM _user_facility WHERE is_current = true;
```

### 2. `_user_class`のテスト

```sql
-- 主担任を追加
INSERT INTO _user_class (user_id, class_id, class_role, is_current, start_date)
VALUES ('user-1', 'class-1', 'main', true, '2024-04-01');

-- 副担任を追加
INSERT INTO _user_class (user_id, class_id, class_role, is_current, start_date)
VALUES ('user-2', 'class-1', 'sub', true, '2024-04-01');

-- 過去の担任（履歴として残る）
INSERT INTO _user_class (user_id, class_id, class_role, is_current, start_date, end_date)
VALUES ('user-3', 'class-1', 'main', false, '2023-04-01', '2024-03-31');

-- 主担任のみ取得
SELECT * FROM _user_class WHERE class_role = 'main' AND is_current = true;
```

---

## 🚨 注意事項

1. **既存データの扱い**
   - `is_current = true`をデフォルト設定
   - `start_date`は`created_at`または現在日付を使用

2. **ロールバック**
   - バックアップテーブルを作成しているため、問題があれば復元可能

3. **API修正**
   - このマイグレーション実行後、API実装の修正も必要

---

**作成日**: 2025-01-12
**関連ドキュメント**:
- `docs/03_database.md` - データベース設計（最新版）
- `docs/api/22_facility_settings_api.md` - 施設管理API
- `docs/api/23_class_management_api.md` - クラス管理API
