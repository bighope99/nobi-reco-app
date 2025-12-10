# 出席予定登録API仕様書

## 概要
児童の曜日ベースの通所予定パターンを管理するAPI群の仕様を定義します。
各児童がどの曜日に通所予定かを設定し、出欠管理の基準となるデータを提供します。

---

## エンドポイント一覧

### 1. 出席予定パターン一覧取得

**エンドポイント**: `GET /api/attendance/schedules`

**説明**: 施設内の全児童の曜日別通所予定を取得します。

**リクエストパラメータ**:
```typescript
{
  class_id?: string;        // クラスフィルター（任意）
  search?: string;          // 検索キーワード（名前・かな）
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "children": [
      {
        "child_id": "uuid-child-1",
        "name": "田中 陽翔",
        "kana": "たなか はると",
        "class_id": "uuid-class-1",
        "class_name": "ひまわり組",
        "grade": "6年生",
        "photo_url": "https://...",

        // 曜日別通所予定（1=月曜、5=金曜）
        "schedule": {
          "monday": true,
          "tuesday": true,
          "wednesday": true,
          "thursday": true,
          "friday": false,    // 金曜日は通所予定なし
          "saturday": false,
          "sunday": false
        },

        "updated_at": "2024-01-10T10:00:00+09:00"
      },
      {
        "child_id": "uuid-child-2",
        "name": "佐藤 美咲",
        "kana": "さとう みさき",
        "class_id": "uuid-class-1",
        "class_name": "ひまわり組",
        "grade": "5年生",
        "photo_url": "https://...",

        "schedule": {
          "monday": true,
          "tuesday": false,
          "wednesday": true,
          "thursday": false,
          "friday": true,
          "saturday": false,
          "sunday": false
        },

        "updated_at": "2024-01-10T10:00:00+09:00"
      }
    ],
    "total": 25
  }
}
```

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス閲覧可）

**エラーレスポンス**:
- `400 Bad Request`: 無効なパラメータ
- `401 Unauthorized`: 認証エラー
- `500 Internal Server Error`: サーバーエラー

---

### 2. 個別児童の出席予定パターン取得

**エンドポイント**: `GET /api/attendance/schedules/:childId`

