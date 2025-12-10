# API仕様書 更新推奨事項

## 📋 目次

1. [更新概要](#1-更新概要)
2. [保護者管理API](#2-保護者管理api新規)
3. [子ども管理APIの変更](#3-子ども管理apiの変更)
4. [レポート管理API](#4-レポート管理api新規)
5. [既存APIの影響範囲](#5-既存apiの影響範囲)

---

## 1. 更新概要

### 1.1 背景

データベース設計の変更に伴い、以下のAPI仕様を更新する必要があります：

1. **保護者マスタテーブルの追加** → 保護者管理APIの新規作成が必要
2. **複数保護者対応** → 子ども詳細API、子ども一覧APIのレスポンス構造変更
3. **レポート保存機能** → レポート管理APIの新規作成が必要

### 1.2 影響を受けるAPI一覧

| API仕様書 | 影響内容 | 優先度 |
|----------|---------|-------|
| `16_children_list_api.md` | レスポンス構造変更（保護者情報） | 高 |
| `08_dashboard_api.md` | レスポンス構造変更（保護者連絡先） | 高 |
| 新規 | 保護者管理API作成 | 高 |
| 新規 | レポート管理API作成 | 高 |
| `17_child_registration_api.md` | 保護者情報登録方法の変更 | 中 |
| `18_child_edit_api.md` | 保護者情報編集方法の変更 | 中 |
| `20_child_summary_api.md` | 保護者情報の参照方法変更 | 低 |
| `21_child_report_api.md` | レポート保存・履歴管理機能追加 | 高 |

---

## 2. 保護者管理API（新規）

### 2.1 保護者一覧取得

**エンドポイント**: `GET /api/guardians`

**説明**: 施設内の保護者一覧を取得します。

**リクエストパラメータ**:
```typescript
{
  search?: string;          // 検索キーワード（名前・電話番号・メール）
  has_child?: boolean;      // 子どもとの紐付けがある保護者のみ
  limit?: number;           // 取得件数（デフォルト: 50）
  offset?: number;          // オフセット
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "guardians": [
      {
        "guardian_id": "uuid-guardian-1",
        "name": "田中 優子",
        "kana": "たなか ゆうこ",
        "phone": "090-1111-2222",
        "email": "[email protected]",
        "address": "東京都渋谷区...",
        "children": [
          {
            "child_id": "uuid-child-1",
            "child_name": "田中 陽翔",
            "relationship": "母",
            "is_primary": true,
            "is_emergency_contact": true
          }
        ],
        "children_count": 2,
        "created_at": "2024-01-01T00:00:00+09:00"
      }
    ],
    "total": 50,
    "has_more": false
  }
}
```

---

### 2.2 保護者詳細取得

**エンドポイント**: `GET /api/guardians/:id`

**説明**: 特定の保護者の詳細情報を取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "guardian_id": "uuid-guardian-1",
    "name": "田中 優子",
    "kana": "たなか ゆうこ",
    "phone": "090-1111-2222",
    "email": "[email protected]",
    "postal_code": "150-0001",
    "address": "東京都渋谷区神宮前1-1-1",
    "notes": "平日は18:00以降に連絡可能",

    "children": [
      {
        "child_id": "uuid-child-1",
        "child_name": "田中 陽翔",
        "kana": "たなか はると",
        "grade": "6年生",
        "class_name": "ひまわり組",
        "relationship": "母",
        "is_primary": true,
        "is_emergency_contact": true
      },
      {
        "child_id": "uuid-child-10",
        "child_name": "田中 結衣",
        "kana": "たなか ゆい",
        "grade": "1年生",
        "class_name": "ちゅうりっぷ組",
        "relationship": "母",
        "is_primary": true,
        "is_emergency_contact": true
      }
    ],

    "created_at": "2024-01-01T00:00:00+09:00",
    "updated_at": "2024-01-10T00:00:00+09:00"
  }
}
```

---

### 2.3 保護者登録

**エンドポイント**: `POST /api/guardians`

**説明**: 新規保護者を登録します。

**リクエストボディ**:
```typescript
{
  "family_name": "田中",
  "given_name": "優子",
  "family_name_kana": "たなか",
  "given_name_kana": "ゆうこ",
  "phone": "090-1111-2222",
  "email": "[email protected]",
  "postal_code": "150-0001",
  "address": "東京都渋谷区神宮前1-1-1",
  "notes": "平日は18:00以降に連絡可能"
}
```

**備考**: `facility_id`はセッション情報から自動取得

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "guardian_id": "uuid-guardian-1",
    "name": "田中 優子",
    "created_at": "2025-01-10T10:00:00+09:00"
  }
}
```

---

### 2.4 保護者情報更新

**エンドポイント**: `PUT /api/guardians/:id`

**説明**: 保護者情報を更新します。

**リクエストボディ**:
```typescript
{
  "family_name": "田中",
  "given_name": "優子",
  "phone": "090-1111-2222",
  "email": "[email protected]",
  "address": "東京都渋谷区神宮前1-1-1",
  "notes": "平日は18:00以降に連絡可能"
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "guardian_id": "uuid-guardian-1",
    "updated_at": "2025-01-10T11:00:00+09:00"
  }
}
```

---

### 2.5 保護者削除

**エンドポイント**: `DELETE /api/guardians/:id`

**説明**: 保護者を削除します（論理削除）。

**注意**: 子どもと紐付いている場合は削除できません。先に紐付けを解除してください。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "guardian_id": "uuid-guardian-1",
    "deleted_at": "2025-01-10T12:00:00+09:00"
  }
}
```

**エラーレスポンス**:
- `400 Bad Request`: 子どもと紐付いている（`GUARDIAN_HAS_CHILDREN`）

---

### 2.6 子どもへの保護者追加

**エンドポイント**: `POST /api/children/:id/guardians`

**説明**: 既存の保護者を子どもに紐付けます。

**リクエストボディ**:
```typescript
{
  "guardian_id": "uuid-guardian-1",
  "relationship": "母",              // 父 / 母 / 祖父 / 祖母 / その他
  "is_primary": true,
  "is_emergency_contact": true
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "child_id": "uuid-child-1",
    "guardian_id": "uuid-guardian-1",
    "relationship": "母",
    "is_primary": true,
    "created_at": "2025-01-10T10:00:00+09:00"
  }
}
```

---

### 2.7 子どもから保護者を削除

**エンドポイント**: `DELETE /api/children/:id/guardians/:guardian_id`

**説明**: 子どもと保護者の紐付けを削除します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "child_id": "uuid-child-1",
    "guardian_id": "uuid-guardian-1",
    "deleted_at": "2025-01-10T12:00:00+09:00"
  }
}
```

