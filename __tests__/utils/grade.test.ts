import { calculateGrade, formatGradeLabel } from '@/utils/grade';

describe('calculateGrade', () => {
  // Mock current date to 2026-01-17 for consistent testing
  const CURRENT_DATE = new Date('2026-01-17');

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(CURRENT_DATE);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('Edge Cases - Input Validation', () => {
    it('should return null when birthDate is null', () => {
      expect(calculateGrade(null)).toBeNull();
    });

    it('should return null when birthDate is undefined', () => {
      expect(calculateGrade(undefined)).toBeNull();
    });

    it('should return null when birthDate is invalid string', () => {
      expect(calculateGrade('invalid-date')).toBeNull();
    });

    it('should return null when birthDate is empty string', () => {
      expect(calculateGrade('')).toBeNull();
    });

    it('should handle Date object input', () => {
      const birthDate = new Date('2018-04-02');
      const grade = calculateGrade(birthDate);
      expect(grade).toBe(1); // Should be grade 1 in Jan 2026
    });

    it('should handle ISO date string input', () => {
      const grade = calculateGrade('2018-04-02');
      expect(grade).toBe(1);
    });
  });

  describe('Japanese School Year System - Critical Boundary Cases', () => {
    // Japanese school year: April 2 (current year) to April 1 (next year)
    // 2025年度 (2025-04-02 ~ 2026-04-01) = Elementary 1st grade born 2018-04-02 ~ 2019-04-01

    describe('April 1st Birthday - "早生まれ" (Early Birth)', () => {
      it('should treat April 1st birthday as previous school year (same as April 2 of previous year)', () => {
        // 2018-04-01 birth should be Grade 2 in Jan 2026 (same cohort as 2017-04-02)
        const gradeApril1_2018 = calculateGrade('2018-04-01');
        const gradeApril2_2017 = calculateGrade('2017-04-02');

        // CRITICAL: April 1 of year N and April 2 of year N-1 should be the SAME grade
        expect(gradeApril1_2018).toBe(gradeApril2_2017);
        expect(gradeApril1_2018).toBe(2); // Should be grade 2 in Jan 2026
      });

      it('should correctly handle April 1st vs April 2nd grade boundary', () => {
        // These two dates are in DIFFERENT school years
        const gradeApril1_2018 = calculateGrade('2018-04-01'); // Grade 2 (cohort: 2017-04-02 ~ 2018-04-01)
        const gradeApril2_2018 = calculateGrade('2018-04-02'); // Grade 1 (cohort: 2018-04-02 ~ 2019-04-01)

        expect(gradeApril1_2018).toBe(gradeApril2_2018 + 1);
      });
    });

    describe('Current School Year (2025年度) - Grade 1 Students', () => {
      it('should return grade 1 for April 2, 2018 birth (start of school year)', () => {
        expect(calculateGrade('2018-04-02')).toBe(1);
      });

      it('should return grade 1 for middle of school year births', () => {
        expect(calculateGrade('2018-07-15')).toBe(1);
        expect(calculateGrade('2018-10-01')).toBe(1);
        expect(calculateGrade('2019-01-01')).toBe(1);
      });

      it('should return grade 1 for April 1, 2019 birth (end of school year)', () => {
        expect(calculateGrade('2019-04-01')).toBe(1);
      });
    });

    describe('Previous School Year (2024年度) - Grade 2 Students', () => {
      it('should return grade 2 for April 2, 2017 birth (start of school year)', () => {
        expect(calculateGrade('2017-04-02')).toBe(2);
      });

      it('should return grade 2 for middle of school year births', () => {
        expect(calculateGrade('2017-07-15')).toBe(2);
        expect(calculateGrade('2017-10-01')).toBe(2);
        expect(calculateGrade('2018-01-01')).toBe(2);
      });

      it('should return grade 2 for April 1, 2018 birth (end of school year)', () => {
        expect(calculateGrade('2018-04-01')).toBe(2);
      });
    });
  });

  describe('User-Requested Test Cases (2026-01 verification)', () => {
    it('should calculate grade for 2017-04-02 birth (should be Grade 2)', () => {
      // Born 2017-04-02 → 2024年度入学 → 2026-01時点で2年生
      expect(calculateGrade('2017-04-02')).toBe(2);
    });

    it('should calculate grade for 2018-03-05 birth (should be Grade 2)', () => {
      // Born 2018-03-05 → 2024年度入学 → 2026-01時点で2年生
      expect(calculateGrade('2018-03-05')).toBe(2);
    });

    it('should calculate grade for 2018-04-01 birth (should be Grade 2 - early birth)', () => {
      // Born 2018-04-01 → 2024年度入学 → 2026-01時点で2年生
      // CRITICAL: This is the "早生まれ" case - same cohort as 2017-04-02
      expect(calculateGrade('2018-04-01')).toBe(2);
    });
  });

  describe('Full Elementary School Range (Grades 1-6)', () => {
    it('should calculate grade 1 correctly', () => {
      expect(calculateGrade('2018-05-15')).toBe(1);
    });

    it('should calculate grade 2 correctly', () => {
      expect(calculateGrade('2017-05-15')).toBe(2);
    });

    it('should calculate grade 3 correctly', () => {
      expect(calculateGrade('2016-05-15')).toBe(3);
    });

    it('should calculate grade 4 correctly', () => {
      expect(calculateGrade('2015-05-15')).toBe(4);
    });

    it('should calculate grade 5 correctly', () => {
      expect(calculateGrade('2014-05-15')).toBe(5);
    });

    it('should calculate grade 6 correctly', () => {
      expect(calculateGrade('2013-05-15')).toBe(6);
    });
  });

  describe('Pre-school and Junior High Range', () => {
    it('should return negative grade for children not yet in elementary school', () => {
      expect(calculateGrade('2020-05-15')).toBeLessThanOrEqual(0);
    });

    it('should return grade 7+ for junior high students', () => {
      expect(calculateGrade('2012-05-15')).toBe(7);
    });

    it('should return grade 8+ for older students', () => {
      expect(calculateGrade('2011-05-15')).toBe(8);
    });
  });

  describe('gradeAdd Parameter - Grade Adjustment', () => {
    it('should apply positive gradeAdd adjustment', () => {
      const baseGrade = calculateGrade('2018-05-15', 0);
      const adjustedGrade = calculateGrade('2018-05-15', 1);
      expect(adjustedGrade).toBe((baseGrade ?? 0) + 1);
    });

    it('should apply negative gradeAdd adjustment', () => {
      const baseGrade = calculateGrade('2018-05-15', 0);
      const adjustedGrade = calculateGrade('2018-05-15', -1);
      expect(adjustedGrade).toBe((baseGrade ?? 0) - 1);
    });

    it('should handle null gradeAdd as 0', () => {
      const withNull = calculateGrade('2018-05-15', null);
      const withZero = calculateGrade('2018-05-15', 0);
      expect(withNull).toBe(withZero);
    });

    it('should handle undefined gradeAdd as 0', () => {
      const withUndefined = calculateGrade('2018-05-15', undefined);
      const withZero = calculateGrade('2018-05-15', 0);
      expect(withUndefined).toBe(withZero);
    });

    it('should handle non-finite gradeAdd as 0', () => {
      const withNaN = calculateGrade('2018-05-15', NaN);
      const withZero = calculateGrade('2018-05-15', 0);
      expect(withNaN).toBe(withZero);
    });

    it('should allow large positive adjustments', () => {
      const baseGrade = calculateGrade('2018-05-15', 0);
      const adjusted = calculateGrade('2018-05-15', 5);
      expect(adjusted).toBe((baseGrade ?? 0) + 5);
    });

    it('should allow large negative adjustments', () => {
      const baseGrade = calculateGrade('2018-05-15', 0);
      const adjusted = calculateGrade('2018-05-15', -3);
      expect(adjusted).toBe((baseGrade ?? 0) - 3);
    });
  });

  describe('Month Boundary Edge Cases', () => {
    it('should handle March 31 correctly', () => {
      const gradeMarch31 = calculateGrade('2018-03-31');
      const gradeApril1 = calculateGrade('2018-04-01');
      // March 31 and April 1 of same year should be same grade
      expect(gradeMarch31).toBe(gradeApril1);
    });

    it('should handle February 29 (leap year)', () => {
      // 2016-02-29 → 2022年度入学 → 2026-01時点で4年生
      expect(calculateGrade('2016-02-29')).toBe(4); // Valid date
    });

    it('should handle December 31', () => {
      expect(calculateGrade('2018-12-31')).toBe(1);
    });

    it('should handle January 1', () => {
      expect(calculateGrade('2019-01-01')).toBe(1);
    });
  });

  describe('Historical and Future Dates', () => {
    it('should handle students born 20 years ago', () => {
      const grade = calculateGrade('2006-05-15');
      expect(grade).toBeGreaterThan(10); // Would be out of elementary school
    });

    it('should handle newborns', () => {
      const grade = calculateGrade('2025-12-01');
      expect(grade).toBeLessThanOrEqual(0); // Not yet in school
    });

    it('should handle future dates (not yet born)', () => {
      const grade = calculateGrade('2027-05-15');
      expect(grade).toBeLessThan(0); // Negative grade
    });
  });
});

