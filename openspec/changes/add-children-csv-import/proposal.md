# Change: CSVからの子ども一括インポート処理を追加

## Why
CSV一括登録はUIのみで、実際の取り込み処理が未実装のため運用できない。

## What Changes
- CSVファイルのアップロード処理とサーバー側のインポート処理を追加
- 施設/学校/クラスの一括指定値をCSV行に適用
- 日本語ヘッダー/生年月日1列/性別の複数表記に対応
- 入所状況のデフォルトを在籍中に固定
- アップロード直後にプレビューを表示し、承認後に保存

## Impact
- Affected specs: children-import
- Affected code: import UI, import API, CSVパーサ
