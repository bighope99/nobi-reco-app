"use client"
import React, { useState } from 'react';
import { StaffLayout } from "@/components/layout/staff-layout";
import { useParams } from 'next/navigation';
import {
  Users,
  Building2,
  UserCheck,
  Save,
  ChevronLeft,
  Plus,
  X,
  Trash2,
  ChevronRight
} from 'lucide-react';

// Mock data
const mockClass = {
  id: '1',
  name: 'ひよこ組',
  facilityId: '1',
  facility: 'ひまわり保育園 本園',
  capacity: 10,
  ageRange: '0-1歳',
  description: '0歳から1歳までの乳児クラスです',
  teachers: [
    { id: '1', name: '田中先生', role: '主任' },
    { id: '2', name: '佐藤先生', role: '副担任' }
  ],
  children: [
    { id: '1', name: '山田太郎', age: 0, kana: 'やまだたろう' },
    { id: '2', name: '鈴木花子', age: 1, kana: 'すずきはなこ' }
  ]
};

const mockFacilities = [
  { id: '1', name: 'ひまわり保育園 本園' },
  { id: '2', name: 'ひまわり保育園 分園' }
];

const mockAvailableTeachers = [
  { id: '3', name: '高橋先生' },
  { id: '4', name: '伊藤先生' },
  { id: '5', name: '渡辺先生' }
];

const Input = ({ className = "", ...props }: any) => (
  <input
    className={`w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 transition-all placeholder:text-slate-400 ${className}`}
    {...props}
  />
);

const Select = ({ children, className = "", ...props }: any) => (
  <div className="relative">
    <select
      className={`w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 appearance-none cursor-pointer transition-shadow ${className}`}
      {...props}
    >
      {children}
    </select>
    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
      <ChevronRight size={16} className="rotate-90" />
    </div>
  </div>
);

