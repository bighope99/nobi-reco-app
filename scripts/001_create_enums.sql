-- ENUM型定義

-- 3.1 ユーザー権限
CREATE TYPE user_role AS ENUM (
  'site_admin',      -- サイト管理者（全システム管理）
  'company_admin',   -- 会社経営者（自社の全施設管理）
  'facility_admin',  -- 施設管理者（自施設のみ管理）
  'staff'            -- 一般職員（記録入力のみ）
);

-- 3.2 性別
CREATE TYPE gender_type AS ENUM (
  'male',
  'female',
  'other'
);

-- 3.3 在籍状況
CREATE TYPE enrollment_status_type AS ENUM (
  'enrolled',   -- 在籍中
  'withdrawn'   -- 退所
);

-- 3.4 契約形態
CREATE TYPE enrollment_type AS ENUM (
  'regular',    -- 通年
  'temporary',  -- 一時（長期利用）
  'spot'        -- スポット
);

-- 3.5 出席ステータス
CREATE TYPE attendance_status_type AS ENUM (
  'scheduled',  -- 予定通り出席
  'absent',     -- 欠席
  'irregular'   -- イレギュラー出席
);

-- 3.6 チェック方法
CREATE TYPE check_method_type AS ENUM (
  'qr',      -- QRコード
  'manual'   -- 手動
);
