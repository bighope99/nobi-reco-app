---
name: CodeRabbit Review
description: PRをプッシュしてCodeRabbitのレビューを待機し、指摘事項を修正するワークフロー
category: Review
tags: [coderabbit, pr, review, ai-review]
---

# CodeRabbit Review Workflow

このコマンドは以下のスキルを順番に実行します：

1. **git-push-and-pr** スキル → PRを作成/プッシュ
2. **5分待機** → CodeRabbitのレビュー完了を待つ
3. **coderabbit-review-flow** スキル → レビュー取得・修正

## 実行手順

### Step 1: PR作成/プッシュ

`git-push-and-pr` スキルを使用してPRを作成またはプッシュします。

**確認事項:**
- 現在のブランチがmainでないこと
- 未コミットの変更がないこと

**実行内容:**
1. `git push -u origin <branch>` でプッシュ
2. PRがなければ `gh pr create` で作成
3. PR URLを取得

### Step 2: 5分待機

CodeRabbitがレビューを完了するまで待機します。

```
CodeRabbitのレビューを待機中...（約5分）
```

**注意**:
- CodeRabbitは通常5-10分でレビューを完了
- 待機中は他の作業を行わない

### Step 3: CodeRabbitレビュー取得・修正

`coderabbit-review-flow` スキルを使用してレビューを取得し、修正を実行します。

**実行内容:**
1. `gh api` でCodeRabbitのコメントを取得
2. コメントを分類（自動修正/ユーザー判断/スキップ）
3. 一覧を提示
4. 修正を実行
5. コミット・プッシュ

## スキルの役割分担

| スキル | 責務 |
|--------|------|
| `git-push-and-pr` | PRの作成・プッシュのみ |
| `coderabbit-review-flow` | レビュー取得・分類・修正のみ |

このコマンドはこれらを**オーケストレーション**するだけ。

## 使用例

```
ユーザー: /coderabbit

Claude:
1. git-push-and-prスキルを使用してPRをプッシュします...
   → PR #123 を作成しました: https://github.com/...

2. CodeRabbitのレビューを5分間待機します...
   → 待機中...

3. coderabbit-review-flowスキルを使用してレビューを取得します...
   → 3件のコメントが見つかりました

## CodeRabbit レビュー結果

### 自動修正予定
1. **src/app/api/route.ts:42** - 未使用importの削除

### ユーザー判断が必要
1. **src/services/auth.ts:28** - 認証フローの変更
   → どちらを選択しますか？

修正を開始します...
```

## 個別実行

各スキルは個別に呼び出すこともできます：

- **PRだけ作成したい場合**: `git-push-and-pr` スキルを使用
- **レビューだけ取得したい場合**: `coderabbit-review-flow` スキルを使用

## 注意事項

- 待機時間は5分（CodeRabbitの処理速度による）
- ユーザー判断が不要な場合は自動で修正を開始
- Breaking changeの可能性がある場合は必ずユーザーに確認
