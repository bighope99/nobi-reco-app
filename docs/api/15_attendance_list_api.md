# 出席児童一覧API仕様書

## 概要
本日の出席状況を一覧表示するためのAPI仕様を定義します。
出席・欠席・遅刻のステータス別に児童を表示し、リアルタイムの出席管理を支援します。

---

## エンドポイント一覧

### 1. 本日の出席児童一覧取得

**エンドポイント**: `GET /api/attendance/list`

**説明**: 本日の全児童の出席状況を取得します。

**リクエストパラメータ**:
```typescript
{
  date?: string;            // 対象日（YYYY-MM-DD、省略時は本日）
  class_id?: string;        // クラスフィルター（任意）
  status?: string;          // ステータスフィルター（present / absent / late）
  search?: string;          // 検索キーワード（名前・かな）
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "date": "2024-01-15",
    "weekday": "monday",
    "weekday_jp": "月",

    // サマリー
    "summary": {
      "total_children": 25,
      "present_count": 20,
      "absent_count": 3,
      "late_count": 2,
      "not_checked_in_count": 0     // 出席予定だが未チェックイン
    },

    // 児童一覧
    "children": [
      {
        "child_id": "uuid-child-1",
        "name": "田中 陽翔",
        "kana": "たなか はると",
        "class_id": "uuid-class-1",
        "class_name": "ひまわり組",
        "grade": "6年生",
        "photo_url": "https://...",

        // 出席状態
        "status": "present",          // present / absent / late / not_arrived
        "is_expected": true,          // 本日の出席予定

        // チェックイン情報
        "checked_in_at": "2024-01-15T08:30:00+09:00",
        "checked_out_at": null,
        "scan_method": "qr",          // manual / qr / nfc

        // 予定外フラグ
        "is_unexpected": false        // 出席予定なしだが出席している
      },
      {
        "child_id": "uuid-child-2",
        "name": "佐藤 美咲",
        "kana": "さとう みさき",
        "class_id": "uuid-class-1",
        "class_name": "ひまわり組",
        "grade": "5年生",
        "photo_url": "https://...",

        "status": "absent",
        "is_expected": true,
        "checked_in_at": null,
        "checked_out_at": null,
        "scan_method": null,
        "is_unexpected": false
      },
      {
        "child_id": "uuid-child-3",
        "name": "鈴木 太郎",
        "kana": "すずき たろう",
        "class_id": "uuid-class-2",
        "class_name": "さくら組",
        "grade": "4年生",
        "photo_url": "https://...",

        "status": "late",
        "is_expected": true,
        "checked_in_at": "2024-01-15T10:00:00+09:00",  // 遅刻（10時チェックイン）
        "checked_out_at": null,
        "scan_method": "manual",
        "is_unexpected": false
      }
    ],

    // フィルター用データ
    "filters": {
      "classes": [
        {
          "class_id": "uuid-class-1",
          "class_name": "ひまわり組",
          "present_count": 15,
          "total_count": 18
        },
        {
          "class_id": "uuid-class-2",
          "class_name": "さくら組",
          "present_count": 5,
          "total_count": 7
        }
      ]
    }
  }
}
```

**ステータス定義**:
- `present`: 出席（チェックイン済み）
- `absent`: 欠席（出席予定だが未チェックイン）
- `late`: 遅刻（チェックイン時刻が遅い）
- `not_arrived`: 未到着（出席予定だが時間内に未チェックイン）

**遅刻判定**:
- チェックイン時刻が9:30以降の場合「遅刻」とみなす（施設設定で変更可能）

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス閲覧可）

**エラーレスポンス**:
- `400 Bad Request`: 無効なパラメータ、不正な日付
- `401 Unauthorized`: 認証エラー
- `500 Internal Server Error`: サーバーエラー

---

### 2. 出席ステータス更新

**エンドポイント**: `PUT /api/attendance/status/:childId`

**説明**: 特定の児童の出席ステータスを手動で更新します（欠席登録など）。

