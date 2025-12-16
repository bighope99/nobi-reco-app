"use client"
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { StaffLayout } from "@/components/layout/staff-layout";

import {
  AlertTriangle,
  Phone,
  Clock,
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
  CheckCircle2,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';

// --- Types ---

type ChildStatus = 'checked_in' | 'checked_out' | 'absent';

interface Child {
  child_id: string;
  name: string;
  kana: string;
  class_id: string | null;
  class_name: string;
  age_group: string;
  photo_url: string | null;
  status: ChildStatus;
  is_scheduled_today: boolean;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  actual_in_time: string | null;
  actual_out_time: string | null;
  guardian_phone: string;
  last_record_date: string | null;
  weekly_record_count: number;
}

interface KPI {
  scheduled_today: number;
  present_now: number;
  not_arrived: number;
  checked_out: number;
}

interface Alert {
  overdue: any[];
  late: any[];
  unexpected: any[];
}

interface RecordSupport {
  child_id: string;
  name: string;
  kana: string;
  class_name: string;
  last_record_date: string | null;
  days_since_record: number;
  weekly_record_count: number;
  reason: string;
}

interface DashboardData {
  current_time: string;
  current_date: string;
  kpi: KPI;
  alerts: Alert;
  attendance_list: Child[];
  record_support: RecordSupport[];
  filters: {
    classes: Array<{ class_id: string; class_name: string }>;
  };
}

type SortKey = 'status' | 'grade' | 'schedule';
type SortOrder = 'asc' | 'desc';

export default function ChildcareDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [filterClass, setFilterClass] = useState<string>('all');
  const [showUnscheduled, setShowUnscheduled] = useState<boolean>(false);
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // データ取得
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/summary');

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const result = await response.json();
      if (result.success) {
        setDashboardData(result.data);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // --- Actions ---
  const postAttendanceAction = async (action: string, childId: string) => {
    try {
      setError(null);
      const response = await fetch('/api/dashboard/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, child_id: childId }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '出欠処理に失敗しました');
      }

      await fetchDashboardData();
    } catch (err) {
      console.error('Attendance action error:', err);
      setError(err instanceof Error ? err.message : '出欠処理に失敗しました');
    }
  };

  // 登園処理
  const handleCheckIn = async (childId: string) => {
    await postAttendanceAction('check_in', childId);
  };

  // 退室処理
  const handleCheckOut = async (childId: string) => {
    await postAttendanceAction('check_out', childId);
  };

  // 欠席処理
  const handleMarkAbsent = async (childId: string) => {
    await postAttendanceAction('mark_absent', childId);
  };

  // 予定追加
  const handleAddSchedule = async (childId: string) => {
    await postAttendanceAction('add_schedule', childId);
  };

  // 予定外登園の確認
  const handleConfirmUnexpected = async (childId: string) => {
    await postAttendanceAction('confirm_unexpected', childId);
  };

  // --- Utility Functions ---

  const getMinutesDiff = (currentTime: string, targetTime: string) => {
    if (!targetTime || targetTime === '-') return 0;
    const [h1, m1] = currentTime.split(':').map(Number);
    const [h2, m2] = targetTime.split(':').map(Number);
    return (h1 * 60 + m1) - (h2 * 60 + m2);
  };

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
    if (!dashboardData) return [];

    let result = [...dashboardData.attendance_list];

    // 1. Filter: Class
    if (filterClass !== 'all') {
      result = result.filter(c => c.class_name === filterClass);
    }

    // 2. Filter: Show/Hide Unscheduled
    if (showUnscheduled) {
      result = result.filter(c => c.status === 'absent' && !c.is_scheduled_today);
    } else {
      result = result.filter(c => c.status === 'checked_in' || c.is_scheduled_today);
    }

    // 3. Sort
    result.sort((a, b) => {
      // Priority 0: Safety Alerts are ALWAYS Top
      const getAlertPriority = (c: Child) => {
        if (c.status === 'checked_in' && c.is_scheduled_today && c.scheduled_end_time &&
            getMinutesDiff(dashboardData.current_time, c.scheduled_end_time) >= 30) return 1;
        if (c.status === 'absent' && c.is_scheduled_today && c.scheduled_start_time &&
            getMinutesDiff(dashboardData.current_time, c.scheduled_start_time) > 0) return 2;
        if (c.status === 'checked_in' && !c.is_scheduled_today) return 3;
        return 99;
      };

      const alertA = getAlertPriority(a);
      const alertB = getAlertPriority(b);

      if (alertA !== 99 || alertB !== 99) {
        if (alertA !== alertB) return alertA - alertB;
      }

      // User Selected Sort
      let comparison = 0;

      if (sortKey === 'grade') {
        // age_groupでソート（文字列比較）
        comparison = (a.age_group || '').localeCompare(b.age_group || '');
      } else if (sortKey === 'schedule') {
        comparison = (a.scheduled_start_time || '').localeCompare(b.scheduled_start_time || '');
      } else {
        // status (Default)
        const getStatusPriority = (c: Child) => {
          if (c.status === 'checked_in') return 1;
          if (c.status === 'absent' && c.is_scheduled_today) return 2;
          if (c.status === 'checked_out') return 3;
          return 4;
        };
        comparison = getStatusPriority(a) - getStatusPriority(b);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [filterClass, showUnscheduled, sortKey, sortOrder, dashboardData]);

  // --- UI Components ---

  const StatusBadge = ({ child }: { child: Child }) => {
    if (!dashboardData) return null;

    if (child.status === 'checked_in' && !child.is_scheduled_today) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">予定外登園</span>;
    }

    const overdue = child.status === 'checked_in' && child.is_scheduled_today && child.scheduled_end_time &&
      getMinutesDiff(dashboardData.current_time, child.scheduled_end_time) >= 30;
    if (overdue) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">未帰所・遅延</span>;
    }

    switch (child.status) {
      case 'checked_in':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">在所中</span>;
      case 'absent':
        if (child.is_scheduled_today) {
          const isLate = child.scheduled_start_time &&
            getMinutesDiff(dashboardData.current_time, child.scheduled_start_time) > 0;
          if (isLate) {
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-200">未登園(遅れ)</span>;
          }
          return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200">未登園</span>;
        } else {
          return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-400 border border-gray-200">予定なし</span>;
        }
      case 'checked_out':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-400 border border-gray-200">帰宅済</span>;
    }
  };

  const ActionButtons = ({ child }: { child: Child }) => {
    const loginButtonClass = "flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 rounded shadow-sm transition-colors whitespace-nowrap";
    const absentButtonClass = "flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded shadow-sm transition-colors whitespace-nowrap";

    if (child.status === 'absent' && child.is_scheduled_today) {
      return (
        <div className="flex gap-2">
          <button onClick={() => handleCheckIn(child.child_id)} className={loginButtonClass}>
            <LogIn size={14} /> 登園
          </button>
          <button onClick={() => handleMarkAbsent(child.child_id)} className={absentButtonClass}>
            <UserX size={14} /> 欠席
          </button>
        </div>
      );
    }

    if (child.status === 'absent' && !child.is_scheduled_today) {
      return (
        <div className="flex gap-2">
          <button onClick={() => handleCheckIn(child.child_id)} className={loginButtonClass}>
            <LogIn size={14} /> 登園
          </button>
          <button onClick={() => handleAddSchedule(child.child_id)} className={absentButtonClass}>
            <CalendarPlus size={14} /> 予定追加
          </button>
        </div>
      );
    }

    if (child.status === 'checked_in') {
      return (
        <button onClick={() => handleCheckOut(child.child_id)} className="text-xs text-slate-400 hover:text-slate-600 underline">
          退室登録
        </button>
      );
    }

    return <span className="text-xs text-slate-300">-</span>;
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ArrowUpDown size={12} className="text-slate-300" />;
    return <ArrowUpDown size={12} className={`text-indigo-600 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />;
  };

  if (loading) {
    return (
      <StaffLayout title="ダッシュボード">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">読み込み中...</p>
          </div>
        </div>
      </StaffLayout>
    );
  }

  if (error || !dashboardData) {
    return (
      <StaffLayout title="ダッシュボード">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
            <p className="mt-4 text-slate-600">{error || 'データの取得に失敗しました'}</p>
          </div>
        </div>
      </StaffLayout>
    );
  }

  return (
    <StaffLayout title="ダッシュボード">
      <div className="min-h-screen bg-gray-50 text-slate-900 font-sans">
        <style>
          {`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');`}
        </style>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8" style={{ fontFamily: '"Noto Sans JP", sans-serif' }}>

          {/* Header */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6 border-b border-gray-200 pb-4 sm:pb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <LayoutDashboard size={18} className="text-slate-500 sm:w-5 sm:h-5" />
                <h1 className="text-lg sm:text-xl font-bold text-slate-800">安全管理ダッシュボード</h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 pl-6 sm:pl-7">
                {dashboardData.current_date.replace(/-/g, '/')} <span className="mx-1 sm:mx-2">|</span> 現在時刻 <span className="font-mono font-bold text-slate-700">{dashboardData.current_time}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="hidden sm:inline">システム稼働中</span>
                <span className="sm:hidden">稼働中</span>
              </span>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            <div className="lg:col-span-8 flex flex-col gap-6">

              {/* KPI Section */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">本日の出席予定</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-700">{dashboardData.kpi.scheduled_today}</span>
                    <span className="text-xs text-slate-400">名</span>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-emerald-100 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -mr-4 -mt-4"></div>
                  <h3 className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1 relative z-10">現在の在所人数</h3>
                  <div className="flex items-baseline gap-1 relative z-10">
                    <span className="text-3xl font-bold text-emerald-700">{dashboardData.kpi.present_now}</span>
                    <span className="text-xs text-emerald-500">名</span>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">未登園（未到着）</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-700">{dashboardData.kpi.not_arrived}</span>
                    <span className="text-xs text-slate-400">名</span>
                  </div>
                </div>
              </div>

              {/* Alert Section */}
              {(dashboardData.alerts.overdue.length > 0 || dashboardData.alerts.late.length > 0 || dashboardData.alerts.unexpected.length > 0) && (
                <div className="space-y-3">
                  {/* Overdue Alerts */}
                  {dashboardData.alerts.overdue.map(child => (
                    <div key={child.child_id} className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                      <div className="flex items-start gap-3 w-full">
                        <div className="bg-rose-100 p-2 rounded-full text-rose-600 shrink-0">
                          <AlertTriangle size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-rose-900">{child.name}</span>
                            <span className="text-xs px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded border border-rose-200 font-bold">未帰所アラート</span>
                          </div>
                          <div className="text-sm text-rose-800 mt-1 flex flex-wrap gap-x-4">
                            <span className="flex items-center gap-1"><Clock size={14} /> 予定: {child.scheduled_end_time}</span>
                            <span className="font-bold">+{child.minutes_overdue}分 超過</span>
                          </div>
                        </div>
                      </div>
                      <button onClick={() => alert(`発信: ${child.guardian_phone}`)} className="bg-white text-rose-700 border border-rose-200 px-4 py-2 rounded-md font-bold text-sm hover:bg-rose-100 flex items-center gap-2">
                        <Phone size={16} /> 保護者へ連絡
                      </button>
                    </div>
                  ))}

                  {/* Late Alerts */}
                  {dashboardData.alerts.late.map(child => (
                    <div key={child.child_id} className="bg-red-50 border border-red-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                      <div className="flex items-start gap-3 w-full">
                        <div className="bg-red-100 p-2 rounded-full text-red-600 shrink-0">
                          <UserMinus size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-red-900">{child.name}</span>
                            <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded border border-red-200 font-bold">未登園・遅刻</span>
                          </div>
                          <div className="text-sm text-red-800 mt-1 flex flex-wrap gap-x-4">
                            <span className="flex items-center gap-1"><Clock size={14} /> 予定: {child.scheduled_start_time}</span>
                            <span className="font-bold">+{child.minutes_late}分 遅れ</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={() => alert(`発信: ${child.guardian_phone}`)} className="flex-1 sm:flex-none px-3 py-2 bg-white text-red-700 border border-red-200 rounded-md font-bold text-sm hover:bg-red-100 flex items-center justify-center gap-1 whitespace-nowrap">
                          <Phone size={14} /> 連絡
                        </button>
                        <button onClick={() => handleMarkAbsent(child.child_id)} className="flex-1 sm:flex-none px-3 py-2 bg-white text-slate-600 border border-slate-300 rounded-md font-bold text-sm hover:bg-slate-50 flex items-center justify-center gap-1 whitespace-nowrap">
                          <UserX size={14} /> 欠席
                        </button>
                        <button onClick={() => handleCheckIn(child.child_id)} className="flex-1 sm:flex-none px-3 py-2 bg-blue-500 text-white border border-blue-600 rounded-md font-bold text-sm hover:bg-blue-600 flex items-center justify-center gap-1 whitespace-nowrap">
                          <LogIn size={14} /> 到着
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Unexpected Alerts */}
                  {dashboardData.alerts.unexpected.map(child => (
                    <div key={child.child_id} className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                      <div className="flex items-start gap-3 w-full">
                        <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0">
                          <UserPlus size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-900">{child.name}</span>
                            <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded border border-amber-200 font-bold">予定外登園</span>
                          </div>
                          <div className="text-sm text-amber-800 mt-1">本日の出席予定登録がありませんが、チェックインされています。</div>
                        </div>
                      </div>
                      <button onClick={() => handleConfirmUnexpected(child.child_id)} className="flex-1 sm:flex-none px-3 py-2 bg-white text-amber-700 border border-amber-300 rounded-md font-bold text-sm hover:bg-amber-50 flex items-center justify-center gap-1 whitespace-nowrap">
                        <CheckCircle2 size={14} /> 確認
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Attendance List */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col flex-1">
                <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-md px-2 py-1.5">
                      <Filter size={14} className="text-slate-500" />
                      <select
                        value={filterClass}
                        onChange={(e) => setFilterClass(e.target.value)}
                        className="text-sm text-slate-700 bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
                      >
                        <option value="all">全クラス</option>
                        {dashboardData.filters.classes.map(cls => (
                          <option key={cls.class_id} value={cls.class_name}>{cls.class_name}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => setShowUnscheduled(!showUnscheduled)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-md border transition-colors flex items-center gap-2 ${showUnscheduled ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-slate-500 border-gray-300 hover:bg-gray-50'}`}
                    >
                      {showUnscheduled ? <UserX size={14} /> : <UserPlus size={14} />}
                      <span className="hidden sm:inline">{showUnscheduled ? '予定なしを表示中' : '予定なしを表示'}</span>
                      <span className="sm:hidden">{showUnscheduled ? '予定なし' : '予定外'}</span>
                    </button>
                  </div>

                  <span className="text-xs text-slate-500 self-end sm:self-center">
                    {filteredAndSortedChildren.length} 名 表示
                  </span>
                </div>

                {/* デスクトップ: テーブル表示 */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-white border-b border-gray-100 text-slate-500 text-xs uppercase tracking-wider">
                        <th className="px-5 py-3 font-medium">児童名 / クラス</th>
                        <th className="px-5 py-3 font-medium cursor-pointer hover:bg-gray-50 select-none" onClick={() => handleSort('grade')}>
                          <div className="flex items-center gap-1">学年 <SortIcon columnKey="grade" /></div>
                        </th>
                        <th className="px-5 py-3 font-medium cursor-pointer hover:bg-gray-50 select-none" onClick={() => handleSort('status')}>
                          <div className="flex items-center gap-1">ステータス <SortIcon columnKey="status" /></div>
                        </th>
                        <th className="px-5 py-3 font-medium cursor-pointer hover:bg-gray-50 select-none" onClick={() => handleSort('schedule')}>
                          <div className="flex items-center gap-1">予定時刻 <SortIcon columnKey="schedule" /></div>
                        </th>
                        <th className="px-5 py-3 font-medium">実績</th>
                        <th className="px-5 py-3 font-medium">アクション</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredAndSortedChildren.map(child => (
                        <tr key={child.child_id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="font-bold text-slate-800">{child.name}</div>
                            <div className="text-xs text-slate-500">{child.class_name}</div>
                          </td>
                          <td className="px-5 py-3 text-slate-600 text-xs">{child.age_group || '-'}</td>
                          <td className="px-5 py-3"><StatusBadge child={child} /></td>
                          <td className="px-5 py-3 text-slate-600">
                            <div className="flex flex-col text-xs">
                              <span className="flex items-center gap-1 text-slate-400">IN <span className="text-slate-600 font-medium">{child.scheduled_start_time || '-'}</span></span>
                              <span className="flex items-center gap-1 text-slate-400">OUT <span className="text-slate-600 font-medium">{child.scheduled_end_time || '-'}</span></span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-slate-600">
                            <div className="flex flex-col text-xs">
                              {child.actual_in_time ? (
                                <span className="text-emerald-600 font-medium">{child.actual_in_time} 〜 {child.actual_out_time || '...'}</span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3"><ActionButtons child={child} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* モバイル: カード表示 */}
                <div className="lg:hidden divide-y divide-gray-100">
                  {filteredAndSortedChildren.map(child => (
                    <div key={child.child_id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <div className="font-bold text-slate-800 mb-1">{child.name}</div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>{child.class_name}</span>
                            <span>•</span>
                            <span>{child.age_group || '-'}</span>
                          </div>
                        </div>
                        <StatusBadge child={child} />
                      </div>

                      {child.is_scheduled_today && (
                        <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                          <div>
                            <div className="text-slate-400 mb-1">予定</div>
                            <div className="text-slate-600">
                              <div>IN: {child.scheduled_start_time || '-'}</div>
                              <div>OUT: {child.scheduled_end_time || '-'}</div>
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-400 mb-1">実績</div>
                            <div className="text-slate-600">
                              {child.actual_in_time ? (
                                <div className="text-emerald-600 font-medium">
                                  {child.actual_in_time}<br />〜 {child.actual_out_time || '...'}
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      <ActionButtons child={child} />
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="lg:col-span-4 h-full flex flex-col gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group flex flex-col items-center justify-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-full group-hover:scale-110 transition-transform">
                    <FileText size={20} />
                  </div>
                  <span className="text-sm font-bold text-slate-700">日誌記録</span>
                </button>
                <button className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group flex flex-col items-center justify-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-full group-hover:scale-110 transition-transform">
                    <Activity size={20} />
                  </div>
                  <span className="text-sm font-bold text-slate-700">成長レポート</span>
                </button>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-1 flex flex-col lg:sticky lg:top-6">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-indigo-50/30">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                    <ShieldAlert size={16} className="text-indigo-600" />
                    記録サポート候補
                  </h3>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                    {dashboardData.record_support.length}
                  </span>
                </div>

                <div className="flex-1 overflow-auto lg:max-h-[500px] p-2 space-y-2">
                  {dashboardData.record_support.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <p className="text-sm">推奨される記録候補はありません</p>
                    </div>
                  ) : (
                    dashboardData.record_support.map(child => (
                      <div key={child.child_id} className="group p-3 rounded-lg border border-transparent hover:border-indigo-100 hover:bg-indigo-50/50 transition-all flex items-center justify-between">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 w-full">
                          <span className="font-bold text-slate-800 text-sm whitespace-nowrap">{child.name}</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                            {child.reason}
                          </span>
                          <span className="text-xs text-slate-500 whitespace-nowrap">{child.class_name}</span>
                        </div>
                        <button className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-sm transition-all" onClick={() => console.log(`記録: ${child.name}`)}>
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-3 border-t border-gray-100 bg-gray-50 rounded-b-lg mt-auto">
                  <button className="w-full py-2 text-xs text-slate-600 hover:text-indigo-600 font-medium transition-colors flex items-center justify-center gap-2 border border-gray-200 rounded bg-white hover:bg-indigo-50">
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
