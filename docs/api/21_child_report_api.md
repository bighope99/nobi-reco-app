# レポート生成API仕様書

## 概要
児童の成長レポート自動生成機能のAPI仕様を定義します。
月次レポート、学期レポート、年次レポートなど、様々な形式のレポートをPDF/HTMLで生成し、保護者との共有を促進します。

---

## システムフロー

### 想定される利用シーン

1. **月次レポート作成**:
   - 毎月末に保護者へ配布するレポート
   - その月の活動・成長の記録

2. **学期末レポート**:
   - 学期ごとの総括レポート
   - より詳細な成長分析

3. **個別面談資料**:
   - 保護者面談時の資料
   - カスタマイズ可能な内容

4. **卒園記念アルバム**:
   - 在園期間全体の記録
   - 写真とエピソードのまとめ

---

## エンドポイント一覧

### 1. レポート生成（プレビュー）

**エンドポイント**: `POST /api/children/:id/report/generate`

**説明**: 児童の成長レポートを生成します。まずHTMLプレビューを返し、確認後にPDF生成が可能です。

**リクエストボディ**:
```typescript
{
  // レポート種類
  "report_type": "monthly",        // monthly / term / annual / custom

  // 対象期間
  "period": {
    "start_date": "2024-01-01",
    "end_date": "2024-01-31"
  },

  // テンプレート選択
  "template": "standard",          // standard / detailed / simple / photo_album

  // 含める内容（カスタマイズ）
  "include": {
    "summary": true,               // 成長サマリ
    "observations": true,          // 観察記録
    "activities": true,            // 活動記録
    "photos": true,                // 写真
    "attendance": true,            // 出席状況
    "growth_chart": true,          // 成長グラフ
    "strengths": true,             // 強み
    "growth_areas": true,          // のびしろ
    "teacher_comment": true        // 担任コメント
  },

  // 追加設定
  "options": {
    "max_photos": 10,              // 含める写真の最大数
    "language": "ja",              // ja / en
    "color_scheme": "default"      // default / colorful / monochrome
  },

  // カスタムコメント（任意）
  "custom_comment": "今月は運動会の練習を頑張りました。"
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "report_id": "uuid-report-1",
    "child_id": "uuid-child-1",
    "child_name": "田中 陽翔",

    // レポート情報
    "report_info": {
      "type": "monthly",
      "period_start": "2024-01-01",
      "period_end": "2024-01-31",
      "template": "standard",
      "generated_at": "2024-01-15T10:00:00+09:00"
    },

    // HTMLプレビュー
    "preview_html": "<html>...</html>",
    "preview_url": "https://.../tmp/report-preview-uuid.html",

    // レポートデータ
    "report_data": {
      // 基本情報
      "child_info": {
        "name": "田中 陽翔",
        "kana": "タナカ ハルト",
        "age": 5,
        "class_name": "ひまわり組",
        "photo_url": "https://..."
      },

      // 期間情報
      "period": {
        "year": 2024,
        "month": 1,
        "display_label": "2024年1月"
      },

      // 出席状況
      "attendance": {
        "total_days": 20,
        "attended_days": 19,
        "absent_days": 1,
        "attendance_rate": 95.0
      },

      // 今月の様子（サマリー）
      "summary": {
        "title": "今月の様子",
        "content": "積み木遊びに夢中になり、集中力が向上しています。お友達と協力して遊ぶ姿も見られるようになりました。",
        "generated_by": "ai"  // ai / manual
      },

      // 成長グラフデータ
      "growth_chart": {
        "categories": [
          {
            "name": "社会性・コミュニケーション",
            "score": 75
          },
          {
            "name": "身体・運動",
            "score": 85
          },
          {
            "name": "言語・表現",
            "score": 70
          },
          {
            "name": "認知・思考",
            "score": 80
          },
          {
            "name": "生活習慣",
            "score": 90
          }
        ]
      },

      // 強み（上位3つ）
      "strengths": [
        {
          "title": "生活習慣がしっかり身についている",
          "description": "食事や着替えを自分でできるようになりました。"
        },
        {
          "title": "運動能力が高い",
          "description": "鉄棒で前回りができるようになりました。"
        },
        {
          "title": "集中力が向上",
          "description": "パズルに長時間取り組めるようになりました。"
        }
      ],

      // のびしろ
      "growth_areas": [
        {
          "title": "お友達との関わりを増やす",
          "description": "集団遊びの機会を増やしていきます。"
        }
      ],

      // 今月のハイライト（主な活動・観察）
      "highlights": [
        {
          "date": "2024-01-14",
          "title": "100ピースのパズルを完成",
          "category": "認知・思考",
          "photo_url": "https://..."
        },
        {
          "date": "2024-01-12",
          "title": "鉄棒で前回りができた",
          "category": "身体・運動",
          "photo_url": "https://..."
        }
      ],

      // 写真ギャラリー
      "photos": [
        {
          "photo_url": "https://...",
          "caption": "積み木で遊ぶ様子",
          "date": "2024-01-10"
        }
      ],

      // 担任コメント
      "teacher_comment": {
        "comment": "今月は特に運動面での成長が見られました。鉄棒での前回りができるようになり、自信をつけています。",
        "teacher_name": "山田 太郎",
        "signed_at": "2024-01-31"
      }
    },

    // 有効期限（プレビューURL）
    "expires_at": "2024-01-15T11:00:00+09:00"
  },
  "message": "レポートを生成しました"
}
```

