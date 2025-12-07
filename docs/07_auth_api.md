# 認証API仕様書

## 概要
のびレコの認証システムは、Supabase Authを使用し、メール/パスワード認証を実装しています。

## 認証フロー

```
1. ユーザーがログインフォームにメール/パスワードを入力
   ↓
2. クライアントがSupabase Authでログイン
   ↓
3. 認証成功後、セッション情報取得APIを呼び出し
   ↓
4. UserSessionデータをsessionStorageに保存
   ↓
5. ロールに応じてダッシュボードまたは管理画面にリダイレクト
```

## エンドポイント一覧

### 1. セッション情報取得

**エンドポイント**: `POST /api/auth/session`

**説明**: Supabase認証後、ユーザーの詳細情報（施設、クラス、権限など）を取得します。

**リクエスト**:
```json
{
  "user_id": "uuid-here"
}
```

**レスポンス** (成功):
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "staff@example.com",
  "name": "田中太郎",
  "role": "staff",
  "company_id": "123e4567-e89b-12d3-a456-426614174000",
  "company_name": "株式会社のびレコ",
  "facilities": [
    {
      "facility_id": "789e0123-e89b-12d3-a456-426614174000",
      "facility_name": "のびのび学童クラブ",
      "is_primary": true
    }
  ],
  "current_facility_id": "789e0123-e89b-12d3-a456-426614174000",
  "classes": [
    {
      "class_id": "456e7890-e89b-12d3-a456-426614174000",
      "class_name": "ひまわり組",
      "facility_id": "789e0123-e89b-12d3-a456-426614174000",
      "is_homeroom": true
    }
  ]
}
```

**エラーレスポンス**:
- `401 Unauthorized`: 認証されていない
- `403 Forbidden`: リクエストされたuser_idとトークンのIDが不一致
- `404 Not Found`: ユーザーデータが見つからない（m_usersに存在しない、またはis_active=false）
- `500 Internal Server Error`: サーバーエラー

---

### 2. ログアウト

**エンドポイント**: `POST /api/auth/logout`

**説明**: Supabaseセッションをクリアし、ログアウトします。

**リクエスト**: なし

**レスポンス** (成功):
```json
{
  "success": true
}
```

**エラーレスポンス**:
- `500 Internal Server Error`: ログアウト処理に失敗

**クライアント側の処理**:
```typescript
// LogoutButtonコンポーネントを使用
import { LogoutButton } from '@/components/LogoutButton';

// 使用例
<LogoutButton />
<LogoutButton variant="outline" size="sm" />
<LogoutButton showIcon={false} />
```

**手動でログアウト処理を実装する場合**:
```typescript
const handleLogout = async () => {
  const supabase = createClient();

  // Supabaseセッションをクリア
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Logout error:', error);
    return;
  }

  // sessionStorageをクリア
  sessionStorage.removeItem('user_session');

  // ログインページへリダイレクト
  router.push('/login');
};
```

---

## セッションデータ構造

### UserSession インターフェース

```typescript
interface UserSession {
  // 基本情報
  user_id: string;              // UUID (auth.users.id と同じ)
  email: string;                // メールアドレス
  name: string;                 // 氏名
  role: 'site_admin' | 'company_admin' | 'facility_admin' | 'staff';

  // 組織情報
  company_id: string | null;    // 所属会社（site_adminはnull）
  company_name: string | null;

  // 施設情報（配列）- 1職員が複数施設を担当可能
  facilities: Array<{
    facility_id: string;
    facility_name: string;
    is_primary: boolean;        // 主担当施設か
  }>;

  // 現在選択中の施設（画面で切り替え可能）
  current_facility_id: string | null;

