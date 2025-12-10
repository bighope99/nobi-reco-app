# データエクスポートAPI仕様書

## 概要
各種データのエクスポート・バックアップ機能のAPI仕様を定義します。
児童データ、記録データ、出席データなどをCSV/JSON形式でエクスポートします。

---

## エンドポイント一覧

### 1. 児童データエクスポート

**エンドポイント**: `POST /api/export/children`

**説明**: 児童の基本情報をCSV形式でエクスポートします。

**リクエストボディ**:
```typescript
{
  "format": "csv",                   // csv / json / xlsx
  "filters": {
    "enrollment_status": "enrolled", // enrolled / withdrawn / all
    "class_id": "uuid-class-1",      // 任意: 特定クラスのみ
    "has_allergy": true,             // 任意: アレルギー有無
    "include_withdrawn": false       // 退所児童を含むか
  },
  "columns": [                       // エクスポートする列（任意、未指定時は全列）
    "name",
    "birth_date",
    "class_name",
    "enrollment_date",
    "parent_name",
    "parent_phone",
    "has_allergy",
    "allergy_detail"
  ]
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "export_id": "uuid-export-1",
    "filename": "children_data_20240115_100000.csv",
    "download_url": "https://storage.supabase.co/.../exports/children_data_20240115_100000.csv",
    "expires_at": "2024-01-16T10:00:00+09:00",  // 24時間後
    "record_count": 25,
    "file_size": 8192,  // bytes
    "created_at": "2024-01-15T10:00:00+09:00"
  }
}
```

**処理内容**:
1. 指定された条件で児童データを取得
2. 選択された列のみを抽出
3. CSV/JSON/XLSX形式に変換
4. Supabase Storageにアップロード
5. 署名付きURLを生成（24時間有効）
6. エクスポート履歴を`h_exports`に記録

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `400 Bad Request`: 無効なパラメータ、データが存在しない
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: アクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 2. 記録データエクスポート

**エンドポイント**: `POST /api/export/records`

**説明**: 観察記録・活動記録・子どもの声などの記録データをエクスポートします。

**リクエストボディ**:
```typescript
{
  "format": "csv",                   // csv / json / xlsx
  "record_types": [                  // エクスポートする記録タイプ
    "observation",                   // 観察記録
    "activity",                      // 活動記録
    "voice"                          // 子どもの声
  ],
  "date_range": {
    "start_date": "2024-01-01",
    "end_date": "2024-01-31"
  },
  "filters": {
    "class_id": "uuid-class-1",      // 任意: 特定クラスのみ
    "child_id": "uuid-child-1",      // 任意: 特定児童のみ
    "created_by": "uuid-user-1"      // 任意: 特定職員が作成したもののみ
  },
  "include_photos": false,           // 写真を含むか（ZIPアーカイブ）
  "anonymize": false                 // 個人情報を匿名化するか
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "export_id": "uuid-export-2",
    "filename": "records_data_20240101_20240131.csv",
    "download_url": "https://storage.supabase.co/.../exports/records_data_20240101_20240131.csv",
    "expires_at": "2024-01-16T10:00:00+09:00",
    "record_count": 245,
    "breakdown": {
      "observation": 89,
      "activity": 120,
      "voice": 36
    },
    "file_size": 102400,
    "created_at": "2024-01-15T10:00:00+09:00"
  }
}
```

**処理内容**:
1. 指定された期間・条件で記録データを取得
2. 記録タイプごとにデータを整形
3. 匿名化フラグがtrueの場合、個人情報をマスク
4. 写真を含む場合はZIPアーカイブを作成
5. CSV/JSON/XLSX形式に変換
6. Supabase Storageにアップロード
7. 署名付きURLを生成（24時間有効）
8. エクスポート履歴を`h_exports`に記録

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `400 Bad Request`: 無効なパラメータ、期間が長すぎる（最大1年）
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: アクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 3. 出席データエクスポート

**エンドポイント**: `POST /api/export/attendance`

**説明**: 出席履歴データをエクスポートします。

**リクエストボディ**:
```typescript
{
  "format": "csv",                   // csv / json / xlsx
  "date_range": {
    "start_date": "2024-01-01",
    "end_date": "2024-01-31"
  },
  "filters": {
    "class_id": "uuid-class-1",      // 任意: 特定クラスのみ
    "child_id": "uuid-child-1"       // 任意: 特定児童のみ
  },
  "include_times": true,             // 登園・降園時刻を含むか
  "aggregate_by": "child"            // child / date / class
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "export_id": "uuid-export-3",
    "filename": "attendance_data_20240101_20240131.csv",
    "download_url": "https://storage.supabase.co/.../exports/attendance_data_20240101_20240131.csv",
    "expires_at": "2024-01-16T10:00:00+09:00",
    "record_count": 540,
    "summary": {
      "total_days": 22,
      "total_children": 25,
      "total_attendance": 540
    },
    "file_size": 65536,
    "created_at": "2024-01-15T10:00:00+09:00"
  }
}
```

