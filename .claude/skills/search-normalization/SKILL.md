# 検索の正規化処理

検索機能を実装する際の文字正規化パターン。
全角スペース・ひらがな/カタカナの表記ゆれを吸収する。

## 適用場面

以下のキーワードでこのスキルを参照する:
- 「検索機能を実装」「フィルター処理を追加」
- 「ひらがな/カタカナで検索できない」
- 「全角スペースで検索できない」
- 「表記ゆれ対策」

---

## 1. 全角スペースの正規化

### 問題
ユーザーが「山田　太郎」（全角スペース）と入力しても「山田 太郎」（半角スペース）にマッチしない。

### 解決策
検索語と対象文字列の**両方**を正規化してから比較する。

```ts
// 全角スペース → 半角スペースに正規化してから比較
const normalize = (s: string) => s.replace(/　/g, ' ')

const filtered = children.filter((child) =>
  normalize(child.name).includes(normalize(searchTerm))
)
```

### 適用箇所（実績）
- `app/attendance/schedule/page.tsx` — 子どもの名前検索（PR#226）

---

## 2. ひらがな/カタカナの正規化

### 問題
「きりん」で検索しても「キリン」グループがヒットしない（またはその逆）。

### 解決策
`lib/utils/kana.ts` に共通ユーティリティを用意している。

```ts
// lib/utils/kana.ts

/** ひらがな → カタカナ変換 */
export function toKatakana(text: string): string {
  return text.replace(/[\u3041-\u3096]/g, (match) =>
    String.fromCharCode(match.charCodeAt(0) + 0x60)
  )
}

/**
 * カタカナに正規化（ひらがな→カタカナ、小文字化、空白除去）
 * クラス名・担任名などの表記ゆれ対策に使用
 */
export function normalizeKana(text: string): string {
  return toKatakana(text.toLowerCase().replace(/\s/g, ''))
}
```

### 使い方

```ts
import { normalizeKana } from '@/lib/utils/kana'

// API側のフィルター
const filtered = classes.filter((cls) =>
  normalizeKana(cls.name).includes(normalizeKana(searchTerm))
)
```

### 適用箇所（実績）
- `app/api/classes/route.ts` — クラス名・担任名の検索フィルター（PR#228）

---

## 3. 組み合わせパターン

名前検索で全角スペースとカナ両方を吸収したい場合:

```ts
import { normalizeKana } from '@/lib/utils/kana'

const normalize = (s: string) =>
  normalizeKana(s.replace(/　/g, ' ').trim())

const filtered = items.filter((item) =>
  normalize(item.name).includes(normalize(searchTerm))
)
```

---

## 4. 注意事項

- **対象文字列と検索語の両方**を正規化すること（片方だけでは不完全）
- フロントエンド（クライアント側）フィルターとAPI側（サーバー側）フィルターで**一貫した正規化**を適用すること
- `normalizeKana` は漢字・英数字には影響しない（`toKatakana` はひらがな範囲のみ変換）
- `normalizeKana` は小文字化・空白除去も行うため、英字検索にも有効

## 5. テスト

`__tests__/lib/utils/kana.test.ts` に単体テストを追加済み:

```ts
import { toKatakana, normalizeKana } from '@/lib/utils/kana'

describe('toKatakana', () => {
  it('ひらがなをカタカナに変換する', () => {
    expect(toKatakana('きりん')).toBe('キリン')
  })
  it('カタカナはそのまま返す', () => {
    expect(toKatakana('キリン')).toBe('キリン')
  })
})

describe('normalizeKana', () => {
  it('ひらがなとカタカナを同一視できる', () => {
    expect(normalizeKana('きりん')).toBe(normalizeKana('キリン'))
  })
  it('空白を除去する', () => {
    expect(normalizeKana('き り ん')).toBe(normalizeKana('きりん'))
  })
})
```
