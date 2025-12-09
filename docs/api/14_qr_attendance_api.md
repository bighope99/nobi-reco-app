# QR出欠API仕様書

## 概要
QRコードを使用した出席管理システムのAPI群の仕様を定義します。
児童ごとに固有のQRコードを生成し、スキャンすることで迅速かつ正確な出欠確認を実現します。

---

## システムフロー

### 想定される利用シーン

#### パターンA: 児童個別QRコード方式（推奨）
1. 各児童に固有のQRコードを発行（カード形式で配布）
2. 登園時、職員がタブレット/スマホでQRコードをスキャン
3. 自動的に出席が記録される
4. 予定外の児童は警告表示

#### パターンB: 施設/クラスQRコード方式
1. 施設またはクラスごとにQRコードを生成
2. 保護者がスマホでスキャンして出席報告
3. 職員が承認

**本仕様書では パターンA（児童個別QRコード方式） を採用します。**

---

## エンドポイント一覧

### 1. 児童QRコード生成

**エンドポイント**: `POST /api/qr/generate/:childId`

**説明**: 特定の児童のQRコードを生成します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "child_id": "uuid-child-1",
    "child_name": "田中 陽翔",
    "qr_token": "QR_abc123xyz...",      // QRコード用のトークン（署名付き）
    "qr_code_url": "https://.../qr/abc123.png",  // QRコード画像URL
    "qr_code_data": "data:image/png;base64,...",  // Base64エンコードされた画像データ
    "expires_at": null,                  // 有効期限（nullの場合は無期限）
    "created_at": "2024-01-10T10:00:00+09:00"
  }
}
```

**処理内容**:
1. 児童IDをベースにトークンを生成（署名付き、改ざん防止）
2. トークンをエンコードしたQRコード画像を生成
3. Supabase Storageに保存（またはBase64で返却）
4. トークンは`qr_tokens`テーブルに記録（有効期限管理用）

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス操作可）

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 児童が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 2. 一括QRコード生成

**エンドポイント**: `POST /api/qr/generate-bulk`

**説明**: 複数の児童のQRコードを一括生成します（クラス単位など）。

**リクエストボディ**:
```typescript
{
  "child_ids": [
    "uuid-child-1",
    "uuid-child-2",
    "uuid-child-3"
  ]
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "generated_count": 3,
    "qr_codes": [
      {
        "child_id": "uuid-child-1",
        "child_name": "田中 陽翔",
        "qr_token": "QR_abc123xyz...",
        "qr_code_url": "https://.../qr/abc123.png"
      },
      {
        "child_id": "uuid-child-2",
        "child_name": "佐藤 美咲",
        "qr_token": "QR_def456uvw...",
        "qr_code_url": "https://.../qr/def456.png"
      }
      // ...
    ],
    "pdf_url": "https://.../qr/batch_2024-01-10.pdf"  // 一括印刷用PDF
  }
}
```

**処理内容**:
1. 複数の児童のQRコードを一括生成
2. PDFに結合（A4用紙、カード形式、8枚/ページなど）
3. 印刷用に最適化

**用途**: 新学期の一括発行、紛失時の再発行など

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス操作可）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効な児童ID
- `401 Unauthorized`: 認証エラー
- `500 Internal Server Error`: サーバーエラー

---

### 3. QRコードスキャン（出席記録）

**エンドポイント**: `POST /api/qr/scan`

**説明**: QRコードをスキャンして出席を記録します。

**リクエストボディ**:
```typescript
{
  "qr_token": "QR_abc123xyz...",        // スキャンしたQRコードのトークン
  "scanned_at": "2024-01-15T08:30:00+09:00",  // スキャン日時
  "location": {                         // 位置情報（任意）
    "latitude": 35.6812,
    "longitude": 139.7671
  }
}
```

**備考**: `facility_id`と`user_id`（スキャンした職員）はセッション情報から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "attendance_id": "uuid-attendance-1",
    "child_id": "uuid-child-1",
    "child_name": "田中 陽翔",
    "child_photo_url": "https://...",
    "class_name": "ひまわり組",

    // 出席情報
    "checked_in_at": "2024-01-15T08:30:00+09:00",
    "is_expected": true,                 // 出席予定だったか
    "status": "present",                 // 出席ステータス

    // スキャン情報
    "scanned_by": "田中先生",
    "scan_method": "qr"
  }
}
```

