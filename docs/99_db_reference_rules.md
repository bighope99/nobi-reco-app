# データベース参照ルール

## 📋 目的

API仕様書作成およびコード実装時に、データベーススキーマを正しく参照するためのルールを定義します。

---

## 1. 基本原則

### 1.1 信頼できる情報源

**データベースの正式な仕様は `docs/03_database.md` です。**

- ✅ **常に `docs/03_database.md` を参照してテーブル構造を確認する**
- ✅ **追加・変更がある場合は `docs/08_database_additions.md` も確認する**
- ❌ **他のAPIドキュメントのSQL例やコードを鵜呑みにしない**
- ❌ **記憶や推測でカラム名を書かない**

### 1.2 参照手順

1. **テーブル名の確認**: `docs/03_database.md` で該当テーブルを検索
2. **カラム構造の確認**: CREATE TABLE 文を確認し、すべてのカラム名と型を確認
3. **インデックスの確認**: 効率的なクエリのためにインデックスを確認
4. **追加変更の確認**: `docs/08_database_additions.md` で追加変更がないか確認
5. **コード実装**: 確認した情報を元にSQL/TypeScriptコードを記述

---

## 2. 主要テーブルのクイックリファレンス

### 2.1 中間テーブル（よく間違えるポイント）

#### `_user_facility` (職員-施設)

**正しいカラム構造** (docs/03_database.md line 676-694):
```sql
CREATE TABLE IF NOT EXISTS _user_facility (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES m_users(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES m_facilities(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,  -- ✅ 主担当施設フラグ
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, facility_id)
);
```

**❌ よくある間違い:**
- `is_current` カラムは **存在しない**
- `start_date`, `end_date` カラムは **存在しない**

**✅ 正しい使い方:**
- 主担当施設を判定: `WHERE is_primary = true`
- 職員の所属施設を取得: `WHERE user_id = $1`

---

#### `_user_class` (職員-クラス)

**正しいカラム構造** (docs/03_database.md line 698-716):
```sql
CREATE TABLE IF NOT EXISTS _user_class (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES m_users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES m_classes(id) ON DELETE CASCADE,
  is_homeroom BOOLEAN NOT NULL DEFAULT false,  -- ✅ 担任フラグ
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, class_id)
);
```

**❌ よくある間違い:**
- `is_current` カラムは **存在しない**
- `is_main` カラムは **存在しない** (正しくは `is_homeroom`)
- `start_date`, `end_date` カラムは **存在しない**

**✅ 正しい使い方:**
- 担任を判定: `WHERE is_homeroom = true`
- 副担任を判定: `WHERE is_homeroom = false`
- 担当クラスを取得: `WHERE user_id = $1`

---

#### `_child_class` (子ども-クラス)

**正しいカラム構造** (docs/03_database.md line 720-742):
```sql
CREATE TABLE IF NOT EXISTS _child_class (
  id UUID PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES m_children(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES m_classes(id) ON DELETE CASCADE,
  school_year INTEGER NOT NULL,                -- ✅ 年度
  started_at DATE NOT NULL,                    -- ✅ クラス開始日
  ended_at DATE,                               -- ✅ クラス終了日
  is_current BOOLEAN NOT NULL DEFAULT true,    -- ✅ 現在所属中か
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(child_id, class_id, school_year)
);
```

**✅ このテーブルには `is_current` が存在する:**
- 現在所属中のクラスを取得: `WHERE is_current = true`
- 過去のクラスを取得: `WHERE is_current = false`

---

### 2.2 マスタテーブル

#### `m_classes` (クラスマスタ)

**正しいカラム構造** (docs/03_database.md line 178-198):
```sql
CREATE TABLE IF NOT EXISTS m_classes (
  id UUID PRIMARY KEY,
  facility_id UUID NOT NULL REFERENCES m_facilities(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,                  -- ✅ クラス名
  grade VARCHAR(50),                           -- ✅ 学年
  school_year INTEGER NOT NULL,                -- ✅ 年度
  capacity INTEGER,                            -- ✅ 定員
  is_active BOOLEAN NOT NULL DEFAULT true,     -- ✅ 有効/無効
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE
);
```

**❌ よくある間違い:**
- `age_group` カラムは **存在しない** (正しくは `grade`)
- `room_number` カラムは **存在しない**
- `color_code` カラムは **存在しない**
- `display_order` カラムは **存在しない**

**✅ 正しい使い方:**
- 学年情報: `grade` カラムを使用
- クラスの年度: `school_year` カラムを使用
- アクティブなクラス: `WHERE is_active = true AND deleted_at IS NULL`

---

## 3. API仕様書作成時のチェックリスト

### 3.1 データベーススキーマ参照

