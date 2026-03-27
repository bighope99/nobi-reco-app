"use client"
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { StaffLayout } from "@/components/layout/staff-layout";
import {
  Search,
  Plus,
  Phone,
  ChevronRight,
  User,
  Loader2,
} from 'lucide-react';

interface LinkedChild {
  id: string;
  name: string;
  relationship: string | null;
}

interface Guardian {
  id: string;
  name: string;
  kana: string;
  phone?: string;
  relationship: string | null;
  photo_url: string | null;
  linked_children: LinkedChild[];
  notes: string;
  updated_at: string;
}

export default function GuardianListPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 検索語のデバウンス
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const fetchGuardians = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      const res = await fetch(`/api/guardians?${params.toString()}`);
      if (!res.ok) throw new Error('取得に失敗しました');
      const json = await res.json();
      setGuardians(json.data ?? []);
      setTotalCount(json.data?.length ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保護者情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGuardians(debouncedSearch);
  }, [debouncedSearch, fetchGuardians]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <StaffLayout title="保護者管理">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <p className="text-sm text-slate-500">
            {loading ? '読み込み中...' : `全 ${totalCount} 名の保護者情報を管理`}
          </p>
          <button
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg shadow-sm transition-colors font-bold text-sm"
            onClick={() => router.push('/guardians/new')}
          >
            <Plus size={18} />
            新規登録
          </button>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6">
          <div className="relative max-w-sm">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="氏名で検索..."
              className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-slate-400">
              <Loader2 size={24} className="animate-spin mr-2" />
              読み込み中...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16 text-center">
                      写真
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-48">
                      氏名
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">
                      続柄
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-44">
                      電話番号
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      紐づいている子ども
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">
                      最終更新日
                    </th>
                    <th className="px-6 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {guardians.map(guardian => (
                    <tr
                      key={guardian.id}
                      className="group hover:bg-indigo-50/30 transition-colors cursor-pointer"
                      onClick={() => router.push(`/guardians/${guardian.id}`)}
                    >
                      {/* Photo */}
                      <td className="px-6 py-4 text-center">
                        {guardian.photo_url ? (
                          <img
                            src={guardian.photo_url}
                            alt={guardian.name}
                            className="w-10 h-10 rounded-full object-cover mx-auto border border-slate-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto border border-slate-200">
                            <User size={18} className="text-slate-400" />
                          </div>
                        )}
                      </td>

                      {/* Name */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{guardian.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{guardian.kana}</div>
                        {guardian.notes && (
                          <div className="text-xs text-amber-600 mt-0.5 truncate max-w-[180px]" title={guardian.notes}>
                            メモ: {guardian.notes}
                          </div>
                        )}
                      </td>

                      {/* Relationship */}
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-700">{guardian.relationship ?? '—'}</span>
                      </td>

                      {/* Phone */}
                      <td className="px-6 py-4">
                        {guardian.phone ? (
                          <div className="flex items-center gap-2">
                            <button
                              className="p-1.5 rounded-full bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors border border-slate-100 shrink-0"
                              title="電話をかける"
                              onClick={e => { e.stopPropagation(); window.open(`tel:${guardian.phone}`, '_self'); }}
                            >
                              <Phone size={14} />
                            </button>
                            <span className="text-sm font-mono text-slate-700">{guardian.phone}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>

                      {/* Linked Children */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {guardian.linked_children.length > 0 ? guardian.linked_children.map(child => (
                            <span
                              key={child.id}
                              className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-xs font-medium"
                            >
                              {child.name}
                            </span>
                          )) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </td>

                      {/* Updated At */}
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-500">{formatDate(guardian.updated_at)}</span>
                      </td>

                      {/* Arrow */}
                      <td className="px-4 py-4 text-right">
                        <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {guardians.length === 0 && !loading && (
                <div className="p-12 text-center text-slate-400">
                  <User size={32} className="mx-auto mb-3 text-slate-300" />
                  <p>該当する保護者は見つかりませんでした</p>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </StaffLayout>
  );
}
