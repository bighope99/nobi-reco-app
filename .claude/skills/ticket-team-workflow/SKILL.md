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
| **PM** | Sonnet | 1 | チケット取得、グルーピング案作成、**worktree作成**、Coderへの指示出し、軽微な判断、**Notionステータス一括更新** |
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
Phase 0: ユーザー特定（Leader担当）
  Leader → AskUserQuestion で担当者名を番号選択させる
  → 以降のチケット取得・更新で使用する ASSIGNEE_NAME を確定

Phase 1: 計画（PM担当）
  PM → Notionチケット取得（自分 or 担当者なしでフィルタ）→ グルーピング案作成 → Leaderに報告
  Leader → AskUserQuestion でユーザーに確認（必須）
  ユーザーが指示を出した場合 → Leaderがチケット本文に指示を追記
  ユーザー承認後 → PMに指示
  PM → チケットのステータスを「進行中」に更新 + 担当者を自分に設定
  PM → worktree作成 → Coderへタスク指示

Phase 2: 実装（Coder担当、最大3並列）
  Coder → 実装 → テスト → コミット
  ※ エスカレーション → PM判断 → 無理ならLeaderへ

Phase 3: レビュー & PR（Coder + Planner担当、大規模時はReviewer追加）
  通常: Coder → /pr-review実行 → 指摘修正 → PR作成 → PR URLをPlannerに報告 → Plannerがチケットを「レビュー依頼」に更新 → CodeRabbitループ(最大3回)
  大規模: Reviewer → /pr-review（複数視点） → 指摘をCoderに返す → Coder修正 → PR作成 → PR URLをPlannerに報告 → Plannerがチケットを「レビュー依頼」に更新 → CodeRabbitループ
```

## Phase 0: ユーザー特定（Leader担当）

### Step 1: 担当者を番号選択で確認

Leaderが `AskUserQuestion` ツールを使い、以下の形式で聞く:

> 「あなたの担当者名を番号で選択してください:
> 1. 中村
> 2. 尼崎
> 3. かつはら
> 4. 小川
> 5. その他（直接入力）
> （担当者なしのチケットも含めて取得します）」

選択された番号から `ASSIGNEE_NAME` を確定する。「5. その他」の場合はそのまま入力された名前を使用する。

以降の全フェーズで `ASSIGNEE_NAME` を参照する。

## Phase 1: 計画（PM）

### Step 1: チケット取得

PMが `notion-ticket-workflow` のスクリプトを使って承認OKチケットを一括取得する。

```bash
# 承認OKかつ（自分が担当 or 担当者なし）のチケットを取得
npx tsx .claude/skills/notion-ticket-workflow/scripts/query-tickets.ts \
  --status "承認OK" \
  --assignee-name <ASSIGNEE_NAME>
