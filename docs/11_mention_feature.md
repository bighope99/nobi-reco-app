# メンション機能 仕様書

## 概要

活動記録（`records/activity`）におけるメンション機能の実装仕様をまとめたドキュメントです。

**目的**: 活動記録の本文中で特定の児童をメンションし、自動的に個別記録を生成する機能を提供します。

**主な機能**:
- 児童のメンション入力（`@`トリガー）
- メンション候補のリアルタイム検索
- 児童IDの暗号化とセキュアな保存
- AI による個別記録の自動生成

---

## 1. アーキテクチャ概要

### 1.1 コンポーネント構成

```
┌─────────────────────────────────────────────┐
│   activity-record-client.tsx                │
│   - メンション入力UI                          │
│   - メンションピッカーダイアログ               │
│   - 状態管理（selectedMentions, tokenMap）  │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│   API Routes                                │
│   - /api/children/mention-suggestions       │
│   - /api/mentions/encrypt                   │
│   - /api/records/activity                   │
│   - /api/activities                         │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│   Database (Supabase)                       │
│   - m_children (児童マスタ)                  │
│   - _child_class (児童-クラス中間テーブル)    │
│   - r_activity (活動記録)                    │
│   - r_observation (個別記録)                 │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│   AI Service (Google Gemini)                │
│   - 個別記録の自動抽出                        │
│   - gemini-2.0-flash モデル                  │
└─────────────────────────────────────────────┘
```

---

## 2. フロントエンド実装

### 2.1 メインコンポーネント

**ファイル**: `app/records/activity/activity-record-client.tsx` (1,249行)

**主要な状態管理**:

```typescript
// 選択済みメンション一覧
const [selectedMentions, setSelectedMentions] = useState<MentionSuggestion[]>([]);

// メンション→トークンのマッピング
const [mentionTokens, setMentionTokens] = useState<Map<string, string>>(new Map());

// メンション検索クエリ
const [mentionSearchQuery, setMentionSearchQuery] = useState('');

// メンションピッカーの表示/非表示
const [showMentionPicker, setShowMentionPicker] = useState(false);

// 現在のクラスの児童一覧
const [classChildren, setClassChildren] = useState<MentionSuggestion[]>([]);
```

### 2.2 メンション入力UI

#### テキストエリア

```tsx
<Textarea
  value={content}
  onChange={(e) => handleContentChange(e.target.value)}
  rows={12}
  maxLength={10000}
  placeholder="園での活動内容を入力してください&#10;&#10;ヒント: @を入力すると児童選択モーダルが開きます"
/>
```

#### `@` トリガー処理

```typescript
const handleContentChange = (newContent: string) => {
  setContent(newContent);

  // テキスト末尾に '@' が入力されたらメンションピッカーを開く
  if (newContent.endsWith('@')) {
    setShowMentionPicker(true);
    setMentionSearchQuery('');
  }
};
```

#### メンション追加ボタン

```tsx
<Button
  type="button"
  variant="outline"
  onClick={() => setShowMentionPicker(true)}
  disabled={!classId || classChildren.length === 0}
>
  <AtSign className="mr-2 h-4 w-4" />
  児童をメンション
</Button>
```

### 2.3 メンションピッカーダイアログ

```tsx
<Dialog open={showMentionPicker} onOpenChange={setShowMentionPicker}>
  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>児童を選択</DialogTitle>
    </DialogHeader>

    {/* 検索フィルター */}
    <Input
      type="text"
      placeholder="児童名で検索..."
      value={mentionSearchQuery}
      onChange={(e) => setMentionSearchQuery(e.target.value)}
    />

    {/* 児童一覧（グリッド表示） */}
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {filteredChildren.map((child) => (
        <Button
          key={child.unique_key}
          variant="outline"
          onClick={() => addMentionToContent(child)}
        >
          {child.display_name}
        </Button>
      ))}
    </div>
  </DialogContent>
</Dialog>
```

### 2.4 メンション表示エリア

```tsx
{/* メンション中の児童表示 */}
{selectedMentions.length > 0 && (
  <div className="flex flex-wrap gap-2">
    {selectedMentions.map((mention) => (
      <div
        key={mention.unique_key}
        className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary"
      >
        <span>{mention.display_name}</span>
        <button
          type="button"
          onClick={() => removeMention(mention)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    ))}
  </div>
)}
```

---

## 3. バックエンドAPI実装

### 3.1 メンション候補取得API

**エンドポイント**: `GET /api/children/mention-suggestions`

**ファイル**: `app/api/children/mention-suggestions/route.ts`

