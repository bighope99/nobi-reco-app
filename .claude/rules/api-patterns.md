---
paths:
  - "app/api/**"
  - "__tests__/api/**"
---
# API Patterns

## 認証（IMPORTANT）

NEVER use `supabase.auth.getSession()` in API routes. Always use `getAuthenticatedUserMetadata()`.

```ts
// ✅
import { getAuthenticatedUserMetadata, hasPermission } from '@/lib/auth/jwt';
const metadata = await getAuthenticatedUserMetadata();
if (!metadata) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

// ❌ 禁止
const { data: { session } } = await supabase.auth.getSession();
```

`JWTMetadata`: `{ user_id, role, company_id, current_facility_id }`
- `site_admin` / `company_admin` は `current_facility_id` が null になりうる
- 権限チェック: `hasPermission(metadata, ['facility_admin', 'staff'])`

## Supabase クライアント

```ts
// ✅
import { createClient } from '@/utils/supabase/server';
// ❌
import { createClient } from '@/lib/supabase/server';
```

## Next.js 15 — 非同期 params

```ts
// ✅
export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
}
// ❌ Next.js 15 では型エラー
export default async function Page({ params }: { params: { id: string } }) {}
```

## 入力バリデーション

```ts
// UUID検証
import { isValidUUID } from '@/lib/utils/validation';
if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

// XSSサニタイズ
import { sanitizeText, sanitizeObjectFields } from '@/lib/security/sanitize';
```

## その他

**メンション表示**: 記録本文の `child:childId` は表示前に変換
```ts
import { replaceChildIdsWithNames } from '@/lib/mention/mentionFormatter';
```

**再招待メール**: `email_confirmed_at` があるユーザーに `type: 'invite'` は使えない
```ts
const type = user.email_confirmed_at ? 'magiclink' : 'invite';
```
