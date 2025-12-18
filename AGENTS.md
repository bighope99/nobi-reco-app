# AGENTS — NobiReco

Use this handbook whenever you update the のびレコ child-growth recording app.

## Product Snapshot
- Next.js 13 App Router + TypeScript with shadcn/ui primitives under `components/ui`.
- Two personas: **staff/facility users** (routes under `/dashboard`, `/children`, `/records`, `/attendance`, `/settings`, `/data`) and **site administrators** (routes under `/admin/**`).
- Mock content lives in `lib/mock-data.ts`; extend these exports when you need additional seed data.
- The backing data platform is Supabase project `stg_nonroco`; coordinate credentials/env vars with that instance when hitting real APIs.

## Implementation Guardrails
- Wrap new staff views with `StaffLayout` and admin views with `AdminLayout` so the shared sidebar/header render correctly. Set `title`/`subtitle` props using Japanese text.
- Favor composition with existing UI primitives (`Card`, `Button`, `Input`, `Badge`, etc.) and Tailwind utility classes already used in the repo. Avoid raw HTML buttons/inputs so theming stays consistent.
- Maintain the routing conventions already in `app/`: list pages at `/section`, creation at `/section/new`, detail at `/section/[id]`, edit at `/section/[id]/edit`.
- Keep copy concise and in Japanese; reuse domain terms like "児童", "記録", "出席" to maintain tone.

## Working Agreements
- When scaffolding new features, document any project-specific rules in `.cursor/rules/` and keep this file updated.
- Prefer lightweight mock-backed flows over dynamic data until real APIs exist; surface TODO comments if API contracts are missing.
- Run relevant Next.js or lint commands before shipping significant UI work, and capture manual testing steps in PR summaries.
# Agent Guidance for nobi-reco-app

Use this repository in alignment with the specifications in the `docs/` folder. The rules below apply everywhere in this repo.

## Delivery rules
- Preserve the multi-tenant hierarchy (organization → facility → class) and the staff-facing web UX outlined in `docs/01_requirements.md`. Out-of-scope MVP items (guardian mobile app, billing, email delivery) must remain stubbed unless the specs change.
- Keep user access within defined roles (system/organization/facility admins and staff). Design data filters and UI visibility to match those scopes.
- When you open a PR, cite the specific doc sections that justify the change; explain how the work stays within spec.

## Data and schema alignment
- Reflect the database updates in `docs/03_database.md` and `docs/08_database_additions.md`: adopt `m_guardians`, `_child_guardian`, `_child_sibling`, `r_report`, `h_report_share`, and treat guardian columns in `m_children` as deprecated, not authoritative.
- Follow the naming conventions in `docs/06_database_naming_rules.md` and avoid reintroducing single-guardian assumptions in models, migrations, or seeds.
- API work should respect the required endpoints and versioning expectations captured in `docs/04_api.md`, `docs/07_auth_api.md`, and `docs/09_api_updates_required.md`.

## Database schema changes (CRITICAL)
- **NEVER add, modify, or remove database columns, tables, or indexes without explicit user approval.**
- Before making any schema changes:
  1. Identify the necessity and business justification for the change
  2. Present the proposed change to the user for approval
  3. Only after receiving explicit approval, proceed with:
     - Creating migration files in `supabase/migrations/`
     - Updating `docs/03_database.md` to reflect the schema change
     - Updating any affected code
- If code references a column that doesn't exist in the schema, **do not add the column automatically**. Instead:
  1. Remove the code reference to the non-existent column
  2. Inform the user about the mismatch
  3. Propose the schema change and wait for approval
- Schema changes affect data integrity, migrations, and documentation - they require careful consideration and approval.

