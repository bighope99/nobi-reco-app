# 保護者情報API仕様書

## 概要

保護者（guardian）情報の管理仕様をまとめたリファレンスドキュメントです。
保護者専用のAPIルートは存在せず、全操作は児童（children）APIの内部処理として実装されています。
このドキュメントは各APIドキュメントに分散している保護者関連情報を一元化したものです。

---

## アーキテクチャ方針

- 保護者と児童はN:M関係（`_child_guardian`中間テーブル）
- 同一施設内で同じ電話番号の保護者は1レコードを共有する（兄弟児童がいる場合も同一guardian_id）
- `m_guardians.family_name` に氏名全体を格納し、`given_name` は空文字で保持（名前分割なし）
- 全PIIフィールドはAES-256-GCMで暗号化して保存

---

## エンドポイント一覧（保護者関連処理）

### 1. 保護者の作成・更新

**エンドポイント**: `POST /api/children/save`（新規登録）/ `PUT /api/children/[id]`（更新）

**リクエストボディの保護者関連部分**:
```typescript
{
  contact?: {
    parent_name?: string;      // 保護者氏名（フルネーム）
    parent_phone?: string;     // 保護者電話番号
    parent_email?: string;     // 保護者メールアドレス
    emergency_contacts?: Array<{
      name: string;            // 緊急連絡先氏名
      relation: string;        // 続柄
      phone: string;           // 電話番号
    }>;
  };
}
```

**制約**:
- 緊急連絡先は最大2件（`MAX_EMERGENCY_CONTACTS = 2`）

**電話番号バリデーション**:
- `normalizePhone()` で正規化後10〜15桁必須

**詳細**: `docs/api/17_child_registration_api.md`、`docs/api/18_child_edit_api.md` 参照

---

### 2. 保護者情報の取得

**エンドポイント**: `GET /api/children/[id]`

**レスポンスの保護者関連部分**:
```json
{
  "contact": {
    "parent_name": "田中 優子",
    "parent_phone": "09011112222",
    "parent_email": "tanaka@example.com",
    "emergency_contacts": [
      {
        "name": "田中 健一",
        "relation": "父",
        "phone": "09022223333"
      }
    ]
  }
}
```

- `m_guardians` が存在しない場合は `m_children.parent_*` カラムにフォールバック（後方互換）

---

### 3. 児童一覧での保護者情報

**エンドポイント**: `GET /api/children`

- 一覧レスポンスに `parent_name`、`parent_phone` を含む
- バッチ復号化（`batchDecryptGuardianPhones()`）で効率化

**詳細**: `docs/api/16_children_list_api.md` 参照

---

### 4. 兄弟検索（電話番号ベース）

**エンドポイント**: `POST /api/children/search-siblings`

**処理フロー**:
1. 入力電話番号を正規化
2. SHA-256ハッシュで `s_pii_search_index`（entity_type='guardian'）を検索
3. ヒットした guardian_id から `_child_guardian` 経由で child_id 取得
4. 自施設内の児童のみ返却（編集モード時は本人除外）

---

### 5. CSVインポート

**エンドポイント**: `POST /api/children/import`

- CSVカラムに保護者情報（保護者名、電話番号、メール）を含む

**詳細**: `docs/api/19_child_import_api.md` 参照

---

### 6. CSVエクスポート

**エンドポイント**: `GET /api/children/export`

- エクスポートCSVに保護者・緊急連絡先情報（最大2件）を含む

**詳細**: `docs/api/25_data_export_api.md` 参照

---

## データベース設計

### `m_guardians`（保護者マスタ）

詳細なDDLは `docs/03_database.md` 参照。

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | PK |
| facility_id | UUID | 施設ID（FK: m_facilities） |
| family_name | TEXT | 氏名全体（暗号化）。given_nameは常に空文字 |
| given_name | TEXT | 常に空文字（後方互換で保持） |
| family_name_kana | TEXT | 氏名カナ（暗号化） |
| given_name_kana | TEXT | 名カナ（暗号化） |
| phone | TEXT | 電話番号（暗号化） |
| email | TEXT | メールアドレス（暗号化） |
| postal_code | VARCHAR(10) | 郵便番号（非暗号化） |
| address | TEXT | 住所（非暗号化） |
| notes | TEXT | 特記事項 |
| created_at / updated_at / deleted_at | TIMESTAMPTZ | タイムスタンプ（論理削除） |

