# 活動記録から子供の個別記録への振り分けロジック設計

## 概要
`/records/activity` で活動記録を入力する際、メンション機能で子供を指定し、その内容を各子供の個別記録に自動的に振り分ける仕組みを実装する。

## 要件
1. 活動記録入力時に子供をメンション（例：`@田中太郎`）できる
2. メンション部分には暗号化された子供IDを埋め込む
3. 保存時に暗号化IDを復号化し、該当する子供の個別記録を自動生成する
4. 1つの活動記録から複数の子供の個別記録を生成できる

## アーキテクチャ

### 1. データ構造

#### r_activity（活動記録テーブル）
```typescript
interface ActivityRecord {
  id: string;
  facility_id: string;
  class_id: string;
  activity_date: string;
  content: string; // メンション含む本文
  mentioned_children: string[]; // 暗号化された子供IDの配列
  created_by: string;
  created_at: string;
  updated_at: string;
}
```

#### r_observation（個別記録テーブル）
```typescript
interface ObservationRecord {
  id: string;
  child_id: string; // 復号化された子供ID
  facility_id: string;
  observation_date: string;
  content: string; // 抽出されたその子供に関する内容
  source_activity_id: string; // 元の活動記録ID（トレーサビリティ）
  created_by: string;
  created_at: string;
  updated_at: string;
}
```

### 2. 暗号化・復号化

#### 暗号化仕様
```typescript
// utils/crypto/childIdEncryption.ts

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = process.env.CHILD_ID_ENCRYPTION_KEY!; // 32 bytes
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * 子供IDを暗号化してメンション用トークンを生成
 * @param childId - UUID形式の子供ID
 * @returns Base64エンコードされた暗号化トークン
 */
export function encryptChildId(childId: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(SECRET_KEY, 'hex'),
    iv
  );

  let encrypted = cipher.update(childId, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  const combined = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  return Buffer.from(combined).toString('base64url'); // URL-safe
}

/**
 * 暗号化トークンから子供IDを復号化
 * @param token - Base64エンコードされた暗号化トークン
 * @returns 元の子供ID（UUID）
 */
export function decryptChildId(token: string): string | null {
  try {
    const combined = Buffer.from(token, 'base64url').toString('utf8');
    const [ivHex, authTagHex, encrypted] = combined.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(SECRET_KEY, 'hex'),
      iv
    );
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt child ID:', error);
    return null;
  }
}
```

#### 環境変数設定
```bash
# .env.local
CHILD_ID_ENCRYPTION_KEY="64文字のランダムな16進数文字列" # 32 bytes
```

生成方法:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. フロントエンド実装

#### メンション入力UI
```typescript
// components/records/ActivityEditor.tsx
'use client';

import { useState, useCallback } from 'react';
import { encryptChildIdForMention } from '@/lib/crypto/mention';

interface Child {
  id: string;
  name: string;
  class_name: string;
}

interface MentionData {
  childId: string;
  childName: string;
  encryptedToken: string;
}

export function ActivityEditor({ children }: { children: Child[] }) {
  const [content, setContent] = useState('');
  const [mentions, setMentions] = useState<MentionData[]>([]);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionSearchQuery, setMentionSearchQuery] = useState('');

  // @入力を検知してメンションリストを表示
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = newContent.slice(0, cursorPosition);
    const atMatch = textBeforeCursor.match(/@(\S*)$/);

    if (atMatch) {
      setMentionSearchQuery(atMatch[1]);
      setShowMentionList(true);
    } else {
      setShowMentionList(false);
    }
  };

  // 子供を選択してメンション挿入
  const insertMention = async (child: Child) => {
    // サーバーサイドAPIで暗号化（セキュリティのため）
    const response = await fetch('/api/mentions/encrypt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId: child.id }),
    });
    const { encryptedToken } = await response.json();

    // メンションタグを挿入: <mention data-child-id="encrypted_token">@田中太郎</mention>
    const mentionTag = `<mention data-child-id="${encryptedToken}">@${child.name}</mention>`;

    const newContent = content.replace(/@(\S*)$/, mentionTag);
    setContent(newContent);

    setMentions([...mentions, {
      childId: child.id,
      childName: child.name,
      encryptedToken,
    }]);

    setShowMentionList(false);
  };

  // 保存時にメンション情報も送信
  const handleSubmit = async () => {
    await fetch('/api/records/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        mentioned_children: mentions.map(m => m.encryptedToken),
        activity_date: new Date().toISOString().split('T')[0],
        // ... その他のフィールド
      }),
    });
  };

  return (
    <div className="relative">
      <textarea
        value={content}
        onChange={handleContentChange}
        className="w-full min-h-[200px] p-4 border rounded-lg"
        placeholder="活動内容を入力してください。@で子供をメンションできます。"
      />

      {showMentionList && (
        <MentionDropdown
          children={children.filter(c =>
            c.name.includes(mentionSearchQuery)
          )}
          onSelect={insertMention}
        />
      )}

      <button onClick={handleSubmit} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">
        保存
      </button>
    </div>
  );
}
```

