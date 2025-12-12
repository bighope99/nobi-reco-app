# スケジュール設定API仕様書

## 概要
学校別・学年別・曜日別の登校時刻設定を管理するAPI仕様を定義します。
学童保育施設が連携する小学校ごとに、学年グループと曜日ごとの登校時刻パターンを設定できます。

---

## エンドポイント一覧

### 1. 学校一覧とスケジュール取得

**エンドポイント**: `GET /api/schools`

**説明**: 施設に登録されている学校とそのスケジュール設定を取得します。

**リクエストパラメータ**:
```typescript
{
  facility_id?: string;  // 施設フィルター（任意）
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "schools": [
      {
        "school_id": "uuid-school-1",
        "name": "第一小学校",
        "address": "東京都渋谷区〇〇1-1-1",
        "phone": "03-1111-1111",
        "schedules": [
          {
            "schedule_id": "uuid-schedule-1",
            "grades": ["1", "2"],  // 1~2年生
            "weekday_times": {
              "monday": "08:00",
              "tuesday": "08:00",
              "wednesday": "08:00",
              "thursday": "08:00",
              "friday": "08:00",
              "saturday": null,
              "sunday": null
            },
            "created_at": "2024-01-10T10:00:00+09:00",
            "updated_at": "2024-01-10T10:00:00+09:00"
          },
          {
            "schedule_id": "uuid-schedule-2",
            "grades": ["3", "4", "5", "6"],  // 3~6年生
            "weekday_times": {
              "monday": "08:00",
              "tuesday": "08:00",
              "wednesday": "08:00",
              "thursday": "08:00",
              "friday": "08:00",
              "saturday": null,
              "sunday": null
            },
            "created_at": "2024-01-10T10:00:00+09:00",
            "updated_at": "2024-01-10T10:00:00+09:00"
          }
        ],
        "created_at": "2024-01-10T10:00:00+09:00",
        "updated_at": "2024-01-10T10:00:00+09:00"
      },
      {
        "school_id": "uuid-school-2",
        "name": "第二小学校",
        "address": "東京都渋谷区△△2-2-2",
        "phone": "03-2222-2222",
        "schedules": [
          {
            "schedule_id": "uuid-schedule-3",
            "grades": ["1", "2", "3", "4", "5", "6"],  // 全学年
            "weekday_times": {
              "monday": "08:30",
              "tuesday": "08:30",
              "wednesday": "08:30",
              "thursday": "08:30",
              "friday": "08:30",
              "saturday": null,
              "sunday": null
            },
            "created_at": "2024-01-10T10:00:00+09:00",
            "updated_at": "2024-01-10T10:00:00+09:00"
          }
        ],
        "created_at": "2024-01-10T10:00:00+09:00",
        "updated_at": "2024-01-10T10:00:00+09:00"
      }
    ],
    "total": 2
  }
}
```

**備考**:
- `facility_id`が指定されていない場合、セッション情報（`current_facility_id`）から自動取得
- company_adminの場合は`facility_id`パラメータで施設を指定可能

**権限別アクセス制御**:
- **site_admin**: 全施設
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 自施設のみ（閲覧のみ）

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `500 Internal Server Error`: サーバーエラー

---

### 2. 学校登録

**エンドポイント**: `POST /api/schools`

**説明**: 新しい学校を登録します。

**リクエストボディ**:
```typescript
{
  "name": "第三小学校",
  "address": "東京都渋谷区◇◇3-3-3",  // 任意
  "phone": "03-3333-3333"  // 任意
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "school_id": "uuid-school-new",
    "name": "第三小学校",
    "address": "東京都渋谷区◇◇3-3-3",
    "phone": "03-3333-3333",
    "schedules": [],
    "created_at": "2025-01-11T10:00:00+09:00"
  },
  "message": "学校を登録しました"
}
```

