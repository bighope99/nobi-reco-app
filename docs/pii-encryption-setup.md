# PII暗号化設定ガイド

## 概要

のびレコアプリケーションでは、個人識別情報（PII）をAES-256-GCMアルゴリズムで暗号化してデータベースに保存します。

## 環境変数の設定

### PII_ENCRYPTION_KEY

PIIフィールドの暗号化に使用するキーを設定します。

**形式**: 64文字の16進数文字列（32バイト）

**生成方法**:

```bash
# Node.jsで生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# OpenSSLで生成
openssl rand -hex 32
```

**設定例**:

```bash
# .env.local
PII_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

**重要事項**:
- 本番環境とステージング環境では異なるキーを使用してください
- キーは機密情報として管理し、バージョン管理システムにコミットしないでください
- キーを変更すると、既存の暗号化データは復号化できなくなります
- キーのバックアップを安全な場所に保管してください

## 暗号化対象フィールド

### m_guardiansテーブル
- `phone` - 電話番号
- `email` - メールアドレス
- `postal_code` - 郵便番号
- `address` - 住所
- `notes` - 特記事項
- `family_name` - 姓（漢字）
- `given_name` - 名（漢字）
- `family_name_kana` - 姓（カナ）
- `given_name_kana` - 名（カナ）

### m_childrenテーブル
- `parent_phone` - 保護者電話番号（DEPRECATED）
- `parent_email` - 保護者メールアドレス（DEPRECATED）
- `allergies` - アレルギー情報
- `health_notes` - 健康に関する特記事項
- `child_characteristics` - 子どもの基本特性
- `parent_characteristics` - 親の特性・要望
- `family_name` - 姓（漢字）
- `given_name` - 名（漢字）
- `family_name_kana` - 姓（カナ）
- `given_name_kana` - 名（カナ）

## 検索機能

暗号化されたPIIフィールドの検索は、検索用ハッシュテーブル（`s_pii_search_index`）経由で実行されます。

- **電話番号・メールアドレス**: SHA-256ハッシュで完全一致検索
- **名前・フリガナ**: 正規化された値で部分一致検索（`ilike`）

## 後方互換性

既存の平文データは、読み取り時に復号化を試み、失敗した場合は平文として扱います。更新時に自動的に暗号化形式に変換されます。

## トラブルシューティング

### エラー: "PII_ENCRYPTION_KEY is not defined"

環境変数が設定されていません。`.env.local`ファイルに`PII_ENCRYPTION_KEY`を追加してください。

### エラー: "PII_ENCRYPTION_KEY must be 64 hex characters"

環境変数の形式が不正です。64文字の16進数文字列（32バイト）であることを確認してください。

### データが復号化できない

- 環境変数`PII_ENCRYPTION_KEY`が正しく設定されているか確認
- 既存の平文データの場合は、更新時に自動的に暗号化されます
