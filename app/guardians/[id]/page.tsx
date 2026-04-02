"use client"
import React, { useState, use, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useRole } from '@/hooks/useRole';
import { StaffLayout } from "@/components/layout/staff-layout";
import {
  User,
  Phone,
  Save,
  Trash2,
  ArrowLeft,
  Upload,
  Loader2,
  Search,
} from 'lucide-react';
import Link from 'next/link';

// ---- Sub Components ----

const FieldGroup = ({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
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

const TextInput = ({
  value,
  onChange,
  placeholder,
  icon: Icon,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ElementType;
}) => (
  <div className="relative group">
    {Icon && (
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
        <Icon size={16} />
      </div>
    )}
    <input
      type="text"
      className={`w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 transition-all placeholder:text-slate-400 ${Icon ? 'pl-10' : ''}`}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
    />
  </div>
);

// ---- Page ----

interface LinkedChild {
  id: string;
  name: string;
  class_name: string | null;
  grade_label: string;
  relationship: string | null;
}

interface GuardianDetail {
  id: string;
  name: string;
  kana: string;
  phone: string;
  photo_url: string | null;
  photo_path: string | null;
  notes: string;
  linked_children: LinkedChild[];
  updated_at: string;
}

export default function GuardianDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const isNew = id === 'new';
  const { isAdmin } = useRole();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const [name, setName] = useState('');
  const [kana, setKana] = useState('');
  const [phone, setPhone] = useState('');
  const [memo, setMemo] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [linkedChildren, setLinkedChildren] = useState<LinkedChild[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState(false);
  const savedRef = React.useRef(false);

  // 子どもセレクタ（新規登録時のみ）
  const [childSearchQuery, setChildSearchQuery] = useState('');
  const [debouncedChildQuery, setDebouncedChildQuery] = useState('');
  const [childSearchResults, setChildSearchResults] = useState<Array<{ child_id: string; name: string; kana: string; class_name: string | null }>>([]);
  const [childSearchLoading, setChildSearchLoading] = useState(false);
  const [selectedChild, setSelectedChild] = useState<{ id: string; name: string } | null>(null);
  const [siblingInfo, setSiblingInfo] = useState<Array<{ child_id: string; name: string }>>([]);
  const [showChildDropdown, setShowChildDropdown] = useState(false);

  // ブラウザタブを閉じたり更新しようとしたときに確認
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomPhoto(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // cleanup: delete orphaned photo if form is abandoned
  useEffect(() => {
    return () => {
      if (isNew && photoPath && !savedRef.current) {
        fetch(`/api/guardians/upload-photo?path=${encodeURIComponent(photoPath)}`, { method: 'DELETE' })
          .catch(() => {/* best-effort cleanup */});
      }
    };
  }, [isNew, photoPath]);

  const fetchGuardian = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/guardians/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('保護者が見つかりません');
        throw new Error('取得に失敗しました');
      }
      const json: { data: GuardianDetail } = await res.json();
      const g = json.data;
      setName(g.name);
      setKana(g.kana);
      setPhone(g.phone);
      setMemo(g.notes);
      setPhotoUrl(g.photo_url);
      setPhotoPath(g.photo_path);
      setPhotoChanged(false);
      setLinkedChildren(g.linked_children);
      setIsDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!isNew) {
      fetchGuardian();
    }
  }, [isNew, fetchGuardian]);

  // 子ども検索デバウンス
  useEffect(() => {
    const t = setTimeout(() => setDebouncedChildQuery(childSearchQuery), 300);
    return () => clearTimeout(t);
  }, [childSearchQuery]);

  // 子ども検索
  useEffect(() => {
    if (!isNew || debouncedChildQuery.length < 1) {
      setChildSearchResults([]);
      return;
    }
    const controller = new AbortController();
    setChildSearchLoading(true);
    fetch(`/api/children?search=${encodeURIComponent(debouncedChildQuery)}&status=enrolled&limit=20`, { signal: controller.signal })
      .then(res => res.json())
      .then(json => {
        const results = (json.data?.children ?? []).map((c: { child_id: string; name: string; kana: string; class_name: string | null }) => ({
          child_id: c.child_id,
          name: c.name,
          kana: c.kana,
          class_name: c.class_name,
        }));
        setChildSearchResults(results);
        setShowChildDropdown(results.length > 0);
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') {
          console.error('Child search error:', e);
          setError('子どもの検索に失敗しました');
        }
      })
      .finally(() => setChildSearchLoading(false));
    return () => controller.abort();
  }, [isNew, debouncedChildQuery]);

  const markDirty = () => setIsDirty(true);

  const handleNavigateAway = () => {
    if (isDirty && !confirm('入力内容が保存されていません。移動しますか？')) return;
    router.push('/guardians');
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsDirty(true);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/guardians/upload-photo', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'アップロードに失敗しました');
      }
      const json = await res.json();
      setPhotoPath(json.data.file_path);
      setPhotoUrl(json.data.url);
      setPhotoChanged(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '写真のアップロードに失敗しました');
      setPhotoPreview(null);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSelectChild = async (child: { child_id: string; name: string }) => {
    setSelectedChild({ id: child.child_id, name: child.name });
    setChildSearchQuery('');
    setChildSearchResults([]);
    setShowChildDropdown(false);
    markDirty();
    // 兄弟情報を取得
    try {
      const res = await fetch(`/api/children/${child.child_id}`);
      if (res.ok) {
        const json = await res.json();
        const siblings = (json.data?.siblings ?? []).map((s: { child_id: string; name: string }) => ({ child_id: s.child_id, name: s.name }));
        setSiblingInfo(siblings);
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        console.error('Failed to fetch sibling info:', e.message);
      }
    }
  };

  const handleDeselectChild = () => {
    setSelectedChild(null);
    setSiblingInfo([]);
    markDirty();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('氏名は必須です');
      return;
    }
    if (isNew && !selectedChild) {
      setError('紐づける子どもは必須です');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        kana: kana.trim(),
        phone: phone.trim(),
        notes: memo.trim(),
        ...(photoChanged ? { photo_path: photoPath } : {}),
      };

      if (isNew) {
        const res = await fetch('/api/guardians', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, child_id: selectedChild!.id }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? '登録に失敗しました');
        }
        const json = await res.json();
        toast.success('保護者を登録しました');
        savedRef.current = true;
        setIsDirty(false);
        router.push('/guardians');
      } else {
        const res = await fetch(`/api/guardians/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? '更新に失敗しました');
        }
        toast.success('保存しました');
        setIsDirty(false);
        router.push('/guardians');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('この保護者情報を削除しますか？この操作は取り消せません。')) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/guardians/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '削除に失敗しました');
      }
      toast.success('保護者情報を削除しました');
      router.push('/guardians');
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除に失敗しました');
      setDeleting(false);
    }
  };

  const displayPhoto = photoPreview ?? photoUrl;

  if (loading) {
    return (
      <StaffLayout title="保護者詳細・編集">
        <div className="flex items-center justify-center p-12 text-slate-400">
          <Loader2 size={24} className="animate-spin mr-2" />
          読み込み中...
        </div>
      </StaffLayout>
    );
  }

  return (
    <StaffLayout title={isNew ? '保護者新規登録' : '保護者詳細・編集'}>
      <div className="max-w-2xl mx-auto">

        {/* Back link */}
        <div className="mb-6">
          <button
            onClick={handleNavigateAway}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft size={16} />
            保護者一覧に戻る
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* 1枚カード */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 md:p-8 space-y-6">

          {/* 顔写真 + 基本情報ヘッダー */}
          <div className="flex items-start gap-5">
            {/* Photo */}
            <div className="shrink-0 flex flex-col items-center gap-2">
              {displayPhoto ? (
                <button
                  type="button"
                  className="focus:outline-none"
                  onClick={() => setZoomPhoto(true)}
                >
                  <img
                    src={displayPhoto}
                    alt="顔写真"
                    className="w-24 h-24 rounded-xl object-cover border-2 border-slate-200 hover:opacity-80 transition-opacity cursor-zoom-in"
                  />
                </button>
              ) : (
                <div className="w-24 h-24 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1">
                  <User size={28} className="text-slate-300" />
                  <span className="text-xs text-slate-400">未登録</span>
                </div>
              )}
              <label className={`flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold cursor-pointer transition-colors ${uploadingPhoto ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploadingPhoto ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                {uploadingPhoto ? '...' : '写真変更'}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={uploadingPhoto} />
              </label>
              {displayPhoto && !uploadingPhoto && (
                <button
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                  onClick={async () => {
                    if (photoPath) {
                      try {
                        await fetch(
                          `/api/guardians/upload-photo?path=${encodeURIComponent(photoPath)}`,
                          { method: 'DELETE' }
                        );
                      } catch (e) {
                        console.error('Failed to delete photo from storage:', e);
                      }
                    }
                    setPhotoPreview(null);
                    setPhotoUrl(null);
                    setPhotoPath(null);
                    setPhotoChanged(true);
                  }}
                >
                  写真を削除
                </button>
              )}
            </div>

            {/* 氏名・ふりがな */}
            <div className="flex-1 space-y-3">
              <FieldGroup label="氏名" required>
                <TextInput value={name} onChange={v => { setName(v); markDirty(); }} placeholder="例: 山田 花子" icon={User} />
              </FieldGroup>
              <FieldGroup label="氏名（ふりがな）">
                <TextInput value={kana} onChange={v => { setKana(v); markDirty(); }} placeholder="例: やまだ はなこ" />
              </FieldGroup>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* 電話番号 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FieldGroup label="電話番号">
              <TextInput value={phone} onChange={v => { setPhone(v); markDirty(); }} placeholder="例: 090-1234-5678" icon={Phone} />
            </FieldGroup>
          </div>

          {/* 紐づける子ども（新規登録時のみ） */}
          {isNew && (
            <>
              <div className="border-t border-slate-100" />
              <FieldGroup label="紐づける子ども" required>
                {selectedChild ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-sm font-medium">
                      {selectedChild.name}
                    </span>
                    <button
                      type="button"
                      onClick={handleDeselectChild}
                      className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                    >
                      変更
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        className="pl-9 pr-4 py-2.5 bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
                        placeholder="子どもの名前を入力して検索..."
                        value={childSearchQuery}
                        onChange={e => { setChildSearchQuery(e.target.value); setShowChildDropdown(true); }}
                      />
                      {childSearchLoading && (
                        <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                      )}
                    </div>
                    {showChildDropdown && childSearchResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {childSearchResults.map(c => (
                          <button
                            key={c.child_id}
                            type="button"
                            className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-sm border-b border-slate-50 last:border-0"
                            onClick={() => handleSelectChild(c)}
                          >
                            <span className="font-medium text-slate-800">{c.name}</span>
                            {c.kana && <span className="ml-2 text-xs text-slate-400">{c.kana}</span>}
                            {c.class_name && <span className="ml-2 text-xs text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">{c.class_name}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* 兄弟案内 */}
                {selectedChild && siblingInfo.length > 0 ? (
                  <p className="text-xs text-slate-500 mt-1">
                    兄弟（{siblingInfo.map(s => s.name).join('、')}）にも自動的に紐づけされます
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-1">一人紐づけたら兄弟も紐づきます</p>
                )}
              </FieldGroup>
            </>
          )}

          {/* メモ */}
          <FieldGroup label="メモ・特記事項">
            <textarea
              className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 resize-none"
              rows={4}
              placeholder="例：お迎え時に本人確認済み。要望が多い場合は必ず記録すること。"
              value={memo}
              onChange={e => { setMemo(e.target.value); markDirty(); }}
            />
            <p className="text-xs text-slate-400 text-right">{memo.length} 文字</p>
          </FieldGroup>

          {/* 紐づいている子ども（新規登録時は非表示） */}
          {!isNew && linkedChildren.length > 0 && (
            <>
              <div className="border-t border-slate-100" />
              <div>
                <p className="text-sm font-bold text-slate-700 mb-2">紐づいている子ども</p>
                <div className="space-y-2">
                  {linkedChildren.map(child => (
                    <div
                      key={child.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <span className="font-bold text-slate-800 text-sm">{child.name}</span>
                        {child.class_name && (
                          <span className="ml-2 text-xs text-slate-500">{child.class_name}</span>
                        )}
                        {child.grade_label && child.grade_label !== '-' && (
                          <span className="ml-1 text-xs text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">{child.grade_label}</span>
                        )}
                      </div>
                      <Link
                        href={`/children/${child.id}/edit`}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        詳細を見る
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 pb-8">
          {!isNew && isAdmin ? (
            <button
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              onClick={handleDelete}
              disabled={deleting || saving}
            >
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              削除
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleNavigateAway}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-sm font-bold transition-colors"
            >
              キャンセル
            </button>
            <button
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
              onClick={handleSave}
              disabled={saving || deleting || uploadingPhoto}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isNew ? '登録する' : '保存する'}
            </button>
          </div>
        </div>

      </div>

      {zoomPhoto && displayPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setZoomPhoto(false)}
        >
          <img
            src={displayPhoto}
            alt="保護者写真"
            className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </StaffLayout>
  );
}
