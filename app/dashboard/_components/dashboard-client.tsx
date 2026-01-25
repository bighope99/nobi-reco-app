"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
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
  ChevronRight,
  Loader2,
} from 'lucide-react';
import type { Child, PriorityData, RecordSupport, SortKey, SortOrder } from './types';
import {
  KpiSkeleton,
  AlertSkeleton,
  AttendanceListSkeleton,
  RecordSupportSkeleton,
} from './skeletons';

export default function DashboardClient() {
  // Phase 1: Priority data (KPI + Alerts + Action Required)
  const [priorityLoading, setPriorityLoading] = useState(true);
  const [priorityData, setPriorityData] = useState<PriorityData | null>(null);

  // Phase 2: Full attendance list (auto-loaded after priority)
  const [otherChildrenLoading, setOtherChildrenLoading] = useState(false);
  const [otherChildren, setOtherChildren] = useState<Child[]>([]);

  // Phase 3: Record support (loaded async after initial render)
  const [recordSupportLoading, setRecordSupportLoading] = useState(true);
  const [recordSupport, setRecordSupport] = useState<RecordSupport[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState<string>('all');
  const [showUnscheduled, setShowUnscheduled] = useState<boolean>(false);
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState<string>('');
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());

  // Phase 1: Fetch priority data (fastest)
  const fetchPriorityData = useCallback(async () => {
    try {
      setPriorityLoading(true);
      const response = await fetch('/api/dashboard/priority', { cache: 'no-store' });

      if (!response.ok) {
        throw new Error('Failed to fetch priority data');
      }

      const result = await response.json();
      if (result.success) {
        setPriorityData(result.data);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Priority fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setPriorityLoading(false);
    }
  }, []);

  // Phase 2: Fetch other children (on demand)
  const fetchOtherChildren = useCallback(async () => {
    if (!priorityData) return;

    try {
      setOtherChildrenLoading(true);
      const excludeIds = priorityData.action_required.map((c) => c.child_id).join(',');
      const response = await fetch(
        `/api/dashboard/attendance-list?exclude_ids=${encodeURIComponent(excludeIds)}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch attendance list');
      }

      const result = await response.json();
      if (result.success) {
        setOtherChildren(result.data.attendance_list);
      }
    } catch (err) {
      console.error('Attendance list fetch error:', err);
    } finally {
      setOtherChildrenLoading(false);
    }
  }, [priorityData]);

  // Phase 3: Fetch record support (async, lowest priority)
  const fetchRecordSupport = useCallback(async () => {
    try {
      setRecordSupportLoading(true);
      const response = await fetch('/api/dashboard/record-support', { cache: 'no-store' });

      if (!response.ok) {
        throw new Error('Failed to fetch record support');
      }

      const result = await response.json();
      if (result.success) {
        setRecordSupport(result.data.record_support);
      }
    } catch (err) {
      console.error('Record support fetch error:', err);
    } finally {
      setRecordSupportLoading(false);
    }
  }, []);

  // Initial load: Priority data first
  useEffect(() => {
    fetchPriorityData();
  }, [fetchPriorityData]);

  // After priority data loaded, fetch record support and prefetch other children
  useEffect(() => {
    if (!priorityLoading && priorityData) {
      fetchRecordSupport();
      // プリフェッチ: 折りたたみを開く前にデータ取得を開始
      if (otherChildren.length === 0 && !otherChildrenLoading) {
        fetchOtherChildren();
      }
    }
  }, [priorityLoading, priorityData, fetchRecordSupport, fetchOtherChildren, otherChildren.length, otherChildrenLoading]);

  // Current time display
  useEffect(() => {
    const now = new Date();
    setCurrentTimeDisplay(now.toTimeString().slice(0, 5));
  }, []);

  // --- Actions ---
  const postAttendanceAction = async (action: string, childId: string, actionTimestamp?: string) => {
    if (pendingActions.has(childId)) return;

    setPendingActions((prev) => new Set(prev).add(childId));

    const now = new Date();
    const timeJST = now.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Tokyo',
    });

    // Optimistic update for action_required
    const previousPriorityData = priorityData;
    if (priorityData) {
      setPriorityData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          action_required: prev.action_required.map((child) => {
            if (child.child_id !== childId) return child;

            switch (action) {
              case 'check_in':
                return { ...child, status: 'checked_in' as const, actual_in_time: timeJST, is_scheduled_today: true };
              case 'check_out':
                return { ...child, status: 'checked_out' as const, actual_out_time: timeJST };
              case 'mark_absent':
                return { ...child, status: 'absent' as const };
              default:
                return child;
            }
          }),
        };
      });
    }

    // Optimistic update for other children
    const previousOtherChildren = otherChildren;
    if (otherChildren.length > 0) {
      setOtherChildren((prev) =>
        prev.map((child) => {
          if (child.child_id !== childId) return child;

          switch (action) {
            case 'check_in':
              return { ...child, status: 'checked_in' as const, actual_in_time: timeJST, is_scheduled_today: true };
            case 'check_out':
              return { ...child, status: 'checked_out' as const, actual_out_time: timeJST };
            case 'mark_absent':
              return { ...child, status: 'absent' as const };
            default:
              return child;
          }
        })
      );
    }

    try {
      setActionError(null);
      const response = await fetch('/api/dashboard/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, child_id: childId, action_timestamp: actionTimestamp }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        setPriorityData(previousPriorityData);
        setOtherChildren(previousOtherChildren);
        throw new Error(result.error || '出欠処理に失敗しました');
      }
    } catch (err) {
      setPriorityData(previousPriorityData);
      setOtherChildren(previousOtherChildren);
      console.error('Attendance action error:', err);
      const errorMessage = err instanceof Error ? err.message : '出欠処理に失敗しました';
      setActionError(errorMessage);
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setPendingActions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(childId);
        return newSet;
      });
    }
  };

  const handleCheckIn = async (childId: string) => {
    const clickedAt = new Date().toISOString();
    await postAttendanceAction('check_in', childId, clickedAt);
  };

  const handleCheckOut = async (childId: string) => {
    const clickedAt = new Date().toISOString();
    await postAttendanceAction('check_out', childId, clickedAt);
  };

  const handleMarkAbsent = async (childId: string) => {
    await postAttendanceAction('mark_absent', childId);
  };

  const handleAddSchedule = async (childId: string) => {
    await postAttendanceAction('add_schedule', childId);
  };

  const handleConfirmUnexpected = async (childId: string) => {
    await postAttendanceAction('confirm_unexpected', childId);
  };

  // --- Utility Functions ---
  const getMinutesDiff = (currentTime: string, targetTime: string) => {
    if (!targetTime || targetTime === '-') return 0;
    const [h1, m1] = currentTime.split(':').map(Number);
    const [h2, m2] = targetTime.split(':').map(Number);
    return h1 * 60 + m1 - (h2 * 60 + m2);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  // Filter & Sort for action required children
  const filteredActionRequired = useMemo(() => {
    if (!priorityData) return [];
    let result = [...priorityData.action_required];

    if (filterClass !== 'all') {
      result = result.filter((c) => c.class_name === filterClass);
    }

    // 「予定なしを表示」モードでは要対応リストを非表示（予定外登所以外）
    if (showUnscheduled) {
      // 予定外登所の児童のみ表示（予定なしで登所済み）
      result = result.filter((c) => !c.is_scheduled_today && c.status === 'checked_in');
    }

    return result;
  }, [priorityData, filterClass, showUnscheduled]);

  // Filter & Sort for other children
  const filteredOtherChildren = useMemo(() => {
    let result = [...otherChildren];

    if (filterClass !== 'all') {
      result = result.filter((c) => c.class_name === filterClass);
    }

    if (showUnscheduled) {
      result = result.filter((c) => !c.is_scheduled_today && c.status === 'absent');
    } else {
      result = result.filter(
        (c) => c.is_scheduled_today || c.status === 'checked_in' || c.status === 'checked_out'
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;

      if (sortKey === 'grade') {
        const gradeA = a.grade ?? 0;
        const gradeB = b.grade ?? 0;
        comparison = gradeA - gradeB;
        if (comparison === 0) {
          comparison = a.kana.localeCompare(b.kana);
        }
      } else if (sortKey === 'schedule') {
        comparison = (a.scheduled_start_time || '').localeCompare(b.scheduled_start_time || '');
      } else {
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
  }, [otherChildren, filterClass, showUnscheduled, sortKey, sortOrder]);

  // --- UI Components ---
  const StatusBadge = ({ child }: { child: Child }) => {
    if (!priorityData) return null;

    if (child.status === 'checked_in' && !child.is_scheduled_today) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
          予定外登所
        </span>
      );
    }

    const overdue =
      child.status === 'checked_in' &&
      child.is_scheduled_today &&
      child.scheduled_end_time &&
      getMinutesDiff(priorityData.current_time, child.scheduled_end_time) >= 30;
    if (overdue) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
          未帰所・遅延
        </span>
      );
    }

    switch (child.status) {
      case 'checked_in':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
            在所中
          </span>
        );
      case 'absent':
        if (child.is_scheduled_today) {
          const isLate =
            child.scheduled_start_time &&
            getMinutesDiff(priorityData.current_time, child.scheduled_start_time) > 0;
          if (isLate) {
            return (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                未登所(遅れ)
              </span>
            );
          }
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200">
              未登所
            </span>
          );
        } else {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-400 border border-gray-200">
              予定なし
            </span>
          );
        }
      case 'checked_out':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-400 border border-gray-200">
            帰宅済
          </span>
        );
    }
  };

  const ActionButtons = ({ child }: { child: Child }) => {
    const isPending = pendingActions.has(child.child_id);
    const loginButtonClass =
      'flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 rounded shadow-sm transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-500';
    const absentButtonClass =
      'flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded shadow-sm transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white';

    if (child.status === 'absent' && child.is_scheduled_today) {
      return (
        <div className="flex gap-2">
          <button onClick={() => handleCheckIn(child.child_id)} className={loginButtonClass} disabled={isPending}>
            <LogIn size={14} /> 登所
          </button>
          <button onClick={() => handleMarkAbsent(child.child_id)} className={absentButtonClass} disabled={isPending}>
            <UserX size={14} /> 欠席
          </button>
        </div>
      );
    }

    if (child.status === 'absent' && !child.is_scheduled_today) {
      return (
        <div className="flex gap-2">
          <button onClick={() => handleCheckIn(child.child_id)} className={loginButtonClass} disabled={isPending}>
            <LogIn size={14} /> 登所
          </button>
          <button onClick={() => handleAddSchedule(child.child_id)} className={absentButtonClass} disabled={isPending}>
            <CalendarPlus size={14} /> 予定追加
          </button>
        </div>
      );
    }

    if (child.status === 'checked_in') {
      return (
        <button
          onClick={() => handleCheckOut(child.child_id)}
          className="text-xs text-slate-400 hover:text-slate-600 underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
          disabled={isPending}
        >
          帰宅
        </button>
      );
    }

    return <span className="text-xs text-slate-300">-</span>;
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ArrowUpDown size={12} className="text-slate-300" />;
    return (
      <ArrowUpDown
        size={12}
        className={`text-indigo-600 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`}
      />
    );
  };

  // Render child row (reusable for both sections)
  const ChildRow = ({ child, isDesktop }: { child: Child; isDesktop: boolean }) => {
    if (isDesktop) {
      return (
        <tr className="hover:bg-slate-50 transition-colors">
          <td className="px-5 py-3">
            <div className="font-bold text-slate-800">{child.name}</div>
            <div className="text-xs text-slate-500">{child.class_name}</div>
          </td>
          <td className="px-5 py-3 text-slate-600 text-xs">{child.grade_label || '-'}</td>
          <td className="px-5 py-3">
            <StatusBadge child={child} />
          </td>
          <td className="px-5 py-3 text-slate-600">
            <div className="flex flex-col text-xs">
              <span className="flex items-center gap-1 text-slate-400">
                IN <span className="text-slate-600 font-medium">{child.scheduled_start_time || '-'}</span>
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                OUT <span className="text-slate-600 font-medium">{child.scheduled_end_time || '-'}</span>
              </span>
            </div>
          </td>
          <td className="px-5 py-3 text-slate-600">
            <div className="flex flex-col text-xs">
              {child.actual_in_time ? (
                <span className="text-emerald-600 font-medium">
                  {child.actual_in_time} 〜 {child.actual_out_time || '...'}
                </span>
              ) : (
                <span className="text-slate-400">-</span>
              )}
            </div>
          </td>
          <td className="px-5 py-3">
            <ActionButtons child={child} />
          </td>
        </tr>
      );
    }

    // Mobile card
    return (
      <div className="p-4 hover:bg-slate-50 transition-colors">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <div className="font-bold text-slate-800 mb-1">{child.name}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{child.class_name}</span>
              <span>•</span>
              <span>{child.grade_label || '-'}</span>
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
                    {child.actual_in_time}
                    <br />〜 {child.actual_out_time || '...'}
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
    );
  };

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
          <p className="mt-4 text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {actionError && (
        <div className="fixed top-4 right-4 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg flex items-center gap-2 max-w-md">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="ml-2 text-red-500 hover:text-red-700 transition-colors"
            aria-label="Close error notification"
          >
            ✕
          </button>
        </div>
      )}

      <div className="min-h-screen text-slate-900 font-sans">
        <style>
          {`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');`}
        </style>

        <div className="max-w-[1600px] mx-auto" style={{ fontFamily: '"Noto Sans JP", sans-serif' }}>
          {/* Header */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6 border-b border-gray-200 pb-4 sm:pb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <LayoutDashboard size={18} className="text-slate-500 sm:w-5 sm:h-5" />
                <h1 className="text-lg sm:text-xl font-bold text-slate-800">安全管理ダッシュボード</h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 pl-6 sm:pl-7">
                {priorityData?.current_date.replace(/-/g, '/') || '---'}{' '}
                <span className="mx-1 sm:mx-2">|</span> 現在時刻{' '}
                <span className="font-mono font-bold text-slate-700">
                  {currentTimeDisplay || priorityData?.current_time || '--:--'}
                </span>
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

          <div className="grid grid-cols-1">
            <div className="flex flex-col gap-6">
              {/* KPI Section */}
              {priorityLoading ? (
                <KpiSkeleton />
              ) : priorityData ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      本日の出席予定
                    </h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-slate-700">{priorityData.kpi.scheduled_today}</span>
                      <span className="text-xs text-slate-400">名</span>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-emerald-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -mr-4 -mt-4"></div>
                    <h3 className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1 relative z-10">
                      現在の在所人数
                    </h3>
                    <div className="flex items-baseline gap-1 relative z-10">
                      <span className="text-3xl font-bold text-emerald-700">{priorityData.kpi.present_now}</span>
                      <span className="text-xs text-emerald-500">名</span>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      未登所（未到着）
                    </h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-slate-700">{priorityData.kpi.not_arrived}</span>
                      <span className="text-xs text-slate-400">名</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Alert Section */}
              {priorityLoading ? (
                <AlertSkeleton />
              ) : priorityData &&
                (priorityData.alerts.overdue.length > 0 ||
                  priorityData.alerts.late.length > 0 ||
                  priorityData.alerts.unexpected.length > 0) ? (
                <div className="space-y-3">
                  {/* Overdue Alerts */}
                  {priorityData.alerts.overdue.map((child) => (
                    <div
                      key={child.child_id}
                      className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
                    >
                      <div className="flex items-start gap-3 w-full">
                        <div className="bg-rose-100 p-2 rounded-full text-rose-600 shrink-0">
                          <AlertTriangle size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-rose-900">{child.name}</span>
                            <span className="text-xs px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded border border-rose-200 font-bold">
                              未帰所アラート
                            </span>
                          </div>
                          <div className="text-sm text-rose-800 mt-1 flex flex-wrap gap-x-4">
                            <span className="flex items-center gap-1">
                              <Clock size={14} /> 予定: {child.scheduled_end_time}
                            </span>
                            <span className="font-bold">+{child.minutes_overdue}分 超過</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => alert(`発信: ${child.guardian_phone}`)}
                        className="bg-white text-rose-700 border border-rose-200 px-4 py-2 rounded-md font-bold text-sm hover:bg-rose-100 flex items-center gap-2"
                      >
                        <Phone size={16} /> 保護者へ連絡
                      </button>
                    </div>
                  ))}

                  {/* Late Alerts */}
                  {priorityData.alerts.late.map((child) => (
                    <div
                      key={child.child_id}
                      className="bg-red-50 border border-red-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
                    >
                      <div className="flex items-start gap-3 w-full">
                        <div className="bg-red-100 p-2 rounded-full text-red-600 shrink-0">
                          <UserMinus size={20} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-red-900">{child.name}</span>
                            <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded border border-red-200 font-bold">
                              未登所・遅刻
                            </span>
                          </div>
                          <div className="text-xs text-red-700 mt-1 flex flex-wrap items-center gap-x-2">
                            {child.school_name && (
                              <span className="bg-red-100/50 px-1.5 py-0.5 rounded">{child.school_name}</span>
                            )}
                            {child.grade_label && (
                              <span className="bg-red-100/50 px-1.5 py-0.5 rounded">{child.grade_label}</span>
                            )}
                            <span className="text-red-600">{child.class_name}</span>
                          </div>
                          <div className="text-sm text-red-800 mt-1 flex flex-wrap gap-x-4">
                            <span className="flex items-center gap-1">
                              <Clock size={14} /> 予定: {child.scheduled_start_time}
                            </span>
                            <span className="font-bold">+{child.minutes_late}分 遅れ</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => alert(`発信: ${child.guardian_phone || '電話番号未登録'}`)}
                          className="flex-1 sm:flex-none px-3 py-2 bg-white text-red-700 border border-red-200 rounded-md font-bold text-sm hover:bg-red-100 flex items-center justify-center gap-1 whitespace-nowrap"
                        >
                          <Phone size={14} /> 連絡
                        </button>
                        <button
                          onClick={() => handleMarkAbsent(child.child_id)}
                          className="flex-1 sm:flex-none px-3 py-2 bg-white text-slate-600 border border-slate-300 rounded-md font-bold text-sm hover:bg-slate-50 flex items-center justify-center gap-1 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={pendingActions.has(child.child_id)}
                        >
                          <UserX size={14} /> 欠席
                        </button>
                        <button
                          onClick={() => handleCheckIn(child.child_id)}
                          className="flex-1 sm:flex-none px-3 py-2 bg-blue-500 text-white border border-blue-600 rounded-md font-bold text-sm hover:bg-blue-600 flex items-center justify-center gap-1 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={pendingActions.has(child.child_id)}
                        >
                          <LogIn size={14} /> 到着
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Unexpected Alerts */}
                  {priorityData.alerts.unexpected.map((child) => (
                    <div
                      key={child.child_id}
                      className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
                    >
                      <div className="flex items-start gap-3 w-full">
                        <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0">
                          <UserPlus size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-900">{child.name}</span>
                            <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded border border-amber-200 font-bold">
                              予定外登所
                            </span>
                          </div>
                          <div className="text-sm text-amber-800 mt-1">
                            本日の出席予定登録がありませんが、登所されています。
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleConfirmUnexpected(child.child_id)}
                        className="flex-1 sm:flex-none px-3 py-2 bg-white text-amber-700 border border-amber-300 rounded-md font-bold text-sm hover:bg-amber-50 flex items-center justify-center gap-1 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={pendingActions.has(child.child_id)}
                      >
                        <CheckCircle2 size={14} /> 確認
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Attendance List with Collapsible Sections */}
              {priorityLoading ? (
                <AttendanceListSkeleton />
              ) : priorityData ? (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col flex-1">
                  {/* Filter Header */}
                  <div className="px-5 py-3 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-md px-2 py-1.5">
                        <Filter size={14} className="text-slate-500" />
                        <select
                          value={filterClass}
                          onChange={(e) => setFilterClass(e.target.value)}
                          className="text-sm text-slate-700 bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
                        >
                          <option value="all">全クラス</option>
                          {priorityData.filters.classes.map((cls) => (
                            <option key={cls.class_id} value={cls.class_name}>
                              {cls.class_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() => setShowUnscheduled(!showUnscheduled)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-md border transition-colors flex items-center gap-2 ${
                          showUnscheduled
                            ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                            : 'bg-white text-slate-500 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {showUnscheduled ? <UserX size={14} /> : <UserPlus size={14} />}
                        <span className="hidden sm:inline">
                          {showUnscheduled ? '予定なしを表示中' : '予定なしを表示'}
                        </span>
                        <span className="sm:hidden">{showUnscheduled ? '予定なし' : '予定外'}</span>
                      </button>
                    </div>

                    <span className="text-xs text-slate-500 self-end sm:self-center">
                      {filteredActionRequired.length + filteredOtherChildren.length} 名 表示
                    </span>
                  </div>

                  {/* Action Required Children (inline, no header) */}
                  {filteredActionRequired.length > 0 && (
                    <>
                      {/* Desktop Table */}
                      <div className="hidden lg:block">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="bg-white border-b border-gray-100 text-slate-500 text-xs uppercase tracking-wider">
                              <th className="px-5 py-3 font-medium">児童名 / クラス</th>
                              <th
                                className="px-5 py-3 font-medium cursor-pointer hover:bg-gray-50 select-none"
                                onClick={() => handleSort('grade')}
                              >
                                <div className="flex items-center gap-1">
                                  学年 <SortIcon columnKey="grade" />
                                </div>
                              </th>
                              <th
                                className="px-5 py-3 font-medium cursor-pointer hover:bg-gray-50 select-none"
                                onClick={() => handleSort('status')}
                              >
                                <div className="flex items-center gap-1">
                                  ステータス <SortIcon columnKey="status" />
                                </div>
                              </th>
                              <th
                                className="px-5 py-3 font-medium cursor-pointer hover:bg-gray-50 select-none"
                                onClick={() => handleSort('schedule')}
                              >
                                <div className="flex items-center gap-1">
                                  予定時刻 <SortIcon columnKey="schedule" />
                                </div>
                              </th>
                              <th className="px-5 py-3 font-medium">実績</th>
                              <th className="px-5 py-3 font-medium">アクション</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {filteredActionRequired.map((child) => (
                              <ChildRow key={child.child_id} child={child} isDesktop={true} />
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Cards */}
                      <div className="lg:hidden divide-y divide-gray-100">
                        {filteredActionRequired.map((child) => (
                          <ChildRow key={child.child_id} child={child} isDesktop={false} />
                        ))}
                      </div>
                    </>
                  )}

                  {/* Other Children (auto-loaded, no collapsible) */}
                  {filteredOtherChildren.length > 0 && (
                    <>
                      {/* Desktop Table */}
                      <div className="hidden lg:block">
                        <table className="w-full text-left border-collapse text-sm">
                          <tbody className="divide-y divide-gray-100">
                            {filteredOtherChildren.map((child) => (
                              <ChildRow key={child.child_id} child={child} isDesktop={true} />
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Cards */}
                      <div className="lg:hidden divide-y divide-gray-100">
                        {filteredOtherChildren.map((child) => (
                          <ChildRow key={child.child_id} child={child} isDesktop={false} />
                        ))}
                      </div>
                    </>
                  )}

                  {/* Loading indicator for other children */}
                  {otherChildrenLoading && (
                    <div className="p-4 text-center">
                      <Loader2 size={20} className="animate-spin text-slate-400 mx-auto" />
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Right Sidebar */}
            <div className="lg:col-span-4 h-full flex flex-col gap-6 mt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link
                  href="/records/activity"
                  className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group flex flex-col items-center justify-center gap-2"
                >
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-full group-hover:scale-110 transition-transform">
                    <FileText size={20} />
                  </div>
                  <span className="text-sm font-bold text-slate-700">日誌記録</span>
                </Link>
                <Link
                  href="/attendance/list"
                  className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group flex flex-col items-center justify-center gap-2"
                >
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-full group-hover:scale-110 transition-transform">
                    <Activity size={20} />
                  </div>
                  <span className="text-sm font-bold text-slate-700">出席生徒</span>
                </Link>
              </div>

              {/* Record Support Section */}
              {recordSupportLoading ? (
                <RecordSupportSkeleton />
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-1 flex flex-col lg:sticky lg:top-6">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-indigo-50/30">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                      <ShieldAlert size={16} className="text-indigo-600" />
                      記録サポート候補
                    </h3>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                      {recordSupport.length}
                    </span>
                  </div>

                  <div className="flex-1 overflow-auto lg:max-h-[500px] p-2 space-y-2">
                    {recordSupport.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        <p className="text-sm">推奨される記録候補はありません</p>
                      </div>
                    ) : (
                      recordSupport.map((child) => (
                        <Link
                          key={child.child_id}
                          href={`/records/personal/new?childId=${encodeURIComponent(child.child_id)}&childName=${encodeURIComponent(child.name)}`}
                          className="group p-3 rounded-lg border border-transparent hover:border-indigo-100 hover:bg-indigo-50/50 transition-all flex items-center justify-between"
                          aria-label={`${child.name}の児童記録を作成`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 w-full">
                            <span className="font-bold text-slate-800 text-sm whitespace-nowrap">{child.name}</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                              {child.reason}
                            </span>
                            <span className="text-xs text-slate-500 whitespace-nowrap">{child.class_name}</span>
                          </div>
                          <span
                            className="p-1.5 rounded-md text-slate-400 group-hover:text-indigo-600 transition-all"
                            aria-hidden="true"
                          >
                            <ChevronRight size={18} />
                          </span>
                        </Link>
                      ))
                    )}
                  </div>

                  <div className="p-3 border-t border-gray-100 bg-gray-50 rounded-b-lg mt-auto">
                    <Button
                      variant="outline"
                      className="w-full text-xs font-medium text-slate-600 hover:text-indigo-600"
                      asChild
                    >
                      <Link href="/records/status" className="flex items-center justify-center gap-2">
                        <MoreHorizontal size={14} />
                        全児童の記録状況
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
