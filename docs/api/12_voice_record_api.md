# 子どもの声記録API仕様書

## 概要
子どもの印象的な言葉や発言を記録するためのAPI群の仕様を定義します。
観察記録とは別に、子どもの「声」に焦点を当てた記録機能です。

---

## エンドポイント一覧

### 1. 子どもの声記録の作成

**エンドポイント**: `POST /api/voice-records`

**説明**: 特定の児童の声（言葉・発言）を記録します。

**リクエストボディ**:
```typescript
{
  "child_id": "uuid-child-1",
  "voice_date": "2023-10-27",             // 発言日（YYYY-MM-DD）
  "voice": "明日もこれ作りたい！",          // 子どもの言葉・発言
  "context": "カプラで遊んでいる時に",      // 状況・文脈（任意）
  "tags": ["id-tag-1", "id-tag-2"]        // タグ（任意）
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "voice_id": "uuid-voice-1",
    "child_id": "uuid-child-1",
    "voice_date": "2023-10-27",
    "voice": "明日もこれ作りたい！",
    "context": "カプラで遊んでいる時に",
    "created_at": "2023-10-27T14:30:00+09:00"
  }
}
```

**処理内容**:
1. `r_voice` テーブルに記録を作成
2. タグが指定されている場合は `_record_tag` で紐づけ
3. 作成者情報（`created_by`）はセッションから取得

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス操作可）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、不正な日付、発言内容が空
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 児童が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 2. 子どもの声記録一覧取得

**エンドポイント**: `GET /api/voice-records`

**説明**: 特定の児童の声記録一覧を取得します。

**リクエストパラメータ**:
```typescript
{
  child_id: string;         // 児童ID
  start_date?: string;      // 開始日（YYYY-MM-DD）
  end_date?: string;        // 終了日（YYYY-MM-DD）
  limit?: number;           // 取得件数（デフォルト: 20）
  offset?: number;          // オフセット（ページネーション）
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "child": {
      "child_id": "uuid-child-1",
      "name": "田中 陽翔",
      "class_name": "ひまわり組",
      "grade": "6年生",
      "photo_url": "https://..."
    },
    "voice_records": [
      {
        "voice_id": "uuid-voice-1",
        "voice_date": "2024-01-14",
        "voice": "明日もこれ作りたい！",
        "context": "カプラで遊んでいる時に",
        "tags": [
          {
            "tag_id": "uuid-tag-1",
            "tag_name": "意欲"
          }
        ],
        "created_by": "田中先生",
        "created_at": "2024-01-14T15:30:00+09:00"
      },
      {
        "voice_id": "uuid-voice-2",
        "voice_date": "2024-01-13",
        "voice": "〇〇くんと遊ぶの楽しい",
        "context": "外遊びの後に",
        "tags": [
          {
            "tag_id": "uuid-tag-2",
            "tag_name": "友達関係"
          }
        ],
        "created_by": "佐藤先生",
        "created_at": "2024-01-13T14:00:00+09:00"
      }
    ],
    "total": 32,
    "has_more": true
  }
}
```

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス閲覧可）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 児童が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 3. 子どもの声記録の詳細取得

**エンドポイント**: `GET /api/voice-records/:id`

**説明**: 特定の声記録の詳細を取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "voice_id": "uuid-voice-1",
    "child_id": "uuid-child-1",
    "child_name": "田中 陽翔",
    "voice_date": "2024-01-14",
    "voice": "明日もこれ作りたい！",
    "context": "カプラで遊んでいる時に",
    "tags": [
      {
        "tag_id": "uuid-tag-1",
        "tag_name": "意欲"
      }
    ],
    "created_by": "uuid-user-1",
    "created_by_name": "田中先生",
    "created_at": "2024-01-14T15:30:00+09:00",
    "updated_at": "2024-01-14T15:30:00+09:00"
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
- `404 Not Found`: 記録が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 4. 子どもの声記録の更新

**エンドポイント**: `PUT /api/voice-records/:id`

**説明**: 既存の声記録を更新します。

**リクエストボディ**:
```typescript
{
  "voice_date": "2024-01-14",
  "voice": "明日もこれ作りたい！（修正）",
  "context": "カプラで遊んでいる時に",
  "tags": ["id-tag-1", "id-tag-2"]
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "voice_id": "uuid-voice-1",
    "updated_at": "2024-01-14T16:00:00+09:00"
  }
}
```

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 自分が作成した記録のみ（※Phase 2で実装予定、現在は全記録編集可）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、不正な日付、発言内容が空
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 記録が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 5. 子どもの声記録の削除

**エンドポイント**: `DELETE /api/voice-records/:id`

