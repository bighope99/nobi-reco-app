---
name: claude-config-guide
description: |
  Claude Code の .claude/ ディレクトリ設定（スキル・ルール・CLAUDE.md）の作成・修正ガイド。
  以下のキーワードで使用:
  - 「スキル作成」「ルール作成」「CLAUDE.md編集」
  - 「.claude設定」「スキル修正」「ルール修正」
  - Skills, rules, or configuration work
---

# Claude 設定ガイド

nobi-reco-app プロジェクトにおける `.claude/` ディレクトリの設定作成・修正ガイド。

## ディレクトリ構成

```text
.claude/
├── skills/
│   ├── <skill-name>/SKILL.md   # ディレクトリ型スキル（推奨）
│   └── <skill-name>            # ファイル型スキル（レガシー）
├── rules                       # 自動読み込みルール
├── agents/                     # エージェント定義
├── commands/                   # カスタムコマンド
├── settings.local.json         # ローカル設定（コミット不要）
CLAUDE.md                       # プロジェクトルート指示書
```

### 各ファイルの役割

| ファイル | 読み込み | 用途 |
|---------|---------|------|
| `CLAUDE.md` | 常時 | プロジェクト全体の指示・規約 |
| `.claude/rules` | 常時 | コーディング規約・必須チェック |
| `.claude/skills/*/SKILL.md` | トリガー時 | 再利用可能な手順書・ワークフロー |

## スキルの作成・修正

### 手順

1. **`/skill-creator` スキルを呼び出す**（Skill ツールで `skill: "skill-creator"` を実行）
2. 手動で SKILL.md を書かない — `/skill-creator` がフォーマット・frontmatter・ベストプラクティスを担保する
3. 作成先: `.claude/skills/<skill-name>/SKILL.md`

### SKILL.md フォーマット

```markdown
---
name: skill-name
description: |
  スキルの説明（日本語）。
  トリガーキーワードをここに列挙する。
---

# スキルタイトル

本文...
```

### スキル設計の原則

- **1スキル1責務**: 複数の目的を混ぜない
- **トリガーを明確に**: description にユーザーが使いそうなキーワードを列挙
- **具体的なコード例**: パターンは Before/After で示す
- **簡潔に**: コンテキストウィンドウを消費するため必要最小限に

## ルールの作成・修正

### 特徴

- `.claude/rules` に記載された内容は**全会話で自動読み込み**される
- コンテキストウィンドウを常に消費するため**簡潔さが最重要**

### 適用基準

- コーディング規約（命名、インポートパス等）
- プロジェクト固有の必須パターン
- 同じ問題に2回以上引っかかった事項

### 手順

1. `skill-rule-creator` サブエージェントに委譲する（Agent ツールで `subagent_type: "skill-rule-creator"` を使用）
2. 既存ルールとの重複を確認
3. 簡潔かつアクション可能な記述にする

## CLAUDE.md の変更

### 注意点

- **全会話に影響する** — 変更は慎重に
- 簡潔に書き、詳細はスキルにリンクする
- Key References テーブルパターンを維持する

### 変更パターン

```markdown
# 新しいスキルへの参照を追加
| Topic | Reference |
|-------|-----------|
| 新トピック | `.claude/skills/new-skill` |
```

## 作業ブランチ規約

- **ブランチ**: `chore/skills-config`（`main` ベース、永続利用）
- ワークツリーがある場合はそこで作業、なければ `git checkout chore/skills-config` で切り替え
- `.claude/` のみの変更は直接 main にマージ可能

## 既存スキル一覧

| スキル | 説明 |
|--------|------|
| `notion-ticket-workflow` | Notionチケット管理 |
| `coderabbit-review-flow` | CodeRabbitレビュー対応 |
| `docs-database-conventions` | DB命名規則 |
| `supabase-jwt-auth` | JWT認証パターン |
| `supabase-query-patterns` | Supabaseクエリパターン |
| `timezone-strategy` | タイムゾーン戦略 |
| `pii-decryption-troubleshooting` | PII復号化トラブルシュート |
| `incremental-code-improvement` | 段階的コード改善 |
| `chrome-automation` | Chrome自動化 |
| `git-push-and-pr` | Git push & PR作成 |

## コミット前チェックリスト

- [ ] Skill: frontmatter（name, description）が完備
- [ ] Rule: 簡潔かつアクション可能
- [ ] 既存スキル・ルールとの重複なし
- [ ] トリガーキーワードが想定ユースケースに合致
- [ ] 新スキルの場合、CLAUDE.md の Key References に追加を検討
