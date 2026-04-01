-- Performance indexes for frequently queried columns

-- r_observation: child_id + observation_date for personal records queries
CREATE INDEX IF NOT EXISTS idx_r_observation_child_date
  ON r_observation(child_id, observation_date) WHERE deleted_at IS NULL;

-- h_attendance: child_id + checked_in_at for attendance history queries
CREATE INDEX IF NOT EXISTS idx_h_attendance_child_checkin
  ON h_attendance(child_id, checked_in_at);

-- r_daily_attendance: child_id + attendance_date for attendance status queries
CREATE INDEX IF NOT EXISTS idx_r_daily_attendance_child_date
  ON r_daily_attendance(child_id, attendance_date);
