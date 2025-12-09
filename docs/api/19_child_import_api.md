# CSV一括登録API仕様書

## 概要
CSVファイルを使用した児童情報の一括登録・更新機能のAPI仕様を定義します。
大量の児童データを効率的にインポートし、エラーハンドリング、バリデーション、プレビュー機能を提供します。

---

## システムフロー

### 想定される利用シーン

1. **新年度の一括登録**:
   - 新年度開始時に全児童のデータをCSVで一括登録
   - クラス編成の更新

2. **既存データの一括更新**:
   - 保護者の連絡先変更の一括反映
   - アレルギー情報の更新

3. **他システムからの移行**:
   - 既存の保育システムからデータを移行
   - Excelで管理していたデータの取り込み

---

## エンドポイント一覧

### 1. CSVテンプレートダウンロード

**エンドポイント**: `GET /api/children/import/template`

**説明**: CSV一括登録用のテンプレートファイルをダウンロードします。

**リクエストパラメータ**:
```typescript
{
  format?: string;  // csv / xlsx (デフォルト: csv)
}
```

**レスポンス** (成功):
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="children_import_template.csv"

# CSVファイルの内容
氏名（姓）,氏名（名）,フリガナ（姓）,フリガナ（名）,呼び名,性別,生年月日,クラス名,ステータス,契約形態,入所日,保護者氏名,続柄,電話番号,メールアドレス,住所,アレルギー有無,アレルギー詳細,特性,保護者要望
田中,陽翔,タナカ,ハルト,はるくん,男,2018-05-15,ひまわり組,在籍中,通年契約,2023-04-01,田中 優子,母,090-1111-2222,[email protected],東京都渋谷区...,はい,卵・乳製品,大きな音が苦手,英語対応希望
```

**処理内容**:
1. CSVまたはExcelフォーマットでテンプレートを生成
2. サンプルデータを1行含める
3. 各列のヘッダーに説明コメントを付与（Excel形式の場合）

**権限別アクセス制御**:
- **site_admin**: 可
- **company_admin**: 可
- **facility_admin**: 可
- **staff**: 可

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `500 Internal Server Error`: サーバーエラー

---

### 2. CSVファイルアップロード（検証のみ）

**エンドポイント**: `POST /api/children/import/validate`

**説明**: CSVファイルをアップロードし、データの検証とプレビューを行います。実際のデータベースへの保存は行いません。

**リクエストボディ**:
```typescript
{
  "file": "base64_encoded_csv_data",
  "filename": "children_import.csv",
  "options": {
    "update_existing": false,       // 既存データを更新するか（デフォルト: false）
    "skip_duplicates": true,        // 重複データをスキップするか（デフォルト: true）
    "encoding": "utf-8"             // ファイルエンコーディング（utf-8 / shift-jis）
  }
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "validation_id": "uuid-validation-1",  // 検証結果ID（本登録時に使用）
    "total_rows": 50,
    "valid_rows": 45,
    "invalid_rows": 5,

    // 検証サマリー
    "summary": {
      "new_children": 40,           // 新規登録される児童数
      "update_children": 5,         // 更新される児童数
      "duplicate_children": 3,      // 重複している児童数
      "error_children": 5           // エラーがある児童数
    },

    // 検証済みデータのプレビュー（最初の10件）
    "preview": [
      {
        "row_number": 2,
        "status": "valid",          // valid / warning / error
        "action": "create",         // create / update / skip
        "data": {
          "family_name": "田中",
          "given_name": "陽翔",
          "family_name_kana": "タナカ",
          "given_name_kana": "ハルト",
          "gender": "male",
          "birth_date": "2018-05-15",
          "class_name": "ひまわり組"
        },
        "messages": []
      },
      {
        "row_number": 3,
        "status": "error",
        "action": "skip",
        "data": {
          "family_name": "佐藤",
          "given_name": "",
          "birth_date": "invalid-date"
        },
        "messages": [
          "名（given_name）は必須です",
          "生年月日の形式が正しくありません"
        ]
      },
      {
        "row_number": 4,
        "status": "warning",
        "action": "update",
        "data": {
          "family_name": "鈴木",
          "given_name": "さくら",
          "phone": "090-3333-4444"
        },
        "messages": [
          "この児童は既に登録されています。連絡先のみ更新されます。"
        ]
      }
    ],

    // エラー詳細（全件）
    "errors": [
      {
        "row_number": 3,
        "field": "given_name",
        "message": "名（given_name）は必須です"
      },
      {
        "row_number": 3,
        "field": "birth_date",
        "message": "生年月日の形式が正しくありません"
      },
      {
        "row_number": 7,
        "field": "class_name",
        "message": "クラス「たんぽぽ組」が見つかりません"
      }
    ],

    // 警告詳細（全件）
    "warnings": [
      {
        "row_number": 4,
        "message": "この児童は既に登録されています"
      },
      {
        "row_number": 10,
        "message": "電話番号の形式が推奨形式と異なります"
      }
    ],

    // 一時ファイルのURL（エラーCSVダウンロード用）
    "error_csv_url": "https://.../tmp/validation-errors-uuid.csv",
    "expires_at": "2024-01-15T11:00:00+09:00"  // 1時間後
  }
}
```

**処理内容**:
1. CSVファイルをパース（UTF-8またはShift-JIS対応）
2. 各行のバリデーション:
   - 必須項目チェック
   - データ形式チェック（日付、メール、電話番号など）
   - 既存データとの重複チェック
   - クラス名の存在チェック
3. 検証結果を一時テーブル（`tmp_import_validations`）に保存
4. エラー・警告の詳細をレスポンスで返却
5. エラーがある行をCSVファイルとして生成（修正用）

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `400 Bad Request`: ファイル形式が無効、ファイルサイズ超過（最大10MB）
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: 権限不足（staffユーザー）
- `500 Internal Server Error`: サーバーエラー

---

### 3. CSVデータ本登録

**エンドポイント**: `POST /api/children/import/execute`

**説明**: 検証済みのCSVデータを実際にデータベースに登録します。

**リクエストボディ**:
```typescript
{
  "validation_id": "uuid-validation-1",  // 検証結果ID
  "confirm": true                         // 確認フラグ
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "import_id": "uuid-import-1",
    "total_processed": 45,
    "created_count": 40,
    "updated_count": 5,
    "skipped_count": 3,
    "failed_count": 0,

    // 処理結果の詳細
    "results": [
      {
        "row_number": 2,
        "action": "created",
        "child_id": "uuid-child-new-1",
        "child_name": "田中 陽翔"
      },
      {
        "row_number": 3,
        "action": "skipped",
        "reason": "バリデーションエラー"
      }
    ],

    // 処理完了時刻
    "completed_at": "2024-01-15T10:15:00+09:00"
  },
  "message": "45件の児童データをインポートしました"
}
```

**処理内容**:
1. `validation_id`で検証結果を取得
2. 検証済みデータのみを処理（エラー行はスキップ）
3. トランザクション内で一括登録:
   - `m_children`テーブルに児童データを挿入
   - `m_guardians`テーブルに保護者データを挿入
   - `_child_guardian`テーブルで紐付け
   - `_child_class`テーブルでクラス紐付け
4. インポート履歴を`h_import_logs`に記録
5. 処理結果をレスポンスで返却

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `400 Bad Request`: 無効なvalidation_id、検証結果の有効期限切れ
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: 権限不足（staffユーザー）
- `404 Not Found`: 検証結果が見つからない
- `500 Internal Server Error`: サーバーエラー

---

### 4. インポート履歴一覧取得

**エンドポイント**: `GET /api/children/import/history`

**説明**: 過去のインポート履歴を取得します。

**リクエストパラメータ**:
```typescript
{
  limit?: number;   // 取得件数（デフォルト: 20）
  offset?: number;  // オフセット
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "history": [
      {
        "import_id": "uuid-import-1",
        "filename": "children_import_2024.csv",
        "total_rows": 50,
        "created_count": 40,
        "updated_count": 5,
        "skipped_count": 3,
        "failed_count": 2,
        "imported_by": "山田 太郎",
        "imported_at": "2024-01-15T10:15:00+09:00",
        "status": "completed"         // completed / failed / processing
      },
      {
        "import_id": "uuid-import-2",
        "filename": "children_update.csv",
        "total_rows": 20,
        "created_count": 0,
        "updated_count": 18,
        "skipped_count": 2,
        "failed_count": 0,
        "imported_by": "佐藤 花子",
        "imported_at": "2024-01-10T14:30:00+09:00",
        "status": "completed"
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
- `403 Forbidden`: 権限不足（staffユーザー）
- `500 Internal Server Error`: サーバーエラー

---

### 5. インポート結果詳細取得

**エンドポイント**: `GET /api/children/import/:importId`

**説明**: 特定のインポート処理の詳細結果を取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "import_id": "uuid-import-1",
    "filename": "children_import_2024.csv",
    "total_rows": 50,
    "created_count": 40,
    "updated_count": 5,
    "skipped_count": 3,
    "failed_count": 2,
    "imported_by": "山田 太郎",
    "imported_at": "2024-01-15T10:15:00+09:00",
    "status": "completed",

    // 処理詳細
    "details": [
      {
        "row_number": 2,
        "action": "created",
        "child_id": "uuid-child-new-1",
        "child_name": "田中 陽翔",
        "status": "success"
      },
      {
        "row_number": 3,
        "action": "skipped",
        "status": "error",
        "error_message": "必須項目が不足しています"
      }
    ],

    // エラーCSVのダウンロードURL
    "error_csv_url": "https://.../imports/uuid-import-1-errors.csv"
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
- `403 Forbidden`: 権限不足（staffユーザー）
- `404 Not Found`: インポート履歴が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

## データベース要件

### 使用テーブル

#### 1. tmp_import_validations（検証結果一時テーブル）
```sql
CREATE TABLE IF NOT EXISTS tmp_import_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),
  user_id UUID NOT NULL REFERENCES m_users(id),

  -- 検証結果
  total_rows INTEGER NOT NULL,
  valid_rows INTEGER NOT NULL,
  invalid_rows INTEGER NOT NULL,

  -- 検証済みデータ（JSON）
  validated_data JSONB NOT NULL,

  -- エラー・警告
  errors JSONB,
  warnings JSONB,

  -- 有効期限（1時間）
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tmp_import_validations_facility
  ON tmp_import_validations(facility_id);

CREATE INDEX idx_tmp_import_validations_expires
  ON tmp_import_validations(expires_at)
  WHERE expires_at > NOW();

-- 自動削除（有効期限切れのレコード）
CREATE OR REPLACE FUNCTION delete_expired_validations()
RETURNS void AS $$
BEGIN
  DELETE FROM tmp_import_validations
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 定期実行（1時間ごと）
-- SELECT cron.schedule('delete-expired-validations', '0 * * * *', 'SELECT delete_expired_validations()');
```

#### 2. h_import_logs（インポート履歴）
```sql
CREATE TABLE IF NOT EXISTS h_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),
  user_id UUID NOT NULL REFERENCES m_users(id),

  -- ファイル情報
  filename VARCHAR(255) NOT NULL,
  file_size INTEGER,

  -- 処理結果
  total_rows INTEGER NOT NULL,
  created_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,

  -- 処理詳細（JSON）
  details JSONB,

  -- ステータス
  status VARCHAR(20) DEFAULT 'processing',  -- processing / completed / failed

  -- タイムスタンプ
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_h_import_logs_facility
  ON h_import_logs(facility_id);

CREATE INDEX idx_h_import_logs_user
  ON h_import_logs(user_id);

CREATE INDEX idx_h_import_logs_status
  ON h_import_logs(status);

CREATE INDEX idx_h_import_logs_created_at
  ON h_import_logs(created_at DESC);
```

#### 3. m_children（子どもマスタ）
```sql
-- 既存のテーブル構造（17_child_registration_api.mdを参照）
```

---

## CSVフォーマット仕様

### カラム定義

| カラム名 | 型 | 必須 | 説明 | 例 |
|---------|-----|------|------|-----|
| 氏名（姓） | String | ○ | 児童の姓 | 田中 |
| 氏名（名） | String | ○ | 児童の名 | 陽翔 |
| フリガナ（姓） | String | ○ | 姓のフリガナ | タナカ |
| フリガナ（名） | String | ○ | 名のフリガナ | ハルト |
| 呼び名 | String | - | 愛称 | はるくん |
| 性別 | String | ○ | 男/女/その他 | 男 |
| 生年月日 | Date | ○ | YYYY-MM-DD形式 | 2018-05-15 |
| クラス名 | String | ○ | 所属クラス名 | ひまわり組 |
| ステータス | String | ○ | 在籍中/休園中/退所済/入所前 | 在籍中 |
| 契約形態 | String | ○ | 通年契約/一時保育/スポット利用 | 通年契約 |
| 入所日 | Date | ○ | YYYY-MM-DD形式 | 2023-04-01 |
| 保護者氏名 | String | ○ | 保護者のフルネーム | 田中 優子 |
| 続柄 | String | ○ | 母/父/祖父/祖母/その他 | 母 |
| 電話番号 | String | ○ | 090-0000-0000形式 | 090-1111-2222 |
| メールアドレス | String | - | メールアドレス | [email protected] |
| 住所 | String | - | 保護者の住所 | 東京都渋谷区... |
| アレルギー有無 | String | - | はい/いいえ | はい |
| アレルギー詳細 | String | - | アレルギー品目 | 卵・乳製品 |
| 特性 | String | - | 子どもの特性 | 大きな音が苦手 |
| 保護者要望 | String | - | 保護者からの要望 | 英語対応希望 |

### バリデーションルール

```typescript
// バリデーション定義
const validationRules = {
  // 必須チェック
  required: ['氏名（姓）', '氏名（名）', 'フリガナ（姓）', 'フリガナ（名）', '性別', '生年月日', 'クラス名', 'ステータス', '契約形態', '入所日', '保護者氏名', '続柄', '電話番号'],

  // 形式チェック
  formats: {
    '生年月日': /^\d{4}-\d{2}-\d{2}$/,
    '入所日': /^\d{4}-\d{2}-\d{2}$/,
    '電話番号': /^0\d{1,4}-\d{1,4}-\d{4}$/,
    'メールアドレス': /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    'フリガナ（姓）': /^[ァ-ヶー]+$/,
    'フリガナ（名）': /^[ァ-ヶー]+$/
  },

  // 列挙値チェック
  enums: {
    '性別': ['男', '女', 'その他'],
    'ステータス': ['在籍中', '休園中', '退所済', '入所前'],
    '契約形態': ['通年契約', '一時保育', 'スポット利用'],
    '続柄': ['母', '父', '祖父', '祖母', 'その他'],
    'アレルギー有無': ['はい', 'いいえ', '']
  },

  // 重複チェック
  duplicateCheck: ['氏名（姓）', '氏名（名）', '生年月日']
};
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
   - CSV一括登録・更新が可能

4. **staff（一般職員）**:
   - CSV一括登録は不可（管理者のみ）

#### 施設IDの取得
- `facility_id`はリクエストパラメータではなく、セッション情報（`current_facility_id`）から自動取得します
- これにより、ユーザーが不正な施設IDを指定することを防止します

#### データ分離
- RLS（Row Level Security）で施設レベルのデータを分離
- クエリ実行時に`facility_id`でフィルタリング

#### エラーハンドリング戦略
- アクセス権限がない場合: `404 Not Found`を返す
- 理由: `403 Forbidden`ではリソースの存在を推測可能になるため、セキュリティ上`404`を優先

### ファイル検証
- ファイルサイズ制限: 最大10MB
- 行数制限: 最大1000行
- ファイル形式: CSV、Excel（.xlsx）のみ
- エンコーディング: UTF-8、Shift-JIS対応

### データ検証
- SQLインジェクション対策: プリペアドステートメント使用
- XSS対策: 入力値のサニタイズ
- 重複チェック: 名前+生年月日で既存データと照合

---

## パフォーマンス考慮事項

### 大量データ処理
- バッチ処理: 100件ずつトランザクション分割
- 非同期処理: 500件以上はバックグラウンドジョブで実行
- 進捗通知: WebSocketまたはポーリングで進捗を通知

### インデックス
```sql
-- 重複チェック用の複合インデックス
CREATE INDEX idx_m_children_duplicate_check
  ON m_children(family_name, given_name, birth_date)
  WHERE deleted_at IS NULL;
```

### キャッシュ無効化
- インポート完了後は児童一覧のキャッシュを無効化

---

## エラーハンドリング

### 共通エラーコード
```typescript
{
  "FILE_TOO_LARGE": "ファイルサイズが大きすぎます（最大10MB）",
  "INVALID_FILE_FORMAT": "ファイル形式が無効です（CSV, Excelのみ）",
  "TOO_MANY_ROWS": "行数が多すぎます（最大1000行）",
  "INVALID_ENCODING": "ファイルのエンコーディングが無効です",
  "VALIDATION_EXPIRED": "検証結果の有効期限が切れています。再度アップロードしてください",
  "IMPORT_IN_PROGRESS": "別のインポート処理が実行中です",
  "REQUIRED_FIELD_MISSING": "必須項目が不足しています",
  "INVALID_DATE_FORMAT": "日付の形式が正しくありません（YYYY-MM-DD）",
  "INVALID_PHONE_FORMAT": "電話番号の形式が正しくありません",
  "CLASS_NOT_FOUND": "指定されたクラスが見つかりません",
  "DUPLICATE_ENTRY": "この児童は既に登録されています"
}
```

---

## UI/UX要件

### アップロード画面
```tsx
// ドラッグ＆ドロップエリア
<DropZone
  accept=".csv, .xlsx"
  maxSize={10 * 1024 * 1024}  // 10MB
  onDrop={handleFileUpload}
>
  <Upload />
  <p>CSVファイルをドラッグ＆ドロップ</p>
  <p>または</p>
  <Button>ファイルを選択</Button>
</DropZone>
```

### 検証結果プレビュー
```tsx
// 検証結果の表示
<ValidationResult
  total={50}
  valid={45}
  invalid={5}
  errors={errors}
  warnings={warnings}
  preview={preview}
/>

// エラー行のハイライト表示
// 修正用CSVダウンロードボタン
// 本登録ボタン（エラーがある場合は無効化）
```

### 処理進捗表示
```tsx
// 進捗バー
<ProgressBar
  current={currentRow}
  total={totalRows}
  status="処理中... (25/50)"
/>

// 完了メッセージ
<SuccessMessage
  created={40}
  updated={5}
  skipped={3}
  failed={2}
/>
```

---

## 今後の拡張予定

### Phase 2
- Excelファイル対応（.xlsx）
- 画像の一括アップロード（写真フォルダとの紐付け）
- インポート予約（指定日時に自動実行）
- メール通知（インポート完了通知）

### Phase 3
- 他システムとのAPI連携
- リアルタイム同期
- バージョン管理（インポート前後の差分管理）
- ロールバック機能（インポート取り消し）

---

**作成日**: 2025-01-09
**最終更新**: 2025-01-09
**関連ドキュメント**:
- `03_database.md` - データベース設計
- `04_api.md` - API基本設計
- `17_child_registration_api.md` - 子ども登録API
- `18_child_edit_api.md` - 子ども編集API
