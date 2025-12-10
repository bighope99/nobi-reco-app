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
