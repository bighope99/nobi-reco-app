export type ChildStatus = 'checked_in' | 'checked_out' | 'absent';
export type AlertType = 'overdue' | 'late' | 'unexpected' | 'not_arrived' | null;

export interface Child {
  child_id: string;
  name: string;
  kana: string;
  class_id: string | null;
  class_name: string;
  age_group: string;
  grade: number | null;
  grade_label: string;
  school_id: string | null;
  school_name: string | null;
  photo_url: string | null;
  status: ChildStatus;
  is_scheduled_today: boolean;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  actual_in_time: string | null;
  actual_out_time: string | null;
  check_in_method?: 'qr' | 'manual' | null;
  guardian_phone: string | null;
  last_record_date?: string | null;
  weekly_record_count?: number;
  alert_type?: AlertType;
}

export interface KPI {
  scheduled_today: number;
  present_now: number;
  not_arrived: number;
  checked_out: number;
}

// アラート詳細型
export interface OverdueAlert {
  child_id: string;
  name: string;
  kana: string;
  class_name: string;
  age_group: string;
  grade: number | null;
  grade_label: string;
  school_id: string | null;
  school_name: string | null;
  scheduled_end_time: string | null;
  actual_in_time: string | null;
  minutes_overdue: number;
  guardian_phone: string | null;
}

export interface LateAlert {
  child_id: string;
  name: string;
  kana: string;
  class_name: string;
  age_group: string;
  grade: number | null;
  grade_label: string;
  school_id: string | null;
  school_name: string | null;
  scheduled_start_time: string;
  minutes_late: number;
  guardian_phone: string | null;
  alert_triggered_at: string;
}

export interface UnexpectedAlert {
  child_id: string;
  name: string;
  kana: string;
  class_name: string;
  age_group: string;
  actual_in_time: string | null;
}

export interface Alert {
  overdue: OverdueAlert[];
  late: LateAlert[];
  unexpected: UnexpectedAlert[];
}

export interface RecordSupport {
  child_id: string;
  name: string;
  kana: string;
  class_name: string;
  last_record_date: string | null;
  days_since_record: number;
  weekly_record_count: number;
  reason: string;
}

export interface ClassFilter {
  class_id: string;
  class_name: string;
}

// Priority API response
export interface PriorityData {
  current_time: string;
  current_date: string;
  kpi: KPI;
  alerts: Alert;
  action_required: Child[];
  filters: {
    classes: ClassFilter[];
  };
  total_children: number;
}

// Full dashboard data (legacy compatibility)
export interface DashboardData {
  current_time: string;
  current_date: string;
  kpi: KPI;
  alerts: Alert;
  attendance_list: Child[];
  record_support: RecordSupport[];
  filters: {
    classes: ClassFilter[];
  };
}

export type SortKey = 'status' | 'grade' | 'schedule';
export type SortOrder = 'asc' | 'desc';