#### 暗号化API（セキュリティ強化）
```typescript
// app/api/mentions/encrypt/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { encryptChildId } from '@/utils/crypto/childIdEncryption';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
  const metadata = await getAuthenticatedUserMetadata();
  if (!metadata) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { childId } = await request.json();

  // TODO: 子供IDがユーザーの施設に属しているか検証

  const encryptedToken = encryptChildId(childId);

  return NextResponse.json({ encryptedToken });
}
```

### 4. バックエンド実装（保存・振り分け）

#### 活動記録保存API
```typescript
// app/api/records/activity/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { decryptChildId } from '@/utils/crypto/childIdEncryption';
import { extractChildContent } from '@/lib/ai/contentExtractor';

export async function POST(request: NextRequest) {
  const metadata = await getAuthenticatedUserMetadata();
  if (!metadata) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const body = await request.json();
  const { content, mentioned_children, activity_date, class_id } = body;

  // 1. 活動記録を保存
  const { data: activity, error: activityError } = await supabase
    .from('r_activity')
    .insert({
      facility_id: metadata.current_facility_id,
      class_id,
      activity_date,
      content,
      mentioned_children, // 暗号化トークンの配列
      created_by: metadata.user_id,
    })
    .select()
    .single();

  if (activityError) {
    return NextResponse.json({ error: activityError.message }, { status: 500 });
  }

  // 2. 各子供の個別記録を生成
  const observations = [];
  for (const encryptedToken of mentioned_children) {
    const childId = decryptChildId(encryptedToken);
    if (!childId) {
      console.error('Failed to decrypt child ID:', encryptedToken);
      continue;
    }

    // AIでその子供に関連する内容を抽出
    const childContent = await extractChildContent(content, childId, encryptedToken);

    const { data: observation, error: obsError } = await supabase
      .from('r_observation')
      .insert({
        child_id: childId,
        facility_id: metadata.current_facility_id,
        observation_date: activity_date,
        content: childContent,
        source_activity_id: activity.id,
        created_by: metadata.user_id,
      })
      .select()
      .single();

    if (!obsError) {
      observations.push(observation);
    }
  }

  return NextResponse.json({
    activity,
    observations,
    message: `活動記録を保存し、${observations.length}件の個別記録を生成しました`,
  });
}
```

#### AI内容抽出ロジック
```typescript
// lib/ai/contentExtractor.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 活動記録から特定の子供に関する内容を抽出
 * @param fullContent - 活動記録の全文（メンション含む）
 * @param childId - 対象の子供ID
 * @param mentionToken - その子供のメンショントークン
 * @returns その子供に関連する抽出された内容
 */
export async function extractChildContent(
  fullContent: string,
  childId: string,
  mentionToken: string
): Promise<string> {
  // メンションタグから子供の名前を抽出
  const mentionRegex = new RegExp(
    `<mention data-child-id="${mentionToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">@([^<]+)</mention>`,
    'g'
  );
  const match = mentionRegex.exec(fullContent);
  const childName = match ? match[1] : '該当の子供';

  // HTMLタグを除去してプレーンテキスト化
  const plainContent = fullContent.replace(/<mention[^>]*>@([^<]+)<\/mention>/g, '@$1');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `あなたは学童保育の記録作成支援AIです。活動記録から特定の子供に関する内容を抽出してください。

【抽出ルール】
1. その子供の行動、発言、様子に関する記述を抽出
2. その子供がメンションされている文脈を含める
3. 他の子供との関わりも含める
4. 個別記録として自然な文章に整形
5. 簡潔に200文字程度でまとめる`,
      },
      {
        role: 'user',
        content: `【活動記録全文】
