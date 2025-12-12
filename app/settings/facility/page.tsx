"use client"
import React, { useState, useEffect } from 'react';
import { StaffLayout } from "@/components/layout/staff-layout";
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  Mail,
  Users,
  ChevronRight,
  Search,
  MoreHorizontal
} from 'lucide-react';

interface Facility {
  facility_id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  class_count: number;
  children_count: number;
  staff_count: number;
  created_at: string;
  updated_at: string;
}

export default function FacilityListPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 施設一覧を取得
  useEffect(() => {
    fetchFacilities();
  }, []);

  const fetchFacilities = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = new URL('/api/facilities', window.location.origin);
      if (searchTerm) {
        url.searchParams.set('search', searchTerm);
      }

      const response = await fetch(url.toString());
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch facilities');
      }

      setFacilities(data.data.facilities);
    } catch (err) {
      console.error('Error fetching facilities:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // 検索実行
  const handleSearch = () => {
    fetchFacilities();
  };

  return (
    <StaffLayout title="施設管理">
      <div className="min-h-screen bg-gray-50 text-slate-900 font-sans">
        <style>
          {`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');`}
        </style>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ fontFamily: '"Noto Sans JP", sans-serif' }}>

          {/* Header Area */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="text-indigo-500" />
                施設管理
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {loading ? '読み込み中...' : `全 ${facilities.length} 施設を管理`}
              </p>
            </div>

            <button
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg shadow-sm transition-colors font-bold text-sm"
              onClick={() => window.location.href = '/settings/facility/new'}
            >
              <Plus size={18} />
              施設を追加
            </button>
          </div>

          {/* Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="施設名・住所で検索..."
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

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Facility Cards */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {facilities.map((facility) => (
                <div
                  key={facility.facility_id}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => window.location.href = `/settings/facility/${facility.facility_id}`}
                >
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="p-3 bg-indigo-50 rounded-lg shrink-0">
                          <Building2 size={24} className="text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h2 className="text-lg font-bold text-slate-800 mb-1 truncate">
                            {facility.name}
                          </h2>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <MapPin size={14} />
                            <span className="truncate">{facility.address}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0" />
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-2 mb-4 pl-[52px]">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone size={14} className="text-slate-400" />
                        <span>{facility.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Mail size={14} className="text-slate-400" />
                        <span className="truncate">{facility.email}</span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 pt-4 border-t border-slate-100 pl-[52px]">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                          <Users size={14} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">クラス</p>
                          <p className="text-sm font-bold text-slate-800">{facility.class_count}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                          <Users size={14} className="text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">児童数</p>
                          <p className="text-sm font-bold text-slate-800">{facility.children_count}名</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center">
                          <Users size={14} className="text-purple-600" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">職員数</p>
                          <p className="text-sm font-bold text-slate-800">{facility.staff_count}名</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && facilities.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 mb-4">
                {searchTerm ? '該当する施設が見つかりませんでした' : '施設が登録されていません'}
              </p>
              {searchTerm && (
                <button
                  className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                  onClick={() => {
                    setSearchTerm('');
                    fetchFacilities();
                  }}
                >
                  検索をクリア
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </StaffLayout>
  );
}
