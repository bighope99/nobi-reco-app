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
**Target**: After-school care programs (学童保育 - Gakudō Hoiku) for elementary school children
**Description**: A SaaS application for visualizing children's growth and streamlining record-keeping in after-school care settings.
**Goal**: Automate individual record extraction from daily activity logs using AI, visualize growth, and facilitate information sharing with parents.

## Important Domain Knowledge
- **Classes are NOT grade-based**: Unlike elementary schools, after-school care classes (e.g., "Sunflower Group", "Sakura Group") are fixed and do NOT change by school year or grade level.
- **Classes persist across years**: The same class name is used continuously, and children may move between classes within the facility.
- **Mixed-age groups**: Classes often contain children from different grades (e.g., 1st-3rd graders in one class).
# Technology Stack
- **Frontend**: Next.js 15 (App Router), React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 (Vanilla CSS for complex animations if needed)
- **UI Components**: Radix UI, Lucide React
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL) - Project ID: `biwqvayouhlvnumdjtjb` (stg_nobireco)
- **Auth**: Supabase Auth / Firebase Auth (as per docs, but Supabase is primary DB)
- **AI**: OpenAI GPT-4o-mini
# Database & API Design Rules

## Database Schema Reference
**CRITICAL**: ALWAYS refer to `docs/03_database.md` as the **single source of truth** for database schema when:
- Designing new API endpoints
- Modifying existing API implementations
- Writing database queries
- Creating or updating tables
- Understanding table relationships and constraints

The database schema in `docs/03_database.md` is the definitive specification. If you find discrepancies between the code and the documentation, the documentation should be considered correct unless explicitly stated otherwise.

# Database Naming Conventions
Strictly adhere to the following table prefixes:
- `m_`: Master tables (e.g., `m_companies`, `m_children`) - Basic entities, rarely deleted.
- `r_`: Record tables (e.g., `r_activity`, `r_observation`) - Daily transactional data.
- `s_`: Setting tables (e.g., `s_attendance_schedule`) - Configuration and patterns.
- `h_`: History/Log tables (e.g., `h_login`, `h_attendance`) - Audit logs, append-only.
- `_`: Intermediate tables (e.g., `_user_facility`) - Many-to-many relationships.
- `tmp_`: Temporary tables (e.g., `tmp_import`) - Work tables.
**Column Rules**:
- Primary Key: `id` (UUID recommended)
- Foreign Key: `{singular_table_name}_id` (e.g., `child_id`, not `children_id`)
- Timestamps: `created_at`, `updated_at`, `deleted_at` (for soft deletes)
- Booleans: `is_{state}`, `has_{attribute}`
- Date/Time: `{action}_at` (timestamp), `{period}_date` (date only)

**PostgreSQL Function Rules**:
- Use snake_case naming (e.g., `calculate_grade`)
- Add descriptive comments explaining purpose and usage
- Use `SECURITY DEFINER` for functions that need elevated privileges
- Set `search_path = public` for security
- Grant appropriate permissions (`authenticated`, `service_role`)
- Document in `docs/03_database.md` with usage examples
- Common patterns:
  - `calculate_*`: Calculation/computation functions (e.g., `calculate_grade`)
  - `*_hook`: Supabase trigger hooks (e.g., `custom_access_token_hook`)
  - `get_*`: Data retrieval functions
  - `update_*`: Data modification functions

## Database Schema Changes
**CRITICAL**: When creating or modifying database schema, you MUST:
1. **Create migration files** in `supabase/migrations/` with sequential numbering
2. **Update documentation** in `docs/03_database.md` with:
   - New tables in the appropriate section (Master/Record/Setting/History/Intermediate)
   - New columns with descriptions
   - New PostgreSQL functions with usage examples
   - New ENUM types
3. **Test the migration** before committing
4. **Document setup instructions** if manual configuration is required (e.g., Supabase Hooks)

**Example workflow**:
```bash
# 1. Create migration file
supabase/migrations/NNN_description.sql

# 2. Update docs/03_database.md
# Add table/function/type definition with examples

# 3. Test migration
supabase db reset  # or apply migration

# 4. Commit changes together
```

# Coding Guidelines
- **Functional Components**: Use React functional components with hooks.
- **Type Safety**: Use strict TypeScript types. Avoid `any`.
- **Server Components**: Default to Server Components in Next.js App Router unless `use client` is required.
- **Styling**: Use Tailwind CSS utility classes.
- **File Structure**: Follow the existing Next.js App Router structure.
- **Supabase Import Path**: ALWAYS use `@/utils/supabase/server` for server-side Supabase client imports in API routes. DO NOT use `@/lib/supabase/server` as it does not exist in this project.
- **Next.js 15 Async Params**: dynamic route `params` are now asynchronous. Always define them as `props: { params: Promise<T> }` and `await props.params` before using.
# Authentication & Session Management

## JWT Custom Claims Authentication (Recommended)
**When to use**: When building or modifying API routes that need user authentication and authorization (role, company_id, facility_id).

**Benefits**:
- Eliminates 2 DB queries per API request (40% reduction)
- Secure (JWT is signed and tamper-proof)
- Scalable (reduces database load)

**Implementation**:
```typescript
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

// Get user metadata from JWT (no DB queries)
const metadata = await getAuthenticatedUserMetadata();
if (!metadata) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const { role, company_id, current_facility_id } = metadata;
```

**Setup**: JWT custom claims must be configured once in Supabase. See `.claude/skills/supabase-jwt-auth` for complete setup guide.

