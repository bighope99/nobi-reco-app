# 活動記録入力API仕様書

## 概要
のびレコのコア機能である活動記録入力画面で使用するAPI群の仕様を定義します。
AI解析による個別記録の自動抽出（メンション機能 + AI解析 + Human-in-the-loop）を含みます。

---

## エンドポイント一覧

### 1. 活動記録の保存

**エンドポイント**: `POST /api/activities`

**説明**: 活動記録を保存します（下書き保存または確定保存）。

**リクエストボディ**:
```typescript
{
  "facility_id": "uuid-facility-1",
  "class_id": "uuid-class-1",           // 対象クラス
  "activity_date": "2023-10-27",        // 活動日（YYYY-MM-DD）
  "title": "公園で外遊び",               // 活動タイトル（任意）
  "content": "今日は@たなか はると くんが...", // 活動内容（メンション含む）
  "snack": "焼き芋",                     // おやつ（任意）
  "photos": [                            // 写真（複数可）
    {
      "url": "https://...",
      "caption": "外遊びの様子"
    }
  ],
  "mentions": [                          // メンション情報
    {
      "child_id": "uuid-child-1",
      "name": "たなか はると",
      "position": {                      // テキスト内の位置
        "start": 5,
        "end": 18
      }
    }
  ],
  "is_draft": true,                      // 下書きフラグ（true=下書き、false=確定）
  "created_by": "uuid-user-1"            // 作成者（セッションから取得）
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "activity_id": "uuid-activity-1",
    "activity_date": "2023-10-27",
    "title": "公園で外遊び",
    "is_draft": true,
    "created_at": "2023-10-27T14:30:00+09:00"
  }
}
```

**処理内容**:
1. `r_activity` テーブルに活動記録を保存
2. 写真は `photos` JSONB カラムに保存
3. 下書きの場合、確定前の状態として保存

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、不正な日付
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: クラスへのアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 2. AI解析実行（個別記録案の生成）

**エンドポイント**: `POST /api/ai/extract`

**説明**: 活動記録のテキストからメンションされた児童ごとのエピソードを抽出し、個別記録案を生成します。

**リクエストボディ**:
```typescript
{
  "activity_id": "uuid-activity-1",     // 活動記録ID（既存の場合）
  "text": "今日は@たなか はると くんがカプラで高く積み上げることに挑戦していました。途中で崩れても「もう一回！」と言ってあきらめずに取り組んでいました。",
  "mentions": [
    {
      "child_id": "uuid-child-1",
      "name": "たなか はると",
      "age": 6,
      "grade": "6年生"
    }
  ],
  "config": {
    "mode": "standard",                  // 解析モード（standard / detailed）
    "extract_facts": true,               // 事実の抽出
    "extract_comments": true,            // 所感の抽出
    "suggest_tags": true                 // タグの推奨
  }
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "candidates": [
      {
        "child_id": "uuid-child-1",
        "child_name": "たなか はると",

        // AI抽出結果
        "extracted_fact": "カプラで高く積み上げることに挑戦した。途中で崩れても再挑戦していた。",
        "generated_comment": "失敗しても諦めない粘り強さが見られました。",

        // 推奨タグ
        "recommended_tags": [
          {
            "tag_id": "uuid-tag-1",
            "tag_name": "忍耐力",
            "confidence_score": 0.95
          },
          {
            "tag_id": "uuid-tag-2",
            "tag_name": "挑戦",
            "confidence_score": 0.88
          }
        ],

        // 子どもの声（抽出されたセリフ）
        "child_voice": "もう一回！",

        // 信頼度スコア
        "overall_confidence": 0.92
      }
    ],

    // AI処理メタデータ
    "metadata": {
      "model": "gpt-4o-mini",
      "tokens_used": 350,
      "processing_time_ms": 1250
    }
  }
}
```

**処理内容**:
1. OpenAI GPT-4o-mini にプロンプトを送信
2. メンションされた児童ごとにエピソードを抽出
3. 「事実」と「所感」を分離
4. 文脈に基づいてタグを推奨
5. 信頼度スコアを計算