**処理内容**:
1. 指定期間のデータを集計:
   - 観察記録
   - 活動記録
   - 出席記録
   - 写真
2. AIによる自然言語生成（Phase 2）:
   - サマリーの自動生成
   - 強み・のびしろの抽出
3. HTMLテンプレートにデータを埋め込み
4. プレビューURLを生成（1時間有効）
5. レポートメタ情報を`h_generated_reports`に保存

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス作成可）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足、無効な期間設定
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 児童が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 2. レポートPDF生成

**エンドポイント**: `POST /api/children/:id/report/:reportId/pdf`

**説明**: プレビュー確認後、レポートをPDFファイルとして生成します。

**リクエストボディ**:
```typescript
{
  "confirm": true,
  "options": {
    "page_size": "A4",             // A4 / Letter
    "orientation": "portrait",      // portrait / landscape
    "margin": "normal"              // normal / narrow / wide
  }
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "report_id": "uuid-report-1",
    "pdf_url": "https://storage.supabase.co/.../reports/uuid-report-1.pdf",
    "filename": "成長レポート_田中陽翔_2024年1月.pdf",
    "file_size": 2457600,           // bytes
    "page_count": 3,
    "generated_at": "2024-01-15T10:30:00+09:00",

    // ダウンロード用の署名付きURL（24時間有効）
    "download_url": "https://storage.supabase.co/.../reports/uuid-report-1.pdf?token=...",
    "expires_at": "2024-01-16T10:30:00+09:00"
  },
  "message": "PDFを生成しました"
}
```

**処理内容**:
1. HTMLプレビューをPDFに変換（Puppeteer使用）
2. Supabase Storageに保存
3. メタ情報を`h_generated_reports`に更新
4. 署名付きURLを生成

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス作成可）

**エラーレスポンス**:
- `400 Bad Request`: 無効なreport_id
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: レポートが見つからない、またはアクセス権限なし
- `500 Internal Server Error`: PDF生成エラー

---

### 3. レポート一覧取得

**エンドポイント**: `GET /api/children/:id/reports`

**説明**: 児童の過去に生成したレポート一覧を取得します。

**リクエストパラメータ**:
```typescript
{
  report_type?: string;  // monthly / term / annual / custom
  limit?: number;        // 取得件数（デフォルト: 20）
  offset?: number;       // オフセット
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "reports": [
      {
        "report_id": "uuid-report-1",
        "report_type": "monthly",
        "period_start": "2024-01-01",
        "period_end": "2024-01-31",
        "title": "2024年1月 成長レポート",
        "template": "standard",
        "pdf_url": "https://...",
        "thumbnail_url": "https://...",
        "generated_by": "山田 太郎",
        "generated_at": "2024-01-31T10:00:00+09:00",
        "status": "completed"          // draft / completed
      },
      {
        "report_id": "uuid-report-2",
        "report_type": "term",
        "period_start": "2023-09-01",
        "period_end": "2023-12-31",
        "title": "2学期 成長レポート",
        "template": "detailed",
        "pdf_url": "https://...",
        "thumbnail_url": "https://...",
        "generated_by": "佐藤 花子",
        "generated_at": "2023-12-31T15:00:00+09:00",
        "status": "completed"
      }
    ],
    "total": 12,
    "has_more": false
  }
}
```

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス閲覧可）

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: 児童が見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 4. レポート詳細取得

