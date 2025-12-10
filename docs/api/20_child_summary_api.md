# 成長サマリAPI仕様書

## 概要
児童の成長を可視化するサマリ機能のAPI仕様を定義します。
観点別評価グラフ、強み・のびしろの分析、成長の推移を提供し、保護者との共有を促進します。

---

## システムフロー

### 想定される利用シーン

1. **個別面談前の準備**:
   - 保護者面談前に児童の成長状況を確認
   - 強み・課題を把握

2. **保護者への報告**:
   - 定期的な成長報告
   - 保護者ポータルでの共有

3. **指導計画の策定**:
   - 個別の成長課題に基づいた指導計画
   - クラス全体の傾向分析

---

## エンドポイント一覧

### 1. 成長サマリ取得

**エンドポイント**: `GET /api/children/:id/summary`

**説明**: 児童の成長サマリデータを取得します。観点別評価、強み、のびしろを含みます。

**リクエストパラメータ**:
```typescript
{
  period?: string;      // 集計期間: 1month / 3months / 6months / 1year / all（デフォルト: 3months）
  start_date?: string;  // 開始日（YYYY-MM-DD）
  end_date?: string;    // 終了日（YYYY-MM-DD）
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    // 児童基本情報
    "child_info": {
      "child_id": "uuid-child-1",
      "name": "田中 陽翔",
      "kana": "タナカ ハルト",
      "age": 5,
      "birth_date": "2018-05-15",
      "class_name": "ひまわり組",
      "photo_url": "https://..."
    },

    // 集計期間
    "period": {
      "start_date": "2023-10-01",
      "end_date": "2024-01-15",
      "days": 107,
      "display_label": "過去3ヶ月"
    },

    // 観点別評価（5つの領域）
    "categories": [
      {
        "category_id": "social_communication",
        "name": "社会性・コミュニケーション",
        "description": "友達との関わり、言葉でのやりとり、協調性など",
        "score": 75,                    // スコア（0-100）
        "level": "良好",                 // レベル: 優秀 / 良好 / 標準 / 要支援
        "trend": "improving",            // 傾向: improving / stable / declining
        "observation_count": 28,        // この期間の観察記録数
        "icon": "👥"
      },
      {
        "category_id": "physical_motor",
        "name": "身体・運動",
        "description": "粗大運動、微細運動、体力など",
        "score": 85,
        "level": "優秀",
        "trend": "improving",
        "observation_count": 35,
        "icon": "🏃"
      },
      {
        "category_id": "language_expression",
        "name": "言語・表現",
        "description": "言葉の理解、表現力、創造性など",
        "score": 70,
        "level": "標準",
        "trend": "stable",
        "observation_count": 22,
        "icon": "💬"
      },
      {
        "category_id": "cognitive_thinking",
        "name": "認知・思考",
        "description": "理解力、問題解決力、集中力など",
        "score": 80,
        "level": "良好",
        "trend": "improving",
        "observation_count": 25,
        "icon": "🧠"
      },
      {
        "category_id": "daily_habits",
        "name": "生活習慣",
        "description": "食事、着替え、片付け、トイレなど",
        "score": 90,
        "level": "優秀",
        "trend": "stable",
        "observation_count": 40,
        "icon": "🍽️"
      }
    ],

    // 総合評価
    "overall": {
      "total_score": 80,
      "level": "良好",
      "total_observations": 150,
      "total_activities": 120,
      "attendance_rate": 95.5
    },

    // 強み（上位3つ）
    "strengths": [
      {
        "title": "生活習慣がしっかり身についている",
        "description": "食事や着替えを自分でできるようになり、片付けも積極的に行っています。",
        "category": "生活習慣",
        "score": 90,
        "examples": [
          "お片付けを自分から進んでできるようになった（2024-01-10）",
          "着替えを一人で完了できた（2024-01-08）"
        ]
      },
      {
        "title": "運動能力が高く、積極的に体を動かす",
        "description": "走る、跳ぶ、登るなど全身運動が得意で、外遊びを楽しんでいます。",
        "category": "身体・運動",
        "score": 85,
        "examples": [
          "鉄棒で前回りができるようになった（2024-01-12）",
          "ボール投げが上手になった（2024-01-05）"
        ]
      },
      {
        "title": "集中力が向上している",
        "description": "パズルや積み木など、じっくり取り組む活動で集中力を発揮しています。",
        "category": "認知・思考",
        "score": 80,
        "examples": [
          "100ピースのパズルを完成させた（2024-01-14）",
          "絵本の読み聞かせを最後まで聞けた（2024-01-09）"
        ]
      }
    ],

    // のびしろ（改善が期待される領域）
    "growth_areas": [
      {
        "title": "お友達との関わりを増やす",
        "description": "一人遊びが多いので、集団遊びの機会を増やしていきます。",
        "category": "社会性・コミュニケーション",
        "score": 75,
        "suggestions": [
          "グループ活動への参加を促す",
          "友達と一緒に遊ぶ楽しさを体験する"
        ]
      },
      {
        "title": "言葉で気持ちを伝える練習",
        "description": "気持ちを言葉で表現するのがまだ難しい場面があります。",
        "category": "言語・表現",
        "score": 70,
        "suggestions": [
          "感情を言葉にする練習",
          "絵本を通じて表現を学ぶ"
        ]
      }
    ],

    // 成長の推移（月別）
    "trends": [
      {
        "month": "2023-10",
        "social_communication": 70,
        "physical_motor": 80,
        "language_expression": 65,
        "cognitive_thinking": 75,
        "daily_habits": 88
      },
      {
        "month": "2023-11",
        "social_communication": 72,
        "physical_motor": 82,
        "language_expression": 68,
        "cognitive_thinking": 77,
        "daily_habits": 89
      },
      {
        "month": "2023-12",
        "social_communication": 75,
        "physical_motor": 85,
        "language_expression": 70,
        "cognitive_thinking": 80,
        "daily_habits": 90
      }
    ],

    // 最近の主な成長
    "recent_milestones": [
      {
        "date": "2024-01-14",
        "title": "100ピースのパズルを完成",
        "category": "認知・思考",
        "description": "集中力と問題解決能力の向上が見られます"
      },
      {
        "date": "2024-01-12",
        "title": "鉄棒で前回りができた",
        "category": "身体・運動",
        "description": "運動能力が着実に向上しています"
      },
      {
        "date": "2024-01-10",
        "title": "お片付けを自分から進んでできた",
        "category": "生活習慣",
        "description": "自主性が育っています"
      }
    ],

    "generated_at": "2024-01-15T10:00:00+09:00"
  }
}
```