**説明**: 特定の児童の曜日別通所予定を取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "child_id": "uuid-child-1",
    "name": "田中 陽翔",
    "class_name": "ひまわり組",

    "schedule": {
      "monday": true,
      "tuesday": true,
      "wednesday": true,
      "thursday": true,
      "friday": false,
      "saturday": false,
      "sunday": false
    },

    "effective_from": "2024-01-01",    // 有効期間開始日
    "effective_to": null,               // 有効期間終了日（nullの場合は無期限）

    "created_at": "2024-01-10T10:00:00+09:00",
    "updated_at": "2024-01-10T10:00:00+09:00"
  }
}
```

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス閲覧可）

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 児童が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 3. 出席予定パターンの登録・更新

**エンドポイント**: `PUT /api/attendance/schedules/:childId`

**説明**: 特定の児童の曜日別通所予定を登録・更新します。

**リクエストボディ**:
```typescript
{
  "schedule": {
    "monday": true,
    "tuesday": true,
    "wednesday": true,
    "thursday": true,
    "friday": false,
    "saturday": false,
    "sunday": false
  },
  "effective_from": "2024-01-01",    // 有効期間開始日（任意）
  "effective_to": null                // 有効期間終了日（任意）
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "child_id": "uuid-child-1",
    "schedule": {
      "monday": true,
      "tuesday": true,
      "wednesday": true,
      "thursday": true,
      "friday": false,
      "saturday": false,
      "sunday": false
    },
    "updated_at": "2024-01-10T10:30:00+09:00"
  }
}
```

**処理内容**:
1. `s_attendance_schedule` テーブルにレコードを作成または更新
2. 既存のレコードがある場合は上書き
3. 更新履歴は `updated_at` で管理

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス操作可）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効な曜日設定
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 児童が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 4. 一括出席予定パターン更新

**エンドポイント**: `POST /api/attendance/schedules/bulk-update`

**説明**: 複数の児童の出席予定パターンを一括更新します。

**リクエストボディ**:
```typescript
{
  "updates": [
    {
      "child_id": "uuid-child-1",
      "schedule": {
        "monday": true,
        "tuesday": true,
        "wednesday": true,
        "thursday": true,
        "friday": false,
        "saturday": false,
        "sunday": false
      }
    },
    {
      "child_id": "uuid-child-2",
      "schedule": {
        "monday": true,
        "tuesday": false,
        "wednesday": true,
        "thursday": false,
        "friday": true,
        "saturday": false,
        "sunday": false
      }
    }
  ]
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "updated_count": 2,
    "failed_count": 0,
    "results": [
      {
        "child_id": "uuid-child-1",
        "status": "success"
      },
      {
        "child_id": "uuid-child-2",
        "status": "success"
      }
    ]
  }
}
```

**処理内容**:
1. トランザクション内で複数の児童の予定を更新
2. 一部失敗した場合でも他の更新は継続（部分成功を許容）
3. 失敗した児童については `failed_count` でカウント

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス操作可）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効な曜日設定
- `401 Unauthorized`: 認証エラー
- `500 Internal Server Error`: サーバーエラー

---

### 5. 特定日の出席予定児童一覧取得

**エンドポイント**: `GET /api/attendance/schedules/expected`

**説明**: 特定の日付に出席予定の児童一覧を取得します（曜日パターンに基づく）。

**リクエストパラメータ**:
```typescript
{
  date: string;             // 対象日（YYYY-MM-DD）
  class_id?: string;        // クラスフィルター（任意）
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "date": "2024-01-15",       // 月曜日の例
    "weekday": "monday",
    "weekday_jp": "月",

    "expected_children": [
      {
        "child_id": "uuid-child-1",
        "name": "田中 陽翔",
        "kana": "たなか はると",
        "class_id": "uuid-class-1",
        "class_name": "ひまわり組",
        "photo_url": "https://...",
        "is_expected": true     // この日の出席予定: true
      },
      {
        "child_id": "uuid-child-2",
        "name": "佐藤 美咲",
        "kana": "さとう みさき",
        "class_id": "uuid-class-1",
        "class_name": "ひまわり組",
        "photo_url": "https://...",
        "is_expected": true
      }
    ],

    "total_expected": 18,       // 出席予定児童数
    "total_children": 25        // 全児童数
  }
}
```

**用途**: ダッシュボードでの「本日の出席予定」表示、QR出欠での予定外チェック

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス閲覧可）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、不正な日付
- `401 Unauthorized`: 認証エラー
- `500 Internal Server Error`: サーバーエラー

---

## データベース要件

### 使用テーブル

#### 1. s_attendance_schedule（出席予定パターン）
```sql
CREATE TABLE IF NOT EXISTS s_attendance_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),
  child_id UUID NOT NULL REFERENCES m_children(id),

  -- 曜日別通所予定（true=通所予定、false=通所予定なし）
  monday BOOLEAN NOT NULL DEFAULT false,
  tuesday BOOLEAN NOT NULL DEFAULT false,
  wednesday BOOLEAN NOT NULL DEFAULT false,
  thursday BOOLEAN NOT NULL DEFAULT false,
  friday BOOLEAN NOT NULL DEFAULT false,
  saturday BOOLEAN NOT NULL DEFAULT false,
  sunday BOOLEAN NOT NULL DEFAULT false,

  -- 有効期間
  effective_from DATE,
  effective_to DATE,

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- 制約
  UNIQUE (child_id, effective_from, effective_to)
);

