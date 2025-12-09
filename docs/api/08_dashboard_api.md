# ダッシュボードAPI仕様書

## 概要
施設側ダッシュボード画面で使用するAPI群の仕様を定義します。

---

## エンドポイント一覧

### 1. ダッシュボードサマリー取得

**エンドポイント**: `GET /api/dashboard/summary`

**説明**: ダッシュボード画面に必要な全データを一括取得します。

**リクエストパラメータ**:
```typescript
{
  facility_id: string;  // 施設ID（セッションから取得）
  date?: string;        // 対象日（省略時は本日）YYYY-MM-DD
  class_id?: string;    // クラスフィルター（省略時は全クラス）
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    // 現在時刻
    "current_time": "09:15",
    "current_date": "2023-10-27",

    // KPI（重要指標）
    "kpi": {
      "scheduled_today": 15,    // 本日の出席予定人数
      "present_now": 8,          // 現在の在所人数
      "not_arrived": 5,          // 未登園（未到着）人数
      "checked_out": 2           // 既に帰宅済み人数
    },

    // アラート情報
    "alerts": {
      // 未帰所アラート（降園予定時刻+30分超過）
      "overdue": [
        {
          "child_id": "uuid-child-1",
          "name": "田中 陽翔",
          "kana": "たなか はると",
          "class_name": "ひまわり組",
          "grade": "6年生",
          "scheduled_end_time": "09:00",
          "actual_in_time": "07:55",
          "minutes_overdue": 45,        // 超過分数
          "guardian_phone": "090-1111-1111"
        }
      ],

      // 遅刻アラート（登園予定時刻を過ぎても未到着）
      "late": [
        {
          "child_id": "uuid-child-9",
          "name": "中村 拓海",
          "kana": "なかむら たくみ",
          "class_name": "ひまわり組",
          "grade": "5年生",
          "scheduled_start_time": "08:30",
          "minutes_late": 45,           // 遅延分数
          "guardian_phone": "090-9999-0000"
        }
      ],

      // 予定外登園（出席予定なしでチェックイン）
      "unexpected": [
        {
          "child_id": "uuid-child-2",
          "name": "鈴木 さくら",
          "kana": "すずき さくら",
          "class_name": "さくら組",
          "grade": "4年生",
          "actual_in_time": "08:30"
        }
      ]
    },

    // 出席リスト
    "attendance_list": [
      {
        "child_id": "uuid-child-1",
        "name": "田中 陽翔",
        "kana": "たなか はると",
        "class_id": "uuid-class-1",
        "class_name": "ひまわり組",
        "grade": "6年生",
        "photo_url": "https://...",

        // ステータス
        "status": "checked_in" | "checked_out" | "absent",

        // 出席予定情報
        "is_scheduled_today": true,
        "scheduled_start_time": "08:00",
        "scheduled_end_time": "09:00",

        // 実績情報
        "actual_in_time": "07:55",
        "actual_out_time": null,

        // 連絡先
        "guardian_phone": "090-1111-1111",

        // 記録情報（サポート候補判定用）
        "last_record_date": "2023-10-27",
        "weekly_record_count": 3
      }
      // ... more children
    ],

    // 記録サポート候補
    "record_support": [
      {
        "child_id": "uuid-child-6",
        "name": "渡辺 蓮",
        "kana": "わたなべ れん",
        "class_name": "ひまわり組",
        "last_record_date": "2023-10-20",
        "days_since_record": 7,
        "weekly_record_count": 2,
        "reason": "7日間未記録"
      }
    ],

    // フィルター用データ
    "filters": {
      "classes": [
        {
          "class_id": "uuid-class-1",
          "class_name": "ひまわり組"
        },
        {
          "class_id": "uuid-class-2",
          "class_name": "さくら組"
        }
      ]
    }
  }
}
```

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: 施設へのアクセス権限なし
- `404 Not Found`: 施設が見つからない
- `500 Internal Server Error`: サーバーエラー

---

### 2. 登園処理

**エンドポイント**: `POST /api/attendance/check-in`

**説明**: 子どもの登園（チェックイン）処理を行います。