---

## 3. 子ども管理APIの変更

### 3.1 子ども一覧API（16_children_list_api.md）

**変更内容**: レスポンスの`guardians`フィールドを配列に変更

**変更前**:
```typescript
{
  "parent_name": "田中 優子",
  "parent_phone": "090-1111-2222",
  "parent_email": "[email protected]"
}
```

**変更後**:
```typescript
{
  "guardians": [
    {
      "guardian_id": "uuid-guardian-1",
      "name": "田中 優子",
      "kana": "たなか ゆうこ",
      "relationship": "母",
      "phone": "090-1111-2222",
      "email": "[email protected]",
      "is_primary": true,
      "is_emergency_contact": true
    },
    {
      "guardian_id": "uuid-guardian-2",
      "name": "田中 健一",
      "kana": "たなか けんいち",
      "relationship": "父",
      "phone": "090-2222-3333",
      "email": "[email protected]",
      "is_primary": false,
      "is_emergency_contact": true
    }
  ],
  // 後方互換性のため、主たる連絡先の情報を単独フィールドとしても残す
  "primary_guardian_name": "田中 優子",
  "primary_guardian_phone": "090-1111-2222"
}
```

**備考**:
- 既存のフロントエンドとの互換性のため、`primary_guardian_*`フィールドも残す
- 段階的に`guardians`配列への移行を推奨

