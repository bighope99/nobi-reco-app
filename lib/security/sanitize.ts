/**
 * XSS Sanitization Utilities
 *
 * Provides functions to sanitize user input before sending to API endpoints.
 * Uses basic HTML entity encoding to prevent XSS attacks.
 */

/**
 * Sanitizes a single text string by escaping HTML entities
 * @param text - The text to sanitize
 * @returns Sanitized text with HTML entities escaped
 */
export const sanitizeText = (text: string | null | undefined): string | null => {
  if (!text) return text ?? null;

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Sanitizes an array of objects with string fields
 * @param items - Array of items to sanitize
 * @param fields - Field names to sanitize in each item
 * @returns Array with sanitized fields
 */
export const sanitizeArrayFields = <T extends Record<string, any>>(
  items: T[],
  fields: (keyof T)[]
): T[] => {
  return items.map((item) => {
    const sanitized = { ...item };
    fields.forEach((field) => {
      if (typeof sanitized[field] === 'string') {
        sanitized[field] = sanitizeText(sanitized[field]) as any;
      }
    });
    return sanitized;
  });
};

/**
 * Sanitizes an object with nested fields
 * @param obj - Object to sanitize
 * @param fields - Field names to sanitize
 * @returns Object with sanitized fields
 */
export const sanitizeObjectFields = <T extends Record<string, any>>(
  obj: T | null | undefined,
  fields: (keyof T)[]
): T | null => {
  if (!obj) return null;

  const sanitized = { ...obj };
  fields.forEach((field) => {
    if (typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizeText(sanitized[field]) as any;
    }
  });
  return sanitized;
};
