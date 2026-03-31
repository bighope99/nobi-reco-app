---
name: verify-deployment
description: Vercelにデプロイされたのびレコアプリの動作をChrome MCP（mcp__claude-in-chrome__*）でブラウザ自動操作して確認するワークフロー。ユーザーが「デプロイURLを確認して」「Vercelで確認して」「プレビューURLを見て」「https://v0-nobi-reco-app-*.vercel.app を確認して」などと言ったとき、またはVercelのプレビューURLを貼り付けたときに必ずこのスキルを使う。ログイン・画面遷移・機能確認・スクリーンショット取得まで一貫して実行する。
---

# Verify Deployment

Vercel にデプロイされたのびレコアプリを Chrome ブラウザで操作して動作確認するワークフロー。

## 固定情報

| 項目 | 値 |
|------|-----|
| メールアドレス | `sample01@gmail.com` |
| パスワード | `test123` |
| ログインパスURL | `{deploymentUrl}/login` または `{deploymentUrl}/auth/login` |

---

## Step 1: デプロイURLを確認

ユーザーのメッセージからデプロイURLを抽出する。

- Vercel URLのパターン例: `https://v0-nobi-reco-app-development-git-fix-XXXX-bighope99s-projects.vercel.app`
- URLが提示されていない場合は、PR番号が分かれば以下のコマンドで取得できる

### PR のコメントから Vercel プレビュー URL を取得

PR に Vercel ボットが `*.vercel.app` のプレビューURLをコメントするので、以下で取得できる:

```bash
gh pr view <PR番号> --json comments \
  --jq '.comments[] | select(.author.login | contains("vercel")) | .body' \
  | grep -o 'https://v0-nobi-reco-app[^)]*\.vercel\.app' | head -1
```

例:
```bash
gh pr view 301 --json comments \
  --jq '.comments[] | select(.author.login | contains("vercel")) | .body' \
  | grep -o 'https://v0-nobi-reco-app[^)]*\.vercel\.app' | head -1
# → https://v0-nobi-reco-app-development-git-fix-XXXX-bighope99s-projects.vercel.app
```

- URLが提示されていない場合はユーザーに確認する

---

## Step 2: Chrome MCP ツールをロード

**必ずToolSearchでツールをロードしてから使う。** ロードせずに呼び出すとツールが見つからない。

```
ToolSearch: mcp__claude-in-chrome__
```

ロード後、利用可能なツール一覧を確認する。主に使うツール:

| ツール | 用途 |
|--------|------|
| `mcp__claude-in-chrome__tabs_context_mcp` | 既存タブ一覧の取得（最初に呼ぶ） |
| `mcp__claude-in-chrome__create_tab` | 新規タブを開く |
| `mcp__claude-in-chrome__navigate_to` | URLに移動 |
| `mcp__claude-in-chrome__find_element` | 要素の検索 |
| `mcp__claude-in-chrome__click_element` | 要素クリック |
| `mcp__claude-in-chrome__type_text` | テキスト入力 |
| `mcp__claude-in-chrome__take_screenshot` | スクリーンショット取得 |
| `mcp__claude-in-chrome__get_page_content` | ページHTML/テキスト取得 |

---

## Step 3: 既存タブを確認して新規タブを作成

```
mcp__claude-in-chrome__tabs_context_mcp
```

既存タブを確認後、新しいタブを作成してデプロイURLに移動する:

```
mcp__claude-in-chrome__create_tab: { url: "{deploymentUrl}" }
```

---

## Step 4: ログイン

ページが表示されたら現在の状態を確認する。

### ログイン画面の判定

- URLに `/login` または `/auth/login` が含まれる → ログインフォームを操作する
- ダッシュボードや他のページが表示されている → すでにログイン済みなのでスキップ

### ログイン操作

1. メールアドレス入力フィールドを見つけて `sample01@gmail.com` を入力
2. パスワード入力フィールドを見つけて `test123` を入力
3. ログインボタンをクリック
4. ダッシュボードへのリダイレクトを待機

ログイン失敗（エラーメッセージが表示された）場合は、スクリーンショットを撮ってユーザーに報告する。

ログインURLが `/login` で404になった場合は `/auth/login` を試す。

---

## Step 5: 確認したい機能を検証

ユーザーが確認したい内容に応じて操作する。ユーザーから特に指定がない場合は以下を標準確認する:

1. **ログイン後画面** — ダッシュボードが表示されているか
2. **主要メニュー** — サイドバーやナビゲーションが正常に表示されているか
3. **指定のページ** — ユーザーが修正したページ・機能を重点的に確認

各ステップでスクリーンショットを撮り、異常が見つかれば即座に報告する。

---

## Step 6: 結果を報告

確認結果をまとめてユーザーに報告する。

### 報告フォーマット

```markdown
## デプロイ確認結果

**URL**: {deploymentUrl}

### ログイン
- [OK/NG] ログイン成功 / 失敗の詳細

### 確認項目
- [OK/NG] {確認した項目1}
- [OK/NG] {確認した項目2}

### スクリーンショット
（スクリーンショットをインラインで表示）

### 問題点
（問題があれば具体的に記述。なければ「問題なし」）
```

---

## トラブルシューティング

### セッションが切れた場合

ページ操作中に `/login` へリダイレクトされた場合は Step 4 に戻って再ログインする。

### ページ読み込みが遅い場合

Vercel のコールドスタート（初回アクセス）で数秒かかる場合がある。スクリーンショットで読み込み状態を確認してから次の操作へ進む。

### 要素が見つからない場合

`mcp__claude-in-chrome__get_page_content` でページのHTMLを取得して、要素の実際の構造を確認してからセレクタを調整する。