**エンドポイント**: `GET /api/children/:id/reports/:reportId`

**説明**: 特定のレポートの詳細情報を取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "report_id": "uuid-report-1",
    "child_id": "uuid-child-1",
    "child_name": "田中 陽翔",

    // レポート情報
    "report_info": {
      "type": "monthly",
      "period_start": "2024-01-01",
      "period_end": "2024-01-31",
      "title": "2024年1月 成長レポート",
      "template": "standard",
      "status": "completed"
    },

    // ファイル情報
    "file_info": {
      "pdf_url": "https://...",
      "download_url": "https://...?token=...",
      "filename": "成長レポート_田中陽翔_2024年1月.pdf",
      "file_size": 2457600,
      "page_count": 3
    },

    // 生成情報
    "generation_info": {
      "generated_by": "山田 太郎",
      "generated_at": "2024-01-31T10:00:00+09:00",
      "generation_time_seconds": 15.3
    },

    // レポートデータ（プレビュー時と同じ構造）
    "report_data": { /* ... */ }
  }
}
```

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 担当クラスのみ（※Phase 2で実装予定、現在は全クラス閲覧可）

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: レポートが見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 5. レポート削除

**エンドポイント**: `DELETE /api/children/:id/reports/:reportId`

**説明**: 生成したレポートを削除します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "report_id": "uuid-report-1",
    "deleted_at": "2024-01-15T11:00:00+09:00"
  },
  "message": "レポートを削除しました"
}
```

**処理内容**:
1. Supabase StorageからPDFファイルを削除
2. `h_generated_reports`のレコードを論理削除

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 自分が生成したレポートのみ（※Phase 2で実装予定）

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: 権限不足（他人が生成したレポート）
- `404 Not Found`: レポートが見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 6. 一括レポート生成（クラス全体）

**エンドポイント**: `POST /api/classes/:classId/reports/bulk-generate`

**説明**: クラス全員分のレポートを一括生成します。

**リクエストボディ**:
```typescript
{
  "report_type": "monthly",
  "period": {
    "start_date": "2024-01-01",
    "end_date": "2024-01-31"
  },
  "template": "standard",
  "include": { /* ... */ },
  "options": { /* ... */ }
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "bulk_job_id": "uuid-bulk-job-1",
    "class_id": "uuid-class-1",
    "class_name": "ひまわり組",
    "total_children": 18,
    "status": "processing",        // processing / completed / failed

    // 進捗情報
    "progress": {
      "completed": 0,
      "total": 18,
      "percentage": 0
    },

    // 進捗確認用のURL
    "status_url": "/api/classes/uuid-class-1/reports/bulk-generate/uuid-bulk-job-1/status",

    "estimated_completion_time": "2024-01-15T10:15:00+09:00"
  },
  "message": "一括レポート生成を開始しました"
}
```

**処理内容**:
1. バックグラウンドジョブで各児童のレポートを生成
2. 全て完了後にZIPファイルとしてまとめる
3. 完了通知を送信（メールまたは画面通知）

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `400 Bad Request`: 必須パラメータ不足
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: 権限不足（staffユーザー）
- `404 Not Found`: クラスが見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 7. 一括生成進捗確認

**エンドポイント**: `GET /api/classes/:classId/reports/bulk-generate/:jobId/status`

