# Workflow Rules

## Worktree

- **コード変更には worktree を使う**: コード・ドキュメント等の変更を伴うタスクを開始する前に、必ず NEW worktree を作成する。Notion確認・調査・チケット操作だけの非コード作業では不要。
- **Worktree パスをサブエージェントへ明示**: ワークツリー作成後は `cd <worktree-path>` を実行し、サブエージェントへの指示には必ずワークツリーの絶対パスを明示すること（例:「作業ディレクトリは `/path/to/worktree` です。ファイルの読み書き・検索はすべてそのパス配下で行うこと」）。メインリポジトリのパスを渡してはいけない。
- **Worktree クリーンアップ**: ユーザーが「終了」など作業終了を示したらワークツリーを削除する。未コミットの `package-lock.json` と `settings.json` は捨てる。

## PR・セッション

- **Rules & skills**: 新しいルール・スキルはこのファイル群（`.claude/rules/`）または `CLAUDE.md` に追加する。
- **PR fix workflow**: PR番号 (`/pull/123`) またはブランチ指定で修正する場合は `fix-pr` スキルを使う。原則、同じPRにプッシュ。新PRは「分けて」と明示された場合のみ。修正完了後、ユーザーから「終了」「完了」など作業終了の意思表示があればワークツリーを削除する。
- **Session start — PR check**: セッション開始時、main以外のブランチにいる場合は `gh pr view --json number,title,url 2>/dev/null` を実行し、PRが存在すれば番号・タイトル・URLをユーザーに提示する。
- **Code change workflow**: 実装完了後は以下の順で実行する
  1. （任意）`pr-review` スキル — セキュリティ・品質・パフォーマンスを網羅的に確認したい場合のみ。軽微な変更や CodeRabbit で十分な場合は不要。
  2. `create-pr` スキル — PR作成 → CodeRabbitレビューループ（最大3回）
  3. PR URLをユーザーに報告
- **Single ticket workflow**: 承認OKのNotionチケットをシングルエージェントで処理する場合は `ticket-solo-workflow` スキルを使う。「ソロで片付けて」「チームなしで」「一人でやって」「codexでチケット処理」「シングルエージェントで」「Windowsでチケット処理」「順番にやって」などがトリガー。
- **Manual update**: UI・機能に影響する変更後は `manual-update` スキルで対応するNotionマニュアルページを更新する

## ログルール

サブエージェントを起動する前に必ず以下をターミナルに出力すること：
```
🤖 [サブエージェント起動] 目的: {目的} / タイプ: {general-purpose|Explore|Plan}
```
完了後：
```
✅ [サブエージェント完了] 結果: {一行サマリー}
```
