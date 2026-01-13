import { sanitizeText, sanitizeArrayFields, sanitizeObjectFields } from '../sanitize';

describe('sanitize utilities', () => {
  describe('sanitizeText', () => {
    it('should escape HTML entities', () => {
      const input = '<script>alert("XSS")</script>';
      const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';
      expect(sanitizeText(input)).toBe(expected);
    });

    it('should escape all special characters', () => {
      const input = `& < > " '`;
      const expected = '&amp; &lt; &gt; &quot; &#039;';
      expect(sanitizeText(input)).toBe(expected);
    });

    it('should return null for null input', () => {
      expect(sanitizeText(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(sanitizeText(undefined)).toBeNull();
    });

    it('should handle empty string', () => {
      expect(sanitizeText('')).toBe('');
    });

    it('should not modify safe text', () => {
      const input = 'This is safe text without special characters';
      expect(sanitizeText(input)).toBe(input);
    });
  });

  describe('sanitizeArrayFields', () => {
    it('should sanitize specified fields in array items', () => {
      const input = [
        { time: '10:00', content: '<script>alert("XSS")</script>' },
        { time: '11:00', content: 'Safe content' },
      ];
      const result = sanitizeArrayFields(input, ['content']);

      expect(result[0].time).toBe('10:00');
      expect(result[0].content).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
      expect(result[1].content).toBe('Safe content');
    });

    it('should handle multiple fields', () => {
      const input = [
        { user_id: '123', role: '<admin>', name: 'Test User' },
      ];
      const result = sanitizeArrayFields(input, ['role']);

      expect(result[0].user_id).toBe('123');
      expect(result[0].role).toBe('&lt;admin&gt;');
      expect(result[0].name).toBe('Test User');
    });

    it('should handle empty array', () => {
      const result = sanitizeArrayFields([], ['content']);
      expect(result).toEqual([]);
    });
  });

  describe('sanitizeObjectFields', () => {
    it('should sanitize specified fields in object', () => {
      const input = {
        menu: 'Curry & Rice',
        items_to_bring: '<script>alert("XSS")</script>',
        notes: 'Safe note',
      };
      const result = sanitizeObjectFields(input, ['menu', 'items_to_bring', 'notes']);

      expect(result?.menu).toBe('Curry &amp; Rice');
      expect(result?.items_to_bring).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
      expect(result?.notes).toBe('Safe note');
    });

    it('should return null for null input', () => {
      expect(sanitizeObjectFields(null, ['menu'])).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(sanitizeObjectFields(undefined, ['menu'])).toBeNull();
    });

    it('should handle objects with missing fields', () => {
      const input = { menu: 'Test' };
      const result = sanitizeObjectFields(input, ['menu', 'notes']);

      expect(result?.menu).toBe('Test');
      expect(result?.notes).toBeUndefined();
    });
  });
});
