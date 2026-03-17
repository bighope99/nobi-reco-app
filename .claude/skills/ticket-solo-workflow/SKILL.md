---
name: ticket-solo-workflow
description: |
  承認OKのNotionチケットをシングルエージェントで順次処理するワークフロー。
  エージェントチーム不要。Codex・Windows環境でも動作する。
  チケット取得→グルーピング→順次実装→レビュー→PR作成→CodeRabbitループを自動化。
  以下のキーワードで使用:
  - 「ソロで片付けて」「チームなしで」「一人でやって」
  - 「codexでチケット処理」「シングルエージェントで」
  - 「Windowsでチケット処理」「順番にやって」
---

# Ticket Solo Workflow

承認OKのNotionチケットを取得し、**Claude自身が全ステップを順次実行**するワークフロー。
エージェントチーム版（`ticket-team-workflow`）と同じ成果物を、1エージェントで達成する。

## チーム版との違い

| 項目 | チーム版 | ソロ版（このスキル） |
|------|---------|-------------------|
| 並列処理 | あり（最大3グループ同時） | なし（1グループずつ順次） |
| エージェントチーム | Leader/Planner/Coder/Reviewer | Claude自身が全役割 |
| 使用ツール | TeamCreate / SendMessage / Agent | 不要 |
| 動作環境 | Claude Code（Mac/Linux推奨） | Codex・Windows・Claude Code |
| 承認方法 | EnterPlanMode → UIで承認 | AskUserQuestion でチャット承認 |

## 全体フロー

```
Phase 0: ユーザー特定
  AskUserQuestion でユーザー名確認 → notion-get-users でID解決

Phase 1: 計画・承認
  チケット取得（自分 or 担当者なしでフィルタ）→ グルーピング案作成
  AskUserQuestion でユーザーに承認を求める

Phase 2: グループごとに順次処理（1グループずつ）
  For each group:
    Step 0: チケットを「進行中」に更新 + 担当者を自分に設定
    Step 1: worktree 作成
    Step 2: 実装プランを提示 → AskUserQuestion で承認
    Step 3: 実装 → テスト → コミット
    Step 4: /pr-review スキル実行 → 指摘修正
    Step 5: /create-pr スキル実行（CodeRabbitループ含む）
    Step 6: チケットを「レビュー依頼」に更新
    Step 7: 次のグループへ（あれば）

Phase 3: 完了報告
  全グループのPR URLと結果をユーザーに報告
```

## Phase 0: ユーザー特定

### Step 1: ユーザー確認

`AskUserQuestion` ツールを使い、以下を聞く:

> 「あなたのNotionユーザー名を教えてください（担当者フィールドに表示される名前）」

### Step 2: Notion ユーザーID解決

MCPツール `notion-get-users` でユーザー一覧を取得し、名前からIDを特定する。

```
mcp tool: notion-get-users
→ 返ってきたリストから USER_NAME に一致するユーザーのIDを取得
→ USER_NOTION_ID として以降のステップで使用
```

## Phase 1: 計画・承認

### Step 1: チケット取得

```bash
# 承認OKかつ（自分が担当 or 担当者なし）のチケットを取得
npx tsx .claude/skills/notion-ticket-workflow/scripts/query-tickets.ts \
  --status "承認OK" \
  --assignee-id <USER_NOTION_ID>
```

### Step 2: グルーピング案作成

取得したチケットを**パス（対象ページ）別**にグルーピングする。

グルーピングルール:
- **同じパス** → 同じグループ（同じブランチ）
- **パス未設定** → 修正内容の類似性で判断
- **1グループが大きすぎる場合** → 分割を検討
- **グループ数が4以上** → 優先度順に上位3グループを選定、残りは次回

出力フォーマット（ユーザーに提示する）:
```
## グループ1: fix/records-status-improvements  ← 処理順: 1番目
パス: /records/status
| チケットID | 名前 | トラッカー | 優先度 |
|-----------|------|-----------|--------|
| #170 | 一括作成が機能しない | バグ | 通常 |

## グループ2: fix/password-setup-flow  ← 処理順: 2番目
パス: /password/setup
| チケットID | 名前 | トラッカー | 優先度 |
|-----------|------|-----------|--------|
| #216 | パスワード設定の遷移先 | バグ | 通常 |
```

### Step 3: ユーザー承認

`AskUserQuestion` で以下を聞く:

> 「上記のグループ分けで進めてよいですか？変更や除外するグループがあれば教えてください。（OKなら「OK」と入力）」

- **OK** → Phase 2へ進む
- **変更あり** → グルーピングを修正して再提示

## Phase 2: グループ順次処理

各グループを**1つずつ順番**に処理する。次のグループは前のグループ完了後に開始する。

---