**処理内容**:
1. QRトークンを検証（署名チェック、有効期限チェック）
2. 児童IDを抽出
3. `h_attendance`テーブルに出席記録を作成
4. 出席予定パターン（`s_attendance_schedule`）と照合して`is_expected`を判定
5. 既に出席済みの場合はエラーを返す（重複チェック）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効なトークン、既に出席済み
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: QRトークンの有効期限切れ、署名検証失敗
- `404 Not Found`: 児童が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 4. QRコード検証（プレビュー）

**エンドポイント**: `POST /api/qr/verify`

**説明**: QRコードをスキャンして児童情報を確認します（出席記録はしない）。

**リクエストボディ**:
```typescript
{
  "qr_token": "QR_abc123xyz..."
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "is_valid": true,
    "child_id": "uuid-child-1",
    "child_name": "田中 陽翔",
    "child_photo_url": "https://...",
    "class_name": "ひまわり組",
    "is_expected_today": true,           // 本日の出席予定
    "is_already_checked_in": false,      // 既に出席済みか
    "token_expires_at": null
  }
}
```

**用途**: スキャン前の確認、誤スキャン防止

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効なトークン
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: QRトークンの有効期限切れ、署名検証失敗
- `500 Internal Server Error`: サーバーエラー

---

### 5. QRコード一覧取得

**エンドポイント**: `GET /api/qr/codes`

**説明**: 施設内の全児童のQRコード情報を取得します。

**リクエストパラメータ**:
```typescript
{
  class_id?: string;        // クラスフィルター（任意）
  status?: string;          // ステータスフィルター（active / expired）
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "qr_codes": [
      {
        "child_id": "uuid-child-1",
        "child_name": "田中 陽翔",
        "class_name": "ひまわり組",
        "qr_token": "QR_abc123xyz...",
        "qr_code_url": "https://.../qr/abc123.png",
        "status": "active",              // active / expired
        "created_at": "2024-01-10T10:00:00+09:00",
        "expires_at": null
      }
    ],
    "total": 25
  }
}
```

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス閲覧可）

**エラーレスポンス**:
- `400 Bad Request`: 無効なパラメータ
- `401 Unauthorized`: 認証エラー
- `500 Internal Server Error`: サーバーエラー

---

### 6. QRコード無効化

**エンドポイント**: `DELETE /api/qr/codes/:childId`

**説明**: 特定の児童のQRコードを無効化します（紛失時など）。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "child_id": "uuid-child-1",
    "revoked_at": "2024-01-15T10:00:00+09:00"
  }
}
```

**処理内容**:
1. 該当のQRトークンを無効化（`revoked_at`を更新）
2. 以降、そのトークンを使ったスキャンは拒否される
3. 新しいQRコードは再発行API（エンドポイント1）で生成

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ（※管理ページ用、Phase 2で実装予定）
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 児童が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

## データベース要件

### 使用テーブル

#### 1. qr_tokens（QRトークン管理）- 新規テーブル
```sql
CREATE TABLE IF NOT EXISTS qr_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),
  child_id UUID NOT NULL REFERENCES m_children(id),

  -- トークン情報
  token VARCHAR(255) NOT NULL UNIQUE,   -- QRトークン（署名付き）
  token_hash VARCHAR(64) NOT NULL,      -- トークンのハッシュ（検索用）

  -- QRコード画像
  qr_code_url TEXT,                     -- Supabase StorageのURL

  -- 有効期限
  expires_at TIMESTAMP WITH TIME ZONE,  -- nullの場合は無期限
  revoked_at TIMESTAMP WITH TIME ZONE,  -- 無効化日時

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- 制約
  UNIQUE (child_id, revoked_at)
);