**説明**: 声記録を削除します（論理削除）。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "voice_id": "uuid-voice-1",
    "deleted_at": "2024-01-14T17:00:00+09:00"
  }
}
```

**処理内容**:
1. `r_voice` の `deleted_at` を更新
2. 紐づく `_record_tag` も削除

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 自分が作成した記録のみ（※Phase 2で実装予定、現在は全記録削除可）

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 記録が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 6. 最近の声記録取得（タイムライン）

**エンドポイント**: `GET /api/voice-records/timeline`

**説明**: 施設内の全児童の最近の声記録をタイムライン形式で取得します。

**リクエストパラメータ**:
```typescript
{
  class_id?: string;        // クラスフィルター（任意）
  limit?: number;           // 取得件数（デフォルト: 20）
  offset?: number;          // オフセット（ページネーション）
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "voice_records": [
      {
        "voice_id": "uuid-voice-1",
        "child_id": "uuid-child-1",
        "child_name": "田中 陽翔",
        "child_photo_url": "https://...",
        "class_name": "ひまわり組",
        "voice_date": "2024-01-14",
        "voice": "明日もこれ作りたい！",
        "context": "カプラで遊んでいる時に",
        "created_by": "田中先生",
        "created_at": "2024-01-14T15:30:00+09:00"
      },
      {
        "voice_id": "uuid-voice-2",
        "child_id": "uuid-child-2",
        "child_name": "佐藤 美咲",
        "child_photo_url": "https://...",
        "class_name": "さくら組",
        "voice_date": "2024-01-14",
        "voice": "お絵描き上手にできたよ！",
        "context": "お絵描きの時間に",
        "created_by": "佐藤先生",
        "created_at": "2024-01-14T14:45:00+09:00"
      }
    ],
    "total": 150,
    "has_more": true
  }
}
```

**用途**: ダッシュボードや保護者アプリでの「最近の子どもたちの声」表示

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

## データベース要件

### 使用テーブル

#### 1. r_voice（子どもの声記録）
```sql
-- 既存のテーブル構造（03_database.mdを参照）

-- contextカラム追加（必要に応じて）
ALTER TABLE r_voice
ADD COLUMN IF NOT EXISTS context TEXT;

