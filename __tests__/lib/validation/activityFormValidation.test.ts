/**
 * @jest-environment node
 */
import { validateActivityFormSubmission } from '@/lib/validation/activityValidation';

describe('validateActivityFormSubmission', () => {
  describe('記録者バリデーション', () => {
    it('記録者が未選択の場合はエラーを返すこと', () => {
      const result = validateActivityFormSubmission({
        selectedRecorder: '',
        activityContent: 'テスト内容',
        eventName: '',
        dailySchedule: [],
        specialNotes: '',
        snack: '',
        meal: null,
        handover: '',
        photos: [],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('記録者');
      }
    });

    it('記録者が選択されている場合はエラーにならないこと', () => {
      const result = validateActivityFormSubmission({
        selectedRecorder: 'user-id-123',
        activityContent: 'テスト内容',
        eventName: '',
        dailySchedule: [],
        specialNotes: '',
        snack: '',
        meal: null,
        handover: '',
        photos: [],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('空入力バリデーション', () => {
    it('記録者のみで他のフィールドが全て空の場合はエラーを返すこと', () => {
      const result = validateActivityFormSubmission({
        selectedRecorder: 'user-id-123',
        activityContent: '',
        eventName: '',
        dailySchedule: [],
        specialNotes: '',
        snack: '',
        meal: null,
        handover: '',
        photos: [],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('1つ以上');
      }
    });

    it('記録者のみで空白のみのcontentの場合はエラーを返すこと', () => {
      const result = validateActivityFormSubmission({
        selectedRecorder: 'user-id-123',
        activityContent: '   ',
        eventName: '',
        dailySchedule: [],
        specialNotes: '',
        snack: '',
        meal: null,
        handover: '',
        photos: [],
      });
      expect(result.valid).toBe(false);
    });

    it('contentに値がある場合は有効であること', () => {
      const result = validateActivityFormSubmission({
        selectedRecorder: 'user-id-123',
        activityContent: '今日の活動内容',
        eventName: '',
        dailySchedule: [],
        specialNotes: '',
        snack: '',
        meal: null,
        handover: '',
        photos: [],
      });
      expect(result.valid).toBe(true);
    });

    it('eventNameに値がある場合は有効であること', () => {
      const result = validateActivityFormSubmission({
        selectedRecorder: 'user-id-123',
        activityContent: '',
        eventName: '運動会',
        dailySchedule: [],
        specialNotes: '',
        snack: '',
        meal: null,
        handover: '',
        photos: [],
      });
      expect(result.valid).toBe(true);
    });

    it('dailyScheduleに内容がある場合は有効であること', () => {
      const result = validateActivityFormSubmission({
        selectedRecorder: 'user-id-123',
        activityContent: '',
        eventName: '',
        dailySchedule: [{ time: '10:00', content: '外遊び' }],
        specialNotes: '',
        snack: '',
        meal: null,
        handover: '',
        photos: [],
      });
      expect(result.valid).toBe(true);
    });

    it('dailyScheduleの内容が全て空の場合は無効であること', () => {
      const result = validateActivityFormSubmission({
        selectedRecorder: 'user-id-123',
        activityContent: '',
        eventName: '',
        dailySchedule: [{ time: '10:00', content: '' }, { time: '10:00', content: '' }],
        specialNotes: '',
        snack: '',
        meal: null,
        handover: '',
        photos: [],
      });
      expect(result.valid).toBe(false);
    });

    it('specialNotesに値がある場合は有効であること', () => {
      const result = validateActivityFormSubmission({
        selectedRecorder: 'user-id-123',
        activityContent: '',
        eventName: '',
        dailySchedule: [],
        specialNotes: '特記事項あり',
        snack: '',
        meal: null,
        handover: '',
        photos: [],
      });
      expect(result.valid).toBe(true);
    });

    it('snackに値がある場合は有効であること', () => {
      const result = validateActivityFormSubmission({
        selectedRecorder: 'user-id-123',
        activityContent: '',
        eventName: '',
        dailySchedule: [],
        specialNotes: '',
        snack: 'おせんべい',
        meal: null,
        handover: '',
        photos: [],
      });
      expect(result.valid).toBe(true);
    });

    it('mealに値がある場合は有効であること', () => {
      const result = validateActivityFormSubmission({
        selectedRecorder: 'user-id-123',
        activityContent: '',
        eventName: '',
        dailySchedule: [],
        specialNotes: '',
        snack: '',
        meal: { menu: 'カレーライス' },
        handover: '',
        photos: [],
      });
      expect(result.valid).toBe(true);
    });

    it('meal.menuが空の場合は無効であること', () => {
      const result = validateActivityFormSubmission({
        selectedRecorder: 'user-id-123',
        activityContent: '',
        eventName: '',
        dailySchedule: [],
        specialNotes: '',
        snack: '',
        meal: { menu: '' },
        handover: '',
        photos: [],
      });
      expect(result.valid).toBe(false);
    });

    it('handoverに値がある場合は有効であること', () => {
      const result = validateActivityFormSubmission({
        selectedRecorder: 'user-id-123',
        activityContent: '',
        eventName: '',
        dailySchedule: [],
        specialNotes: '',
        snack: '',
        meal: null,
        handover: '明日の連絡事項',
        photos: [],
      });
      expect(result.valid).toBe(true);
    });

    it('photosに値がある場合は有効であること', () => {
      const result = validateActivityFormSubmission({
        selectedRecorder: 'user-id-123',
        activityContent: '',
        eventName: '',
        dailySchedule: [],
        specialNotes: '',
        snack: '',
        meal: null,
        handover: '',
        photos: [{ url: 'https://example.com/photo.jpg' }],
      });
      expect(result.valid).toBe(true);
    });

    it('photos配列に空URLの要素のみがある場合は無効であること', () => {
      const result = validateActivityFormSubmission({
        selectedRecorder: 'user-id-123',
        activityContent: '',
        eventName: '',
        dailySchedule: [],
        specialNotes: '',
        snack: '',
        meal: null,
        handover: '',
        photos: [{ url: '' }],
      });
      expect(result.valid).toBe(false);
    });
  });
});