**リクエストボディ**:
```typescript
{
  "date": "2024-01-15",
  "status": "absent",               // present / absent / late
  "reason": "体調不良",              // 欠席理由（任意）
  "note": "保護者より連絡あり"       // 備考（任意）
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "child_id": "uuid-child-1",
    "child_name": "田中 陽翔",
    "date": "2024-01-15",
    "status": "absent",
    "reason": "体調不良",
    "updated_at": "2024-01-15T08:00:00+09:00"
  }
}
```

**処理内容**:
1. 欠席の場合は `h_attendance` に欠席レコードを作成（`checked_in_at` はNULL）
2. 理由と備考を `note` カラムに保存
3. 既にチェックイン済みの場合はエラーを返す

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス操作可）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、不正な日付、無効なステータス
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 児童が見つからない、またはアクセス権限なし
- `409 Conflict`: 既にチェックイン済み
- `500 Internal Server Error`: サーバーエラー

---

### 3. クラス別出席状況取得

**エンドポイント**: `GET /api/attendance/list/by-class`

**説明**: クラスごとに集計した出席状況を取得します。

**リクエストパラメータ**:
```typescript
{
  date?: string;            // 対象日（YYYY-MM-DD、省略時は本日）
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "date": "2024-01-15",
    "classes": [
      {
        "class_id": "uuid-class-1",
        "class_name": "ひまわり組",
        "grade": "6年生",

        // サマリー
        "total_children": 18,
        "present_count": 15,
        "absent_count": 2,
        "late_count": 1,
        "attendance_rate": 88.9        // 出席率（%）
      },
      {
        "class_id": "uuid-class-2",
        "class_name": "さくら組",
        "grade": "5年生",

        "total_children": 7,
        "present_count": 5,
        "absent_count": 1,
        "late_count": 1,
        "attendance_rate": 85.7
      }
    ],

    // 施設全体のサマリー
    "facility_summary": {
      "total_children": 25,
      "present_count": 20,
      "absent_count": 3,
      "late_count": 2,
      "attendance_rate": 88.0
    }
  }
}
```

**用途**: ダッシュボードでのクラス別集計表示、管理者向けレポート

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス閲覧可）

**エラーレスポンス**:
- `400 Bad Request`: 無効なパラメータ、不正な日付
- `401 Unauthorized`: 認証エラー
- `500 Internal Server Error`: サーバーエラー

---

## データベース要件

### 使用テーブル

#### 1. h_attendance（出欠実績ログ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）

-- ステータスカラム追加（必要に応じて）
ALTER TABLE h_attendance
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'present';
-- status: 'present' | 'absent' | 'late'

-- 欠席理由カラム追加（必要に応じて）
ALTER TABLE h_attendance
ADD COLUMN IF NOT EXISTS absence_reason VARCHAR(200);

-- 備考カラム追加（必要に応じて）
ALTER TABLE h_attendance
ADD COLUMN IF NOT EXISTS note TEXT;

CREATE INDEX idx_h_attendance_status
  ON h_attendance(status)
  WHERE deleted_at IS NULL;
```

#### 2. s_attendance_schedule（出席予定パターン）
```sql
-- 既存のテーブル構造（13_attendance_schedule_api.mdを参照）
```

#### 3. m_children（子どもマスタ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
```

