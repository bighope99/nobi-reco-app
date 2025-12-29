# JWT Custom Claims 実装完了

## 実装内容

JWT カスタムクレームを使用して、API実行時のDB問い合わせを削減しました。

### 変更されたファイル

1. **マイグレーション**
   - `supabase/migrations/005_create_jwt_custom_claims_hook.sql`
   - PostgreSQL関数 `custom_access_token_hook` を作成

2. **ヘルパー関数**
   - `lib/auth/jwt.ts`
   - `getAuthenticatedUserMetadata()`: JWTからメタデータを取得
   - `hasPermission()`: 権限チェックヘルパー

3. **API修正**
   - `app/api/users/route.ts` (GET/POST)
   - DB問い合わせを削減（2クエリ削減）

4. **ドキュメント**
   - `docs/jwt-custom-claims-setup.md`
   - セットアップ手順とトラブルシューティング

## パフォーマンス改善

### 従来の実装
```
ログイン時: DB 3クエリ
各API実行: DB 2クエリ（role確認 + facility取得）
合計: 5クエリ
```

### 新しい実装
```
ログイン時: DB 3クエリ → JWTに埋め込み
各API実行: DB 0クエリ（JWTから取得）
合計: 3クエリ（40%削減）
```

## セットアップ手順

### 1. マイグレーションの実行

Supabase Dashboard で以下のSQLを実行:

1. https://supabase.com/dashboard/project/biwqvayouhlvnumdjtjb/sql にアクセス
2. `supabase/migrations/005_create_jwt_custom_claims_hook.sql` の内容をコピー＆実行

### 2. Supabase Hooks の設定（重要）

**この設定をしないとJWTにメタデータが含まれません！**

1. https://supabase.com/dashboard/project/biwqvayouhlvnumdjtjb/database/hooks にアクセス
2. "Create a new hook" をクリック
3. 以下の設定:
   ```
   Name: Custom Access Token Hook
   Table: なし
   Events: Custom Access Token (auth.jwt を選択)
   Type: SQL Function
   Function: public.custom_access_token_hook
   ```
4. "Confirm" をクリック

### 3. 動作確認

#### 3.1 ログインしてトークンを確認

1. アプリにログイン
2. DevTools > Application > Session Storage > `user_session` を確認
3. ブラウザのコンソールで以下を実行:

```javascript
// アクセストークンを取得
const supabase = createClient();
const { data } = await supabase.auth.getSession();
console.log(data.session.access_token);

// https://jwt.io でデコードして、app_metadata に以下が含まれているか確認:
// - role
// - company_id
// - current_facility_id
```

#### 3.2 API動作確認

1. `/api/users` にアクセス
2. Supabase Dashboard > Logs で以下のクエリが**実行されていないこと**を確認:
   - `SELECT role, company_id FROM m_users WHERE id = ...`
   - `SELECT facility_id FROM _user_facility WHERE user_id = ...`

## トラブルシューティング

### app_metadata が空の場合

- Supabase Hooks が正しく設定されているか確認
- 一度ログアウトして再ログイン（新しいトークンが発行される）

### 詳細なトラブルシューティング

`docs/jwt-custom-claims-setup.md` を参照してください。

## 今後の対応

他のAPIファイルも同様のパターンを使用しているため、順次移行を推奨:

- [ ] `app/api/users/[id]/route.ts`
- [ ] `app/api/schools/route.ts`
- [ ] `app/api/schools/[school_id]/route.ts`
- [ ] `app/api/facilities/route.ts`
- [ ] `app/api/facilities/[facility_id]/route.ts`
- [ ] `app/api/classes/route.ts`
- [ ] `app/api/classes/[id]/route.ts`

各ファイルで以下のパターンを置き換え:

```typescript
// 従来
const { data: userData } = await supabase
  .from('m_users')
  .select('role, company_id')
  .eq('id', user.id)
  .single();

const { data: userFacility } = await supabase
  .from('_user_facility')
  .select('facility_id')
  .eq('user_id', user.id)
  .single();

// 新しい実装
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

const metadata = await getAuthenticatedUserMetadata();
if (!metadata) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const { role, company_id, current_facility_id } = metadata;
```

## セキュリティ

- ✅ JWTは署名されているので改ざん不可
- ✅ Supabase Authで検証済み
- ✅ ゼロトラスト原則に準拠
- ✅ クライアントからの入力を信頼しない設計

## パフォーマンス

- ✅ API実行時のDB問い合わせを40%削減
- ✅ スケーラビリティの向上
- ✅ レスポンスタイムの短縮
