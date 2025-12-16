export function calculateGrade(birthDate: string | Date | null | undefined, gradeAdd: number | null | undefined = 0) {
  if (!birthDate) return null;

  const parsedBirthDate = birthDate instanceof Date ? birthDate : new Date(birthDate);
  if (Number.isNaN(parsedBirthDate.getTime())) return null;

  const now = new Date();
  const yearDifference = now.getFullYear() - parsedBirthDate.getFullYear();
  const isAfterApril = parsedBirthDate.getMonth() >= 3; // 0-indexed, 3 = April

  const baseGrade = isAfterApril ? yearDifference - 6 + 1 : yearDifference - 6;
  const adjustment = Number.isFinite(gradeAdd as number) ? (gradeAdd as number) : 0;

  return baseGrade + adjustment;
}

export function formatGradeLabel(grade: number | null | undefined) {
  if (grade === null || grade === undefined || Number.isNaN(grade)) return '-';
  if (grade <= 0) return '未就学';
  return `${grade}年生`;
}