#### 4. m_classes（クラスマスタ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
```

---

## クエリ例

### 本日の出席児童一覧取得クエリ

```sql
-- 本日の全児童の出席状況を取得
WITH target_date AS (
  SELECT COALESCE($2::DATE, CURRENT_DATE) as date
),
weekday_info AS (
  SELECT
    EXTRACT(DOW FROM (SELECT date FROM target_date)) as dow,
    CASE EXTRACT(DOW FROM (SELECT date FROM target_date))
      WHEN 1 THEN 'monday'
      WHEN 2 THEN 'tuesday'
      WHEN 3 THEN 'wednesday'
      WHEN 4 THEN 'thursday'
      WHEN 5 THEN 'friday'
      WHEN 6 THEN 'saturday'
      WHEN 0 THEN 'sunday'
    END as weekday_col
  FROM target_date
)
SELECT
  c.id as child_id,
  c.family_name || ' ' || c.given_name as name,
  c.family_name_kana || ' ' || c.given_name_kana as kana,
  cl.id as class_id,
  cl.name as class_name,
  cl.grade,
  c.photo_url,

  -- 出席予定
  CASE (SELECT weekday_col FROM weekday_info)
    WHEN 'monday' THEN COALESCE(sas.monday, false)
    WHEN 'tuesday' THEN COALESCE(sas.tuesday, false)
    WHEN 'wednesday' THEN COALESCE(sas.wednesday, false)
    WHEN 'thursday' THEN COALESCE(sas.thursday, false)
    WHEN 'friday' THEN COALESCE(sas.friday, false)
    WHEN 'saturday' THEN COALESCE(sas.saturday, false)
    WHEN 'sunday' THEN COALESCE(sas.sunday, false)
  END as is_expected,

  -- 出席情報
  ha.checked_in_at,
  ha.checked_out_at,
  ha.scan_method,
  ha.status,
  ha.absence_reason,
  ha.note,

  -- ステータス判定
  CASE
    WHEN ha.checked_in_at IS NOT NULL AND ha.checked_in_at::TIME > '09:30:00'
      THEN 'late'
    WHEN ha.checked_in_at IS NOT NULL
      THEN 'present'
    WHEN ha.status = 'absent'
      THEN 'absent'
    ELSE 'not_arrived'
  END as computed_status,

  -- 予定外フラグ
  CASE
    WHEN ha.checked_in_at IS NOT NULL
      AND NOT CASE (SELECT weekday_col FROM weekday_info)
        WHEN 'monday' THEN COALESCE(sas.monday, false)
        WHEN 'tuesday' THEN COALESCE(sas.tuesday, false)
        WHEN 'wednesday' THEN COALESCE(sas.wednesday, false)
        WHEN 'thursday' THEN COALESCE(sas.thursday, false)
        WHEN 'friday' THEN COALESCE(sas.friday, false)
        WHEN 'saturday' THEN COALESCE(sas.saturday, false)
        WHEN 'sunday' THEN COALESCE(sas.sunday, false)
      END
    THEN true
    ELSE false
  END as is_unexpected

FROM m_children c
INNER JOIN _child_class cc ON c.id = cc.child_id AND cc.is_current = true
INNER JOIN m_classes cl ON cc.class_id = cl.id
LEFT JOIN s_attendance_schedule sas
  ON c.id = sas.child_id
  AND sas.deleted_at IS NULL
  AND (sas.effective_from IS NULL OR sas.effective_from <= (SELECT date FROM target_date))
  AND (sas.effective_to IS NULL OR sas.effective_to >= (SELECT date FROM target_date))
LEFT JOIN h_attendance ha
  ON c.id = ha.child_id
  AND DATE(ha.checked_in_at) = (SELECT date FROM target_date)
  AND ha.deleted_at IS NULL

WHERE c.facility_id = $1  -- facility_id (from session)
  AND c.enrollment_status = 'enrolled'
  AND c.deleted_at IS NULL
  AND cl.deleted_at IS NULL

  -- フィルター条件
  AND ($3::UUID IS NULL OR cl.id = $3)  -- class_id filter
  AND ($4::VARCHAR IS NULL OR computed_status = $4)  -- status filter
  AND (
    $5::VARCHAR IS NULL
    OR c.family_name ILIKE '%' || $5 || '%'
    OR c.given_name ILIKE '%' || $5 || '%'
    OR c.family_name_kana ILIKE '%' || $5 || '%'
    OR c.given_name_kana ILIKE '%' || $5 || '%'
  )  -- search filter

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
- `date`: YYYY-MM-DD形式、未来日は警告（将来の出席予定登録には使用可）
- `status`: 'present', 'absent', 'late' のいずれか
- `child_id`: UUID形式、対象施設に存在する児童のみ