**処理内容**:
1. `m_schools`テーブルに新規レコードを作成
2. `facility_id`はセッション情報から自動取得

**権限別アクセス制御**:
- **site_admin**: 不可
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効なデータ形式
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: 権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 3. 学校情報更新

**エンドポイント**: `PUT /api/schools/:school_id`

**説明**: 学校の基本情報を更新します。

**リクエストボディ**:
```typescript
{
  "name": "第三小学校（更新）",
  "address": "東京都渋谷区◇◇3-3-3",
  "phone": "03-3333-3333"
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "school_id": "uuid-school-3",
    "name": "第三小学校（更新）",
    "updated_at": "2025-01-11T10:30:00+09:00"
  },
  "message": "学校情報を更新しました"
}
```

**権限別アクセス制御**:
- **site_admin**: 不可
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効なデータ形式
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 学校が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 4. 学校削除

**エンドポイント**: `DELETE /api/schools/:school_id`

**説明**: 学校とそのスケジュール設定を削除します（ソフトデリート）。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "school_id": "uuid-school-3",
    "name": "第三小学校",
    "deleted_at": "2025-01-11T10:00:00+09:00"
  },
  "message": "学校を削除しました"
}
```

**処理内容**:
1. `m_schools`テーブルの`deleted_at`を更新（ソフトデリート）
2. 紐づく`s_school_schedules`も自動的に削除（CASCADE）

**権限別アクセス制御**:
- **site_admin**: 不可
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 学校が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 5. スケジュール追加

**エンドポイント**: `POST /api/schools/:school_id/schedules`

**説明**: 学校にスケジュール設定を追加します。

**リクエストボディ**:
```typescript
{
  "grades": ["1", "2"],  // 対象学年
  "weekday_times": {
    "monday": "08:00",
    "tuesday": "08:00",
    "wednesday": "08:00",
    "thursday": "08:00",
    "friday": "08:00",
    "saturday": null,
    "sunday": null
  }
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "schedule_id": "uuid-schedule-new",
    "school_id": "uuid-school-1",
    "grades": ["1", "2"],
    "weekday_times": {
      "monday": "08:00",
      "tuesday": "08:00",
      "wednesday": "08:00",
      "thursday": "08:00",
      "friday": "08:00",
      "saturday": null,
      "sunday": null
    },
    "created_at": "2025-01-11T10:00:00+09:00"
  },
  "message": "スケジュールを追加しました"
}
```

**処理内容**:
1. `s_school_schedules`テーブルに新規レコードを作成
2. `grades`は配列形式で保存

**権限別アクセス制御**:
- **site_admin**: 不可
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効なデータ形式
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 学校が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 6. スケジュール更新

**エンドポイント**: `PUT /api/schools/:school_id/schedules/:schedule_id`

**説明**: スケジュール設定を更新します。

**リクエストボディ**:
```typescript
{
  "grades": ["1", "2", "3"],  // 学年を変更
  "weekday_times": {
    "monday": "08:15",  // 時刻を変更
    "tuesday": "08:15",
    "wednesday": "08:15",
    "thursday": "08:15",
    "friday": "08:15",
    "saturday": null,
    "sunday": null
  }
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "schedule_id": "uuid-schedule-1",
    "updated_at": "2025-01-11T10:30:00+09:00"
  },
  "message": "スケジュールを更新しました"
}
```

**処理内容**:
1. `s_school_schedules`テーブルの該当レコードを更新

**権限別アクセス制御**:
- **site_admin**: 不可
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効なデータ形式
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: スケジュールが見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 7. スケジュール削除

**エンドポイント**: `DELETE /api/schools/:school_id/schedules/:schedule_id`

**説明**: スケジュール設定を削除します（ソフトデリート）。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "schedule_id": "uuid-schedule-1",
    "deleted_at": "2025-01-11T10:00:00+09:00"
  },
  "message": "スケジュールを削除しました"
}
```

