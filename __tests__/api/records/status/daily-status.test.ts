/**
 * records/status API - 日別ステータス計算ロジックのテスト
 *
 * チケット:
 * - 来所なしの日でも記録を書いた場合は 'recorded_absent' として表示
 * - 出欠データがなくても記録一覧表示できるように
 */

/** route.ts の dailyStatus 計算ロジックを抽出（ピュア関数として検証） */
function calcDailyStatus(
  isAttended: boolean,
  isRecorded: boolean,
): string {
  if (isRecorded && isAttended) return 'present';
  if (isRecorded && !isAttended) return 'recorded_absent';
  if (isAttended && !isRecorded) return 'late';
  return 'absent';
}

describe('records/status - dailyStatus 計算', () => {
  it('来所あり・記録あり → present', () => {
    expect(calcDailyStatus(true, true)).toBe('present');
  });

  it('来所なし・記録あり → recorded_absent（欠席日でも記録済みマークを表示）', () => {
    expect(calcDailyStatus(false, true)).toBe('recorded_absent');
  });

  it('来所あり・記録なし → late（在所だが未記録）', () => {
    expect(calcDailyStatus(true, false)).toBe('late');
  });

  it('来所なし・記録なし → absent（休み）', () => {
    expect(calcDailyStatus(false, false)).toBe('absent');
  });
});

describe('records/status - monthlyRecordRate（出欠なし時）', () => {
  function calcMonthlyRecordRate(attendanceCount: number, recordCount: number): number {
    return attendanceCount > 0
      ? Math.round((recordCount / attendanceCount) * 100 * 10) / 10
      : 0;
  }

  it('出欠あり・記録あり → 正しい割合を返す', () => {
    expect(calcMonthlyRecordRate(10, 8)).toBe(80);
  });

  it('出欠データ0件 → 0を返す（ゼロ除算しない）', () => {
    expect(calcMonthlyRecordRate(0, 0)).toBe(0);
  });

  it('出欠あり・記録0件 → 0を返す', () => {
    expect(calcMonthlyRecordRate(10, 0)).toBe(0);
  });
});
