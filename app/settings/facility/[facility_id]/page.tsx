"use client"
import React, { useState, useEffect } from 'react';
import { StaffLayout } from "@/components/layout/staff-layout";
import { useSession } from '@/hooks/useSession';
import { useRole } from '@/hooks/useRole';
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
  ChevronRight,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input as ShadcnInput } from '@/components/ui/input';
import {
  FacilityRegistrationForm,
  type FacilityRegistrationData,
} from '@/components/admin/facility-registration-form';

interface Facility {
  facility_id: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
  postal_code?: string;
  company_name?: string;
  current_children_count?: number;
  current_staff_count?: number;
  current_classes_count?: number;
}

interface Account {
  user_id: string;
  name: string;
  email: string | null;
  is_active: boolean;
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

function NewFacilityPage() {
  const router = useRouter();
  const session = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [createdFacilityName, setCreatedFacilityName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: FacilityRegistrationData) => {
    if (!session || !session.company_id) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/companies/${session.company_id}/facilities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility: {
            name: data.facility.name.trim(),
            name_kana: data.facility.name_kana.trim() || undefined,
            postal_code: data.facility.postal_code.trim() || undefined,
            address: data.facility.address.trim() || undefined,
            phone: data.facility.phone.trim() || undefined,
            capacity: data.facility.capacity.trim() || undefined,
          },
          facility_admin: {
            name: data.facilityAdmin.name.trim(),
            name_kana: data.facilityAdmin.name_kana.trim() || undefined,
            email: data.facilityAdmin.email.trim(),
          },
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '施設の登録に失敗しました');
      }
      setCreatedFacilityName(result.data.facility_name);
      setCompleted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '施設の登録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!session) {
    return (
      <StaffLayout title="施設登録">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <p className="text-slate-500">セッション情報を読み込んでいます...</p>
        </div>
      </StaffLayout>
    );
  }

  if (completed) {
    return (
      <StaffLayout title="施設登録完了">
        <div className="mx-auto max-w-lg">
          <Card>
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-green-50 rounded-full">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
              </div>
              <CardTitle className="text-xl">施設登録が完了しました</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {createdFacilityName && (
                <div className="text-center">
                  <p className="text-lg font-semibold text-slate-800">{createdFacilityName}</p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                <p>施設管理者に招待メールを送信しました。</p>
              </div>

              <div className="border-t pt-6 space-y-3">
                <Button
                  className="w-full"
                  onClick={() => {
                    setCompleted(false);
                    setCreatedFacilityName('');
                  }}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  別の施設を登録する
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/settings/facility')}
                >
                  施設一覧に戻る
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </StaffLayout>
    );
  }

  return (
    <StaffLayout title="施設登録" subtitle="新しい施設と施設管理者を登録">
      <div className="mx-auto max-w-2xl">
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}
        <FacilityRegistrationForm
          onSubmit={handleSubmit}
          onCancel={() => router.push('/settings/facility')}
          isSubmitting={isSubmitting}
        />
      </div>
    </StaffLayout>
  );
}

export default function FacilityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const facilityId = params.facility_id as string;

  // useRole() が返すフラグの意味:
  //   isAdmin        : site_admin または company_admin
  //   isFacilityAdmin: facility_admin（施設ごとの管理者）
  //   isStaff        : staff（一般職員）
  //   hasRole(...)   : 指定したロールのいずれかに一致するか判定
  const { hasRole } = useRole();
  // 施設管理者の追加は company_admin のみ可能
  const canAddFacilityAdmin = hasRole('company_admin');

  const [facility, setFacility] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', name_kana: '', email: '' });
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

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

  const fetchAccounts = async () => {
    try {
      const response = await fetch(
        `/api/users?role=facility_admin&facility_id=${facilityId}`
      );
      const data = await response.json();
      if (response.ok && data.success) {
        setAccounts(data.data.users || []);
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  };

  const handleAddAccount = async () => {
    if (!addForm.name.trim() || !addForm.email.trim()) return;
    setAddLoading(true);
    setAddError(null);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name,
          name_kana: addForm.name_kana || undefined,
          email: addForm.email,
          role: 'facility_admin',
          facility_id: facilityId,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || '管理者の追加に失敗しました');
      }
      setShowAddDialog(false);
      setAddForm({ name: '', name_kana: '', email: '' });
      alert('招待メールを送信しました');
      fetchAccounts();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : '管理者の追加に失敗しました');
    } finally {
      setAddLoading(false);
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

  // Load facility data
  useEffect(() => {
    if (facilityId && facilityId !== 'new') {
      fetchFacility();
      fetchAccounts();
    }
  }, [facilityId]);

  if (facilityId === 'new') {
    return <NewFacilityPage />;
  }

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

  return (
    <StaffLayout title="施設詳細">
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
                施設情報編集
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                施設の基本情報を編集
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

                <FieldGroup label="郵便番号">
                  <Input
                    value={facility.postal_code || ''}
                    onChange={(e: any) => setFacility({ ...facility, postal_code: e.target.value })}
                    placeholder="150-0001"
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

                <FieldGroup label="メールアドレス">
                  <Input
                    icon={Mail}
                    type="email"
                    value={facility.email || ''}
                    onChange={(e: any) => setFacility({ ...facility, email: e.target.value })}
                    placeholder="info@example.com"
                  />
                </FieldGroup>
              </div>
            </div>
          </section>

          {/* Statistics (only for existing facilities) */}
          {facility.current_children_count !== undefined && (
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

          {/* Facility Admins Section */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
              <Users size={18} className="text-indigo-500" />
              <h2 className="text-lg font-bold text-slate-800">施設管理者</h2>
              <Badge variant="outline" className="ml-1">{accounts.length}名</Badge>
              {canAddFacilityAdmin && (
                <div className="ml-auto">
                  <Button size="sm" onClick={() => setShowAddDialog(true)}>
                    <Plus size={16} className="mr-1" />
                    管理者を追加
                  </Button>
                </div>
              )}
            </div>
            <div className="p-0">
              {accounts.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  登録された施設管理者はありません
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">氏名</th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">メールアドレス</th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">ステータス</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {accounts.map((account) => (
                        <tr key={account.user_id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-medium text-slate-900">{account.name}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-slate-600">{account.email || '-'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={account.is_active ? 'default' : 'destructive'}>
                              {account.is_active ? '有効' : '無効'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Add Admin Dialog - company_admin のみ表示 */}
          {canAddFacilityAdmin && <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>施設管理者を追加</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {addError && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                    {addError}
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="add-name">
                    氏名
                    <span className="ml-2 text-[10px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded font-bold">必須</span>
                  </Label>
                  <ShadcnInput
                    id="add-name"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder="例: 山田 太郎"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="add-name-kana">氏名（カナ）</Label>
                  <ShadcnInput
                    id="add-name-kana"
                    value={addForm.name_kana}
                    onChange={(e) => setAddForm({ ...addForm, name_kana: e.target.value })}
                    placeholder="例: ヤマダ タロウ"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="add-email">
                    メールアドレス
                    <span className="ml-2 text-[10px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded font-bold">必須</span>
                  </Label>
                  <ShadcnInput
                    id="add-email"
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    placeholder="例: admin@example.com"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  キャンセル
                </Button>
                <Button
                  onClick={handleAddAccount}
                  disabled={addLoading || !addForm.name.trim() || !addForm.email.trim()}
                >
                  {addLoading ? '送信中...' : '招待メールを送信'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>}

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
