# Coding Standards

## Incremental Code Improvement（編集時の段階的改善）

ファイル編集時は周辺の `any` 型やエラーハンドリングも改善する。
詳細: `.claude/skills/incremental-code-improvement`

## Role-based UI（ロールベースUI）

ロールによる表示切替は `useRole()` フックを使う。`session.role` を直接比較しない。

```tsx
const { isAdmin, isFacilityAdmin, isStaff, hasRole } = useRole()
// isAdmin: site_admin または company_admin
// isFacilityAdmin: facility_admin
// isStaff: staff
// hasRole('facility_admin', 'site_admin'): 複数ロール指定
```

ロール→サイドバー変換は `getSidebarType(role)` (`components/layout/app-layout.tsx`) を参照。

## タイムゾーン（JST）

日付・時刻操作は必ず `lib/utils/timezone.ts` のユーティリティを使う。`new Date()` をそのまま使うと UTC になるため禁止。

```ts
import { getCurrentDateJST, getCurrentTimeJST, formatTimeJST, getTomorrowDateJST } from '@/lib/utils/timezone';

getCurrentDateJST()      // "YYYY-MM-DD"（今日・JST）
getCurrentTimeJST()      // "HH:mm"（現在時刻・JST）
formatTimeJST(isoStr)   // UTC の ISO 文字列 → JST の "HH:mm"
getTomorrowDateJST()     // "YYYY-MM-DD"（明日・JST）
```

## XSS サニタイズ

ユーザー入力をAPIに送る前に `lib/security/sanitize.ts` でサニタイズする。

```ts
import { sanitizeText, sanitizeArrayFields, sanitizeObjectFields } from '@/lib/security/sanitize';
```

## UUID バリデーション

外部から受け取った ID は `lib/utils/validation.ts` で検証する。

```ts
import { isValidUUID, findInvalidUUIDs } from '@/lib/utils/validation';
if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
```

## Package Installation Rules

- **必ず許可を求める**: `npm install` / `pnpm add` などでパッケージを追加する前に、必ずユーザーに許可を求める
- **理由を説明する**: 許可を求める際は「なぜそのパッケージが必要か」「既存の方法では解決できない理由」を明示する
- **代替案を検討する**: 既存パッケージ・標準APIで代替できる場合はそちらを優先し、新規パッケージは最終手段とする