---

## パフォーマンス考慮事項

### インデックス
```sql
-- 既存のインデックスで対応可能

-- 追加推奨インデックス
CREATE INDEX idx_h_attendance_date
  ON h_attendance(DATE(checked_in_at))
  WHERE deleted_at IS NULL;

CREATE INDEX idx_h_attendance_child_date
  ON h_attendance(child_id, DATE(checked_in_at))
  WHERE deleted_at IS NULL;
```

### キャッシュ戦略
- 本日の出席一覧: 5分キャッシュ（リアルタイム性とパフォーマンスのバランス）
- クラス別集計: 5分キャッシュ
- 過去日の出席一覧: 1時間キャッシュ（変更されないため）

### リアルタイム更新
- WebSocketまたはServer-Sent Events（SSE）での自動更新（Phase 2）
- QRコードスキャン時にリアルタイムで一覧を更新

---

## エラーハンドリング

### 共通エラーコード
```typescript
{
  "CHILD_NOT_FOUND": "児童が見つかりません",
  "INVALID_DATE": "不正な日付です",
  "INVALID_STATUS": "無効なステータスです",
  "ALREADY_CHECKED_IN": "既にチェックイン済みです",
  "FUTURE_DATE_WARNING": "未来日が指定されています"
}
```

---

## UI/UX要件

### 出席状況カード
```tsx
// ステータス別バッジ
const statusConfig = {
  present: { label: '出席', variant: 'default', color: 'bg-green-500' },
  absent: { label: '欠席', variant: 'secondary', color: 'bg-gray-400' },
  late: { label: '遅刻', variant: 'destructive', color: 'bg-yellow-500' },
  not_arrived: { label: '未到着', variant: 'outline', color: 'bg-blue-200' }
};

<div className="flex items-center justify-between p-3 border rounded-lg">
  <div>
    <p className="font-medium">{child.name}</p>
    <p className="text-sm text-muted-foreground">{child.className}</p>
    {child.checked_in_at && (
      <p className="text-xs text-muted-foreground">
        {formatTime(child.checked_in_at)}
      </p>
    )}
  </div>
  <Badge variant={statusConfig[child.status].variant}>
    {statusConfig[child.status].label}
  </Badge>
</div>
```

### サマリー表示
```tsx
<div className="grid gap-4 sm:grid-cols-3">
  <Card>
    <CardContent className="pt-6">
      <p className="text-sm text-muted-foreground">出席</p>
      <p className="text-3xl font-bold text-primary">{presentCount}名</p>
    </CardContent>
  </Card>
  <Card>
    <CardContent className="pt-6">
      <p className="text-sm text-muted-foreground">欠席</p>
      <p className="text-3xl font-bold">{absentCount}名</p>
    </CardContent>
  </Card>
  <Card>
    <CardContent className="pt-6">
      <p className="text-sm text-muted-foreground">合計</p>
      <p className="text-3xl font-bold">{totalCount}名</p>
    </CardContent>
  </Card>
</div>
```

---

## 今後の拡張予定

### Phase 2
- リアルタイム更新（WebSocket / SSE）
- 欠席理由のカテゴリマスタ化
- 保護者アプリからの欠席連絡機能
- 出席履歴のカレンダー表示

### Phase 3
- AI による欠席予測（過去の傾向から）
- 自動アラート（欠席が続く児童の検知）
- 出席率の統計分析とグラフ表示
- クラス間の出席率比較

---

**作成日**: 2025-01-09
**最終更新**: 2025-01-09
**関連ドキュメント**:
- `03_database.md` - データベース設計
- `04_api.md` - API基本設計
- `08_dashboard_api.md` - ダッシュボードAPI（出席管理連携）
- `13_attendance_schedule_api.md` - 出席予定パターンAPI
- `14_qr_attendance_api.md` - QR出欠API
