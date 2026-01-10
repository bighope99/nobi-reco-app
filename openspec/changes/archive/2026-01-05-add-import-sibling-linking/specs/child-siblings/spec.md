## ADDED Requirements
### Requirement: 兄弟リンクの相互作成
システムは承認済みの兄弟候補について、同一電話番号グループ内の子どもを相互にリンクしなければならない（MUST）。  
兄弟候補はm_guardians.phoneのみを基準に抽出し、m_children.parent_*は参照しない（MUST）。

#### Scenario: 3名以上の兄弟候補
- **WHEN** 同一電話番号に3名以上の候補がある
- **THEN** 全員が相互に兄弟リンクされる

#### Scenario: m_guardiansのみ参照
- **WHEN** 兄弟候補を抽出する
- **THEN** m_guardians.phoneのみが使われる