-- インデックス
CREATE INDEX idx_s_attendance_schedule_facility
  ON s_attendance_schedule(facility_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_s_attendance_schedule_child
  ON s_attendance_schedule(child_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_s_attendance_schedule_effective
  ON s_attendance_schedule(effective_from, effective_to)
  WHERE deleted_at IS NULL;
```

**備考**:
- MVP段階では `effective_from` / `effective_to` は NULL（無期限）で運用
- Phase 2で期間指定機能を実装予定

#### 2. m_children（子どもマスタ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
```

#### 3. m_classes（クラスマスタ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
```

---

## クエリ例

### 出席予定パターン一覧取得クエリ

```sql
-- 施設内の全児童の出席予定パターンを取得
SELECT
  c.id as child_id,
  c.family_name || ' ' || c.given_name as name,
  c.family_name_kana || ' ' || c.given_name_kana as kana,
  cl.id as class_id,
  cl.name as class_name,
  cl.grade,
  c.photo_url,

  -- 曜日別通所予定
  COALESCE(sas.monday, false) as monday,
  COALESCE(sas.tuesday, false) as tuesday,
  COALESCE(sas.wednesday, false) as wednesday,
  COALESCE(sas.thursday, false) as thursday,
  COALESCE(sas.friday, false) as friday,
  COALESCE(sas.saturday, false) as saturday,
  COALESCE(sas.sunday, false) as sunday,

  sas.updated_at

FROM m_children c
INNER JOIN _child_class cc ON c.id = cc.child_id AND cc.is_current = true
INNER JOIN m_classes cl ON cc.class_id = cl.id
LEFT JOIN s_attendance_schedule sas
  ON c.id = sas.child_id
  AND sas.deleted_at IS NULL
  AND (sas.effective_from IS NULL OR sas.effective_from <= CURRENT_DATE)
  AND (sas.effective_to IS NULL OR sas.effective_to >= CURRENT_DATE)

WHERE c.facility_id = $1  -- facility_id (from session)
  AND c.enrollment_status = 'enrolled'
  AND c.deleted_at IS NULL
  AND cl.deleted_at IS NULL

  -- フィルター条件
  AND ($2::UUID IS NULL OR cl.id = $2)  -- class_id filter
  AND (
    $3::VARCHAR IS NULL
    OR c.family_name ILIKE '%' || $3 || '%'
    OR c.given_name ILIKE '%' || $3 || '%'
    OR c.family_name_kana ILIKE '%' || $3 || '%'
    OR c.given_name_kana ILIKE '%' || $3 || '%'
  )  -- search filter

ORDER BY cl.display_order, c.family_name_kana, c.given_name_kana;
```

### 特定日の出席予定児童取得クエリ

```sql
-- 特定日に出席予定の児童を取得
-- $1: facility_id (from session)
-- $2: target_date (YYYY-MM-DD)

WITH target_weekday AS (
  -- 対象日の曜日を取得（0=日曜、1=月曜、...、6=土曜）
  SELECT EXTRACT(DOW FROM $2::DATE) as dow
),
weekday_column AS (
  -- 曜日に対応するカラム名を決定
  SELECT
    CASE
      WHEN tw.dow = 1 THEN 'monday'
      WHEN tw.dow = 2 THEN 'tuesday'
      WHEN tw.dow = 3 THEN 'wednesday'
      WHEN tw.dow = 4 THEN 'thursday'
      WHEN tw.dow = 5 THEN 'friday'
      WHEN tw.dow = 6 THEN 'saturday'
      WHEN tw.dow = 0 THEN 'sunday'
    END as weekday_col
  FROM target_weekday tw
)
SELECT
  c.id as child_id,
  c.family_name || ' ' || c.given_name as name,
  c.family_name_kana || ' ' || c.given_name_kana as kana,
  cl.id as class_id,
  cl.name as class_name,
  c.photo_url,

  -- 対象曜日の出席予定
  CASE (SELECT weekday_col FROM weekday_column)
    WHEN 'monday' THEN COALESCE(sas.monday, false)
    WHEN 'tuesday' THEN COALESCE(sas.tuesday, false)
    WHEN 'wednesday' THEN COALESCE(sas.wednesday, false)
    WHEN 'thursday' THEN COALESCE(sas.thursday, false)
    WHEN 'friday' THEN COALESCE(sas.friday, false)
    WHEN 'saturday' THEN COALESCE(sas.saturday, false)
    WHEN 'sunday' THEN COALESCE(sas.sunday, false)
  END as is_expected

FROM m_children c
INNER JOIN _child_class cc ON c.id = cc.child_id AND cc.is_current = true
INNER JOIN m_classes cl ON cc.class_id = cl.id
LEFT JOIN s_attendance_schedule sas
  ON c.id = sas.child_id
  AND sas.deleted_at IS NULL
  AND (sas.effective_from IS NULL OR sas.effective_from <= $2::DATE)
  AND (sas.effective_to IS NULL OR sas.effective_to >= $2::DATE)

WHERE c.facility_id = $1  -- facility_id
  AND c.enrollment_status = 'enrolled'
  AND c.deleted_at IS NULL
  AND cl.deleted_at IS NULL

ORDER BY cl.display_order, c.family_name_kana, c.given_name_kana;
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
   - 現在: 自施設の全クラスにアクセス可能
   - Phase 2: 担当クラスのみアクセス可能に制限予定（`_user_class`テーブルで管理）

#### 施設IDの取得
- `facility_id`はリクエストパラメータではなく、セッション情報（`current_facility_id`）から自動取得します
- これにより、ユーザーが不正な施設IDを指定することを防止します
- **複数施設の切り替え機能はPhase 2で実装予定**

#### データ分離
- RLS（Row Level Security）で施設レベルのデータを分離
- クエリ実行時に`facility_id`でフィルタリング
- staffユーザーの場合、Phase 2で`_user_class`テーブルを使用したクラス単位の制限を実装予定

#### エラーハンドリング戦略
- アクセス権限がない場合: `404 Not Found`を返す
- 理由: `403 Forbidden`ではリソースの存在を推測可能になるため、セキュリティ上`404`を優先

### 入力検証
- `schedule`: 7つの曜日フィールドがすべてboolean型であることを検証
- `effective_from` / `effective_to`: YYYY-MM-DD形式、`effective_from` <= `effective_to`
- `child_id`: UUID形式、対象施設に存在する児童のみ

---

## パフォーマンス考慮事項

### インデックス
```sql
-- 上記のテーブル定義に含まれるインデックスで対応可能

-- 追加推奨インデックス（大規模施設向け）
CREATE INDEX idx_s_attendance_schedule_facility_child
  ON s_attendance_schedule(facility_id, child_id)
  WHERE deleted_at IS NULL;
```

### キャッシュ戦略
- 出席予定パターン: 1時間キャッシュ（変更頻度が低い）
- 特定日の出席予定: 10分キャッシュ（当日朝の変更に対応）

---

## エラーハンドリング

### 共通エラーコード
```typescript
{
  "SCHEDULE_NOT_FOUND": "出席予定パターンが見つかりません",
  "CHILD_NOT_FOUND": "児童が見つかりません",
  "INVALID_WEEKDAY": "無効な曜日設定です",
  "INVALID_DATE_RANGE": "有効期間の設定が不正です（開始日 > 終了日）",
  "BULK_UPDATE_PARTIAL_FAILURE": "一部の更新に失敗しました"
}
```

---

## UI/UX要件

### 出席予定パターン設定画面
```tsx
// テーブル形式で一覧表示
<table>
  <thead>
    <tr>
      <th>名前</th>
      <th>クラス</th>
      <th>月</th>
      <th>火</th>
      <th>水</th>
      <th>木</th>
      <th>金</th>
    </tr>
  </thead>
  <tbody>
    {children.map((child) => (
      <tr key={child.id}>
        <td>{child.name}</td>
        <td>{child.className}</td>
        <td><Checkbox checked={child.schedule.monday} /></td>
        <td><Checkbox checked={child.schedule.tuesday} /></td>
        <td><Checkbox checked={child.schedule.wednesday} /></td>
        <td><Checkbox checked={child.schedule.thursday} /></td>
        <td><Checkbox checked={child.schedule.friday} /></td>
      </tr>
    ))}
  </tbody>
</table>
```

### 一括保存機能
- 複数の児童の予定を一度に変更できる
- 「保存」ボタンで一括更新API (`bulk-update`) を呼び出し
- 保存成功時にトースト通知を表示

---

## ダッシュボードAPIとの連携

### 予定外チェック
ダッシュボードの「予定外出席」判定（`08_dashboard_api.md`）では、本APIの出席予定パターンを参照します：

```typescript
// 予定外出席の判定ロジック
const isUnexpected = (attendanceDate: Date, childSchedule: Schedule) => {
  const weekday = getWeekday(attendanceDate);  // 'monday', 'tuesday', ...
  return !childSchedule[weekday];  // 予定なしの曜日に出席 = 予定外
};
```

---

## 今後の拡張予定

### Phase 2
- 有効期間設定機能（`effective_from` / `effective_to`）
- 曜日パターンのテンプレート機能（「月水金パターン」など）
- 祝日・長期休暇の考慮
- 変更履歴の記録（`h_attendance_schedule`テーブル）

### Phase 3
- AIによる出席パターンの推測（過去の実績から）
- 保護者アプリからの通所予定変更
- カレンダーUIでの個別日付の出欠予定登録
- 年間カレンダーでの一括設定

---

**作成日**: 2025-01-09
**最終更新**: 2025-01-09
**関連ドキュメント**:
- `03_database.md` - データベース設計
- `04_api.md` - API基本設計
- `08_dashboard_api.md` - ダッシュボードAPI（予定外チェック連携）
