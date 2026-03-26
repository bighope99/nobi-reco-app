# 個人観察記録API仕様書

## 概要

特定の児童に対する観察記録の入力・管理・AI分類に使用するAPI群の仕様を定義します。
活動記録とは異なり、1人の児童に対する観察やエピソードを個別に記録し、AIによる事実/所感の分離・非認知能力タグの自動付与を行う機能です。

> **移行情報**: 旧エンドポイント `/api/observations` は廃止済み。すべて `/api/records/personal` に移行。

---

## エンドポイント一覧

| # | メソッド | パス | 説明 |
|---|---------|------|------|
| 1 | `GET` | `/api/records/personal` | 記録一覧取得（施設スコープ） |
| 2 | `POST` | `/api/records/personal` | 記録作成 |
| 3 | `GET` | `/api/records/personal/[id]` | 記録詳細取得 |
| 4 | `PATCH` | `/api/records/personal/[id]` | 記録更新 |
| 5 | `POST` | `/api/records/personal/[id]/ai` | AI分類結果の保存 |
| 6 | `POST` | `/api/records/personal/ai` | AI解析実行 |
| 7 | `GET` | `/api/records/personal/tags` | 非認知能力タグ一覧 |
| 8 | `GET` | `/api/records/personal/child/[childId]/recent` | 児童の最近の記録一覧 |

---

## 1. 記録一覧取得

**エンドポイント**: `GET /api/records/personal`

**説明**: 施設に所属する児童の個人観察記録一覧を取得します。施設スコープ（`current_facility_id`）で自動フィルタリング。

### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `from_date` | `string` | - | 開始日（`YYYY-MM-DD`） |
| `to_date` | `string` | - | 終了日（`YYYY-MM-DD`） |
| `class_id` | `string` | - | クラスIDフィルタ（`_child_class.is_current=true` で絞り込み） |
| `staff_id` | `string (UUID)` | - | 記録者ID（`recorded_by`）フィルタ |
| `child_name` | `string` | - | 児童名（部分一致、復号後に漢字/かな/ニックネーム検索） |
| `grade` | `string` | - | 学年フィルタ（`calculateGrade` で算出） |
| `keyword` | `string` | - | 本文キーワード検索（最大100文字、`content` ILIKE） |
| `limit` | `number` | - | 取得件数（デフォルト: 20、最大: 100） |
| `offset` | `number` | - | オフセット（ページネーション） |

### バリデーション

- `from_date` / `to_date`: `YYYY-MM-DD` 形式チェック
- `from_date > to_date` の場合 400 エラー
- `staff_id`: UUID形式チェック
- `keyword`: 100文字超過分は自動切り捨て

### レスポンス (成功: 200)

```typescript
{
  "success": true,
  "data": {
    "observations": [
      {
        "id": "uuid",
        "observation_date": "2026-03-26",
        "child_id": "uuid",
        "child_name": "渡辺 颯",          // 復号化したフルネーム
        "class_id": "uuid" | null,
        "class_name": "ひまわり組" | null,
        "grade": 3,                        // 学年（数値）
        "grade_label": "3年生",
        "category": "自己肯定感" | null,    // 最初のタグ名
        "category_color": "#FF6B6B" | null,
        "content": "本文テキスト",
        "objective": "事実テキスト" | null,
        "subjective": "所感テキスト" | null,
        "is_ai_analyzed": true,
        "staff_name": "作成者名" | null,
        "recorded_by_name": "記録者名" | null
      }
    ],
    "total": 45,
    "has_more": true
  }
}
```

### エラーレスポンス

| ステータス | 条件 |
|-----------|------|
| `400` | 日付形式不正、`from_date > to_date`、`staff_id` 形式不正 |
| `401` | 未認証、または `current_facility_id` 未設定 |
| `500` | サーバーエラー |

---

## 2. 記録作成

**エンドポイント**: `POST /api/records/personal`

**説明**: 特定の児童に対する観察記録を新規作成します。

### リクエストボディ

```typescript
{
  "child_id": "uuid",                          // 必須: 対象児童ID
  "observation_date": "2026-03-26",            // 必須: 観察日（YYYY-MM-DD）
  "content": "観察内容テキスト",                  // 必須: 本文（最大5,000文字）
  "recorded_by": "uuid",                       // 必須: 記録者ユーザーID
  "ai_action": "事実テキスト",                   // 任意: AI抽出の事実
  "ai_opinion": "所感テキスト",                  // 任意: AI抽出の所感
  "tag_flags": { "tag-uuid-1": true },         // 任意: 非認知能力タグフラグ
  "activity_id": "uuid"                        // 任意: 紐づく活動記録ID
}
```