**プロンプト例**:
```
以下の活動記録から、メンションされた児童「たなか はると」に関するエピソードを抽出してください。

# 活動記録
今日は@たなか はると くんがカプラで高く積み上げることに挑戦していました。途中で崩れても「もう一回！」と言ってあきらめずに取り組んでいました。

# 出力形式
{
  "extracted_fact": "客観的な事実のみを記述",
  "generated_comment": "保育者の所感・成長の視点",
  "recommended_tags": ["タグ1", "タグ2"],
  "child_voice": "子どもが言ったセリフ（あれば）"
}

# 利用可能なタグ
自立、社会性、感情の安定、好奇心、表現力、忍耐力、挑戦、協調性、...
```

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、メンションなし
- `401 Unauthorized`: 認証エラー
- `429 Too Many Requests`: AI APIレート制限
- `500 Internal Server Error`: AI APIエラー
- `503 Service Unavailable`: AI APIダウン

---

### 3. 個別記録の確認・承認

**エンドポイント**: `POST /api/activities/:id/confirm`

**説明**: AI生成された個別記録案を確認・修正・承認し、正式に保存します（Human-in-the-loop）。

**リクエストボディ**:
```typescript
{
  "individual_records": [
    {
      "child_id": "uuid-child-1",
      "fact": "カプラで高く積み上げることに挑戦した...",  // 修正後の事実
      "comment": "失敗しても諦めない...",                // 修正後の所感
      "tag_ids": ["uuid-tag-1", "uuid-tag-2"],          // 確定したタグ
      "child_voice": "もう一回！",                       // 子どもの声（任意）
      "is_approved": true                                // 承認フラグ
    }
  ],
  "activity_status": "confirmed"  // 活動記録のステータス（confirmed=確定）
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "activity_id": "uuid-activity-1",
    "status": "confirmed",
    "individual_records_created": 3,
    "records": [
      {
        "observation_id": "uuid-obs-1",
        "child_id": "uuid-child-1",
        "observation_date": "2023-10-27",
        "content": "カプラで高く積み上げることに挑戦した...",
        "tags": ["忍耐力", "挑戦"]
      }
    ]
  }
}
```

**処理内容**:
1. `r_activity` のステータスを「confirmed」に更新
2. 各児童について `r_observation` レコードを作成
3. `_record_tag` でタグを紐づけ
4. 子どもの声があれば `r_voice` にも保存
5. トランザクション処理（全て成功 or 全て失敗）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、承認されていない記録あり
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: 活動記録へのアクセス権限なし
- `404 Not Found`: 活動記録が見つからない
- `409 Conflict`: 既に確定済み
- `500 Internal Server Error`: サーバーエラー

---

### 4. メンション候補取得

**エンドポイント**: `GET /api/children/mention-suggestions`

**説明**: メンション入力時のサジェスト候補（所属クラスの児童）を取得します。

**リクエストパラメータ**:
```typescript
{
  class_id: string;     // クラスID
  query?: string;       // 検索キーワード（名前・かな）
  limit?: number;       // 取得件数（デフォルト: 20）
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "child_id": "uuid-child-1",
        "name": "田中 陽翔",
        "kana": "たなか はると",
        "grade": "6年生",
        "photo_url": "https://...",
        "display_name": "たなか はると（6年生）",  // サジェスト表示用
        "unique_key": "child-1-tanaka-haruto"         // 同姓同名対策用
      },
      {
        "child_id": "uuid-child-2",
        "name": "田中 陽翔",
        "kana": "たなか はると",
        "grade": "4年生",
        "photo_url": "https://...",
        "display_name": "たなか はると（4年生・さくら組）",  // 同姓同名の場合はクラス名も表示
        "unique_key": "child-2-tanaka-haruto"
      }
    ]
  }
}
```

**同姓同名対策**:
- 同姓同名が複数いる場合、`display_name` にクラス名や学年を追加
- `unique_key` で一意に識別
- サジェストUI上で区別できるように表示

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: クラスへのアクセス権限なし
- `404 Not Found`: クラスが見つからない
- `500 Internal Server Error`: サーバーエラー

---

### 5. 写真アップロード

**エンドポイント**: `POST /api/storage/upload`

**説明**: 活動記録の写真をアップロードします。

**リクエスト**: `multipart/form-data`
```typescript
{
  file: File;                // 画像ファイル
  facility_id: string;       // 施設ID
  activity_date: string;     // 活動日（YYYY-MM-DD）
  caption?: string;          // 写真の説明（任意）
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "file_id": "uuid-file-1",
    "url": "https://...",
    "thumbnail_url": "https://...",
    "file_size": 1024000,        // バイト
    "mime_type": "image/jpeg",
    "uploaded_at": "2023-10-27T14:30:00+09:00"
  }
}
```

