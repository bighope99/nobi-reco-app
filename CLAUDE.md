# Project Context
**Name**: Nobi-Reco (のびレコ)
**Target**: After-school care programs (学童保育) for elementary school children
**Description**: SaaS for visualizing children's growth and streamlining record-keeping

## Domain Knowledge (IMPORTANT)
- **Classes are NOT grade-based**: Classes (e.g., "Sunflower Group") are fixed and do NOT change by grade level
- **Classes persist across years**: Children may move between classes within the facility
- **Mixed-age groups**: Classes contain children from different grades

# Technology Stack
- Next.js 15 (App Router), React 19, TypeScript
- Tailwind CSS v4, Radix UI, Lucide React
- Supabase (PostgreSQL) - Project ID: `biwqvayouhlvnumdjtjb`
- OpenAI GPT-4o-mini

# Key References

| Topic | Reference |
|-------|-----------|
| Database Schema | `docs/03_database.md` (single source of truth) |
| DB Naming & Migrations | `.claude/skills/docs-database-conventions` |
| JWT Authentication | `.claude/skills/supabase-jwt-auth` |
| Query Patterns | `.claude/skills/supabase-query-patterns` |
| Session Interface | `/lib/auth/session.ts` |
| Role-based UI | `hooks/useRole.ts` — `useRole()` でロール判定。直接 `session.role` を比較しない |
| Code Improvement | `.claude/skills/incremental-code-improvement` |

## Incremental Code Improvement (編集時の段階的改善)

ファイル編集時は周辺の `any` 型やエラーハンドリングも改善する。
詳細: `.claude/skills/incremental-code-improvement`

## Role-based UI (ロールベースUI)

ロールによる表示切替は `useRole()` フックを使う。`session.role` を直接比較しない。

```tsx
const { isAdmin, isFacilityAdmin, isStaff, hasRole } = useRole()
// isAdmin: site_admin または company_admin
// isFacilityAdmin: facility_admin
// isStaff: staff
// hasRole('facility_admin', 'site_admin'): 複数ロール指定
```

ロール→サイドバー変換は `getSidebarType(role)` (`components/layout/app-layout.tsx`) を参照。

# Package Installation Rules
- **必ず許可を求める**: `npm install` / `pnpm add` などでパッケージを追加する前に、必ずユーザーに許可を求める
- **理由を説明する**: 許可を求める際は「なぜそのパッケージが必要か」「既存の方法では解決できない理由」を明示する
- **代替案を検討する**: 既存パッケージ・標準APIで代替できる場合はそちらを優先し、新規パッケージは最終手段とする

# Workflow Rules
- **Use a worktree for code changes**: Create a NEW worktree before starting any task that will modify code, docs, or other tracked files, or when parallel implementation may be useful. Notion確認・調査・チケット操作だけのような非コード作業では worktree は不要。
- **Worktree cleanup**: Delete the worktree when the user says the session/task is done (e.g., "終了"). Discard uncommitted `package-lock.json` and `settings.json` without committing them.
- **Rules & skills**: New rules and skills are added to this file (CLAUDE.md).
- **PR fix workflow**: PR番号 (`/pull/123`) またはブランチ指定で修正する場合は `fix-pr` スキルを使う。原則、同じPRにプッシュ。新PRは「分けて」と明示された場合のみ。
- **Code change workflow**: 実装完了後は以下の順で実行する
  1. （任意）`pr-review` スキル — セキュリティ・品質・パフォーマンスを網羅的に確認したい場合のみ実行。軽微な変更や CodeRabbit で十分な場合は不要。
  2. `create-pr` スキル — PR作成 → CodeRabbitレビューループ（最大3回）
  3. PR URLをユーザーに報告
- **Manual update**: UI・機能に影響する変更後は `manual-update` スキルで対応するNotionマニュアルページを更新する

## ログルール
サブエージェントを起動する前に必ず以下をターミナルに出力すること：
🤖 [サブエージェント起動] 目的: {目的} / タイプ: {general-purpose|Explore|Plan}
完了後：
✅ [サブエージェント完了] 結果: {一行サマリー}

# Agent Guidelines

**原則**: サブエージェントに委譲し、並列処理を活用する

| Task | Agent |
|------|-------|
| API/Backend | `code-implementer` |
| Frontend/UI | `frontend-implementer` |
| DB Schema | `db-schema-validator` |
| Docs | `docs-updater` |
| Research | `Explore` |
| Planning | `Plan` |

**並列実行**: 依存関係がないタスクは単一メッセージで複数のTaskツール呼び出し
