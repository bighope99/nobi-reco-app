/**
 * Test file for new timezone utility functions
 *
 * Tests for:
 * - getTomorrowDateJST()
 * - toDateStringJST()
 * - getFirstDayOfMonthJST()
 * - getLastDayOfMonthJST()
 * - extractDateFromISO()
 * - isoToDateJST()
 */

import {
  getTomorrowDateJST,
  toDateStringJST,
  getFirstDayOfMonthJST,
  getLastDayOfMonthJST,
  extractDateFromISO,
  isoToDateJST,
} from '@/lib/utils/timezone';

describe('getTomorrowDateJST', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('should return tomorrow date in YYYY-MM-DD format', () => {
    // Arrange: UTC 2026-01-25 10:00:00 = JST 2026-01-25 19:00:00
    jest.setSystemTime(new Date('2026-01-25T10:00:00Z'));

    // Act
    const result = getTomorrowDateJST();

    // Assert: Tomorrow in JST should be 2026-01-26
    expect(result).toBe('2026-01-26');
  });

  it('should handle 2026-01-26 (Monday) case', () => {
    // Arrange: UTC 2026-01-26 10:00:00 = JST 2026-01-26 19:00:00
    jest.setSystemTime(new Date('2026-01-26T10:00:00Z'));

    // Act
    const result = getTomorrowDateJST();

    // Assert: Tomorrow in JST should be 2026-01-27
    expect(result).toBe('2026-01-27');
  });

  it('should handle day boundary crossing (UTC 15:00 = JST midnight next day)', () => {
    // Arrange: UTC 2026-01-25 15:00:00 = JST 2026-01-26 00:00:00 (midnight)
    jest.setSystemTime(new Date('2026-01-25T15:00:00Z'));

    // Act
    const result = getTomorrowDateJST();

    // Assert: Today in JST is 2026-01-26, so tomorrow is 2026-01-27
    expect(result).toBe('2026-01-27');
  });

  it('should handle month boundary crossing', () => {
    // Arrange: UTC 2026-01-31 10:00:00 = JST 2026-01-31 19:00:00
    jest.setSystemTime(new Date('2026-01-31T10:00:00Z'));

    // Act
    const result = getTomorrowDateJST();

    // Assert: Tomorrow should be February 1st
    expect(result).toBe('2026-02-01');
  });

  it('should handle year boundary crossing', () => {
    // Arrange: UTC 2025-12-31 10:00:00 = JST 2025-12-31 19:00:00
    jest.setSystemTime(new Date('2025-12-31T10:00:00Z'));

    // Act
    const result = getTomorrowDateJST();

    // Assert: Tomorrow should be 2026-01-01
    expect(result).toBe('2026-01-01');
  });

  it('should handle UTC late night before JST day change', () => {
    // Arrange: UTC 2026-01-25 14:59:59 = JST 2026-01-25 23:59:59
    jest.setSystemTime(new Date('2026-01-25T14:59:59Z'));

    // Act
    const result = getTomorrowDateJST();

    // Assert: Today in JST is still 2026-01-25, so tomorrow is 2026-01-26
    expect(result).toBe('2026-01-26');
  });
});