**処理内容**:
1. 画像ファイルを検証（形式、サイズ）
2. Supabase Storage にアップロード
3. サムネイル生成（200x200px）
4. 公開URLを返却

**制限事項**:
- ファイル形式: JPEG, PNG, WEBP
- 最大ファイルサイズ: 5MB
- 最大枚数: 6枚/活動記録

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、不正なファイル形式、ファイルサイズ超過
- `401 Unauthorized`: 認証エラー
- `413 Payload Too Large`: ファイルサイズ超過
- `500 Internal Server Error`: サーバーエラー

---

### 6. 活動記録の一覧取得

**エンドポイント**: `GET /api/activities`

**説明**: 活動記録の一覧を取得します（タイムライン）。

**リクエストパラメータ**:
```typescript
{
  facility_id: string;  // 施設ID
  date?: string;        // 対象日（YYYY-MM-DD、省略時は本日）
  class_id?: string;    // クラスフィルター
  limit?: number;       // 取得件数（デフォルト: 20）
  offset?: number;      // オフセット（ページネーション）
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "activities": [
      {
        "activity_id": "uuid-activity-1",
        "activity_date": "2023-10-27",
        "title": "公園で外遊び",
        "content": "今日は...",
        "snack": "焼き芋",
        "photos": [...],
        "class_name": "ひまわり組",
        "created_by": "田中先生",
        "created_at": "2023-10-27T14:30:00+09:00",
        "is_draft": false,
        "individual_record_count": 5  // 紐づく個別記録数
      }
    ],
    "total": 10,
    "has_more": false
  }
}
```

---

### 7. 活動記録の詳細取得

**エンドポイント**: `GET /api/activities/:id`

**説明**: 特定の活動記録の詳細を取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "activity_id": "uuid-activity-1",
    "activity_date": "2023-10-27",
    "title": "公園で外遊び",
    "content": "今日は...",
    "snack": "焼き芋",
    "photos": [...],
    "class_id": "uuid-class-1",
    "class_name": "ひまわり組",
    "created_by": "uuid-user-1",
    "created_by_name": "田中先生",
    "created_at": "2023-10-27T14:30:00+09:00",
    "updated_at": "2023-10-27T15:00:00+09:00",
    "is_draft": false,

    // 紐づく個別記録
    "individual_records": [
      {
        "observation_id": "uuid-obs-1",
        "child_id": "uuid-child-1",
        "child_name": "田中 陽翔",
        "content": "カプラで...",
        "tags": ["忍耐力", "挑戦"]
      }
    ]
  }
}
```

---

### 8. 活動記録の修正

**エンドポイント**: `PUT /api/activities/:id`

**説明**: 既存の活動記録を修正します。

**リクエストボディ**:
```typescript
{
  "title": "公園で外遊び（修正）",
  "content": "...",
  "snack": "焼き芋",
  "photos": [...]
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "activity_id": "uuid-activity-1",
    "updated_at": "2023-10-27T15:30:00+09:00"
  }
}
```

---

### 9. 活動記録の削除

**エンドポイント**: `DELETE /api/activities/:id`

**説明**: 活動記録を削除します（論理削除）。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "activity_id": "uuid-activity-1",
    "deleted_at": "2023-10-27T16:00:00+09:00"
  }
}
```

**処理内容**:
1. `r_activity` の `deleted_at` を更新
2. 紐づく `r_observation` も論理削除

---

## データベース要件

### 使用テーブル

#### 1. r_activity（活動記録）
```sql
-- 既存のテーブル構造（03_database.mdを参照）

-- 追加カラム（必要に応じて）
ALTER TABLE r_activity
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';
-- status: 'draft' | 'confirmed' | 'archived'

CREATE INDEX idx_r_activity_status ON r_activity(status) WHERE deleted_at IS NULL;
```

#### 2. r_observation（観察記録）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
```

#### 3. r_voice（子どもの声記録）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
```

#### 4. _record_tag（記録-タグ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
```

#### 5. m_children（子どもマスタ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
```

