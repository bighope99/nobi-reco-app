# 記録状況一覧API仕様書

## 概要
全児童の月間記録管理画面で使用するAPI群の仕様を定義します。

---

## エンドポイント一覧

### 1. 記録状況一覧取得

**エンドポイント**: `GET /api/records/status`

**説明**: 指定月の全児童の記録状況を取得します。

**リクエストパラメータ**:
```typescript
{
  year: number;         // 対象年（例: 2023）
  month: number;        // 対象月（1-12）
  class_id?: string;    // クラスフィルター（省略時は全クラス）
  search?: string;      // 検索キーワード（名前・かな）
  warning_only?: boolean; // 記録率80%未満のみ（デフォルト: false）
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    // 対象期間
    "period": {
      "year": 2023,
      "month": 10,
      "start_date": "2023-10-01",
      "end_date": "2023-10-31",
      "days_in_month": 31
    },

    // 児童リスト
    "children": [
      {
        "child_id": "uuid-child-1",
        "name": "田中 陽翔",
        "kana": "たなか はると",
        "class_id": "uuid-class-1",
        "class_name": "ひまわり組",
        "grade": "6年生",
        "photo_url": "https://...",

        // 最終記録日
        "last_record_date": "2023-10-27",  // YYYY-MM-DD
        "is_recorded_today": true,

        // 月間統計
        "monthly": {
          "attendance_count": 20,      // 月間出席日数
          "record_count": 18,           // 月間記録済み日数
          "record_rate": 90.0,          // 記録率（%）

          // 日別記録状況（1日〜31日）
          "daily_status": [
            "present",   // 1日: 記録済み（在所）
            "absent",    // 2日: 休み
            "late",      // 3日: 記録なし（在所）
            "none",      // 4日: 予定なし
            "present",   // 5日: 記録済み
            // ... 31日分
          ]
        },

        // 年間統計
        "yearly": {
          "attendance_count": 180,      // 年間出席日数
          "record_count": 160,          // 年間記録済み日数
          "record_rate": 88.9           // 記録率（%）
        }
      }
      // ... more children
    ],

    // サマリー
    "summary": {
      "total_children": 25,
      "warning_children": 5,           // 記録率80%未満の児童数
      "average_record_rate": 85.5      // 全体の平均記録率
    },

    // フィルター用データ
    "filters": {
      "classes": [
        {
          "class_id": "uuid-class-1",
          "class_name": "ひまわり組"
        }
      ]
    }
  }
}
```

**日別記録ステータス**:
- `"present"`: 記録済み（在所あり）- 青
- `"late"`: 記録なし（在所あり）- 黄色（要注意）
- `"absent"`: 休み（出席予定なし）- 灰色
- `"none"`: データなし（月末以降など）- 薄灰色

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス閲覧可）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、不正な年月
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 施設・クラスが見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 2. 一括記録作成

**エンドポイント**: `POST /api/records/bulk-create`

**説明**: 未記録の児童に対して一括で記録を作成します（テンプレートベース）。

**リクエストボディ**:
```typescript
{
  "date": "2023-10-27",                // 対象日（YYYY-MM-DD）
  "class_id": "uuid-class-1",          // 対象クラス
  "child_ids": [                        // 対象児童ID（省略時は未記録の全児童）
    "uuid-child-1",
    "uuid-child-2"
  ],
  "template_id": "uuid-template-1",    // 使用するテンプレート（任意）
  "content": "本日も元気に過ごしました。", // デフォルトコメント（任意）
  "tags": ["id-tag-1", "id-tag-2"]     // デフォルトタグ（任意）
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "created_count": 15,
    "records": [
      {
        "observation_id": "uuid-obs-1",
        "child_id": "uuid-child-1",
        "observation_date": "2023-10-27",
        "content": "本日も元気に過ごしました。",
        "tags": ["id-tag-1"]
      }
      // ... more records
    ]
  }
}
```

**処理内容**:
1. 指定日に出席している児童のうち、未記録の児童を特定
2. 各児童に対して `r_observation` レコードを作成
3. テンプレートまたはデフォルトコメントを使用
4. タグを自動付与

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス操作可）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、不正な日付
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: クラス・テンプレートが見つからない、またはアクセス権限なし
- `409 Conflict`: 既に記録が存在する児童が含まれている
- `500 Internal Server Error`: サーバーエラー

---

## データベース要件

### 使用テーブル

#### 1. m_children（子どもマスタ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
```

#### 2. m_classes（クラスマスタ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
```

