# API Patterns

## 認証（最重要）

API Route で認証情報を取得するときは必ず `getAuthenticatedUserMetadata()` を使う。
`supabase.auth.getSession()` を直接 API Route で使ってはいけない（セキュリティ警告が出る）。

```ts
// ✅ 正しい
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
const metadata = await getAuthenticatedUserMetadata();
if (!metadata) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

// ❌ 禁止
const { data: { session } } = await supabase.auth.getSession();
```

`JWTMetadata` の型: `{ user_id, role, company_id, current_facility_id }`
- `site_admin` / `company_admin` は `current_facility_id` が null になりうる

権限チェックは `hasPermission(metadata, ['facility_admin', 'staff'])` を使う（`@/lib/auth/jwt`）。

## Supabase クライアントのインポートパス

```ts
// ✅ 正しい
import { createClient } from '@/utils/supabase/server';

// ❌ 間違い（存在しないパス）
import { createClient } from '@/lib/supabase/server';
```

## Next.js 15 — 非同期 params

Page / Route Handler の `params` は Promise 型。必ず `await` する。

```ts
// ✅ 正しい
export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
}

// ❌ 古い書き方（Next.js 15 では型エラー）
export default async function Page({ params }: { params: { id: string } }) {
  const { id } = params;
}
```

## メンション表示

記録本文に含まれる `child:childId` 形式のメンションは、表示前に必ず名前に変換する。

```ts
import { replaceChildIdsWithNames } from '@/lib/mention/mentionFormatter';
```

## 再招待メール（generateLink）

`email_confirmed_at` があるユーザーに `type: 'invite'` を使うとエラーになる。動的に切り替える。

```ts
const type = user.email_confirmed_at ? 'magiclink' : 'invite';
await adminSupabase.auth.admin.generateLink({ type, email });
```