**リクエストボディ**:
```typescript
{
  "child_id": "uuid-child-1",
  "facility_id": "uuid-facility-1",
  "check_in_time": "08:30",        // HH:mm形式（省略時は現在時刻）
  "check_in_method": "manual",      // "qr" | "manual"
  "note": "予定外登園"               // 備考（任意）
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "attendance_log_id": "uuid-log-1",
    "child_id": "uuid-child-1",
    "checked_in_at": "2023-10-27T08:30:00+09:00",
    "status": "checked_in"
  }
}
```

**処理内容**:
1. `h_attendance` に登園ログを作成
2. `r_daily_attendance` の status を更新（`scheduled` → `checked_in`）
3. 予定外登園の場合、`r_daily_attendance` にレコードを作成

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、既に登園済み
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: 子どもへのアクセス権限なし
- `404 Not Found`: 子どもが見つからない
- `500 Internal Server Error`: サーバーエラー

---

### 3. 欠席処理

**エンドポイント**: `POST /api/attendance/mark-absent`

**説明**: 子どもの欠席処理を行います。出席予定を取り消します。

**リクエストボディ**:
```typescript
{
  "child_id": "uuid-child-1",
  "date": "2023-10-27",           // YYYY-MM-DD
  "reason": "体調不良"             // 欠席理由（任意）
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "child_id": "uuid-child-1",
    "date": "2023-10-27",
    "status": "absent"
  }
}
```

**処理内容**:
1. `r_daily_attendance` の status を `absent` に更新
2. `note` フィールドに欠席理由を記録

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: 子どもへのアクセス権限なし
- `404 Not Found`: 子どもまたは出席予定が見つからない
- `500 Internal Server Error`: サーバーエラー

---

### 4. 予定外登園の確認

**エンドポイント**: `PUT /api/attendance/confirm-unexpected`

**説明**: 予定外登園を確認し、出席予定として登録します。

**リクエストボディ**:
```typescript
{
  "child_id": "uuid-child-2",
  "date": "2023-10-27",
  "scheduled_start_time": "08:30",  // 仮の登園予定時刻
  "scheduled_end_time": "18:00"     // 仮の降園予定時刻
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "child_id": "uuid-child-2",
    "date": "2023-10-27",
    "is_scheduled_today": true,
    "status": "scheduled"
  }
}
```

**処理内容**:
1. `r_daily_attendance` にレコードを作成または更新
2. `is_scheduled_today` を true に設定
3. `status` を `scheduled` に設定

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: 子どもへのアクセス権限なし
- `404 Not Found`: 子どもが見つからない
- `500 Internal Server Error`: サーバーエラー

---

## データベース要件

### 使用テーブル

#### 1. r_daily_attendance（日次出席予定）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
-- 追加カラムは不要
```

**重要なカラム**:
- `attendance_date`: 出席予定日
- `status`: `scheduled` | `absent` | `irregular`
- `note`: 欠席理由など

#### 2. h_attendance（出欠実績ログ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
-- 追加カラムは不要
```

**重要なカラム**:
- `checked_in_at`: チェックイン日時
- `checked_out_at`: チェックアウト日時
- `check_in_method`: `qr` | `manual`

#### 3. m_children（子どもマスタ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
-- 追加カラムは不要
```

**重要なカラム**:
- `parent_phone`: 保護者電話番号（アラート表示用）

#### 4. r_observation（観察記録）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
-- 記録サポート候補の判定に使用
```

#### 5. s_attendance_schedule（曜日通所設定）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
-- 出席予定の自動生成に使用
```

---

## クエリ例

### ダッシュボードサマリー取得クエリ

```sql
-- 1. 出席リスト取得
SELECT
  c.id as child_id,
  c.family_name || ' ' || c.given_name as name,
  c.family_name_kana || ' ' || c.given_name_kana as kana,
  cl.id as class_id,
  cl.name as class_name,
  cl.grade,
  c.photo_url,
  c.parent_phone as guardian_phone,

  -- 出席予定情報
  COALESCE(da.status IS NOT NULL, false) as is_scheduled_today,
  da.status,

  -- 予定時刻（仮の値: 曜日設定から取得または手動設定）
  '08:30' as scheduled_start_time,  -- TODO: s_attendance_scheduleから取得
  '18:00' as scheduled_end_time,

  -- 実績情報
  ha.checked_in_at as actual_in_time,
  ha.checked_out_at as actual_out_time,

  -- 記録情報
  (
    SELECT MAX(observation_date)
    FROM r_observation
    WHERE child_id = c.id
      AND deleted_at IS NULL
  ) as last_record_date,

  (
    SELECT COUNT(*)
    FROM r_observation
    WHERE child_id = c.id
      AND observation_date >= CURRENT_DATE - INTERVAL '7 days'
      AND deleted_at IS NULL
  ) as weekly_record_count

