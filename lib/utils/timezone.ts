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

/**
 * Get tomorrow's date in JST (Japan Standard Time) in YYYY-MM-DD format
 */
export const getTomorrowDateJST = (): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '-');
};

/**
 * Convert a Date object to JST date string in YYYY-MM-DD format
 */
export const toDateStringJST = (date: Date): string => {
  return date.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '-');
};

/**
 * Get the first day of a month in JST, returns YYYY-MM-DD format
 * Note: First day is always 01, so we construct the string directly
 */
export const getFirstDayOfMonthJST = (year: number, month: number): string => {
  // 月初日は常に1日なので、直接文字列を構築（サーバータイムゾーン非依存）
  const monthStr = String(month).padStart(2, '0');
  return `${year}-${monthStr}-01`;
};

/**
 * Get the last day of a month in JST, returns YYYY-MM-DD format
 * Uses UTC to calculate last day of month (server timezone independent)
 */
export const getLastDayOfMonthJST = (year: number, month: number): string => {
  // 翌月の0日目 = 当月の最終日（UTCで計算してサーバータイムゾーン非依存）
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStr = String(month).padStart(2, '0');
  const dayStr = String(lastDay).padStart(2, '0');
  return `${year}-${monthStr}-${dayStr}`;
};

/**
 * Extract date part from ISO string (for already UTC timestamps)
 * Use this when you have a UTC ISO string and want the UTC date portion
 */
export const extractDateFromISO = (isoString: string): string => {
  return isoString.split('T')[0];
};

/**
 * Convert UTC ISO string to JST date string in YYYY-MM-DD format
 * Use this when you need the JST date from a UTC timestamp
 */
export const isoToDateJST = (isoString: string): string => {
  const date = new Date(isoString);
  return toDateStringJST(date);
};
