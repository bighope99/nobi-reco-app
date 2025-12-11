"use client"
import React, { useState } from 'react';
import { StaffLayout } from "@/components/layout/staff-layout";
import {
  Clock,
  School,
  Plus,
  Save,
  Trash2,
  Edit2,
  ChevronRight,
  Users,
  Check
} from 'lucide-react';

// Weekdays
const weekdays = [
  { id: 'mon', label: '月' },
  { id: 'tue', label: '火' },
  { id: 'wed', label: '水' },
  { id: 'thu', label: '木' },
  { id: 'fri', label: '金' },
  { id: 'sat', label: '土' },
  { id: 'sun', label: '日' }
];

// Grades
const grades = [
  { id: '1', label: '1年生' },
  { id: '2', label: '2年生' },
  { id: '3', label: '3年生' },
  { id: '4', label: '4年生' },
  { id: '5', label: '5年生' },
  { id: '6', label: '6年生' }
];

// Mock data with grades as array of IDs and weekdays
const mockSchools = [
  {
    id: '1',
    name: '第一小学校',
    schedules: [
      {
        scheduleId: '1',
        gradeIds: ['1', '2'],
        weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
        arrivalTime: '08:00',
        departureTime: '15:00'
      },
      {
        scheduleId: '2',
        gradeIds: ['3', '4', '5', '6'],
        weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
        arrivalTime: '08:00',
        departureTime: '16:00'
      }
    ]
  },
  {
    id: '2',
    name: '第二小学校',
    schedules: [
      {
        scheduleId: '3',
        gradeIds: ['1', '2', '3', '4', '5', '6'],
        weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
        arrivalTime: '08:30',
        departureTime: '16:30'
      }
    ]
  }
];

const Input = ({ className = "", ...props }: any) => (
  <input
    className={`w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 transition-all placeholder:text-slate-400 ${className}`}
    {...props}
  />
);

const FieldGroup = ({ label, required, children }: any) => (
  <div className="flex flex-col gap-2">
    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
      {label}
      {required && (
        <span className="text-[10px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded font-bold tracking-wide">
          必須
        </span>
      )}
    </label>
    {children}
  </div>
);

