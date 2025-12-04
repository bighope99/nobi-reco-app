-- =====================================================
-- 重要: 011_seed_test_users.sql を先に実行してください
-- <FACILITY_ADMIN_UUID> を実際のUUIDに置き換えてください
-- =====================================================

-- 施設紐付け（施設管理者のみ）
-- サイト管理者は全施設にアクセスできるため紐付け不要
INSERT INTO _user_facility (user_id, facility_id, is_primary)
VALUES 
  ('<FACILITY_ADMIN_UUID>', '22222222-2222-2222-2222-222222222222', true),   -- テスト学童A（主担当）
  ('<FACILITY_ADMIN_UUID>', '33333333-3333-3333-3333-333333333333', false);  -- テスト学童B（副担当）

-- クラス紐付け（施設管理者のみ）
INSERT INTO _user_class (user_id, class_id, is_homeroom)
VALUES 
  -- テスト学童A の1年生クラスを担当（担任）
  ('<FACILITY_ADMIN_UUID>', '44444444-4444-4444-4444-444444444444', true),
  -- テスト学童A の2年生クラスを担当（副担任）
  ('<FACILITY_ADMIN_UUID>', '55555555-5555-5555-5555-555555555555', false);
