---
name: PR Review
description: PRの変更に対してレビューエージェントを並列実行し、結果を集約して報告する
category: Review
tags: [review, pr, quality, security, performance, test]
---

# PR Review Workflow

PRの変更に対して包括的なコードレビューを実行し、結果を報告する。

## Step 1: 変更内容を把握する

```bash
# 変更ファイル一覧を取得
git diff main...HEAD --name-only

# PR情報を取得（存在する場合）
gh pr view --json title,body,url 2>/dev/null
```

CLAUDE.md を読んでプロジェクト固有のルール・技術スタックを把握する。

## Step 2: 適用エージェントを決定する

以下のエージェントを**常時実行**:
- `review-code` — コード品質・ガイドライン準拠
- `review-security` — セキュリティ脆弱性
- `review-performance` — パフォーマンス問題

変更内容に応じて**条件付き実行**:
- `review-tests` — テストファイル（`*.test.*`, `*.spec.*`, `__tests__/` など）が変更されている場合
- `review-errors` — try/catch・エラーハンドリングの変更が含まれる場合
- `review-types` — 型・インターフェースが追加・変更されている場合
- `review-comments` — コメント・JSDoc が追加・変更されている場合

引数で観点が指定された場合（例: `/pr-review tests errors`）はその観点のみ実行する。

## Step 3: エージェントを並列実行する

適用エージェントをすべて**単一メッセージで**Taskツール呼び出しして並列実行する。

各エージェントに渡す情報:
- CLAUDE.md の内容（プロジェクトルール・技術スタック）
- 変更ファイルの一覧と diff
- PRのタイトル・説明（存在する場合）

## Step 4: 結果を集約して報告する

```markdown
## レビュー結果サマリー

### 🔴 Critical（マージ前に必須対応）
- [エージェント名] ファイル:行 — 問題の説明

### 🟡 Important（対応推奨）
- [エージェント名] ファイル:行 — 問題の説明

### 🔵 Suggestion（任意）
- [エージェント名] ファイル:行 — 提案内容

### ✅ 良い点
- 良くできている点
```

Critical がある場合はマージをブロックすること。
修正が必要な場合はユーザーに確認を取ってから別途実施する。

## 使用例

```
/pr-review                  # 全観点でレビュー（デフォルト）
/pr-review tests errors     # テストとエラーハンドリングのみ
/pr-review security         # セキュリティのみ
```
