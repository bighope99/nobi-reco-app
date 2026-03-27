"use client"
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeSearch } from '@/lib/utils/kana';
import { useRole } from '@/hooks/useRole';
import { StaffLayout } from "@/components/layout/staff-layout";
import {
  Users,
  Plus,
  Search,
  Shield,
  Mail,
  Phone,
  X,
  Save,
  Trash2,
  ChevronRight,
  Edit2,
  Calendar,
  SendHorizontal
} from 'lucide-react';

interface User {
  user_id: string;
  email: string | null;
  name: string;
  name_kana?: string;
  phone?: string;
  role: string;
  hire_date?: string;
  password_set?: boolean;
  is_active: boolean;
  assigned_classes?: Array<{
    class_id: string;
    class_name: string;
    is_main: boolean;
  }>;
}

const roleOptions = [
  { value: 'facility_admin', label: '施設管理者', color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'staff', label: '職員', color: 'bg-blue-50 text-blue-700 border-blue-200' },
];

const Input = ({ icon: Icon, className = "", ...props }: any) => (
  <div className="relative group">
    {Icon && (
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:indigo-500 transition-colors">
        <Icon size={16} />
      </div>
    )}
    <input
      className={`w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 transition-all placeholder:text-slate-400 ${Icon ? 'pl-10' : ''} ${className}`}
      {...props}
    />
  </div>
);

