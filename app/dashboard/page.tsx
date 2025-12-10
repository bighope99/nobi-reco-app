"use client"
import React, { useState, useMemo } from 'react';
import { StaffLayout } from "@/components/layout/staff-layout";

import {
  AlertTriangle,
  Phone,
  Clock,
  Users,
  ChevronRight,
  ShieldAlert,
  LayoutDashboard,
  MoreHorizontal,
  UserPlus,
  ArrowUpDown,
  Filter,
  LogIn,
  UserX,
  FileText,
  Activity,
  CalendarPlus,
  UserMinus,
  CheckCircle2
} from 'lucide-react';

// --- Types ---

type ChildStatus = 'checked_in' | 'checked_out' | 'absent';

interface Child {
  id: string;
  name: string;
  kana: string;
  className: string;
  grade: string; // "1年生"〜"6年生"
  status: ChildStatus;

  // Attendance Info
  is_scheduled_today: boolean; // 今日来る予定か？
  scheduled_start_time: string; // 登園予定
  scheduled_end_time: string;   // 降園予定
  actual_in_time: string | null;
  actual_out_time: string | null;

  // Contact
  guardian_phone: string;

  // Record Support Data
  last_record_date: string; // YYYY-MM-DD
  weekly_record_count: number;
}

type SortKey = 'status' | 'grade' | 'schedule';
type SortOrder = 'asc' | 'desc';

// --- Mock Data ---
const MOCK_CURRENT_TIME = "09:15";
const MOCK_TODAY = "2023-10-27";

const INITIAL_CHILDREN: Child[] = [
  // 1. 未帰所アラート対象
  {
    id: 'c1',
    name: '田中 陽翔',
    kana: 'たなか はると',
    className: 'ひまわり組',
    grade: '6年生',
    status: 'checked_in',
    is_scheduled_today: true,
    scheduled_start_time: '08:00',
    scheduled_end_time: '09:00',
    actual_in_time: '07:55',
    actual_out_time: null,
    guardian_phone: '090-1111-1111',
    last_record_date: '2023-10-27',
    weekly_record_count: 3,
  },
  // 2. 予定外登園
  {
    id: 'c2',
    name: '鈴木 さくら',
    kana: 'すずき さくら',
    className: 'さくら組',
    grade: '4年生',
    status: 'checked_in',
    is_scheduled_today: false,
    scheduled_start_time: '-',
    scheduled_end_time: '-',
    actual_in_time: '08:30',
    actual_out_time: null,
    guardian_phone: '090-2222-2222',
    last_record_date: '2023-10-26',
    weekly_record_count: 2,
  },
  // 3. 通常の在所児童
  {
    id: 'c3',
    name: '佐藤 健太',
    kana: 'さとう けんた',
    className: 'ひまわり組',
    grade: '6年生',
    status: 'checked_in',
    is_scheduled_today: true,
    scheduled_start_time: '08:30',
    scheduled_end_time: '18:00',
    actual_in_time: '08:25',
    actual_out_time: null,
    guardian_phone: '090-3333-3333',
    last_record_date: '2023-10-27',
    weekly_record_count: 4,
  },
  // 4. 未登園 (これから来る)
  {
    id: 'c4',
    name: '高橋 結衣',
    kana: 'たかはし ゆい',
    className: 'ちゅうりっぷ組',
    grade: '1年生',
    status: 'absent',
    is_scheduled_today: true,
    scheduled_start_time: '09:30',
    scheduled_end_time: '16:00',
    actual_in_time: null,
    actual_out_time: null,
    guardian_phone: '090-4444-4444',
    last_record_date: '2023-10-23',
    weekly_record_count: 0,
  },
  // 5. 帰宅済み
  {
    id: 'c5',
    name: '伊藤 湊',
    kana: 'いとう みなと',
    className: 'さくら組',
    grade: '4年生',
    status: 'checked_out',
    is_scheduled_today: true,
    scheduled_start_time: '07:30',
    scheduled_end_time: '09:00',
    actual_in_time: '07:35',
    actual_out_time: '09:05',
    guardian_phone: '090-5555-5555',
    last_record_date: '2023-10-26',
    weekly_record_count: 1,
  },
  // 6. 記録サポート対象
  {
    id: 'c6',
    name: '渡辺 蓮',
    kana: 'わたなべ れん',
    className: 'ひまわり組',
    grade: '6年生',
    status: 'checked_in',
    is_scheduled_today: true,
    scheduled_start_time: '09:00',
    scheduled_end_time: '18:00',
    actual_in_time: '09:05',
    actual_out_time: null,
    guardian_phone: '090-6666-6666',
    last_record_date: '2023-10-20',
    weekly_record_count: 2,
  },
  // 7. 予定なし（完全に休み）
  {
    id: 'c7',
    name: '小林 あおい',
    kana: 'こばやし あおい',
    className: 'ちゅうりっぷ組',
    grade: '1年生',
    status: 'absent',
    is_scheduled_today: false,
    scheduled_start_time: '-',
    scheduled_end_time: '-',
    actual_in_time: null,
    actual_out_time: null,
    guardian_phone: '090-7777-7777',
    last_record_date: '2023-10-25',
    weekly_record_count: 3,
  },
  // 8. 未登園 2人目
  {
    id: 'c8',
    name: '山本 陸',
    kana: 'やまもと りく',
    className: 'さくら組',
    grade: '4年生',
    status: 'absent',
    is_scheduled_today: true,
    scheduled_start_time: '09:00',
    scheduled_end_time: '17:00',
    actual_in_time: null,
    actual_out_time: null,
    guardian_phone: '090-8888-8888',
    last_record_date: '2023-10-27',
    weekly_record_count: 4,
  },
  // 9. 未登園・遅刻 (予定08:30だが、現在09:15でまだ来ていない)
  {
    id: 'c9',
    name: '中村 拓海',
    kana: 'なかむら たくみ',
    className: 'ひまわり組',
    grade: '5年生',
    status: 'absent',
    is_scheduled_today: true,
    scheduled_start_time: '08:30',
    scheduled_end_time: '17:30',
    actual_in_time: null,
    actual_out_time: null,
    guardian_phone: '090-9999-0000',
    last_record_date: '2023-10-24',
    weekly_record_count: 2,
  }
];