-- インデックス
CREATE INDEX idx_qr_tokens_facility
  ON qr_tokens(facility_id)
  WHERE deleted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX idx_qr_tokens_child
  ON qr_tokens(child_id)
  WHERE deleted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX idx_qr_tokens_hash
  ON qr_tokens(token_hash)
  WHERE deleted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX idx_qr_tokens_expires
  ON qr_tokens(expires_at)
  WHERE deleted_at IS NULL AND revoked_at IS NULL;
```

#### 2. h_attendance（出欠実績ログ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）

-- スキャン方法カラム追加（必要に応じて）
ALTER TABLE h_attendance
ADD COLUMN IF NOT EXISTS scan_method VARCHAR(20) DEFAULT 'manual';
-- scan_method: 'manual' | 'qr' | 'nfc' | 'face'

CREATE INDEX idx_h_attendance_scan_method
  ON h_attendance(scan_method)
  WHERE deleted_at IS NULL;
```

#### 3. s_attendance_schedule（出席予定パターン）
```sql
-- 既存のテーブル構造（13_attendance_schedule_api.mdを参照）
```

#### 4. m_children（子どもマスタ）
```sql
-- 既存のテーブル構造（03_database.mdを参照）
```

---

## QRトークン仕様

### トークン生成ロジック

```typescript
// トークン生成例（JWT使用）
import jwt from 'jsonwebtoken';

const generateQRToken = (childId: string, facilityId: string): string => {
  const payload = {
    child_id: childId,
    facility_id: facilityId,
    issued_at: new Date().toISOString(),
    version: 1
  };

  const secret = process.env.QR_TOKEN_SECRET!;
  const token = jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: '365d'  // 1年間有効（またはnullで無期限）
  });

  return `QR_${token}`;
};

// トークン検証例
const verifyQRToken = (token: string): { child_id: string; facility_id: string } => {
  if (!token.startsWith('QR_')) {
    throw new Error('Invalid token format');
  }

  const jwtToken = token.substring(3);
  const secret = process.env.QR_TOKEN_SECRET!;

  try {
    const payload = jwt.verify(jwtToken, secret) as any;
    return {
      child_id: payload.child_id,
      facility_id: payload.facility_id
    };
  } catch (error) {
    throw new Error('Token verification failed');
  }
};
```

### QRコード画像生成

```typescript
// QRコード生成例（qrcodeライブラリ使用）
import QRCode from 'qrcode';

const generateQRCodeImage = async (token: string): Promise<string> => {
  // Data URLとして生成（Base64）
  const qrCodeDataURL = await QRCode.toDataURL(token, {
    errorCorrectionLevel: 'H',  // 高い誤り訂正レベル
    type: 'image/png',
    width: 300,                 // 300x300px
    margin: 2
  });

  return qrCodeDataURL;
};

// または画像ファイルとして保存
const generateQRCodeFile = async (token: string, outputPath: string): Promise<void> => {
  await QRCode.toFile(outputPath, token, {
    errorCorrectionLevel: 'H',
    type: 'png',
    width: 300,
    margin: 2
  });
};
```

---

## セキュリティ

### アクセス制御

#### 権限管理
本APIは以下の4つのロールに対応しています：

1. **site_admin（サイト管理者）**:
   - 自分の施設のみアクセス可能
   - 用途: 管理ページでの利用（Phase 2で実装予定）

2. **company_admin（会社管理者）**:
   - 自社が運営する全施設にアクセス可能
   - 複数施設を横断的に管理

3. **facility_admin（施設管理者）**:
   - 自施設のみアクセス可能
   - 全クラスのデータを閲覧・編集可能

4. **staff（一般職員）**:
   - 現在: 自施設の全クラスにアクセス可能
   - Phase 2: 担当クラスのみアクセス可能に制限予定（`_user_class`テーブルで管理）
   - QRコード無効化は不可（管理者のみ）

#### 施設IDの取得
- `facility_id`はリクエストパラメータではなく、セッション情報（`current_facility_id`）から自動取得します
- これにより、ユーザーが不正な施設IDを指定することを防止します
- **複数施設の切り替え機能はPhase 2で実装予定**

#### データ分離
- RLS（Row Level Security）で施設レベルのデータを分離
- クエリ実行時に`facility_id`でフィルタリング
- staffユーザーの場合、Phase 2で`_user_class`テーブルを使用したクラス単位の制限を実装予定

