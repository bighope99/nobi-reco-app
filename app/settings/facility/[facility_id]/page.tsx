"use client"
import React, { useState, useEffect } from 'react';
import { StaffLayout } from "@/components/layout/staff-layout";
import { useParams, useRouter } from 'next/navigation';
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
  ChevronLeft,
  UserCheck,
  ChevronRight
} from 'lucide-react';

interface Facility {
  facility_id: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
  postal_code?: string;
  fax?: string;
  website?: string;
  director_name?: string;
  capacity?: number;
  company_name?: string;
  current_children_count?: number;
  current_staff_count?: number;
  current_classes_count?: number;
}

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
  const router = useRouter();
  const facilityId = params.facility_id as string;

  const [facility, setFacility] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load facility data
  useEffect(() => {
    if (facilityId && facilityId !== 'new') {
      fetchFacility();
    } else if (facilityId === 'new') {
      // 新規作成モード
      setFacility({
        facility_id: 'new',
        name: '',
        address: '',
        phone: '',
        email: '',
      });
    }
  }, [facilityId]);

  const fetchFacility = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/facilities/${facilityId}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch facility');
      }

      setFacility(data.data);
    } catch (err) {
      console.error('Error fetching facility:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!facility) return;

    try {
      setSaving(true);
      setError(null);

      const isNew = facilityId === 'new';
      const url = isNew ? '/api/facilities' : `/api/facilities/${facilityId}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: facility.name,
          address: facility.address,
          phone: facility.phone,
          email: facility.email || null,
          postal_code: facility.postal_code || null,
          fax: facility.fax || null,
          website: facility.website || null,
          director_name: facility.director_name || null,
          capacity: facility.capacity || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save facility');
      }

      alert(data.message || '施設情報を保存しました');

      if (isNew) {
        // 新規作成の場合は一覧ページに戻る
        router.push('/settings/facility');
      } else {
        // 更新の場合はデータを再取得
        fetchFacility();
      }
    } catch (err) {
      console.error('Error saving facility:', err);
      setError(err instanceof Error ? err.message : 'Failed to save facility');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <StaffLayout title="施設詳細">
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
        </div>
      </StaffLayout>
    );
  }

  if (error && !facility) {
    return (
      <StaffLayout title="施設詳細">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </StaffLayout>
    );
  }

  if (!facility) {
    return (
      <StaffLayout title="施設詳細">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <p className="text-slate-500">施設情報を読み込んでいます...</p>
        </div>
      </StaffLayout>
    );
  }

  const isNewFacility = facilityId === 'new';

  return (
    <StaffLayout title={isNewFacility ? "施設新規作成" : "施設詳細"}>
      <div className="min-h-screen bg-gray-50 text-slate-900 font-sans pb-24">
        <style>
          {`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');`}
        </style>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ fontFamily: '"Noto Sans JP", sans-serif' }}>

          {/* Back Button */}
          <button
            onClick={() => router.push('/settings/facility')}
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
                {isNewFacility ? '施設新規作成' : '施設情報編集'}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {isNewFacility ? '新しい施設を登録します' : '施設の基本情報を編集'}
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              <p className="text-sm">{error}</p>
            </div>
          )}

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
                    placeholder="例: ひまわり保育園 本園"
                  />
                </FieldGroup>

                <FieldGroup label="施設長名">
                  <Input
                    value={facility.director_name || ''}
                    onChange={(e: any) => setFacility({ ...facility, director_name: e.target.value })}
                    placeholder="例: 山田 太郎"
                  />
                </FieldGroup>

                <FieldGroup label="郵便番号">
                  <Input
                    value={facility.postal_code || ''}
                    onChange={(e: any) => setFacility({ ...facility, postal_code: e.target.value })}
                    placeholder="150-0001"
                  />
                </FieldGroup>

                <FieldGroup label="定員">
                  <Input
                    type="number"
                    value={facility.capacity || ''}
                    onChange={(e: any) => setFacility({ ...facility, capacity: parseInt(e.target.value) || undefined })}
                    placeholder="120"
                  />
                </FieldGroup>
              </div>

              <FieldGroup label="住所" required>
                <Input
                  icon={MapPin}
                  value={facility.address}
                  onChange={(e: any) => setFacility({ ...facility, address: e.target.value })}
                  placeholder="東京都渋谷区〇〇町1-2-3"
                />
              </FieldGroup>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FieldGroup label="電話番号" required>
                  <Input
                    icon={Phone}
                    type="tel"
                    value={facility.phone}
                    onChange={(e: any) => setFacility({ ...facility, phone: e.target.value })}
                    placeholder="03-1234-5678"
                  />
                </FieldGroup>

                <FieldGroup label="FAX番号">
                  <Input
                    type="tel"
                    value={facility.fax || ''}
                    onChange={(e: any) => setFacility({ ...facility, fax: e.target.value })}
                    placeholder="03-1234-5679"
                  />
                </FieldGroup>

                <FieldGroup label="メールアドレス">
                  <Input
                    icon={Mail}
                    type="email"
                    value={facility.email || ''}
                    onChange={(e: any) => setFacility({ ...facility, email: e.target.value })}
                    placeholder="info@example.com"
                  />
                </FieldGroup>

                <FieldGroup label="ウェブサイト">
                  <Input
                    type="url"
                    value={facility.website || ''}
                    onChange={(e: any) => setFacility({ ...facility, website: e.target.value })}
                    placeholder="https://example.com"
                  />
                </FieldGroup>
              </div>
            </div>
          </section>

          {/* Statistics (only for existing facilities) */}
          {!isNewFacility && facility.current_children_count !== undefined && (
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
              <div className="px-6 py-5 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-800">統計情報</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-indigo-50 rounded-lg">
                    <p className="text-sm text-slate-600 mb-1">在籍児童数</p>
                    <p className="text-2xl font-bold text-indigo-600">{facility.current_children_count}名</p>
                  </div>
                  <div className="text-center p-4 bg-emerald-50 rounded-lg">
                    <p className="text-sm text-slate-600 mb-1">クラス数</p>
                    <p className="text-2xl font-bold text-emerald-600">{facility.current_classes_count}クラス</p>
                  </div>
                  <div className="text-center p-4 bg-amber-50 rounded-lg">
                    <p className="text-sm text-slate-600 mb-1">職員数</p>
                    <p className="text-2xl font-bold text-amber-600">{facility.current_staff_count}名</p>
                  </div>
                </div>
              </div>
            </section>
          )}

        </div>

        {/* Sticky Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 z-40">
          <div className="max-w-5xl mx-auto flex items-center justify-between px-4 sm:px-6">
            <button
              type="button"
              onClick={() => router.push('/settings/facility')}
              className="text-slate-500 hover:text-slate-800 font-medium text-sm px-4 py-2 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !facility.name || !facility.address || !facility.phone}
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
                  {isNewFacility ? '施設を作成' : '変更を保存'}
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </StaffLayout>
  );
}