**Use the supabase-jwt-auth skill when**:
- Creating new API routes that need user authentication
- Optimizing existing API routes with excessive DB queries
- Setting up authorization checks based on user role or facility

## Session Management (UI Display)
- **Session Storage**: Store UserSession data in sessionStorage for UI display purposes
- **Session Structure**: Follow the UserSession interface defined in `/lib/auth/session.ts`
  - Must include: user_id, email, name, role, company_id, company_name
  - Must include: facilities array, current_facility_id, classes array
- **Session API**: Use `/api/auth/session` POST endpoint to fetch full session data after Supabase auth
- **Note**: API routes should use JWT metadata (above), not sessionStorage data

## General Authentication
- **Authentication**: Use Supabase Auth for email/password authentication
- **Protected Routes**: Check Supabase session via middleware before accessing protected pages
- **Logout**: Clear both Supabase session and sessionStorage data
# Critical Rules
- **Aesthetics**: Prioritize premium, modern, and dynamic designs. Use micro-animations and smooth transitions.
- **Performance**: Ensure fast load times and responsive interactions.
- **Security**: Implement RLS in Supabase and proper validation in API routes.

# Agent Utilization Guidelines

## 基本方針
**できる限りサブエージェントを活用する**ことを推奨します。エージェントは専門分野に特化しており、効率的かつ高品質な実装を実現します。

## エージェント活用の原則

### 1. 積極的な委譲
複雑なタスクや専門性が求められる作業は、適切なエージェントに委譲する:
- **実装コード**: `code-implementer` エージェント
- **フロントエンド**: `frontend-implementer` エージェント
- **データベーススキーマ**: `supabase-schema-manager` エージェント
- **ドキュメント**: `docs-updater` エージェント
- **コードベース探索**: `Explore` エージェント
- **実装計画**: `Plan` エージェント

### 2. 並列処理の活用
依存関係がないタスクは、複数のエージェントで並列処理する:

```typescript
// ✅ GOOD: 並列エージェント実行
// 単一メッセージで複数のTaskツール呼び出し
Task(docs-updater) + Task(code-implementer) + Task(frontend-implementer)
```

**メリット**:
- 処理時間の大幅短縮
- 各エージェントが専門分野に集中
- 一貫性のある実装品質

### 3. エージェント選択ガイド

| タスク種別 | 使用エージェント | 例 |
|-----------|----------------|-----|
| API実装・バグ修正 | `code-implementer` | 新規エンドポイント作成、ビジネスロジック実装 |
| フロントエンド実装 | `frontend-implementer` | コンポーネント作成、UIデザイン修正 |
| データベース設計 | `supabase-schema-manager` | マイグレーション作成、SQL関数実装 |
| ドキュメント更新 | `docs-updater` | 仕様書更新、README修正 |
| コードベース調査 | `Explore` | ファイル構成理解、関連コード探索 |
| 実装方針設計 | `Plan` | アーキテクチャ判断、実装計画策定 |
| コミット作成 | `git-commit-helper` | 変更のステージング、コミットメッセージ生成 |
| PR作成 | `github-pr-creator` | Pull Request作成、レビュー依頼 |

### 4. 並列処理の判断基準

**並列処理すべき場合**:
- データベーススキーマ更新 + ドキュメント更新 + API実装
- フロントエンド実装 + バックエンド実装（APIが独立している場合）
- 複数の独立した機能追加

**順次処理すべき場合**:
- 後続タスクが前のタスクの結果に依存する
- 実装方針を確認してから実装に進む（Plan → code-implementer）

### 5. エージェント活用の実践例

```markdown
例1: 新機能実装
1. Plan エージェント: 実装方針設計
2. 並列実行:
   - supabase-schema-manager: DB設計
   - docs-updater: ドキュメント更新
3. 並列実行:
   - code-implementer: API実装
   - frontend-implementer: UI実装
4. git-commit-helper: コミット作成

例2: バグ修正
1. Explore エージェント: 問題箇所特定
2. code-implementer: 修正実装
3. git-commit-helper: コミット作成
```

## エージェント活用のメリット

1. **品質向上**: 専門エージェントによる一貫した実装パターン
2. **効率化**: 並列処理による時間短縮
3. **保守性**: 標準化されたコーディング規約の遵守
4. **ドキュメント**: 自動的な文書化とコメント追加

**重要**: 単純なタスクでも、エージェント活用を検討することで、長期的な品質とメンテナンス性が向上します。

# Performance Optimization Rules

## Supabaseクエリの並列化
依存関係がない複数のSupabaseクエリは `Promise.all` で並列実行する。

```typescript
// ✅ GOOD: 並列実行
const [usersResult, facilitiesResult, classesResult] = await Promise.all([
  supabase.from('m_users').select('id, name'),
  supabase.from('m_facilities').select('id, name'),
  supabase.from('m_classes').select('id, name'),
]);
```

## ループ内検索のMap変換
ループ内で `find()` や `filter()` を使う場合、事前にMapに変換してO(1)でアクセスする。

```typescript
// ❌ BAD: O(n²)
children.map(child => {
  const schedule = schedules.find(s => s.child_id === child.id);
});

// ✅ GOOD: O(n)
const scheduleMap = new Map(schedules.map(s => [s.child_id, s]));
children.map(child => {
  const schedule = scheduleMap.get(child.id);
});
```

## パフォーマンス診断チェックリスト
1. **SQLクエリ回数**: 順次実行 → 並列化
2. **O(n²)ループ**: find/filter → Map変換
3. **不要なデータ**: select('*') → 必要カラムのみ
4. **N+1問題**: ループ内クエリ → JOIN/IN一括取得