-- インデックス
CREATE INDEX idx_r_voice_child_date
  ON r_voice(child_id, voice_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_r_voice_facility_date
  ON r_voice(facility_id, voice_date DESC)
  WHERE deleted_at IS NULL;
```

#### 2. m_children（子どもマスタ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
```

#### 3. _record_tag（記録-タグ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
-- record_typeに'voice'を追加
```

#### 4. m_observation_tags（タグマスタ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
```

---

## クエリ例

### 子どもの声記録一覧取得クエリ

```sql
-- 特定児童の声記録一覧を取得
SELECT
  rv.id as voice_id,
  rv.voice_date,
  rv.voice,
  rv.context,
  rv.created_at,
  rv.updated_at,

  -- 作成者情報
  u.id as created_by,
  u.family_name || ' ' || u.given_name as created_by_name,

  -- タグ情報
  COALESCE(
    json_agg(
      json_build_object(
        'tag_id', mot.id,
        'tag_name', mot.name
      )
    ) FILTER (WHERE mot.id IS NOT NULL),
    '[]'::json
  ) as tags

FROM r_voice rv
INNER JOIN m_children c ON rv.child_id = c.id
LEFT JOIN m_users u ON rv.created_by = u.id
LEFT JOIN _record_tag rt ON rv.id = rt.record_id AND rt.record_type = 'voice'
LEFT JOIN m_observation_tags mot ON rt.tag_id = mot.id AND mot.deleted_at IS NULL

WHERE rv.child_id = $1  -- child_id
  AND c.facility_id = $2  -- facility_id (from session)
  AND rv.deleted_at IS NULL
  AND c.deleted_at IS NULL

  -- フィルター条件
  AND ($3::DATE IS NULL OR rv.voice_date >= $3)  -- start_date
  AND ($4::DATE IS NULL OR rv.voice_date <= $4)  -- end_date

GROUP BY rv.id, u.id
ORDER BY rv.voice_date DESC, rv.created_at DESC
LIMIT $5 OFFSET $6;  -- limit, offset
```

### タイムライン取得クエリ

```sql
-- 施設内の全児童の最近の声記録を取得
SELECT
  rv.id as voice_id,
  rv.child_id,
  c.family_name || ' ' || c.given_name as child_name,
  c.photo_url as child_photo_url,
  cl.name as class_name,
  rv.voice_date,
  rv.voice,
  rv.context,
  u.family_name || ' ' || u.given_name as created_by_name,
  rv.created_at

FROM r_voice rv
INNER JOIN m_children c ON rv.child_id = c.id
INNER JOIN _child_class cc ON c.id = cc.child_id AND cc.is_current = true
INNER JOIN m_classes cl ON cc.class_id = cl.id
LEFT JOIN m_users u ON rv.created_by = u.id

WHERE c.facility_id = $1  -- facility_id (from session)
  AND rv.deleted_at IS NULL
  AND c.deleted_at IS NULL
  AND c.enrollment_status = 'enrolled'

  -- クラスフィルター
  AND ($2::UUID IS NULL OR cl.id = $2)  -- class_id

ORDER BY rv.created_at DESC
LIMIT $3 OFFSET $4;  -- limit, offset
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
   - 更新・削除は自分が作成した記録のみ（Phase 2で実装予定）

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
- `voice`: 必須、最大1,000文字
- `context`: 任意、最大500文字
- `voice_date`: YYYY-MM-DD形式、未来日は不可
- `child_id`: UUID形式、対象施設に存在する児童のみ

### プライバシー保護
- 子どもの声は保護者アプリでも公開される可能性があるため、不適切な内容がないかチェック機能の検討（Phase 2）
- 音声入力機能を追加する場合、音声データの保存期間を制限（Phase 3）

---

## パフォーマンス考慮事項

### インデックス
```sql
-- 既存のインデックスで対応可能

-- 追加推奨インデックス
CREATE INDEX idx_r_voice_child_date
  ON r_voice(child_id, voice_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_r_voice_facility_timeline
  ON r_voice(facility_id, created_at DESC)
  WHERE deleted_at IS NULL;
```

### キャッシュ戦略
- タイムライン: 5分キャッシュ（リアルタイム性とパフォーマンスのバランス）
- 個別児童の声記録: キャッシュしない（リアルタイム性重視）

---

## エラーハンドリング

### 共通エラーコード
```typescript
{
  "VOICE_RECORD_NOT_FOUND": "声記録が見つかりません",
  "CHILD_NOT_FOUND": "児童が見つかりません",
  "VOICE_CONTENT_EMPTY": "発言内容を入力してください",
  "FUTURE_DATE_NOT_ALLOWED": "未来日は指定できません",
  "PERMISSION_DENIED": "この記録を編集する権限がありません"
}
```

---

## UI/UX要件

### 入力フォーム
```tsx
// シンプルなテキストエリアで入力
<div className="space-y-2">
  <Label htmlFor="voice">子どもの言葉・発言</Label>
  <Textarea
    id="voice"
    placeholder="子どもの印象的な言葉を記録してください..."
    rows={4}
    value={voice}
    onChange={(e) => setVoice(e.target.value)}
  />
  <p className="text-sm text-muted-foreground">
    例: 「明日もこれ作りたい！」「〇〇くんと遊ぶの楽しい」
  </p>
</div>

<div className="space-y-2">
  <Label htmlFor="context">状況・文脈（任意）</Label>
  <Textarea
    id="context"
    placeholder="どんな時に言ったか..."
    rows={2}
    value={context}
    onChange={(e) => setContext(e.target.value)}
  />
</div>
```

### タイムライン表示
- カード形式で表示
- 子どもの写真とクラス名を表示
- 日付順（新しい順）にソート
- 無限スクロールまたはページネーション

---

## 観察記録との違い

### 観察記録（r_observation）
- **内容**: 子どもの行動や様子を観察して記録
- **記入者視点**: 保育者が客観的に観察した内容
- **カテゴリ**: 6つの発達領域で分類
- **文字数**: 長文（最大5,000文字）

### 子どもの声記録（r_voice）
- **内容**: 子どもが実際に発した言葉・セリフ
- **記入者視点**: 子ども自身の言葉をそのまま記録
- **カテゴリ**: なし（純粋に発言のみ）
- **文字数**: 短文（最大1,000文字）

---

## 今後の拡張予定

### Phase 2
- 音声入力機能（Web Speech API）
- 写真添付機能（発言時の写真）
- 感情タグ（嬉しい、悲しい、怒り、など）
- 保護者アプリでの公開機能

### Phase 3
- AIによる感情分析（発言内容から感情を推測）
- 発言頻度の統計分析
- 成長曲線との連携（言語発達の可視化）
- 音声入力の自動文字起こし

---

**作成日**: 2025-01-09
**最終更新**: 2025-01-09
**関連ドキュメント**:
- `03_database.md` - データベース設計
- `04_api.md` - API基本設計
- `11_observation_record_api.md` - 観察記録API（違いを参照）