const Select = ({ children, className = "", ...props }: any) => (
  <div className="relative">
    <select
      className={`w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 pr-8 appearance-none cursor-pointer transition-shadow ${className}`}
      {...props}
    >
      {children}
    </select>
    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
      <ChevronRight size={16} className="rotate-90" />
    </div>
  </div>
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

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export default function UsersSettingsPage() {
  const { isStaff, isFacilityAdmin } = useRole();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', role: 'staff', hire_year: '', hire_month: '', hire_day: '' });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resendingUserId, setResendingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New user form
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'staff',
    hire_year: '',
    hire_month: '',
    hire_day: '',
  });

  // 初期ロード
  useEffect(() => {
    fetchUsers();
  }, []);

  // ユーザー一覧を取得
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = new URL('/api/users', window.location.origin);
      if (searchTerm) {
        url.searchParams.set('search', searchTerm);
      }

      const response = await fetch(url.toString());
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch users');
      }

      setUsers(data.data.users);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // 検索実行
  const handleSearch = () => {
    fetchUsers();
  };

  const filteredUsers = (() => {
    const normalize = (s: string) => normalizeSearch(s)
    const normalizedTerm = normalize(searchTerm).trim()
    if (!normalizedTerm) return users
    return users.filter(user =>
      normalize(user.name).includes(normalizedTerm) ||
      (user.name_kana && normalize(user.name_kana).includes(normalizedTerm)) ||
      (user.email && user.email.toLowerCase().includes(normalizedTerm)) ||
      (user.phone && user.phone.includes(normalizedTerm))
    )
  })();

  const isEmailRequired = newUser.role !== 'staff';
  const newUserHireDateComplete = !!(newUser.hire_year && newUser.hire_month && newUser.hire_day);
  const newUserHireDate = newUserHireDateComplete
    ? `${newUser.hire_year}-${newUser.hire_month.padStart(2, '0')}-${newUser.hire_day.padStart(2, '0')}`
    : '';

  const handleAddUser = async () => {
    const normalizedName = newUser.name.trim();
    const normalizedEmail = newUser.email.trim();
    const normalizedPhone = (newUser.phone || '').trim() || null;
    if (!normalizedName || (isEmailRequired && !normalizedEmail) || !newUserHireDate) return;
    if (submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: normalizedName,
          email: normalizedEmail || null,
          phone: normalizedPhone,
          role: newUser.role,
          hire_date: newUserHireDate,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create user');
      }

      alert(data.message || '職員を追加しました。');
      setNewUser({ name: '', email: '', phone: '', role: 'staff', hire_year: '', hire_month: '', hire_day: '' });
      setShowAddModal(false);
      fetchUsers();
    } catch (err) {
      console.error('Error creating user:', err);
      alert(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditStart = (user: User) => {
    setEditingUser(user);
    const hireDate = user.hire_date || '';
    const [hireYear = '', hireMonth = '', hireDay = ''] = hireDate ? hireDate.split('-') : [];
    setEditForm({
      name: user.name,
      email: user.email || '',
      phone: user.phone || '',
      role: user.role,
      hire_year: hireYear,
      hire_month: hireMonth ? String(Number(hireMonth)) : '',
      hire_day: hireDay ? String(Number(hireDay)) : '',
    });
    setShowEditModal(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    const editHireDateComplete = !!(editForm.hire_year && editForm.hire_month && editForm.hire_day);
    const editHireDate = editHireDateComplete
      ? `${editForm.hire_year}-${editForm.hire_month.padStart(2, '0')}-${editForm.hire_day.padStart(2, '0')}`
      : '';
    setSubmitting(true);
    try {
      const response = await fetch(`/api/users/${editingUser.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email.trim() || null,
          phone: editForm.phone.trim() || null,
          role: editForm.role,
          hire_date: editHireDate || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to update user');
      alert(data.message || '職員情報を更新しました。');
      setShowEditModal(false);
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update user role');
      }

      // ローカル状態を更新
      setUsers(users.map(user =>
        user.user_id === userId ? { ...user, role: newRole } : user
      ));
    } catch (err) {
      console.error('Error updating user role:', err);
      alert(err instanceof Error ? err.message : 'Failed to update user role');
      // エラー時は元の状態に戻すため再取得
      fetchUsers();
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('このユーザーを削除しますか？')) return;

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete user');
      }

      // ローカル状態を更新
      setUsers(users.filter(u => u.user_id !== userId));
    } catch (err) {
      console.error('Error deleting user:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleResendInvitation = async (userId: string) => {
    if (!confirm('認証メールを再送信しますか？')) return;
    setResendingUserId(userId);
    try {
      const response = await fetch(`/api/users/${userId}/resend-invitation`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to resend invitation');
      }
      alert(data.message || '認証メールを再送信しました');
    } catch (err) {
      console.error('Error resending invitation:', err);
      alert(err instanceof Error ? err.message : '認証メールの再送信に失敗しました');
    } finally {
      setResendingUserId(null);
    }
  };

  const getRoleBadge = (role: string) => {
    const option = roleOptions.find(opt => opt.value === role);
    return option ? (
      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${option.color}`}>
        {option.label}
      </span>
    ) : (
      <span className="px-3 py-1 rounded-full text-xs font-bold border bg-gray-50 text-gray-700 border-gray-200">
        {role}
      </span>
    );
  };

  useEffect(() => {
    if (isStaff) router.replace('/dashboard');
  }, [isStaff, router]);

  if (isStaff) return null

  return (
    <StaffLayout title="職員管理">
      <div className="min-h-screen text-slate-900 font-sans">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-sm text-slate-500 mt-1">
                {loading ? '読み込み中...' : `全 ${users.length} 名の職員を管理`}
              </p>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg shadow-sm transition-colors font-bold text-sm"
            >
              <Plus size={18} />
              職員を追加
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="名前・メール・電話番号で検索..."
                  className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors"
              >
                検索
              </button>
            </div>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <>
              {/* Users Table */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          職員名
                        </th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          メールアドレス
                        </th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          電話番号
                        </th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          入社年月日
                        </th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          権限
                        </th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredUsers.map((user) => (
                        <tr
                          key={user.user_id}
                          className="hover:bg-indigo-50/30 transition-colors"
                        >
                          {/* Name */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="font-bold text-slate-800">{user.name}</p>
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="px-6 py-4">
                            {user.email ? (
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Mail size={14} className="text-slate-400" />
                                <span>{user.email}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">ログインなし</span>
                            )}
                          </td>

                          {/* Phone */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Phone size={14} className="text-slate-400" />
                              <span>{user.phone || '-'}</span>
                            </div>
                          </td>

                          {/* Hire Date */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Calendar size={14} className="text-slate-400" />
                              <span>{user.hire_date || '-'}</span>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="px-6 py-4">
                            {isFacilityAdmin ? (
                              <Select
                                value={user.role}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleUpdateUserRole(user.user_id, e.target.value)}
                                className="max-w-[140px] text-xs"
                              >
                                {roleOptions.map(option => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </Select>
                            ) : (
                              getRoleBadge(user.role)
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              {isFacilityAdmin && (
                                <button
                                  onClick={() => handleEditStart(user)}
                                  className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                                  title="編集"
                                >
                                  <Edit2 size={18} />
                                </button>
                              )}
                              {isFacilityAdmin && user.email && !user.password_set && (
                                <button
                                  onClick={() => handleResendInvitation(user.user_id)}
                                  disabled={resendingUserId === user.user_id}
                                  className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                                  title="認証メール再送"
                                >
                                  {resendingUserId === user.user_id ? (
                                    <div className="animate-spin w-[18px] h-[18px] border-2 border-emerald-500 border-t-transparent rounded-full" />
                                  ) : (
                                    <SendHorizontal size={18} />
                                  )}
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteUser(user.user_id)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="削除"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredUsers.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                      <p>該当する職員が見つかりませんでした</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

        </div>

        {/* Add User Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <Users size={20} className="text-indigo-600" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800">新規職員追加</h2>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                <FieldGroup label="氏名" required>
                  <Input
                    placeholder="例: 田中太郎"
                    value={newUser.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUser({ ...newUser, name: e.target.value })}
                  />
                </FieldGroup>

                <FieldGroup label="メールアドレス" required={isEmailRequired}>
                  <Input
                    icon={Mail}
                    type="email"
                    placeholder="example@email.com"
                    value={newUser.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                  {!isEmailRequired && (
                    <p className="text-xs text-slate-500 mt-1">
                      メールアドレスを入力しない場合、個別ログインアカウントは作成されません
                    </p>
                  )}
                </FieldGroup>

                <FieldGroup label="電話番号">
                  <Input
                    icon={Phone}
                    type="tel"
                    placeholder="090-1234-5678"
                    value={newUser.phone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUser({ ...newUser, phone: e.target.value })}
                  />
                </FieldGroup>

                <FieldGroup label="入社年月日" required>
                  <div className="flex gap-2">
                    <Select
                      value={newUser.hire_year}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewUser({ ...newUser, hire_year: e.target.value })}
                      className="flex-1"
                    >
                      <option value="">年</option>
                      {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i).map(year => (
                        <option key={year} value={String(year)}>
                          {year}年
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={newUser.hire_month}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewUser({ ...newUser, hire_month: e.target.value })}
                      className="flex-1"
                    >
                      <option value="">月</option>
                      {MONTHS.map(month => (
                        <option key={month} value={String(month)}>
                          {month}月
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={newUser.hire_day}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewUser({ ...newUser, hire_day: e.target.value })}
                      className="flex-1"
                    >
                      <option value="">日</option>
                      {DAYS.map(day => (
                        <option key={day} value={String(day)}>
                          {day}日
                        </option>
                      ))}
                    </Select>
                  </div>
                </FieldGroup>

                <FieldGroup label="権限" required>
                  <Select
                    value={newUser.role}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewUser({ ...newUser, role: e.target.value })}
                  >
                    {roleOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">
                    施設管理者は全ての機能にアクセスできます
                  </p>
                </FieldGroup>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 rounded-b-xl">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium text-sm transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddUser}
                  disabled={submitting || !newUser.name.trim() || (isEmailRequired && !newUser.email.trim()) || !newUserHireDate}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Plus size={16} />
                  )}
                  {submitting ? '追加中...' : '追加する'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditModal && editingUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <Edit2 size={20} className="text-indigo-600" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800">職員情報を編集</h2>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                <FieldGroup label="氏名" required>
                  <Input
                    placeholder="例: 田中太郎"
                    value={editForm.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </FieldGroup>

                <FieldGroup label="メールアドレス">
                  <Input
                    icon={Mail}
                    type="email"
                    placeholder="example@email.com"
                    value={editForm.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    メールアドレスを入力すると招待メールが送信されログインアカウントが作成されます（既にアカウントがある場合は更新のみ）
                  </p>
                </FieldGroup>

                <FieldGroup label="電話番号">
                  <Input
                    icon={Phone}
                    type="tel"
                    placeholder="090-1234-5678"
                    value={editForm.phone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </FieldGroup>

                <FieldGroup label="入社年月日" required>
                  <div className="flex gap-2">
                    <Select
                      value={editForm.hire_year}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditForm({ ...editForm, hire_year: e.target.value })}
                      className="flex-1"
                    >
                      <option value="">年</option>
                      {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i).map(year => (
                        <option key={year} value={String(year)}>
                          {year}年
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={editForm.hire_month}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditForm({ ...editForm, hire_month: e.target.value })}
                      className="flex-1"
                    >
                      <option value="">月</option>
                      {MONTHS.map(month => (
                        <option key={month} value={String(month)}>
                          {month}月
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={editForm.hire_day}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditForm({ ...editForm, hire_day: e.target.value })}
                      className="flex-1"
                    >
                      <option value="">日</option>
                      {DAYS.map(day => (
                        <option key={day} value={String(day)}>
                          {day}日
                        </option>
                      ))}
                    </Select>
                  </div>
                </FieldGroup>

                <FieldGroup label="権限" required>
                  <Select
                    value={editForm.role}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditForm({ ...editForm, role: e.target.value })}
                  >
                    {roleOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">
                    施設管理者は全ての機能にアクセスできます
                  </p>
                </FieldGroup>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 rounded-b-xl">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium text-sm transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveUser}
                  disabled={submitting || !editForm.name.trim() || !(editForm.hire_year && editForm.hire_month && editForm.hire_day)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Save size={16} />
                  )}
                  {submitting ? '保存中...' : '保存する'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </StaffLayout>
  );
}