const Textarea = ({ className = "", ...props }: any) => (
  <textarea
    className={`w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-3 min-h-[100px] transition-all resize-y placeholder:text-slate-400 ${className}`}
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

export default function ClassDetailPage() {
  const params = useParams();
  const [classData, setClassData] = useState(mockClass);
  const [loading, setLoading] = useState(false);
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedTeacherRole, setSelectedTeacherRole] = useState('副担任');

  const handleAddTeacher = () => {
    if (selectedTeacherId) {
      const teacher = mockAvailableTeachers.find(t => t.id === selectedTeacherId);
      if (teacher) {
        setClassData({
          ...classData,
          teachers: [
            ...classData.teachers,
            { id: teacher.id, name: teacher.name, role: selectedTeacherRole }
          ]
        });
        setShowAddTeacher(false);
        setSelectedTeacherId('');
        setSelectedTeacherRole('副担任');
      }
    }
  };

  const handleRemoveTeacher = (teacherId: string) => {
    if (confirm('この担任を解除しますか？')) {
      setClassData({
        ...classData,
        teachers: classData.teachers.filter(t => t.id !== teacherId)
      });
    }
  };

  return (
    <StaffLayout title="クラス詳細">
      <div className="min-h-screen bg-gray-50 text-slate-900 font-sans pb-24">
        <style>
          {`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');`}
        </style>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ fontFamily: '"Noto Sans JP", sans-serif' }}>

          {/* Back Button */}
          <button
            onClick={() => window.location.href = '/settings/classes'}
            className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 mb-6 transition-colors"
          >
            <ChevronLeft size={20} />
            <span className="text-sm font-medium">クラス一覧に戻る</span>
          </button>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Users className="text-indigo-500" />
                クラス詳細設定
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                クラスの基本情報、紐づけ施設、担任を管理
              </p>
            </div>
          </div>

          {/* Basic Info Section */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
            <div className="px-6 py-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">基本情報</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FieldGroup label="クラス名" required>
                  <Input
                    value={classData.name}
                    onChange={(e: any) => setClassData({ ...classData, name: e.target.value })}
                    placeholder="例: ひよこ組"
                  />
                </FieldGroup>

                <FieldGroup label="対象年齢" required>
                  <Input
                    value={classData.ageRange}
                    onChange={(e: any) => setClassData({ ...classData, ageRange: e.target.value })}
                    placeholder="例: 0-1歳"
                  />
                </FieldGroup>

                <FieldGroup label="定員" required>
                  <Input
                    type="number"
                    value={classData.capacity}
                    onChange={(e: any) => setClassData({ ...classData, capacity: parseInt(e.target.value) })}
                    min="1"
                  />
                </FieldGroup>

                <FieldGroup label="所属施設" required>
                  <Select
                    value={classData.facilityId}
                    onChange={(e: any) => {
                      const facility = mockFacilities.find(f => f.id === e.target.value);
                      setClassData({
                        ...classData,
                        facilityId: e.target.value,
                        facility: facility?.name || ''
                      });
                    }}
                  >
                    {mockFacilities.map(facility => (
                      <option key={facility.id} value={facility.id}>
                        {facility.name}
                      </option>
                    ))}
                  </Select>
                </FieldGroup>

                <FieldGroup label="クラス説明" className="sm:col-span-2">
                  <Textarea
                    value={classData.description}
                    onChange={(e: any) => setClassData({ ...classData, description: e.target.value })}
                    placeholder="クラスの特徴や方針を入力..."
                  />
                </FieldGroup>
              </div>
            </div>
          </section>

          {/* Teachers Section */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">担任管理</h2>
                <p className="text-sm text-slate-500 mt-1">複数の担任を設定できます</p>
              </div>
              <button
                onClick={() => setShowAddTeacher(!showAddTeacher)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-sm transition-colors font-bold text-sm"
              >
                <Plus size={18} />
                担任追加
              </button>
            </div>

            <div className="p-6">
              {/* Add Teacher Form */}
              {showAddTeacher && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-end gap-3">
                    <FieldGroup label="職員を選択" required>
                      <Select
                        value={selectedTeacherId}
                        onChange={(e: any) => setSelectedTeacherId(e.target.value)}
                      >
                        <option value="">選択してください</option>
                        {mockAvailableTeachers.map(teacher => (
                          <option key={teacher.id} value={teacher.id}>
                            {teacher.name}
                          </option>
                        ))}
                      </Select>
                    </FieldGroup>
                    <FieldGroup label="役割">
                      <Select
                        value={selectedTeacherRole}
                        onChange={(e: any) => setSelectedTeacherRole(e.target.value)}
                        className="max-w-[120px]"
                      >
                        <option value="主任">主任</option>
                        <option value="副担任">副担任</option>
                        <option value="補助">補助</option>
                      </Select>
                    </FieldGroup>
                    <button
                      onClick={handleAddTeacher}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
                    >
                      <Plus size={16} />
                      追加
                    </button>
                    <button
                      onClick={() => setShowAddTeacher(false)}
                      className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}

              {/* Teachers List */}
              <div className="space-y-3">
                {classData.teachers.map((teacher) => (
                  <div
                    key={teacher.id}
                    className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        <UserCheck size={20} className="text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">{teacher.name}</h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                          {teacher.role}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveTeacher(teacher.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="担任解除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}

                {classData.teachers.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <UserCheck size={48} className="mx-auto mb-3 opacity-50" />
                    <p>担任が設定されていません</p>
                    <p className="text-sm mt-1">「担任追加」ボタンから追加してください</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Children Summary Section */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
            <div className="px-6 py-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">在籍児童</h2>
              <p className="text-sm text-slate-500 mt-1">
                {classData.children.length}名 / 定員{classData.capacity}名
              </p>
            </div>
            <div className="p-6">
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      classData.children.length >= classData.capacity
                        ? 'bg-red-500'
                        : classData.children.length / classData.capacity > 0.8
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min((classData.children.length / classData.capacity) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Children List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {classData.children.map((child) => (
                  <div
                    key={child.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/children/${child.id}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                      {child.age}歳
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 text-sm">{child.name}</p>
                      <p className="text-xs text-slate-500">{child.kana}</p>
                    </div>
                  </div>
                ))}
              </div>

              {classData.children.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <p>児童が登録されていません</p>
                </div>
              )}
            </div>
          </section>

        </div>

        {/* Sticky Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 z-40">
          <div className="max-w-5xl mx-auto flex items-center justify-between px-4 sm:px-6">
            <button
              type="button"
              onClick={() => window.location.href = '/settings/classes'}
              className="text-slate-500 hover:text-slate-800 font-medium text-sm px-4 py-2 transition-colors"
            >
              キャンセル
            </button>
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
