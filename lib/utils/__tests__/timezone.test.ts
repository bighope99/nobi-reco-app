/**
 * Test file for formatTimeJST utility function
 *
 * Given: UTC time string in ISO8601 format
 * When: formatTimeJST is called
 * Then: Returns JST time in HH:mm format
 */

import { formatTimeJST } from '../timezone';

describe('formatTimeJST', () => {
  describe('UTC to JST conversion', () => {
    it('should convert UTC midnight to JST 09:00', () => {
      // Arrange: UTC 00:00 (midnight) on 2024-01-15
      const utcTime = '2024-01-15T00:00:00Z';

      // Act
      const result = formatTimeJST(utcTime);

      // Assert: JST is UTC+9, so 00:00 UTC = 09:00 JST
      expect(result).toBe('09:00');
    });

    it('should convert UTC 14:00 to JST 23:00', () => {
      // Arrange: UTC 14:00 (2PM) on 2024-01-15
      const utcTime = '2024-01-15T14:00:00Z';

      // Act
      const result = formatTimeJST(utcTime);

      // Assert: 14:00 UTC + 9 hours = 23:00 JST
      expect(result).toBe('23:00');
    });

    it('should handle day boundary crossing (UTC 23:00 = JST 08:00 next day)', () => {
      // Arrange: UTC 23:00 (11PM) on 2024-01-15
      const utcTime = '2024-01-15T23:00:00Z';

      // Act
      const result = formatTimeJST(utcTime);

      // Assert: 23:00 UTC + 9 hours = 08:00 JST (next day)
      // Note: formatTimeJST should only return time, not date
      expect(result).toBe('08:00');
    });

    it('should handle UTC 15:30 with minutes to JST 00:30', () => {
      // Arrange: UTC 15:30 on 2024-01-15
      const utcTime = '2024-01-15T15:30:00Z';

      // Act
      const result = formatTimeJST(utcTime);

      // Assert: 15:30 UTC + 9 hours = 00:30 JST (next day)
      expect(result).toBe('00:30');
    });
  });

  describe('Edge cases', () => {
    it('should return null when input is null', () => {
      // Arrange
      const utcTime = null;

      // Act
      const result = formatTimeJST(utcTime);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when input is undefined', () => {
      // Arrange
      const utcTime = undefined;

      // Act
      const result = formatTimeJST(utcTime);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when input is empty string', () => {
      // Arrange
      const utcTime = '';

      // Act
      const result = formatTimeJST(utcTime);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle ISO string without Z suffix', () => {
      // Arrange: ISO string without explicit UTC marker
      const utcTime = '2024-01-15T10:00:00';

      // Act
      const result = formatTimeJST(utcTime);

      // Assert: Should still parse correctly
      expect(result).toBe('19:00');
    });

    it('should handle ISO string with milliseconds', () => {
      // Arrange: ISO string with milliseconds
      const utcTime = '2024-01-15T10:00:00.123Z';

      // Act
      const result = formatTimeJST(utcTime);

      // Assert: Should ignore milliseconds and return HH:mm
      expect(result).toBe('19:00');
    });
  });

  describe('Invalid input handling', () => {
    it('should return null for invalid date string', () => {
      // Arrange
      const invalidTime = 'invalid-date-string';

      // Act
      const result = formatTimeJST(invalidTime);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for non-date string', () => {
      // Arrange
      const nonDateString = 'not a date';

      // Act
      const result = formatTimeJST(nonDateString);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('Format consistency', () => {
    it('should always return HH:mm format with leading zeros', () => {
      // Arrange: UTC time that results in single-digit hours
      const utcTime = '2024-01-15T00:30:00Z';

      // Act
      const result = formatTimeJST(utcTime);

      // Assert: Should have leading zero
      expect(result).toBe('09:30');
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should pad minutes with leading zero', () => {
      // Arrange: UTC time with single-digit minutes
      const utcTime = '2024-01-15T00:05:00Z';

      // Act
      const result = formatTimeJST(utcTime);

      // Assert
      expect(result).toBe('09:05');
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });
  });
});