  // クラス情報（配列）
  classes: Array<{
    class_id: string;
    class_name: string;
    facility_id: string;        // どの施設のクラスか
    is_homeroom: boolean;       // 担任か
  }>;
}
```

---

## ロール別アクセス権限

| ロール | 説明 | アクセス可能な画面 |
|--------|------|-------------------|
| `site_admin` | サイト管理者（全システム管理） | 全ての画面 |
| `company_admin` | 会社管理者（自社の全施設管理） | /admin（自社のみ）、/dashboard |
| `facility_admin` | 施設管理者（自施設のみ管理） | /admin（自施設のみ）、/dashboard |
| `staff` | 一般職員（記録入力のみ） | /dashboard、/records、/children |

---

## セキュリティ考慮事項

### 1. 認証トークン
- Supabase AuthのJWTトークンを使用
- トークンはHTTP-only cookieに保存（Supabaseが自動管理）
- 有効期限: 8時間（Supabase設定）

### 2. セッションストレージ
- UserSessionデータは`sessionStorage`に保存
- ブラウザタブを閉じると自動削除
- XSS対策として機密情報（パスワード等）は保存しない

### 3. API認証
- 全てのAPI RouteでSupabaseセッションを検証
- user_idの不一致を検出（他人のデータアクセス防止）

### 4. RLS (Row Level Security)
- Supabaseデータベースレベルで施設・クラス単位のアクセス制御
- ユーザーが所属していない施設のデータは取得不可

---

## クライアント実装例

### ログイン処理
```typescript
const handleLogin = async (email: string, password: string) => {
  const supabase = createClient();

  // 1. Supabase Auth でログイン
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // 2. セッション情報を取得
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: authData.user.id }),
  });

  const sessionData = await response.json();

  // 3. sessionStorage に保存
  sessionStorage.setItem("user_session", JSON.stringify(sessionData));

  // 4. リダイレクト
  if (sessionData.role === "site_admin" || sessionData.role === "company_admin") {
    router.push("/admin");
  } else {
    router.push("/dashboard");
  }
};
```

### セッション取得（useSession hook）
```typescript
export function useSession(): UserSession | null {
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('user_session');
      if (stored) {
        try {
          setSession(JSON.parse(stored));
        } catch (e) {
          sessionStorage.removeItem('user_session');
        }
      }
    }
  }, []);

  return session;
}
```

### ログアウト処理（LogoutButtonコンポーネント）
```typescript
import { LogoutButton } from '@/components/LogoutButton';

// 基本的な使用
<LogoutButton />

// カスタマイズ例
<LogoutButton
  variant="outline"    // ボタンのスタイル
  size="sm"            // ボタンのサイズ
  showIcon={false}     // アイコンを非表示
  className="ml-auto"  // カスタムクラス
/>
```

**LogoutButton Props**:
- `variant`: `'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'` (デフォルト: `'destructive'`)
- `size`: `'default' | 'sm' | 'lg' | 'icon'` (デフォルト: `'default'`)
- `className`: カスタムCSSクラス
- `showIcon`: アイコンの表示/非表示 (デフォルト: `true`)

**機能**:
- ローディング状態の表示
- エラーハンドリング（失敗時はアラート表示）
- SupabaseセッションとsessionStorageの両方をクリア
- ログイン画面へ自動リダイレクト

### 手動でログアウト処理を実装する場合
```typescript
const handleLogout = async () => {
  const supabase = createClient();

  // Supabaseセッションをクリア
  await supabase.auth.signOut();

  // sessionStorageをクリア
  sessionStorage.removeItem('user_session');

  // ログイン画面へ
  router.push('/login');
};
```

---

## データベース要件

### m_users テーブル
```sql
CREATE TABLE m_users (
  id UUID PRIMARY KEY,  -- auth.users.id と同じ値
  company_id UUID REFERENCES m_companies(id),
  name VARCHAR(100) NOT NULL,
  name_kana VARCHAR(100),
  email VARCHAR(255) NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'staff',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_retired BOOLEAN NOT NULL DEFAULT false,
  retired_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
```

### _user_facility テーブル（多対多）
```sql
CREATE TABLE _user_facility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES m_users(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES m_facilities(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, facility_id)
);
```

### _user_class テーブル（多対多）
```sql
CREATE TABLE _user_class (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES m_users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES m_classes(id) ON DELETE CASCADE,
  is_homeroom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, class_id)
);
```

---

## トラブルシューティング

### ログインできない
1. `.env.local`の環境変数を確認
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Supabaseダッシュボードでユーザーが作成されているか確認
3. `m_users`テーブルに対応レコードが存在するか確認
4. `is_active = true`かつ`deleted_at IS NULL`か確認

### セッション情報が取得できない
1. `_user_facility`テーブルにユーザーと施設の紐付けがあるか確認
2. `m_facilities`の`is_active`が`true`か確認
3. ブラウザのコンソールでエラーログを確認

### ロール権限が正しく動作しない
1. `m_users.role`の値を確認（ENUM型: site_admin, company_admin, facility_admin, staff）
2. middlewareで適切にロールチェックされているか確認

---

**作成日**: 2025-01-XX
**最終更新**: 2025-01-XX
**管理者**: プロジェクトリーダー
