---
name: spec-discussion
description: |
  仕様確認チケットをエージェントチームで議論し、仕様を確定するワークフロー。
  親Claude（このセッション）がオーケストレーター、PMがチケット取得・論点整理・実装指示書作成を担う。
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
| **PM** | ✅ 常時 | Notionチケット取得・論点整理・メンバー提案・実装指示書作成・worktree作成・Notionステータス更新 | Sonnet |
| **Designer (UI/UX)** | 任意 | 画面フロー・UX・既存デザインとの整合性 | Sonnet |
| **Code Reviewer (Engr. Director)** | 任意 | 技術的妥当性・影響範囲・アーキテクチャ（上流判断） | Sonnet |
| **Researcher** | 任意 | コード内外両方を調査。原因がコード外の可能性も含めて探る | Sonnet |
| **Engineer (Coder)** | 任意 | PMの指示書通りに実装するだけ。自分でプランを立てない | Sonnet |
| **Reviewer (Code Review)** | 任意 | Engineer完了後のコードをバグ・セキュリティ・保守性でチェック（/pr-review使用） | Sonnet |

各エージェントの詳細プロンプト・PR ワークフロー → `agents.md`

### メンバー選択の目安（親Claudeが判断）

| 状況 | 召集するメンバー |
|------|----------------|
| UIが絡む・デザインが未確定 | PM + Designer |
| 原因不明・コード外かもしれない | PM + Researcher |
| 技術的な影響範囲が広い | PM + Code Reviewer |
| 実装まで見通したい | PM + Engineer + Reviewer |
| デザイン確定・バグ修正のみ | PM + Code Reviewer + Engineer + Reviewer |

## 全体フロー

```
Phase 0: チーム起動（TeamCreate → PM をSpawn）
Phase 1: PMにチケット取得・論点整理・メンバー提案を指示
Phase 2: PMの出力を親Claudeがユーザーへ提示 → ユーザー承認
Phase 3: 並列分析（選ばれたメンバーを並列 Spawn して結果を収集）
         ※ Reviewerだけ Engineer完了後に起動（順次）
Phase 4: 全結果を統合 → ユーザーへ提示
Phase 5: 意思決定 → Notionへ反映
Phase 6: 実装 & PR（実装を進める を選択した場合のみ）
         PM: worktree作成 + Notionを「進行中」に更新
         Engineer: 実装 → コミット
         Reviewer: コードレビュー（/pr-review）
         Engineer: 指摘修正 → /create-pr でPR作成 → PR URLを親Claudeへ返す
         PM: Notionを「レビュー依頼」に更新（PR URL付き）
         Engineer: CodeRabbitループ（最大3回）
```

## チーム起動方法

### 1. チーム作成（TeamCreate）

```
TeamCreate:
  team_name: "spec-discussion-team"
  description: "仕様確認議論チーム"
```

### 2. PM をSpawn

```
Agent tool:
  name: "PM"
  team_name: "spec-discussion-team"
  model: sonnet
  prompt: "あなたはPMです。spec-discussion-teamのPM役として動作します。
           以下を実行して結果を返してください:
           1. Notionチケット取得（--status 仕様確認）— 取得できる限り全件取得する
           2. 各チケットの概要（ID・タイトル・1行サマリー・緊急度感）を一覧化
           3. 関連が深いチケットがあれば「グループ化できそう」とメモする程度でOK。無理にグループ化しない
           実装フェーズでは worktree 作成・Engineer/ReviewerのSpawn・指示出し・Notionステータス更新を担当します。"
```

### 3. 任意メンバーをSpawn（ユーザー承認後）

ユーザー承認を得てから、必要なメンバーを並列 Spawn する。`agents.md` のプロンプトを使用。

```
# 例：Designer と Researcher を並列 Spawn
Agent tool (name: "Designer", ...): agents.md の Designer プロンプトを使用
Agent tool (name: "Researcher", ...): agents.md の Researcher プロンプトを使用
```

## Phase 2: チケット一覧をユーザーへ提示 → 対象選択

親Claudeが取得した全チケットを一覧表示し、`AskUserQuestion` でユーザーに対象を選んでもらう:

```
今すぐ議論するチケットを選んでください（複数可）:
1. #XXX [タイトル] — [1行サマリー]
2. #XXX [タイトル] — [1行サマリー]
...
```

