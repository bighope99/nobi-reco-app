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