FROM m_children c
INNER JOIN _child_class cc ON c.id = cc.child_id AND cc.is_current = true
INNER JOIN m_classes cl ON cc.class_id = cl.id
LEFT JOIN r_daily_attendance da
  ON c.id = da.child_id
  AND da.attendance_date = CURRENT_DATE
LEFT JOIN h_attendance ha
  ON c.id = ha.child_id
  AND DATE(ha.checked_in_at) = CURRENT_DATE
  AND ha.checked_out_at IS NULL

WHERE c.facility_id = $1  -- facility_id
  AND c.enrollment_status = 'enrolled'
  AND c.deleted_at IS NULL
  AND cl.deleted_at IS NULL

ORDER BY
  -- アラート優先順位
  CASE
    WHEN ha.checked_in_at IS NOT NULL
         AND ha.checked_out_at IS NULL
         AND EXTRACT(EPOCH FROM (CURRENT_TIME - '18:00'::time)) / 60 >= 30
    THEN 1  -- 未帰所アラート

    WHEN da.status = 'scheduled'
         AND ha.checked_in_at IS NULL
         AND EXTRACT(EPOCH FROM (CURRENT_TIME - '08:30'::time)) / 60 > 0
    THEN 2  -- 遅刻アラート

    WHEN ha.checked_in_at IS NOT NULL
         AND da.status IS NULL
    THEN 3  -- 予定外登園

    ELSE 99
  END,
  cl.name,
  c.family_name;
```

---

## パフォーマンス考慮事項

### インデックス
```sql
-- 既存のインデックス（03_database.mdを参照）で十分対応可能

-- 追加推奨インデックス（パフォーマンス改善用）
CREATE INDEX idx_r_observation_child_date
  ON r_observation(child_id, observation_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_h_attendance_child_date_in
  ON h_attendance(child_id, DATE(checked_in_at))
  WHERE checked_out_at IS NULL;
```

### キャッシュ戦略
- ダッシュボードサマリーは頻繁にアクセスされるため、Redis等でキャッシュ推奨
- キャッシュTTL: 30秒〜1分
- リアルタイム性が必要なアラート情報は毎回取得

---

## セキュリティ

### アクセス制御
- ユーザーが所属する施設のデータのみ取得可能
- RLS（Row Level Security）で施設レベルのデータ分離
- API呼び出し時に`facility_id`をセッションから取得し検証

### 入力検証
- `child_id`, `facility_id`: UUID形式チェック
- `date`: YYYY-MM-DD形式チェック
- `check_in_time`: HH:mm形式チェック

---

## エラーハンドリング

### 共通エラーコード
```typescript
{
  "CHILD_NOT_FOUND": "子どもが見つかりません",
  "ALREADY_CHECKED_IN": "既に登園済みです",
  "INVALID_DATE_FORMAT": "日付形式が不正です",
  "INVALID_TIME_FORMAT": "時刻形式が不正です",
  "FACILITY_ACCESS_DENIED": "施設へのアクセス権限がありません",
  "ATTENDANCE_NOT_FOUND": "出席予定が見つかりません"
}
```

---

## 今後の拡張予定

### Phase 2
- リアルタイム更新（WebSocket / Server-Sent Events）
- プッシュ通知（未帰所アラート）
- 保護者への自動連絡機能

### Phase 3
- AIによる遅刻予測
- 出席パターン分析
- 異常検知アラート

---

**作成日**: 2025-01-09
**最終更新**: 2025-01-09
**関連ドキュメント**:
- `03_database.md` - データベース設計
- `04_api.md` - API基本設計
- `07_auth_api.md` - 認証API
