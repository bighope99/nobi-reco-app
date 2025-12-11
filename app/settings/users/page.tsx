"use client"
import React, { useState } from 'react';
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
  ChevronRight
} from 'lucide-react';

// Mock data
const mockUsers = [
  {
    id: '1',
    name: '田中太郎',
    email: 'tanaka@example.com',
    phone: '090-1234-5678',
    role: 'admin',
    status: 'active'
  },
  {
    id: '2',
    name: '佐藤花子',
    email: 'sato@example.com',
    phone: '090-2345-6789',
    role: 'staff',
    status: 'active'
  },
  {
    id: '3',
    name: '鈴木次郎',
    email: 'suzuki@example.com',
    phone: '090-3456-7890',
    role: 'staff',
    status: 'active'
  }
];

const roleOptions = [
  { value: 'admin', label: '管理者', color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'staff', label: '職員', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'viewer', label: '閲覧者', color: 'bg-slate-50 text-slate-700 border-slate-200' }
];

const Input = ({ icon: Icon, className = "", ...props }: any) => (
  <div className="relative group">
    {Icon && (
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
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

export default function UsersSettingsPage() {
  const [users, setUsers] = useState(mockUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // New user form
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'staff'
  });

  const filteredUsers = users.filter(user =>
    user.name.includes(searchTerm) ||
    user.email.includes(searchTerm) ||
    user.phone.includes(searchTerm)
  );

  const handleAddUser = () => {
    if (newUser.name && newUser.email) {
      const user = {
        id: String(Date.now()),
        ...newUser,
        status: 'active'
      };
      setUsers([...users, user]);
      setNewUser({ name: '', email: '', phone: '', role: 'staff' });
      setShowAddModal(false);
    }
  };

  const handleUpdateUserRole = (userId: string, newRole: string) => {
    setUsers(users.map(user =>
      user.id === userId ? { ...user, role: newRole } : user
    ));
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm('このユーザーを削除しますか？')) {
      setUsers(users.filter(u => u.id !== userId));
    }
  };

  const getRoleBadge = (role: string) => {
    const option = roleOptions.find(opt => opt.value === role);
    return option ? (
      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${option.color}`}>
        {option.label}
      </span>
    ) : null;
  };

  return (
    <StaffLayout title="職員管理">
      <div className="min-h-screen bg-gray-50 text-slate-900 font-sans">
        <style>
          {`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');`}
        </style>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ fontFamily: '"Noto Sans JP", sans-serif' }}>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Users className="text-indigo-500" />
                職員管理
              </h1>
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

          {/* Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="名前・メール・電話番号で検索..."
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

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
                      key={user.id}
                      className="group hover:bg-indigo-50/30 transition-colors"
                    >
                      {/* Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{user.name}</p>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Mail size={14} className="text-slate-400" />
                          <span>{user.email}</span>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Phone size={14} className="text-slate-400" />
                          <span>{user.phone}</span>
                        </div>
                      </td>

                      {/* Role (Editable) */}
                      <td className="px-6 py-4">
                        <Select
                          value={user.role}
                          onChange={(e: any) => handleUpdateUserRole(user.id, e.target.value)}
                          className="max-w-[140px] text-xs"
                        >
                          {roleOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="削除"
                        >
                          <Trash2 size={18} />
                        </button>
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
                    onChange={(e: any) => setNewUser({ ...newUser, name: e.target.value })}
                  />
                </FieldGroup>

                <FieldGroup label="メールアドレス" required>
                  <Input
                    icon={Mail}
                    type="email"
                    placeholder="example@email.com"
                    value={newUser.email}
                    onChange={(e: any) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </FieldGroup>

                <FieldGroup label="電話番号">
                  <Input
                    icon={Phone}
                    type="tel"
                    placeholder="090-1234-5678"
                    value={newUser.phone}
                    onChange={(e: any) => setNewUser({ ...newUser, phone: e.target.value })}
                  />
                </FieldGroup>

                <FieldGroup label="権限" required>
                  <Select
                    value={newUser.role}
                    onChange={(e: any) => setNewUser({ ...newUser, role: e.target.value })}
                  >
                    {roleOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">
                    管理者は全ての機能にアクセスできます
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
                  disabled={!newUser.name || !newUser.email}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={16} />
                  追加する
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </StaffLayout>
  );
}