export default function ScheduleSettingsPage() {
  const [schools, setSchools] = useState(mockSchools);
  const [showAddSchool, setShowAddSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [editingSchool, setEditingSchool] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Add new school
  const handleAddSchool = () => {
    if (newSchoolName.trim()) {
      const newSchool = {
        id: String(Date.now()),
        name: newSchoolName,
        schedules: []
      };
      setSchools([...schools, newSchool]);
      setNewSchoolName('');
      setShowAddSchool(false);
      setEditingSchool(newSchool.id);
    }
  };

  // Add schedule to school
  const handleAddSchedule = (schoolId: string) => {
    setSchools(schools.map(school => {
      if (school.id === schoolId) {
        return {
          ...school,
          schedules: [
            ...school.schedules,
            {
              scheduleId: String(Date.now()),
              gradeIds: [],
              weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
              arrivalTime: '08:00',
              departureTime: '15:00'
            }
          ]
        };
      }
      return school;
    }));
  };

  // Toggle grade selection
  const handleToggleGrade = (schoolId: string, scheduleId: string, gradeId: string) => {
    setSchools(schools.map(school => {
      if (school.id === schoolId) {
        return {
          ...school,
          schedules: school.schedules.map(schedule => {
            if (schedule.scheduleId === scheduleId) {
              const gradeIds = schedule.gradeIds.includes(gradeId)
                ? schedule.gradeIds.filter(id => id !== gradeId)
                : [...schedule.gradeIds, gradeId];
              return { ...schedule, gradeIds };
            }
            return schedule;
          })
        };
      }
      return school;
    }));
  };

  // Toggle weekday selection
  const handleToggleWeekday = (schoolId: string, scheduleId: string, weekdayId: string) => {
    setSchools(schools.map(school => {
      if (school.id === schoolId) {
        return {
          ...school,
          schedules: school.schedules.map(schedule => {
            if (schedule.scheduleId === scheduleId) {
              const weekdays = schedule.weekdays.includes(weekdayId)
                ? schedule.weekdays.filter(id => id !== weekdayId)
                : [...schedule.weekdays, weekdayId];
              return { ...schedule, weekdays };
            }
            return schedule;
          })
        };
      }
      return school;
    }));
  };

  // Update time
  const handleUpdateTime = (schoolId: string, scheduleId: string, field: 'arrivalTime' | 'departureTime', value: string) => {
    setSchools(schools.map(school => {
      if (school.id === schoolId) {
        return {
          ...school,
          schedules: school.schedules.map(schedule => {
            if (schedule.scheduleId === scheduleId) {
              return { ...schedule, [field]: value };
            }
            return schedule;
          })
        };
      }
      return school;
    }));
  };

  // Remove schedule
  const handleRemoveSchedule = (schoolId: string, scheduleId: string) => {
    if (confirm('このスケジュール設定を削除しますか？')) {
      setSchools(schools.map(school => {
        if (school.id === schoolId) {
          return {
            ...school,
            schedules: school.schedules.filter(s => s.scheduleId !== scheduleId)
          };
        }
        return school;
      }));
    }
  };

  // Remove school
  const handleRemoveSchool = (schoolId: string) => {
    if (confirm('この学校を削除しますか？紐づくスケジュール設定もすべて削除されます。')) {
      setSchools(schools.filter(s => s.id !== schoolId));
    }
  };

  // Get grade names from IDs
  const getGradeNames = (gradeIds: string[]) => {
    if (gradeIds.length === 0) return '学年未選択';
    return gradeIds
      .map(id => grades.find(g => g.id === id)?.label)
      .filter(Boolean)
      .join('・');
  };

  // Get weekday names from IDs
  const getWeekdayNames = (weekdayIds: string[]) => {
    if (weekdayIds.length === 0) return '曜日未選択';
    return weekdayIds
      .map(id => weekdays.find(w => w.id === id)?.label)
      .filter(Boolean)
      .join('');
  };

  return (
    <StaffLayout title="スケジュール設定">
      <div className="min-h-screen bg-gray-50 text-slate-900 font-sans pb-24">
        <style>
          {`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');`}
        </style>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ fontFamily: '"Noto Sans JP", sans-serif' }}>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Clock className="text-indigo-500" />
                登校時刻設定
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                学校ごと、学年ごと、曜日ごとに来校・帰宅時刻を設定
              </p>
            </div>

            <button
              onClick={() => setShowAddSchool(!showAddSchool)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg shadow-sm transition-colors font-bold text-sm"
            >
              <Plus size={18} />
              学校を追加
            </button>
          </div>

          {/* Add School Form */}
          {showAddSchool && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6 animate-in fade-in slide-in-from-top-2">
              <h3 className="text-lg font-bold text-slate-800 mb-4">新しい学校を追加</h3>
              <div className="flex gap-3">
                <FieldGroup label="学校名" required>
                  <Input
                    placeholder="例: 第一小学校"
                    value={newSchoolName}
                    onChange={(e: any) => setNewSchoolName(e.target.value)}
                  />
                </FieldGroup>
                <div className="flex items-end gap-2">
                  <button
                    onClick={handleAddSchool}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors whitespace-nowrap"
                  >
                    追加
                  </button>
                  <button
                    onClick={() => setShowAddSchool(false)}
                    className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Schools List */}
          <div className="space-y-6">
            {schools.map((school) => (
              <section
                key={school.id}
                className={`bg-white rounded-xl border shadow-sm transition-all ${
                  editingSchool === school.id
                    ? 'border-indigo-200 ring-2 ring-indigo-50'
                    : 'border-gray-200'
                }`}
              >
                {/* School Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${editingSchool === school.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <School size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">{school.name}</h2>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {school.schedules.length}つのスケジュール設定
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingSchool(editingSchool === school.id ? null : school.id)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="編集"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleRemoveSchool(school.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="削除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Schedules List */}
                <div className="p-6">
                  {editingSchool === school.id && (
                    <button
                      onClick={() => handleAddSchedule(school.id)}
                      className="w-full mb-4 flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-3 rounded-lg border-2 border-dashed border-indigo-200 transition-colors font-medium text-sm"
                    >
                      <Plus size={18} />
                      スケジュールを追加
                    </button>
                  )}

                  <div className="space-y-4">
                    {school.schedules.map((schedule) => (
                      <div
                        key={schedule.scheduleId}
                        className={`p-4 rounded-lg border transition-all ${
                          editingSchool === school.id
                            ? 'bg-slate-50 border-slate-200'
                            : 'bg-white border-slate-100'
                        }`}
                      >
                        {editingSchool === school.id ? (
                          <div className="space-y-4">
                            {/* Grade Selection */}
                            <div>
                              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">学年選択 (複数選択可)</label>
                              <div className="flex flex-wrap gap-2">
                                {grades.map((grade) => (
                                  <button
                                    key={grade.id}
                                    onClick={() => handleToggleGrade(school.id, schedule.scheduleId, grade.id)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                                      schedule.gradeIds.includes(grade.id)
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-300 hover:bg-indigo-50'
                                    }`}
                                  >
                                    {schedule.gradeIds.includes(grade.id) && (
                                      <Check size={14} className="inline mr-1" />
                                    )}
                                    {grade.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Weekday Selection */}
                            <div>
                              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">曜日選択 (複数選択可)</label>
                              <div className="flex flex-wrap gap-2">
                                {weekdays.map((day) => (
                                  <button
                                    key={day.id}
                                    onClick={() => handleToggleWeekday(school.id, schedule.scheduleId, day.id)}
                                    className={`w-10 h-10 rounded-lg text-sm font-bold transition-all border ${
                                      schedule.weekdays.includes(day.id)
                                        ? 'bg-purple-600 text-white border-purple-600'
                                        : 'bg-white text-slate-600 border-slate-300 hover:border-purple-300 hover:bg-purple-50'
                                    }`}
                                  >
                                    {day.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Time Inputs */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">登校時刻</label>
                                <div className="flex items-center gap-2">
                                  <Clock size={16} className="text-slate-400" />
                                  <Input
                                    type="time"
                                    value={schedule.arrivalTime}
                                    onChange={(e: any) =>
                                      handleUpdateTime(school.id, schedule.scheduleId, 'arrivalTime', e.target.value)
                                    }
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">下校時刻</label>
                                <div className="flex items-center gap-2">
                                  <Clock size={16} className="text-slate-400" />
                                  <Input
                                    type="time"
                                    value={schedule.departureTime}
                                    onChange={(e: any) =>
                                      handleUpdateTime(school.id, schedule.scheduleId, 'departureTime', e.target.value)
                                    }
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Delete Button */}
                            <div className="flex justify-end pt-2">
                              <button
                                onClick={() => handleRemoveSchedule(school.id, schedule.scheduleId)}
                                className="flex items-center gap-2 text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
                              >
                                <Trash2 size={16} />
                                このスケジュールを削除
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-white rounded-lg border border-slate-200">
                              <Users size={20} className="text-indigo-600" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold text-slate-800 text-sm mb-1">
                                {getGradeNames(schedule.gradeIds)}
                              </h3>
                              <p className="text-xs text-slate-500 flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                  <Clock size={12} />
                                  登校: {schedule.arrivalTime}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock size={12} />
                                  下校: {schedule.departureTime}
                                </span>
                                <span className="flex items-center gap-1">
                                  📅 {getWeekdayNames(schedule.weekdays)}
                                </span>
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {school.schedules.length === 0 && (
                      <div className="text-center py-8 text-slate-400">
                        <Users size={48} className="mx-auto mb-3 opacity-50" />
                        <p>スケジュール設定がありません</p>
                        {editingSchool === school.id && (
                          <p className="text-sm mt-1">上の「スケジュールを追加」ボタンから追加してください</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ))}
          </div>

          {/* Empty State */}
          {schools.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <School size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 mb-4">学校が登録されていません</p>
              <p className="text-sm text-slate-400">「学校を追加」ボタンから学校を登録してください</p>
            </div>
          )}

        </div>

        {/* Sticky Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 z-40">
          <div className="max-w-6xl mx-auto flex items-center justify-end px-4 sm:px-6">
            <button
              type="button"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-8 rounded-lg shadow-md shadow-indigo-200 hover:shadow-lg transition-all text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  保存中...
                </>
              ) : (
                <>
                  <Save size={18} />
                  変更を保存
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </StaffLayout>
  );
}