**処理内容**:
1. 指定期間の観察記録（`r_observation`）を集計
2. 活動記録（`r_activity`）を集計
3. 各カテゴリーのスコアを算出:
   - ポジティブキーワードの頻度
   - 記録数の多さ
   - 最近の傾向
4. AIによる自然言語生成（Phase 2）:
   - 強みの自動抽出
   - のびしろの提案
5. 月別推移データを生成

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

### 2. カテゴリー別詳細取得

**エンドポイント**: `GET /api/children/:id/summary/categories/:categoryId`

**説明**: 特定カテゴリーの詳細データを取得します。

**リクエストパラメータ**:
```typescript
{
  period?: string;      // 集計期間
  start_date?: string;  // 開始日
  end_date?: string;    // 終了日
}
```

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "category_id": "social_communication",
    "name": "社会性・コミュニケーション",
    "score": 75,
    "level": "良好",
    "trend": "improving",

    // サブカテゴリー別スコア
    "sub_categories": [
      {
        "name": "友達との関わり",
        "score": 70,
        "observation_count": 12
      },
      {
        "name": "言葉でのやりとり",
        "score": 78,
        "observation_count": 10
      },
      {
        "name": "協調性",
        "score": 77,
        "observation_count": 6
      }
    ],

    // 関連する観察記録（最新5件）
    "recent_observations": [
      {
        "observation_id": "uuid-obs-1",
        "date": "2024-01-14",
        "title": "友達と積み木で遊ぶ",
        "content": "お友達と一緒に積み木で高いタワーを作りました。役割分担をしながら協力できていました。",
        "tags": ["協調性", "創造性"],
        "recorded_by": "山田先生"
      }
    ],

    // 関連する活動記録（最新5件）
    "recent_activities": [
      {
        "activity_id": "uuid-act-1",
        "date": "2024-01-13",
        "title": "グループ遊び",
        "description": "お友達と鬼ごっこをして楽しんでいました",
        "category": "社会性・コミュニケーション"
      }
    ],

    // 月別推移
    "monthly_trend": [
      { "month": "2023-10", "score": 70 },
      { "month": "2023-11", "score": 72 },
      { "month": "2023-12", "score": 75 }
    ]
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
- `404 Not Found`: 児童またはカテゴリーが見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 3. クラス全体のサマリ取得

**エンドポイント**: `GET /api/classes/:classId/summary`

**説明**: クラス全体の成長傾向を取得します（比較用）。

**リクエストパラメータ**:
```typescript
{
  period?: string;      // 集計期間
}
```

