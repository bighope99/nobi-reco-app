# 04_api.md

## 1. 基本設計方針

### 1.1 通信プロトコル
*   **Base URL**: `/api/v1` (Next.js API Routes) または Supabase JS Client経由の直接アクセス。
*   **通信方式**: HTTPS (JSON形式)
*   **認証方式**: Bearer Token (Supabase Authが発行するJWTヘッダーを使用)

### 1.2 レスポンス共通フォーマット
APIからのレスポンスは原則として以下のJSON形式で統一する。

```json
{
  "success": true,
  "data": { ... },       // 成功時のデータ
  "error": {             // 失敗時のみ
    "code": "ERROR_CODE",
    "message": "ユーザー向けのエラーメッセージ"
  }
}
```

---

## 2. エンドポイント一覧

### 2.1 認証・ユーザー (Auth & User)
ユーザーの所属や権限を確認するためのAPI。

| メソッド | エンドポイント | 概要 | リクエスト例 / 備考 |
| :--- | :--- | :--- | :--- |
| `GET` | `/me` | ログイン中のユーザー情報、所属施設、権限を取得 | |
| `PUT` | `/me/profile` | ユーザープロフィールの更新 | |
| `POST` | `/auth/switch-facility` | (複数施設所属時) アクティブな施設IDを切り替え | Body: `{ "facility_id": "uuid" }` |
| `POST` | `/auth/login` | ログイン処理（Supabase Auth） | Body: `{ "email": "...", "password": "..." }` |
| `POST` | `/auth/logout` | ログアウト処理 | |

### 2.2 セッションデータ構造 (Session Data)
フロントエンドで保持するユーザーセッション情報の定義。

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

### 2.2 マスタデータ (Master Data)
記録画面のドロップダウンやサジェスト表示に使用。

| メソッド | エンドポイント | 概要 | リクエスト例 / 備考 |
| :--- | :--- | :--- | :--- |
| `GET` | `/facilities/{id}/classes` | クラス一覧を取得 | |
| `GET` | `/facilities/{id}/children` | 児童マスタ一覧を取得 | メンションサジェスト用。<br>Res: `[{id, name, kana, class_id, icon_url}]` |
| `GET` | `/facilities/{id}/tags` | 評価タグマスタを取得 | Res: `[{id, name, category}]` |

### 2.3 記録・AI解析 (Records & AI) **【重要】**
のびレコのコア機能。AI解析から保存までのフロー。

| メソッド | エンドポイント | 概要 | 詳細・パラメータ |
| :--- | :--- | :--- | :--- |
| `POST` | `/ai/extract` | **AI解析実行**<br>文章から個別記録案を生成して返す（保存はしない）。 | **Req:**<br>`{ "text": "活動内容...", "mentions": ["child_id_1", "child_id_2"] }`<br>**Res:**<br>`{ "results": [{ "child_id": "...", "fact": "...", "comments": "...", "suggested_tags": [1, 3] }] }` |
| `POST` | `/activities` | **活動記録の保存**<br>親となる活動記録と、紐づく個別記録をまとめて保存（トランザクション）。 | **Req:**<br>`{ "content": "...", "class_id": "...", "photos": [...], "individual_records": [...] }`<br>※確認画面で確定したデータを受け取る。 |
| `GET` | `/activities` | 活動記録の一覧取得（タイムライン） | Query: `?date=2025-11-01&class_id=...` |
| `GET` | `/activities/{id}` | 特定の活動記録の詳細取得 | |
| `PUT` | `/activities/{id}` | 活動記録の修正 | |
| `DELETE` | `/activities/{id}` | 活動記録の削除 | 紐づく個別記録も論理削除 |

### 2.4 個別記録・ダッシュボード (Individual & Dashboard)
成長の可視化に使用するデータ取得。

| メソッド | エンドポイント | 概要 | リクエスト例 / 備考 |
| :--- | :--- | :--- | :--- |
| `GET` | `/children/{id}/records` | 特定児童の個別記録履歴を取得 | 児童詳細ページ用。<br>Query: `?limit=20&offset=0` |
| `GET` | `/children/{id}/stats` | 成長グラフ用データ取得 | 指定期間内のタグ集計数を返却。<br>Query: `?start=2025-04&end=2025-10` |
| `GET` | `/dashboard/daily-check` | 今日の記録状況確認 | クラス全員に対し「記録あり/なし」の状態リストを返す。 |

### 2.5 ファイル・その他 (Files & Utils)
画像やPDF関連。

| メソッド | エンドポイント | 概要 | リクエスト例 / 備考 |
| :--- | :--- | :--- | :--- |
| `POST` | `/storage/upload-url` | 画像アップロード用の署名付きURLを取得 | クライアントから直接StorageへアップロードさせるためのURL発行。 |
| `POST` | `/reports/generate` | 成長レポートPDF作成リクエスト | 非同期処理。完了後にダウンロードURLを通知または返却。 |

---

## 3. 主要データ構造（Payload定義）

### AI解析リクエスト (`POST /ai/extract`)
フロントエンドからAIへ投げるデータの形。

```json
{
  "text": "今日は@りゅうくん がカプラで高く積み上げることに挑戦していました。途中で崩れても「もう一回！」と言ってあきらめずに取り組んでいました。",
  "mentions": [
    { "id": "uuid-ryu-001", "name": "りゅうくん", "age": 5 }
  ],
  "config": {
    "mode": "standard" // 将来的なモード拡張用
  }
}
```

### AI解析レスポンス（個別記録ドラフト案）
AIから返ってきて、フロントエンドの確認画面（ポップアップ）に表示するデータ構造。

```json
{
  "candidates": [
    {
      "child_id": "uuid-ryu-001",
      "extracted_fact": "カプラで高く積み上げることに挑戦した。途中で崩れても再挑戦していた。",
      "generated_comment": "失敗しても諦めない粘り強さが見られました。",
      "recommended_tags": ["id-nintai", "id-chosen"], // 忍耐力, 挑戦
      "confidence_score": 0.95
    }
  ]
}
```

### 記録確定リクエスト (`POST /activities`)
ユーザーが確認・修正した後、最終的にDBへ保存するデータ構造。

```json
{
  "class_id": "uuid-class-001",
  "date": "2025-11-01",
  "content": "今日は@りゅうくん が...", 
  "photo_urls": ["https://...", "https://..."],
  "individual_records": [
    {
      "child_id": "uuid-ryu-001",
      "fact": "カプラで高く積み上げることに挑戦した...", // ユーザー修正後の値
      "comment": "失敗しても諦めない...",
      "tag_ids": ["id-nintai", "id-chosen"]
    }
  ]
}
```

---

## 4. エラーハンドリング方針

*   **400 Bad Request**: 必須パラメータ不足、写真枚数超過（6枚以上など）。
*   **401 Unauthorized**: ログインしていない、トークン期限切れ。
*   **403 Forbidden**: 別の施設のデータにアクセスしようとした（RLSでブロック）。
*   **429 Too Many Requests**: 短時間にAI生成を連打した場合のレートリミット。
*   **500 Internal Server Error**: AI APIのダウン、DB接続エラーなど。
