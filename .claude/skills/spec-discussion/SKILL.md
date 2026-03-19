---
name: spec-discussion
description: |
  仕様確認チケットをエージェントチームで議論し、仕様を確定するワークフロー。
  PMがオーケストレーター、Plannerがチケット取得・論点整理・実装指示書作成を担う。
  以下のキーワードで使用:
  - 「仕様を議論して」「仕様確認チケットを処理」「仕様を固めて」
  - 「議論チームを立てて」「spec-discussion」
  - 「仕様確認ステータスのチケット」
---

# Spec Discussion Workflow

`仕様確認` ステータスのNotionチケットをエージェントチームで多角的に議論し、仕様を確定するワークフロー。

**PM (Opus) がエージェントチームのLeader。TeamCreate でチームを作り、全メンバー間通信は SendMessage で行う。**

## メンバー構成

| ロール | 常駐 | 担当範囲 | モデル |
|--------|------|---------|--------|
| **PM** | ✅ 常時 | チームLeader。オーケストレーション・メンバー選択・ユーザー報告。手を動かさない | **Opus** |
| **Planner** | ✅ 常時 | Notionチケット取得・論点整理・実装指示書作成・worktree作成・Notionステータス更新 | Sonnet |
| **Designer (UI/UX)** | 任意 | 画面フロー・UX・既存デザインとの整合性 | Sonnet |
| **Code Reviewer (Engr. Director)** | 任意 | 技術的妥当性・影響範囲・アーキテクチャ（上流判断） | Sonnet |
| **Researcher** | 任意 | コード内外両方を調査。原因がコード外の可能性も含めて探る | Sonnet |
| **Engineer (Coder)** | 任意 | Plannerの指示書通りに実装するだけ。自分でプランを立てない | Sonnet |
| **Reviewer (Code Review)** | 任意 | Engineer完了後のコードをバグ・セキュリティ・保守性でチェック（/pr-review使用） | Sonnet |

各エージェントの詳細プロンプト・PR ワークフロー → `agents.md`

### メンバー選択の目安（PMが判断）

| 状況 | 召集するメンバー |
|------|----------------|
| UIが絡む・デザインが未確定 | Planner + Designer |
| 原因不明・コード外かもしれない | Planner + Researcher |
| 技術的な影響範囲が広い | Planner + Code Reviewer |
| 実装まで見通したい | Planner + Engineer + Reviewer |
| デザイン確定・バグ修正のみ | Planner + Code Reviewer + Engineer + Reviewer |

## 全体フロー

```
Phase 0: チーム起動（TeamCreate + Agent + SendMessage）
Phase 1: PM → Plannerに指示（チケット取得・論点整理・メンバー提案）
Phase 2: Plannerの出力をPMがユーザーへ提示 → ユーザー承認
Phase 3: 並列分析（選ばれたメンバーが SendMessage で同時に動く）
         ※ Reviewerだけ Engineer完了後に起動（順次）
Phase 4: PMが全結果を統合 → ユーザーへ提示
Phase 5: 意思決定 → Notionへ反映
Phase 6: 実装 & PR（承認OKになった場合のみ）
         Planner → worktree作成 → Engineer実装 → Reviewer(/pr-review)
         → Engineer(/create-pr + CodeRabbitループ) → Planner(Notionステータス更新)
```

## チーム起動方法

### 1. チーム作成（TeamCreate）

```
TeamCreate:
  team_name: "spec-discussion-team"
  description: "仕様確認議論チーム"
```

### 2. PM (Leader) をSpawn

```
Agent tool:
  name: "PM"
  team_name: "spec-discussion-team"
  model: opus
  prompt: "あなたはPM（チームLeader）です。spec-discussion-teamを率いて仕様確認チケットを議論します。
           手は動かさず、Plannerへ指示を出し、結果をユーザーへ提示する役割です。
           全メンバーへの指示・報告受け取りは SendMessage で行ってください。
           まず .claude/skills/spec-discussion/agents.md を Read してフロー全体を把握してください。
           その後 Planner に SendMessage で「チケット取得・論点整理・メンバー提案」を指示し、結果を待ってください。"
```