### バリデーション

| フィールド | ルール |
|-----------|--------|
| `child_id` | UUID形式、対象施設に所属する児童であること |
| `observation_date` | 必須 |
| `content` | 必須、最大5,000文字 |
| `recorded_by` | 必須、UUID形式、同一会社のアクティブユーザーであること |
| `activity_id` | 指定時は同施設のアクティブな活動記録であること（空文字は `null` に正規化） |

### 処理内容

1. `r_observation` テーブルにレコード挿入
   - `created_by` / `updated_by`: セッションのユーザーID
   - `is_ai_analyzed`: `ai_action` または `ai_opinion` が存在する場合 `true`
   - `ai_analyzed_at`: AI解析済みの場合は現在時刻
2. `tag_flags` が存在する場合、`_record_tag` にタグを紐づけ（`is_auto_tagged: true`）
   - タグ挿入エラーは非致命的（本体の保存は成功）

### レスポンス (成功: 200)

```typescript
{
  "success": true,
  "data": {
    "id": "uuid",
    "child_id": "uuid",
    "observation_date": "2026-03-26",
    "content": "観察内容テキスト"
  }
}
```

### エラーレスポンス

| ステータス | 条件 |
|-----------|------|
| `400` | 必須項目不足、`content` 超過、`recorded_by` 形式不正/該当なし、`activity_id` 無効 |
| `401` | 未認証 |
| `403` | 児童が現在の施設に所属していない |
| `404` | 児童が見つからない |
| `500` | サーバーエラー |

---

## 3. 記録詳細取得

**エンドポイント**: `GET /api/records/personal/[id]`

**説明**: 特定の観察記録の詳細を取得します。同じ児童の最近の記録（最大10件）も含む。

### レスポンス (成功: 200)

```typescript
{
  "success": true,
  "data": {
    "id": "uuid",
    "child_id": "uuid",
    "child_name": "渡辺 颯",              // 復号化した名前（nickname優先）
    "observation_date": "2026-03-26",
    "content": "本文テキスト",
    "objective": "事実テキスト",            // AI抽出の事実（空文字列 fallback）
    "subjective": "所感テキスト",           // AI抽出の所感（空文字列 fallback）
    "tag_flags": {                         // タグID→boolean のマップ
      "tag-uuid-1": true,
      "tag-uuid-2": true
    },
    "created_by": "uuid",
    "created_by_name": "作成者名",
    "created_at": "ISO8601",
    "updated_at": "ISO8601",
    "recorded_by": "uuid" | null,
    "recorded_by_name": "記録者名" | null,
    "recent_observations": [               // 同じ児童の最近の記録（最大10件、自身を除く）
      {
        "id": "uuid",
        "observation_date": "2026-03-25",
        "content": "本文",
        "objective": "事実" | null,
        "subjective": "所感" | null,
        "is_ai_analyzed": true,
        "created_at": "ISO8601",
        "tag_ids": ["tag-uuid-1"]
      }
    ]
  }
}
```

### エラーレスポンス

| ステータス | 条件 |
|-----------|------|
| `401` | 未認証 |
| `403` | `current_facility_id` 未設定、または児童が別施設 |
| `404` | 記録が見つからない |
| `500` | サーバーエラー |

---

## 4. 記録更新

**エンドポイント**: `PATCH /api/records/personal/[id]`

**説明**: 既存の観察記録を部分更新します。更新可能なフィールドを動的に指定。

### リクエストボディ

```typescript
{
  "content"?: "更新後の本文",              // 任意: 本文更新
  "observation_date"?: "2026-03-27",      // 任意: 観察日更新（YYYY-MM-DD）
  "recorded_by"?: "uuid"                  // 任意: 記録者変更
}
```

### バリデーション・制約

| ルール | 説明 |
|--------|------|
| AI解析済み記録の本文更新不可 | `is_ai_analyzed=true` の場合、`content` を送信すると 400 エラー |
| 本文は空不可 | `content` を送信する場合、空文字列は拒否 |
| 日付形式 | `YYYY-MM-DD` 形式チェック + 実在日チェック |
| `recorded_by` | UUID形式チェック |

