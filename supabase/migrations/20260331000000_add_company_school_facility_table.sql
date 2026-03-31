-- Migration: add_company_school_facility_table
-- m_schoolsをfacility_id管理からcompany_id管理に変更し、
-- 施設ごとの遅刻時間定義のための_school_facility中間テーブルを追加する

-- Step 1: m_schoolsにcompany_idを追加（nullable）
ALTER TABLE m_schools ADD COLUMN company_id UUID REFERENCES m_companies(id) ON DELETE CASCADE;

-- Step 2: 既存データのcompany_idをfacility経由で設定
UPDATE m_schools s
SET company_id = f.company_id
FROM m_facilities f
WHERE s.facility_id = f.id AND s.company_id IS NULL;

-- Step 3: _school_facility中間テーブル作成
CREATE TABLE _school_facility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES m_schools(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES m_facilities(id) ON DELETE CASCADE,
  late_threshold_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(school_id, facility_id)
);

-- Step 4: 既存のschool-facilityデータを移行（元の施設にのみ紐付け）
INSERT INTO _school_facility (school_id, facility_id, late_threshold_minutes)
SELECT s.id, s.facility_id, s.late_threshold_minutes
FROM m_schools s
WHERE s.facility_id IS NOT NULL AND s.deleted_at IS NULL;

-- Step 5: インデックス追加
CREATE INDEX idx_m_schools_company_id ON m_schools(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_school_facility_school_id ON _school_facility(school_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_school_facility_facility_id ON _school_facility(facility_id) WHERE deleted_at IS NULL;

-- Step 6: company_id を NOT NULL に
ALTER TABLE m_schools ALTER COLUMN company_id SET NOT NULL;

-- Step 7: facility_id カラム削除
ALTER TABLE m_schools DROP COLUMN facility_id;

-- late_threshold_minutesはm_schoolsから削除（_school_facilityに移行済み）
ALTER TABLE m_schools DROP COLUMN late_threshold_minutes;
