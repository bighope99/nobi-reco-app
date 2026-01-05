# Change: CSVインポート時の兄弟候補レビューと承認リンク

## Why
CSVインポート時に電話番号で兄弟候補を提示し、承認後にリンクする運用を実現するため。

## What Changes
- 兄弟候補をm_guardians.phone基準で抽出し、プレビューに表示
- 承認後に兄弟リンクを一括作成
- 電話番号比較はハイフン/スペース除去で正規化
- インポート時のm_children.parent_*保存は停止（スキーマは維持）

## Impact
- Affected specs: children-import, child-siblings
- Affected code: import API, import UI, sibling linking logic