**リクエストパラメータ**:
| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `class_id` | UUID | ✅ | クラスID |
| `query` | string | ❌ | 検索キーワード（名前、カナ、ニックネーム） |
| `limit` | number | ❌ | 取得上限（デフォルト: 20） |

**処理フロー**:

```typescript
1. class_id パラメータの検証
2. Supabase Auth で認証チェック
3. ユーザーセッションから current_facility_id を取得
4. m_children から条件に合う児童を検索
   - 施設ID一致チェック
   - クラスIDと is_current = true 一致チェック
   - 在籍状況が 'enrolled' のみ
   - deleted_at IS NULL（論理削除されていない）
   - 名前での検索（query パラメータでILIKE検索）
```

**レスポンス例**:

```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "child_id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "田中 太郎",
        "kana": "たなか たろう",
        "nickname": "太郎",
        "grade": "3年生",
        "class_id": "660e8400-e29b-41d4-a716-446655440000",
        "class_name": "ひまわり組",
        "photo_url": "https://example.com/photo.jpg",
        "display_name": "田中 太郎（3年生・ひまわり組）",
        "unique_key": "550e8400-e29b-41d4-a716-446655440000-660e8400-e29b-41d4-a716-446655440000"
      }
    ]
  }
}
```

**検索機能**:

- **Kana正規化検索**: カタカナ/ひらがな相互変換による検索
  - `toKatakana()`: ひらがな→カタカナ
  - `toHiragana()`: カタカナ→ひらがな
  - `normalizeKana()`: カタカナに統一 + 大文字化 + スペース削除
  - 検索対象: 名前、カナ、ニックネーム

---

### 3.2 メンション暗号化API

**エンドポイント**: `POST /api/mentions/encrypt`

**ファイル**: `app/api/mentions/encrypt/route.ts`

**リクエストボディ**:

```json
{
  "childId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**レスポンス**:

```json
{
  "encryptedToken": "aXY6YXV0aFRhZzplbmNyeXB0ZWRkYXRh..."
}
```

**処理フロー**:

```typescript
1. Supabase Auth 認証チェック
2. ユーザーセッション検証
3. 子どもIDフォーマット検証（UUID 正規表現チェック）
4. アクセス制御：
   - 対象児童がユーザーの施設に属しているか確認
   - 他施設の児童ID は暗号化拒否（403 Forbidden）
5. AES-256-GCM で暗号化
6. Base64url エンコードして返却
```

**セキュリティ実装**:
- 施設IDチェックによるアクセス制御
- UUID形式の厳格なバリデーション
- 他施設の児童IDは暗号化拒否

---

### 3.3 活動記録保存API

**エンドポイント**: `POST /api/records/activity`

**ファイル**: `app/api/records/activity/route.ts`

**リクエストボディ**:

```json
{
  "class_id": "660e8400-e29b-41d4-a716-446655440000",
  "activity_date": "2024-01-10",
  "title": "外遊び",
  "content": "公園で@田中 太郎 と@佐藤 花子 が一緒に遊びました。",
  "snack": "りんご、バナナ",
  "photos": ["url1", "url2"],
  "mentioned_children": [
    "encrypted_token_1",
    "encrypted_token_2"
  ]
}
```

**処理フロー**:

```typescript
1. Supabase Auth 認証チェック
2. r_activity テーブルに活動記録を保存
   - mentioned_children: TEXT[] として保存