**処理内容**:
1. `s_school_schedules`テーブルの`deleted_at`を更新（ソフトデリート）

**権限別アクセス制御**:
- **site_admin**: 不可
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: スケジュールが見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 8. 一括スケジュール更新

**エンドポイント**: `PUT /api/schools/schedules/bulk`

**説明**: 複数の学校のスケジュールを一括更新します。

**リクエストボディ**:
```typescript
{
  "updates": [
    {
      "schedule_id": "uuid-schedule-1",
      "grades": ["1", "2"],
      "weekday_times": {
        "monday": "08:00",
        "tuesday": "08:00",
        "wednesday": "08:00",
        "thursday": "08:00",
        "friday": "08:00",
        "saturday": null,
        "sunday": null
      }
    },
    {
      "schedule_id": "uuid-schedule-2",
      "grades": ["3", "4", "5", "6"],
      "weekday_times": {
        "monday": "08:00",
        "tuesday": "08:00",
        "wednesday": "08:00",
        "thursday": "08:00",
        "friday": "08:00",
        "saturday": null,
        "sunday": null
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
        "schedule_id": "uuid-schedule-1",
        "status": "success"
      },
      {
        "schedule_id": "uuid-schedule-2",
        "status": "success"
      }
    ]
  },
  "message": "スケジュールを一括更新しました"
}
```

**処理内容**:
1. トランザクション内で複数のスケジュールを更新
2. 部分失敗を許容（一部失敗しても他の更新は継続）

**権限別アクセス制御**:
- **site_admin**: 不可
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効なデータ形式
- `401 Unauthorized`: 認証エラー
- `500 Internal Server Error`: サーバーエラー

---

## データベース要件

### 使用テーブル

データベーステーブルの詳細は `docs/api/25_school_registration_db.md` を参照してください。

#### 1. m_schools（学校マスタ）
- 学童保育施設が連携する小学校を管理

#### 2. s_school_schedules（学校登校スケジュール）
- 学校ごと・学年グループごとの登校時刻パターン

---

## クエリ例

### 学校一覧とスケジュール取得クエリ

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
      'weekday_times', json_build_object(
        'monday', ss.monday_time,
        'tuesday', ss.tuesday_time,
        'wednesday', ss.wednesday_time,
        'thursday', ss.thursday_time,
        'friday', ss.friday_time,
        'saturday', ss.saturday_time,
        'sunday', ss.sunday_time
      ),
      'created_at', ss.created_at,
      'updated_at', ss.updated_at
    )
    ORDER BY array_length(ss.grades, 1), ss.grades[1]
  ) FILTER (WHERE ss.id IS NOT NULL) as schedules,

  s.created_at,
  s.updated_at

FROM m_schools s
LEFT JOIN s_school_schedules ss
  ON s.id = ss.school_id
  AND ss.deleted_at IS NULL

WHERE s.facility_id = $1  -- facility_id (from session or parameter)
  AND s.deleted_at IS NULL