- [ ] `docs/03_database.md` で該当テーブルのCREATE TABLE文を確認
- [ ] `docs/08_database_additions.md` で追加変更がないか確認
- [ ] すべてのカラム名を正確にコピー（タイポ防止）
- [ ] 型定義（VARCHAR, INTEGER, BOOLEAN等）も正確に記載

### 3.2 クエリ例の記述

- [ ] 実際に存在するカラムのみを使用
- [ ] JOINするテーブルの関係性を確認
- [ ] WHERE句で使用するカラムにインデックスがあるか確認
- [ ] UNIQUEそ約やCHECK制約を考慮

### 3.3 レスポンス例の記述

- [ ] データベースから取得できるカラムのみを含める
- [ ] 計算が必要なフィールドは明示的に「計算」と記載
- [ ] 関連テーブルからのデータ取得方法を明記

---

## 4. コード実装時のチェックリスト

### 4.1 SQL/Supabase クエリ

- [ ] カラム名は `docs/03_database.md` と完全一致しているか
- [ ] `.eq()`, `.filter()` で使用するカラムが存在するか
- [ ] `SELECT` 句に存在しないカラムを含めていないか
- [ ] JOIN/関連テーブルの参照が正しいか

### 4.2 TypeScript 型定義

- [ ] データベースのカラム名と一致しているか
- [ ] カラムの型（string, number, boolean等）が正しいか
- [ ] NULL許容カラムを `?:` で定義しているか
- [ ] ENUM型の値を正しく定義しているか

---

## 5. よくある間違いと修正例

### 例1: `_user_class.is_main` の誤用

**❌ 間違い:**
```typescript
const staff = staffAssignments?.map((sa: any) => ({
  id: sa.m_users.id,
  name: sa.m_users.name,
  is_main: sa.is_main,  // ❌ is_main カラムは存在しない
}));
```

**✅ 正しい:**
```typescript
const staff = staffAssignments?.map((sa: any) => ({
  id: sa.m_users.id,
  name: sa.m_users.name,
  is_homeroom: sa.is_homeroom,  // ✅ 正しいカラム名
}));
```

---

### 例2: `_user_facility.is_current` の誤用

**❌ 間違い:**
```typescript
const { data: userFacility } = await supabase
  .from('_user_facility')
  .select('facility_id')
  .eq('user_id', user.id)
  .eq('is_current', true)  // ❌ is_current カラムは存在しない
  .single();
```

**✅ 正しい:**
```typescript
const { data: userFacility } = await supabase
  .from('_user_facility')
  .select('facility_id')
  .eq('user_id', user.id)
  .eq('is_primary', true)  // ✅ 正しいカラム名
  .single();
```

---

### 例3: `_child_class.is_current` の正しい使用

**✅ 正しい (このテーブルには is_current が存在する):**
```typescript
const { data: childClassAssignments } = await supabase
  .from('_child_class')
  .select('m_children!inner (*)')
  .eq('class_id', classId)
  .eq('is_current', true);  // ✅ このテーブルには存在する
```

---

## 6. ドキュメント更新ルール

### 6.1 データベース仕様の変更時

1. **必ず `docs/03_database.md` を更新**
2. **追加テーブルは `docs/08_database_additions.md` に記載**
3. **関連するAPI仕様書（docs/api/*.md）を更新**
4. **既存のコードを検索して影響箇所をすべて修正**

### 6.2 API仕様書の更新時

1. **`docs/03_database.md` を参照して正確なカラム名を使用**
2. **SQL例を記載する場合は実際に実行可能なクエリにする**
3. **レスポンス例は実際のDBスキーマから取得可能なデータのみ含める**

---

## 7. トラブルシューティング

### エラー: `column "xxx" does not exist`

1. **docs/03_database.md で該当テーブルを検索**
2. **カラム名のスペルミスをチェック**
3. **存在しないカラムを使っていないかチェック**
4. **docs/08_database_additions.md で追加カラムがないか確認**

### エラー: クエリが遅い

1. **docs/03_database.md でインデックスを確認**
2. **WHERE句で使用しているカラムにインデックスがあるか確認**
3. **複合インデックスが必要な場合は追加を検討**

---

## 8. まとめ

**最も重要なルール:**

1. ✅ **`docs/03_database.md` を信頼できる唯一の情報源とする**
2. ✅ **カラム名は必ずドキュメントを確認してから使用する**
3. ✅ **推測や記憶に頼らない**
4. ✅ **API仕様書とコードは常にDBスキーマと一致させる**

---

**作成日**: 2025-12-12
**最終更新**: 2025-12-12
**関連ドキュメント**:
- `03_database.md` - データベース設計書（正式な仕様）
- `08_database_additions.md` - データベース追加・変更仕様書
