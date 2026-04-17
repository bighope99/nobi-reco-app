# Coding Standards

## Incremental Code Improvement（編集時の段階的改善）

ファイル編集時は周辺の `any` 型やエラーハンドリングも改善する。
詳細: `.claude/skills/incremental-code-improvement`

## タイムゾーン（JST）

NEVER use `new Date()` directly. Always use `lib/utils/timezone.ts`.

```ts
import { getCurrentDateJST, getCurrentTimeJST, formatTimeJST, getTomorrowDateJST } from '@/lib/utils/timezone';
```

## Package Installation Rules

NEVER run `npm install` / `pnpm add` without user approval. Explain why needed and why existing packages can't solve it.
