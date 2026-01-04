# Change: Add password setup page with Supabase magic link

## Why
- Staff can set or reset their password via an emailed Supabase magic link.
- Provide a guided setup flow that redirects to the staff dashboard on completion.

## What Changes
- Add a `/password/setup` page that accepts Supabase magic link tokens and allows a new password to be set.
- Validate password and confirmation before submitting.
- Redirect to `/dashboard` after a successful password update.
- Add Playwright E2E coverage for the password setup flow.

## Impact
- Affected specs: `specs/password-setup/spec.md`
- Affected code: `app/password/setup/page.tsx`, Playwright config and tests