type ChildOrderTarget = {
  grade?: number | null;
  kana?: string | null;
  name_kana?: string | null;
};

const getKanaForSort = (child: ChildOrderTarget): string => child.kana ?? child.name_kana ?? '';

export const compareChildrenByGradeAndKana = <T extends ChildOrderTarget>(a: T, b: T): number => {
  const gradeA = a.grade ?? 0;
  const gradeB = b.grade ?? 0;

  if (gradeA !== gradeB) {
    return gradeB - gradeA;
  }

  return getKanaForSort(a).localeCompare(getKanaForSort(b), 'ja');
};
