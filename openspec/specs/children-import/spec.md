# children-import Specification

## Purpose
TBD - created by archiving change add-import-sibling-linking. Update Purpose after archive.
## Requirements
### Requirement: 子どもCSVインポート（兄弟候補レビュー対応）
システムは日本語ヘッダーのCSVから子ども情報を一括登録できなければならない（MUST）。  
インポート時に画面で選択した施設・学校・クラスを全行へ適用し、CSV内にはこれらの列を含めない（MUST）。  
CSVアップロード直後に登録予定内容のプレビューを表示し、承認後に保存できなければならない（MUST）。  
生年月日は1列（YYYY-MM-DD）で受け付け、入所状況はデフォルトで在籍中として扱う（MUST）。  
性別は複数表記（例: 女性, 女, female, f）を受け付けて内部値へ正規化する（MUST）。  
兄弟候補はm_guardians.phoneを電話番号正規化（ハイフン/スペース除去）した値で抽出し、プレビューに表示しなければならない（MUST）。  
承認は電話番号単位で行うが、UIには保護者名と紐づけ情報を表示しなければならない（MUST）。

#### Scenario: 正常インポート
- **WHEN** ユーザーが日本語ヘッダーのCSVをアップロードする
- **THEN** 登録予定のプレビューが表示される
- **AND** 承認後に行ごとに子どもが作成される
- **AND** 施設/学校/クラスの一括指定値が適用される

#### Scenario: 必須項目の不足
- **WHEN** 必須項目が不足した行が含まれる
- **THEN** その行はスキップされ、エラー理由が返される

#### Scenario: 性別の表記ゆれ
- **WHEN** 性別が複数表記のいずれかで指定される
- **THEN** 内部値へ正規化して保存される

#### Scenario: 兄弟候補の表示と承認
- **WHEN** CSVをアップロードしてプレビューを表示する
- **THEN** 既存データから電話番号一致の兄弟候補が表示される
- **AND** 電話番号単位の承認が可能になる

