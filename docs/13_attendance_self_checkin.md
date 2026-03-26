# 13. タッチ出欠（自己出席登録）

> ステータス: PR #259 (`feat/attendance-self-checkin`) で実装

## 1. 機能概要

キオスク端末上で児童が自分の名前をタップして出席・退席を記録する機能。
職員の手入力なしに出欠データを収集し、`r_attendance` テーブルに `check_method = 'self'` として保存する。

**主な特徴**:
- 児童が直接操作するため、待ち時間ゼロの楽観的更新（Optimistic UI）を採用
- キオスクモードにより他ページへの誤遷移を防止
- 1文字選択から素早く名前にたどり着ける五十音グリッドUIで、低学年でも操作可能

**関連ファイル**:
- フロントエンド: `app/attendance/self/page.tsx`
- API: `app/api/attendance/self-checkin/route.ts`

---

## 2. ページ設計

### 2.1 キオスクモード

タッチ出欠ページは**キオスクモード**で動作する。通常のスタッフ画面（`StaffLayout`）は使用しない。

| 項目 | 仕様 |
|------|------|
| サイドバー | 非表示 |
| ヘッダー | 非表示 |
| 起動方法 | サイドバーのリンクに `target="_blank"` を指定し、新しいタブで開く |
| 目的 | キオスク端末から他ページへの誤操作を防止 |

職員がサイドバーから「タッチ出欠」リンクをクリックすると、新しいタブでキオスク専用画面が開く。
元のタブは職員用の管理画面のまま維持される。

### 2.2 UI フロー

```
かな選択（5×10グリッド） ──→ 児童選択 ──→ フィードバックオーバーレイ
    ↑                                              │
    │          3秒カウントダウン完了                  │
    └──────────────────────────────────────────────┘

    児童選択画面 ←── 「とりけす」押下（undo API fire-and-forget）
```

**各画面の詳細**:

1. **かな選択画面**: 縦書き五十音表（5行×10列グリッド）を表示。該当児童がいるかなのみ有効（人数を小さく表示）。
2. **児童選択画面**: 選択したかなに一致する児童一覧を表示。タップで出席/退席を記録。チェックアウト済み児童も選択可能（退席時刻を上書き）。
3. **フィードバックオーバーレイ**: 操作結果を時間帯・アクション別のメッセージ・色で表示し、3秒カウントダウン後にかな選択画面に戻る。「とりけす」ボタンで undo 可能。

---

## 3. API エンドポイント

### 3.1 POST /api/attendance/self-checkin

出席（check_in）または退席（check_out）を記録する。

**処理ロジック**:
- 当日の `r_attendance` レコードが存在しない場合 → 新規作成（check_in）
- 当日のレコードが存在し `checked_out_at` が NULL の場合 → 退席時刻を記録（check_out）
- 当日のレコードが存在し `checked_out_at` が NOT NULL の場合 → 退席時刻を現在時刻で上書き（check_out 再記録）

**リクエスト**:
```json
{
  "child_id": "uuid-child-001",
  "facility_id": "uuid-facility-001"
}
```

**レスポンス（成功）**:
```json
{
  "success": true,
  "data": {
    "id": "uuid-attendance-001",
    "child_id": "uuid-child-001",
    "checked_in_at": "2026-03-26T08:30:00+09:00",
    "checked_out_at": null,
    "check_method": "self",
    "action": "check_in"
  }
}
```

**TOCTOU 対策**: 同時タップによる一意制約エラー（PostgreSQL エラーコード `23505`）をキャッチし、既存レコードを返す。詳細は [4.2 TOCTOU 対策](#42-toctou-対策) を参照。

### 3.2 DELETE /api/attendance/self-checkin

直前の操作を取り消す（undo）。

**処理ロジック**:
- DB 上の `checked_out_at` の値に基づいてアクションを決定する（クライアントからの値には依存しない）
  - `checked_out_at` が NOT NULL → `checked_out_at` を NULL に戻す（退席取消）
  - `checked_out_at` が NULL → レコードを削除する（出席取消）

**リクエスト**:
```json
{
  "child_id": "uuid-child-001",
  "facility_id": "uuid-facility-001"
}
```

**レスポンス（成功）**:
```json
{
  "success": true,
  "data": {
    "action": "undo_check_in"
  }
}
```

### 3.3 GET /api/attendance/self-checkin/children

キオスク画面用の児童一覧と当日の出欠状態を取得する。30秒ポーリングで使用。

**クエリパラメータ**:

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `facility_id` | string (UUID) | Yes | 施設ID |

**レスポンス（成功）**:
```json
{
  "あ": [
    {
      "id": "uuid-child-001",
      "kanaName": "あおやま はなこ",
      "kanjiName": "青山 花子",
      "gradeLabel": "1年生",
      "status": "not_checked_in"
    }
  ]
}
```

---

## 4. 設計上の判断

### 4.1 楽観的更新（Optimistic UI）

**設計意図**: キオスク端末での UX を最優先とし、タップ即座にフィードバックを表示する。API 処理はバックグラウンドで実行する（fire-and-forget）。

**理由**:
- 児童が使う端末で「待ち時間なし」が必須要件
- API 失敗は稀であり、失敗時は次回の30秒ポーリングで自動的にサーバー状態に収束する

**トレードオフ**:
- API 失敗時に楽観的状態が一時的に表示されることを許容する
- エラー時は `console.error` のみ出力し、児童向けのエラーメッセージは表示しない

**フィードバックメッセージ**:
- 出席（check_in）: 午前は「おはよう！」、午後は「おかえり！」（時間帯に応じて動的切替）
- 退席（check_out）: 「さようなら！」
- オーバーレイの背景色もアクション・時間帯に応じて変化する

**ポーリング保護**:
- `optimisticIdsRef` で処理中の `child_id` を追跡する
- API レスポンスが返るまでの間、30秒ポーリングによる状態上書きを防止する
- API 完了後に `optimisticIdsRef` から除外し、次回ポーリングでサーバー状態に同期する

```
タップ → UI即時更新 → API呼出（非同期）
                         ├─ 成功 → optimisticIdsRef から除外、次回ポーリングで同期
                         └─ 失敗 → console.error、次回ポーリングでサーバー状態に戻る
```

### 4.2 TOCTOU 対策

児童が素早く連続タップした場合、check_in の INSERT が同時実行される可能性がある（Time-of-Check to Time-of-Use 問題）。

**対策**:
- `r_attendance` テーブルの `(child_id, date)` に UNIQUE 制約を設定
- INSERT 時に PostgreSQL の一意制約エラー（コード `23505`）が発生した場合、エラーではなく既存レコードを返す
- クライアントからは正常完了として扱われるため、UX に影響しない

### 4.3 undo の状態検証

undo（とりけす）処理では、クライアントが送信するアクション種別ではなく、**DB 上の実際の状態**に基づいて処理を決定する。

**理由**:
- 楽観的更新を採用しているため、クライアントの状態とサーバーの状態が一時的に乖離する可能性がある
- DB の `checked_out_at` カラムの値を信頼の源泉（source of truth）とすることで、不整合を防止する

---

## 5. DB 関連

### 5.1 check_method_type ENUM

`r_attendance` テーブルの `check_method` カラムに `'self'` 値を追加。

| 値 | 説明 |
|----|------|
| `manual` | 職員による手動入力 |
| `self` | 児童によるタッチ出欠 |

### 5.2 関連テーブル

- `r_attendance`: 出欠記録の保存先。`check_method = 'self'` で自己登録を識別。
- `m_children`: 児童マスタ。`name_kana` を50音行の分類に使用。
