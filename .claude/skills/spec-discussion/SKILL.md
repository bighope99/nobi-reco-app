---
name: spec-discussion
description: |
  仕様確認チケットをエージェントチームで議論し、仕様を確定するワークフロー。
  親Claude（このセッション）がオーケストレーター、Plannerがチケット取得・論点整理・実装指示書作成を担う。
  以下のキーワードで使用:
  - 「仕様を議論して」「仕様確認チケットを処理」「仕様を固めて」
  - 「議論チームを立てて」「spec-discussion」
  - 「仕様確認ステータスのチケット」
---

# Spec Discussion Workflow

`仕様確認` ステータスのNotionチケットをエージェントチームで多角的に議論し、仕様を確定するワークフロー。

**親Claude（このセッション）がオーケストレーター。TeamCreate でチームを作り、各エージェントを Agent ツールで起動して結果を受け取る。**

## メンバー構成

| ロール | 常駐 | 担当範囲 | モデル |
|--------|------|---------|--------|
| **Planner** | ✅ 常時 | Notionチケット取得・論点整理・メンバー提案・実装指示書作成・worktree作成・Notionステータス更新 | Sonnet |
| **Designer (UI/UX)** | 任意 | 画面フロー・UX・既存デザインとの整合性 | Sonnet |
| **Code Reviewer (Engr. Director)** | 任意 | 技術的妥当性・影響範囲・アーキテクチャ（上流判断） | Sonnet |
| **Researcher** | 任意 | コード内外両方を調査。原因がコード外の可能性も含めて探る | Sonnet |
| **Engineer (Coder)** | 任意 | Plannerの指示書通りに実装するだけ。自分でプランを立てない | Sonnet |
| **Reviewer (Code Review)** | 任意 | Engineer完了後のコードをバグ・セキュリティ・保守性でチェック（/pr-review使用） | Sonnet |

各エージェントの詳細プロンプト・PR ワークフロー → `agents.md`

### メンバー選択の目安（親Claudeが判断）

| 状況 | 召集するメンバー |
|------|----------------|
| UIが絡む・デザインが未確定 | Planner + Designer |
| 原因不明・コード外かもしれない | Planner + Researcher |
| 技術的な影響範囲が広い | Planner + Code Reviewer |
| 実装まで見通したい | Planner + Engineer + Reviewer |
| デザイン確定・バグ修正のみ | Planner + Code Reviewer + Engineer + Reviewer |

## 全体フロー

```
Phase 0: チーム起動（TeamCreate → Planner をSpawn）
Phase 1: Plannerにチケット取得・論点整理・メンバー提案を指示
Phase 2: Plannerの出力を親Claudeがユーザーへ提示 → ユーザー承認
Phase 3: 並列分析（選ばれたメンバーを並列 Spawn して結果を収集）
         ※ Reviewerだけ Engineer完了後に起動（順次）
Phase 4: 全結果を統合 → ユーザーへ提示
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

### 2. Planner をSpawn

```
Agent tool:
  name: "Planner"
  team_name: "spec-discussion-team"
  model: sonnet
  prompt: "あなたはPlannerです。spec-discussion-teamのPlanner役として動作します。
           以下を実行して結果を返してください:
           1. Notionチケット取得（--status 仕様確認）
           2. 論点整理（何が決まっていないか・原因仮説・召集すべきメンバー案）
           3. 実装が必要な場合のEngineerへの指示書骨子
           複数チケットが存在する場合は1件（または1グループ）のみを処理対象とし、残件数も報告してください。
           実装フェーズでは worktree 作成・Engineer/ReviewerのSpawn・指示出し・Notionステータス更新を担当します。"
```

### 3. 任意メンバーをSpawn（ユーザー承認後）

ユーザー承認を得てから、必要なメンバーを並列 Spawn する。`agents.md` のプロンプトを使用。

```
# 例：Designer と Researcher を並列 Spawn
Agent tool (name: "Designer", ...): agents.md の Designer プロンプトを使用
Agent tool (name: "Researcher", ...): agents.md の Researcher プロンプトを使用
```

## Phase 2: Plannerの出力をユーザーへ提示

親Claudeが `AskUserQuestion` でユーザーに以下を提示し承認を得る:
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
- **親Claudeが手を動かさない** — 調査・実装は専門エージェントに委譲
- **EngineerはPlannerの指示書通りに動く** — 自分でプランを立てない
- **Reviewerは実装完了後に起動** — Engineerより先に動かない
- **議論メモは必ずNotionに残す**
- **メンバー選択はユーザーが最終承認**
- **1回の実行で処理するチケットは1件（または1グループ）のみ** — 複数ある場合はPlannerが先頭1件を選んで残件数を報告する

## クリーンアップ（Phase 6実施後）

PR マージ確認後に Planner が実行:

```bash
git gtr rm <ブランチ名> --delete-branch --yes
```

## トラブルシューティング

- **見解が割れた場合** → そのままユーザーに提示。勝手に調整しない
- **チケット内容が薄い場合** → AskUserQuestionで補足を求めてから再分析
- **原因がコード外と判明した場合** → 「実装前に確認が必要な事項」として提示し判断を仰ぐ
- **EngineerがPlannerの指示通りに実装できない場合** → 親Claudeを通じてユーザーに報告。Engineerが独断で方針変更しない
- **CodeRabbitが3回転で収束しない場合** → 残りの指摘を親Claudeがユーザーに報告し判断を仰ぐ
