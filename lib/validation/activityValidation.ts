/**
 * 活動記録フィールドのバリデーションユーティリティ
 */

import type { DailyScheduleItem, RoleAssignment, Meal } from '@/types/activity';

// 定数
export const MAX_EVENT_NAME_LENGTH = 200;
export const MAX_SPECIAL_NOTES_LENGTH = 2000;
export const MAX_SNACK_LENGTH = 200;
export const MAX_DAILY_SCHEDULE_ITEMS = 50;
export const MAX_ROLE_ASSIGNMENTS = 20;
export const MAX_SCHEDULE_CONTENT_LENGTH = 200;
export const MAX_ROLE_LENGTH = 100;
export const MAX_USER_NAME_LENGTH = 100;
export const MAX_MEAL_MENU_LENGTH = 200;
export const MAX_MEAL_ITEMS_LENGTH = 200;
export const MAX_MEAL_NOTES_LENGTH = 500;

/**
 * UUID形式の検証
 */
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

/**
 * 時刻形式の検証 (HH:MM)
 */
const isValidTimeFormat = (time: string): boolean => {
  return /^\d{2}:\d{2}$/.test(time);
};

/**
 * daily_schedule の検証
 */
export const validateDailySchedule = (
  schedule: unknown
): { valid: true; data: DailyScheduleItem[] | null } | { valid: false; error: string } => {
  // null/undefinedは許可
  if (schedule === null || schedule === undefined) {
    return { valid: true, data: null };
  }

  // 配列でなければエラー
  if (!Array.isArray(schedule)) {
    return { valid: false, error: 'daily_schedule must be an array' };
  }

  // 空配列はnullとして扱う
  if (schedule.length === 0) {
    return { valid: true, data: null };
  }

  // 最大件数チェック
  if (schedule.length > MAX_DAILY_SCHEDULE_ITEMS) {
    return { valid: false, error: `daily_schedule cannot exceed ${MAX_DAILY_SCHEDULE_ITEMS} items` };
  }

  // 各アイテムの検証
  for (let i = 0; i < schedule.length; i++) {
    const item = schedule[i];

    if (typeof item !== 'object' || item === null) {
      return { valid: false, error: `daily_schedule[${i}] must be an object` };
    }

    const { time, content } = item as Record<string, unknown>;

    // timeの検証
    if (typeof time !== 'string') {
      return { valid: false, error: `daily_schedule[${i}].time must be a string` };
    }
    if (!isValidTimeFormat(time)) {
      return { valid: false, error: `daily_schedule[${i}].time must be in HH:MM format` };
    }

    // contentの検証
    if (typeof content !== 'string') {
      return { valid: false, error: `daily_schedule[${i}].content must be a string` };
    }
    if (content.length > MAX_SCHEDULE_CONTENT_LENGTH) {
      return { valid: false, error: `daily_schedule[${i}].content exceeds ${MAX_SCHEDULE_CONTENT_LENGTH} characters` };
    }
  }

  return {
    valid: true,
    data: schedule.map((item) => ({
      time: item.time,
      content: item.content,
    })),
  };
};

/**
 * role_assignments の検証
 */
export const validateRoleAssignments = (
  assignments: unknown
): { valid: true; data: RoleAssignment[] | null } | { valid: false; error: string } => {
  // null/undefinedは許可
  if (assignments === null || assignments === undefined) {
    return { valid: true, data: null };
  }

  // 配列でなければエラー
  if (!Array.isArray(assignments)) {
    return { valid: false, error: 'role_assignments must be an array' };
  }

  // 空配列はnullとして扱う
  if (assignments.length === 0) {
    return { valid: true, data: null };
  }

  // 最大件数チェック
  if (assignments.length > MAX_ROLE_ASSIGNMENTS) {
    return { valid: false, error: `role_assignments cannot exceed ${MAX_ROLE_ASSIGNMENTS} items` };
  }

  const validAssignments: RoleAssignment[] = [];

  // 各アイテムの検証
  for (let i = 0; i < assignments.length; i++) {
    const item = assignments[i];

    if (typeof item !== 'object' || item === null) {
      return { valid: false, error: `role_assignments[${i}] must be an object` };
    }

    const { user_id, user_name, role } = item as Record<string, unknown>;

    // user_id が空の場合はスキップ（role のみ入力されても保存しない）
    if (!user_id || (typeof user_id === 'string' && user_id.trim() === '')) {
      continue;
    }

    // user_idの検証（空でない場合のみ）
    if (user_id) {
      if (typeof user_id !== 'string') {
        return { valid: false, error: `role_assignments[${i}].user_id must be a string` };
      }
      if (!isValidUUID(user_id)) {
        return { valid: false, error: `role_assignments[${i}].user_id must be a valid UUID` };
      }
    }

    // user_nameの検証
    if (user_name !== undefined && typeof user_name !== 'string') {
      return { valid: false, error: `role_assignments[${i}].user_name must be a string` };
    }
    if (typeof user_name === 'string' && user_name.length > MAX_USER_NAME_LENGTH) {
      return { valid: false, error: `role_assignments[${i}].user_name exceeds ${MAX_USER_NAME_LENGTH} characters` };
    }

    // roleの検証
    if (role !== undefined && typeof role !== 'string') {
      return { valid: false, error: `role_assignments[${i}].role must be a string` };
    }
    if (typeof role === 'string' && role.length > MAX_ROLE_LENGTH) {
      return { valid: false, error: `role_assignments[${i}].role exceeds ${MAX_ROLE_LENGTH} characters` };
    }

    // user_idとroleの両方が存在する場合のみ追加
    if (user_id && role) {
      validAssignments.push({
        user_id: user_id as string,
        user_name: (user_name as string) || '',
        role: role as string,
      });
    }
  }

  return {
    valid: true,
    data: validAssignments.length > 0 ? validAssignments : null,
  };
};

