"use client"
import React, { useState } from 'react';
import { StaffLayout } from "@/components/layout/staff-layout";
import {
  Users,
  Search,
  Building2,
  ChevronRight,
  UserCheck,
  Filter
} from 'lucide-react';

// Mock data
const mockClasses = [
  {
    id: '1',
    name: 'ひよこ組',
    facility: 'ひまわり保育園 本園',
    facilityId: '1',
    childrenCount: 8,
    capacity: 10,
    teachers: ['田中先生', '佐藤先生'],
    ageRange: '0-1歳'
  },
  {
    id: '2',
    name: 'りす組',
    facility: 'ひまわり保育園 本園',
    facilityId: '1',
    childrenCount: 12,
    capacity: 12,
    teachers: ['山田先生'],
    ageRange: '2-3歳'
  },
  {
    id: '3',
    name: 'うさぎ組',
    facility: 'ひまわり保育園 本園',
    facilityId: '1',
    childrenCount: 13,
    capacity: 15,
    teachers: ['鈴木先生', '高橋先生'],
    ageRange: '4-5歳'
  },
  {
    id: '4',
    name: 'ぱんだ組',
    facility: 'ひまわり保育園 分園',
    facilityId: '2',
    childrenCount: 10,
    capacity: 12,
    teachers: ['伊藤先生'],
    ageRange: '3-4歳'
  }
];

const mockFacilities = [
  { id: '1', name: 'ひまわり保育園 本園' },
  { id: '2', name: 'ひまわり保育園 分園' }
];

export default function ClassesListPage() {
  const [classes, setClasses] = useState(mockClasses);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFacility, setFilterFacility] = useState('all');
  const [loading, setLoading] = useState(false);

  const filteredClasses = classes.filter(cls => {
    const matchSearch = cls.name.includes(searchTerm) ||
                       cls.teachers.some(t => t.includes(searchTerm));
    const matchFacility = filterFacility === 'all' || cls.facilityId === filterFacility;
    return matchSearch && matchFacility;
  });

  return (
    <StaffLayout title="クラス管理">
      <div className="min-h-screen bg-gray-50 text-slate-900 font-sans">
        <style>
          {`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');`}
        </style>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ fontFamily: '"Noto Sans JP", sans-serif' }}>

          {/* Header Area */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Users className="text-indigo-500" />
                クラス管理
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {loading ? '読み込み中...' : `全 ${classes.length} クラスを管理`}
              </p>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="クラス名・担任名で検索..."
                  className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Facility Filter */}
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-full sm:w-auto">
                <Filter size={16} className="text-slate-400" />
                <select
                  className="bg-transparent border-none text-sm text-slate-700 focus:ring-0 cursor-pointer p-0 min-w-[180px]"
                  value={filterFacility}
                  onChange={(e) => setFilterFacility(e.target.value)}
                >
                  <option value="all">全施設</option>
                  {mockFacilities.map(facility => (
                    <option key={facility.id} value={facility.id}>
                      {facility.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Classes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClasses.map((cls) => (
              <div
                key={cls.id}
                className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
                onClick={() => window.location.href = `/settings/classes/${cls.id}`}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-3 bg-indigo-50 rounded-lg shrink-0">
                        <Users size={24} className="text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-slate-800 mb-1">
                          {cls.name}
                        </h2>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Building2 size={12} />
                          <span className="truncate">{cls.facility}</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0" />
                  </div>

                  {/* Age Range Badge */}
                  <div className="mb-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                      {cls.ageRange}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="space-y-3 mb-4">
                    {/* Children Count with Progress */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600 font-medium">在籍児童</span>
                        <span className="font-bold text-slate-800">
                          {cls.childrenCount} / {cls.capacity}名
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            cls.childrenCount >= cls.capacity
                              ? 'bg-red-500'
                              : cls.childrenCount / cls.capacity > 0.8
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min((cls.childrenCount / cls.capacity) * 100, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Teachers */}
                    <div className="pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-2 text-sm mb-2">
                        <UserCheck size={14} className="text-slate-400" />
                        <span className="text-slate-600 font-medium">担任</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {cls.teachers.map((teacher, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700"
                          >
                            {teacher}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {filteredClasses.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <Users size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 mb-4">該当するクラスが見つかりませんでした</p>
              <button
                className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                onClick={() => {
                  setSearchTerm('');
                  setFilterFacility('all');
                }}
              >
                フィルタをクリア
              </button>
            </div>
          )}
        </div>
      </div>
    </StaffLayout>
  );
}
