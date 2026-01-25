import {
  getDayOfWeekKey,
  isScheduledForDate,
  weekdayJpMap,
} from '@/app/api/attendance/utils/attendance';

describe('getDayOfWeekKey', () => {
  describe('JSTベースの曜日判定', () => {
    it('should return "monday" for 2026-01-26', () => {
      // 2026年1月26日は月曜日（JST）
      expect(getDayOfWeekKey('2026-01-26')).toBe('monday');
    });

    it('should return "sunday" for 2026-01-25', () => {
      // 2026年1月25日は日曜日（JST）
      expect(getDayOfWeekKey('2026-01-25')).toBe('sunday');
    });

    it('should return "tuesday" for 2026-01-27', () => {
      // 2026年1月27日は火曜日（JST）
      expect(getDayOfWeekKey('2026-01-27')).toBe('tuesday');
    });
  });

  describe('全曜日の判定', () => {
    it('should return correct day for each day of the week', () => {
      // 2026-01-25 (日) から 2026-01-31 (土) までの週
      expect(getDayOfWeekKey('2026-01-25')).toBe('sunday');
      expect(getDayOfWeekKey('2026-01-26')).toBe('monday');
      expect(getDayOfWeekKey('2026-01-27')).toBe('tuesday');
      expect(getDayOfWeekKey('2026-01-28')).toBe('wednesday');
      expect(getDayOfWeekKey('2026-01-29')).toBe('thursday');
      expect(getDayOfWeekKey('2026-01-30')).toBe('friday');
      expect(getDayOfWeekKey('2026-01-31')).toBe('saturday');
    });
  });

  describe('タイムゾーン境界テスト', () => {
    it('should correctly handle dates that would be different day in UTC', () => {
      // 2026-01-26はJSTでは月曜日
      // UTCでは2026-01-25 15:00:00となるが、JSTでは2026-01-26 00:00:00
      // getDayOfWeekKeyはJSTベースで計算するため、月曜日を返すべき
      expect(getDayOfWeekKey('2026-01-26')).toBe('monday');
    });

    it('should handle year boundary correctly', () => {
      // 2026年1月1日は木曜日（JST）
      expect(getDayOfWeekKey('2026-01-01')).toBe('thursday');
    });

    it('should handle leap year date correctly', () => {
      // 2024年2月29日は木曜日（閏年、JST）
      expect(getDayOfWeekKey('2024-02-29')).toBe('thursday');
    });
  });
});