```

`--assignee-name` を指定すると「担当者が自分 OR 担当者が未設定」のチケットのみ取得する。
ユーザーが自分と関係のないチケットを誤って処理しないためのフィルタ。

このスクリプトは Notion API でステータスを**完全一致フィルタ**し、各チケットの本文・コメント・全プロパティを並列取得してJSON出力する。詳細は `notion-ticket-workflow` スキルを参照。

### Step 2: グルーピング

取得したチケットを**パス（対象ページ）別**にグルーピングする。

グルーピングルール:
- **同じパス** → 同じグループ（同じブランチ）
- **パス未設定** → 修正内容の類似性で判断
- **1グループが大きすぎる場合** → 分割を検討
- **グループ数が4以上** → 優先度スコアで上位3グループを選定、残りは次回

**グループ優先度スコアの算出**（グループ選定に使う）:
- 各グループの優先度スコア = グループ内チケットの最高優先度
- 優先度の順位: 今すぐ(5) > 急いで(4) > 高め(3) > 通常(2) > 低い(1)
- スコアが同じ場合はチケット数が多いグループを優先

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

### Step 3: ユーザー承認

PMがグルーピング案をLeaderに報告後、Leaderが**必ずユーザーに確認**する。

Leaderは `AskUserQuestion` でユーザーに以下を提示する:
- グルーピング一覧（グループ名・チケット一覧・大規模変更フラグ）
- 「このグルーピングで進めますか？」

ユーザーの回答:
- **承認** → Phase 2へ進む
- **調整指示あり** → PMがグルーピングを修正して再提出
- **特定チケットへの実装指示あり** → Leaderがチケット本文に指示を追記（後述）してから Phase 2へ

> ⚠️ **ユーザーの明示的な承認なしに Phase 2 へ進んではいけない。**

### Step 3b: ユーザー指示をチケット本文に記載

ユーザーが特定チケットの進め方を指示した場合（例:「このチケットはAパターンで実装して」「〇〇は使わないで」）、
Leaderは対象チケットのNotionページ本文にその旨を追記する。

```bash
# notion-update-page MCP を使ってチケット本文を更新する
# または notion-create-comment でコメントとして追加する
```

追記フォーマット:
```
---
[実装指示 by ユーザー]
<ユーザーの指示をそのまま記載>
```

追記後、PMへの指示にも同内容を含めること。

## Phase 2: 準備 & 実装（PM → Coder）

### Step 0: チケットステータスを「進行中」に更新（PM担当）

Leader承認後、実装着手前に対象チケット全件のステータスを更新する。

```bash
# 対象チケットごとに実行
npx tsx .claude/skills/notion-ticket-workflow/scripts/update-ticket-status.ts \
  --page-id <チケットID> \
  --status "進行中" \
  --assignee-name <ASSIGNEE_NAME>
```

これにより:
- ステータス → 「進行中」
- 担当者 → 自分（ASSIGNEE_NAME）

が設定される。

### Step 1: worktree作成（PM担当）

Leader承認後、PMが各グループに対してworktreeを作成する。

**⚠️ 重要: ブランチが既存の場合は必ず削除してから作成する**

既存ブランチがあると古いコミットを引き継ぎ、mainとのコンフリクト原因になる。

```bash
# 既存ブランチ・worktreeを削除してからクリーンに作成する
git fetch origin
# リモートに同名ブランチが存在する場合は削除
git push origin --delete <ブランチ名> 2>/dev/null || true
# ローカルに同名ブランチが存在する場合は削除
git branch -D <ブランチ名> 2>/dev/null || true

# mainの最新から新規作成
git gtr new <ブランチ名> --base main --yes
# 例: git gtr new fix/records-status-improvements --base main --yes
```

### Step 2: Coderへの指示出し（PM担当）

PMが各Coderに以下を伝達:
- worktreeパス（`git gtr go <ブランチ名>` で取得）
- 対象チケット一覧（ID、タイトル、本文、コメント）
- 具体的な修正内容
- 関連ファイルのパス

### Step 3: 実装（Coder担当、最大3並列）

各Coderは自分のworktreeで:
1. **`EnterPlanMode`ツールを呼んでプランモードに入る**（プランモード中はファイル編集不可）
   プランには以下を含めてユーザーが確認しやすくする：
   - 対象チケット一覧（ID・タイトル・本文・コメントの要約）
   - PMから受け取った修正指示の内容
   - 対象ファイル・パス
   - 実装方針（何をどう変えるか、変更理由）
   - テスト方針
   - 懸念事項・不明点（あれば）
2. **ユーザーがUIでプランを承認**したら`ExitPlanMode`で通常モードに戻り実装開始
3. テストを追加/修正（TDD）
4. コミット
5. 完了報告をPMに返す

### エスカレーションルール

Coderが以下に該当する場合、PMに戻す:
- **修正範囲が想定より大きい**（10ファイル以上の変更など）
- **別のチケットの修正内容と競合する**
- **仕様が不明確で判断できない**

PMで判断できない場合 → Leaderにエスカレーション

## Phase 3: レビュー & PR（Coder + PM、大規模時はReviewer追加）

各ブランチに対して以下を実行する。

### Step 1: 内部レビュー

**通常変更**: 各Coderが自分のブランチで `/pr-review` を実行し、指摘を自分で修正する。

**大規模変更**: 専任Reviewerが `/pr-review` を実行し、複数視点（アーキテクチャ・セキュリティ・パフォーマンス）で指摘リストを作成。Coderに返して修正させる。

### Step 2: PR作成 & Notionステータス更新（Coder → Planner）

```
Coder:
  1. /create-pr を実行
     → PRタイトル: "fix: [グループの概要]"
     → PR本文に対応チケット一覧を含める
  2. PR URLを SendMessage(to: "Planner") で報告