---

### `_child_guardian`（子ども-保護者紐付け）

| カラム | 型 | 説明 |
|---|---|---|
| child_id | UUID | FK: m_children |
| guardian_id | UUID | FK: m_guardians |
| relationship | VARCHAR(20) | 続柄（主たる保護者は '保護者'、緊急連絡先は指定値 or 'その他'） |
| is_primary | BOOLEAN | 主たる連絡先フラグ（主保護者: true） |
| is_emergency_contact | BOOLEAN | 緊急連絡先フラグ（主保護者も true） |

制約: `UNIQUE(child_id, guardian_id)`

**`is_primary` と `is_emergency_contact` の組み合わせ**:

| パターン | is_primary | is_emergency_contact |
|---|---|---|
| 主たる保護者 | true | true |
| 緊急連絡先のみ | false | true |

---

### `s_pii_search_index`（PII検索用ハッシュ）

entity_type='guardian' として保護者のPII検索用ハッシュを保持。

| search_type | 内容 |
|---|---|
| 'phone' | 正規化済み電話番号のSHA-256ハッシュ |
| 'email' | メールアドレスのSHA-256ハッシュ |
| 'name' | 氏名のSHA-256ハッシュ |

---

### レガシーカラム（`m_children`）

`m_children.parent_name`、`parent_phone`、`parent_email` は非推奨（2026年1月移行済み）。
新規保存時は `m_guardians` + `_child_guardian` を使用しつつ、後方互換のためレガシーカラムにも暗号化値を書き込む（`fitColumnLength()` によるサイズ制限あり）。
読み取り時は `m_guardians` のデータを優先し、存在しない場合にレガシーカラムにフォールバック。

---

## PII暗号化仕様

### 暗号化対象フィールド

`m_guardians` の以下カラム: `family_name`、`given_name`、`family_name_kana`、`given_name_kana`、`phone`、`email`

### 暗号化・復号化ユーティリティ

| 関数 | ファイル | 用途 |
|---|---|---|
| `encryptPII(value)` | `utils/crypto/piiEncryption.ts` | AES-256-GCM暗号化。Base64url形式で返す |
| `decryptOrFallback(value)` | `utils/crypto/decryption-helper.ts` | 復号化。復号失敗時は元の値をそのまま返す（レガシーデータ互換） |
| `formatName([family, given], sep)` | `utils/crypto/decryption-helper.ts` | 姓・名を結合して整形 |
| `batchDecryptGuardianPhones()` | `utils/crypto/batch-decryption.ts` | 一覧取得時のバッチ復号化（施設IDベースのキャッシュ付き） |

### 検索用ハッシュインデックス

暗号化されたフィールドは直接WHERE検索できないため、SHA-256ハッシュを `s_pii_search_index` に保存して検索を実現する。

```typescript
// 電話番号で保護者を検索
const guardianIds = await searchByPhone(supabase, 'guardian', normalizedPhone);
// メールアドレスで検索
const guardianIds = await searchByEmail(supabase, 'guardian', email);
```

ユーティリティ: `utils/pii/searchIndex.ts`（`updateSearchIndex`, `searchByPhone`, `searchByEmail`, `deleteSearchIndex`）

---

## 型定義

```typescript
// 保護者保存時の入力（app/api/children/save/route.ts）
interface ChildPayload {
  contact?: {
    parent_name?: string;
    parent_phone?: string;
    parent_email?: string;
    emergency_contacts?: Array<{
      name: string;
      relation: string;
      phone: string;
    }>;
  };
}

// 保護者詳細取得時（app/api/children/[id]/route.ts）
interface Guardian {
  id: string;
  facility_id: string;
  family_name: string;  // 暗号化済み（取得時に復号化）
  given_name: string;   // 常に空文字
  family_name_kana?: string;
  given_name_kana?: string;
  phone?: string;       // 暗号化済み（取得時に復号化）
  email?: string;       // 暗号化済み（取得時に復号化）
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface GuardianRelation {
  guardian_id: string;
  relationship?: string | null;
  is_primary: boolean;
  is_emergency_contact: boolean;
  m_guardians: Guardian | null;
}
```

