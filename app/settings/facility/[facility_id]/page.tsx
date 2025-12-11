"use client"
import React, { useState, useEffect } from 'react';
import { StaffLayout } from "@/components/layout/staff-layout";
import { useParams } from 'next/navigation';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Save,
  Plus,
  X,
  Trash2,
  Users,
  ChevronLeft
} from 'lucide-react';

// Mock data
const mockFacility = {
  id: '1',
  name: 'ひまわり保育園 本園',
  address: '東京都渋谷区〇〇町1-2-3',
  phone: '03-1234-5678',
  email: 'honten@himawari.example.com',
  classes: [
    { id: '1', name: 'ひよこ組', capacity: 10, currentCount: 8 },
    { id: '2', name: 'りす組', capacity: 12, currentCount: 12 },
    { id: '3', name: 'うさぎ組', capacity: 15, currentCount: 13 }
  ]
};

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

export default function FacilityDetailPage() {
  const params = useParams();
  const [facility, setFacility] = useState(mockFacility);
  const [loading, setLoading] = useState(false);
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassCapacity, setNewClassCapacity] = useState('');

  const handleAddClass = () => {
    if (newClassName && newClassCapacity) {
      const newClass = {
        id: String(Date.now()),
        name: newClassName,
        capacity: parseInt(newClassCapacity),
        currentCount: 0
      };
      setFacility({
        ...facility,
        classes: [...facility.classes, newClass]
      });
      setNewClassName('');
      setNewClassCapacity('');
      setShowAddClass(false);
    }
  };

  const handleRemoveClass = (classId: string) => {
    if (confirm('このクラスを削除しますか？')) {
      setFacility({
        ...facility,
        classes: facility.classes.filter(c => c.id !== classId)
      });
    }
  };

  return (
    <StaffLayout title="施設詳細">
      <div className="min-h-screen bg-gray-50 text-slate-900 font-sans pb-24">
        <style>
          {`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');`}
        </style>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ fontFamily: '"Noto Sans JP", sans-serif' }}>

          {/* Back Button */}
          <button
            onClick={() => window.location.href = '/settings/facility'}
            className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 mb-6 transition-colors"
          >
            <ChevronLeft size={20} />
            <span className="text-sm font-medium">施設一覧に戻る</span>
          </button>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="text-indigo-500" />
                施設情報編集
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                施設の基本情報とクラスを管理
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
                <FieldGroup label="施設名" required>
                  <Input
                    icon={Building2}
                    value={facility.name}
                    onChange={(e: any) => setFacility({ ...facility, name: e.target.value })}
                  />
                </FieldGroup>

                <FieldGroup label="電話番号" required>
                  <Input
                    icon={Phone}
                    type="tel"
                    value={facility.phone}
                    onChange={(e: any) => setFacility({ ...facility, phone: e.target.value })}
                  />
                </FieldGroup>

                <FieldGroup label="住所" required>
                  <Input
                    icon={MapPin}
                    value={facility.address}
                    onChange={(e: any) => setFacility({ ...facility, address: e.target.value })}
                    className="sm:col-span-2"
                  />
                </FieldGroup>

                <FieldGroup label="メールアドレス">
                  <Input
                    icon={Mail}
                    type="email"
                    value={facility.email}
                    onChange={(e: any) => setFacility({ ...facility, email: e.target.value })}
                  />
                </FieldGroup>
              </div>
            </div>
          </section>

          {/* Classes Section */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">クラス管理</h2>
                <p className="text-sm text-slate-500 mt-1">この施設に所属するクラスを追加・削除</p>
              </div>
              <button
                onClick={() => setShowAddClass(!showAddClass)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-sm transition-colors font-bold text-sm"
              >
                <Plus size={18} />
                クラス追加
              </button>
            </div>

            <div className="p-6">
              {/* Add Class Form */}
              {showAddClass && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-end gap-3">
                    <FieldGroup label="クラス名" required>
                      <Input
                        placeholder="例: ひよこ組"
                        value={newClassName}
                        onChange={(e: any) => setNewClassName(e.target.value)}
                      />
                    </FieldGroup>
                    <FieldGroup label="定員" required>
                      <Input
                        type="number"
                        placeholder="10"
                        className="max-w-[100px]"
                        value={newClassCapacity}
                        onChange={(e: any) => setNewClassCapacity(e.target.value)}
                      />
                    </FieldGroup>
                    <button
                      onClick={handleAddClass}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
                    >
                      <Plus size={16} />
                      追加
                    </button>
                    <button
                      onClick={() => setShowAddClass(false)}
                      className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}

              {/* Classes List */}
              <div className="space-y-3">
                {facility.classes.map((cls) => (
                  <div
                    key={cls.id}
                    className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        <Users size={20} className="text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-800">{cls.name}</h3>
                        <p className="text-sm text-slate-500">
                          在籍 {cls.currentCount}名 / 定員 {cls.capacity}名
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Progress Bar */}
                      <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            cls.currentCount >= cls.capacity
                              ? 'bg-red-500'
                              : cls.currentCount / cls.capacity > 0.8
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min((cls.currentCount / cls.capacity) * 100, 100)}%` }}
                        />
                      </div>

                      <button
                        onClick={() => handleRemoveClass(cls.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="削除"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}

                {facility.classes.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <Users size={48} className="mx-auto mb-3 opacity-50" />
                    <p>クラスが登録されていません</p>
                    <p className="text-sm mt-1">「クラス追加」ボタンから追加してください</p>
                  </div>
                )}
              </div>
            </div>
          </section>

        </div>

        {/* Sticky Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 z-40">
          <div className="max-w-5xl mx-auto flex items-center justify-between px-4 sm:px-6">
            <button
              type="button"
              onClick={() => window.location.href = '/settings/facility'}
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
