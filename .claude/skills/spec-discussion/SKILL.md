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

## メンバー構成

| ロール | 常駐 | 担当範囲 | モデル |
|--------|------|---------|--------|
| **PM** | ✅ 常時 | オーケストレーション・メンバー選択・ユーザー報告。手を動かさない | **Opus** |
| **Planner** | ✅ 常時 | Notionチケット取得・論点整理・実装指示書作成 | Sonnet |
| **Designer (UI/UX)** | 任意 | 画面フロー・UX・既存デザインとの整合性 | Sonnet |
| **Code Reviewer (Engr. Director)** | 任意 | 技術的妥当性・影響範囲・アーキテクチャ（上流判断） | Sonnet |
| **Researcher** | 任意 | コード内外両方を調査。原因がコード外の可能性も含めて探る | Sonnet |
| **Engineer (Coder)** | 任意 | Plannerの指示書通りに実装するだけ。自分でプランを立てない | Sonnet |
| **Reviewer (Code Review)** | 任意 | Engineer完了後のコードをバグ・セキュリティ・保守性でチェック | Sonnet |

各エージェントの詳細プロンプト → `agents.md`

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
Phase 0: PM → Plannerに指示（チケット取得・論点整理・メンバー提案）
Phase 1: Plannerの出力をPMがユーザーへ提示
Phase 2: ユーザーが議題とメンバー構成を承認/調整
Phase 3: 並列分析（選ばれたメンバーが同時に動く）
         ※ Reviewerだけ Engineer完了後に起動（順次）
Phase 4: PMが全結果を統合 → ユーザーへ提示
Phase 5: 意思決定 → Notionへ反映
```

## Phase 5: 意思決定 → Notion反映

`AskUserQuestion` で確認:

> 「上記の議論を踏まえて、どうしますか？
> 1. 実装を進める → 承認OK に更新
> 2. もう少し検討が必要 → 承認保留 に更新
> 3. 却下 → 却下 に更新
> 4. 引き続き仕様確認（コメントのみ追加）」

```bash
npx tsx .claude/skills/notion-ticket-workflow/scripts/update-ticket-status.ts \
  --page-id <チケットID> \
  --status "承認OK"
```

議論メモをNotionコメントに記録:
```
ツール: notion-create-comment
page_id: <チケットID>
content: 仕様議論まとめ（論点・各メンバー所見・決定事項）
```

## 制約事項

- **意思決定はユーザーが行う** — どのエージェントも勝手に承認OKにしない
- **PMは手を動かさない** — 調査・実装は必ず専門エージェントに委譲
- **EngineerはPlannerの指示書通りに動く** — 自分でプランを立てない
- **Reviewerは実装完了後に起動** — Engineerより先に動かない
- **議論メモは必ずNotionに残す**
- **メンバー選択はユーザーが最終承認**

## トラブルシューティング

- **見解が割れた場合** → そのままユーザーに提示。PMが勝手に調整しない
- **チケット内容が薄い場合** → AskUserQuestionで補足を求めてから再分析
- **原因がコード外と判明した場合** → 「実装前に確認が必要な事項」として提示し判断を仰ぐ
- **EngineerがPlannerの指示通りに実装できない場合** → PMを通じてユーザーに報告。Engineerが独断で方針変更しない
