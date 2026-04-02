---
name: fix-pr
description: PR番号（/pull/123）またはブランチ名を指定して修正するワークフロー。「/pull/XXX を修正して」「〇〇ブランチを直して」など、既存PRへの修正依頼が来たら必ずこのスキルを使う。同じPRにそのままプッシュし、新PRは作らない。
tags: [git, pr, worktree, fix]
---

# fix-pr: PR修正ワークフロー

既存PRのブランチに対して修正をプッシュするワークフロー。新しいPRは作らない。

---

## Step 1: ブランチ名の取得

PR番号が指定された場合:
```bash
gh pr view <PR番号> --json headRefName -q .headRefName
```

ブランチ名が直接指定された場合はそのまま使用する。

---

## Step 2: ワークツリー作成

```bash
git fetch origin <branch>
git worktree add /tmp/fix-pr-<branch-name> <branch>
cd /tmp/fix-pr-<branch-name>
```

- worktree-path は `/tmp/fix-pr-<branch-name>` 形式
- `cd <worktree-path>` を実行してカレントディレクトリをワークツリーに移動する
- 以降の作業はすべてこのワークツリー内で行う
- **サブエージェントへの指示には必ずワークツリーの絶対パス（`/tmp/fix-pr-<branch-name>`）を明示すること**

---

## Step 3: 修正作業

- ワークツリー内で修正を実施
- サブエージェント（`frontend-implementer`, `backend-implementer` 等）に委譲する際は、プロンプトに **「作業ディレクトリは `/tmp/fix-pr-<branch-name>` です。ファイルの読み書き・検索はすべてそのパス配下で行うこと」** と明示する

---

## Step 4: コミット & プッシュ

```bash
# ワークツリー内で
git add <修正ファイル>
git commit -m "fix: ..."
git push origin <branch>
```

- **同じブランチ**にプッシュする
- **新しいPRは作らない**
- ユーザーが「分けて」と明示した場合のみ別ブランチ・別PRを作成する

---

## Step 5: ワークツリー削除

作業完了後、またはユーザーが「終了」と言ったとき:
```bash
git worktree remove /tmp/fix-pr-<branch-name>
```

---

## Rules

- `package-lock.json` や `settings.json` の変更はコミットしない（worktree削除時に破棄）