Planner:
  PR URLを受け取り次第、対象チケットを即座に「レビュー依頼」に更新する（CodeRabbitループを待たない）:
```

```bash
# チケットごとにスクリプトを実行（PR作成直後）
npx tsx .claude/skills/notion-ticket-workflow/scripts/update-ticket-status.ts \
  --page-id <チケットID> \
  --status "レビュー依頼" \
  --pr-url <PR URL>
```

（「進行中」→「レビュー依頼」の遷移）
担当者の変更は不要（Phase 2で設定済み）。

### Step 3: CodeRabbitループ（Coder担当、最大3回転）

Notionステータス更新後、CoderがそのままCodeRabbitループを実行する。

```
Loop (max 3):
  1. CodeRabbitのレビュー待ち（push後5-10分）
  2. coderabbit-review-flow でコメント取得
  3. 自動修正可能なものを修正
  4. ユーザー判断が必要なものはスキップ（Leaderに報告）
  5. 修正をコミット＆プッシュ
  6. 未対応コメントが0件 → ループ終了
```

### Step 4: Notionステータス更新（PM担当）

各CoderがPR作成を完了したらPR URLをPMに報告する。
PMが全チケットのステータスを一括更新する:

```bash
# チケットごとにスクリプトを実行（PR作成後・CodeRabbitループ終了後）
npx tsx .claude/skills/notion-ticket-workflow/scripts/update-ticket-status.ts \
  --page-id <チケットID> \
  --status "レビュー依頼" \
  --pr-url <PR URL>
```

PR作成 → CodeRabbitループ完了のタイミングで「レビュー依頼」に更新する。
（「進行中」→「レビュー依頼」の遷移）
担当者の変更は不要（Phase 2で設定済み）。

## 起動方法（エージェントチーム）

チームメンバーは永続的で、セッション中ずっと生き続ける。
LeaderがTeamCreateでチームを作成し、AgentツールでメンバーをSpawn、SendMessageで指示を送りながらワークフローを進行する。

### 1. チーム作成（TeamCreate）

まず `TeamCreate` ツールでチームを作成する:

```
TeamCreate:
  team_name: "ticket-team"
  description: "Notionチケット一括処理チーム"
```

### 2. メンバーSpawn（Agent tool with team_name）

次に `Agent` ツールで各メンバーを起動する。`team_name` を指定することで永続エージェントになる:

```
Agent tool:
  name: "PM"
  team_name: "ticket-team"
  model: sonnet
  prompt: "あなたはPMです。ticket-teamのPM役として動作します。
           担当者: <ASSIGNEE_NAME>

           役割:
           - Notionチケット取得・グルーピング案作成
           - worktree作成（既存ブランチは削除してから git gtr new <ブランチ名> --base main --yes）
           - Coderへの指示出し（SendMessageを使用）
           - Notionステータス一括更新

           Leaderからの指示を待ってください。
           指示を受けたら実行し、結果をLeaderに SendMessage で報告してください。
           Coderへの指示もSendMessageで行います。"

Agent tool:
  name: "Coder-1"
  team_name: "ticket-team"
  model: sonnet
  prompt: "あなたはCoder-1です。ticket-teamのCoder役として動作します。

           PMから指示を受けたら:
           1. まず EnterPlanMode ツールを呼んでプランモードに入る
              プランに必ず含めること:
              - 対象チケット一覧（ID・タイトル・本文・コメントの要約）
              - PMから受け取った修正指示
              - 対象ファイル・パス
              - 実装方針（何をどう変えるか、変更理由）
              - テスト方針
              - 懸念事項・不明点
           2. ユーザーがUIでプランを承認したら ExitPlanMode で実装開始（承認前に実装してはいけない）
           3. 実装 → テスト → コミット
           4. /pr-review スキルで指摘修正
           5. /create-pr スキルでPR作成・CodeRabbitループ
           6. PR URLを SendMessage でPMに報告

           PMからの指示を待ってください。"

