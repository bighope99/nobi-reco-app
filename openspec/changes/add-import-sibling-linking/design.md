## Context
CSVインポートで電話番号を基準に兄弟候補を提示し、承認後にリンクする。候補抽出は既存データ（m_guardians）から行い、m_children.parent_*は将来的な移行方針に合わせて保存を停止する。

## Goals / Non-Goals
- Goals:
  - 兄弟候補をプレビューで確認・承認できる
  - 電話番号の正規化により表記ゆれを吸収する
  - 承認済み候補のみリンクを作成する
- Non-Goals:
  - スキーマ変更やユニーク制約の追加
  - 既存データの一括移行

## Decisions
- Decision: 候補抽出はm_guardians.phoneのみを使用
  - Rationale: m_children.parent_*の廃止方向に合わせる
- Decision: 承認単位は電話番号で一括、UI上は親の名前ベースで表示
  - Rationale: 運用負荷を下げつつ誤結合の認知を容易にする
- Decision: 兄弟リンクは同一電話番号グループ内で相互リンク（完全グラフ）
  - Rationale: 兄弟関係を片方向にしないため

## Risks / Trade-offs
- 電話番号が複数世帯で共有されている場合、誤結合の可能性がある
  - Mitigation: プレビュー承認を必須化し、リンク候補を明示する

## Migration Plan
1. インポートAPIに候補抽出とプレビュー情報を追加
2. UIに候補承認の操作を追加
3. 保存時に承認済みのみリンク作成
4. インポート時のm_children.parent_*保存を停止

## Open Questions
- 承認UIで候補名が同一の場合の表示ルール