3. 各メンショントークンを復号化
4. AI で個別記録を抽出（extractChildContent）
5. r_observation テーブルに個別記録を保存
```

**個別記録自動生成フロー**:

```typescript
for (const token of mentioned_children) {
  // 1. トークンを復号化して child_id を取得
  const childId = decryptChildId(token);

  // 2. AI で活動記録から該当児童の内容を抽出
  const extractedContent = await extractChildContent(
    content,      // 活動記録全文
    childId,      // 対象児童ID
    token         // メンショントークン
  );

  // 3. r_observation テーブルに保存
  await supabase.from('r_observation').insert({
    child_id: childId,
    observation_date: activity_date,
    content: extractedContent,
    source: 'ai_extracted',
    source_activity_id: activity_id,
    created_by: user.id,
  });
}
```

---

### 3.4 活動記録取得API

**エンドポイント**: `GET /api/activities`

**ファイル**: `app/api/activities/route.ts`

**処理内容**:
- 活動記録とそれに紐づく個別記録を取得
- デバッグログ付き

**レスポンス例**:

```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "activity_id": "770e8400-e29b-41d4-a716-446655440000",
        "activity_date": "2024-01-10",
        "title": "外遊び",
        "content": "公園で遊びました。",
        "individual_record_count": 2,
        "individual_records": [
          {
            "observation_id": "880e8400-e29b-41d4-a716-446655440000",
            "child_id": "550e8400-e29b-41d4-a716-446655440000",
            "child_name": "田中 太郎"
          }
        ]
      }
    ]
  }
}
```

---

## 4. データベーススキーマ

### 4.1 r_activity テーブル

**マイグレーションファイル**: `supabase/migrations/008_add_mentioned_children_to_activity.sql`

**テーブル定義**:

```sql
CREATE TABLE IF NOT EXISTS r_activity (
  activity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES m_classes(id),
  activity_date DATE NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  snack TEXT,
  mentioned_children TEXT[],  -- メンション児童の暗号化トークン配列
  created_by UUID NOT NULL REFERENCES m_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- GINインデックスを作成（配列検索の高速化）
CREATE INDEX idx_activity_mentioned_children
ON r_activity USING GIN (mentioned_children);
```

**mentioned_children カラム**:
- **型**: `TEXT[]`（テキスト配列）
- **用途**: メンションされた児童の暗号化トークンを保存
- **デフォルト**: `'{}'`（空配列）
- **インデックス**: GINインデックスで配列検索を高速化

---

### 4.2 m_children テーブル（参照）

**取得カラム**:

```sql
SELECT
  id,
  family_name,
  given_name,
  family_name_kana,
  given_name_kana,
  nickname,
  birth_date,
  grade_add,
  photo_url
FROM m_children
WHERE
  facility_id = ?
  AND enrollment_status = 'enrolled'
  AND deleted_at IS NULL
```

---

### 4.3 _child_class テーブル（中間テーブル）

**用途**: 子どもとクラスの多対多関係を管理

**フィルター条件**:
- `is_current = true`（現在のクラス所属のみ）

---

## 5. データ暗号化

### 5.1 暗号化アルゴリズム

**ファイル**: `utils/crypto/childIdEncryption.ts`

**アルゴリズム**: AES-256-GCM

**暗号化フロー**:

```typescript
1. 環境変数から暗号化キーを取得
   - CHILD_ID_ENCRYPTION_KEY（32バイト）

2. ランダムなIV（初期化ベクトル）を生成
   - 16バイト

3. AES-256-GCM で暗号化
   - 入力: 児童ID（UUID文字列）
   - 出力: 暗号化データ + 認証タグ

4. トークン構成
   iv(16進):authTag(16進):encrypted(16進)

5. Base64url エンコード
   - URL安全な文字列に変換
```

**復号化フロー**:

```typescript
1. Base64url デコード

2. トークンをコロン区切りで分割
   [iv, authTag, encrypted]

3. 16進数文字列をバッファに変換

4. AES-256-GCM で復号化
   - 入力: encrypted, iv, authTag
   - 出力: 児童ID（UUID文字列）
```

**セキュリティ特性**:
- **機密性**: AES-256（軍事グレード暗号化）
- **完全性**: GCM認証タグで改ざん検知
- **URL安全**: Base64url エンコード
- **サーバーサイドのみ**: 暗号化/復号化はサーバーサイドでのみ実行

---

## 6. AI個別記録抽出

### 6.1 抽出処理

**ファイル**: `lib/ai/contentExtractor.ts`

**関数**:

```typescript
export async function extractChildContent(
  fullContent: string,           // 活動記録全文
  childId: string,               // 対象児童ID
  mentionToken: string           // メンショントークン
): Promise<string>
```

**処理フロー**:

```typescript
1. メンションタグをプレーンテキストに変換
   <mention data-child-id="token">@名前</mention>
   → @child:token

2. Google Gemini API を呼び出し
   - モデル: gemini-2.0-flash
   - 温度: 0.7
   - 最大トークン: 300

3. プロンプト送信
   - システムプロンプト: 学童保育記録作成支援AIの役割定義
   - ユーザープロンプト: 活動記録全文 + 対象児童ID

4. 抽出ルール
   - その子供の行動・発言・様子に関する記述を抽出
   - その子供がメンションされている文脈を含める
   - 個別記録として自然な文章に整形
   - 事実ベースで記述（推測や誇張は禁止）
   - 名前ではなくID表記のみ使用

5. 抽出された個別記録テキストを返却
```

**プロンプト定義**: `lib/ai/prompts.ts`

```typescript
buildActivityExtractionMessages(plainContent, childIdentifier)
```

**AI モデル**: Google Gemini 2.0 Flash
- **温度**: 0.7（バランスの取れた創造性）
- **最大トークン**: 300（個別記録の適切な長さ）

---

## 7. 型定義

### 7.1 MentionSuggestion

```typescript
interface MentionSuggestion {
  child_id: string;              // 児童ID
  name: string;                  // 正式名（姓 名）
  kana: string;                  // カナ表記（姓 名）
  nickname?: string;             // ニックネーム
  grade?: string;                // 学年表記
  class_name?: string;           // クラス名
  photo_url?: string | null;     // 顔写真URL
  display_name: string;          // UI表示用名前
  unique_key: string;            // 一意キー（child_id-class_id）
}
```

### 7.2 Activity

```typescript
interface Activity {
  activity_id: string;
  activity_date: string;
  title: string;
  content: string;
  snack: string | null;
  photos: Array<ActivityPhoto | string>;
  class_name: string;
  class_id?: string;
  created_by: string;
  created_at: string;
  individual_record_count: number;
  individual_records: IndividualRecord[];
  mentioned_children?: string[];  // 暗号化トークン配列
}
```

### 7.3 IndividualRecord

```typescript
interface IndividualRecord {
  observation_id: string;
  child_id: string;
  child_name: string;
}
```

---

## 8. セキュリティ実装

### 8.1 認証・認可

#### /api/children/mention-suggestions

```typescript
1. Supabase Auth 認証チェック
2. ユーザーセッション検証
3. 施設ID一致チェック（ユーザーの施設に属する児童のみ取得）
```

#### /api/mentions/encrypt

```typescript
1. Supabase Auth 認証チェック
2. ユーザーセッション検証
3. 子どもIDフォーマット検証（UUID 正規表現チェック）
4. アクセス制御：
   - 対象児童がユーザーの施設に属しているか確認
   - 他施設の児童ID は暗号化拒否（403 Forbidden）
```

#### /api/records/activity

```typescript
1. Supabase Auth 認証
2. セッション検証
3. 施設ID一致チェック（アクティビティが属する施設）
```

### 8.2 データ保護

- **暗号化**: 児童IDを暗号化トークンとして保存
- **アクセス制御**: 施設IDベースのアクセス制御
- **入力検証**: UUID形式の厳格なバリデーション
- **サーバーサイド処理**: 暗号化/復号化はサーバーサイドのみで実行

---

## 9. テスト実装

### 9.1 ユニットテスト

**ファイル**: `__tests__/app/api/mentions/encrypt.test.ts`

**テスト項目**:

```typescript
✅ 認証テスト
  - 認証なしでアクセス → 401 Unauthorized
  - 他施設の児童ID → 403 Forbidden
  - 存在しない児童ID → 404 Not Found

✅ 暗号化トークン検証
  - 復号可能性
  - Base64url形式チェック

✅ バリデーション
  - childId必須チェック
  - UUID形式チェック

✅ エラーハンドリング
  - DB エラーで 500 Internal Server Error
```

---

## 10. 未実装機能

### 10.1 通知機能

**現状**: ❌ 未実装

**将来の実装を見据えたコメント**:
- ファイル: `app/api/dashboard/summary/route.ts`
- コメント: `// 学校と学年情報を含めて、将来の外部通知機能に対応`

**未実装項目**:
- メンション通知
- 通知UI
- 通知設定

---

## 11. まとめ

### 11.1 実装状況

| 項目 | 実装状況 | 備考 |
|------|--------|------|
| **メンション入力UI** | ✅完全 | @トリガー、ダイアログ、タグ表示 |
| **候補取得API** | ✅完全 | GET /api/children/mention-suggestions |
| **暗号化処理** | ✅完全 | AES-256-GCM、Base64url |
| **保存形式** | ✅完全 | TEXT[] 配列、GINインデックス |
| **個別記録自動生成** | ✅完全 | Gemini AI 抽出 |
| **認証・認可** | ✅完全 | 施設IDチェック、UUID検証 |
| **テスト** | ✅完全 | ユニットテスト充実 |
| **通知機能** | ❌未実装 | 将来の実装を見据えたコメントのみ |
| **通知UI** | ❌未実装 | - |

### 11.2 主要ファイル一覧

#### フロントエンド
- `app/records/activity/activity-record-client.tsx` (1,249行)

#### バックエンドAPI
- `app/api/children/mention-suggestions/route.ts`
- `app/api/mentions/encrypt/route.ts`
- `app/api/records/activity/route.ts`
- `app/api/activities/route.ts`

#### ユーティリティ
- `utils/crypto/childIdEncryption.ts`
- `lib/ai/contentExtractor.ts`
- `lib/ai/prompts.ts`

#### テスト
- `__tests__/app/api/mentions/encrypt.test.ts`

#### マイグレーション
- `supabase/migrations/008_add_mentioned_children_to_activity.sql`

---

## 12. 参考資料

- [データベーススキーマ仕様](./03_database.md)
- [API仕様](./04_api.md)
- [JWT認証設定](./jwt-custom-claims-setup.md)
