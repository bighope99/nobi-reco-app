---
name: supabase-admin-client
description: Use when implementing or reviewing code that uses createAdminClient() or Supabase service role key in Next.js API routes. Critical for preventing RLS bypass failures — @supabase/ssr の createServerClient は service role key を渡してもcookieのユーザーセッションが優先されRLSが効いてしまう。createAdminClient を新規実装・レビュー・デバッグするとき、または「管理者APIからデータが返らない」「RLSが効いているはずなのに意図しないフィルタが掛かる」と感じたときは必ずこのスキルを参照すること。
---

# Supabase Admin Client — RLS バイパスのパターン

## The Pitfall: `createServerClient` (SSR) does NOT bypass RLS

### Wrong pattern (causes RLS to apply unexpectedly)

```typescript
// utils/supabase/server.ts — WRONG for admin use
export async function createAdminClient() {
    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { cookies: { get: (name) => cookieStore.get(name)?.value, ... } }
    );
}
```

**Why it fails:**

1. `createServerClient` reads the user's JWT from cookies
2. Calls `auth.setSession()` internally with the user's session
3. Subsequent DB queries run as `authenticated` role (not `service_role`)
4. RLS policies apply — rows filtered by the logged-in user's `current_facility_id`

### Correct pattern — use `@supabase/supabase-js` directly

```typescript
// utils/supabase/server.ts — CORRECT
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function createAdminClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        }
    );
}
```

**Why this works:**

- Does NOT read cookies — no user session override
- Service role JWT contains `"role": "service_role"` claim
- PostgreSQL executes as `service_role` — bypasses all RLS policies

## When to use `createAdminClient`

- `auth.admin.createUser()` / `auth.admin.deleteUser()` / `auth.admin.listUsers()`
- Queries that need to read/write data across ALL facilities/companies, not just the logged-in user's
- Cross-company operations (e.g., site_admin viewing any company's data)

## When NOT to use `createAdminClient`

- Regular user-scoped queries — use `createClient()` (anon key + cookies) instead
- RLS is intentional protection for those queries

## Symptom of the bug

If you see data filtered by `current_facility_id` in an admin API that should return all facilities, suspect `createServerClient` + service role key combination.
