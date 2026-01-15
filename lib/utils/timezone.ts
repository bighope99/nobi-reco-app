/**
 * Converts UTC ISO8601 time string to JST (Japan Standard Time) in HH:mm format
 *
 * @param isoString - ISO8601 formatted date-time string in UTC (e.g., "2024-01-15T14:00:00Z")
 * @returns JST time in HH:mm format, or null if input is invalid
 *
 * @example
 * formatTimeJST("2024-01-15T14:00:00Z") // "23:00" (14:00 UTC + 9 hours)
 * formatTimeJST("2024-01-15T23:00:00Z") // "08:00" (next day in JST)
 * formatTimeJST(null) // null
 * formatTimeJST("invalid") // null
 */
export const formatTimeJST = (
  isoString: string | null | undefined
): string | null => {
  // Handle null, undefined, or empty string
  if (!isoString) {
    return null;
  }

  try {
    // Normalize the ISO string to ensure UTC interpretation
    // If the string doesn't end with 'Z' and doesn't contain timezone info, append 'Z'
    let normalizedString = isoString.trim();
    if (
      !normalizedString.endsWith('Z') &&
      !normalizedString.includes('+') &&
      !normalizedString.includes('-', 10) // Check for timezone offset (e.g., +09:00)
    ) {
      normalizedString += 'Z';
    }

    // Parse the ISO string to Date object
    const date = new Date(normalizedString);

    // Check if the date is invalid
    if (isNaN(date.getTime())) {
      return null;
    }

    // Convert to JST by adding 9 hours (JST = UTC+9)
    // Using toLocaleString with 'Asia/Tokyo' timezone ensures proper handling
    // of daylight saving time (though Japan doesn't use DST)
    const jstTimeString = date.toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    // The output format from toLocaleString is "HH:mm"
    return jstTimeString;
  } catch (error) {
    // If any error occurs during parsing or conversion, return null
    return null;
  }
};

/**
 * Get current date in JST (Japan Standard Time) in YYYY-MM-DD format
 */
export const getCurrentDateJST = (): string => {
  const now = new Date();
  return now.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '-'); // "YYYY/MM/DD" → "YYYY-MM-DD"
};

/**
 * Get current time in JST (Japan Standard Time) in HH:mm format
 */
export const getCurrentTimeJST = (): string => {
  const now = new Date();
  return now.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};