### グループごとの処理（以下をグループ数分繰り返す）

#### Step 0: チケットを「進行中」に更新

```bash
# グループ内の全チケットに対して実行
npx tsx .claude/skills/notion-ticket-workflow/scripts/update-ticket-status.ts \
  --page-id <チケットID> \
  --status "進行中" \
  --assignee-id <USER_NOTION_ID>
```

これにより:
- ステータス → 「進行中」
- 担当者 → 自分（USER_NOTION_ID）

#### Step 1: worktree 作成

```bash
git gtr new <ブランチ名> --yes
# 例: git gtr new fix/records-status-improvements --yes
```

> ※ git gtr が使えない環境（Codex等）では `git worktree add` で代替:
> ```bash
> git worktree add ../nobi-reco-app-<ブランチ名> -b <ブランチ名>
> ```

#### Step 2: 実装プランをユーザーに提示・承認

以下を含む実装プランをテキストで提示し、`AskUserQuestion` で承認を得る:

1. 対象チケット一覧（ID・タイトル・本文・コメントの要約）
2. 対象ファイル・パス
3. 実装方針（何をどう変えるか、変更理由）
4. テスト方針
5. 懸念事項・不明点（あれば）

> 「上記プランで実装を開始してよいですか？（OKなら「OK」と入力）」

**承認前に実装を開始してはいけない。**

#### Step 3: 実装

worktree ディレクトリで実装を行う:
1. テストを追加/修正（TDD: 先にテストを書く）
2. 実装
3. テスト実行・確認
4. コミット

#### Step 4: 内部レビュー

`/pr-review` スキルを実行し、指摘を修正する。

大規模変更（7ファイル以上 / 200行以上 / 新規機能 / DBスキーマ変更）の場合は複数視点でレビューを行う。

#### Step 5: PR作成（CodeRabbitループ含む）

`/create-pr` スキルを実行する:
- PRタイトル: `fix: [グループの概要]`
- PR本文に対応チケット一覧を含める
- CodeRabbitループ（最大3回転）を完了させる

#### Step 6: チケットを「レビュー依頼」に更新

```bash
# グループ内の全チケットに対して実行
npx tsx .claude/skills/notion-ticket-workflow/scripts/update-ticket-status.ts \
  --page-id <チケットID> \
  --status "レビュー依頼" \
  --pr-url <PR URL>
```

（「進行中」→「レビュー依頼」の遷移。担当者の変更は不要）

#### Step 7: 次のグループへ

ユーザーに進捗を報告し、次のグループの処理を開始する:

> 「グループ1の処理が完了しました（PR: <URL>）。次にグループ2: fix/password-setup-flow を処理します。」

---

## Phase 3: 完了報告

全グループ完了後、ユーザーに最終報告:

```
## 処理完了

### グループ1: fix/records-status-improvements
- チケット: #170, #175
- PR: https://github.com/bighope99/nobi-reco-app/pull/XXX

### グループ2: fix/password-setup-flow
- チケット: #216
- PR: https://github.com/bighope99/nobi-reco-app/pull/YYY

全チケットのステータスを「レビュー依頼」に更新しました。
```

## 制約事項

- **処理順序**: 必ず1グループずつ順次処理（並列不可）
- **CodeRabbitループ**: 最大3回転
- **グループ数**: 1回の実行で最大3グループ（超える場合は優先度順に選定）
- **承認必須**: グルーピング確認・実装プラン確認の2か所でユーザー承認を得る
- **エスカレーション**: 実装中に問題が発生したら `AskUserQuestion` でユーザーに確認

## クリーンアップ

PR マージ確認後（ユーザーが明示的に伝えた後）、使用した worktree を削除:

```bash
git gtr rm <ブランチ名> --delete-branch --yes

# または git gtr が使えない環境では:
git worktree remove ../nobi-reco-app-<ブランチ名>
git branch -d <ブランチ名>
```

> ※ ユーザーが「マージした」「PRを閉じた」と言うまで worktree を削除しない。

## トラブルシューティング

### チケットが0件の場合
→ `AskUserQuestion` で確認: 「承認OKかつ担当者が自分/未設定のチケットが見つかりませんでした。フィルタを外して全件取得しますか？」

### 実装中に別グループのファイルと競合した場合
→ `AskUserQuestion` でユーザーに報告し、処理順の変更や手動マージを相談する。

### CodeRabbitが3回転で収束しない場合
→ 残りの指摘を `AskUserQuestion` でユーザーに報告し、対応方針を確認する。

### git gtr コマンドが使えない場合（Codex・Windows等）
→ `git worktree add` で代替する（各Stepの代替コマンドを参照）。

### Notionチケットの内容が不明確な場合
→ `AskUserQuestion` でユーザーに確認してから実装を開始する。
