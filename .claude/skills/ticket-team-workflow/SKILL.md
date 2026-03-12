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
| **Planner** | Sonnet | 1 | チケット取得、グルーピング案作成、**worktree作成**、Coderへの指示出し、軽微な判断、**Notionステータス一括更新** |
| **Coder** | Sonnet | 最大3 | 実装、テスト、コミット、**/pr-review実行・修正**、**PR作成**、**CodeRabbitループ**。自分のブランチは自分で完結 |

### 大規模変更時のReviewer増員

以下のいずれかに該当するグループは「大規模変更」とみなし、専任Reviewerを1名追加する:
- **変更ファイル数が7ファイル以上**
- **変更行数が200行以上**（追加+削除、テストコードを除く）
- **新規ファイル追加を含む機能開発**（バグ修正ではない）
- **DBスキーマ変更を伴う**

大規模変更グループが複数ある場合、**グループごとに1名ずつ**Reviewerを追加する（例: 大規模2グループ → Reviewer 2名）。

Reviewerは必ず `/pr-review` スキルを使い、**複数視点（アーキテクチャ・セキュリティ・パフォーマンス）** でレビューを実施する。Coderへ指摘リストを返し、Reviewer自身はコードを修正しない。

## 全体フロー

```
Phase 1: 計画（Planner担当）
  Planner → Notionチケット取得 → グルーピング案作成 → Leaderに報告
  Leader → 承認 / 調整 → Plannerに指示
  Planner → worktree作成 → Coderへタスク指示

Phase 2: 実装（Coder担当、最大3並列）
  Coder → 実装 → テスト → コミット
  ※ エスカレーション → Planner判断 → 無理ならLeaderへ

Phase 3: レビュー & PR（Coder + Planner担当、大規模時はReviewer追加）
  通常: Coder → /pr-review実行 → 指摘修正 → PR作成 → CodeRabbitループ(最大3回) → PR URLをPlannerに報告
  大規模: Reviewer → /pr-review（複数視点） → 指摘をCoderに返す → Coder修正 → PR作成 → CodeRabbitループ → PR URLをPlannerに報告
  Planner → 全チケットのNotionステータスを一括更新（スクリプト使用）
```

## Phase 1: 計画（Planner）

### Step 1: チケット取得

Plannerが `notion-ticket-workflow` のスクリプトを使って承認OKチケットを一括取得する。

```bash
# 承認OKチケットを本文・コメント付きで一括取得
npx tsx .claude/skills/notion-ticket-workflow/scripts/query-tickets.ts --status "承認OK"
```

このスクリプトは Notion API でステータスを**完全一致フィルタ**し、各チケットの本文・コメント・全プロパティを並列取得してJSON出力する。詳細は `notion-ticket-workflow` スキルを参照。

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
1. **`EnterPlanMode`ツールを呼んでプランモードに入る**（プランモード中はファイル編集不可）
   プランには以下を含めてユーザーが確認しやすくする：
   - 対象チケット一覧（ID・タイトル・本文・コメントの要約）
   - Plannerから受け取った修正指示の内容
   - 対象ファイル・パス
   - 実装方針（何をどう変えるか、変更理由）
   - テスト方針
   - 懸念事項・不明点（あれば）
2. **ユーザーがUIでプランを承認**したら`ExitPlanMode`で通常モードに戻り実装開始
3. テストを追加/修正（TDD）
4. コミット
5. 完了報告をPlannerに返す

### エスカレーションルール

Coderが以下に該当する場合、Plannerに戻す:
- **修正範囲が想定より大きい**（10ファイル以上の変更など）
- **別のチケットの修正内容と競合する**
- **仕様が不明確で判断できない**

Plannerで判断できない場合 → Leaderにエスカレーション

## Phase 3: レビュー & PR（Coder + Planner、大規模時はReviewer追加）

各ブランチに対して以下を実行する。

### Step 1: 内部レビュー

**通常変更**: 各Coderが自分のブランチで `/pr-review` を実行し、指摘を自分で修正する。

**大規模変更**: 専任Reviewerが `/pr-review` を実行し、複数視点（アーキテクチャ・セキュリティ・パフォーマンス）で指摘リストを作成。Coderに返して修正させる。

### Step 2: PR作成（Coder担当）

```
/create-pr を実行
→ PRタイトル: "fix: [グループの概要]"
→ PR本文に対応チケット一覧を含める
```

### Step 3: CodeRabbitループ（Coder担当、最大3回転）

```
Loop (max 3):
  1. CodeRabbitのレビュー待ち（push後5-10分）
  2. coderabbit-review-flow でコメント取得
  3. 自動修正可能なものを修正
  4. ユーザー判断が必要なものはスキップ（Leaderに報告）
  5. 修正をコミット＆プッシュ
  6. 未対応コメントが0件 → ループ終了
```

### Step 4: Notionステータス更新（Planner担当）