describe('isScheduledForDate', () => {
  describe('曜日パターンによるスケジュール判定', () => {
    it('should return true when schedule pattern has monday=true and day is monday', () => {
      const schedulePattern = { monday: true, tuesday: false, wednesday: false };
      const dailyRecord = undefined;
      const dayOfWeekKey = 'monday';

      expect(isScheduledForDate(schedulePattern, dailyRecord, dayOfWeekKey)).toBe(true);
    });

    it('should return false when schedule pattern has monday=false and day is monday', () => {
      const schedulePattern = { monday: false, tuesday: true, wednesday: true };
      const dailyRecord = undefined;
      const dayOfWeekKey = 'monday';

      expect(isScheduledForDate(schedulePattern, dailyRecord, dayOfWeekKey)).toBe(false);
    });

    it('should return false when schedule pattern is undefined', () => {
      const schedulePattern = undefined;
      const dailyRecord = undefined;
      const dayOfWeekKey = 'monday';

      expect(isScheduledForDate(schedulePattern, dailyRecord, dayOfWeekKey)).toBe(false);
    });
  });

  describe('dailyRecordによるスケジュール上書き', () => {
    it('should return true when dailyRecord status is "scheduled" regardless of pattern', () => {
      // パターンでは出席予定でなくても、dailyRecordで'scheduled'なら出席予定
      const schedulePattern = { monday: false };
      const dailyRecord = { status: 'scheduled' };
      const dayOfWeekKey = 'monday';

      expect(isScheduledForDate(schedulePattern, dailyRecord, dayOfWeekKey)).toBe(true);
    });

    it('should return false when dailyRecord status is "absent" regardless of pattern', () => {
      // パターンでは出席予定でも、dailyRecordで'absent'なら欠席
      const schedulePattern = { monday: true };
      const dailyRecord = { status: 'absent' };
      const dayOfWeekKey = 'monday';

      expect(isScheduledForDate(schedulePattern, dailyRecord, dayOfWeekKey)).toBe(false);
    });

    it('should return false when dailyRecord status is "irregular"', () => {
      // 'irregular'ステータスも出席予定ではない
      const schedulePattern = { monday: true };
      const dailyRecord = { status: 'irregular' };
      const dayOfWeekKey = 'monday';

      expect(isScheduledForDate(schedulePattern, dailyRecord, dayOfWeekKey)).toBe(false);
    });
  });

  describe('dailyRecordとパターンの組み合わせ', () => {
    it('should follow pattern when dailyRecord has unknown status', () => {
      // 不明なステータスの場合、パターンに従う
      const schedulePattern = { friday: true };
      const dailyRecord = { status: 'other_status' };
      const dayOfWeekKey = 'friday';

      expect(isScheduledForDate(schedulePattern, dailyRecord, dayOfWeekKey)).toBe(true);
    });

    it('should return scheduled=false when pattern is true but dailyRecord is absent', () => {
      const schedulePattern = { tuesday: true };
      const dailyRecord = { status: 'absent' };
      const dayOfWeekKey = 'tuesday';

      expect(isScheduledForDate(schedulePattern, dailyRecord, dayOfWeekKey)).toBe(false);
    });

    it('should return scheduled=true when pattern is false but dailyRecord is scheduled', () => {
      const schedulePattern = { wednesday: false };
      const dailyRecord = { status: 'scheduled' };
      const dayOfWeekKey = 'wednesday';

      expect(isScheduledForDate(schedulePattern, dailyRecord, dayOfWeekKey)).toBe(true);
    });
  });

  describe('エッジケース', () => {
    it('should handle empty schedulePattern object', () => {
      const schedulePattern = {};
      const dailyRecord = undefined;
      const dayOfWeekKey = 'monday';

      // empty objectの場合、schedulePattern[dayOfWeekKey]はundefinedなのでfalseになる
      expect(isScheduledForDate(schedulePattern, dailyRecord, dayOfWeekKey)).toBe(false);
    });

    it('should handle null values in schedulePattern', () => {
      const schedulePattern = { monday: null };
      const dailyRecord = undefined;
      const dayOfWeekKey = 'monday';

      // null は falsy なので false
      expect(isScheduledForDate(schedulePattern, dailyRecord, dayOfWeekKey)).toBe(false);
    });
  });
});

describe('weekdayJpMap', () => {
  describe('曜日の日本語マッピング', () => {
    it('should map "sunday" to "日"', () => {
      expect(weekdayJpMap.sunday).toBe('日');
    });

    it('should map "monday" to "月"', () => {
      expect(weekdayJpMap.monday).toBe('月');
    });

    it('should map "tuesday" to "火"', () => {
      expect(weekdayJpMap.tuesday).toBe('火');
    });

    it('should map "wednesday" to "水"', () => {
      expect(weekdayJpMap.wednesday).toBe('水');
    });

    it('should map "thursday" to "木"', () => {
      expect(weekdayJpMap.thursday).toBe('木');
    });

    it('should map "friday" to "金"', () => {
      expect(weekdayJpMap.friday).toBe('金');
    });

    it('should map "saturday" to "土"', () => {
      expect(weekdayJpMap.saturday).toBe('土');
    });
  });

  describe('マッピングの完全性', () => {
    it('should have exactly 7 entries', () => {
      expect(Object.keys(weekdayJpMap)).toHaveLength(7);
    });

    it('should contain all weekday keys', () => {
      const expectedKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      expect(Object.keys(weekdayJpMap).sort()).toEqual(expectedKeys.sort());
    });
  });
});
