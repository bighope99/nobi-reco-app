# Cursor Rulebook — NobiReco

## Layout & Routing
- Build pages under the Next.js App Router (`app/`) tree; do not add `pages/`.
- Use the provided layout wrappers so the sidebar/header stay consistent:
  - `StaffLayout` for facility/staff features (`/dashboard`, `/children`, `/records`, etc.).
  - `AdminLayout` for site-wide administration (`/admin/**`).
- Each layout expects a `title` and optional `subtitle`; set them with the Japanese labels used in the UI.
- Example:
  ```tsx
  export default function AttendanceListPage() {
    return (
      <StaffLayout title="出席児童一覧" subtitle="本日の出席状況">
        {/* page content */}
      </StaffLayout>
    )
  }
  ```

## UI Components & Styling
- Reuse the shadcn-derived primitives in `components/ui` (e.g., `Button`, `Card`, `Input`, `Badge`) instead of raw HTML elements so typography and spacing stay aligned.
- Compose layouts with Tailwind classes; follow existing density (cards with `space-y-6`, grids with responsive `sm:`/`lg:` modifiers).
- When adding interactive elements that should look like links, wrap shadcn buttons with `Link` via `asChild` rather than styling `<a>` tags manually.

## Data & Mocking
- Primary backend services live in the Supabase project `stg_nonroco`; align env vars/secrets with that instance when wiring API calls.
- Temporary datasets live in `lib/mock-data.ts`. Import from there for list/detail views instead of redefining mock arrays inside pages.
- If you need extra mock entries, extend the relevant export in `lib/mock-data.ts` so the entire app shares the same fixtures.

## Copy & Localization
- The product copy is Japanese; keep new labels, headings, and helper text in Japanese and align with existing terminology (e.g., "児童", "記録", "出席").
- Prefer concise phrases that fit within card headings; test at common breakpoints (sm, lg) when adding longer text.

## Navigation & URLs
- Follow the established routing pattern:
  - Collection pages at `/section` (e.g., `/children`).
  - Creation forms under `/section/new`.
  - Editing routes under `/section/[id]/edit`.
- Update the sidebar navigation (`components/layout/sidebar.tsx`) whenever you add a top-level section so staff/admin users can reach the new page.
