<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

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

# Coding Rules
- **Supabase Import**: Use `@/utils/supabase/server` (NOT `@/lib/supabase/server`)
- **Next.js 15 Params**: `params` are async - use `props: { params: Promise<T> }` and `await`
- **Auth in API**: Use `getAuthenticatedUserMetadata()` from `@/lib/auth/jwt`
- **TypeScript**: Strict types, avoid `any`
- **Components**: Server Components by default, `use client` only when needed
- **Dependencies**: 新しいパッケージの追加は最小限に。既存の依存関係で実現できないか検討すること

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
