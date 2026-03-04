/**
 * @jest-environment node
 */
import { validateHandover, MAX_HANDOVER_LENGTH } from '@/lib/validation/activityValidation';

describe('validateHandover', () => {
  it('should return null data for null input', () => {
    const result = validateHandover(null);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data).toBeNull();
    }
  });

  it('should return null data for undefined input', () => {
    const result = validateHandover(undefined);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data).toBeNull();
    }
  });

  it('should return null data for empty string', () => {
    const result = validateHandover('');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data).toBeNull();
    }
  });

  it('should return null data for whitespace-only string', () => {
    const result = validateHandover('   ');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data).toBeNull();
    }
  });

  it('should return trimmed value for valid string', () => {
    const result = validateHandover('  明日は太郎くんの体調を確認してください  ');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data).toBe('明日は太郎くんの体調を確認してください');
    }
  });

  it('should return valid for string at max length', () => {
    const maxString = 'あ'.repeat(MAX_HANDOVER_LENGTH);
    const result = validateHandover(maxString);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data).toBe(maxString);
    }
  });

  it('should return error for string exceeding max length', () => {
    const tooLong = 'あ'.repeat(MAX_HANDOVER_LENGTH + 1);
    const result = validateHandover(tooLong);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain(`${MAX_HANDOVER_LENGTH}`);
    }
  });

  it('should return error for non-string type (number)', () => {
    const result = validateHandover(123);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('文字列');
    }
  });

  it('should return error for non-string type (boolean)', () => {
    const result = validateHandover(true);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('文字列');
    }
  });

  it('should return error for non-string type (object)', () => {
    const result = validateHandover({ text: 'hello' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('文字列');
    }
  });
});