#### 3. r_observation（観察記録）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
```

#### 4. h_attendance（出欠実績ログ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
-- 出席日数のカウントに使用
```

#### 5. s_template（定型文テンプレート）- 新規テーブル（将来実装）
```sql
CREATE TABLE IF NOT EXISTS s_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),
  name VARCHAR(100) NOT NULL,               -- テンプレート名
  content TEXT NOT NULL,                     -- 定型文
  tags JSONB,                                -- デフォルトタグ
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_template_facility_id ON s_template(facility_id) WHERE deleted_at IS NULL;
```

**備考**: MVP段階では不要。Phase 2で実装予定。

---

## クエリ例

### 記録状況一覧取得クエリ

```sql
-- 月間記録状況を取得
WITH daily_attendance AS (
  -- 日別の出席状況
  SELECT
    c.id as child_id,
    DATE(ha.checked_in_at) as attendance_date,
    ha.checked_in_at,
    ha.checked_out_at
  FROM m_children c
  INNER JOIN h_attendance ha
    ON c.id = ha.child_id
  WHERE c.facility_id = $1  -- facility_id
    AND DATE(ha.checked_in_at) >= $2  -- start_date
    AND DATE(ha.checked_in_at) <= $3  -- end_date
    AND c.deleted_at IS NULL
),
daily_records AS (
  -- 日別の記録状況
  SELECT
    ro.child_id,
    ro.observation_date,
    COUNT(*) as record_count
  FROM r_observation ro
  WHERE ro.observation_date >= $2  -- start_date
    AND ro.observation_date <= $3  -- end_date
    AND ro.deleted_at IS NULL
  GROUP BY ro.child_id, ro.observation_date
),
child_monthly_stats AS (
  -- 児童ごとの月間統計
  SELECT
    c.id as child_id,
    c.family_name || ' ' || c.given_name as name,
    c.family_name_kana || ' ' || c.given_name_kana as kana,
    cl.id as class_id,
    cl.name as class_name,
    cl.grade,
    c.photo_url,

    -- 最終記録日
    (
      SELECT MAX(observation_date)
      FROM r_observation
      WHERE child_id = c.id
        AND deleted_at IS NULL
    ) as last_record_date,

    -- 月間出席日数
    COUNT(DISTINCT da.attendance_date) as monthly_attendance_count,

    -- 月間記録済み日数
    COUNT(DISTINCT dr.observation_date) as monthly_record_count,

    -- 年間出席日数（年初〜現在）
    (
      SELECT COUNT(DISTINCT DATE(checked_in_at))
      FROM h_attendance
      WHERE child_id = c.id
        AND EXTRACT(YEAR FROM checked_in_at) = $4  -- year
        AND DATE(checked_in_at) <= CURRENT_DATE
    ) as yearly_attendance_count,

    -- 年間記録済み日数
    (
      SELECT COUNT(DISTINCT observation_date)
      FROM r_observation
      WHERE child_id = c.id
        AND EXTRACT(YEAR FROM observation_date) = $4  -- year
        AND observation_date <= CURRENT_DATE
        AND deleted_at IS NULL
    ) as yearly_record_count

  FROM m_children c
  INNER JOIN _child_class cc ON c.id = cc.child_id AND cc.is_current = true
  INNER JOIN m_classes cl ON cc.class_id = cl.id
  LEFT JOIN daily_attendance da ON c.id = da.child_id
  LEFT JOIN daily_records dr ON c.id = dr.child_id AND da.attendance_date = dr.observation_date

  WHERE c.facility_id = $1  -- facility_id
    AND c.enrollment_status = 'enrolled'
    AND c.deleted_at IS NULL
    AND cl.deleted_at IS NULL

  GROUP BY c.id, cl.id
)
SELECT
  *,
  CASE
    WHEN monthly_attendance_count > 0
    THEN ROUND((monthly_record_count::DECIMAL / monthly_attendance_count) * 100, 1)
    ELSE 0
  END as monthly_record_rate,
  CASE
    WHEN yearly_attendance_count > 0
    THEN ROUND((yearly_record_count::DECIMAL / yearly_attendance_count) * 100, 1)
    ELSE 0
  END as yearly_record_rate
FROM child_monthly_stats
ORDER BY class_name, name;
```

### 日別記録ステータス取得（ヒートマップ用）