---

### 3.2 子ども詳細API（16_children_list_api.md）

**変更内容**: 上記と同様に`guardians`を配列に変更

**追加クエリ例**:
```sql
-- 子どもの保護者一覧を取得
SELECT
  g.id as guardian_id,
  g.family_name || ' ' || g.given_name as name,
  g.family_name_kana || ' ' || g.given_name_kana as kana,
  cg.relationship,
  g.phone,
  g.email,
  cg.is_primary,
  cg.is_emergency_contact
FROM _child_guardian cg
INNER JOIN m_guardians g ON cg.guardian_id = g.id
WHERE cg.child_id = $1
  AND g.deleted_at IS NULL
ORDER BY cg.is_primary DESC, cg.created_at;
```

---

### 3.3 子ども登録API（17_child_registration_api.md）

**変更内容**: 保護者情報を同時登録できるように変更

**変更前**:
```typescript
{
  "family_name": "田中",
  "given_name": "陽翔",
  "parent_name": "田中 優子",
  "parent_phone": "090-1111-2222",
  "parent_email": "[email protected]"
}
```

**変更後**:
```typescript
{
  "family_name": "田中",
  "given_name": "陽翔",

  // 保護者情報（配列）
  "guardians": [
    {
      "guardian_id": "uuid-guardian-1",  // 既存の保護者の場合
      "relationship": "母",
      "is_primary": true,
      "is_emergency_contact": true
    },
    {
      // 新規保護者の場合
      "family_name": "田中",
      "given_name": "健一",
      "phone": "090-2222-3333",
      "email": "[email protected]",
      "relationship": "父",
      "is_primary": false,
      "is_emergency_contact": true
    }
  ],

  // 後方互換性のため、単一保護者形式もサポート（DEPRECATED）
  "parent_name": "田中 優子",
  "parent_phone": "090-1111-2222"
}
```

**処理内容**:
1. 子どもレコードを作成
2. `guardians`配列を処理:
   - `guardian_id`が指定されている場合: 既存保護者との紐付けを作成
   - `guardian_id`がない場合: 新規保護者を作成して紐付け
3. 後方互換性のため、`parent_*`フィールドも処理（保護者マスタに変換）

---

## 4. レポート管理API（新規）

### 4.1 レポート一覧取得

**エンドポイント**: `GET /api/reports`

**説明**: 施設内のレポート一覧を取得します。

**リクエストパラメータ**:
```typescript
{
  child_id?: string;        // 子どもフィルター
  report_type?: string;     // monthly / quarterly / annual / custom
  period_start?: string;    // 対象期間（開始）YYYY-MM-DD
  period_end?: string;      // 対象期間（終了）YYYY-MM-DD
  is_finalized?: boolean;   // 確定済みのみ
  limit?: number;           // 取得件数（デフォルト: 20）
  offset?: number;          // オフセット
}
```