**備考**: `facility_id`はセッション情報（`current_facility_id`）から自動取得します。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "class_id": "uuid-class-1",
    "class_name": "ひまわり組",
    "total_children": 18,

    // クラス平均スコア
    "average_scores": {
      "social_communication": 78,
      "physical_motor": 82,
      "language_expression": 75,
      "cognitive_thinking": 80,
      "daily_habits": 85
    },

    // 分布
    "distribution": {
      "social_communication": {
        "excellent": 5,    // 優秀（90-100）
        "good": 8,         // 良好（75-89）
        "standard": 4,     // 標準（60-74）
        "needs_support": 1 // 要支援（0-59）
      }
    },

    // 全体の傾向
    "overall_trends": {
      "improving_children": 12,
      "stable_children": 5,
      "declining_children": 1
    }
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
- `404 Not Found`: クラスが見つからない、またはアクセス権限なし
- `500 Internal Server Error`: サーバーエラー

---

### 4. 成長サマリ再計算

**エンドポイント**: `POST /api/children/:id/summary/recalculate`

**説明**: 成長サマリのスコアを再計算します（観察記録追加後など）。

**レスポンス** (成功):
```typescript
{
  "success": true,
  "data": {
    "child_id": "uuid-child-1",
    "recalculated_at": "2024-01-15T10:30:00+09:00",
    "categories": [
      {
        "category_id": "social_communication",
        "old_score": 75,
        "new_score": 77,
        "changed": true
      }
    ]
  },
  "message": "成長サマリを再計算しました"
}
```

**処理内容**:
1. 最新の観察記録・活動記録を集計
2. スコアを再計算
3. キャッシュを更新

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

## データベース要件

### 使用テーブル

#### 1. r_observation（観察記録）
```sql
-- 既存のテーブル構造（11_observation_record_api.mdを参照）

-- カテゴリー情報を追加（必要に応じて）
ALTER TABLE r_observation
ADD COLUMN IF NOT EXISTS primary_category VARCHAR(50);

ALTER TABLE r_observation
ADD COLUMN IF NOT EXISTS sub_category VARCHAR(50);

CREATE INDEX idx_r_observation_category
  ON r_observation(primary_category)
  WHERE deleted_at IS NULL;
```

#### 2. r_activity（活動記録）
```sql
-- 既存のテーブル構造（10_activity_record_api.mdを参照）
```

#### 3. m_growth_categories（成長カテゴリーマスタ）- 新規テーブル
```sql
CREATE TABLE IF NOT EXISTS m_growth_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- カテゴリー情報
  category_id VARCHAR(50) UNIQUE NOT NULL,  -- social_communication, physical_motor, etc.
  name VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),
  description TEXT,
  icon VARCHAR(10),
  display_order INTEGER DEFAULT 0,

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- 初期データ投入
INSERT INTO m_growth_categories (category_id, name, name_en, description, icon, display_order)
VALUES
  ('social_communication', '社会性・コミュニケーション', 'Social & Communication', '友達との関わり、言葉でのやりとり、協調性など', '👥', 1),
  ('physical_motor', '身体・運動', 'Physical & Motor', '粗大運動、微細運動、体力など', '🏃', 2),
  ('language_expression', '言語・表現', 'Language & Expression', '言葉の理解、表現力、創造性など', '💬', 3),
  ('cognitive_thinking', '認知・思考', 'Cognitive & Thinking', '理解力、問題解決力、集中力など', '🧠', 4),
  ('daily_habits', '生活習慣', 'Daily Habits', '食事、着替え、片付け、トイレなど', '🍽️', 5);
```

#### 4. s_growth_summary（成長サマリ集計テーブル）- 新規テーブル
```sql
CREATE TABLE IF NOT EXISTS s_growth_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES m_children(id),

  -- 集計期間
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- スコア
  social_communication_score INTEGER,
  physical_motor_score INTEGER,
  language_expression_score INTEGER,
  cognitive_thinking_score INTEGER,
  daily_habits_score INTEGER,
  overall_score INTEGER,

  -- 統計情報
  total_observations INTEGER DEFAULT 0,
  total_activities INTEGER DEFAULT 0,

  -- タイムスタンプ
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (child_id, period_start, period_end)
);

CREATE INDEX idx_s_growth_summary_child
  ON s_growth_summary(child_id);

CREATE INDEX idx_s_growth_summary_period
  ON s_growth_summary(period_start, period_end);
```

---

## クエリ例

### 成長サマリ集計クエリ

