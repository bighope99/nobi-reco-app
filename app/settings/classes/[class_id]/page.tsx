"use client"
import React, { useState, useEffect } from 'react';
import { StaffLayout } from "@/components/layout/staff-layout";
import { useParams, useRouter } from 'next/navigation';
import {
  Users,
  Building2,
  UserCheck,
  Save,
  ChevronLeft,
  Plus,
  X,
  Trash2,
  ChevronRight,
  Search,
  Check,
  Filter,
  ArrowUpDown
} from 'lucide-react';

// Types
interface Teacher {
  id: string;
  name: string;
  role?: string;
  class_role?: string; // 'main' | 'sub' | 'assistant'
}

interface Child {
  id: string;
  name: string;
  name_kana: string;
  age: number;
  birth_date?: string;
  enrollment_status?: string;
}

interface Facility {
  facility_id: string;
  name: string;
}

interface ClassData {
  class_id: string;
  name: string;
  age_group: string;
  capacity: number;
  room_number?: string;
  color_code?: string;
  display_order?: number;
  is_active?: boolean;
  facility_id: string;
  facility_name: string;
  staff: Teacher[];
  children: Child[];
}

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
  const router = useRouter();
  const classId = params.class_id as string;

  const [classData, setClassData] = useState<ClassData | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [allChildren, setAllChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedTeacherRole, setSelectedTeacherRole] = useState<string>('main');

  // Child management
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [childSearchTerm, setChildSearchTerm] = useState('');
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const [filterClassName, setFilterClassName] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'grade'>('grade');

  // Fetch class data
  useEffect(() => {
    fetchClassData();
    fetchFacilities();
    fetchAllTeachers();
    fetchAllChildren();
  }, [classId]);

  const fetchClassData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/classes/${classId}`);
      const result = await response.json();

      if (result.success) {
        setClassData(result.data);
      } else {
        alert(result.error || 'クラス情報の取得に失敗しました');
      }
    } catch (error) {
      console.error('Error fetching class:', error);
      alert('クラス情報の取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const fetchFacilities = async () => {
    try {
      const response = await fetch('/api/facilities');
      const result = await response.json();

      if (result.success) {
        setFacilities(result.data.facilities || []);
      }
    } catch (error) {
      console.error('Error fetching facilities:', error);
    }
  };

  const fetchAllTeachers = async () => {
    try {
      const response = await fetch('/api/users');
      const result = await response.json();

      if (result.success) {
        setAllTeachers(result.data.users.map((u: any) => ({
          id: u.user_id,
          name: u.name,
          role: u.role
        })));
      }
    } catch (error) {
      console.error('Error fetching teachers:', error);
    }
  };

  const fetchAllChildren = async () => {
    try {
      const response = await fetch('/api/children');
      const result = await response.json();

      if (result.success) {
        setAllChildren(result.data.children || []);
      }
    } catch (error) {
      console.error('Error fetching children:', error);
    }
  };

  const handleSave = async () => {
    if (!classData) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/classes/${classId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: classData.name,
          age_group: classData.age_group,
          capacity: classData.capacity,
          room_number: classData.room_number,
          color_code: classData.color_code,
          display_order: classData.display_order,
          is_active: classData.is_active
        })
      });

      const result = await response.json();

      if (result.success) {
        alert('クラス情報を更新しました');
        fetchClassData();
      } else {
        alert(result.error || '更新に失敗しました');
      }
    } catch (error) {
      console.error('Error saving class:', error);
      alert('更新中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTeacher = async () => {
    if (!classData || !selectedTeacherId) return;

    try {
      const response = await fetch(`/api/classes/${classId}/teachers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedTeacherId,
          class_role: selectedTeacherRole
        })
      });

      const result = await response.json();

      if (result.success) {
        // Refresh class data to get updated staff list
        await fetchClassData();
        setShowAddTeacher(false);
        setSelectedTeacherId('');
        setSelectedTeacherRole('main');
      } else {
        alert(result.error || '担任の追加に失敗しました');
      }
    } catch (error) {
      console.error('Error adding teacher:', error);
      alert('担任の追加中にエラーが発生しました');
    }
  };

  const handleRemoveTeacher = async (teacherId: string) => {
    if (!classData) return;

    if (confirm('この担任を解除しますか？')) {
      try {
        const response = await fetch(`/api/classes/${classId}/teachers/${teacherId}`, {
          method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
          // Refresh class data to get updated staff list
          await fetchClassData();
        } else {
          alert(result.error || '担任の解除に失敗しました');
        }
      } catch (error) {
        console.error('Error removing teacher:', error);
        alert('担任の解除中にエラーが発生しました');
      }
    }
  };

  // Child management functions
  const handleToggleChild = (childId: string) => {
    if (selectedChildIds.includes(childId)) {
      setSelectedChildIds(selectedChildIds.filter(id => id !== childId));
    } else {
      setSelectedChildIds([...selectedChildIds, childId]);
    }
  };

  const handleAddChildren = () => {
    if (!classData) return;

    const childrenToAdd = allChildren.filter(child =>
      selectedChildIds.includes(child.id)
    );
    setClassData({
      ...classData,
      children: [...classData.children, ...childrenToAdd]
    });
    setSelectedChildIds([]);
    setShowAddChildModal(false);
    setChildSearchTerm('');
  };

  const handleRemoveChild = (childId: string) => {
    if (!classData) return;

    if (confirm('このクラスから児童を除外しますか？')) {
      setClassData({
        ...classData,
        children: classData.children.filter(c => c.id !== childId)
      });
    }
  };

  // Available teachers (not already in class)
  const availableTeachers = allTeachers.filter(
    teacher => !classData?.staff.some(s => s.id === teacher.id)
  );

  // Filter and sort available children (exclude already in class)
  const availableChildren = allChildren
    .filter(child =>
      !classData?.children.some(c => c.id === child.id) &&
      (child.name.includes(childSearchTerm) || child.name_kana.includes(childSearchTerm))
    )
    .sort((a, b) => {
      if (sortBy === 'grade') {
        return a.age - b.age;
      } else {
        return a.name_kana.localeCompare(b.name_kana);
      }
    });

  if (loading) {
    return (
      <StaffLayout title="クラス詳細">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
        </div>
      </StaffLayout>
    );
  }

  if (!classData) {
    return (
      <StaffLayout title="クラス詳細">
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-slate-500">クラス情報が見つかりませんでした</p>
        </div>
      </StaffLayout>
    );
  }

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
                    value={classData.age_group}
                    onChange={(e: any) => setClassData({ ...classData, age_group: e.target.value })}
                    placeholder="例: 0-1歳"
                  />
                </FieldGroup>

                <FieldGroup label="定員" required>
                  <Input
                    type="number"
                    value={classData.capacity}
                    onChange={(e: any) => setClassData({ ...classData, capacity: parseInt(e.target.value) || 0 })}
                    min="1"
                  />
                </FieldGroup>

                <FieldGroup label="所属施設" required>
                  <Select
                    value={classData.facility_id}
                    onChange={(e: any) => {
                      const facility = facilities.find(f => f.facility_id === e.target.value);
                      setClassData({
                        ...classData,
                        facility_id: e.target.value,
                        facility_name: facility?.name || ''
                      });
                    }}
                  >
                    {facilities.map(facility => (
                      <option key={facility.facility_id} value={facility.facility_id}>
                        {facility.name}
                      </option>
                    ))}
                  </Select>
                </FieldGroup>

                <FieldGroup label="部屋番号">
                  <Input
                    value={classData.room_number || ''}
                    onChange={(e: any) => setClassData({ ...classData, room_number: e.target.value })}
                    placeholder="例: 101"
                  />
                </FieldGroup>

                <FieldGroup label="カラーコード">
                  <Input
                    value={classData.color_code || ''}
                    onChange={(e: any) => setClassData({ ...classData, color_code: e.target.value })}
                    placeholder="例: #FF5733"
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
                    <div className="flex-1">
                      <FieldGroup label="職員を選択" required>
                        <Select
                          value={selectedTeacherId}
                          onChange={(e: any) => setSelectedTeacherId(e.target.value)}
                        >
                          <option value="">選択してください</option>
                          {availableTeachers.map(teacher => (
                            <option key={teacher.id} value={teacher.id}>
                              {teacher.name}
                            </option>
                          ))}
                        </Select>
                      </FieldGroup>
                    </div>
                    <div className="flex-1">
                      <FieldGroup label="役割" required>
                        <Select
                          value={selectedTeacherRole}
                          onChange={(e: any) => setSelectedTeacherRole(e.target.value)}
                        >
                          <option value="main">主担任</option>
                          <option value="sub">副担任</option>
                          <option value="assistant">補助</option>
                        </Select>
                      </FieldGroup>
                    </div>
                    <button
                      onClick={handleAddTeacher}
                      disabled={!selectedTeacherId}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus size={16} />
                      追加
                    </button>
                    <button
                      onClick={() => {
                        setShowAddTeacher(false);
                        setSelectedTeacherId('');
                        setSelectedTeacherRole('main');
                      }}
                      className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}

              {/* Teachers List */}
              <div className="space-y-3">
                {classData.staff.map((teacher) => (
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
                        <div className="flex gap-2 mt-1">
                          {teacher.class_role && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              teacher.class_role === 'main'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                : teacher.class_role === 'sub'
                                ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {teacher.class_role === 'main' ? '主担任' : teacher.class_role === 'sub' ? '副担任' : '補助'}
                            </span>
                          )}
                          {teacher.role && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              {teacher.role}
                            </span>
                          )}
                        </div>
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

                {classData.staff.length === 0 && (
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
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">在籍児童</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {classData.children.length}名 / 定員{classData.capacity}名
                </p>
              </div>
              <button
                onClick={() => setShowAddChildModal(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-sm transition-colors font-bold text-sm"
              >
                <Plus size={18} />
                児童を追加
              </button>
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
                    className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                      {child.age}歳
                    </div>
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => window.location.href = `/children/${child.id}`}
                    >
                      <p className="font-bold text-slate-800 text-sm">{child.name}</p>
                      <p className="text-xs text-slate-500">{child.name_kana}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveChild(child.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      title="除外"
                    >
                      <X size={16} />
                    </button>
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
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-8 rounded-lg shadow-md shadow-indigo-200 hover:shadow-lg transition-all text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
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

        {/* Add Child Modal */}
        {showAddChildModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <Users size={20} className="text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">児童を追加</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedChildIds.length > 0 ? `${selectedChildIds.length}名選択中` : 'チェックを入れて追加'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAddChildModal(false);
                    setSelectedChildIds([]);
                    setChildSearchTerm('');
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search and Filter Bar */}
              <div className="px-6 py-4 border-b border-slate-100 shrink-0 space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="名前・ふりがなで検索..."
                    className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                    value={childSearchTerm}
                    onChange={(e) => setChildSearchTerm(e.target.value)}
                  />
                </div>

                {/* Sort */}
                <div className="flex gap-3">
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1">
                    <ArrowUpDown size={16} className="text-slate-400 shrink-0" />
                    <select
                      className="bg-transparent border-none text-sm text-slate-700 focus:ring-0 cursor-pointer p-0 w-full"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'name' | 'grade')}
                    >
                      <option value="grade">年齢順</option>
                      <option value="name">名前順</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Modal Body - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-2">
                  {availableChildren.map((child) => (
                    <div
                      key={child.id}
                      onClick={() => handleToggleChild(child.id)}
                      className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedChildIds.includes(child.id)
                          ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        selectedChildIds.includes(child.id)
                          ? 'bg-indigo-600 border-indigo-600'
                          : 'bg-white border-slate-300'
                      }`}>
                        {selectedChildIds.includes(child.id) && (
                          <Check size={14} className="text-white" strokeWidth={3} />
                        )}
                      </div>

                      {/* Child Info */}
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                        {child.age}歳
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm">{child.name}</p>
                        <p className="text-xs text-slate-500">{child.name_kana}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-500">{child.enrollment_status || '未配属'}</p>
                      </div>
                    </div>
                  ))}

                  {availableChildren.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                      <Users size={48} className="mx-auto mb-3 opacity-50" />
                      <p>該当する児童が見つかりませんでした</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 rounded-b-xl shrink-0">
                <p className="text-sm text-slate-600">
                  {selectedChildIds.length > 0 ? (
                    <span className="font-bold text-indigo-600">{selectedChildIds.length}名</span>
                  ) : (
                    '児童を選択してください'
                  )}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowAddChildModal(false);
                      setSelectedChildIds([]);
                      setChildSearchTerm('');
                    }}
                    className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium text-sm transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleAddChildren}
                    disabled={selectedChildIds.length === 0}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={16} />
                    {selectedChildIds.length > 0 ? `${selectedChildIds.length}名を追加` : '追加'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </StaffLayout>
  );
}
