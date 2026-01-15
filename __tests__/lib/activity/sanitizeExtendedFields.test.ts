/**
 * Tests for getSanitizedExtendedFields function
 *
 * Comprehensive test coverage for activity extended fields sanitization logic
 */

import { getSanitizedExtendedFields } from '@/lib/activity/sanitizeExtendedFields'
import type { DailyScheduleItem, RoleAssignment, Meal } from '@/types/activity'

describe('getSanitizedExtendedFields', () => {
  describe('role_assignments', () => {
    it('should exclude rows where user_id is empty string', () => {
      const input = {
        roleAssignments: [
          { user_id: '', user_name: '', role: 'teacher' },
          { user_id: 'user-1', user_name: 'Alice', role: 'assistant' },
        ],
        dailySchedule: [],
        snack: '',
        meal: null,
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.role_assignments).toHaveLength(1)
      expect(result.role_assignments?.[0].user_id).toBe('user-1')
    })

    it('should exclude rows where user_id contains only whitespace', () => {
      const input = {
        roleAssignments: [
          { user_id: '   ', user_name: 'Bob', role: 'teacher' },
          { user_id: 'user-2', user_name: 'Charlie', role: 'assistant' },
        ],
        dailySchedule: [],
        snack: '',
        meal: null,
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.role_assignments).toHaveLength(1)
      expect(result.role_assignments?.[0].user_id).toBe('user-2')
    })

    it('should keep only valid rows', () => {
      const input = {
        roleAssignments: [
          { user_id: 'user-1', user_name: 'Alice', role: 'teacher' },
          { user_id: 'user-2', user_name: 'Bob', role: 'assistant' },
          { user_id: 'user-3', user_name: 'Charlie', role: 'supervisor' },
        ],
        dailySchedule: [],
        snack: '',
        meal: null,
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.role_assignments).toHaveLength(3)
    })

    it('should return null when all rows are invalid', () => {
      const input = {
        roleAssignments: [
          { user_id: '', user_name: '', role: '' },
          { user_id: '  ', user_name: '', role: 'teacher' },
        ],
        dailySchedule: [],
        snack: '',
        meal: null,
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.role_assignments).toBeNull()
    })

    it('should sanitize role field in valid rows', () => {
      const input = {
        roleAssignments: [
          { user_id: 'user-1', user_name: 'Alice', role: '<script>alert("xss")</script>' },
        ],
        dailySchedule: [],
        snack: '',
        meal: null,
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.role_assignments?.[0].role).toContain('&lt;script&gt;')
      expect(result.role_assignments?.[0].role).not.toContain('<script>')
    })
  })

  describe('daily_schedule', () => {
    it('should exclude rows where both time and content are empty', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [
          { time: '', content: '' },
          { time: '10:00', content: 'Morning activity' },
        ],
        snack: '',
        meal: null,
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.daily_schedule).toHaveLength(1)
      expect(result.daily_schedule?.[0].time).toBe('10:00')
    })

    it('should exclude rows where both time and content are whitespace only', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [
          { time: '   ', content: '   ' },
          { time: '14:00', content: 'Afternoon play' },
        ],
        snack: '',
        meal: null,
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.daily_schedule).toHaveLength(1)
      expect(result.daily_schedule?.[0].time).toBe('14:00')
    })

    it('should keep rows where only time has value', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [
          { time: '09:00', content: '' },
          { time: '10:00', content: 'Activity' },
        ],
        snack: '',
        meal: null,
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.daily_schedule).toHaveLength(2)
    })

    it('should keep rows where only content has value', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [
          { time: '', content: 'Free play' },
          { time: '10:00', content: 'Activity' },
        ],
        snack: '',
        meal: null,
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.daily_schedule).toHaveLength(2)
    })

    it('should return null when all rows are empty', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [
          { time: '', content: '' },
          { time: '  ', content: '  ' },
        ],
        snack: '',
        meal: null,
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.daily_schedule).toBeNull()
    })

    it('should sanitize content field', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [
          { time: '10:00', content: '<b>Bold text</b>' },
        ],
        snack: '',
        meal: null,
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.daily_schedule?.[0].content).toContain('&lt;b&gt;')
      expect(result.daily_schedule?.[0].content).not.toContain('<b>')
    })
  })

  describe('snack', () => {
    it('should return null when snack is empty string', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [],
        snack: '',
        meal: null,
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.snack).toBeNull()
    })

    it('should return null when snack is whitespace only', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [],
        snack: '   ',
        meal: null,
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.snack).toBeNull()
    })

    it('should return sanitized value when snack has content', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [],
        snack: 'Apple & Banana',
        meal: null,
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.snack).toBe('Apple &amp; Banana')
    })

    it('should sanitize HTML entities', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [],
        snack: '<script>xss</script>',
        meal: null,
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.snack).toContain('&lt;script&gt;')
      expect(result.snack).not.toContain('<script>')
    })
  })

  describe('meal', () => {
    it('should return null when all fields are empty', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [],
        snack: '',
        meal: {
          menu: '',
          notes: '',
          items_to_bring: '',
        },
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.meal).toBeNull()
    })

    it('should return null when all fields are whitespace', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [],
        snack: '',
        meal: {
          menu: '   ',
          notes: '  ',
          items_to_bring: '   ',
        },
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.meal).toBeNull()
    })

    it('should return meal when only menu has value', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [],
        snack: '',
        meal: {
          menu: 'Curry & Rice',
          notes: '',
          items_to_bring: '',
        },
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.meal).not.toBeNull()
      expect(result.meal?.menu).toBe('Curry &amp; Rice')
    })

    it('should return meal when only notes has value', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [],
        snack: '',
        meal: {
          menu: '',
          notes: 'Allergy-friendly',
          items_to_bring: '',
        },
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.meal).not.toBeNull()
      expect(result.meal?.notes).toBe('Allergy-friendly')
    })

    it('should return meal when only items_to_bring has value', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [],
        snack: '',
        meal: {
          menu: '',
          notes: '',
          items_to_bring: 'Fork & Spoon',
        },
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.meal).not.toBeNull()
      expect(result.meal?.items_to_bring).toBe('Fork &amp; Spoon')
    })

    it('should sanitize all meal fields', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [],
        snack: '',
        meal: {
          menu: '<b>Menu</b>',
          notes: '<i>Notes</i>',
          items_to_bring: '<u>Items</u>',
        },
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.meal?.menu).toContain('&lt;b&gt;')
      expect(result.meal?.notes).toContain('&lt;i&gt;')
      expect(result.meal?.items_to_bring).toContain('&lt;u&gt;')
    })

    it('should return null when meal input is null', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [],
        snack: '',
        meal: null,
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.meal).toBeNull()
    })
  })

  describe('special_notes', () => {
    it('should return null when empty string', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [],
        snack: '',
        meal: null,
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.special_notes).toBeNull()
    })

    it('should return null when whitespace only', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [],
        snack: '',
        meal: null,
        specialNotes: '   ',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.special_notes).toBeNull()
    })

    it('should return sanitized value when has content', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [],
        snack: '',
        meal: null,
        specialNotes: 'Important note',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.special_notes).toBe('Important note')
    })

    it('should sanitize HTML entities', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [],
        snack: '',
        meal: null,
        specialNotes: '<script>alert("xss")</script>',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.special_notes).toContain('&lt;script&gt;')
      expect(result.special_notes).not.toContain('<script>')
    })
  })

  describe('event_name', () => {
    it('should return null when empty string', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [],
        snack: '',
        meal: null,
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.event_name).toBeNull()
    })

    it('should return null when whitespace only', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [],
        snack: '',
        meal: null,
        specialNotes: '',
        eventName: '   ',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.event_name).toBeNull()
    })

    it('should return sanitized value when has content', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [],
        snack: '',
        meal: null,
        specialNotes: '',
        eventName: 'Sports Day',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.event_name).toBe('Sports Day')
    })

    it('should sanitize HTML entities', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [],
        snack: '',
        meal: null,
        specialNotes: '',
        eventName: '<h1>Event</h1>',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.event_name).toContain('&lt;h1&gt;')
      expect(result.event_name).not.toContain('<h1>')
    })
  })

  describe('comprehensive integration tests', () => {
    it('should handle all fields with valid data', () => {
      const input = {
        roleAssignments: [
          { user_id: 'user-1', user_name: 'Alice', role: 'Teacher' },
        ],
        dailySchedule: [
          { time: '10:00', content: 'Morning Circle' },
        ],
        snack: 'Apple',
        meal: {
          menu: 'Curry Rice',
          notes: 'Mild spice',
          items_to_bring: 'Spoon',
        },
        specialNotes: 'Good weather today',
        eventName: 'Field Trip',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.role_assignments).toHaveLength(1)
      expect(result.daily_schedule).toHaveLength(1)
      expect(result.snack).toBe('Apple')
      expect(result.meal?.menu).toBe('Curry Rice')
      expect(result.special_notes).toBe('Good weather today')
      expect(result.event_name).toBe('Field Trip')
    })

    it('should handle all fields with empty/null data', () => {
      const input = {
        roleAssignments: [],
        dailySchedule: [],
        snack: '',
        meal: null,
        specialNotes: '',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.role_assignments).toBeNull()
      expect(result.daily_schedule).toBeNull()
      expect(result.snack).toBeNull()
      expect(result.meal).toBeNull()
      expect(result.special_notes).toBeNull()
      expect(result.event_name).toBeNull()
    })

    it('should handle mixed valid and invalid data', () => {
      const input = {
        roleAssignments: [
          { user_id: '', user_name: '', role: '' },
          { user_id: 'user-1', user_name: 'Alice', role: 'Teacher' },
        ],
        dailySchedule: [
          { time: '', content: '' },
          { time: '10:00', content: 'Activity' },
        ],
        snack: '   ',
        meal: {
          menu: '',
          notes: '',
          items_to_bring: 'Spoon',
        },
        specialNotes: 'Note',
        eventName: '',
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.role_assignments).toHaveLength(1)
      expect(result.daily_schedule).toHaveLength(1)
      expect(result.snack).toBeNull()
      expect(result.meal).not.toBeNull()
      expect(result.special_notes).toBe('Note')
      expect(result.event_name).toBeNull()
    })
  })

  describe('XSS protection', () => {
    it('should protect against XSS in all text fields', () => {
      const xssPayload = '<script>alert("xss")</script>'
      const input = {
        roleAssignments: [
          { user_id: 'user-1', user_name: 'Test', role: xssPayload },
        ],
        dailySchedule: [
          { time: '10:00', content: xssPayload },
        ],
        snack: xssPayload,
        meal: {
          menu: xssPayload,
          notes: xssPayload,
          items_to_bring: xssPayload,
        },
        specialNotes: xssPayload,
        eventName: xssPayload,
      }

      const result = getSanitizedExtendedFields(input)

      expect(result.role_assignments?.[0].role).not.toContain('<script>')
      expect(result.daily_schedule?.[0].content).not.toContain('<script>')
      expect(result.snack).not.toContain('<script>')
      expect(result.meal?.menu).not.toContain('<script>')
      expect(result.meal?.notes).not.toContain('<script>')
      expect(result.meal?.items_to_bring).not.toContain('<script>')
      expect(result.special_notes).not.toContain('<script>')
      expect(result.event_name).not.toContain('<script>')
    })
  })
})
