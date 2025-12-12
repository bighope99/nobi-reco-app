# 学校登録テーブル定義書

## 概要
スケジュール設定機能で使用する学校マスタテーブルの定義です。
学校ごと・学年ごと・曜日ごとの登校時刻パターンを管理します。

---

## テーブル定義

### 1. m_schools（学校マスタ）

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

### 2. s_school_schedules（学校登校スケジュール）

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

## データ例

### m_schools

| id | facility_id | name | address | phone |
|----|-------------|------|---------|-------|
| school-1 | facility-1 | 第一小学校 | 東京都渋谷区〇〇1-1-1 | 03-1111-1111 |
| school-2 | facility-1 | 第二小学校 | 東京都渋谷区△△2-2-2 | 03-2222-2222 |

### s_school_schedules

| id | school_id | grades | monday_time | tuesday_time | wednesday_time | thursday_time | friday_time |
|----|-----------|--------|-------------|--------------|----------------|---------------|-------------|
| sched-1 | school-1 | ['1', '2'] | 08:00 | 08:00 | 08:00 | 08:00 | 08:00 |
| sched-2 | school-1 | ['3', '4', '5', '6'] | 08:00 | 08:00 | 08:00 | 08:00 | 08:00 |
| sched-3 | school-2 | ['1', '2', '3', '4', '5', '6'] | 08:30 | 08:30 | 08:30 | 08:30 | 08:30 |

---

## クエリ例

### 学校一覧とスケジュール取得

```sql
SELECT
  s.id as school_id,
  s.name as school_name,
  s.address,
  s.phone,

  -- スケジュール情報を集約
  json_agg(
    json_build_object(
      'schedule_id', ss.id,
      'grades', ss.grades,
      'monday_time', ss.monday_time,
      'tuesday_time', ss.tuesday_time,
      'wednesday_time', ss.wednesday_time,
      'thursday_time', ss.thursday_time,
      'friday_time', ss.friday_time,
      'saturday_time', ss.saturday_time,
      'sunday_time', ss.sunday_time
    )
    ORDER BY array_length(ss.grades, 1), ss.grades[1]
  ) FILTER (WHERE ss.id IS NOT NULL) as schedules,

  s.created_at,
  s.updated_at

FROM m_schools s
LEFT JOIN s_school_schedules ss
  ON s.id = ss.school_id
  AND ss.deleted_at IS NULL

WHERE s.facility_id = $1  -- facility_id (from session)
  AND s.deleted_at IS NULL

GROUP BY s.id, s.name, s.address, s.phone, s.created_at, s.updated_at
ORDER BY s.name;
```

### 特定の児童の登校時刻取得

```sql
-- 児童の学年と曜日から登校時刻を取得
WITH child_info AS (
  SELECT
    c.id,
    cl.grade,
    EXTRACT(DOW FROM $2::DATE) as dow  -- $2 = 対象日付
  FROM m_children c
  INNER JOIN _child_class cc ON c.id = cc.child_id AND cc.is_current = true
  INNER JOIN m_classes cl ON cc.class_id = cl.id
  WHERE c.id = $1  -- $1 = child_id
)
SELECT
  s.name as school_name,
  ss.grades,
  CASE
    WHEN ci.dow = 1 THEN ss.monday_time
    WHEN ci.dow = 2 THEN ss.tuesday_time
    WHEN ci.dow = 3 THEN ss.wednesday_time
    WHEN ci.dow = 4 THEN ss.thursday_time
    WHEN ci.dow = 5 THEN ss.friday_time
    WHEN ci.dow = 6 THEN ss.saturday_time
    WHEN ci.dow = 0 THEN ss.sunday_time
  END as arrival_time

FROM child_info ci
INNER JOIN s_school_schedules ss
  ON ci.grade = ANY(ss.grades)
  AND ss.deleted_at IS NULL
INNER JOIN m_schools s
  ON ss.school_id = s.id
  AND s.deleted_at IS NULL

LIMIT 1;
```

---

## 備考

### 学年配列の扱い

PostgreSQLのTEXT配列を使用:
- 検索: `'1' = ANY(grades)` または `grades @> ARRAY['1']`
- 挿入: `ARRAY['1', '2']` または `'{1,2}'::TEXT[]`

### 学年と学年名のマッピング

アプリケーション側で管理:

```typescript
const gradeLabels = {
  '1': '1年生',
  '2': '2年生',
  '3': '3年生',
  '4': '4年生',
  '5': '5年生',
  '6': '6年生'
};
```

### 将来の拡張

Phase 2で検討:
- 中学校対応（`school_type: 'elementary' | 'junior_high'`）
- 長期休暇期間の設定
- 年間行事カレンダー連携

---

**作成日**: 2025-01-11
**最終更新**: 2025-01-11
**関連ドキュメント**:
- `03_database.md` - データベース設計全体
- `13_attendance_schedule_api.md` - 出席予定API
- `docs/api/26_schedule_settings_api.md` - スケジュール設定API（これから作成）