describe('formatGradeLabel', () => {
  describe('Valid Grades', () => {
    it('should format grade 1', () => {
      expect(formatGradeLabel(1)).toBe('1年生');
    });

    it('should format grade 6', () => {
      expect(formatGradeLabel(6)).toBe('6年生');
    });

    it('should format junior high grades', () => {
      expect(formatGradeLabel(7)).toBe('7年生');
      expect(formatGradeLabel(8)).toBe('8年生');
      expect(formatGradeLabel(9)).toBe('9年生');
    });
  });

  describe('Pre-school', () => {
    it('should show 未就学 for grade 0', () => {
      expect(formatGradeLabel(0)).toBe('未就学');
    });

    it('should show 未就学 for negative grades', () => {
      expect(formatGradeLabel(-1)).toBe('未就学');
      expect(formatGradeLabel(-5)).toBe('未就学');
    });
  });

  describe('Edge Cases - Invalid Input', () => {
    it('should show - for null', () => {
      expect(formatGradeLabel(null)).toBe('-');
    });

    it('should show - for undefined', () => {
      expect(formatGradeLabel(undefined)).toBe('-');
    });

    it('should show - for NaN', () => {
      expect(formatGradeLabel(NaN)).toBe('-');
    });
  });

  describe('Boundary Values', () => {
    it('should handle very large grades', () => {
      expect(formatGradeLabel(100)).toBe('100年生');
    });

    it('should handle very small negative grades', () => {
      expect(formatGradeLabel(-100)).toBe('未就学');
    });
  });
});
