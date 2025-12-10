# 実装状況サマリとページ別To-Do

## 現状把握（2024-11時点コード調査）
- 認証: `/login` は Supabase Auth の `signInWithPassword` でログインし、`/api/auth/session` から `getUserSession` を取得するフローが実装済み。ログアウトは `/api/auth/logout` のみ。権限別の画面ガードや施設スコープの切替は未着手。
- API: Next.js API Routes は認証系2本（session/logout）のみで、業務API（/api/v1 配下想定）は未実装。RLS前提のテナント/施設/クラス絞り込みや共通レスポンスラッパも未整備。
- 画面: サイトマップ上の主要ページは既存だが、`lib/mock-data.ts` のモック配列を参照する静的UIが中心。Supabaseからの読取/書込、バリデーション、ロールベースUI制御は入っていない。
- レイアウト/ナビ: `StaffLayout`/`AdminLayout` によりヘッダー/サイドバーは存在するが、ユーザーセッションに紐づいた施設/クラス選択やロール別メニュー出し分けは未実装。
- 非機能: ログ/レートリミット/MFA/パスワードポリシーなど `docs/00_nonfunctional_requirements_review.md` で求められる対策はまだコードに反映されていない。

## 前提と方針
- 新規ページは作らず、`docs/05_sitemap.md` にある既存ルート配下で機能実装を行う。
- Supabaseスキーマは `docs/03_database.md` と `docs/08_database_additions.md` が反映済みである前提。接続設定は完成しているため、UI/ロジックを Supabase 読み書きに置き換える方針とする。
- 認証・権限は `docs/07_auth_api.md` と `docs/04_api.md`/`docs/09_api_updates_required.md` の役割定義・エンドポイント仕様に従う。
- RLSとテナント階層（会社→施設→クラス）を前提に、APIとUI双方で facility/class 絞り込みを強制する。

## 実装To-Do（ページ/領域別、既存ページのみ）
### 認証・セッション共通
- `/login`:
  - Supabaseエラーコード別のメッセージ出し分けとパスワードポリシー案内を追加。
  - ログイン成功時にロール/施設/クラス情報をセッションストレージではなく安全なクライアントストアに保持し、施設切替APIを用意。
- 共通ミドルウェア/ガード:
  - サーバーコンポーネントでセッションを検証し、`/admin/*` と 施設職員向け `/dashboard` 以降でロールガードを実装。
  - `StaffLayout`/`AdminLayout` に施設/クラス選択UIとロール別メニュー出し分けを追加。セッションの current_facility_id を利用。

### APIレイヤー
- `/api/v1/me`, `/api/v1/facilities`, `/api/v1/classes`, `/api/v1/children`, `/api/v1/tags` などマスタ取得系を実装し、全レスポンスを共通フォーマット化。
- 記録系: `/api/v1/activities` CRUD と `/api/v1/records`（観察・声・個別記録）を、RLS前提で facility/class 絞り込み＋バリデーション付きで実装。
- 出席系: `/api/v1/attendance/schedule`・`/attendance/qr`・`/attendance/list` 用の取得/更新APIを用意し、今日の予定/出席/退席イベントを扱う。
- レポート/保護者系: `docs/08_database_additions.md` に沿って `/api/v1/guardians` と `/api/v1/reports` 系を実装し、`_child_guardian`/`r_report`/`h_report_share` を利用。
- AI補助: `/api/v1/ai/extract` を実装し、PIIマスキングとレートリミットを組み込む。

### 管理者エリア（/admin）
- `/admin` TOP: 会社・施設・利用状況の統計を Supabase 集計に置き換え、システムログ要約を表示。
- `/admin/companies` 一覧/`/admin/companies/new`/`/:id/edit`: CRUD を Supabase 接続化し、`docs/06_database_naming_rules.md` に従ったバリデーションを付与。
- `/admin/facilities` 一覧/新規/編集: 会社フィルターと施設登録/更新を API 経由で実装。RLS考慮でシステム管理者のみアクセス。
- `/admin/users`: 会社横断の閲覧一覧を Supabase から取得し、ロール変更・無効化を可能に。MFA設定状態とロックアウト情報も表示。
- `/admin/logs`: ログイン履歴/監査ログの取得APIを実装し、期間フィルターとテキスト検索を追加。

### ダッシュボード（/dashboard）
- 本日の出席、未記録児童、未帰所アラートを Supabase の attendance/records データから集計。クイックアクションのリンク先を実データ連携に更新。

### 記録管理（/records）
- `/records/status`: 本日記録率・未記録児童一覧を Supabase から取得し、クラス/タグフィルターとソートを実装。
- `/records/activity`: 今日の活動記録の閲覧・保存・写真添付・タグ付け・AI抽出を、`/api/v1/activities` と `/api/v1/ai/extract` を用いたリアルデータに置換。保存後は子ども個別記録への反映も行う。
- `/records/observation/:childId`: 個別観察記録のCRUDとタグ付け、活動記録とのリンクを Supabase 経由で実装。
- `/records/voice/:childId`: 子どもの声記録の登録/編集/削除を API 連携し、本人確認のメタ情報も保存。

### 出席管理（/attendance）
- `/attendance/schedule`: 曜日パターン＋例外を元に今日の予定を表示し、欠席・イレギュラー追加の登録を Supabase 更新に切替。
- `/attendance/qr`: 子どもごとのチェックインQR発行・スキャン処理を Supabase トリガー/サーバーAPI経由に。重複打刻防止と未登録児の警告を表示。
- `/attendance/list`: 本日出席中の子ども一覧をリアルタイム更新し、退室操作と未帰所アラートを Supabase データで表示。

### 子ども管理（/children）
- `/children`: 一覧検索・学年/性別/タグフィルターを Supabase クエリに置換し、施設スコープで絞り込み。
- `/children/:id`: 基礎情報、最近の記録、観点別記録タブを API 連携。`_child_guardian` の保護者表示を追加。
- `/children/:id/summary`: 観点別記録数推移グラフを Supabase 集計で描画。
- `/children/:id/report`: レポート生成・共有履歴保存を `/api/v1/reports` と連携。
- `/children/new`・`/:id/edit`・`/import`: 登録/更新/CSV取り込みを Supabase 書込に対応し、`docs/06_database_naming_rules.md` の命名・制約を検証。

### 設定（/settings）
- `/settings/facility`: 施設情報編集フォームを Supabase 更新とバリデーション付きに置換。
- `/settings/classes`: クラス一覧/作成/編集/削除を API 連携し、担任情報を `_user_class` へ反映。
- `/settings/schedules`: 子ども別曜日通所設定を閲覧・編集できるフォームを Supabase 読み書きに置換。
- `/settings/users`: 施設職員の登録・権限設定・有効/無効切替を Supabase と連携し、招待メールの送信ステータスも表示。

### データ管理（/data/export）
- 期間指定で記録/出席/レポートをCSV出力する API を実装し、ロールチェックとレートリミットを適用。

### セキュリティ/非機能
- `docs/00_nonfunctional_requirements_review.md` に基づき、パスワードポリシー/MFA/ロックアウト/セッション有効期限を実装。
- PIIの暗号化・マスキング、AI連携前の匿名化処理、ログの個人情報抑制を適用。
- 全APIにレートリミットと構造化ログを付与し、Sentry/APMのフックを導入。