```sql
-- 指定児童の月間日別ステータスを取得
WITH date_series AS (
  -- 1日〜31日の日付シリーズ
  SELECT generate_series(
    DATE_TRUNC('month', $2::DATE),  -- start_date
    DATE_TRUNC('month', $2::DATE) + INTERVAL '1 month' - INTERVAL '1 day',
    '1 day'::INTERVAL
  )::DATE as date
),
attendance_status AS (
  -- 日別の出席状況
  SELECT
    ds.date,
    CASE
      WHEN ha.checked_in_at IS NOT NULL THEN true
      ELSE false
    END as is_attended,
    CASE
      WHEN ro.observation_date IS NOT NULL THEN true
      ELSE false
    END as is_recorded
  FROM date_series ds
  LEFT JOIN h_attendance ha
    ON DATE(ha.checked_in_at) = ds.date
    AND ha.child_id = $1  -- child_id
  LEFT JOIN r_observation ro
    ON ro.observation_date = ds.date
    AND ro.child_id = $1  -- child_id
    AND ro.deleted_at IS NULL
)
SELECT
  date,
  CASE
    WHEN is_recorded AND is_attended THEN 'present'
    WHEN is_attended AND NOT is_recorded THEN 'late'
    WHEN NOT is_attended THEN 'absent'
    ELSE 'none'
  END as status
FROM attendance_status
ORDER BY date;
```

---

## パフォーマンス考慮事項

### インデックス
```sql
-- 既存のインデックスで対応可能

-- 追加推奨インデックス（パフォーマンス改善用）
CREATE INDEX idx_h_attendance_child_date
  ON h_attendance(child_id, DATE(checked_in_at));

CREATE INDEX idx_r_observation_child_date_range
  ON r_observation(child_id, observation_date)
  WHERE deleted_at IS NULL;

-- 年間統計用（年でパーティション）
CREATE INDEX idx_h_attendance_year
  ON h_attendance(EXTRACT(YEAR FROM checked_in_at), child_id);

CREATE INDEX idx_r_observation_year
  ON r_observation(EXTRACT(YEAR FROM observation_date), child_id)
  WHERE deleted_at IS NULL;
```

### キャッシュ戦略
- 月間データは更新頻度が低いため、1時間キャッシュ推奨
- 当月データのみリアルタイム取得
- 過去月はキャッシュTTL: 24時間

### 集計最適化
- Materialized Viewの検討（大規模施設向け）
```sql
CREATE MATERIALIZED VIEW mv_monthly_record_stats AS
SELECT ... -- 上記のクエリ
WITH DATA;

-- 定期更新（1日1回）
REFRESH MATERIALIZED VIEW mv_monthly_record_stats;
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
- `year`: 1900〜2100の範囲チェック
- `month`: 1〜12の範囲チェック
- `child_ids`: UUID配列形式チェック
- `date`: YYYY-MM-DD形式チェック

---

## エラーハンドリング

### 共通エラーコード
```typescript
{
  "INVALID_YEAR_MONTH": "不正な年月が指定されました",
  "FACILITY_NOT_FOUND": "施設が見つかりません",
  "CLASS_NOT_FOUND": "クラスが見つかりません",
  "TEMPLATE_NOT_FOUND": "テンプレートが見つかりません",
  "ALREADY_RECORDED": "既に記録が存在します",
  "NO_CHILDREN_FOUND": "対象児童が見つかりません"
}
```

---

## UI/UX要件

### ヒートマップの色分け
```css
.status-present {
  background-color: #4F46E5;  /* indigo-600 */
}

.status-late {
  background-color: #FBBF24;  /* amber-400 */
}

.status-absent {
  background-color: #E2E8F0;  /* slate-200 */
}

.status-none {
  background-color: #F1F5F9;  /* slate-100 */
}
```

### プログレスバーの色分け
- **80%以上**: 緑（`bg-green-500`）
- **50%〜79%**: 黄色（`bg-yellow-500`）
- **50%未満**: 赤（`bg-red-500`）

---

## 今後の拡張予定

### Phase 2
- テンプレート機能（`s_template`テーブル）
- 記録履歴の詳細表示
- CSVエクスポート（月間レポート）
- 記録促進アラート（メール/プッシュ通知）

### Phase 3
- AIによる自動記録案の生成
- 記録パターン分析
- 記録品質スコア

---

**作成日**: 2025-01-09
**最終更新**: 2025-01-09
**関連ドキュメント**:
- `03_database.md` - データベース設計
- `04_api.md` - API基本設計
- `08_dashboard_api.md` - ダッシュボードAPI
