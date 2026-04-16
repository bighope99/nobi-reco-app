# Role & Agent Guidelines

## 原則

- サブエージェントに委譲し、並列処理を活用する
- 依存関係がないタスクは単一メッセージで複数の Task ツール呼び出し（並列実行）

## ユーザースコープ エージェント一覧

| Agent | 用途 |
|-------|------|
| `backend-implementer` | API Routes・Supabaseクエリ・認証ロジックの実装 |
| `frontend-implementer` | Reactコンポーネント・ページ・hooks・UIロジックの実装 |
| `build-test-runner` | テスト・ビルド実行とエラー分析 |
| `test-code-generator` | テストコード作成（TDD） |
| `codeReview` | コード品質・ガイドライン準拠チェック |
| `db-schema-validator` | DBスキーマ使用の検証（`docs/03_database.md` 照合） |
| `docs-fetcher` | 公式ドキュメント取得（Context7 / Web検索） |
| `git-operator` | git操作（commit・push・branch・merge等） |
| `skill-rule-creator` | スキル（`.claude/skills/`）・ルール（`.claude/rules/`）の作成・更新 |