Agent tool:
  name: "Coder-2"
  team_name: "ticket-team"
  model: sonnet
  prompt: "（Coder-1と同様のプロンプト。name部分をCoder-2に変える）"

Agent tool:
  name: "Coder-3"
  team_name: "ticket-team"
  model: sonnet
  prompt: "（Coder-1と同様のプロンプト。name部分をCoder-3に変える）"
```

### 3. ワークフロー進行（SendMessage）

**全てのメンバー間通信は `SendMessage` ツールで行う**。

```
Phase 1:
  Leader → SendMessage(to: "PM"):
    "承認OKチケットを取得し、パス別にグルーピングしてください。
     担当者: <ASSIGNEE_NAME>
     コマンド:
     npx tsx .claude/skills/notion-ticket-workflow/scripts/query-tickets.ts \
       --status '承認OK' --assignee-name <ASSIGNEE_NAME>"
  → PMがグルーピング案を SendMessage(to: "Leader") で報告
  → Leader がユーザーに確認 → 承認
  → Leader → SendMessage(to: "PM"):
    "承認OK。以下グルーピングで進めてください。
     チケットを「進行中」に更新後、worktreeを作成してCoderに指示を出してください。"

Phase 2:
  PM → SendMessage(to: "Coder-1"): グループ1の詳細指示
  PM → SendMessage(to: "Coder-2"): グループ2の詳細指示  ← 並列
  PM → SendMessage(to: "Coder-3"): グループ3の詳細指示  ← 並列
  各Coderが実装後 → SendMessage(to: "PM") で完了報告

Phase 3:
  各Coderが /pr-review → /create-pr → PR URL を SendMessage(to: "Planner") で報告
  Planner → PR URL受信直後に全チケットのNotionステータスを「レビュー依頼」に更新（CodeRabbitループを待たない）
  Coder → CodeRabbitループ実行
  Planner → SendMessage(to: "Leader") で全完了を報告
  Leader → ユーザーに完了報告（チームはそのまま待機。解散はユーザーが「終了」と言うまでしない）
```

### 4. チーム操作

- **Shift+Down** — チームメンバーを切り替え
- **Escape** — メンバーの現在の作業を中断
- **Ctrl+T** — タスクリスト表示
- メンバーに直接メッセージを送るには、そのメンバーに切り替えてから入力
- チームメンバー一覧は `~/.claude/teams/ticket-team/config.json` で確認できる

## 制約事項

- **最大並列数**: Coder 3台まで
- **チーム構成**: Leader 1 + PM 1 + Coder 最大3 + Reviewer 0〜2（大規模変更グループごとに1名）
- **CodeRabbitループ**: 最大3回転
- **グループ数**: 1回の実行で最大3グループ（超える場合は優先度順に選定）
- **エスカレーション**: PM → Leader → ユーザーの順
- **Leaderは実装しない**: 判断と承認のみ
- **PMは実装しない**: 計画と指示出しのみ
- **LeaderはPR修正を直接行わない**: チーム稼働中にユーザーがPR番号（`/pull/123` など）を言っても、Leaderが `/fix-pr` を自分で実行してはいけない。必ずCoderに `SendMessage` で委譲する。LeaderはPR URLとユーザーの指示をCoderに伝え、Coderが `/fix-pr` を実行する。

## クリーンアップ（ユーザーが「終了」と言ったときのみ実行）

> ⚠️ **全Phase完了しても、ユーザーが「終了」「解散して」と明示するまでチームを解散しない。**
> Leaderが自判断で解散・worktree削除を行ってはいけない。

ユーザーから解散指示を受けたら、**PMが必ず実行する**:

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
→ PMがチケットを分割し、別ブランチに再アサイン

### CodeRabbitが3回転で収束しない場合
→ 残りの指摘をLeaderに報告、ユーザー判断を仰ぐ

### Notionチケットの内容が不明確な場合
→ PMが質問チケットを作成し、ユーザーに確認

### worktree間でコンフリクトが発生した場合
→ Leaderが優先順位を決め、順番にマージ