---

## 処理フロー

### 保護者作成・更新フロー（saveChild 関数内）

1. `contact.parent_name` が空なら保護者同期をスキップ（`shouldSyncGuardians = false`）
2. 緊急連絡先の最大件数チェック（2件超はステータス400）
3. 緊急連絡先の電話番号バリデーション（10〜15桁）
4. **主たる保護者の処理** (`processPrimaryGuardian`):
   - 電話番号またはメールで `searchByPhone` / `searchByEmail` → `m_guardians` の既存レコード検索
   - 既存あり: `family_name`（氏名全体）・`phone`・`email` を暗号化してUPDATE + 検索インデックス更新
   - 既存なし: `m_guardians` に INSERT（`family_name`=氏名全体、`given_name`=''）+ 検索インデックス作成
   - `_child_guardian` に UPSERT（`is_primary=true`, `is_emergency_contact=true`, `relationship='保護者'`）
5. **緊急連絡先の処理** (`processEmergencyContact`、各件並列実行):
   - 電話番号で既存の保護者レコードを検索して同様にアップサート
   - `_child_guardian` に UPSERT（`is_primary=false`, `is_emergency_contact=true`）
6. **不要リンク削除**（更新時のみ）:
   - 更新前の guardian_id リストと新規 guardian_id リストを比較
   - 差分を `_child_guardian` からDELETE（保護者レコード自体は残す）
7. レガシーカラム（`m_children.parent_*`）にも暗号化値を書き込み

---

### 兄弟検索フロー

1. 入力電話番号を `normalizePhone()` で正規化
2. `s_pii_search_index`（entity_type='guardian', search_type='phone'）をSHA-256ハッシュで検索
3. ヒットした entity_id（guardian_id）を取得
4. `m_guardians` を facility_id でフィルタリング（自施設のみ）
5. `_child_guardian` から guardian_id に紐づく child_id を取得
6. 編集モード時は本人（current child_id）を除外して返却

---

## フロントエンド連携

保護者専用の管理画面・カスタムフックは存在しない。全て児童フォームに組み込み。

**`components/children/ChildForm.tsx`**:
- 「保護者情報（筆頭者）」セクション: `parent_name`（必須）、`parent_phone`、`parent_email`
- 緊急連絡先: 最大2件の動的追加（`name`, `relation`, `phone`）
- 電話番号入力時に500msデバウンスで自動兄弟検索（`/api/children/search-siblings`）

**`app/children/page.tsx`**:
- 児童一覧テーブルに「保護者連絡先」カラム表示
- 検索プレースホルダー: 「名前・保護者名で検索...」

---

## 注意事項・制約

- **保護者の直接削除APIは存在しない**: リンク削除時に `m_guardians` レコード自体は削除されない
- **`given_name` は常に空文字**: 氏名全体を `family_name` に格納する設計（名前分割なし）
- **レガシーカラムのサイズ制限**: `fitColumnLength()` により暗号文が既存カラム長を超えるとレガシーカラムへの書き込みはスキップされる
- **同一電話番号の保護者は1レコードに集約**: 同一施設内で同じ電話番号の保護者は同一 guardian_id を使用
- **`skipParentLegacy` オプション**: CSVインポート等でレガシーカラムへの書き込みをスキップできる

---

## 関連ドキュメント

| ドキュメント | 内容 |
|---|---|
| `docs/api/17_child_registration_api.md` | 子ども登録API（保護者作成の元処理） |
| `docs/api/18_child_edit_api.md` | 子ども編集API（保護者更新の元処理） |
| `docs/api/16_children_list_api.md` | 子ども一覧API（保護者情報の表示） |
| `docs/api/19_child_import_api.md` | CSVインポート（保護者の一括登録） |
| `docs/api/25_data_export_api.md` | データエクスポート（保護者情報のCSV出力） |
| `docs/03_database.md` | DBスキーマ（m_guardians・_child_guardian のDDL） |
| `docs/pii-encryption-setup.md` | PII暗号化セットアップ詳細 |

---

**作成日**: 2026-03-27
**最終更新**: 2026-03-27
