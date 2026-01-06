# Change: PIIフィールドの暗号化実装

## Why
現在、個人識別情報（PII）が平文でデータベースに保存されており、セキュリティ要件（`docs/00_nonfunctional_requirements_review.md`）に違反しています。特に以下のフィールドが暗号化されていません：

- `m_guardians`テーブル: `phone`, `email`, `postal_code`, `address`, `notes`
- `m_children`テーブル: `parent_phone`, `parent_email`, `allergies`, `health_notes`, `child_characteristics`, `parent_characteristics`

セキュリティ要件では、これらのPIIフィールドはAES-256-GCMまたは同等の方法で暗号化する必要があります。

## What Changes
- **BREAKING**: データベースに保存されるPIIフィールドが暗号化形式に変更されます
- 汎用的なPII暗号化ユーティリティ（`utils/crypto/piiEncryption.ts`）を実装
- `m_guardians`テーブルへの挿入/更新時にPIIフィールドを暗号化
  - `phone`, `email`, `postal_code`, `address`, `notes`
  - `family_name`, `given_name`, `family_name_kana`, `given_name_kana`
- `m_children`テーブルへの挿入/更新時にPIIフィールドを暗号化
  - `parent_phone`, `parent_email`, `allergies`, `health_notes`, `child_characteristics`, `parent_characteristics`
  - `family_name`, `given_name`, `family_name_kana`, `given_name_kana`
- データベースからの読み取り時にPIIフィールドを復号化
- 検索用ハッシュテーブル（`s_pii_search_index`）を追加（電話番号・メールアドレス・名前の検索用）
- 既存データは更新時に暗号化形式に変換

## Impact
- Affected specs: pii-encryption (新規)
- Affected code:
  - `app/api/children/save/route.ts` - 保存時の暗号化
  - `app/api/children/[id]/route.ts` - 読み取り時の復号化
  - `app/api/children/route.ts` - 一覧取得時の復号化
  - `app/api/children/import/route.ts` - インポート時の暗号化
  - `lib/children/import-csv.ts` - CSVインポート処理
  - その他、PIIフィールドを読み書きするすべてのAPIエンドポイント
- Database: 既存データの移行が必要（後方互換性のため段階的移行を推奨）