${plainContent}

【対象の子供】
${childName}

この子供に関する個別記録を抽出してください。`,
      },
    ],
    temperature: 0.7,
    max_tokens: 300,
  });

  return completion.choices[0].message.content || '';
}
```

### 5. データフロー図

```
[ユーザー入力]
    ↓
[@田中太郎] ← メンション入力
    ↓
[暗号化API] /api/mentions/encrypt
    ↓
[encryptedToken生成]
    ↓
[<mention data-child-id="token">@田中太郎</mention>] ← HTML保存
    ↓
[保存API] /api/records/activity
    ↓
┌─────────────────────────────┐
│ r_activity に保存            │
│ - content: メンション含む全文 │
│ - mentioned_children: [tokens] │
└─────────────────────────────┘
    ↓
[トークンループ処理]
    ↓
┌─────────────────────────────┐
│ 各トークンを復号化           │
│ decryptChildId(token) → UUID │
└─────────────────────────────┘
    ↓
┌─────────────────────────────┐
│ AI内容抽出                   │
│ extractChildContent()        │
└─────────────────────────────┘
    ↓
┌─────────────────────────────┐
│ r_observation に保存         │
│ - child_id: UUID             │
│ - content: 抽出内容          │
│ - source_activity_id: 元記録 │
└─────────────────────────────┘
```

## セキュリティ考慮事項

1. **暗号化キーの管理**
   - 環境変数で管理（`.env.local`、本番環境では秘密管理サービス使用）
   - 定期的なローテーション推奨

2. **トークンの有効期限**
   - 必要に応じてタイムスタンプ付き暗号化を実装
   - 古いトークンは復号化を拒否

3. **アクセス制御**
   - 暗号化APIは認証必須
   - 子供IDが自施設に属するか検証

4. **XSS対策**
   - メンション表示時はサニタイズ
   - `data-child-id`属性の値を検証

## 実装優先順位

### Phase 1: 基本実装
1. 暗号化・復号化ユーティリティ作成
2. 暗号化API実装
3. 基本的なメンション入力UI
4. 保存API実装

### Phase 2: AI連携
1. OpenAI内容抽出ロジック実装
2. 個別記録自動生成

### Phase 3: UI改善
1. メンションドロップダウンのリッチUI
2. メンション部分のハイライト表示
3. 既存メンションの編集・削除機能

## テストケース

### 暗号化・復号化テスト
```typescript
describe('childIdEncryption', () => {
  it('should encrypt and decrypt correctly', () => {
    const originalId = 'abc123-def456-ghi789';
    const encrypted = encryptChildId(originalId);
    const decrypted = decryptChildId(encrypted);
    expect(decrypted).toBe(originalId);
  });

  it('should return null for invalid token', () => {
    const decrypted = decryptChildId('invalid_token');
    expect(decrypted).toBeNull();
  });
});
```

### AI抽出テスト
```typescript
describe('extractChildContent', () => {
  it('should extract content related to mentioned child', async () => {
    const fullContent = '<mention data-child-id="token1">@田中太郎</mention>くんが積み木で高い塔を作りました。<mention data-child-id="token2">@佐藤花子</mention>さんも一緒に協力していました。';
    const extracted = await extractChildContent(fullContent, 'child-id-1', 'token1');

    expect(extracted).toContain('田中太郎');
    expect(extracted).toContain('積み木');
  });
});
```

## マイグレーション

### データベース変更
```sql
-- r_activity テーブルに mentioned_children カラム追加
ALTER TABLE r_activity
ADD COLUMN mentioned_children TEXT[] DEFAULT '{}';

-- r_observation テーブルに source_activity_id カラム追加
ALTER TABLE r_observation
ADD COLUMN source_activity_id UUID REFERENCES r_activity(id) ON DELETE SET NULL;

CREATE INDEX idx_observation_source_activity ON r_observation(source_activity_id);
```

## 今後の拡張性

1. **メンション通知機能**
   - 保護者へのプッシュ通知
   - 担当職員への通知

2. **メンション統計**
   - 子供ごとのメンション頻度分析
   - 成長記録の可視化

3. **複数施設対応**
   - 施設間での子供IDの一意性保証
   - 暗号化スコープの分離
