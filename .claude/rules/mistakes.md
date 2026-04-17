# Mistakes

## Case 1: CLAUDE.md に不要な @import を列挙していた

状況: `.claude/rules/` 配下のファイルは Claude Code が自動読み込みするにもかかわらず、CLAUDE.md の `# Rules` セクションで `@.claude/rules/*.md` を全列挙していた。

→ 対策: `.claude/rules/` への `@import` は不要。`@` は rules ディレクトリ外のファイルを取り込む場合のみ使う。

## Case 2: worktree を作らずにメインリポジトリを直接編集した

状況: コード変更タスク（attendance/listのカレンダー修正）を開始する前に worktree を作成せず、メインリポジトリの `app/attendance/list/page.tsx` を直接編集した。workflow.md に「コード変更には worktree を使う」と明記されているにもかかわらず。

→ 対策: コード変更を伴うタスクは必ず worktree 作成を最初のステップとする。編集前に「今コードを変更しようとしているか？」を確認する。
