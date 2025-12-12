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
# Coding Guidelines
- **Functional Components**: Use React functional components with hooks.
- **Type Safety**: Use strict TypeScript types. Avoid `any`.
- **Server Components**: Default to Server Components in Next.js App Router unless `use client` is required.
- **Styling**: Use Tailwind CSS utility classes.
- **File Structure**: Follow the existing Next.js App Router structure.
- **Supabase Import Path**: ALWAYS use `@/utils/supabase/server` for server-side Supabase client imports in API routes. DO NOT use `@/lib/supabase/server` as it does not exist in this project.
# Authentication & Session Management
- **Authentication**: Use Supabase Auth for email/password authentication
- **Session Storage**: Store UserSession data in sessionStorage after successful login
- **Session Structure**: Follow the UserSession interface defined in `/lib/auth/session.ts`
  - Must include: user_id, email, name, role, company_id, company_name
  - Must include: facilities array, current_facility_id, classes array
- **Session API**: Use `/api/auth/session` POST endpoint to fetch full session data after Supabase auth
- **Protected Routes**: Check Supabase session via middleware before accessing protected pages
- **Logout**: Clear both Supabase session and sessionStorage data
# Critical Rules
- **Aesthetics**: Prioritize premium, modern, and dynamic designs. Use micro-animations and smooth transitions.
- **Performance**: Ensure fast load times and responsive interactions.
- **Security**: Implement RLS in Supabase and proper validation in API routes.