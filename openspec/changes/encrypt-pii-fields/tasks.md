## 1. 暗号化ユーティリティの実装
- [x] 1.1 `utils/crypto/piiEncryption.ts`を作成（AES-256-GCM暗号化/復号化関数）
- [x] 1.2 環境変数`PII_ENCRYPTION_KEY`の設定方法をドキュメント化（`docs/pii-encryption-setup.md`）
- [ ] 1.3 暗号化ユーティリティのユニットテストを追加
- [x] 1.4 検索用ハッシュ生成関数を実装（SHA-256）

## 2. 検索用ハッシュテーブルの実装
- [x] 2.1 `s_pii_search_index`テーブルのマイグレーションを作成
- [x] 2.2 検索用ハッシュテーブルの更新ユーティリティを実装
- [x] 2.3 検索用ハッシュテーブルからの検索関数を実装

## 3. m_guardiansテーブルの暗号化対応
- [x] 3.1 `app/api/children/save/route.ts`の`processPrimaryGuardian`関数で暗号化を適用
- [x] 3.2 `app/api/children/save/route.ts`の`processEmergencyContact`関数で暗号化を適用
- [x] 3.3 保護者情報を読み取るすべてのAPIエンドポイントで復号化を適用
- [x] 3.4 保護者情報の検索処理を検索用ハッシュテーブル経由に変更
- [x] 3.5 保存時に検索用ハッシュテーブルも更新

## 4. m_childrenテーブルの暗号化対応
- [x] 4.1 `app/api/children/save/route.ts`の`saveChild`関数でPIIフィールドを暗号化
- [x] 4.2 `app/api/children/[id]/route.ts`でPIIフィールドを復号化
- [x] 4.3 `app/api/children/route.ts`でPIIフィールドを復号化
- [x] 4.4 `app/api/children/import/route.ts`でインポート時の暗号化を適用
- [x] 4.5 名前による検索処理（`ilike`）を検索用ハッシュテーブル経由に変更
- [x] 4.6 `app/api/children/search-siblings/route.ts`を検索用ハッシュテーブル経由に変更
- [x] 4.7 保存時に検索用ハッシュテーブルも更新

## 5. テストと検証
- [ ] 5.1 暗号化/復号化の統合テストを追加
- [ ] 5.2 検索用ハッシュテーブルの動作確認
- [ ] 5.3 既存APIエンドポイントの動作確認（特に検索機能）
- [ ] 5.4 パフォーマンステスト（暗号化によるオーバーヘッド測定）
- [ ] 5.5 後方互換性テスト（既存データの読み取り）
- [ ] 5.6 セキュリティレビュー（暗号化キーの管理方法）
