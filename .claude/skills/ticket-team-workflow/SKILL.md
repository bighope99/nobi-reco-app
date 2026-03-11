---
name: ticket-team-workflow
description: |
  承認OKのNotionチケットを一括処理するエージェントチームワークフロー。
  チケット取得→グルーピング→並列実装→レビュー→PR作成→CodeRabbitループを自動化。
  以下のキーワードで使用:
  - 「チケット一括処理」「承認OKを全部やって」「チーム起動」
  - 「ticket team」「チケットチーム」「一括修正」
  - 「承認OKのチケットを片付けて」
---

# Ticket Team Workflow

承認OKのNotionチケットを取得し、エージェントチームで一括実装・レビュー・PR作成まで行うワークフロー。

## チーム構成

| Role | モデル | 台数 | 責務 |
|------|--------|------|------|
| **Leader** | Opus | 1 | ユーザー対話、グルーピング承認、タスク振り分け最終決定、エスカレーション対応 |
| **Planner** | Sonnet | 1 | チケット取得、グルーピング案作成、**worktree作成**、Coderへの指示出し、軽微な判断 |
| **Coder** | Sonnet | 最大3 | 実装、テスト、コミット、**PR作成**、**CodeRabbitループ**、**Notionステータス更新**。自分のブランチは自分で完結 |
| **Reviewer** | Sonnet | 1 | **/pr-review のみ**。第三者視点でコード品質を評価し、指摘をCoderに返す |

## 全体フロー

```
Phase 1: 計画（Planner担当）
  Planner → Notionチケット取得 → グルーピング案作成 → Leaderに報告
  Leader → 承認 / 調整 → Plannerに指示
  Planner → worktree作成 → Coderへタスク指示

Phase 2: 実装（Coder担当、最大3並列）
  Coder → 実装 → テスト → コミット
  ※ エスカレーション → Planner判断 → 無理ならLeaderへ

Phase 3: レビュー & PR（Reviewer + Coder担当）
  Reviewer → /pr-review → 指摘をCoderに返す
  Coder → 指摘修正 → PR作成 → CodeRabbitループ(最大3回) → Notionステータス更新
```

## Phase 1: 計画（Planner）

### Step 1: チケット取得

Plannerが以下の手順でNotionから承認OKチケットを取得する。

```
1. notion-search で承認OKチケットを検索
   query: "承認OK のびレコ開発"
   data_source_url: "collection://2b2092aa-b014-8033-a92f-000bbe0df3cd"

2. 各チケットを notion-fetch で詳細取得（本文・プロパティ）

3. 必要に応じて notion-get-comments でコメントも取得
```

### Step 2: グルーピング

取得したチケットを**パス（対象ページ）別**にグルーピングする。

グルーピングルール:
- **同じパス** → 同じグループ（同じブランチ）
- **パス未設定** → 修正内容の類似性で判断
- **1グループが大きすぎる場合** → 分割を検討
- **グループ数が4以上** → 優先度順に上位3グループを選定、残りは次回

出力フォーマット:
```
## グループ1: fix/records-status-improvements
パス: /records/status
| チケットID | 名前 | トラッカー | 優先度 |
|-----------|------|-----------|--------|
| #170 | 一括作成が機能しない | バグ | 通常 |
| #175 | ステータス表示の不具合 | バグ | 通常 |

## グループ2: fix/password-setup-flow
パス: /password/setup
| チケットID | 名前 | トラッカー | 優先度 |
|-----------|------|-----------|--------|
| #216 | パスワード設定の遷移先 | バグ | 通常 |
```

### Step 3: Leader承認

Plannerがグルーピング案をLeaderに報告。Leaderが：
- **承認** → Phase 2へ進む
- **調整** → Plannerがグルーピングを修正して再提出
- **却下** → ユーザーに確認

## Phase 2: 準備 & 実装（Planner → Coder）

### Step 1: worktree作成（Planner担当）

Leader承認後、Plannerが各グループに対してworktreeを作成する。

```bash
git gtr new <ブランチ名> --yes
# 例: git gtr new fix/records-status-improvements --yes
```

### Step 2: Coderへの指示出し（Planner担当）

Plannerが各Coderに以下を伝達:
- worktreeパス（`git gtr go <ブランチ名>` で取得）
- 対象チケット一覧（ID、タイトル、本文、コメント）
- 具体的な修正内容
- 関連ファイルのパス

### Step 3: 実装（Coder担当、最大3並列）

