---
name: supabase-rls-debug
description: Supabase RLS（Row Level Security）起因のエラーを診断・修正するスキル。API ルートで「User not found」「404」「500」が出たとき、createClient と createAdminClient の使い分けで迷ったとき、SUPABASE_SERVICE_ROLE_KEY 関連のエラーが出たとき、PGRST116 や 42703 エラーコードが出たときに必ず参照すること。
---

# Supabase RLS デバッグスキル

API ルートで予期しない 404 / 500 が発生した際に、RLS 起因かどうかを素早く判断して修正するためのガイド。

## 診断フロー

### Step 1: エラーコードを確認する

Vercel / console.error のログから `error.code` を取得する。

| コード | 意味 | 最初に疑うべきこと |
|--------|------|-------------------|
| `42703` | カラムが存在しない | SELECT 句のカラム名ミス |
| `PGRST116` | 行が見つからない（0 件） | RLS でフィルタされた / データが本当にない |
| `42501` | 権限エラー | RLS ポリシーが INSERT/UPDATE をブロック |
| その他 500 | 接続障害・初期化エラー | `SUPABASE_SERVICE_ROLE_KEY` 未設定の可能性 |

```typescript
// エラーコードは必ずログに出す
const { data, error } = await supabase.from('m_users').select(...).single();
if (error) {
  console.error('DB error:', { code: error.code, message: error.message });
}
```

### Step 2: コード `42703`（カラム不存在）

**症状**: `column m_users.xxx does not exist`

SELECT 句に存在しないカラムを指定している。`.single()` がエラーを返し、`if (error || !data)` の分岐で 404 を返してしまうため、「User not found」に見える。

**修正**: `docs/03_database.md` で実際のカラム名を確認し、SELECT 句を修正する。

```typescript
// NG: 存在しないカラム
.select('id, name, role, company_id, email, password_set')

// OK: 実在するカラムだけ指定
.select('id, name, role, company_id, email')
```

> **注意**: RLS を疑う前にまずここを確認する。404 の大半はこれが原因。

### Step 3: コード `PGRST116`（行なし）

`.single()` は 0 件のとき `PGRST116` を返す。原因は2つ：

**A) データが本当に存在しない** → データを確認して終わり

**B) RLS がフィルタしている** → 現在のユーザーの JWT では見えない行がある

RLS フィルタか確認する方法：
1. `createAdminClient()` で同じクエリを試す（RLS バイパス）
2. 返ってくれば RLS が原因
3. 返らなければデータ不存在が原因

### Step 4: 500 エラー（`SUPABASE_SERVICE_ROLE_KEY` 未設定）

`createAdminClient()` を使うルートがすべて 500 になる場合、本番/プレビュー環境に `SUPABASE_SERVICE_ROLE_KEY` が設定されていない可能性がある。

**確認**: Vercel のプロジェクト設定 → Environment Variables で `SUPABASE_SERVICE_ROLE_KEY` を確認。

---

## createClient vs createAdminClient の使い分け

```
createClient()       → RLS 有効（ユーザーの JWT を使用）
createAdminClient()  → RLS バイパス（service_role キーを使用）
```

### createClient() を使う場面（デフォルト）

- 通常の SELECT / UPDATE / DELETE
- RLS ポリシーがユーザーの権限に沿って動作するケース
- 認証済みユーザーが自分のデータを操作するとき

### createAdminClient() を使う場面

| 操作 | 理由 |
|------|------|
| `auth.admin.inviteUserByEmail()` | auth スキーマは service_role 必須 |
| `auth.admin.deleteUser()` | 同上 |
| RLS INSERT ポリシーでブロックされる INSERT | ポリシーの想定外ロールからの作成 |
| site_admin が全テナントのデータを横断操作 | RLS SELECT ポリシーを意図的にバイパス |

### オンデマンド初期化を徹底する

```typescript
// NG: トップレベルで初期化（SUPABASE_SERVICE_ROLE_KEY 未設定環境で全リクエストが 500 になる）
export async function PUT(req: Request) {
  const supabaseAdmin = await createAdminClient(); // ← 常に実行される
  const supabase = await createClient();
  ...
}

// OK: 必要なブロック内だけで初期化
export async function PUT(req: Request) {
  const supabase = await createClient();
  ...
  // メール招待が必要なときだけ admin client を生成
  if (body.email && !existingEmail) {
    const supabaseAdmin = await createAdminClient();
    await supabaseAdmin.auth.admin.inviteUserByEmail(body.email);
  }
}
```

---

## このプロジェクトの RLS ポリシー概要

`supabase/migrations/20260327000000_add_rls_to_core_tables.sql` を参照。

### m_users

| 操作 | 許可される条件 |
|------|---------------|
| SELECT | 自分自身 / site_admin / company_admin（同社） / 同一施設メンバー |
| INSERT | facility_admin・company_admin（自社のみ）/ site_admin |
| UPDATE | 自分自身 / facility_admin / company_admin / site_admin |

**よくはまるパターン**:
- `facility_admin` が新規ユーザーを INSERT → RLS ポリシーの条件に合致するか確認
- `site_admin` が別テナントのユーザーを SELECT → `createAdminClient()` が必要な場合がある

---

## クイックチェックリスト

エラーを調査する前に以下を確認する：

- [ ] `console.error` で `error.code` をログに出しているか
- [ ] SELECT 句のカラム名は `docs/03_database.md` と一致しているか（`42703` 防止）
- [ ] `createAdminClient()` はトップレベルではなくオンデマンドで呼んでいるか
- [ ] Vercel の全環境（Production / Preview）に `SUPABASE_SERVICE_ROLE_KEY` が設定されているか
- [ ] `PGRST116` が出た場合、RLS フィルタか本当の不存在かを切り分けたか
