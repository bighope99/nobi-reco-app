# AGENTS — NobiReco

Use this handbook whenever you update the のびレコ child-growth recording app.

## Product Snapshot
- Next.js 13 App Router + TypeScript with shadcn/ui primitives under `components/ui`.
- Two personas: **staff/facility users** (routes under `/dashboard`, `/children`, `/records`, `/attendance`, `/settings`, `/data`) and **site administrators** (routes under `/admin/**`).
- Mock content lives in `lib/mock-data.ts`; extend these exports when you need additional seed data.

## Implementation Guardrails
- Wrap new staff views with `StaffLayout` and admin views with `AdminLayout` so the shared sidebar/header render correctly. Set `title`/`subtitle` props using Japanese text.
- Favor composition with existing UI primitives (`Card`, `Button`, `Input`, `Badge`, etc.) and Tailwind utility classes already used in the repo. Avoid raw HTML buttons/inputs so theming stays consistent.
- Maintain the routing conventions already in `app/`: list pages at `/section`, creation at `/section/new`, detail at `/section/[id]`, edit at `/section/[id]/edit`.
- Keep copy concise and in Japanese; reuse domain terms like "児童", "記録", "出席" to maintain tone.

## Working Agreements
- When scaffolding new features, document any project-specific rules in `.cursor/rules/` and keep this file updated.
- Prefer lightweight mock-backed flows over dynamic data until real APIs exist; surface TODO comments if API contracts are missing.
- Run relevant Next.js or lint commands before shipping significant UI work, and capture manual testing steps in PR summaries.