GROUP BY s.id, s.name, s.address, s.phone, s.created_at, s.updated_at
ORDER BY s.name;
```

### スケジュール新規作成クエリ

```sql
INSERT INTO s_school_schedules (
  school_id,
  grades,
  monday_time,
  tuesday_time,
  wednesday_time,
  thursday_time,
  friday_time,
  saturday_time,
  sunday_time
)
VALUES (
  $1,  -- school_id
  $2,  -- grades (TEXT[] array)
  $3,  -- monday_time
  $4,  -- tuesday_time
  $5,  -- wednesday_time
  $6,  -- thursday_time
  $7,  -- friday_time
  $8,  -- saturday_time
  $9   -- sunday_time
)
RETURNING id, school_id, grades, created_at;
```

---

## セキュリティ

### アクセス制御

#### 権限管理
本APIは以下の4つのロールに対応しています：

1. **site_admin（サイト管理者）**:
   - 全施設にアクセス可能
   - 用途: 管理ページでの利用（Phase 2で実装予定）

2. **company_admin（会社管理者）**:
   - 自社が運営する全施設にアクセス可能
   - 学校の登録・編集・削除が可能

3. **facility_admin（施設管理者）**:
   - 自施設のみアクセス可能
   - 学校の登録・編集・削除が可能

4. **staff（一般職員）**:
   - 自施設の学校情報を閲覧のみ可能
   - 編集・削除権限なし

#### 施設IDの取得
- `facility_id`はリクエストパラメータまたはセッション情報（`current_facility_id`）から取得
- ユーザーが不正な施設IDを指定することを防止

#### データ分離
- RLS（Row Level Security）で施設レベルのデータを分離
- クエリ実行時に`facility_id`でフィルタリング

#### エラーハンドリング戦略
- アクセス権限がない場合: `404 Not Found`を返す
- 理由: `403 Forbidden`ではリソースの存在を推測可能になるため、セキュリティ上`404`を優先

### バリデーション
- 学校名: 1〜200文字、必須
- 学年配列: ['1', '2', '3', '4', '5', '6']のいずれか、1つ以上必須
- 時刻: HH:MM形式（例: "08:00"）またはnull
- 曜日: monday, tuesday, wednesday, thursday, friday, saturday, sunday

---

## パフォーマンス考慮事項

### インデックス
```sql
-- テーブル定義に含まれるインデックスで対応可能
-- 追加推奨インデックス
CREATE INDEX idx_s_school_schedules_grades
  ON s_school_schedules USING gin(grades)
  WHERE deleted_at IS NULL;
```

### キャッシュ戦略
- 学校一覧: 1時間キャッシュ
- スケジュール詳細: 30分キャッシュ
- 更新時にキャッシュをクリア

---

## エラーハンドリング

### 共通エラーコード
```typescript
{
  "SCHOOL_NOT_FOUND": "学校が見つかりません",
  "SCHEDULE_NOT_FOUND": "スケジュールが見つかりません",
  "INVALID_GRADE": "無効な学年です",
  "INVALID_TIME_FORMAT": "時刻の形式が正しくありません（HH:MM形式）",
  "EMPTY_GRADES": "学年を1つ以上選択してください",
  "PERMISSION_DENIED": "スケジュールを変更する権限がありません"
}
```

---

## UI/UX要件

### スケジュール設定画面

```tsx
// 学校ごとにセクション表示
<section>
  <h2>第一小学校</h2>

  // スケジュール設定カード
  <div>
    <h3>学年選択</h3>
    <CheckboxGroup>
      <Checkbox value="1">1年生</Checkbox>
      <Checkbox value="2">2年生</Checkbox>
      {/* ... */}
    </CheckboxGroup>

    <h3>曜日ごとの登校時刻</h3>
    <div>
      <label>月曜日</label>
      <input type="time" value="08:00" />

      <label>火曜日</label>
      <input type="time" value="08:00" />

      {/* ... */}
    </div>
  </div>
</section>
```

### バリデーション
- リアルタイムバリデーション（入力時）
- 学年が1つも選択されていない場合はエラー表示
- 時刻形式が不正な場合はエラー表示
- 削除時の確認ダイアログ

---

## 今後の拡張予定

### Phase 2
- 年間行事カレンダーとの連携
- 長期休暇期間の設定
- 中学校対応
- スケジュール変更履歴の表示

### Phase 3
- AIによる登校時刻パターンの推測
- 学校からの自動通知連携
- 学校ごとの特別日程設定（運動会、遠足など）

---

**作成日**: 2025-01-11
**最終更新**: 2025-01-11
**関連ドキュメント**:
- `03_database.md` - データベース設計
- `04_api.md` - API基本設計
- `25_school_registration_db.md` - 学校登録テーブル定義
- `13_attendance_schedule_api.md` - 出席予定API
