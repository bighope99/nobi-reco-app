export function calculateGrade(birthDate: string | Date | null | undefined, gradeAdd: number | null | undefined = 0) {
  if (!birthDate) return null;

  const parsedBirthDate = birthDate instanceof Date ? birthDate : new Date(birthDate);
  if (Number.isNaN(parsedBirthDate.getTime())) return null;

  const now = new Date();
  const birthYear = parsedBirthDate.getFullYear();
  const birthMonth = parsedBirthDate.getMonth(); // 0-indexed, 3 = April
  const birthDay = parsedBirthDate.getDate();

  // Japanese school year: April 2 (current year) to April 1 (next year)
  // April 1st birthday is considered part of the previous school year

  // Determine school entry year (when child enters 1st grade)
  // Japanese school year: April 2 (year N) to April 1 (year N+1)
  // Special legal rule: April 1 birthdays are grouped with Jan-Mar births of the SAME year
  // This is because legally, turning 6 on April 1 is treated as turning 6 on March 31
  // - Born Jan 1 - April 1: enter school at birthYear + 6 (早生まれ)
  // - Born April 2 - Dec 31: enter school at birthYear + 7
  const isBornOnOrAfterApril2 = (birthMonth > 3) || (birthMonth === 3 && birthDay >= 2);

  const schoolEntryYear = isBornOnOrAfterApril2 ? birthYear + 7 : birthYear + 6;

  // Determine current school year
  // School year changes on April 1st
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();
  const isCurrentDateOnOrAfterApril2 = (currentMonth > 3) || (currentMonth === 3 && currentDay >= 2);
  const currentSchoolYear = isCurrentDateOnOrAfterApril2 ? currentYear : currentYear - 1;

  // Calculate grade
  const baseGrade = currentSchoolYear - schoolEntryYear + 1;
  const adjustment = Number.isFinite(gradeAdd as number) ? (gradeAdd as number) : 0;

  return baseGrade + adjustment;
}

export function formatGradeLabel(grade: number | null | undefined) {
  if (grade === null || grade === undefined || Number.isNaN(grade)) return '-';
  if (grade <= 0) return '未就学';
  return `${grade}年生`;
}
