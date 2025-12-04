-- テスト用施設
INSERT INTO m_facilities (id, company_id, name, name_kana, postal_code, address, phone, email, capacity, is_active)
VALUES 
  ('22222222-2222-2222-2222-222222222222', 
   '11111111-1111-1111-1111-111111111111',
   'テスト学童A', 
   'テストガクドウA',
   '100-0002',
   '東京都千代田区千代田2-2-2',
   '03-2234-5678',
   'gakudo-a@test-company.com',
   30,
   true),
  ('33333333-3333-3333-3333-333333333333', 
   '11111111-1111-1111-1111-111111111111',
   'テスト学童B', 
   'テストガクドウB',
   '100-0003',
   '東京都千代田区千代田3-3-3',
   '03-3234-5678',
   'gakudo-b@test-company.com',
   25,
   true);