### 処理内容

- `updated_at` と `updated_by` は自動更新
- 送信されたフィールドのみ更新（部分更新）

### レスポンス (成功: 200)

```typescript
{
  "success": true,
  "data": {
    "id": "uuid",
    "content": "更新後の本文",
    "observation_date": "2026-03-27",
    "updated_at": "ISO8601"
  }
}
```

### エラーレスポンス

| ステータス | 条件 |
|-----------|------|
| `400` | 本文空、日付形式不正、AI解析済み記録の本文更新、`recorded_by` 形式不正 |
| `401` | 未認証 |
| `403` | `current_facility_id` 未設定、または児童が別施設 |
| `404` | 記録が見つからない |
| `500` | サーバーエラー |

---

## 5. AI分類結果の保存

**エンドポイント**: `POST /api/records/personal/[id]/ai`

**説明**: AI解析結果（事実・所感・非認知能力タグ）を既存の観察記録に保存します。メソッドは `PATCH`。

### リクエストボディ

```typescript
{
  "ai_action": "抽出された事実テキスト",
  "ai_opinion": "抽出された所感テキスト",
  // タグIDをキーとしたフラグ（true/1 で有効）
  "tag-uuid-1": true,
  "tag-uuid-2": false,
  "tag-uuid-3": 1
}
```

> **注意**: `ai_action` と `ai_opinion` 以外のキーはすべてタグIDとして処理される。ただし `m_observation_tags` に存在する有効なタグIDのみ受け付ける。

### 処理内容

1. `r_observation` を更新:
   - `objective`: `ai_action` の値
   - `subjective`: `ai_opinion` の値
   - `is_ai_analyzed`: 事実・所感・タグのいずれかが存在すれば `true`
   - `ai_analyzed_at`: `is_ai_analyzed=true` なら現在時刻
2. `_record_tag` をアトミックに更新: RPC `update_observation_tags` を使用（既存タグを全削除→新規挿入のトランザクション）

### レスポンス (成功: 200)

```typescript
{
  "success": true,
  "data": {
    "id": "uuid",
    "objective": "事実テキスト",
    "subjective": "所感テキスト",
    "tag_flags": {
      "tag-uuid-1": 1,
      "tag-uuid-3": 1
    }
  }
}
```

### エラーレスポンス

| ステータス | 条件 |
|-----------|------|
| `401` | 未認証 |
| `403` | 児童が別施設 |
| `404` | 記録が見つからない |
| `500` | タグ情報取得失敗、更新失敗 |

---

## 6. AI解析実行

**エンドポイント**: `POST /api/records/personal/ai`

**説明**: 観察記録の本文テキストをAIに送信し、事実/所感の分離と非認知能力タグの自動判定を行います。

### リクエストボディ

```typescript
{
  "text": "観察記録の本文テキスト"   // 必須
}
```

### 処理内容

1. `m_observation_tags` からアクティブなタグ一覧を取得
2. `buildPersonalRecordPrompt()` でプロンプトを生成
3. **Gemini 2.0 Flash** (`gemini-2.0-flash`) にリクエスト送信（`temperature: 0.2`, `maxOutputTokens: 1200`）
4. AI応答をJSON配列としてパース
5. パース失敗時のフォールバック:
   - 事実/所感: キーワードヒューリスティックで分離（「と思う」「感じ」「かもしれ」等を所感と判定）
   - タグ: テキスト中にタグ名が含まれるかで判定

### レスポンス (成功: 200)

```typescript
{
  "success": true,
  "data": {
    "prompt": "送信されたプロンプト全文",
    "objective": "AIが抽出した事実",
    "subjective": "AIが抽出した所感",
    "flags": {                         // タグID→0/1 のマップ
      "tag-uuid-1": 1,
      "tag-uuid-2": 0,
      "tag-uuid-3": 1
    }
  }
}
```

### エラーレスポンス

| ステータス | 条件 |
|-----------|------|
| `400` | `text` が空 |
| `401` | 未認証 |
| `500` | Gemini APIキー未設定、タグ取得失敗、サーバーエラー |

---

## 7. 非認知能力タグ一覧

**エンドポイント**: `GET /api/records/personal/tags`

