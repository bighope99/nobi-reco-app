# Supabase データベース設定

## 概要

このディレクトリには、Nobi-Recoアプリケーションで使用するSupabaseデータベースのマイグレーションスクリプトが含まれています。

## セットアップ手順

### 1. Supabaseプロジェクトにアクセス

1. [Supabase Dashboard](https://app.supabase.com/)にログイン
2. プロジェクト `stg_nobireco` (ID: `biwqvayouhlvnumdjtjb`) を選択
3. 左サイドバーから「SQL Editor」を選択

### 2. マイグレーションの実行

#### 必須テーブルの確認

出席予定機能を使用するには、以下のテーブルが必要です:

- `m_children` (児童マスタ) - 既存
- `s_attendance_schedule` (曜日通所設定) - **要作成**

#### s_attendance_schedule テーブルの作成

1. SQL Editorで新しいクエリを作成
2. `migrations/001_create_attendance_schedule.sql` の内容をコピー
3. 実行 (Run) をクリック
4. 成功メッセージを確認

### 3. テーブルの確認

テーブルが正しく作成されたか確認:

```sql
-- テーブルの存在確認
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 's_attendance_schedule';

-- テーブル構造の確認
\d s_attendance_schedule
```

### 4. テストデータの投入（オプション）

テスト用に児童の出席予定を作成:

```sql
-- 例: 月水金の通所予定
INSERT INTO s_attendance_schedule (child_id, monday, wednesday, friday, valid_from, is_active)
SELECT
  id,
  true,  -- monday
  false, -- tuesday
  true,  -- wednesday
  false, -- thursday
  true,  -- friday
  false, -- saturday
  false, -- sunday
  CURRENT_DATE,
  true
FROM m_children
WHERE deleted_at IS NULL
LIMIT 1;
```

## マイグレーション一覧

| ファイル名 | 説明 | 状態 |
|-----------|------|------|
| `001_create_attendance_schedule.sql` | 曜日通所設定テーブルの作成 | ✅ 必須 |

## トラブルシューティング

### エラー: relation "m_children" does not exist

**原因**: 児童マスタテーブルが存在しない

**解決策**:
1. プロジェクトのメインDBスキーマを確認
2. `docs/03_database.md` を参照してm_childrenテーブルを作成

### エラー: permission denied

**原因**: ユーザーにテーブル作成権限がない

**解決策**:
1. Supabase Dashboardで実行（管理者権限で自動実行される）
2. またはプロジェクトオーナーに依頼

## 関連ドキュメント

- [データベース設計書](../docs/03_database.md)
- [出席予定API仕様書](../docs/api/13_attendance_schedule_api.md)
- [データベース命名規則](../docs/06_database_naming_rules.md)

## 注意事項

⚠️ **本番環境での実行前に必ずバックアップを取得してください**

- Supabase Dashboard > Database > Backups から手動バックアップを作成
- または自動バックアップの有効化を確認