**説明**: 一括レポート生成の進捗状況を取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "bulk_job_id": "uuid-bulk-job-1",
    "status": "processing",        // processing / completed / failed
    "progress": {
      "completed": 12,
      "total": 18,
      "percentage": 66.7
    },
    "results": [
      {
        "child_id": "uuid-child-1",
        "child_name": "田中 陽翔",
        "status": "completed",
        "report_id": "uuid-report-1"
      },
      {
        "child_id": "uuid-child-2",
        "child_name": "佐藤 さくら",
        "status": "processing"
      }
    ],
    "zip_url": null,               // 完了後にダウンロードURL
    "started_at": "2024-01-15T10:00:00+09:00",
    "completed_at": null
  }
}
```

**権限別アクセス制御**:
- **site_admin**: 自分の施設のみ
- **company_admin**: 自社の全施設
- **facility_admin**: 自施設のみ
- **staff**: 不可（管理者のみ）

**エラーレスポンス**:
- `401 Unauthorized`: 認証エラー
- `404 Not Found`: ジョブが見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

## データベース要件

### 使用テーブル

#### 1. h_generated_reports（生成レポート履歴）
```sql
CREATE TABLE IF NOT EXISTS h_generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),
  child_id UUID NOT NULL REFERENCES m_children(id),
  user_id UUID NOT NULL REFERENCES m_users(id),  -- 生成者

  -- レポート情報
  report_type VARCHAR(20) NOT NULL,     -- monthly / term / annual / custom
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  title VARCHAR(255),
  template VARCHAR(50),

  -- ファイル情報
  pdf_url TEXT,
  filename VARCHAR(255),
  file_size INTEGER,
  page_count INTEGER,

  -- レポートデータ（JSON）
  report_data JSONB,

  -- ステータス
  status VARCHAR(20) DEFAULT 'draft',  -- draft / completed

  -- 生成情報
  generation_time_seconds DECIMAL(10, 2),

  -- タイムスタンプ
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_h_generated_reports_facility
  ON h_generated_reports(facility_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_h_generated_reports_child
  ON h_generated_reports(child_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_h_generated_reports_user
  ON h_generated_reports(user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_h_generated_reports_type
  ON h_generated_reports(report_type)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_h_generated_reports_period
  ON h_generated_reports(period_start, period_end)
  WHERE deleted_at IS NULL;
```

#### 2. h_bulk_report_jobs（一括レポート生成ジョブ）
```sql
CREATE TABLE IF NOT EXISTS h_bulk_report_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES m_facilities(id),
  class_id UUID NOT NULL REFERENCES m_classes(id),
  user_id UUID NOT NULL REFERENCES m_users(id),

  -- ジョブ情報
  report_type VARCHAR(20) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  template VARCHAR(50),

  -- 進捗情報
  total_children INTEGER NOT NULL,
  completed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,

  -- 結果
  results JSONB,                       -- 各児童の生成結果
  zip_url TEXT,                        -- 完了後のZIPファイルURL

  -- ステータス
  status VARCHAR(20) DEFAULT 'processing',  -- processing / completed / failed

  -- タイムスタンプ
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_h_bulk_report_jobs_facility
  ON h_bulk_report_jobs(facility_id);

CREATE INDEX idx_h_bulk_report_jobs_class
  ON h_bulk_report_jobs(class_id);

CREATE INDEX idx_h_bulk_report_jobs_status
  ON h_bulk_report_jobs(status);
```

---

## レポートテンプレート仕様

### 標準テンプレート（Standard）

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>成長レポート</title>
  <style>
    /* PDF出力用のスタイル */
    @page {
      size: A4;
      margin: 20mm;
    }
    body {
      font-family: "Noto Sans JP", sans-serif;
      font-size: 11pt;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #333;
      padding-bottom: 10mm;
      margin-bottom: 10mm;
    }
    .section {
      page-break-inside: avoid;
      margin-bottom: 10mm;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>成長レポート</h1>
    <p>{{ child_name }} （{{ age }}歳・{{ class_name }}）</p>
    <p>{{ period_display }}</p>
  </div>

  <!-- 出席状況 -->
  <div class="section">
    <h2>出席状況</h2>
    <p>登園日数: {{ attended_days }}/{{ total_days }}日（出席率 {{ attendance_rate }}%）</p>
  </div>

  <!-- 今月の様子 -->
  <div class="section">
    <h2>今月の様子</h2>
    <p>{{ summary_content }}</p>
  </div>

  <!-- 成長グラフ -->
  <div class="section">
    <h2>観点別評価</h2>
    <!-- レーダーチャート画像 -->
    <img src="{{ chart_image_url }}" alt="成長グラフ" />
  </div>

  <!-- 強み -->
  <div class="section">
    <h2>強み</h2>
    <ul>
      {% for strength in strengths %}
      <li><strong>{{ strength.title }}</strong><br>{{ strength.description }}</li>
      {% endfor %}
    </ul>
  </div>

  <!-- のびしろ -->
  <div class="section">
    <h2>のびしろ</h2>
    <ul>
      {% for area in growth_areas %}
      <li><strong>{{ area.title }}</strong><br>{{ area.description }}</li>
      {% endfor %}
    </ul>
  </div>

  <!-- 写真ギャラリー -->
  <div class="section">
    <h2>今月の写真</h2>
    <div class="photo-grid">
      {% for photo in photos %}
      <div class="photo-item">
        <img src="{{ photo.photo_url }}" alt="{{ photo.caption }}" />
        <p>{{ photo.caption }}</p>
      </div>
      {% endfor %}
    </div>
  </div>

  <!-- 担任コメント -->
  <div class="section">
    <h2>担任より</h2>
    <p>{{ teacher_comment }}</p>
    <p class="signature">{{ teacher_name }}</p>
  </div>
</body>
</html>
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
   - 全クラスのレポートを生成可能

4. **staff（一般職員）**:
   - 現在: 自施設の全クラスのレポートを生成可能
   - Phase 2: 担当クラスのみに制限予定

#### 施設IDの取得
- `facility_id`はリクエストパラメータではなく、セッション情報（`current_facility_id`）から自動取得します
- これにより、ユーザーが不正な施設IDを指定することを防止します

#### データ分離
- RLS（Row Level Security）で施設レベルのデータを分離
- クエリ実行時に`facility_id`でフィルタリング

#### エラーハンドリング戦略
- アクセス権限がない場合: `404 Not Found`を返す
- 理由: `403 Forbidden`ではリソースの存在を推測可能になるため、セキュリティ上`404`を優先

### ファイル保護
- PDFファイルは署名付きURLで配信（24時間有効）
- 不正ダウンロード防止
- 保護者との共有時は別途共有URLを生成（Phase 2）

---

## パフォーマンス考慮事項

### PDF生成の最適化
- 画像の最適化（リサイズ、圧縮）
- フォントのサブセット化
- 非同期処理（バックグラウンドジョブ）

### 一括生成
- 並列処理（最大5件同時）
- 進捗通知（WebSocketまたはポーリング）
- タイムアウト設定（1件あたり最大60秒）

### キャッシュ戦略
- レポートデータ: 生成時にキャッシュ
- PDFファイル: CDN経由で配信
- テンプレート: メモリキャッシュ

---

## エラーハンドリング

### 共通エラーコード
```typescript
{
  "CHILD_NOT_FOUND": "児童が見つかりません",
  "REPORT_NOT_FOUND": "レポートが見つかりません",
  "INSUFFICIENT_DATA": "データが不足しているため、レポートを生成できません",
  "PDF_GENERATION_FAILED": "PDF生成に失敗しました",
  "TEMPLATE_NOT_FOUND": "指定されたテンプレートが見つかりません",
  "INVALID_PERIOD": "無効な期間設定です"
}
```

---

## UI/UX要件

### レポート生成フォーム
```tsx
<ReportGenerationForm
  reportType="monthly"
  period={{ start: "2024-01-01", end: "2024-01-31" }}
  template="standard"
  onGenerate={handleGenerate}
/>
```

### プレビュー画面
```tsx
<ReportPreview
  htmlContent={previewHtml}
  onConfirm={handleConfirmPdf}
  onEdit={handleEdit}
/>
```

### ダウンロードボタン
```tsx
<DownloadButton
  pdfUrl={pdfUrl}
  filename="成長レポート_田中陽翔_2024年1月.pdf"
/>
```

---

## 今後の拡張予定

### Phase 2
- AIによる自然言語生成の精度向上
- 保護者ポータルでの共有機能
- カスタムテンプレートエディタ
- 多言語対応（英語、中国語など）

### Phase 3
- 音声読み上げ機能
- 動画埋め込み
- インタラクティブレポート（Web版）
- 保護者からのフィードバック機能

---

**作成日**: 2025-01-09
**最終更新**: 2025-01-09
**関連ドキュメント**:
- `03_database.md` - データベース設計
- `04_api.md` - API基本設計
- `20_child_summary_api.md` - 成長サマリAPI
- `10_activity_record_api.md` - 活動記録API
- `11_observation_record_api.md` - 観察記録API