各CoderがPR作成を完了したらPR URLをPlannerに報告する。
Plannerが全チケットのステータスを一括更新する:

```bash
# チケットごとにスクリプトを実行
npx tsx .claude/skills/notion-ticket-workflow/scripts/update-ticket-status.ts \
  --page-id <チケットID> \
  --status "レビュー依頼" \
  --pr-url <PR URL>
```

## 起動方法（エージェントチーム）

チームメンバーは永続的で、セッション中ずっと生き続ける。
Leaderがチームを作成し、メンバーに指示を送りながらワークフローを進行する。

### 1. チーム作成

```
Agent tool:
  name: "Planner"
  team_name: "ticket-team"
  model: sonnet
  prompt: "あなたはPlannerです。チームのPlanner役として、
           Notionチケットの取得・グルーピング・worktree作成・Coderへの指示出しを担当します。
           まずはNotionから承認OKチケットを取得し、パス別にグルーピングして報告してください。
           notion-ticket-workflow スキルの手順に従ってください。"

Agent tool:
  name: "Coder-1"
  team_name: "ticket-team"
  model: sonnet
  prompt: "あなたはCoder-1です。Plannerから指示されたチケットを実装します。
           Plannerから指示を受けたら、まずEnterPlanModeツールを呼んでプランモードに入ってください。
           プランモード中はファイル編集できません。プランには必ず以下を含めてください
           （ユーザーがチケットを見に行かなくて済むよう）:
           1. 対象チケット一覧（ID・タイトル・本文・コメントの要約）
           2. Plannerから受け取った修正指示の内容
           3. 対象ファイル・パス
           4. 実装方針（何をどう変えるか、変更理由）
           5. テスト方針
           6. 懸念事項・不明点（あれば）
           ユーザーがUIでプランを承認したらExitPlanModeで通常モードに戻り実装を開始してください。承認前に実装してはいけません。
           実装完了後は自分で /pr-review の指摘修正、PR作成、CodeRabbitループまで行い、
           PR作成後はPR URLをPlannerに報告してください。
           Plannerからの指示を待ってください。"

Agent tool:
  name: "Coder-2"
  team_name: "ticket-team"
  model: sonnet
  prompt: "（Coder-1と同様）"

Agent tool:
  name: "Coder-3"
  team_name: "ticket-team"
  model: sonnet
  prompt: "（Coder-1と同様）"
```

### 2. ワークフロー進行

チームメンバーへの指示はメッセージで行う:

```
Phase 1:
  → Plannerにメッセージ: "チケットを取得してグルーピングしてください"
  → Plannerが結果を報告
  → Leaderが承認
  → Plannerにメッセージ: "承認OK。worktreeを作成してCoderに指示を出してください"

Phase 2:
  → Planner → 各Coderにメッセージで具体的なタスク指示
  → 各Coderが並列で実装
  → 完了報告はPlannerに返す

Phase 3:
  → 各Coderが自分のブランチで /pr-review を実行し、指摘を修正
  → Coder → PR作成 → CodeRabbitループ → PR URLをPlannerに報告
  → 複数ブランチは並列で処理
  → 全Coderの完了後、Plannerが全チケットのNotionステータスをスクリプトで一括更新
```

### チーム操作

- **Shift+Down** — チームメンバーを切り替え
- **Escape** — メンバーの現在の作業を中断
- **Ctrl+T** — タスクリスト表示
- メンバーに直接メッセージを送るには、そのメンバーに切り替えてから入力

## 制約事項

- **最大並列数**: Coder 3台まで
- **チーム構成**: Leader 1 + Planner 1 + Coder 最大3 + Reviewer 0〜2（大規模変更グループごとに1名）
- **CodeRabbitループ**: 最大3回転
- **グループ数**: 1回の実行で最大3グループ（超える場合は優先度順に選定）
- **エスカレーション**: Planner → Leader → ユーザーの順
- **Leaderは実装しない**: 判断と承認のみ
- **Plannerは実装しない**: 計画と指示出しのみ

## クリーンアップ（チーム解散時に必ず実行）

全Phase完了後、**チーム解散前にPlannerが必ず実行する**:

```bash
# 使用した全worktreeを削除
git gtr rm <ブランチ名> --delete-branch --yes
# ※ 各グループのブランチに対して実行

# または、マージ済みworktreeを一括削除
git gtr clean --merged --yes
```

> ※ worktreeを残したままチームを解散しない。ディスクとブランチが散乱する原因になる。

## トラブルシューティング

### Coderが大量の変更を報告した場合
→ Plannerがチケットを分割し、別ブランチに再アサイン

### CodeRabbitが3回転で収束しない場合
→ 残りの指摘をLeaderに報告、ユーザー判断を仰ぐ

### Notionチケットの内容が不明確な場合
→ Plannerが質問チケットを作成し、ユーザーに確認

### worktree間でコンフリクトが発生した場合
→ Leaderが優先順位を決め、順番にマージ
