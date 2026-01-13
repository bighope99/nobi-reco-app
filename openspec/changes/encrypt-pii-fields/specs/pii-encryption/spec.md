# PII暗号化仕様

## ADDED Requirements

### Requirement: PIIフィールドの暗号化
システムは、個人識別情報（PII）フィールドをデータベースに保存する前に、AES-256-GCMアルゴリズムを使用して暗号化する必要があります。

#### Scenario: 保護者情報の保存時に暗号化
- **WHEN** 保護者情報（電話番号、メールアドレス、住所、郵便番号、特記事項、氏名、フリガナ）を`m_guardians`テーブルに保存する
- **THEN** すべてのPIIフィールドが暗号化されてからデータベースに保存される
- **AND** 検索用ハッシュテーブル（`s_pii_search_index`）も同時に更新される

#### Scenario: 児童情報の保存時に暗号化
- **WHEN** 児童情報（アレルギー情報、健康に関する特記事項、子どもの特性、親の特性・要望、氏名、フリガナ）を`m_children`テーブルに保存する
- **THEN** すべてのPIIフィールドが暗号化されてからデータベースに保存される
- **AND** 検索用ハッシュテーブル（`s_pii_search_index`）も同時に更新される

#### Scenario: 保護者情報の読み取り時に復号化
- **WHEN** 保護者情報を`m_guardians`テーブルから読み取る
- **THEN** 暗号化されたPIIフィールドが自動的に復号化されて返される

#### Scenario: 児童情報の読み取り時に復号化
- **WHEN** 児童情報を`m_children`テーブルから読み取る
- **THEN** 暗号化されたPIIフィールドが自動的に復号化されて返される

#### Scenario: 既存データの後方互換性
- **WHEN** 暗号化されていない既存データを読み取る
- **THEN** 復号化に失敗した場合は平文として扱い、エラーを発生させない

### Requirement: 暗号化ユーティリティ
システムは、PIIフィールドの暗号化と復号化を行う汎用的なユーティリティ関数を提供する必要があります。

#### Scenario: 暗号化関数の使用
- **WHEN** `encryptPII(plaintext: string)`を呼び出す
- **THEN** AES-256-GCMアルゴリズムで暗号化された文字列が返される
- **AND** 暗号化キーが設定されていない場合はエラーが発生する

#### Scenario: 復号化関数の使用
- **WHEN** `decryptPII(encrypted: string)`を呼び出す
- **THEN** 復号化された平文が返される
- **AND** 復号化に失敗した場合は`null`が返される

### Requirement: 暗号化キーの管理
システムは、環境変数`PII_ENCRYPTION_KEY`から暗号化キーを取得する必要があります。

#### Scenario: 暗号化キーの取得
- **WHEN** 暗号化ユーティリティが暗号化キーを取得する
- **THEN** 環境変数`PII_ENCRYPTION_KEY`から64文字の16進数文字列（32バイト）を読み取る
- **AND** 環境変数が設定されていない、または不正な形式の場合はエラーが発生する

### Requirement: 検索機能の対応
システムは、暗号化されたPIIフィールドに対する検索機能を提供する必要があります。検索は検索用ハッシュテーブル（`s_pii_search_index`）経由で実行されます。

#### Scenario: 電話番号による検索
- **WHEN** 保護者または児童を電話番号で検索する
- **THEN** 検索用ハッシュテーブルから該当する`entity_id`を取得し、本体テーブルから詳細情報を取得する
- **AND** 検索用ハッシュテーブルには正規化された電話番号のSHA-256ハッシュが保存されている

#### Scenario: メールアドレスによる検索
- **WHEN** 保護者をメールアドレスで検索する
- **THEN** 検索用ハッシュテーブルから該当する`entity_id`を取得し、本体テーブルから詳細情報を取得する
- **AND** 検索用ハッシュテーブルにはメールアドレスのSHA-256ハッシュが保存されている

#### Scenario: 名前による部分一致検索（一覧画面）
- **WHEN** 児童一覧画面で名前による部分一致検索を実行する（`/api/children?search=...`）
- **THEN** 検索用ハッシュテーブルの`normalized_value`カラムで`ilike`検索を実行し、該当する`entity_id`を取得する
- **AND** 取得した`entity_id`から本体テーブルから詳細情報を取得する

#### Scenario: メンション機能での名前表示
- **WHEN** メンション機能で児童リストを取得する（`/api/children?class_id=...`）
- **THEN** 取得時に復号化された名前が返される
- **AND** クライアント側で文字検索するため、データベースでの検索は不要

## MODIFIED Requirements

### Requirement: 児童情報の保存API
児童情報を保存するAPIは、PIIフィールドを暗号化してからデータベースに保存する必要があります。

#### Scenario: 児童情報の保存
- **WHEN** `POST /api/children/save`で児童情報を保存する
- **THEN** `allergies`, `health_notes`, `child_characteristics`, `parent_characteristics`, `family_name`, `given_name`, `family_name_kana`, `given_name_kana`フィールドが暗号化されて保存される
- **AND** 保護者情報（`m_guardians`テーブル）の`phone`, `email`, `postal_code`, `address`, `notes`, `family_name`, `given_name`, `family_name_kana`, `given_name_kana`フィールドも暗号化されて保存される
- **AND** 検索用ハッシュテーブル（`s_pii_search_index`）も同時に更新される

### Requirement: 児童情報の取得API
児童情報を取得するAPIは、暗号化されたPIIフィールドを復号化して返す必要があります。

#### Scenario: 児童情報の取得
- **WHEN** `GET /api/children/:id`で児童情報を取得する
- **THEN** 暗号化されたPIIフィールドが復号化されて返される
- **AND** 保護者情報も復号化されて返される
