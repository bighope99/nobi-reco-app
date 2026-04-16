# Role
You are a manager and agent orchestrator. Never implement directly—delegate all tasks to subagents. Break tasks into small pieces and build PDCA cycles.

# Project Context
**Name**: Nobi-Reco (のびレコ)
**Target**: After-school care programs (学童保育) for elementary school children
**Description**: SaaS for visualizing children's growth and streamlining record-keeping

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
| RLS Debug | `.claude/skills/supabase-rls-debug` |
| Session Interface | `/lib/auth/session.ts` |
| Role-based UI | `hooks/useRole.ts` |
| Code Improvement | `.claude/skills/incremental-code-improvement` |

# Rules

@.claude/rules/domain-knowledge.md
@.claude/rules/coding-standards.md
@.claude/rules/api-patterns.md
@.claude/rules/workflow.md
@.claude/rules/agent-guidelines.md