**処理内容**:
1. 指定された期間・条件で出席データを取得
2. `aggregate_by`に応じてデータを集計
3. CSV/JSON/XLSX形式に変換
4. Supabase Storageにアップロード
5. 署名付きURLを生成（24時間有効）
6. エクスポート履歴を`h_exports`に記録

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `400 Bad Request`: 無効なパラメータ、期間が長すぎる（最大1年）
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: アクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 4. 全データバックアップ

**エンドポイント**: `POST /api/export/backup`

**説明**: 施設の全データをバックアップします（児童、記録、出席、設定など）。

**リクエストボディ**:
```typescript
{
  "format": "json",                  // json / zip（複数CSVファイル）
  "include_photos": false,           // 写真を含むか
  "include_deleted": false,          // 削除済みデータを含むか
  "encryption": true                 // 暗号化するか（推奨）
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "export_id": "uuid-export-4",
    "filename": "backup_full_20240115_100000.zip",
    "download_url": "https://storage.supabase.co/.../exports/backup_full_20240115_100000.zip",
    "expires_at": "2024-01-22T10:00:00+09:00",  // 7日間有効
    "included_data": {
      "children": 25,
      "guardians": 42,
      "classes": 6,
      "users": 15,
      "observations": 245,
      "activities": 489,
      "voices": 156,
      "attendance": 2450,
      "photos": 320  // include_photos: trueの場合
    },
    "file_size": 52428800,  // bytes (50MB)
    "is_encrypted": true,
    "created_at": "2024-01-15T10:00:00+09:00"
  }
}
```

**処理内容**:
1. 全テーブルからデータを取得
   - m_children, m_guardians, m_classes, m_users
   - r_observation, r_activity, r_voice
   - h_attendance
   - s_attendance_schedule
   - 関連する中間テーブル
2. 各テーブルをJSON/CSV形式に変換
3. 写真を含む場合はStorageからダウンロード
4. 全ファイルをZIPアーカイブに圧縮
5. 暗号化フラグがtrueの場合、AES-256で暗号化
6. Supabase Storageにアップロード
7. 署名付きURLを生成（7日間有効）
8. エクスポート履歴を`h_exports`に記録

**権限別アクセス制御**:
- **site_admin**: 不可
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `400 Bad Request`: 無効なパラメータ
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: アクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 5. エクスポート履歴取得

**エンドポイント**: `GET /api/export/history`

**説明**: 過去のエクスポート履歴を取得します。

**リクエストパラメータ**:
```typescript
{
  export_type?: string;    // children / records / attendance / backup
  limit?: number;          // 取得件数（デフォルト: 20）
  offset?: number;         // オフセット
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "exports": [
      {
        "export_id": "uuid-export-4",
        "export_type": "backup",
        "filename": "backup_full_20240115_100000.zip",
        "download_url": "https://storage.supabase.co/.../exports/backup_full_20240115_100000.zip",
        "record_count": 3456,
        "file_size": 52428800,
        "is_expired": false,
        "expires_at": "2024-01-22T10:00:00+09:00",
        "created_by": {
          "user_id": "uuid-user-1",
          "name": "田中 花子"
        },
        "created_at": "2024-01-15T10:00:00+09:00"
      },
      {
        "export_id": "uuid-export-3",
        "export_type": "attendance",
        "filename": "attendance_data_20240101_20240131.csv",
        "download_url": null,  // 期限切れ
        "record_count": 540,
        "file_size": 65536,
        "is_expired": true,
        "expires_at": "2024-01-14T10:00:00+09:00",
        "created_by": {
          "user_id": "uuid-user-1",
          "name": "田中 花子"
        },
        "created_at": "2024-01-13T10:00:00+09:00"
      }
    ],
    "total": 15,
    "has_more": false
  }
}
```

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `500 Internal Server Error`: サーバーエラー

---

### 6. エクスポートファイル削除

**エンドポイント**: `DELETE /api/export/:id`