- ユーザーが選択したチケットのみを Phase 3 以降で処理する
- 関連チケットをまとめて選んだ場合、グループ化して1つの議論として扱えるか確認する

## Phase 5: 意思決定 → Notion反映

`AskUserQuestion` で確認:

> 「上記の議論を踏まえて、どうしますか？
> 1. 実装を進める → Phase 6へ（PMが「進行中」に更新）
> 2. もう少し検討が必要 → 承認保留 に更新
> 3. 却下 → 却下 に更新
> 4. 引き続き仕様確認（コメントのみ追加）」

**2〜4 を選択した場合**のみ、ここで Notion を更新する:
```bash
npx tsx .claude/skills/notion-ticket-workflow/scripts/update-ticket-status.ts \
  --page-id <チケットID> \
  --status "承認保留"  # または "却下"
```

**1 を選択した場合**は Notion 更新せず Phase 6 へ進む（PM が Phase 6 冒頭で更新する）。

議論メモをNotionコメントに記録（必須）:
```
ツール: notion-create-comment
page_id: <チケットID>
content: 仕様議論まとめ（論点・各メンバー所見・決定事項）
```

---

## Phase 6: 実装 & PR

### ステップと担当者

| ステップ | 担当 | 内容 |
|---------|------|------|
| 1 | **PM** | worktree 作成（`git gtr new <branch> --base main --yes`） |
| 2 | **PM** | Notion を「**進行中**」に更新 |
| 3 | **Engineer** | 実装 → テスト → コミット |
| 4 | **Reviewer** | コードレビュー（`/pr-review`） |
| 5 | **Engineer** | 指摘修正 → `/create-pr` でPR作成 → **PR URLを親Claudeへ返す** |
| 6 | **PM** | Notion を「**レビュー依頼**」に更新（PR URL付き） |
| 7 | **Engineer** | CodeRabbitループ（最大3回） |

### PM の Notion 更新コマンド

**ステップ2（進行中）:**
```bash
npx tsx .claude/skills/notion-ticket-workflow/scripts/update-ticket-status.ts \
  --page-id <チケットID> \
  --status "進行中"
```

**ステップ6（レビュー依頼）:**
```bash
npx tsx .claude/skills/notion-ticket-workflow/scripts/update-ticket-status.ts \
  --page-id <チケットID> \
  --status "レビュー依頼" \
  --pr-url <PR URL>
```

> **重要**: PM が Notion 更新を担当する。親Claude・Engineer は Notion を直接更新しない。

詳細な各エージェントのプロンプト → `agents.md`

## 制約事項

- **意思決定はユーザーが行う** — どのエージェントも勝手に承認OKにしない
- **親Claudeが手を動かさない** — 調査・実装は専門エージェントに委譲
- **EngineerはPMの指示書通りに動く** — 自分でプランを立てない
- **Reviewerは実装完了後に起動** — Engineerより先に動かない
- **議論メモは必ずNotionに残す**
- **メンバー選択はユーザーが最終承認**
- **チケット選択はユーザーが行う** — PMは全件取得して一覧を返す。どれを議論するかはユーザーが決める。勝手に絞り込まない
- **PMは1人のみ** — 既存のPMがいる場合は新しくSpawnせず SendMessage で指示する。同一ロールの重複Spawnは禁止
- **NotionステータスはチケットUUIDで更新する** — PMや親Claudeが伝えるIDは短縮形の場合がある。更新前に `query-tickets.ts` でチケット名からUUIDを照合して確認する

## クリーンアップ（Phase 6実施後）

**「終了」はマージ済みとみなす** — ユーザーが「終了」と言った時点でPRはマージ済みと解釈し、worktreeを即削除する。「マージした」「PRを閉じた」を別途待たない。

親Claudeが直接実行:

```bash
git gtr rm <ブランチ名> --delete-branch --yes
```

## トラブルシューティング

- **見解が割れた場合** → そのままユーザーに提示。勝手に調整しない
- **チケット内容が薄い場合** → AskUserQuestionで補足を求めてから再分析
- **原因がコード外と判明した場合** → 「実装前に確認が必要な事項」として提示し判断を仰ぐ
- **EngineerがPMの指示通りに実装できない場合** → 親Claudeを通じてユーザーに報告。Engineerが独断で方針変更しない
- **CodeRabbitが3回転で収束しない場合** → 残りの指摘を親Claudeがユーザーに報告し判断を仰ぐ
