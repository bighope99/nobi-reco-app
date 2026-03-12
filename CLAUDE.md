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
| Code Improvement | `.claude/skills/incremental-code-improvement` |

## Incremental Code Improvement (編集時の段階的改善)

ファイル編集時は周辺の `any` 型やエラーハンドリングも改善する。
詳細: `.claude/skills/incremental-code-improvement`

# Workflow Rules
- **ALWAYS use a worktree**: Never work directly on the main branch. Create a NEW worktree at the start of each new task.
- **Worktree cleanup**: Delete the worktree ONLY after the user explicitly says the PR is published/merged. Never assume it's done on your own.
- **Rules & skills**: New rules and skills are added to this file (CLAUDE.md).
- **Code change workflow**: 実装完了後は必ず以下の順で実行する
  1. `/pr-review` でコードレビュー → 指摘を修正
  2. `/create-pr` でPR作成 → CodeRabbitレビューループ（最大3回）
  3. PR URLをユーザーに報告

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
