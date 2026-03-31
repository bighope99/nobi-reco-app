/**
 * Test file for formatObservationsToYaml
 *
 * Given: A set of observations with child info and date range
 * When: formatObservationsToYaml is called
 * Then: Returns a FormatResult containing valid YAML, truncation flag, and count
 */

import { formatObservationsToYaml } from '../formatObservationsToYaml';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid observation for use in tests that don't care about content. */
function makeObservation(
  date: string,
  overrides: Partial<{
    content: string;
    objective: string | null;
    subjective: string | null;
    tags: Array<{ name: string }>;
  }> = {}
) {
  return {
    observation_date: date,
    content: 'テスト内容',
    objective: null,
    subjective: null,
    tags: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// describe: Basic structure
// ---------------------------------------------------------------------------

describe('formatObservationsToYaml', () => {
  describe('Basic structure', () => {
    it('should return a yaml string, truncated flag, and observationCount', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [
          makeObservation('2026-01-15', {
            content: 'ブロックで積み木を重ねた。',
            objective: '積み木を10個積んだ。',
            subjective: '楽しそうだった。',
            tags: [{ name: '好奇心' }, { name: '表現力' }],
          }),
        ],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(typeof result.yaml).toBe('string');
      expect(typeof result.truncated).toBe('boolean');
      expect(typeof result.observationCount).toBe('number');
    });

    it('should include child name in YAML', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [makeObservation('2026-01-15')],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.yaml).toContain('田中 太郎');
    });

    it('should include period from and to dates in YAML', () => {
      // Arrange
      const options = {
        childName: '山田 花子',
        grade: 2,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [makeObservation('2026-01-15')],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.yaml).toContain('2026-01-01');
      expect(result.yaml).toContain('2026-03-31');
    });

    it('should include total_observations equal to input count', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [
          makeObservation('2026-01-15'),
          makeObservation('2026-02-10'),
        ],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.yaml).toContain('total_observations: 2');
    });

    it('should include observation date in YAML', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [makeObservation('2026-01-15')],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.yaml).toContain('2026-01-15');
    });

    it('should include tags for each observation', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [
          makeObservation('2026-01-15', {
            tags: [{ name: '好奇心' }, { name: '表現力' }],
          }),
        ],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.yaml).toContain('好奇心');
      expect(result.yaml).toContain('表現力');
    });
  });

  // -------------------------------------------------------------------------
  // describe: Multi-line strings
  // -------------------------------------------------------------------------

  describe('Multi-line string formatting', () => {
    it('should use block scalar | for content containing newline', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [
          makeObservation('2026-01-15', {
            content: '一行目\n二行目',
          }),
        ],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert: block scalar indicator must appear after the key
      expect(result.yaml).toMatch(/content:\s*\|/);
    });

    it('should use block scalar | for objective containing newline', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [
          makeObservation('2026-01-15', {
            objective: '観察1\n観察2',
          }),
        ],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.yaml).toMatch(/objective:\s*\|/);
    });

    it('should use block scalar | for subjective containing newline', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [
          makeObservation('2026-01-15', {
            subjective: '気持ち1\n気持ち2',
          }),
        ],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.yaml).toMatch(/subjective:\s*\|/);
    });

    it('should preserve actual text content inside block scalar', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [
          makeObservation('2026-01-15', {
            content: '一行目\n二行目',
          }),
        ],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.yaml).toContain('一行目');
      expect(result.yaml).toContain('二行目');
    });
  });

  // -------------------------------------------------------------------------
  // describe: Empty tags
  // -------------------------------------------------------------------------

  describe('Empty tags', () => {
    it('should output tags: [] when observation has no tags', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [makeObservation('2026-01-15', { tags: [] })],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.yaml).toContain('tags: []');
    });
  });

  // -------------------------------------------------------------------------
  // describe: Null grade
  // -------------------------------------------------------------------------

  describe('Null grade', () => {
    it('should output grade: ~ when grade is null', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: null,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [makeObservation('2026-01-15')],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.yaml).toContain('grade: ~');
    });

    it('should output numeric grade when grade is provided', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [makeObservation('2026-01-15')],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.yaml).toContain('grade: 3');
    });
  });

  // -------------------------------------------------------------------------
  // describe: Null objective / subjective
  // -------------------------------------------------------------------------

  describe('Null objective and subjective', () => {
    it('should output objective: ~ when objective is null', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [makeObservation('2026-01-15', { objective: null })],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.yaml).toContain('objective: ~');
    });

    it('should output subjective: ~ when subjective is null', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [makeObservation('2026-01-15', { subjective: null })],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.yaml).toContain('subjective: ~');
    });
  });

  // -------------------------------------------------------------------------
  // describe: Date sorting
  // -------------------------------------------------------------------------

  describe('Date sorting', () => {
    it('should sort observations ascending by date even if input is unordered', () => {
      // Arrange: supply observations in reverse chronological order
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [
          makeObservation('2026-03-01', { content: '3月の記録' }),
          makeObservation('2026-01-15', { content: '1月の記録' }),
          makeObservation('2026-02-10', { content: '2月の記録' }),
        ],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert: 1月 appears before 2月 which appears before 3月
      const jan = result.yaml.indexOf('2026-01-15');
      const feb = result.yaml.indexOf('2026-02-10');
      const mar = result.yaml.indexOf('2026-03-01');
      expect(jan).toBeLessThan(feb);
      expect(feb).toBeLessThan(mar);
    });

    it('should keep same-date observations stable (no crash)', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [
          makeObservation('2026-01-15', { content: 'A' }),
          makeObservation('2026-01-15', { content: 'B' }),
        ],
      };

      // Act & Assert: should not throw
      expect(() => formatObservationsToYaml(options)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // describe: Truncation
  // -------------------------------------------------------------------------

  describe('Truncation', () => {
    it('should set truncated=true when observations exceed maxObservations', () => {
      // Arrange: 5 observations, limit 3
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [
          makeObservation('2026-01-01'),
          makeObservation('2026-01-02'),
          makeObservation('2026-01-03'),
          makeObservation('2026-01-04'),
          makeObservation('2026-01-05'),
        ],
        maxObservations: 3,
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.truncated).toBe(true);
    });

    it('should include only the first maxObservations entries when truncated', () => {
      // Arrange: 5 observations sorted ascending; first 3 should be kept
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [
          makeObservation('2026-01-01'),
          makeObservation('2026-01-02'),
          makeObservation('2026-01-03'),
          makeObservation('2026-01-04'),
          makeObservation('2026-01-05'),
        ],
        maxObservations: 3,
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert: dates 04 and 05 must NOT appear
      expect(result.yaml).not.toContain('2026-01-04');
      expect(result.yaml).not.toContain('2026-01-05');
    });

    it('should return observationCount equal to truncated count', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [
          makeObservation('2026-01-01'),
          makeObservation('2026-01-02'),
          makeObservation('2026-01-03'),
          makeObservation('2026-01-04'),
          makeObservation('2026-01-05'),
        ],
        maxObservations: 3,
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.observationCount).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // describe: No truncation
  // -------------------------------------------------------------------------

  describe('No truncation', () => {
    it('should set truncated=false when observations are within default limit', () => {
      // Arrange: 2 observations, default maxObservations=100
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [
          makeObservation('2026-01-15'),
          makeObservation('2026-02-10'),
        ],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.truncated).toBe(false);
    });

    it('should set truncated=false when observations equal maxObservations exactly', () => {
      // Arrange: 3 observations, limit 3
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [
          makeObservation('2026-01-01'),
          makeObservation('2026-01-02'),
          makeObservation('2026-01-03'),
        ],
        maxObservations: 3,
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.truncated).toBe(false);
    });

    it('should return observationCount equal to total when not truncated', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [
          makeObservation('2026-01-15'),
          makeObservation('2026-02-10'),
        ],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.observationCount).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // describe: Empty observations
  // -------------------------------------------------------------------------

  describe('Empty observations', () => {
    it('should return valid YAML with total_observations: 0', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.yaml).toContain('total_observations: 0');
    });

    it('should return observations: [] when observations array is empty', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.yaml).toContain('observations: []');
    });

    it('should return truncated=false when observations array is empty', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.truncated).toBe(false);
    });

    it('should return observationCount=0 when observations array is empty', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.observationCount).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // describe: observationCount accuracy
  // -------------------------------------------------------------------------

  describe('observationCount accuracy', () => {
    it('should reflect post-truncation count in observationCount', () => {
      // Arrange: 10 observations, limit 5
      const observations = Array.from({ length: 10 }, (_, i) =>
        makeObservation(`2026-01-${String(i + 1).padStart(2, '0')}`)
      );
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations,
        maxObservations: 5,
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert
      expect(result.observationCount).toBe(5);
    });

    it('should match observationCount with total_observations in YAML when not truncated', () => {
      // Arrange
      const options = {
        childName: '田中 太郎',
        grade: 3,
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        observations: [
          makeObservation('2026-01-15'),
          makeObservation('2026-02-10'),
          makeObservation('2026-03-05'),
        ],
      };

      // Act
      const result = formatObservationsToYaml(options);

      // Assert: both the returned field and the embedded YAML value agree
      expect(result.observationCount).toBe(3);
      expect(result.yaml).toContain('total_observations: 3');
    });
  });
});
