# Mistakes

## Case 1: CLAUDE.md に不要な @import を列挙していた

状況: `.claude/rules/` 配下のファイルは Claude Code が自動読み込みするにもかかわらず、CLAUDE.md の `# Rules` セクションで `@.claude/rules/*.md` を全列挙していた。

→ 対策: `.claude/rules/` への `@import` は不要。`@` は rules ディレクトリ外のファイルを取り込む場合のみ使う。