/**
 * meal の検証
 */
export const validateMeal = (
  meal: unknown
): { valid: true; data: Meal | null } | { valid: false; error: string } => {
  // null/undefinedは許可
  if (meal === null || meal === undefined) {
    return { valid: true, data: null };
  }

  // オブジェクトでなければエラー
  if (typeof meal !== 'object' || Array.isArray(meal)) {
    return { valid: false, error: 'meal must be an object' };
  }

  const { menu, items_to_bring, notes } = meal as Record<string, unknown>;

  // menuの検証
  if (menu !== undefined && typeof menu !== 'string') {
    return { valid: false, error: 'meal.menu must be a string' };
  }

  // menuが空の場合はnullとして扱う
  if (!menu || (typeof menu === 'string' && menu.trim() === '')) {
    return { valid: true, data: null };
  }

  if (typeof menu === 'string' && menu.length > MAX_MEAL_MENU_LENGTH) {
    return { valid: false, error: `meal.menu exceeds ${MAX_MEAL_MENU_LENGTH} characters` };
  }

  // items_to_bringの検証
  if (items_to_bring !== undefined && typeof items_to_bring !== 'string') {
    return { valid: false, error: 'meal.items_to_bring must be a string' };
  }
  if (typeof items_to_bring === 'string' && items_to_bring.length > MAX_MEAL_ITEMS_LENGTH) {
    return { valid: false, error: `meal.items_to_bring exceeds ${MAX_MEAL_ITEMS_LENGTH} characters` };
  }

  // notesの検証
  if (notes !== undefined && typeof notes !== 'string') {
    return { valid: false, error: 'meal.notes must be a string' };
  }
  if (typeof notes === 'string' && notes.length > MAX_MEAL_NOTES_LENGTH) {
    return { valid: false, error: `meal.notes exceeds ${MAX_MEAL_NOTES_LENGTH} characters` };
  }

  return {
    valid: true,
    data: {
      menu: menu as string,
      items_to_bring: items_to_bring as string | undefined,
      notes: notes as string | undefined,
    },
  };
};

/**
 * event_name の検証
 */
export const validateEventName = (
  eventName: unknown
): { valid: true; data: string | null } | { valid: false; error: string } => {
  if (eventName === null || eventName === undefined || eventName === '') {
    return { valid: true, data: null };
  }

  if (typeof eventName !== 'string') {
    return { valid: false, error: 'event_name must be a string' };
  }

  if (eventName.length > MAX_EVENT_NAME_LENGTH) {
    return { valid: false, error: `event_name exceeds ${MAX_EVENT_NAME_LENGTH} characters` };
  }

  return { valid: true, data: eventName };
};

/**
 * special_notes の検証
 */
export const validateSpecialNotes = (
  specialNotes: unknown
): { valid: true; data: string | null } | { valid: false; error: string } => {
  if (specialNotes === null || specialNotes === undefined || specialNotes === '') {
    return { valid: true, data: null };
  }

  if (typeof specialNotes !== 'string') {
    return { valid: false, error: 'special_notes must be a string' };
  }

  if (specialNotes.length > MAX_SPECIAL_NOTES_LENGTH) {
    return { valid: false, error: `special_notes exceeds ${MAX_SPECIAL_NOTES_LENGTH} characters` };
  }

  return { valid: true, data: specialNotes };
};

/**
 * snack の検証
 */
export const validateSnack = (
  snack: unknown
): { valid: true; data: string | null } | { valid: false; error: string } => {
  if (snack === null || snack === undefined || snack === '') {
    return { valid: true, data: null };
  }

  if (typeof snack !== 'string') {
    return { valid: false, error: 'snack must be a string' };
  }

  if (snack.length > MAX_SNACK_LENGTH) {
    return { valid: false, error: `snack exceeds ${MAX_SNACK_LENGTH} characters` };
  }

  return { valid: true, data: snack };
};

/**
 * 全ての新規フィールドを一括検証
 */
export const validateActivityExtendedFields = (body: {
  event_name?: unknown;
  daily_schedule?: unknown;
  role_assignments?: unknown;
  special_notes?: unknown;
  snack?: unknown;
  meal?: unknown;
}): {
  valid: true;
  data: {
    event_name: string | null;
    daily_schedule: DailyScheduleItem[] | null;
    role_assignments: RoleAssignment[] | null;
    special_notes: string | null;
    snack: string | null;
    meal: Meal | null;
  };
} | { valid: false; error: string } => {
  const eventNameResult = validateEventName(body.event_name);
  if (!eventNameResult.valid) return eventNameResult;

  const dailyScheduleResult = validateDailySchedule(body.daily_schedule);
  if (!dailyScheduleResult.valid) return dailyScheduleResult;

  const roleAssignmentsResult = validateRoleAssignments(body.role_assignments);
  if (!roleAssignmentsResult.valid) return roleAssignmentsResult;

  const specialNotesResult = validateSpecialNotes(body.special_notes);
  if (!specialNotesResult.valid) return specialNotesResult;

  const snackResult = validateSnack(body.snack);
  if (!snackResult.valid) return snackResult;

  const mealResult = validateMeal(body.meal);
  if (!mealResult.valid) return mealResult;

  return {
    valid: true,
    data: {
      event_name: eventNameResult.data,
      daily_schedule: dailyScheduleResult.data,
      role_assignments: roleAssignmentsResult.data,
      special_notes: specialNotesResult.data,
      snack: snackResult.data,
      meal: mealResult.data,
    },
  };
};
