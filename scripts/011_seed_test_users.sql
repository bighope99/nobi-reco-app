-- =====================================================
-- 重要: このスクリプトを実行する前に
-- =====================================================
-- 1. Supabase Dashboard > Authentication > Users で以下のユーザーを作成:
--    - taiki.work99@gmail.com / test123
--    - big.hope99@gmail.com / test123
-- 2. 作成後、各ユーザーのUUID（id列）を確認
-- 3. 以下の <SITE_ADMIN_UUID> と <FACILITY_ADMIN_UUID> を実際のUUIDに置き換え
-- =====================================================

-- サイト管理者（taiki.work99@gmail.com）
-- <SITE_ADMIN_UUID> を実際の auth.users.id に置き換えてください
INSERT INTO m_users (id, company_id, name, name_kana, email, role, is_active, is_retired)
VALUES 
  ('<SITE_ADMIN_UUID>',
   NULL,  -- サイト管理者は会社に所属しない
   '中村大希',
   'ナカムラタイキ',
   'taiki.work99@gmail.com',
   'site_admin',
   true,
   false);

-- 施設管理者（big.hope99@gmail.com）
-- <FACILITY_ADMIN_UUID> を実際の auth.users.id に置き換えてください
INSERT INTO m_users (id, company_id, name, name_kana, email, role, is_active, is_retired)
VALUES 
  ('<FACILITY_ADMIN_UUID>',
   '11111111-1111-1111-1111-111111111111',  -- テスト株式会社
   'テスト太郎',
   'テストタロウ',
   'big.hope99@gmail.com',
   'facility_admin',
   true,
   false);
