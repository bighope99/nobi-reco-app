---
name: create-pr
description: PRをプッシュしてCI確認・CodeRabbitレビュー待機・指摘事項修正を行うワークフロー。実装完了後に使用する。
tags: [coderabbit, pr, review, ai-review, git]
---

# PR 作成 & CodeRabbit レビューループ

PRを作成/プッシュしたあと、CodeRabbitのレビューを待機して指摘事項を修正する。
最大3ラウンド繰り返す。

---

## Step 1: PR を作成/プッシュ

`git-push-and-pr` スキルのロジックに従って実行する:

1. 未コミット変更がないか確認
2. `git push -u origin <branch>`（初回）または `git push`
3. PRが存在しなければ `gh pr create` で作成
4. PR URLを取得して記録する

---

## Step 2: GitHub Actions CI を確認

PRプッシュ後、CIの完了を待機して結果を確認する。

```bash
# CIの実行状況を確認（最大10分待機）
gh pr checks --watch

# または個別のrunを確認
gh run list --branch $(git branch --show-current) --limit 3
```

**CI確認ロジック**:

1. `gh pr checks --watch` でCI完了を待機（最大10分）
2. **CI失敗の場合**:
   - `gh run view <run-id> --log-failed` でエラーログを取得
   - エラー内容をユーザーに報告
   - CIが修正されるまでCodeRabbitループに進まない
3. **CI成功の場合**: Step 3（CodeRabbitレビュー待機）へ進む

---

## Step 3: CodeRabbit のレビューを待機

PR作成/更新から **5分** 待機する。

```
CodeRabbit のレビューを待機中... （約5分）
```

> CodeRabbitは通常5〜10分でレビューを完了する。ドラフトPRはスキップされる場合がある。

---

## Step 4: レビューコメントを取得

```bash
PR_NUMBER=$(gh pr view --json number -q '.number')

# コード行コメント（review comments）
gh api repos/:owner/:repo/pulls/$PR_NUMBER/comments \
  --jq '[.[] | select(.user.login == "coderabbitai[bot]") | select(.body | contains("✅ Addressed") | not) | {id, path, line, body}]'

# PR 全体コメント（summary など）
gh pr view $PR_NUMBER --comments --json comments \
  --jq '[.comments[] | select(.author.login == "coderabbitai[bot]") | {body}]'
```

---

## Step 5: コメントを分類

| カテゴリ | 判断基準 | 対応 |
|---------|---------|------|
| **自動修正** | `Prompt for AI Agents` セクションあり、または明確なdiff提示 | 即座に修正開始 |
| **ユーザー判断** | 設計変更・複数選択肢・breaking change | ユーザーに確認してから対応 |
| **スキップ** | `✅ Addressed` 済み、または情報提供のみ | 対応不要 |

分類結果を一覧でユーザーに提示する。

---

## Step 6: 修正を実行

**自動修正可能なもの**を順番に修正:
- CodeRabbitの `Prompt for AI Agents` 指示に従う
- diff形式で提示されている場合はそのまま適用
- 修正完了後にコミット・プッシュ

```bash
git add <modified-files>
git commit -m "fix: CodeRabbit レビュー指摘事項の修正"
git push
```

**ユーザー判断が必要なもの**はユーザーの回答を待ってから対応する。

---

## Step 7: ループ判定

修正をプッシュしたらStep 3に戻る（最大3ラウンド）。

| 条件 | 次のアクション |
|-----|-------------|
| 未対応のCriticalコメントが残っている | → Step 3 に戻る |
| 3ラウンド完了 | → ループ終了、ユーザーに報告 |
| すべて対応済み | → ループ終了、ユーザーに報告 |

---

## 最終報告

```markdown
## PR 作成 & CodeRabbitレビュー完了

- PR: [URL]
- ラウンド数: X / 3
- 対応済みコメント: X 件
- スキップ: X 件（ユーザー判断待ち）

次のアクション: [ユーザーが判断すべき事項があれば列挙]
```