describe('toDateStringJST', () => {
  it('should convert Date object to YYYY-MM-DD format in JST', () => {
    // Arrange: UTC 2026-01-26 10:00:00
    const date = new Date('2026-01-26T10:00:00Z');

    // Act
    const result = toDateStringJST(date);

    // Assert: Should be 2026-01-26 in JST
    expect(result).toBe('2026-01-26');
  });

  it('should handle day boundary crossing (UTC 15:00 = JST next day)', () => {
    // Arrange: UTC 2026-01-25 15:00:00 = JST 2026-01-26 00:00:00
    const date = new Date('2026-01-25T15:00:00Z');

    // Act
    const result = toDateStringJST(date);

    // Assert: Should be next day in JST
    expect(result).toBe('2026-01-26');
  });

  it('should handle UTC 14:59 (still same day in JST)', () => {
    // Arrange: UTC 2026-01-25 14:59:00 = JST 2026-01-25 23:59:00
    const date = new Date('2026-01-25T14:59:00Z');

    // Act
    const result = toDateStringJST(date);

    // Assert: Should still be same day in JST
    expect(result).toBe('2026-01-25');
  });

  it('should pad month and day with leading zeros', () => {
    // Arrange
    const date = new Date('2026-03-05T10:00:00Z');

    // Act
    const result = toDateStringJST(date);

    // Assert: Should have leading zeros
    expect(result).toBe('2026-03-05');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getFirstDayOfMonthJST', () => {
  it('should return first day of January 2026', () => {
    // Act
    const result = getFirstDayOfMonthJST(2026, 1);

    // Assert
    expect(result).toBe('2026-01-01');
  });

  it('should return first day of February 2026', () => {
    // Act
    const result = getFirstDayOfMonthJST(2026, 2);

    // Assert
    expect(result).toBe('2026-02-01');
  });

  it('should return first day of December', () => {
    // Act
    const result = getFirstDayOfMonthJST(2026, 12);

    // Assert
    expect(result).toBe('2026-12-01');
  });

  it('should pad month with leading zero', () => {
    // Act
    const result = getFirstDayOfMonthJST(2026, 3);

    // Assert
    expect(result).toBe('2026-03-01');
  });
});

describe('getLastDayOfMonthJST', () => {
  it('should return last day of January 2026 (31 days)', () => {
    // Act
    const result = getLastDayOfMonthJST(2026, 1);

    // Assert
    expect(result).toBe('2026-01-31');
  });

  it('should return last day of February 2026 (non-leap year, 28 days)', () => {
    // Act
    const result = getLastDayOfMonthJST(2026, 2);

    // Assert: 2026 is not a leap year
    expect(result).toBe('2026-02-28');
  });

  it('should return last day of February in leap year (29 days)', () => {
    // Act
    const result = getLastDayOfMonthJST(2024, 2);

    // Assert: 2024 is a leap year
    expect(result).toBe('2024-02-29');
  });

  it('should return last day of April (30 days)', () => {
    // Act
    const result = getLastDayOfMonthJST(2026, 4);

    // Assert
    expect(result).toBe('2026-04-30');
  });

  it('should return last day of December', () => {
    // Act
    const result = getLastDayOfMonthJST(2026, 12);

    // Assert
    expect(result).toBe('2026-12-31');
  });

  it('should handle September (30 days)', () => {
    // Act
    const result = getLastDayOfMonthJST(2026, 9);

    // Assert
    expect(result).toBe('2026-09-30');
  });
});

describe('extractDateFromISO', () => {
  it('should extract date from ISO string with Z suffix', () => {
    // Act
    const result = extractDateFromISO('2026-01-26T10:30:00Z');

    // Assert
    expect(result).toBe('2026-01-26');
  });

  it('should extract date from ISO string without timezone', () => {
    // Act
    const result = extractDateFromISO('2026-01-26T10:30:00');

    // Assert
    expect(result).toBe('2026-01-26');
  });

  it('should extract date from ISO string with milliseconds', () => {
    // Act
    const result = extractDateFromISO('2026-01-26T10:30:00.123Z');

    // Assert
    expect(result).toBe('2026-01-26');
  });

  it('should extract date from ISO string with timezone offset', () => {
    // Act
    const result = extractDateFromISO('2026-01-26T10:30:00+09:00');

    // Assert: Note - this extracts the literal date, not converted
    expect(result).toBe('2026-01-26');
  });

  it('should handle date-only string', () => {
    // Act
    const result = extractDateFromISO('2026-01-26');

    // Assert
    expect(result).toBe('2026-01-26');
  });
});

describe('isoToDateJST', () => {
  it('should convert UTC ISO string to JST date', () => {
    // Arrange: UTC 2026-01-26 10:00:00 = JST 2026-01-26 19:00:00
    const isoString = '2026-01-26T10:00:00Z';

    // Act
    const result = isoToDateJST(isoString);

    // Assert
    expect(result).toBe('2026-01-26');
  });

  it('should handle day boundary crossing (UTC 15:00 = JST next day midnight)', () => {
    // Arrange: UTC 2026-01-25 15:00:00 = JST 2026-01-26 00:00:00
    const isoString = '2026-01-25T15:00:00Z';

    // Act
    const result = isoToDateJST(isoString);

    // Assert: Should be next day in JST
    expect(result).toBe('2026-01-26');
  });

  it('should handle UTC 14:59 (still same day in JST)', () => {
    // Arrange: UTC 2026-01-25 14:59:59 = JST 2026-01-25 23:59:59
    const isoString = '2026-01-25T14:59:59Z';

    // Act
    const result = isoToDateJST(isoString);

    // Assert: Should still be same day in JST
    expect(result).toBe('2026-01-25');
  });

  it('should handle ISO string with timezone offset', () => {
    // Arrange: Already in JST (+09:00)
    const isoString = '2026-01-26T00:00:00+09:00';

    // Act
    const result = isoToDateJST(isoString);

    // Assert: Should be the same date in JST
    expect(result).toBe('2026-01-26');
  });

  it('should handle 2026-01-26 (Monday) case with various times', () => {
    // Arrange: UTC times on 2026-01-26
    const morningUTC = '2026-01-26T00:00:00Z';
    const eveningUTC = '2026-01-26T14:00:00Z';
    const lateNightUTC = '2026-01-26T15:00:00Z';

    // Act
    const morningResult = isoToDateJST(morningUTC);
    const eveningResult = isoToDateJST(eveningUTC);
    const lateNightResult = isoToDateJST(lateNightUTC);

    // Assert
    expect(morningResult).toBe('2026-01-26'); // UTC 00:00 = JST 09:00 (same day)
    expect(eveningResult).toBe('2026-01-26'); // UTC 14:00 = JST 23:00 (same day)
    expect(lateNightResult).toBe('2026-01-27'); // UTC 15:00 = JST 00:00 (next day)
  });

  it('should handle month boundary crossing', () => {
    // Arrange: UTC 2026-01-31 15:00:00 = JST 2026-02-01 00:00:00
    const isoString = '2026-01-31T15:00:00Z';

    // Act
    const result = isoToDateJST(isoString);

    // Assert: Should be February 1st in JST
    expect(result).toBe('2026-02-01');
  });

  it('should handle year boundary crossing', () => {
    // Arrange: UTC 2025-12-31 15:00:00 = JST 2026-01-01 00:00:00
    const isoString = '2025-12-31T15:00:00Z';

    // Act
    const result = isoToDateJST(isoString);

    // Assert: Should be 2026-01-01 in JST
    expect(result).toBe('2026-01-01');
  });
});

describe('UTC/JST boundary edge cases', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('critical boundary: UTC 15:00 = JST 00:00', () => {
    it('getTomorrowDateJST at boundary should return correct date', () => {
      // Arrange: Exactly at JST midnight (UTC 15:00)
      jest.setSystemTime(new Date('2026-01-25T15:00:00Z'));

      // Act
      const result = getTomorrowDateJST();

      // Assert: Today in JST is 2026-01-26, tomorrow is 2026-01-27
      expect(result).toBe('2026-01-27');
    });

    it('toDateStringJST at boundary should return next day', () => {
      // Arrange
      const date = new Date('2026-01-25T15:00:00Z');

      // Act
      const result = toDateStringJST(date);

      // Assert: Should be 2026-01-26 in JST
      expect(result).toBe('2026-01-26');
    });

    it('isoToDateJST at boundary should return next day', () => {
      // Arrange
      const isoString = '2026-01-25T15:00:00Z';

      // Act
      const result = isoToDateJST(isoString);

      // Assert: Should be 2026-01-26 in JST
      expect(result).toBe('2026-01-26');
    });
  });

  describe('one second before boundary: UTC 14:59:59 = JST 23:59:59', () => {
    it('getTomorrowDateJST should return correct date', () => {
      // Arrange: One second before JST midnight
      jest.setSystemTime(new Date('2026-01-25T14:59:59Z'));

      // Act
      const result = getTomorrowDateJST();

      // Assert: Today in JST is still 2026-01-25, tomorrow is 2026-01-26
      expect(result).toBe('2026-01-26');
    });

    it('toDateStringJST should return same day', () => {
      // Arrange
      const date = new Date('2026-01-25T14:59:59Z');

      // Act
      const result = toDateStringJST(date);

      // Assert: Should still be 2026-01-25 in JST
      expect(result).toBe('2026-01-25');
    });
  });
});