**説明**: 非認知能力タグのマスタ一覧を取得します。`m_observation_tags` テーブルから `is_active=true` のものを `sort_order` 順で返却。

### レスポンス (成功: 200)

```typescript
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "自己肯定感",
      "description": "自分に自信を持ち...",
      "color": "#FF6B6B",
      "sort_order": 1
    }
  ]
}
```

### エラーレスポンス

| ステータス | 条件 |
|-----------|------|
| `401` | 未認証 |
| `500` | サーバーエラー |

---

## 8. 児童の最近の記録一覧

**エンドポイント**: `GET /api/records/personal/child/[childId]/recent`

**説明**: 指定した児童の最近の観察記録を最大10件取得します。施設スコープで権限チェック。

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `childId` | `string (UUID)` | 児童ID |

### レスポンス (成功: 200)

```typescript
{
  "success": true,
  "data": {
    "recent_observations": [
      {
        "id": "uuid",
        "observation_date": "2026-03-25",
        "content": "本文",
        "objective": "事実" | null,
        "subjective": "所感" | null,
        "is_ai_analyzed": true,
        "created_at": "ISO8601",
        "tag_ids": ["tag-uuid-1", "tag-uuid-2"]
      }
    ]
  }
}
```

### エラーレスポンス

| ステータス | 条件 |
|-----------|------|
| `400` | `childId` 未指定 |
| `401` | 未認証 |
| `403` | 児童が別施設 |
| `404` | 児童が見つからない |
| `500` | サーバーエラー |

---

## データベーステーブル

### r_observation（観察記録）

主要カラム:

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | UUID | PK |
| `child_id` | UUID | FK → `m_children.id` |
| `observation_date` | DATE | 観察日 |
| `content` | TEXT | 本文（メンション記法を含む場合あり） |
| `objective` | TEXT | AI抽出の事実 |
| `subjective` | TEXT | AI抽出の所感 |
| `is_ai_analyzed` | BOOLEAN | AI解析済みフラグ |
| `ai_analyzed_at` | TIMESTAMPTZ | AI解析日時 |
| `activity_id` | UUID | 紐づく活動記録ID（任意） |
| `created_by` | UUID | 作成者（ログインユーザー） |
| `recorded_by` | UUID | 記録者（実際に観察した職員） |
| `updated_by` | UUID | 最終更新者 |
| `created_at` | TIMESTAMPTZ | 作成日時 |
| `updated_at` | TIMESTAMPTZ | 更新日時 |
| `deleted_at` | TIMESTAMPTZ | 論理削除日時 |

> **注意**: `created_by` と `recorded_by` は異なるユーザーになり得る。`created_by` はAPIを呼んだユーザー、`recorded_by` はUI上で選択された記録者。

### m_observation_tags（非認知能力タグ定義）

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | UUID | PK |
| `name` | VARCHAR | タグ名（例: 自己肯定感） |
| `description` | TEXT | タグの説明 |
| `color` | VARCHAR | 表示色（例: `#FF6B6B`） |
| `sort_order` | INTEGER | 表示順 |
| `is_active` | BOOLEAN | 有効フラグ |
| `deleted_at` | TIMESTAMPTZ | 論理削除日時 |

### _record_tag（記録とタグの中間テーブル）

| カラム | 型 | 説明 |
|--------|-----|------|
| `observation_id` | UUID | FK → `r_observation.id` |
| `tag_id` | UUID | FK → `m_observation_tags.id` |
| `is_auto_tagged` | BOOLEAN | AI自動付与フラグ |
| `confidence_score` | FLOAT | 信頼度スコア（現在未使用） |

---

## ObservationEditor コンポーネント仕様

**ファイル**: `app/records/personal/_components/observation-editor.tsx`

### モード

| モード | URL | 説明 |
|--------|-----|------|
| `mode="new"` | `/records/personal/new` | 新規作成 |
| `mode="edit"` | `/records/personal/[id]/edit` | 編集 |

### new モードのフロー

1. **クラス選択**（クラスがある施設のみ）→ **児童選択**（`ChildSelect` コンポーネント、学年でグループ化）
2. **本文入力**（`MentionTextarea`）+ **記録者選択** + **日付選択**
3. **保存** → `POST /api/records/personal` → **AI解析**（`POST /api/records/personal/ai`）
4. 保存後: 観察内容入力カードが消え、**「観察内容分類」カード**のみ表示
5. 分類カードで事実（`ai_action`）・所感（`ai_opinion`）・非認知能力フラグを編集・保存
6. **「別の記録を作成」ボタン**: ページ遷移ではなく **in-place リセット**（記録者は保持、児童・本文はリセット）

