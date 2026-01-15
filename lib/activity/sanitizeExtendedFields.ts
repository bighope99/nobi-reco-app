/**
 * Activity Extended Fields Sanitization
 *
 * Provides sanitization logic for activity record extended fields
 * (daily_schedule, role_assignments, snack, meal, special_notes, event_name).
 *
 * Rules:
 * - daily_schedule: Remove rows where both time and content are empty/whitespace
 * - role_assignments: Remove rows where user_id is empty/whitespace
 * - snack: Return null if empty/whitespace
 * - meal: Return null if all fields (menu, notes, items_to_bring) are empty/whitespace
 * - special_notes: Return null if empty/whitespace
 * - event_name: Return null if empty/whitespace
 */

import { sanitizeText, sanitizeArrayFields, sanitizeObjectFields } from '@/lib/security/sanitize'
import type { DailyScheduleItem, RoleAssignment, Meal } from '@/types/activity'

export interface ExtendedFieldsInput {
  dailySchedule: DailyScheduleItem[]
  roleAssignments: RoleAssignment[]
  snack: string
  meal: Meal | null
  specialNotes: string
  eventName: string
}

export interface SanitizedExtendedFields {
  event_name: string | null
  special_notes: string | null
  snack: string | null
  daily_schedule: DailyScheduleItem[] | null
  role_assignments: RoleAssignment[] | null
  meal: Meal | null
}

/**
 * Sanitizes extended fields for activity records
 * @param input - Extended fields to sanitize
 * @returns Sanitized extended fields with proper null handling
 */
export function getSanitizedExtendedFields(input: ExtendedFieldsInput): SanitizedExtendedFields {
  // 1. daily_schedule: time と content の両方が空の行を除外
  const filteredSchedule = input.dailySchedule.filter(
    (item) => item.time?.trim() || item.content?.trim()
  )
  const sanitizedSchedule = filteredSchedule.length > 0
    ? sanitizeArrayFields(filteredSchedule, ['content'])
    : null

  // 2. role_assignments: user_id が空文字列または空白のみの行を完全に除外
  const filteredRoles = input.roleAssignments.filter(
    (r) => r.user_id && r.user_id.trim() !== "" && r.role
  )
  const sanitizedRoles = filteredRoles.length > 0
    ? sanitizeArrayFields(filteredRoles, ['role'])
    : null

  // 3. snack: 空文字列・空白のみの場合はnull
  const sanitizedSnack = input.snack && input.snack.trim() !== "" ? sanitizeText(input.snack) : null

  // 4. meal: menu, notes, items_to_bring すべて空の場合はnull
  const hasMealData = input.meal && (
    (input.meal.menu && input.meal.menu.trim() !== "") ||
    (input.meal.notes && input.meal.notes.trim() !== "") ||
    (input.meal.items_to_bring && input.meal.items_to_bring.trim() !== "")
  )
  const sanitizedMeal = hasMealData
    ? sanitizeObjectFields(input.meal, ['menu', 'items_to_bring', 'notes'])
    : null

  // 5. special_notes: 空文字列・空白のみの場合はnull
  const sanitizedSpecialNotes = input.specialNotes && input.specialNotes.trim() !== ""
    ? sanitizeText(input.specialNotes)
    : null

  // 6. event_name: 空文字列・空白のみの場合はnull
  const sanitizedEventName = input.eventName && input.eventName.trim() !== ""
    ? sanitizeText(input.eventName)
    : null

  return {
    event_name: sanitizedEventName,
    special_notes: sanitizedSpecialNotes,
    snack: sanitizedSnack,
    daily_schedule: sanitizedSchedule,
    role_assignments: sanitizedRoles,
    meal: sanitizedMeal,
  }
}