// --- Utility Functions ---

const getMinutesDiff = (currentTime: string, targetTime: string) => {
  if (!targetTime || targetTime === '-') return 0;
  const [h1, m1] = currentTime.split(':').map(Number);
  const [h2, m2] = targetTime.split(':').map(Number);
  return (h1 * 60 + m1) - (h2 * 60 + m2);
};

const getDaysDiff = (date1: string, date2: string) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export default function ChildcareDashboard() {
  const [currentTime] = useState(MOCK_CURRENT_TIME);
  const [children, setChildren] = useState<Child[]>(INITIAL_CHILDREN);
  const [filterClass, setFilterClass] = useState<string>('all');
  const [showUnscheduled, setShowUnscheduled] = useState<boolean>(false);
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // --- Actions ---

  // 登園処理 (在所にする)
  const handleCheckIn = (id: string) => {
    setChildren(prev => prev.map(child => {
      if (child.id === id) {
        return {
          ...child,
          status: 'checked_in',
          actual_in_time: currentTime,
          is_scheduled_today: true // 登園したら予定ありとして扱う
        };
      }
      return child;
    }));
  };

  // 欠席処理 (予定を取り消す)
  const handleMarkAbsent = (id: string) => {
    setChildren(prev => prev.map(child => {
      if (child.id === id) {
        return {
          ...child,
          status: 'absent',
          is_scheduled_today: false // 予定なしに変更（これでアラートから消える）
        };
      }
      return child;
    }));
  };

  // 予定外登園の確認 (予定ありに変更してアラートを消す)
  const handleConfirmUnexpected = (id: string) => {
    setChildren(prev => prev.map(child => {
      if (child.id === id) {
        return {
          ...child,
          is_scheduled_today: true,
          scheduled_start_time: currentTime, // 仮で現在時刻を入れる
          scheduled_end_time: '18:00' // 仮で定時を入れる
        };
      }
      return child;
    }));
  };

  // --- KPI Data Processing ---
  const kpiData = useMemo(() => {
    return {
      scheduledToday: children.filter(c => c.is_scheduled_today).length,
      presentNow: children.filter(c => c.status === 'checked_in').length,
      notArrived: children.filter(c => c.is_scheduled_today && c.status === 'absent').length
    };
  }, [children]);

  // --- Alert Logic ---
  const alertData = useMemo(() => {
    // 1. Overdue: Checked in but passed end time (High Priority)
    const overdue = children.filter(c => {
      if (c.status !== 'checked_in' || !c.is_scheduled_today) return false;
      const diff = getMinutesDiff(currentTime, c.scheduled_end_time);
      return diff >= 30;
    }).map(c => ({ ...c, type: 'overdue' as const, minutes: getMinutesDiff(currentTime, c.scheduled_end_time) }));

    // 2. Late: Absent but passed start time (High Priority)
    const late = children.filter(c => {
      if (c.status !== 'absent' || !c.is_scheduled_today) return false;
      const diff = getMinutesDiff(currentTime, c.scheduled_start_time);
      return diff > 0;
    }).map(c => ({ ...c, type: 'late' as const, minutes: getMinutesDiff(currentTime, c.scheduled_start_time) }));

    // 3. Unexpected: Checked in but not scheduled (Medium Priority)
    const unexpected = children.filter(c => {
      return c.status === 'checked_in' && !c.is_scheduled_today;
    }).map(c => ({ ...c, type: 'unexpected' as const }));

    return {
      overdue,
      late,
      unexpected,
      hasAlerts: overdue.length > 0 || late.length > 0 || unexpected.length > 0
    };
  }, [currentTime, children]);

  // --- Handle Sort Click ---
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  // --- Filter & Sort Logic ---
  const filteredAndSortedChildren = useMemo(() => {
    let result = [...children];

    // 1. Filter: Class
    if (filterClass !== 'all') {
      result = result.filter(c => c.className === filterClass);
    }

    // 2. Filter: Show/Hide Unscheduled
    if (showUnscheduled) {
      // 予定なしモード: 「予定なし」かつ「来ていない」子のみ表示
      result = result.filter(c => c.status === 'absent' && !c.is_scheduled_today);
    } else {
      // 通常モード: 「在所中」または「予定あり」の子を表示（予定なしの欠席者は隠す）
      result = result.filter(c => c.status === 'checked_in' || c.is_scheduled_today);
    }

    // 3. Sort
    result.sort((a, b) => {
      // Priority 0: Safety Alerts are ALWAYS Top (Ignoring Sort Key for safety)
      const getAlertPriority = (c: Child) => {
        if (c.status === 'checked_in' && c.is_scheduled_today && getMinutesDiff(currentTime, c.scheduled_end_time) >= 30) return 1; // Overdue
        if (c.status === 'absent' && c.is_scheduled_today && getMinutesDiff(currentTime, c.scheduled_start_time) > 0) return 2; // Late
        if (c.status === 'checked_in' && !c.is_scheduled_today) return 3; // Unexpected
        return 99; // No Alert
      };

      const alertA = getAlertPriority(a);
      const alertB = getAlertPriority(b);

      if (alertA !== 99 || alertB !== 99) {
        if (alertA !== alertB) return alertA - alertB;
      }

      // User Selected Sort
      let comparison = 0;

      if (sortKey === 'grade') {
        const getGradeNum = (g: string) => {
          const match = g.match(/(\d+)年生/);
          return match ? parseInt(match[1]) : 0;
        };
        comparison = getGradeNum(a.grade) - getGradeNum(b.grade);
      } else if (sortKey === 'schedule') {
        comparison = a.scheduled_start_time.localeCompare(b.scheduled_start_time);
      } else {
        // status (Default): 
        const getStatusPriority = (c: Child) => {
          if (c.status === 'checked_in') return 1;
          if (c.status === 'absent' && c.is_scheduled_today) return 2; // Not arrived yet (future)
          if (c.status === 'checked_out') return 3;
          return 4; // Unscheduled Absent
        };
        comparison = getStatusPriority(a) - getStatusPriority(b);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [filterClass, showUnscheduled, sortKey, sortOrder, currentTime, children]);

  // --- Record Support Logic ---
  const supportRequiredChildren = useMemo(() => {
    return children.filter(child => {
      const daysSinceRecord = getDaysDiff(MOCK_TODAY, child.last_record_date);
      const isLowFrequency = child.weekly_record_count <= 1;
      return (daysSinceRecord >= 3 || isLowFrequency);
    }).map(child => {
      const daysSinceRecord = getDaysDiff(MOCK_TODAY, child.last_record_date);
      let reason = "";
      if (daysSinceRecord >= 3) reason = `${daysSinceRecord}日間未記録`;
      else if (child.weekly_record_count <= 1) reason = `週間記録 ${child.weekly_record_count}件`;
      return { ...child, reason };
    });
  }, [children]);

  // --- UI Components ---

  const StatusBadge = ({ child }: { child: Child }) => {
    if (child.status === 'checked_in' && !child.is_scheduled_today) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200" > 予定外登園 </span>;
    }
    const overdue = child.status === 'checked_in' && child.is_scheduled_today && getMinutesDiff(currentTime, child.scheduled_end_time) >= 30;
    if (overdue) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200" > 未帰所・遅延 </span>;
    }

    switch (child.status) {
      case 'checked_in':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200" > 在所中 </span>;
      case 'absent':
        if (child.is_scheduled_today) {
          const isLate = getMinutesDiff(currentTime, child.scheduled_start_time) > 0;
          if (isLate) {
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-200" > 未登園(遅れ) </span>;
          }
          return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200" > 未登園 </span>;
        } else {
          return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-400 border border-gray-200" > 予定なし </span>;
        }
      case 'checked_out':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-400 border border-gray-200" > 帰宅済 </span>;
    }
  };

  const ActionButtons = ({ child }: { child: Child }) => {
    // 共通の登園ボタンクラス
    const loginButtonClass = "flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 rounded shadow-sm transition-colors whitespace-nowrap";
    // 共通の欠席ボタンクラス
    const absentButtonClass = "flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded shadow-sm transition-colors whitespace-nowrap";

    // 1. 未登園（予定あり）
    if (child.status === 'absent' && child.is_scheduled_today) {
      return (
        <div className="flex gap-2" >
          <button
            onClick={() => handleCheckIn(child.id)}
            className={loginButtonClass}
          >
            <LogIn size={14} /> 登園
          </button>
          <button
            onClick={() => handleMarkAbsent(child.id)
            }
            className={absentButtonClass}
          >
            <UserX size={14} /> 欠席
          </button>
        </div>
      );
    }
    // 2. 予定なし（フィルターで表示された場合）
    if (child.status === 'absent' && !child.is_scheduled_today) {
      return (
        <div className="flex gap-2" >
          <button
            onClick={() => handleCheckIn(child.id)}
            className={loginButtonClass}
          >
            <LogIn size={14} /> 登園
          </button>
          <button className={absentButtonClass} >
            <CalendarPlus size={14} /> 予定追加
          </button>
        </div>
      );
    }
    // 3. 在所中
    if (child.status === 'checked_in') {
      return (
        <button className="text-xs text-slate-400 hover:text-slate-600 underline" > ステータス変更 </button>
      )
    }
    return <span className="text-xs text-slate-300" > -</span>;
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ArrowUpDown size={12} className="text-slate-300" />;
    return (
      <ArrowUpDown
        size={12}
        className={`text-indigo-600 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`
        }
      />
    );
  }

  return (
    <StaffLayout title="ダッシュボード">
      <div className="min-h-screen bg-gray-50 text-slate-900 font-sans" >
        <style>
          {`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');`}
        </style>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ fontFamily: '"Noto Sans JP", sans-serif' }}>

          {/* Header */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-gray-200 pb-6" >
            <div>
              <div className="flex items-center gap-2 mb-1" >
                <LayoutDashboard size={20} className="text-slate-500" />
                <h1 className="text-xl font-bold text-slate-800" > 安全管理ダッシュボード </h1>
              </div>
              <p className="text-sm text-slate-500 pl-7" >
                {MOCK_TODAY.replace(/-/g, '/')}(金) <span className="mx-2" >| </span> 現在時刻 <span className="font-mono font-bold text-slate-700">{currentTime}</span >
              </p>
            </div>
            <div className="flex items-center gap-2" >
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100" >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" > </span>
                システム稼働中
              </span>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" >

            <div className="lg:col-span-8 flex flex-col gap-6" >

              {/* KPI Section */}
              <div className="grid grid-cols-3 gap-4" >
                <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm" >
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1" > 本日の出席予定 </h3>
                  <div className="flex items-baseline gap-1" >
                    <span className="text-2xl font-bold text-slate-700" > {kpiData.scheduledToday} </span>
                    <span className="text-xs text-slate-400" > 名 </span>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-emerald-100 shadow-sm relative overflow-hidden" >
                  <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -mr-4 -mt-4" > </div>
                  <h3 className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1 relative z-10" > 現在の在所人数 </h3>
                  <div className="flex items-baseline gap-1 relative z-10" >
                    <span className="text-3xl font-bold text-emerald-700" > {kpiData.presentNow} </span>
                    <span className="text-xs text-emerald-500" > 名 </span>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm" >
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1" > 未登園（未到着）</h3>
                  <div className="flex items-baseline gap-1" >
                    <span className="text-2xl font-bold text-slate-700" > {kpiData.notArrived} </span>
                    <span className="text-xs text-slate-400" > 名 </span>
                  </div>
                </div>
              </div>

              {/* Alert Section */}
              {
                alertData.hasAlerts && (
                  <div className="space-y-3" >
                    {/* 1. Overdue Alerts */}
                    {
                      alertData.overdue.map(child => (
                        <div key={child.id} className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm" >
                          <div className="flex items-start gap-3 w-full" >
                            <div className="bg-rose-100 p-2 rounded-full text-rose-600 shrink-0" >
                              <AlertTriangle size={20} />
                            </div>
                            <div >
                              <div className="flex items-center gap-2" >
                                <span className="font-bold text-rose-900" > {child.name} </span>
                                <span className="text-xs px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded border border-rose-200 font-bold" > 未帰所アラート </span>
                              </div>
                              <div className="text-sm text-rose-800 mt-1 flex flex-wrap gap-x-4" >
                                <span className="flex items-center gap-1" > <Clock size={14} /> 予定: {child.scheduled_end_time} </span>
                                <span className="font-bold" > +{child.minutes}分 超過 </span>
                              </div>
                            </div>
                          </div>
                          <button onClick={() => alert(`発信: ${child.guardian_phone}`)} className="bg-white text-rose-700 border border-rose-200 px-4 py-2 rounded-md font-bold text-sm hover:bg-rose-100 flex items-center gap-2" >
                            <Phone size={16} /> 保護者へ連絡
                          </button>
                        </div>
                      ))
                    }

                    {/* 2. Late Alerts */}
                    {
                      alertData.late.map(child => (
                        <div key={child.id} className="bg-red-50 border border-red-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300" >
                          <div className="flex items-start gap-3 w-full" >
                            <div className="bg-red-100 p-2 rounded-full text-red-600 shrink-0" >
                              <UserMinus size={20} />
                            </div>
                            <div >
                              <div className="flex items-center gap-2" >
                                <span className="font-bold text-red-900" > {child.name} </span>
                                <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded border border-red-200 font-bold" > 未登園・遅刻 </span>
                              </div>
                              <div className="text-sm text-red-800 mt-1 flex flex-wrap gap-x-4" >
                                <span className="flex items-center gap-1" > <Clock size={14} /> 予定: {child.scheduled_start_time} </span>
                                <span className="font-bold" > +{child.minutes}分 遅れ </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto" >
                            <button onClick={() => alert(`発信: ${child.guardian_phone}`)} className="flex-1 sm:flex-none px-3 py-2 bg-white text-red-700 border border-red-200 rounded-md font-bold text-sm hover:bg-red-100 flex items-center justify-center gap-1 whitespace-nowrap" >
                              <Phone size={14} /> 連絡
                            </button>
                            <button
                              onClick={() => handleMarkAbsent(child.id)}
                              className="flex-1 sm:flex-none px-3 py-2 bg-white text-slate-600 border border-slate-300 rounded-md font-bold text-sm hover:bg-slate-50 flex items-center justify-center gap-1 whitespace-nowrap"
                            >
                              <UserX size={14} /> 欠席
                            </button>
                            <button
                              onClick={() => handleCheckIn(child.id)}
                              className="flex-1 sm:flex-none px-3 py-2 bg-blue-500 text-white border border-blue-600 rounded-md font-bold text-sm hover:bg-blue-600 flex items-center justify-center gap-1 whitespace-nowrap"
                            >
                              <LogIn size={14} /> 到着
                            </button>
                          </div>
                        </div>
                      ))}

                    {/* 3. Unexpected Alerts */}
                    {
                      alertData.unexpected.map(child => (
                        <div key={child.id} className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm" >
                          <div className="flex items-start gap-3 w-full" >
                            <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0" >
                              <UserPlus size={20} />
                            </div>
                            <div >
                              <div className="flex items-center gap-2" >
                                <span className="font-bold text-amber-900" > {child.name} </span>
                                <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded border border-amber-200 font-bold" > 予定外登園 </span>
                              </div>
                              <div className="text-sm text-amber-800 mt-1" > 本日の出席予定登録がありませんが、チェックインされています。</div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleConfirmUnexpected(child.id)}
                            className="flex-1 sm:flex-none px-3 py-2 bg-white text-amber-700 border border-amber-300 rounded-md font-bold text-sm hover:bg-amber-50 flex items-center justify-center gap-1 whitespace-nowrap"
                          >
                            <CheckCircle2 size={14} /> 確認
                          </button>
                        </div>
                      ))}
                  </div>
                )}

              {/* Attendance List */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col flex-1" >
                <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-3" >
                  <div className="flex items-center gap-3 w-full sm:w-auto" >
                    <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-md px-2 py-1.5" >
                      <Filter size={14} className="text-slate-500" />
                      <select
                        value={filterClass}
                        onChange={(e) => setFilterClass(e.target.value)}
                        className="text-sm text-slate-700 bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
                      >
                        <option value="all" > 全クラス </option>
                        <option value="ひまわり組" > ひまわり組 </option>
                        <option value="さくら組" > さくら組 </option>
                        <option value="ちゅうりっぷ組" > ちゅうりっぷ組 </option>
                      </select>
                    </div>

                    <button
                      onClick={() => setShowUnscheduled(!showUnscheduled)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-md border transition-colors flex items-center gap-2 ${showUnscheduled ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-slate-500 border-gray-300 hover:bg-gray-50'}`}
                    >
                      {showUnscheduled ? <UserX size={14} /> : <UserPlus size={14} />}
                      {showUnscheduled ? '予定なしを表示中' : '予定なしを表示'}
                    </button>
                  </div>

                  <span className="text-xs text-slate-500 self-end sm:self-center" >
                    {filteredAndSortedChildren.length} 名 表示
                  </span>
                </div>

                <div className="overflow-x-auto" >
                  <table className="w-full text-left border-collapse text-sm" >
                    <thead>
                      <tr className="bg-white border-b border-gray-100 text-slate-500 text-xs uppercase tracking-wider" >
                        <th className="px-5 py-3 font-medium" >
                          児童名 / クラス
                        </th>
                        <th
                          className="px-5 py-3 font-medium cursor-pointer hover:bg-gray-50 select-none"
                          onClick={() => handleSort('grade')}
                        >
                          <div className="flex items-center gap-1" >
                            学年
                            <SortIcon columnKey="grade" />
                          </div>
                        </th>
                        <th
                          className="px-5 py-3 font-medium cursor-pointer hover:bg-gray-50 select-none group"
                          onClick={() => handleSort('status')}
                        >
                          <div className="flex items-center gap-1" >
                            ステータス
                            <SortIcon columnKey="status" />
                          </div>
                        </th>
                        <th
                          className="px-5 py-3 font-medium cursor-pointer hover:bg-gray-50 select-none"
                          onClick={() => handleSort('schedule')}
                        >
                          <div className="flex items-center gap-1" >
                            予定時刻
                            <SortIcon columnKey="schedule" />
                          </div>
                        </th>
                        <th className="px-5 py-3 font-medium" > 実績 </th>
                        <th className="px-5 py-3 font-medium" > アクション </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100" >
                      {
                        filteredAndSortedChildren.map(child => (
                          <tr key={child.id} className="hover:bg-slate-50 transition-colors" >
                            <td className="px-5 py-3" >
                              <div className="font-bold text-slate-800" > {child.name} </div>
                              <div className="text-xs text-slate-500" > {child.className} </div>
                            </td>
                            <td className="px-5 py-3 text-slate-600 text-xs" >
                              {child.grade}
                            </td>
                            <td className="px-5 py-3" >
                              <StatusBadge child={child} />
                            </td>
                            <td className="px-5 py-3 text-slate-600" >
                              <div className="flex flex-col text-xs" >
                                <span className="flex items-center gap-1 text-slate-400" > IN <span className="text-slate-600 font-medium" > {child.scheduled_start_time} </span></span >
                                <span className="flex items-center gap-1 text-slate-400" > OUT <span className="text-slate-600 font-medium" > {child.scheduled_end_time} </span></span >
                              </div>
                            </td>
                            <td className="px-5 py-3 text-slate-600" >
                              <div className="flex flex-col text-xs" >
                                {
                                  child.actual_in_time ? (
                                    <span className="text-emerald-600 font-medium" > {child.actual_in_time} 〜 {child.actual_out_time || '...'} </span>
                                  ) : (
                                    <span className="text-slate-400" > -</span>
                                  )}
                              </div>
                            </td>
                            <td className="px-5 py-3" >
                              <ActionButtons child={child} />
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            <div className="lg:col-span-4 h-full flex flex-col gap-6" >
              <div className="grid grid-cols-2 gap-4" >
                <button className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group flex flex-col items-center justify-center gap-2" >
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-full group-hover:scale-110 transition-transform" >
                    <FileText size={20} />
                  </div>
                  <span className="text-sm font-bold text-slate-700" > 日誌記録 </span>
                </button>
                <button className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group flex flex-col items-center justify-center gap-2" >
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-full group-hover:scale-110 transition-transform" >
                    <Activity size={20} />
                  </div>
                  <span className="text-sm font-bold text-slate-700" > 成長レポート </span>
                </button>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-1 flex flex-col sticky top-6" >
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-indigo-50/30" >
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm" >
                    <ShieldAlert size={16} className="text-indigo-600" />
                    記録サポート候補
                  </h3>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full" >
                    {supportRequiredChildren.length}
                  </span>
                </div>

                <div className="flex-1 overflow-auto max-h-[500px] p-2 space-y-2" >
                  {
                    supportRequiredChildren.length === 0 ? (
                      <div className="p-8 text-center text-slate-400" >
                        <p className="text-sm"> 推奨される記録候補はありません </p>
                      </div>
                    ) : (
                      supportRequiredChildren.map((child) => (
                        <div key={child.id} className="group p-3 rounded-lg border border-transparent hover:border-indigo-100 hover:bg-indigo-50/50 transition-all flex items-center justify-between" >
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 w-full" >
                            <span className="font-bold text-slate-800 text-sm whitespace-nowrap" > {child.name} </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-200 whitespace-nowrap" >
                              {child.reason}
                            </span>
                            <span className="text-xs text-slate-500 whitespace-nowrap" > {child.className} </span>
                          </div>
                          <button
                            className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-sm transition-all"
                            onClick={() => console.log(`記録: ${child.name}`)}
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      ))
                    )}
                </div>

                <div className="p-3 border-t border-gray-100 bg-gray-50 rounded-b-lg mt-auto" >
                  <button className="w-full py-2 text-xs text-slate-600 hover:text-indigo-600 font-medium transition-colors flex items-center justify-center gap-2 border border-gray-200 rounded bg-white hover:bg-indigo-50" >
                    <MoreHorizontal size={14} />
                    全児童の記録状況
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </StaffLayout>
  );
}