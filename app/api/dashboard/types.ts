/**
 * Dashboard API共通型定義
 */

// Supabaseから取得する子ども情報の型
export interface ChildDataRaw {
  id: string;
  family_name: string | null;
  given_name: string | null;
  family_name_kana: string | null;
  given_name_kana: string | null;
  birth_date: string | null;
  grade_add: number | null;
  photo_url: string | null;
  school_id: string | null;
  _child_class: ChildClassRaw[] | null;
}

export interface ChildClassRaw {
  class_id: string;
  is_current: boolean;
  m_classes: ClassInfo | null;
}

export interface ClassInfo {
  id: string;
  name: string;
  age_group?: string;
}

// スケジュールパターン
export interface SchedulePattern {
  child_id: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

// 日次出席記録
export interface DailyAttendanceRecord {
  child_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | null;
  scheduled_arrival_time: string | null;
  scheduled_departure_time: string | null;
}

// 出席ログ
export interface AttendanceLog {
  id: string;
  child_id: string;
  date: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  check_in_method: 'qr' | 'manual' | null;
}

// 学校スケジュール
export interface SchoolSchedule {
  school_id: string;
  grades: string[];
  monday_time: string | null;
  tuesday_time: string | null;
  wednesday_time: string | null;
  thursday_time: string | null;
  friday_time: string | null;
  saturday_time: string | null;
  sunday_time: string | null;
}

// 学校情報
export interface SchoolInfo {
  id: string;
  name: string;
}

// 保護者リンク
export interface GuardianLink {
  child_id: string;
  is_primary?: boolean;
  guardian: {
    id: string;
    phone: string | null;
  } | null;
}

// クラスフィルター
export interface ClassFilter {
  id: string;
  name: string;
}

// 記録情報
export interface ObservationRecord {
  child_id: string;
  observation_date: string;
}

// 曜日キー
export type DayOfWeekKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