### 3. Planner をSpawn

```
Agent tool:
  name: "Planner"
  team_name: "spec-discussion-team"
  model: sonnet
  prompt: "あなたはPlannerです。spec-discussion-teamのPlanner役として動作します。
           PMからの指示を受けたら:
           1. Notionチケット取得・論点整理・メンバー提案を行い PM に報告
           2. 実装フェーズでは worktree 作成・Engineer/ReviewerのSpawn・指示出し・Notionステータス更新を担当
           全ての報告は SendMessage(to: 'PM') で行ってください。
           複数チケットが存在する場合は1件（または1グループ）のみを処理対象とし、残件数をPMに報告してください。
           PMからの指示を待ってください。"
```

### 4. 任意メンバーをSpawn（PMが判断後）

PM がユーザー承認を得てから、必要なメンバーを追加 Spawn する。`agents.md` のプロンプトを使用。

### 5. メンバー間通信（SendMessage）

```
全ての指示・報告は SendMessage で行う。

PM → SendMessage(to: "Planner"): チケット取得・論点整理の指示
Planner → SendMessage(to: "PM"): グルーピング案・メンバー提案の報告
PM → SendMessage(to: "Designer"/"Researcher" etc): 並列分析の指示
各メンバー → SendMessage(to: "PM"): 分析結果の報告
Engineer → SendMessage(to: "Planner"): PR URL報告
Planner → SendMessage(to: "PM"): 全完了報告
```

## Phase 2: Plannerの出力をユーザーへ提示

PMが `AskUserQuestion` でユーザーに以下を提示し承認を得る:
- 論点まとめ（何が決まっていないか）
- 提案メンバーと招集理由
- ユーザーが承認したら Phase 3 へ進む

## Phase 5: 意思決定 → Notion反映

`AskUserQuestion` で確認:

> 「上記の議論を踏まえて、どうしますか？
> 1. 実装を進める → 承認OK に更新 → Phase 6へ
> 2. もう少し検討が必要 → 承認保留 に更新
> 3. 却下 → 却下 に更新
> 4. 引き続き仕様確認（コメントのみ追加）」

```bash
npx tsx .claude/skills/notion-ticket-workflow/scripts/update-ticket-status.ts \
  --page-id <チケットID> \
  --status "承認OK"
```

議論メモをNotionコメントに記録（必須）:
```
ツール: notion-create-comment
page_id: <チケットID>
content: 仕様議論まとめ（論点・各メンバー所見・決定事項）
```

## 制約事項

- **意思決定はユーザーが行う** — どのエージェントも勝手に承認OKにしない
- **PMは手を動かさない** — 調査・実装は専門エージェントに委譲
- **全通信はSendMessage** — エージェント間の直接呼び出しは行わない
- **EngineerはPlannerの指示書通りに動く** — 自分でプランを立てない
- **Reviewerは実装完了後に起動** — Engineerより先に動かない
- **議論メモは必ずNotionに残す**
- **メンバー選択はユーザーが最終承認**
- **1回の実行で処理するチケットは1件（または1グループ）のみ** — 複数ある場合はPlannerが先頭1件を選んで残件数をPMに報告する

## クリーンアップ（Phase 6実施後）

PR マージ確認後に Planner が実行:

```bash
git gtr rm <ブランチ名> --delete-branch --yes
```

## トラブルシューティング

- **見解が割れた場合** → そのままユーザーに提示。PMが勝手に調整しない
- **チケット内容が薄い場合** → AskUserQuestionで補足を求めてから再分析
- **原因がコード外と判明した場合** → 「実装前に確認が必要な事項」として提示し判断を仰ぐ
- **EngineerがPlannerの指示通りに実装できない場合** → PMを通じてユーザーに報告。Engineerが独断で方針変更しない
- **CodeRabbitが3回転で収束しない場合** → 残りの指摘をPMがユーザーに報告し判断を仰ぐ
