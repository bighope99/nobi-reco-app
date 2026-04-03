#!/bin/bash
# check-db-schema.sh
# PreToolUse hook: app/api/ ファイル編集時にSupabaseのテーブル名を docs/03_database.md と照合する
# テーブル名が見つからない場合は編集をブロック (exit 2)

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

# app/api/ 配下のファイルのみチェック
case "$FILE" in
  */app/api/*) ;;
  *) exit 0 ;;
esac

# 書き込み内容を取得 (Edit の new_string / Write の content)
CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // empty')

# Supabase の .from() クエリがなければスキップ
if ! echo "$CONTENT" | grep -qE '\.from\('; then
  exit 0
fi

# スキーマ定義ファイルを探す
SCHEMA="${CWD}/docs/03_database.md"
if [ ! -f "$SCHEMA" ]; then
  exit 0
fi

# .from('table') または .from("table") からテーブル名を抽出
TABLES=$(echo "$CONTENT" | grep -oE "\.from\(['\"][^'\"]+['\"]" | grep -oE "['\"][^'\"]*['\"]" | tr -d "\"'" | sort -u)

if [ -z "$TABLES" ]; then
  exit 0
fi

ERRORS=""
for TABLE in $TABLES; do
  if ! grep -q "$TABLE" "$SCHEMA"; then
    ERRORS="${ERRORS}\n  ❌ テーブル '$TABLE' が docs/03_database.md に存在しません"
  fi
done

if [ -n "$ERRORS" ]; then
  printf "🚨 [DBスキーマチェック] 未定義のテーブルを検出:\n%b\n\ndocs/03_database.md でテーブル名・カラム名を確認してから実装してください。\n" "$ERRORS"
  exit 2
fi

# テーブル名はOK → カラム名の確認を促す
printf "✅ [DBスキーマチェック] テーブル名OK (%s)。カラム名も docs/03_database.md で必ず確認してください。\n" "$(echo "$TABLES" | tr '\n' ' ')"
exit 0