### edit モードのフロー

- 記録を読み込み → 分類カードを即表示
- **本文は `is_ai_analyzed=true` の場合、読み取り専用**（編集不可）
- AI解析済みでない場合は本文編集→保存フロー

### 分類カードの編集UI（edit モード）

```
観察日  2026/3/26(木)  [✏️ 変更]  ← DatePicker で変更可
記録者  テスト太郎     [✏️ 変更]  ← staffList Select で変更可
```

- 「変更」ボタンで各フィールドの編集モードをトグル
- 編集中は「保存」ボタンが表示され、`PATCH /api/records/personal/[id]` で保存
- 「編集終了」ボタンで全編集モードを解除

### 児童名の表示ルール（重要な設計判断）

- `childOptions`（`/api/children` から取得）を参照してフルネームを表示
- `observation.child_name`（DB保存値）をフォールバックとして使用
- **理由**: DBにはニックネームが入ることがあるため、`childOptions` からの復号化名を優先

### 主な state

| State | 説明 |
|-------|------|
| `hasAiOutput` | AI出力が存在するか（分類カード表示の判定） |
| `showContinueButton` | new モードで保存完了後 `true`。「別の記録を作成」ボタン表示制御 |
| `aiProcessing` | AI解析中フラグ（全画面ローディングオーバーレイ表示） |
| `isDateEditing` | 分類カードの日付編集中 |
| `isRecorderEditing` | 分類カードの記録者編集中 |

### 保存後のリセット処理

`handleUpdateObservation` 成功後:
- `setIsEditing(false)`
- `setIsDateEditing(false)`
- `setIsRecorderEditing(false)`

---

## 権限・セキュリティ

### アクセス制御

| ロール | アクセス範囲 |
|--------|-------------|
| `staff` | 自施設の全記録を作成・編集可能 |
| `facility_admin` | 自施設の全記録を作成・編集可能 |
| `company_admin` | 自施設の全記録を作成・編集可能 |

- すべてのエンドポイントで施設スコープ（`current_facility_id`）による自動フィルタリングを実施
- `facility_id` はリクエストパラメータではなくセッション情報から自動取得（不正な施設IDの指定を防止）

### 入力検証

| フィールド | バリデーション |
|-----------|---------------|
| `content` | 最大5,000文字 |
| `observation_date` | `YYYY-MM-DD` 形式、実在日チェック |
| `child_id` | UUID形式、対象施設に存在する児童 |
| `recorded_by` | UUID形式、同一会社のアクティブユーザー |
| `keyword` | 最大100文字（超過分は自動切り捨て）、SQLインジェクション対策（`%` `_` `\` エスケープ） |

### エラーハンドリング方針

- アクセス権限がない場合: 施設不一致は `403 Forbidden`、リソース不在は `404 Not Found`
- PII（個人情報）フィールドは復号化して返却、復号失敗時は平文をフォールバック

---

## 削除された機能

- **「児童付け替え」ダイアログ**（旧 `showReassignDialog`）: 削除済み。分類カードの児童変更ボタンで代替。
- **旧カテゴリシステム**: 「社会性・コミュニケーション」「身体・運動」等の固定カテゴリは廃止。`m_observation_tags`（非認知能力タグ）に移行。
- **旧エンドポイント** `/api/observations`: 全廃止。`/api/records/personal` に統合。

---

## 活動記録との違い

| 項目 | 活動記録（`r_activity`） | 個人観察記録（`r_observation`） |
|------|------------------------|-------------------------------|
| 対象 | クラス全体の活動 | 特定の1人の児童 |
| 内容 | 複数の子どもが登場する包括的な記録 | その子どもに特化した観察やエピソード |
| AI機能 | メンションされた児童ごとに個別記録を自動抽出 | 事実/所感の分離 + 非認知能力タグ自動判定 |
| AI基盤 | - | Gemini 2.0 Flash |

---

**作成日**: 2025-01-09
**最終更新**: 2026-03-26
**関連ドキュメント**:
- `03_database.md` - データベース設計
- `04_api.md` - API基本設計
- `10_activity_record_api.md` - 活動記録API