**説明**: エクスポートしたファイルを削除します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "message": "エクスポートファイルを削除しました"
}
```

**処理内容**:
1. Supabase Storageからファイルを削除
2. `h_exports`テーブルの`deleted_at`を更新

**権限別アクセス制御**:
- **site_admin**: 不可
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: エクスポートが見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

## データベース要件

### 使用テーブル

#### 1. h_exports（エクスポート履歴）
```sql
CREATE TABLE IF NOT EXISTS h_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),
  user_id UUID NOT NULL REFERENCES m_users(id),

  -- エクスポート情報
  export_type VARCHAR(20) NOT NULL,  -- children / records / attendance / backup
  filename VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,           -- Supabase Storage上のパス
  download_url TEXT,
  record_count INTEGER,
  file_size BIGINT,                  -- bytes

  -- 設定
  format VARCHAR(10),                -- csv / json / xlsx / zip
  filters JSONB,                     -- エクスポート条件
  is_encrypted BOOLEAN DEFAULT false,

  -- 有効期限
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_h_exports_facility
  ON h_exports(facility_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_h_exports_user
  ON h_exports(user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_h_exports_type
  ON h_exports(export_type)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_h_exports_created
  ON h_exports(created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_h_exports_expires
  ON h_exports(expires_at)
  WHERE deleted_at IS NULL;
```

---

## クエリ例

### 児童データエクスポートクエリ

```sql
-- 児童データを取得
SELECT
  c.family_name || ' ' || c.given_name as name,
  c.family_name_kana || ' ' || c.given_name_kana as kana,
  c.gender,
  c.birth_date,
  EXTRACT(YEAR FROM AGE(c.birth_date)) as age,
  cl.name as class_name,
  c.enrollment_status,
  c.enrollment_date,
  c.withdrawal_date,

  -- 保護者情報
  g.family_name || ' ' || g.given_name as parent_name,
  g.phone as parent_phone,
  g.email as parent_email,

  -- アレルギー情報
  c.has_allergy,
  c.allergy_detail,

  -- 許可設定
  c.photo_allowed,
  c.report_allowed

FROM m_children c
INNER JOIN _child_class cc ON c.id = cc.child_id AND cc.is_current = true
INNER JOIN m_classes cl ON cc.class_id = cl.id
LEFT JOIN _child_guardian cg ON c.id = cg.child_id AND cg.is_primary = true
LEFT JOIN m_guardians g ON cg.guardian_id = g.id

WHERE c.facility_id = $1  -- facility_id (from session)
  AND c.deleted_at IS NULL
  AND ($2::VARCHAR IS NULL OR c.enrollment_status = $2)  -- enrollment_status filter
  AND ($3::UUID IS NULL OR cl.id = $3)  -- class_id filter
  AND ($4::BOOLEAN IS NULL OR c.has_allergy = $4)  -- has_allergy filter

ORDER BY cl.display_order, c.family_name_kana, c.given_name_kana;
```

### 記録データエクスポートクエリ

```sql
-- 観察記録
SELECT
  'observation' as record_type,
  o.id as record_id,
  o.record_date,
  c.family_name || ' ' || c.given_name as child_name,
  cl.name as class_name,
  o.content,
  o.growth_area,
  o.tags,
  u.name as created_by,
  o.created_at
FROM r_observation o
INNER JOIN m_children c ON o.child_id = c.id
INNER JOIN _child_class cc ON c.id = cc.child_id AND cc.is_current = true
INNER JOIN m_classes cl ON cc.class_id = cl.id
INNER JOIN m_users u ON o.created_by = u.id
WHERE o.facility_id = $1
  AND o.record_date BETWEEN $2 AND $3
  AND o.deleted_at IS NULL

UNION ALL

-- 活動記録
SELECT
  'activity' as record_type,
  a.id as record_id,
  a.activity_date as record_date,
  c.family_name || ' ' || c.given_name as child_name,
  cl.name as class_name,
  a.activity_content as content,
  a.activity_type as growth_area,
  NULL as tags,
  u.name as created_by,
  a.created_at
FROM r_activity a
INNER JOIN m_children c ON a.child_id = c.id
INNER JOIN _child_class cc ON c.id = cc.child_id AND cc.is_current = true
INNER JOIN m_classes cl ON cc.class_id = cl.id
INNER JOIN m_users u ON a.created_by = u.id
WHERE a.facility_id = $1
  AND a.activity_date BETWEEN $2 AND $3
  AND a.deleted_at IS NULL

UNION ALL

-- 子どもの声
SELECT
  'voice' as record_type,
  v.id as record_id,
  v.record_date,
  c.family_name || ' ' || c.given_name as child_name,
  cl.name as class_name,
  v.voice_content as content,
  v.context as growth_area,
  NULL as tags,
  u.name as created_by,
  v.created_at
FROM r_voice v
INNER JOIN m_children c ON v.child_id = c.id
INNER JOIN _child_class cc ON c.id = cc.child_id AND cc.is_current = true
INNER JOIN m_classes cl ON cc.class_id = cl.id
INNER JOIN m_users u ON v.created_by = u.id
WHERE v.facility_id = $1
  AND v.record_date BETWEEN $2 AND $3
  AND v.deleted_at IS NULL

ORDER BY record_date DESC, created_at DESC;
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
   - 自社が運営する全施設のデータをエクスポート可能
   - 全てのエクスポート機能が利用可能

3. **facility_admin（施設管理者）**:
   - 自施設のデータをエクスポート可能
   - 全てのエクスポート機能が利用可能

4. **staff（一般職員）**:
   - エクスポート機能は利用不可（管理者のみ）

#### 施設IDの取得
- `facility_id`はリクエストパラメータではなく、セッション情報（`current_facility_id`）から自動取得します
- これにより、ユーザーが不正な施設IDを指定することを防止します

#### データ分離
- RLS（Row Level Security）で施設レベルのデータを分離
- クエリ実行時に`facility_id`でフィルタリング
- エクスポートファイルは施設ごとに隔離されたフォルダに保存

#### エラーハンドリング戦略
- アクセス権限がない場合: `404 Not Found`を返す
- 理由: `403 Forbidden`ではリソースの存在を推測可能になるため、セキュリティ上`404`を優先

### データ保護
- **暗号化**: バックアップファイルはAES-256で暗号化可能
- **有効期限**: エクスポートファイルは自動的に期限切れになる
  - 通常エクスポート: 24時間
  - 全データバックアップ: 7日間
- **署名付きURL**: Supabase Storageの署名付きURLで安全にダウンロード
- **匿名化**: 記録データは個人情報を匿名化してエクスポート可能

### バリデーション
- 期間制限: エクスポート期間は最大1年まで
- ファイルサイズ制限: 最大100MBまで（超える場合は分割）
- レート制限: 1日あたりのエクスポート回数を制限（Phase 2）

---

## パフォーマンス考慮事項

### 非同期処理
- 大量データのエクスポートは非同期ジョブで実行
- ジョブキューを使用してバックグラウンドで処理
- 完了時にメール通知（Phase 2）

### ファイルサイズ最適化
- 写真は圧縮してエクスポート
- 不要な列は除外
- 大量データは分割ファイルで提供

### ストレージ管理
- 期限切れファイルは自動削除（クリーンアップジョブ）
- 古いエクスポート履歴は定期的にアーカイブ

---

## エラーハンドリング

### 共通エラーコード
```typescript
{
  "NO_DATA_TO_EXPORT": "エクスポートするデータがありません",
  "INVALID_DATE_RANGE": "無効な期間です",
  "DATE_RANGE_TOO_LONG": "期間が長すぎます（最大1年）",
  "FILE_TOO_LARGE": "エクスポートファイルが大きすぎます（最大100MB）",
  "EXPORT_NOT_FOUND": "エクスポートが見つかりません",
  "EXPORT_EXPIRED": "エクスポートファイルの有効期限が切れています",
  "PERMISSION_DENIED": "データをエクスポートする権限がありません"
}
```

---

## UI/UX要件

### データエクスポート画面
```tsx
1. エクスポートタイプ選択
   - 児童データ
   - 記録データ
   - 出席データ
   - 全データバックアップ

2. エクスポート設定
   - フォーマット選択（CSV / JSON / XLSX）
   - 期間指定（記録・出席データ）
   - フィルター設定
   - オプション設定（写真含む、匿名化など）

3. エクスポート履歴
   - 過去のエクスポート一覧
   - ダウンロードボタン
   - 有効期限の表示
   - 削除ボタン
```

### プログレス表示
- エクスポート処理中のプログレスバー
- 完了時の通知
- エラー時のメッセージ

---

## 今後の拡張予定

### Phase 2
- 完了通知メール
- スケジュール自動バックアップ
- クラウドストレージ連携（Google Drive, Dropbox）
- エクスポートテンプレート保存

### Phase 3
- カスタムレポート生成
- PDFエクスポート
- グラフ・チャート付きレポート
- AIによるデータ分析レポート

---

**作成日**: 2025-01-09
**最終更新**: 2025-01-09
**関連ドキュメント**:
- `03_database.md` - データベース設計
- `04_api.md` - API基本設計
- `16_children_list_api.md` - 子ども一覧API
- `10_activity_record_api.md` - 活動記録API
- `11_observation_record_api.md` - 観察記録API
