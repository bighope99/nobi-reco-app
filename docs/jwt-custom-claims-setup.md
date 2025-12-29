# JWT Custom Claims セットアップガイド

このドキュメントでは、Supabase の JWT カスタムクレームを設定する手順を説明します。

## 概要

JWT カスタムクレームを使用することで、以下のメリットがあります:
- ✅ API実行時のDB問い合わせを削減（パフォーマンス向上）
- ✅ セキュアな認証（JWTは署名されているので改ざん不可）
- ✅ スケーラビリティの向上（DBへの負荷が減少）

## セットアップ手順

### 1. マイグレーションの実行

`supabase/migrations/005_create_jwt_custom_claims_hook.sql` を実行します。

```bash
# ローカル環境の場合
supabase db reset

# または個別にマイグレーションを実行
supabase migration up
```

本番環境の場合は、Supabase Dashboard から実行:
1. Supabase Dashboard > SQL Editor を開く
2. `supabase/migrations/005_create_jwt_custom_claims_hook.sql` の内容をコピー
3. 実行

### 2. Supabase Hooks の設定

**重要**: この設定は Supabase Dashboard で手動で行う必要があります。

#### 手順:

1. **Supabase Dashboard を開く**
   - https://supabase.com/dashboard/project/biwqvayouhlvnumdjtjb

2. **Database > Hooks に移動**
   - 左サイドバーから "Database" > "Hooks" を選択

3. **新しい Hook を作成**
   - "Create a new hook" ボタンをクリック

4. **Hook の設定**
   ```
   Name: Custom Access Token Hook
   Table: (選択不要)
   Events: Custom Access Token (auth.jwt)
   Type: SQL Function
   Function: public.custom_access_token_hook
   ```

5. **保存**
   - "Confirm" をクリックして保存

### 3. 動作確認

#### 3.1 ログインして JWT を確認

```bash
# ログインAPIを実行
curl -X POST https://your-project.supabase.co/auth/v1/token?grant_type=password \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password"
  }'
```

レスポンスの `access_token` をデコード（https://jwt.io）して、以下のフィールドが含まれていることを確認:

```json
{
  "app_metadata": {
    "role": "staff",
    "company_id": "uuid",
    "current_facility_id": "uuid"
  }
}
```

#### 3.2 API動作確認

```bash
# ユーザー一覧取得（DB問い合わせが削減されているか確認）
curl -X GET https://your-app.com/api/users \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Supabase Dashboard > Logs で、以下のクエリが **実行されていないこと** を確認:
- `SELECT role, company_id FROM m_users WHERE id = ...`
- `SELECT facility_id FROM _user_facility WHERE user_id = ...`

## トラブルシューティング

### app_metadata が空の場合

**原因**: Hook が正しく設定されていない、または実行されていない

**解決策**:
1. Supabase Dashboard > Database > Hooks で設定を確認
2. Hook の種類が "Custom Access Token (auth.jwt)" になっているか確認
3. 一度ログアウトして、再度ログインする（新しいトークンが発行される）

### 施設情報が取得できない場合

**原因**: ユーザーが施設に紐付いていない

**解決策**:
1. `_user_facility` テーブルを確認
2. 該当ユーザーに `is_current = true` のレコードが存在するか確認
3. 必要に応じて施設を紐付ける

### パフォーマンスが改善しない

**確認ポイント**:
1. Supabase Logs で実際のクエリ数を確認
2. `getAuthenticatedUserMetadata()` を使用しているか確認
3. 他のAPIでも同様の修正を適用する

## 移行対象のAPIファイル

以下のファイルで同様のパターンを使用しているため、順次移行を推奨:

- [x] `app/api/users/route.ts`
- [ ] `app/api/users/[id]/route.ts`
- [ ] `app/api/schools/route.ts`
- [ ] `app/api/schools/[school_id]/route.ts`
- [ ] `app/api/facilities/route.ts`
- [ ] `app/api/facilities/[facility_id]/route.ts`
- [ ] `app/api/classes/route.ts`
- [ ] `app/api/classes/[id]/route.ts`
- [ ] その他のAPIファイル

## 参考

- [Supabase Custom Claims Documentation](https://supabase.com/docs/guides/auth/custom-claims-and-role-based-access-control-rbac)
- [JWT.io - Token Decoder](https://jwt.io)