**備考**: `facility_id`はセッション情報から自動取得

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "reports": [
      {
        "report_id": "uuid-report-1",
        "child_id": "uuid-child-1",
        "child_name": "田中 陽翔",
        "report_title": "2024年10月 成長レポート",
        "report_type": "monthly",
        "period_start": "2024-10-01",
        "period_end": "2024-10-31",
        "file_url": "https://...",
        "thumbnail_url": "https://...",
        "file_size_bytes": 1024000,
        "generated_by": "田中先生",
        "generated_at": "2024-11-01T10:00:00+09:00",
        "is_finalized": true,
        "finalized_at": "2024-11-01T11:00:00+09:00",
        "observation_count": 15,
        "photo_count": 10,
        "share_count": 2
      }
    ],
    "total": 50,
    "has_more": false
  }
}
```

---

### 4.2 レポート詳細取得

**エンドポイント**: `GET /api/reports/:id`

**説明**: 特定のレポートの詳細情報を取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "report_id": "uuid-report-1",
    "child_id": "uuid-child-1",
    "child_name": "田中 陽翔",
    "report_title": "2024年10月 成長レポート",
    "report_type": "monthly",
    "period_start": "2024-10-01",
    "period_end": "2024-10-31",

    "file_url": "https://...",
    "thumbnail_url": "https://...",
    "file_size_bytes": 1024000,

    "template_id": "uuid-template-1",
    "generated_by": "uuid-user-1",
    "generated_by_name": "田中先生",
    "generated_at": "2024-11-01T10:00:00+09:00",

    "is_finalized": true,
    "finalized_at": "2024-11-01T11:00:00+09:00",

    "is_shareable": true,
    "expiration_date": null,

    "observation_count": 15,
    "photo_count": 10,
    "metadata": {
      "tags": ["自立", "社会性", "好奇心"],
      "page_count": 5
    },

    "created_at": "2024-11-01T10:00:00+09:00",
    "updated_at": "2024-11-01T11:00:00+09:00"
  }
}
```

---

### 4.3 レポート生成・保存

**エンドポイント**: `POST /api/reports`

**説明**: レポートを生成してDBに保存します。

**リクエストボディ**:
```typescript
{
  "child_id": "uuid-child-1",
  "report_title": "2024年10月 成長レポート",
  "report_type": "monthly",           // monthly / quarterly / annual / custom
  "period_start": "2024-10-01",
  "period_end": "2024-10-31",
  "template_id": "uuid-template-1",   // 使用テンプレート（省略時はデフォルト）
  "is_finalized": false                // 確定フラグ（省略時はfalse）
}
```

**備考**: `facility_id`と`generated_by`はセッション情報から自動取得

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "report_id": "uuid-report-1",
    "file_url": "https://...",
    "thumbnail_url": "https://...",
    "generated_at": "2024-11-01T10:00:00+09:00",
    "processing_time_ms": 3500
  }
}
```

**処理内容**:
1. 対象期間の観察記録を取得
2. PDFを生成（レポート生成ライブラリを使用）
3. Supabase Storageにアップロード
4. `r_report`テーブルに保存

---

### 4.4 レポート削除

**エンドポイント**: `DELETE /api/reports/:id`

**説明**: レポートを削除します（論理削除）。

**注意**: 確定済み（`is_finalized = true`）のレポートは削除できません。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "report_id": "uuid-report-1",
    "deleted_at": "2025-01-10T12:00:00+09:00"
  }
}
```

**エラーレスポンス**:
- `400 Bad Request`: 確定済みレポート（`REPORT_IS_FINALIZED`）

---

### 4.5 レポート共有

**エンドポイント**: `POST /api/reports/:id/share`

**説明**: レポートを共有し、履歴を記録します。

**リクエストボディ**:
```typescript
{
  "share_method": "email",            // email / download / print
  "shared_to": "[email protected]",     // 共有先（メールアドレス等）
  "share_note": "10月の成長レポートです"  // 共有時のメモ（任意）
}
```

**備考**: `shared_by`はセッション情報から自動取得

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "share_id": "uuid-share-1",
    "report_id": "uuid-report-1",
    "share_method": "email",
    "shared_to": "[email protected]",
    "shared_at": "2024-11-01T12:00:00+09:00"
  }
}
```

**処理内容**:
1. `h_report_share`テーブルに履歴を記録
2. `share_method = 'email'`の場合、メール送信処理を実行（Phase 2以降）

---

### 4.6 レポート共有履歴取得

**エンドポイント**: `GET /api/reports/:id/history`

**説明**: レポートの共有履歴を取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "report_id": "uuid-report-1",
    "share_history": [
      {
        "share_id": "uuid-share-1",
        "shared_by": "田中先生",
        "shared_to": "[email protected]",
        "share_method": "email",
        "share_note": "10月の成長レポートです",
        "access_count": 0,
        "last_accessed_at": null,
        "shared_at": "2024-11-01T12:00:00+09:00"
      },
      {
        "share_id": "uuid-share-2",
        "shared_by": "鈴木先生",
        "shared_to": "[email protected]",
        "share_method": "download",
        "share_note": null,
        "access_count": 0,
        "last_accessed_at": null,
        "shared_at": "2024-11-02T10:00:00+09:00"
      }
    ],
    "total_shares": 2
  }
}
```

