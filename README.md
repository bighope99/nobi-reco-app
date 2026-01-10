# のびレコ（Nobi-Reco）

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/bighope99s-projects/v0-nobi-reco-app-development)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=for-the-badge&logo=supabase)](https://supabase.com/)

学童保育の成長記録を可視化し、記録業務を効率化するSaaSアプリケーション

---

## 📋 目次

- [プロジェクト概要](#-プロジェクト概要)
- [主要機能](#-主要機能)
- [技術スタック](#-技術スタック)
- [必要要件](#-必要要件)
- [セットアップ手順](#-セットアップ手順)
- [開発コマンド](#-開発コマンド)
- [プロジェクト構造](#-プロジェクト構造)
- [ドキュメント](#-ドキュメント)
- [テスト](#-テスト)
- [デプロイ](#-デプロイ)
- [ライセンス](#-ライセンス)

---

## 🎯 プロジェクト概要

**のびレコ（Nobi-Reco）** は、学童保育施設向けに設計された成長記録・業務効率化SaaSです。

### コアバリュー

| 価値提供 | 説明 |
|---------|------|
| **記録の統合** | 日々の活動記録から個人の成長記録を自動抽出し、二度手間を解消 |
| **質の標準化** | AIサポートと共通の評価軸（非認知能力タグ）により、指導者の経験値に依存しない評価を実現 |
| **可視化** | 蓄積されたデータをグラフやレポートで可視化し、保護者連携や指導計画へ活用 |

### 解決する課題

- ❌ **記録がバラバラ**: 出欠、ケガ・トラブル、日々の様子が散在
- ❌ **時間不足**: 個別の記録を書く時間がない
- ❌ **感覚頼み**: 成長や変化が「なんとなく」の感覚止まり
- ❌ **保護者との情報共有不足**: 親が学童での子供の様子がわからない

→ ✅ **一元管理** + **AIによる自動記録抽出** + **可視化** で解決

---

## 🚀 主要機能

### 1. 認証・権限管理
- **ロールベースアクセス制御**: システム管理者、企業管理者、施設管理者、職員の4段階権限
- **JWT Custom Claims認証**: 高速な認証・認可処理（DB問い合わせ40%削減）
- **マルチテナント対応**: 1企業が複数施設・複数クラスを管理可能

### 2. 児童管理
- 児童情報の登録・編集・削除
- クラス・グループへの所属管理
- CSVインポート機能
- 成長レポート・サマリー表示

### 3. 記録機能
- **活動記録**: 日々の活動内容を複数視点から記録
- **個別記録**: AI解析による自動抽出と編集
- **観察記録**: 特定児童の詳細な観察メモ
- **音声記録**: 音声入力による効率的な記録作成
- **タグ付け**: 非認知能力タグによる成長の構造化

### 4. 出欠管理
- 出欠スケジュール管理
- QRコード出席チェックイン
- 出欠履歴の閲覧・検索

### 5. ダッシュボード・可視化
- 成長推移のグラフ表示
- タグ別の分析
- 施設全体の統計情報

### 6. 設定・マスタ管理
- 施設・クラス設定
- ユーザー管理
- スケジュール設定
- メール通知設定

### 7. データエクスポート
- CSV形式でのデータ出力
- レポートPDF生成（保護者向け）

---

## 🛠 技術スタック

### フロントエンド
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI, Lucide React
- **Form**: React Hook Form + Zod
- **State Management**: React Hooks
- **Charts**: Recharts
- **QR Code**: ZXing

### バックエンド
- **API**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (JWT Custom Claims)
- **ORM**: Supabase Client (@supabase/supabase-js)
- **AI**: OpenAI GPT-4o-mini, LangChain

### インフラ・デプロイ
- **Hosting**: Vercel
- **Database**: Supabase Cloud
- **Analytics**: Vercel Analytics

### 開発・テスト
- **Testing**: Jest, Playwright
- **Linting**: ESLint
- **Package Manager**: npm

---

## ✅ 必要要件

### 環境
- **Node.js**: 18.x 以上
- **npm**: 9.x 以上
- **Git**: 2.x 以上

### アカウント
- Supabase アカウント（無料プランで開始可能）
- OpenAI API キー（AI機能を使用する場合）
- Vercel アカウント（デプロイする場合）

---

## 🏃 セットアップ手順

### 1. リポジトリのクローン

```bash
git clone https://github.com/bighope99/nobi-reco-app.git
cd nobi-reco-app
```

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.local` ファイルをプロジェクトルートに作成し、以下を設定：

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI (AI機能を使用する場合)
OPENAI_API_KEY=your_openai_api_key

# JWT Secret (Supabase JWT Secret)
JWT_SECRET=your_jwt_secret

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Supabase データベースのセットアップ

#### 4.1 Supabase プロジェクトの作成
1. [Supabase](https://supabase.com/) にアクセスしてプロジェクトを作成
2. プロジェクト設定から接続情報を取得

#### 4.2 マイグレーションの適用

```bash
# Supabase CLI のインストール（初回のみ）
npm install -g supabase

# Supabaseプロジェクトとリンク
supabase link --project-ref your_project_ref

# マイグレーション適用
supabase db push
```

マイグレーションファイルは `supabase/migrations/` ディレクトリに格納されています。

#### 4.3 JWT Custom Claims の設定

JWT Custom Claims認証を使用する場合、Supabase Hooksの設定が必要です。詳細は以下を参照：

- [`docs/jwt-custom-claims-setup.md`](./docs/jwt-custom-claims-setup.md)
- `.claude/skills/supabase-jwt-auth`

### 5. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) にアクセス

---

## 📦 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# プロダクションビルド
npm run build

# プロダクションサーバー起動
npm run start

# Lintチェック
npm run lint

# ユニットテスト実行
npm test

# E2Eテスト実行
npm run test:e2e
```

---

## 📂 プロジェクト構造

```
nobi-reco-app/
├── app/                          # Next.js App Router
│   ├── admin/                    # 管理者機能
│   ├── attendance/               # 出欠管理
│   ├── children/                 # 児童管理
│   ├── dashboard/                # ダッシュボード
│   ├── data/                     # データエクスポート
│   ├── login/                    # ログイン
│   ├── password/                 # パスワード管理
│   ├── records/                  # 記録機能
│   │   ├── activity/            # 活動記録
│   │   ├── observation/         # 観察記録
│   │   ├── personal/            # 個別記録
│   │   ├── status/              # ステータス記録
│   │   └── voice/               # 音声記録
│   ├── settings/                 # 設定
│   ├── api/                      # API Routes
│   └── layout.tsx                # ルートレイアウト
├── components/                   # Reactコンポーネント
│   ├── ui/                      # UIコンポーネント（Radix UI）
│   └── ...                      # 機能別コンポーネント
├── lib/                          # ユーティリティ・ヘルパー
│   ├── auth/                    # 認証関連
│   ├── supabase/                # Supabaseクライアント
│   └── utils.ts                 # 共通ユーティリティ
├── utils/                        # Supabaseユーティリティ
│   └── supabase/
│       └── server.ts            # サーバーサイドSupabaseクライアント
├── docs/                         # ドキュメント
│   ├── 01_requirements.md       # 要件定義
│   ├── 02_architecture.md       # アーキテクチャ
│   ├── 03_database.md           # データベース仕様
│   ├── 04_api.md                # API仕様
│   └── ...                      # その他ドキュメント
├── supabase/                     # Supabase設定
│   └── migrations/              # DBマイグレーション
├── tests/                        # テストファイル
├── .claude/                      # Claude Code設定
│   └── skills/                  # プロジェクト固有スキル
├── CLAUDE.md                     # プロジェクトルール（AI用）
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

---

## 📚 ドキュメント

詳細なドキュメントは `docs/` ディレクトリに格納されています。

| ドキュメント | 説明 |
|------------|------|
| [01_requirements.md](./docs/01_requirements.md) | 要件定義・プロジェクト概要 |
| [02_architecture.md](./docs/02_architecture.md) | アーキテクチャ・設計思想 |
| [03_database.md](./docs/03_database.md) | データベーススキーマ仕様 ⭐ |
| [04_api.md](./docs/04_api.md) | API仕様・エンドポイント一覧 |
| [05_sitemap.md](./docs/05_sitemap.md) | サイトマップ・画面一覧 |
| [06_database_naming_rules.md](./docs/06_database_naming_rules.md) | DB命名規則 |
| [07_auth_api.md](./docs/07_auth_api.md) | 認証API仕様 |
| [jwt-custom-claims-setup.md](./docs/jwt-custom-claims-setup.md) | JWT認証セットアップガイド |
| [migrations_summary.md](./docs/migrations_summary.md) | マイグレーション履歴 |

⭐ **重要**: `03_database.md` はデータベーススキーマの**唯一の信頼できる情報源**です。API実装やクエリ作成時は必ず参照してください。

---

## 🧪 テスト

### ユニットテスト（Jest）

```bash
npm test
```

テストファイルは `__tests__/` または `*.test.ts(x)` として配置。

### E2Eテスト（Playwright）

```bash
# Playwright初回セットアップ
npx playwright install chromium

# E2Eテスト実行
npm run test:e2e
```

テストファイルは `tests/` ディレクトリに配置。

---

## 🚢 デプロイ

### Vercel へのデプロイ

1. Vercel にプロジェクトをインポート
2. 環境変数を設定（`.env.local` の内容をVercelの環境変数に追加）
3. デプロイ実行

```bash
# Vercel CLI でのデプロイ
npx vercel
```

**デプロイURL**: [https://vercel.com/bighope99s-projects/v0-nobi-reco-app-development](https://vercel.com/bighope99s-projects/v0-nobi-reco-app-development)

---

## 🔐 セキュリティ

- **RLS（Row Level Security）**: Supabaseで行レベルセキュリティを適用
- **JWT認証**: Supabase Auth + Custom Claims によるセキュアな認証
- **API検証**: Zodによる入力バリデーション
- **HTTPS**: Vercelで自動的にHTTPS化
- **環境変数**: 機密情報は `.env.local` で管理（Gitにコミットしない）

---

## 🤝 コントリビューション

プロジェクトへの貢献を歓迎します！

### 開発ガイドライン

1. **コーディング規約**: `CLAUDE.md` および `.claude/` 配下のルールに従う
2. **コミット規約**: Conventional Commits に従う
   - `feat:` 新機能
   - `fix:` バグ修正
   - `refactor:` リファクタリング
   - `docs:` ドキュメント更新
3. **テスト**: 新機能には必ずテストを追加
4. **Pull Request**: 変更内容を明確に記載

### ブランチ戦略

- `main`: 本番環境
- `develop`: 開発環境
- `feature/*`: 機能開発
- `fix/*`: バグ修正

---

## 📄 ライセンス

このプロジェクトはプライベートリポジトリです。無断での使用・配布を禁止します。

---

## 📞 サポート・問い合わせ

- **Issues**: [GitHub Issues](https://github.com/bighope99/nobi-reco-app/issues)
- **Email**: プロジェクト管理者にお問い合わせください

---

## 🙏 謝辞

このプロジェクトは、学童保育の現場で働く職員の皆様のフィードバックをもとに開発されています。

---

**Made with ❤️ for 学童保育の未来**