各Coderは自分のworktreeで:
1. チケットの修正内容を実装
2. テストを追加/修正（TDD）
3. コミット
4. 完了報告をPlannerに返す

### エスカレーションルール

Coderが以下に該当する場合、Plannerに戻す:
- **修正範囲が想定より大きい**（10ファイル以上の変更など）
- **別のチケットの修正内容と競合する**
- **仕様が不明確で判断できない**

Plannerで判断できない場合 → Leaderにエスカレーション

## Phase 3: レビュー & PR（Reviewer + Coder）

各ブランチに対して以下を実行する。

### Step 1: 内部レビュー（Reviewer担当）

Reviewerは**第三者視点でコード品質を評価する専門エージェント**。

```
/pr-review を実行
→ 指摘リストをCoderに返す
→ Reviewer自身はコードを修正しない
```

### Step 2: レビュー指摘の修正（Coder担当）

```
Coderが自分のworktreeでReviewerの指摘を修正
→ 修正をコミット
```

### Step 3: PR作成（Coder担当）

```
/create-pr を実行
→ PRタイトル: "fix: [グループの概要]"
→ PR本文に対応チケット一覧を含める
```

### Step 4: CodeRabbitループ（Coder担当、最大3回転）

```
Loop (max 3):
  1. CodeRabbitのレビュー待ち（push後5-10分）
  2. coderabbit-review-flow でコメント取得
  3. 自動修正可能なものを修正
  4. ユーザー判断が必要なものはスキップ（Leaderに報告）
  5. 修正をコミット＆プッシュ
  6. 未対応コメントが0件 → ループ終了
```

### Step 5: Notionステータス更新（Coder担当）

PRが作成できたチケットすべてに対して:

```
1. notion-update-page でステータスを「レビュー依頼」に更新
2. notion-create-comment でPRリンクを追加
   "PR #<番号> を作成しました\nhttps://github.com/bighope99/nobi-reco-app/pull/<番号>"
```

## 起動方法

Leaderが以下の順で起動する:

### 1. Plannerを起動

```
Agent tool:
  subagent_type: general-purpose
  model: sonnet
  prompt: "あなたはPlannerです。Notionから承認OKチケットを取得し、
           パス別にグルーピングして報告してください。
           [notion-ticket-workflow スキルの手順に従う]"
```

### 2. Leader承認後、Coderを起動（最大3並列）

```
Agent tool (並列):
  subagent_type: code-modifier
  model: sonnet
  isolation: worktree
  prompt: "あなたはCoder-1です。以下のチケットを実装してください。
           [具体的なチケット情報と修正指示]"
```

### 3. Coder完了後、Reviewerを起動（/pr-reviewのみ）

```
Agent tool:
  subagent_type: general-purpose
  model: sonnet
  prompt: "あなたはReviewerです。以下のブランチに対して
           /pr-review を実行し、指摘リストをまとめてください。
           コード修正は行わず、指摘のみ返してください。
           [ブランチ一覧と対応チケット情報]"
```

### 4. Reviewer指摘後、Coderが修正 → PR作成 → CodeRabbitループ

Reviewerの指摘を受けて、各Coderが自分のブランチで:
1. 指摘を修正してコミット
2. /create-pr でPR作成
3. CodeRabbitループ（最大3回転）
4. Notionステータスを「レビュー依頼」に更新

## 制約事項

- **最大並列数**: Coder 3台まで
- **CodeRabbitループ**: 最大3回転
- **グループ数**: 1回の実行で最大3グループ（超える場合は優先度順に選定）
- **エスカレーション**: Planner → Leader → ユーザーの順
- **Leaderは実装しない**: 判断と承認のみ
- **Plannerは実装しない**: 計画と指示出しのみ

## クリーンアップ

全Phase完了後:

```bash
# マージ済みworktreeの削除
git gtr clean --merged --yes

# 個別削除
git gtr rm <ブランチ名> --delete-branch --yes
```

## トラブルシューティング

### Coderが大量の変更を報告した場合
→ Plannerがチケットを分割し、別ブランチに再アサイン

### CodeRabbitが3回転で収束しない場合
→ 残りの指摘をLeaderに報告、ユーザー判断を仰ぐ

### Notionチケットの内容が不明確な場合
→ Plannerが質問チケットを作成し、ユーザーに確認

### worktree間でコンフリクトが発生した場合
→ Leaderが優先順位を決め、順番にマージ