---

## 5. 既存APIの影響範囲

### 5.1 ダッシュボードAPI（08_dashboard_api.md）

**変更内容**: レスポンスの`guardian_phone`を`primary_guardian_phone`に変更

**変更前**:
```typescript
{
  "guardian_phone": "090-1111-1111"
}
```

**変更後**:
```typescript
{
  "primary_guardian_phone": "090-1111-1111",
  "primary_guardian_name": "田中 優子",

  // 詳細情報が必要な場合
  "guardians": [
    {
      "guardian_id": "uuid-guardian-1",
      "name": "田中 優子",
      "phone": "090-1111-1111",
      "is_primary": true
    }
  ]
}
```

**更新クエリ**:
```sql
-- 主たる連絡先を取得
SELECT
  c.id as child_id,
  g.family_name || ' ' || g.given_name as primary_guardian_name,
  g.phone as primary_guardian_phone
FROM m_children c
LEFT JOIN _child_guardian cg ON c.id = cg.child_id AND cg.is_primary = true
LEFT JOIN m_guardians g ON cg.guardian_id = g.id AND g.deleted_at IS NULL
WHERE c.id = $1 AND c.deleted_at IS NULL;
```

---

### 5.2 子ども成長サマリAPI（20_child_summary_api.md）

**変更内容**: 保護者情報の取得方法を変更

**既存**: `m_children.parent_phone`等を直接参照
**変更後**: `m_guardians`テーブルから取得

---

### 5.3 子どもレポートAPI（21_child_report_api.md）

**変更内容**: レポート生成後、DBに保存する処理を追加

**変更前**:
```typescript
// レポートを生成してダウンロード
POST /api/children/:id/report
→ PDFを生成して返却
```

**変更後**:
```typescript
// レポートを生成してDBに保存
POST /api/reports
→ `r_report`テーブルに保存、file_urlを返却

// レポートをダウンロード
GET /api/reports/:id/download
→ 保存されているPDFを返却

// レポートを共有
POST /api/reports/:id/share
→ `h_report_share`に履歴を記録
```

---

## 6. マイグレーション戦略

### 6.1 APIバージョニング

**推奨**: 破壊的変更を含むため、APIバージョンを`v2`に上げる

```
旧: /api/v1/children
新: /api/v2/children  # 保護者情報が配列形式

旧: /api/v1/children/:id/report  # レポート生成のみ
新: /api/v2/reports               # レポート保存・履歴管理
```

**サポート期間**: v1は6ヶ月間サポート

### 6.2 段階的移行

**Phase 1**: v2 APIを新規追加（v1と並行稼働）
**Phase 2**: フロントエンドをv2に移行
**Phase 3**: v1 APIを非推奨化（Deprecated）
**Phase 4**: v1 APIを削除

---

## 7. セキュリティ考慮事項

### 7.1 保護者情報の暗号化

**推奨**: 以下のカラムを暗号化

```sql
-- 暗号化対象
m_guardians.phone       -- AES-256-GCM
m_guardians.email       -- AES-256-GCM
m_guardians.address     -- AES-256-GCM
```

**実装方法**: Supabase Vaultまたはアプリケーションレベルの暗号化

### 7.2 アクセス制御

**保護者情報へのアクセス権限**:
- `site_admin`: 全施設
- `company_admin`: 自社の全施設
- `facility_admin`: 自施設
- `staff`: 担当クラスの子どもの保護者のみ（Phase 2）

---

**作成日**: 2025年1月10日
**最終更新**: 2025年1月10日
**関連ドキュメント**:
- `08_database_additions.md` - データベース追加仕様
- `03_database.md` - データベース設計