#### 6. m_observation_tags（タグマスタ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
```

---

## AI解析の詳細仕様

### OpenAI プロンプト設計

```typescript
const systemPrompt = `
あなたは保育・教育のプロフェッショナルです。
活動記録から児童の成長エピソードを抽出し、「事実」と「所感」を分離してください。

# ルール
1. 事実は客観的に記述（「〜していた」「〜した」）
2. 所感は成長の視点から記述（「〜が見られました」「〜が育っています」）
3. 子どもの発言はそのまま引用
4. タグは文脈から最適なものを選択（最大3つ）

# 利用可能なタグ
${tags.map(t => t.name).join(', ')}
`;

const userPrompt = `
# 活動記録
${text}

# 対象児童
${mentions.map(m => m.name).join(', ')}

# 出力形式
JSON形式で出力してください：
{
  "child_id": "uuid",
  "extracted_fact": "...",
  "generated_comment": "...",
  "recommended_tags": ["タグ1", "タグ2"],
  "child_voice": "..."
}
`;
```

### エラーハンドリング

```typescript
// AIリトライ戦略
const retryConfig = {
  maxRetries: 3,
  backoff: [1000, 2000, 4000],  // ms
  retryableErrors: [429, 500, 503]
};

// タイムアウト設定
const timeout = 30000;  // 30秒
```

---

## セキュリティ

### アクセス制御
- ユーザーが所属する施設・クラスのデータのみアクセス可能
- RLS（Row Level Security）で施設レベルのデータ分離
- AI解析結果は一時的にサーバーメモリに保持（保存は承認後のみ）

### 入力検証
- `content`: 最大10,000文字
- `title`: 最大200文字
- `mentions`: 最大50件/記録
- `photos`: 最大6枚/記録、5MB/枚

### プライバシー保護
- AI APIに送信する際、児童の個人情報（氏名）は仮名化を検討
- AI処理ログは30日間保持後削除

---

## パフォーマンス考慮事項

### キャッシュ戦略
- メンション候補: 5分キャッシュ
- タグマスタ: 1時間キャッシュ
- AI解析結果: キャッシュしない（毎回生成）

### 非同期処理
- 写真アップロード: 非同期処理、プログレス表示
- AI解析: 非同期処理、ローディング表示（処理時間の目安: 5-10秒）

### オートセーブ
- 入力中の内容を30秒ごとに自動保存
- ブラウザのlocalStorageに一時保存
- ページ離脱時に未保存アラート

---

## エラーハンドリング

### 共通エラーコード
```typescript
{
  "ACTIVITY_NOT_FOUND": "活動記録が見つかりません",
  "ALREADY_CONFIRMED": "既に確定済みです",
  "AI_API_ERROR": "AI解析に失敗しました",
  "AI_RATE_LIMIT": "AI解析のレート制限に達しました",
  "FILE_TOO_LARGE": "ファイルサイズが大きすぎます",
  "INVALID_FILE_TYPE": "サポートされていないファイル形式です",
  "MENTION_NOT_FOUND": "メンションされた児童が見つかりません"
}
```

---

## UI/UX要件

### メンション機能
```tsx
// テキストエリアでの@入力検知
<MentionTextarea
  value={content}
  onChange={setContent}
  suggestions={children}
  onMention={(child) => {
    // メンション追加処理
  }}
/>
```

### AI解析ボタン
```tsx
<Button
  onClick={handleAIExtract}
  disabled={mentions.length === 0}
  loading={isAIProcessing}
>
  <Sparkles className="w-4 h-4 mr-2" />
  AI作成 ({mentions.length}件)
</Button>
```

### 承認ダイアログ
```tsx
<ConfirmDialog
  records={aiResults}
  onApprove={(modifiedRecords) => {
    // 承認・保存処理
  }}
  onReject={() => {
    // 再編集
  }}
/>
```

---

## 今後の拡張予定

### Phase 2
- 音声入力機能（Web Speech API）
- テンプレート機能（定型文の挿入）
- リアルタイム編集（WebSocket）
- メンション候補の写真表示

### Phase 3
- AI解析精度の向上（ファインチューニング）
- 複数職員による共同編集
- 過去の活動記録からのサジェスト
- 記録品質スコア

---

**作成日**: 2025-01-09
**最終更新**: 2025-01-09
**関連ドキュメント**:
- `03_database.md` - データベース設計
- `04_api.md` - API基本設計
- `01_requirements.md` - 要件定義（REC-01〜04）