#### エラーハンドリング戦略
- アクセス権限がない場合: `404 Not Found`を返す
- 理由: `403 Forbidden`ではリソースの存在を推測可能になるため、セキュリティ上`404`を優先

### QRトークンのセキュリティ

#### 署名付きトークン
- JWT（JSON Web Token）を使用して署名付きトークンを生成
- 改ざん検知: トークンが改ざんされた場合は検証エラー
- 有効期限: トークンに有効期限を設定可能（デフォルト: 1年間）

#### トークン無効化
- 紛失・盗難時は即座に無効化可能
- 無効化後は同じトークンでの出席記録は拒否される
- 無効化履歴は`revoked_at`で管理

#### 位置情報検証（将来実装）
- スキャン時の位置情報を記録
- 施設の位置情報と照合して不正利用を検知（Phase 2）

---

## パフォーマンス考慮事項

### インデックス
```sql
-- 上記のテーブル定義に含まれるインデックスで対応可能
```

### キャッシュ戦略
- QRトークン: キャッシュしない（セキュリティ重視）
- QRコード画像: CDN経由で配信、長期キャッシュ（変更されないため）

### QRコード生成の最適化
- 一括生成時は非同期処理（ジョブキュー使用）
- 大量生成（100件以上）はバックグラウンドで実行
- 完了時にメール通知または画面通知

---

## エラーハンドリング

### 共通エラーコード
```typescript
{
  "QR_TOKEN_INVALID": "QRコードが無効です",
  "QR_TOKEN_EXPIRED": "QRコードの有効期限が切れています",
  "QR_TOKEN_REVOKED": "このQRコードは無効化されています",
  "ALREADY_CHECKED_IN": "既に出席済みです",
  "CHILD_NOT_FOUND": "児童が見つかりません",
  "SIGNATURE_VERIFICATION_FAILED": "QRコードの署名検証に失敗しました"
}
```

---

## UI/UX要件

### QRコードスキャン画面
```tsx
// カメラUIでQRコードをスキャン
<QRScanner
  onScan={(token) => {
    // スキャン成功時の処理
    handleScan(token);
  }}
  onError={(error) => {
    // エラー時の処理
    showError(error.message);
  }}
/>

// スキャン結果の表示
<SuccessDialog
  childName="田中 陽翔"
  childPhoto="https://..."
  className="ひまわり組"
  checkedInAt="08:30"
  isExpected={true}
/>
```

### QRコード印刷画面
```tsx
// 一括印刷用のPDFプレビュー
<PDFPreview
  qrCodes={qrCodes}
  layout="card"          // card | label | sheet
  pageSize="A4"
  cardsPerPage={8}
/>
```

---

## 印刷用カードデザイン

### カードレイアウト例
```
┌─────────────────────┐
│  のびレコ QRカード   │
│                     │
│   ┌─────────┐      │
│   │         │      │
│   │  QR CODE│      │
│   │         │      │
│   └─────────┘      │
│                     │
│  田中 陽翔           │
│  ひまわり組         │
│                     │
│  ID: 12345          │
└─────────────────────┘
```

- サイズ: 名刺サイズ（55mm × 91mm）
- 素材: ラミネート加工推奨
- 印刷: カラー印刷、300dpi以上

---

## 今後の拡張予定

### Phase 2
- 有効期限設定機能（年度ごとに再発行）
- 位置情報検証（施設外でのスキャン拒否）
- NFC対応（QRコードとNFCの併用）
- 保護者アプリ連携（QRコード表示）

### Phase 3
- 顔認証との併用（QRコード + 顔認証で二要素認証）
- 自動カメラ出欠（監視カメラでの自動検知）
- リアルタイムダッシュボード（スキャン状況のライブ表示）
- 統計分析（スキャン時刻の傾向分析）

---

**作成日**: 2025-01-09
**最終更新**: 2025-01-09
**関連ドキュメント**:
- `03_database.md` - データベース設計
- `04_api.md` - API基本設計
- `08_dashboard_api.md` - ダッシュボードAPI（出席管理連携）
- `13_attendance_schedule_api.md` - 出席予定パターンAPI
