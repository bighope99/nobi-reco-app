/**
 * records/status ページのロジックテスト
 *
 * チケット2: 月間記録率の昇順・降順ソート
 * チケット3: 児童名検索ロジック（名前正規化・マッチング）
 * チケット5: 月間記録率とヒートマップの連動
 * チケット6: 0除算保護
 */

// ===== チケット2: ソートロジック =====
describe('月間記録率ソートロジック', () => {
  type SortValue = string | number;

  const getSortValue = (child: { monthly: { record_rate: number }; yearly: { record_rate: number }; kana: string; grade: number | null; last_record_date: string | null }, key: string): SortValue => {
    switch (key) {
      case 'name': return child.kana;
      case 'grade': return child.grade ?? 0;
      case 'last_record_date': return child.last_record_date || '';
      case 'record_rate': return child.monthly.record_rate;
      case 'yearly_rate': return child.yearly.record_rate;
      default: return '';
    }
  };

  const sortChildren = (children: typeof mockChildren, key: string, order: 'asc' | 'desc') => {
    return [...children].sort((a, b) => {
      const aValue = getSortValue(a, key);
      const bValue = getSortValue(b, key);
      if (aValue < bValue) return order === 'asc' ? -1 : 1;
      if (aValue > bValue) return order === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const mockChildren = [
    { kana: 'ア', grade: 1, last_record_date: '2025-01-01', monthly: { record_rate: 80 }, yearly: { record_rate: 75 } },
    { kana: 'イ', grade: 2, last_record_date: '2025-01-15', monthly: { record_rate: 50 }, yearly: { record_rate: 60 } },
    { kana: 'ウ', grade: 3, last_record_date: null, monthly: { record_rate: 100 }, yearly: { record_rate: 90 } },
    { kana: 'エ', grade: 2, last_record_date: '2025-01-10', monthly: { record_rate: 0 }, yearly: { record_rate: 0 } },
  ];

  it('record_rate昇順: 小さい順に並ぶ', () => {
    const sorted = sortChildren(mockChildren, 'record_rate', 'asc');
    const rates = sorted.map(c => c.monthly.record_rate);
    expect(rates).toEqual([0, 50, 80, 100]);
  });

  it('record_rate降順: 大きい順に並ぶ', () => {
    const sorted = sortChildren(mockChildren, 'record_rate', 'desc');
    const rates = sorted.map(c => c.monthly.record_rate);
    expect(rates).toEqual([100, 80, 50, 0]);
  });

  it('yearly_rate昇順: 年間割合が小さい順に並ぶ', () => {
    const sorted = sortChildren(mockChildren, 'yearly_rate', 'asc');
    const rates = sorted.map(c => c.yearly.record_rate);
    expect(rates).toEqual([0, 60, 75, 90]);
  });

  it('yearly_rate降順: 年間割合が大きい順に並ぶ', () => {
    const sorted = sortChildren(mockChildren, 'yearly_rate', 'desc');
    const rates = sorted.map(c => c.yearly.record_rate);
    expect(rates).toEqual([90, 75, 60, 0]);
  });
});

// ===== チケット3: 検索ロジック =====
describe('児童名検索ロジック（クライアント側フィルタリング）', () => {
  // APIが全データ返却後、クライアント側でフィルタリングする想定
  const filterChildren = (children: Array<{ name: string; kana: string }>, search: string) => {
    if (!search) return children;
    const normalized = search.trim().toLowerCase();
    return children.filter(child => {
      const name = child.name.toLowerCase();
      const kana = child.kana.toLowerCase();
      return name.includes(normalized) || kana.includes(normalized);
    });
  };

  const mockChildren = [
    { name: '田中 太郎', kana: 'タナカ タロウ' },
    { name: '鈴木 花子', kana: 'スズキ ハナコ' },
    { name: '佐藤 次郎', kana: 'サトウ ジロウ' },
  ];

  it('氏名で検索できる', () => {
    const result = filterChildren(mockChildren, '田中');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('田中 太郎');
  });

  it('かな（カタカナ）で検索できる', () => {
    const result = filterChildren(mockChildren, 'スズキ');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('鈴木 花子');
  });

  it('空文字列では全員が返る', () => {
    const result = filterChildren(mockChildren, '');
    expect(result).toHaveLength(3);
  });

  it('マッチしない検索では空配列が返る', () => {
    const result = filterChildren(mockChildren, '存在しない名前');
    expect(result).toHaveLength(0);
  });

  it('前後の空白を無視して検索できる', () => {
    const result = filterChildren(mockChildren, '  田中  ');
    expect(result).toHaveLength(1);
  });
});

// ===== チケット5: ヒートマップとrecord_rateの連動 =====
describe('月間記録率とヒートマップの連動', () => {
  /**
   * ヒートマップ集計ロジック: 出席日のうち記録があれば'present'、なければ'late'
   * 月間記録率: 出席日数(attendance_count)のうち記録日数(record_count)の割合
   *
   * 両者は同じ定義を使うべき:
   * - 「記録済み」= isAttended && isRecorded (= heatmapで'present')
   * - 「出席日数」= isAttended (= heatmapで'present' + 'late')
   */
  const buildDailyStatus = (
    daysInMonth: number,
    attendanceDates: Set<string>,
    observationDates: Set<string>,
    year: number,
    month: number
  ) => {
    const dailyStatus: string[] = [];
    const monthStr = String(month).padStart(2, '0');
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${monthStr}-${String(day).padStart(2, '0')}`;
      const isAttended = attendanceDates.has(dateStr);
      const isRecorded = observationDates.has(dateStr);

      if (isRecorded && isAttended) {
        dailyStatus.push('present');
      } else if (isAttended && !isRecorded) {
        dailyStatus.push('late');
      } else if (!isAttended) {
        dailyStatus.push('absent');
      } else {
        dailyStatus.push('none');
      }
    }
    return dailyStatus;
  };

  const calcMonthlyRate = (attendanceCount: number, recordCount: number): number => {
    // チケット6: 0除算保護
    if (attendanceCount === 0) return 0;
    return Math.round((recordCount / attendanceCount) * 100 * 10) / 10;
  };

  it('present数が記録済み数と一致する', () => {
    const year = 2025;
    const month = 1;
    const attendanceDates = new Set(['2025-01-06', '2025-01-07', '2025-01-08']);
    const observationDates = new Set(['2025-01-06', '2025-01-07']); // 3日中2日記録

    const dailyStatus = buildDailyStatus(31, attendanceDates, observationDates, year, month);

    const presentCount = dailyStatus.filter(s => s === 'present').length;
    const lateCount = dailyStatus.filter(s => s === 'late').length;

    // ヒートマップ: present=2, late=1
    expect(presentCount).toBe(2);
    expect(lateCount).toBe(1);

    // 月間記録率: 2/3 = 66.7%
    const rate = calcMonthlyRate(attendanceDates.size, observationDates.size);
    expect(rate).toBe(66.7);

    // 連動確認: present数 / (present + late) = 記録率に一致
    const heatmapRate = Math.round((presentCount / (presentCount + lateCount)) * 100 * 10) / 10;
    expect(heatmapRate).toBe(rate);
  });

  it('全日出席・全日記録: present=全出席日, 記録率=100%', () => {
    const attendanceDates = new Set(['2025-01-06', '2025-01-07']);
    const observationDates = new Set(['2025-01-06', '2025-01-07']);

    const dailyStatus = buildDailyStatus(31, attendanceDates, observationDates, 2025, 1);
    const presentCount = dailyStatus.filter(s => s === 'present').length;

    expect(presentCount).toBe(2);
    expect(calcMonthlyRate(2, 2)).toBe(100);
  });
});

// ===== チケット6: 0除算保護 =====
describe('0除算保護', () => {
  const calcRate = (numerator: number, denominator: number): number => {
    // 0除算保護: 分母が0の場合は0を返す
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 100 * 10) / 10;
  };

  it('分母が0の場合、NaNではなく0を返す', () => {
    expect(calcRate(0, 0)).toBe(0);
    expect(calcRate(5, 0)).toBe(0);
  });

  it('通常の計算は正しく行われる', () => {
    expect(calcRate(1, 2)).toBe(50);
    expect(calcRate(3, 4)).toBe(75);
    expect(calcRate(1, 3)).toBe(33.3);
  });

  it('ProgressBarのmax=0で現行実装のバグを確認（value=5,max=0 → 100%になってしまう）', () => {
    // 現行: Math.min(100, Math.max(0, (5/0)*100)) || 0
    //     = Math.min(100, Infinity) || 0
    //     = 100 || 0 = 100  ← バグ: 0%であるべきなのに100%と表示される
    const progressBarPercentageBuggy = (value: number, max: number) => {
      return Math.min(100, Math.max(0, (value / max) * 100)) || 0;
    };

    expect(progressBarPercentageBuggy(0, 0)).toBe(0); // 0/0=NaN → NaN||0=0 (偶然動く)
    expect(progressBarPercentageBuggy(5, 0)).toBe(100); // バグ: 100%と表示される
  });

  it('ProgressBarでmax=0かつvalue>0の場合、0を返す（修正後）', () => {
    // 修正後: max===0チェックを追加
    const progressBarPercentageSafe = (value: number, max: number) => {
      if (max === 0) return 0;
      return Math.min(100, Math.max(0, (value / max) * 100));
    };

    expect(progressBarPercentageSafe(0, 0)).toBe(0);
    expect(progressBarPercentageSafe(5, 0)).toBe(0);
    expect(progressBarPercentageSafe(3, 4)).toBe(75);
  });
});