```sql
-- 観点別スコア算出
WITH category_scores AS (
  SELECT
    child_id,
    primary_category,
    COUNT(*) as observation_count,
    -- スコア算出ロジック（ポジティブキーワードの頻度、記録数など）
    CASE
      WHEN COUNT(*) >= 30 THEN 90
      WHEN COUNT(*) >= 20 THEN 80
      WHEN COUNT(*) >= 10 THEN 70
      ELSE 60
    END as score
  FROM r_observation
  WHERE child_id = $1
    AND recorded_at >= $2  -- period_start
    AND recorded_at <= $3  -- period_end
    AND deleted_at IS NULL
  GROUP BY child_id, primary_category
),
activity_counts AS (
  SELECT
    child_id,
    COUNT(*) as total_activities
  FROM r_activity
  WHERE child_id = $1
    AND activity_date >= $2
    AND activity_date <= $3
    AND deleted_at IS NULL
  GROUP BY child_id
)
SELECT
  c.child_id,
  c.family_name || ' ' || c.given_name as name,

  -- カテゴリー別スコア
  COALESCE(MAX(CASE WHEN cs.primary_category = 'social_communication' THEN cs.score END), 0) as social_communication_score,
  COALESCE(MAX(CASE WHEN cs.primary_category = 'physical_motor' THEN cs.score END), 0) as physical_motor_score,
  COALESCE(MAX(CASE WHEN cs.primary_category = 'language_expression' THEN cs.score END), 0) as language_expression_score,
  COALESCE(MAX(CASE WHEN cs.primary_category = 'cognitive_thinking' THEN cs.score END), 0) as cognitive_thinking_score,
  COALESCE(MAX(CASE WHEN cs.primary_category = 'daily_habits' THEN cs.score END), 0) as daily_habits_score,

  -- 観察記録数
  COALESCE(SUM(cs.observation_count), 0) as total_observations,

  -- 活動記録数
  COALESCE(ac.total_activities, 0) as total_activities

FROM m_children c
LEFT JOIN category_scores cs ON c.id = cs.child_id
LEFT JOIN activity_counts ac ON c.id = ac.child_id

WHERE c.id = $1
  AND c.deleted_at IS NULL

GROUP BY c.id, c.family_name, c.given_name, ac.total_activities;
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
   - 全クラスのデータを閲覧可能

4. **staff（一般職員）**:
   - 現在: 自施設の全クラスにアクセス可能
   - Phase 2: 担当クラスのみアクセス可能に制限予定

#### 施設IDの取得
- `facility_id`はリクエストパラメータではなく、セッション情報（`current_facility_id`）から自動取得します
- これにより、ユーザーが不正な施設IDを指定することを防止します

#### データ分離
- RLS（Row Level Security）で施設レベルのデータを分離
- クエリ実行時に`facility_id`でフィルタリング

#### エラーハンドリング戦略
- アクセス権限がない場合: `404 Not Found`を返す
- 理由: `403 Forbidden`ではリソースの存在を推測可能になるため、セキュリティ上`404`を優先

---

## パフォーマンス考慮事項

### キャッシュ戦略
- 成長サマリ: 1日キャッシュ
- カテゴリー別詳細: 6時間キャッシュ
- 観察記録追加時にキャッシュを無効化

### 集計の最適化
- 事前集計: 夜間バッチで月次サマリを事前計算
- インデックス: カテゴリー、日付範囲でインデックス作成
- マテリアライズドビュー: 集計結果をビューとして保存（Phase 2）

### インデックス
```sql
-- 上記のテーブル定義に含まれるインデックスで対応可能
```

---

## エラーハンドリング

### 共通エラーコード
```typescript
{
  "CHILD_NOT_FOUND": "児童が見つかりません",
  "CATEGORY_NOT_FOUND": "カテゴリーが見つかりません",
  "INSUFFICIENT_DATA": "データが不足しているため、サマリを生成できません",
  "INVALID_PERIOD": "無効な集計期間です"
}
```

---

## UI/UX要件

### グラフ表示
```tsx
// レーダーチャート（観点別評価）
<RadarChart
  categories={categories}
  scores={scores}
  classAverage={classAverage}
/>

// 折れ線グラフ（月別推移）
<LineChart
  data={trends}
  categories={categories}
/>

// プログレスバー（カテゴリー別）
<CategoryProgress
  category="社会性・コミュニケーション"
  score={75}
  level="良好"
  trend="improving"
/>
```

### 強み・のびしろカード
```tsx
<StrengthCard
  title="生活習慣がしっかり身についている"
  description="..."
  score={90}
  examples={examples}
/>

<GrowthAreaCard
  title="お友達との関わりを増やす"
  description="..."
  suggestions={suggestions}
/>
```

---

## 今後の拡張予定

### Phase 2
- AIによる自然言語生成（強み・のびしろの自動抽出）
- 保護者ポータルでの共有機能
- PDF出力（印刷用）
- 同年齢平均との比較

### Phase 3
- 個別指導計画との連携
- 目標設定と達成度管理
- 動画・写真との紐付け
- 多言語対応

---

**作成日**: 2025-01-09
**最終更新**: 2025-01-09
**関連ドキュメント**:
- `03_database.md` - データベース設計
- `04_api.md` - API基本設計
- `10_activity_record_api.md` - 活動記録API
- `11_observation_record_api.md` - 観察記録API
- `21_child_report_api.md` - レポート生成API