## Security and compliance (highest priority from `docs/00_nonfunctional_requirements_review.md`)
- Define and enforce password policy (length/complexity, reuse bans, lockout), MFA where applicable, and explicit session/refresh token lifetimes.
- Encrypt PII columns (children/guardians phone, email, address, allergies, health notes) with AES-256-GCM or the platform’s equivalent. Do not store or transmit plaintext PII.
- Mask personal data before sending content to AI APIs; use pseudonyms for names and avoid leaking identifiers in logs.
- Apply RLS policies that scope every table to the tenant, facility, and class relationships; keep policy examples from the docs in mind when adding queries.
- Add rate limiting and WAF/CDN considerations where new network surfaces appear; avoid `dangerouslySetInnerHTML` unless there is a documented, sanitized need.

## Quality and testing expectations
- Favor Supabase client/parameterized queries over raw SQL. Do not weaken existing constraints or validation.
- Plan automated coverage with Jest, Supertest, and Playwright; add meaningful unit/e2e coverage for new behavior and keep CI friendliness in mind.
- Document operational hooks (logging, Sentry/Datadog APM, incident response) when adding production-facing changes to stay aligned with the reviewed nonfunctional requirements.

## Next.js 15 Framework Rules
- **Async Params in API Routes/Server Pages**: In Next.js 15, dynamic route parameters (`params`) and search parameters (`searchParams`) are asynchronous. You **MUST** await them before access.
  ```typescript
  // CORRECT
  export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const { id } = params;
    // ...
  }
  
  // INCORRECT
  export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const { id } = params; // Error: params is a promise
    // ...
  }
  ```

## API Performance Optimization Rules

### 1. Supabaseクエリの並列化
依存関係がない複数のSupabaseクエリは、必ず`Promise.all`で並列実行する。

```typescript
// ❌ BAD: 順次実行（遅い）
const { data: users } = await supabase.from('m_users').select('*');
const { data: facilities } = await supabase.from('m_facilities').select('*');
const { data: classes } = await supabase.from('m_classes').select('*');

// ✅ GOOD: 並列実行（速い）
const [usersResult, facilitiesResult, classesResult] = await Promise.all([
  supabase.from('m_users').select('*'),
  supabase.from('m_facilities').select('*'),
  supabase.from('m_classes').select('*'),
]);
```

**適用例**:
- `lib/auth/session.ts`: getUserSession内の3クエリ
- `app/api/attendance/utils/attendance.ts`: fetchAttendanceContext内の3クエリ
- `app/api/dashboard/summary/route.ts`: 後半の4クエリ

### 2. ループ内検索のMap変換（O(n²)→O(n)最適化）
ループ内で`find()`や`filter()`を使う場合、事前にMapに変換してO(1)でアクセスする。

```typescript
// ❌ BAD: O(n²) - 児童100人 × 全配列検索
children.map(child => {
  const schedule = schedules.find(s => s.child_id === child.id);  // O(n)
  const attendance = attendances.find(a => a.child_id === child.id);  // O(n)
  // ...
});

// ✅ GOOD: O(n) - 事前にMapに変換
const scheduleMap = new Map(schedules.map(s => [s.child_id, s]));
const attendanceMap = new Map(attendances.map(a => [a.child_id, a]));

children.map(child => {
  const schedule = scheduleMap.get(child.id);  // O(1)
  const attendance = attendanceMap.get(child.id);  // O(1)
  // ...
});
```

**1対多の場合のグループ化**:
```typescript
// 1つのchild_idに複数レコードがある場合
const logsMap = new Map<string, Log[]>();
for (const log of logs) {
  const existing = logsMap.get(log.child_id) || [];
  existing.push(log);
  logsMap.set(log.child_id, existing);
}
```

### 3. パフォーマンス問題の診断チェックリスト
APIが遅い場合、以下を確認する：

1. **SQLクエリ回数**: 順次実行されているクエリを並列化できないか？
2. **O(n²)ループ**: ループ内で`find/filter`を使っていないか？Mapに変換できないか？
3. **不要なデータ取得**: `select('*')`ではなく必要なカラムのみ取得しているか？
4. **N+1問題**: ループ内でクエリを発行していないか？JOINやINで一括取得できないか？
