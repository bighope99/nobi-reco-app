"use client"
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import {
  User,
  Users,
  Phone,
  Mail,
  AlertTriangle,
  Heart,
  Shield,
  Camera,
  Plus,
  Trash2,
  ChevronRight,
  Save,
  Building2,
} from 'lucide-react';

/**
 * ============================================================================
 * Design System Components & Utilities
 * ============================================================================
 */

// セクションカード: 各入力グループをまとめる白いカード
const SectionCard = ({ id, title, icon: Icon, description, children, isActive }: any) => (
  <section
    id={id}
    className={`bg-white rounded-xl border transition-all duration-300 scroll-mt-24 mb-8 ${isActive ? 'border-indigo-200 shadow-md ring-1 ring-indigo-50' : 'border-slate-200 shadow-sm'
      }`}
  >
    <div className="px-6 py-5 border-b border-slate-100 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg shrink-0 ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
        <Icon size={20} strokeWidth={2} />
      </div>
      <div>
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          {title}
        </h2>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
    </div>
    <div className="p-6 md:p-8 space-y-8">
      {children}
    </div>
  </section>
);

// フォームフィールドラッパー: ラベルと必須バッジ、エラー表示を管理
const FieldGroup = ({ label, required, error, children, className = "" }: any) => (
  <div className={`flex flex-col gap-2 ${className}`}>
    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
      {label}
      {required && (
        <span className="text-[10px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded font-bold tracking-wide">
          必須
        </span>
      )}
    </label>
    {children}
    {error && <p className="text-xs text-red-600 font-medium flex items-center gap-1"><AlertTriangle size={12} /> {error}</p>}
  </div>
);

// 基本的なInputコンポーネント
const Input = ({ icon: Icon, className = "", ...props }: any) => (
  <div className="relative group">
    {Icon && (
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
        <Icon size={16} />
      </div>
    )}
    <input
      className={`w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 transition-all placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 ${Icon ? 'pl-10' : ''} ${className}`}
      {...props}
    />
  </div>
);

// セレクトボックス
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

// テキストエリア
const Textarea = ({ className = "", ...props }: any) => (
  <textarea
    className={`w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-3 min-h-[100px] transition-all resize-y placeholder:text-slate-400 ${className}`}
    {...props}
  />
);

// スイッチ（トグル）
const Switch = ({ checked, onChange, label, description }: any) => (
  <div className="flex items-start gap-3 cursor-pointer group" onClick={() => onChange(!checked)}>
    <div
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${checked ? 'bg-indigo-600' : 'bg-slate-200'}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </div>
    <div className="flex flex-col select-none">
      <span className="text-sm font-medium text-slate-900 group-hover:text-indigo-700 transition-colors">{label}</span>
      {description && <span className="text-xs text-slate-500">{description}</span>}
    </div>
  </div>
);

/**
 * ============================================================================
 * Main Component
 * ============================================================================
 */

interface ChildFormProps {
  mode: 'new' | 'edit';
  childId?: string;
  onSuccess?: () => void;
  readOnly?: boolean;
}

// 保護者連絡先エントリの型
type GuardianContact = {
  id: number;
  guardianId?: string;
  name: string;
  kana: string;
  relation: string;
  phone: string;
};

type SiblingCandidate = {
  child_id: string;
  name: string;
  kana?: string;
  class_name?: string;
  age?: number;
  enrollment_status?: string;
  guardian_contacts?: Array<{
    guardian_id: string;
    name: string;
    kana: string | null;
    phone: string;
    relation: string;
    is_primary: boolean;
  }>;
};

type CandidateGuardianContact = {
  guardian_id: string;
  name: string;
  kana: string | null;
  phone: string;
  relation: string;
  is_primary: boolean;
};

export default function ChildForm({ mode, childId, onSuccess, readOnly = false }: ChildFormProps) {
  const router = useRouter();
  const isEditMode = mode === 'edit';
  const MAX_GUARDIAN_CONTACTS = 5;
  const contactIdRef = useRef(1);
  const [activeSection, setActiveSection] = useState('basic');
  const [isSearchingSibling, setIsSearchingSibling] = useState(false);
  const [siblingCandidates, setSiblingCandidates] = useState<SiblingCandidate[]>([]);
  const [siblingSearchDismissed, setSiblingSearchDismissed] = useState(false);
  const [showNameSearch, setShowNameSearch] = useState(false);
  const [nameSearchQuery, setNameSearchQuery] = useState('');
  const [nameSearchResults, setNameSearchResults] = useState<SiblingCandidate[]>([]);
  const [isSearchingByName, setIsSearchingByName] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [siblings, setSiblings] = useState<Array<{child_id: string; name: string; relationship: string}>>([]);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<Array<{ class_id: string; class_name: string }>>([]);
  const [classesLoaded, setClassesLoaded] = useState(false);
  const [schools, setSchools] = useState<Array<{ school_id: string; name: string }>>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [parentPhotoUrl, setParentPhotoUrl] = useState<string | null>(null);
  const [emergencyPhotoUrls, setEmergencyPhotoUrls] = useState<Record<string, string | null>>({});
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);
  const [primaryGuardianId, setPrimaryGuardianId] = useState<string | null>(null);
  const [pendingSiblingIds, setPendingSiblingIds] = useState<string[]>([]);

  // 未保存変更アラート
  const { reset: resetUnsavedChanges } = useUnsavedChanges(isDirty);

  // フォーム変更時にdirtyフラグを立てるラッパー
  const updateFormData = useCallback((updates: Partial<typeof formData>) => {
    setIsDirty(true);
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // フォームの状態
  const [formData, setFormData] = useState({
    // 基本情報
    family_name: '',
    given_name: '',
    family_name_kana: '',
    given_name_kana: '',
    nickname: '',
    gender: 'male' as 'male' | 'female',
    birth_year: '',
    birth_month: '',
    birth_day: '',
    birth_date: '', // 編集モード用
    school_id: '',
    grade_add: 0,

    // 所属・契約
    enrollment_status: 'enrolled' as 'enrolled' | 'withdrawn' | 'suspended',
    enrollment_type: 'regular' as 'regular' | 'temporary' | 'spot',
    enrolled_at: '',
    withdrawn_at: '',
    class_id: '',

    // 連絡先
    parent_name: '',
    parent_kana: '',
    parent_relation: '',
    parent_phone: '',
    parent_email: '',

    // ケア
    allergies: '',
    child_characteristics: '',
    parent_characteristics: '',

    // 権限
    photo_permission_public: true,
    photo_permission_share: true,
  });

  const [guardianContacts, setGuardianContacts] = useState<GuardianContact[]>([]);

  // Fetch classes and schools on mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const response = await fetch('/api/children/classes');
        const result = await response.json();
        if (result.success && result.data.classes) {
          setClasses(result.data.classes);
        }
      } catch (err) {
        console.error('Failed to fetch classes:', err);
      } finally {
        setClassesLoaded(true);
      }
    };

    const fetchSchools = async () => {
      try {
        const response = await fetch('/api/schools');
        const result = await response.json();
        if (result.success && result.data.schools) {
          setSchools(result.data.schools.map((school: any) => ({
            school_id: school.school_id,
            name: school.name
          })));
        }
      } catch (err) {
        console.error('Failed to fetch schools:', err);
      }
    };

    fetchClasses();
    fetchSchools();
  }, []);

  // Fetch child data in edit mode
  useEffect(() => {
    if (!isEditMode || !childId) return;

    const fetchChildData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/children/${childId}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch child data');
        }

        if (result.success && result.data) {
          const data = result.data;

          // birth_dateを分割
          const birthDate = data.basic_info.birth_date || '';
          const [year, month, day] = birthDate ? birthDate.split('-') : ['', '', ''];

          setFormData({
            family_name: data.basic_info.family_name || '',
            given_name: data.basic_info.given_name || '',
            family_name_kana: data.basic_info.family_name_kana || '',
            given_name_kana: data.basic_info.given_name_kana || '',
            nickname: data.basic_info.nickname || '',
            gender: data.basic_info.gender || 'male',
            birth_year: year,
            birth_month: month,
            birth_day: day,
            birth_date: birthDate,
            school_id: data.basic_info?.school_id || '',
            grade_add: data.basic_info?.grade_add || 0,
            enrollment_status: data.affiliation?.enrollment_status || 'enrolled',
            enrollment_type: data.affiliation?.enrollment_type || 'regular',
            enrolled_at: data.affiliation?.enrolled_at ? data.affiliation.enrolled_at.split('T')[0] : '',
            withdrawn_at: data.affiliation?.withdrawn_at ? data.affiliation.withdrawn_at.split('T')[0] : '',
            class_id: data.affiliation?.class_id || '',
            parent_name: data.contact?.parent_name || '',
            parent_kana: data.contact?.parent_kana || '',
            parent_relation: data.contact?.parent_relation || '',
            parent_phone: data.contact?.parent_phone || '',
            parent_email: data.contact?.parent_email || '',
            allergies: data.care_info?.allergies || '',
            child_characteristics: data.care_info?.child_characteristics || '',
            parent_characteristics: data.care_info?.parent_characteristics || '',
            photo_permission_public: data.permissions?.photo_permission_public ?? true,
            photo_permission_share: data.permissions?.photo_permission_share ?? true,
          });

          // 保護者連絡先リストの初期化（最大5つまで）
          if (data.contact?.emergency_contacts && data.contact.emergency_contacts.length > 0) {
            const contacts = data.contact.emergency_contacts
              .slice(0, MAX_GUARDIAN_CONTACTS)
              .map((ec: any, idx: number) => {
                contactIdRef.current = idx + 1;
                return {
                  id: idx + 1,
                  guardianId: ec.guardian_id || undefined,
                  name: ec.name || '',
                  kana: ec.kana || '',
                  relation: ec.relation || '',
                  phone: ec.phone || '',
                };
              });
            setGuardianContacts(contacts);
          }

          // 保護者写真URLのセット
          if (data.contact?.parent_photo_url) {
            setParentPhotoUrl(data.contact.parent_photo_url);
          }
          const photoUrls: Record<string, string | null> = {};
          (data.contact?.emergency_contacts ?? []).forEach((ec: any) => {
            if (ec.guardian_id && ec.photo_url) photoUrls[ec.guardian_id] = ec.photo_url;
          });
          setEmergencyPhotoUrls(photoUrls);

          // 写真プレビューの初期化（APIが署名URLを返す）
          if (data.basic_info.photo_url) {
            setPhotoPreviewUrl(data.basic_info.photo_url);
          }

          // 紐付け済み兄弟の初期化
          if (data.siblings && data.siblings.length > 0) {
            setSiblings(data.siblings);
          }

          // 筆頭保護者IDの初期化
          if (data.guardians && data.guardians.length > 0) {
            const primary = data.guardians.find((g: any) => g.is_primary);
            if (primary) {
              setPrimaryGuardianId(primary.guardian_id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch child data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch child data');
      } finally {
        setLoading(false);
      }
    };

    fetchChildData();
  }, [isEditMode, childId]);

  // スクロールスパイ: 画面上部を通過した最後のセクションをアクティブにする
  useEffect(() => {
    const sections = ['basic', 'affiliation', 'family', 'care'];
    const offset = 120; // sticky header + margin

    const handleScroll = () => {
      let current = sections[0];
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= offset) {
            current = section;
          }
        }
      }
      setActiveSection(current);
    };
    const scrollContainer = document.querySelector('main') ?? window;
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // 初期状態を設定
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  // 拡大モーダルのEscapeキー閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomPhotoUrl(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 兄弟検索ロジック
  const handleSiblingSearch = async () => {
    // 電話番号が入力されていない場合はスキップ
    if (!formData.parent_phone) return;

    setIsSearchingSibling(true);
    setSiblingCandidates([]);
    setError(null);

    try {
      const response = await fetch('/api/children/search-siblings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formData.parent_phone,
          child_id: isEditMode ? childId : undefined, // 編集モードの場合は本人のIDを送信
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '検索に失敗しました');
      }

      if (result.success && result.data.found && result.data.candidates.length > 0) {
        // 登録済み兄弟のIDセットを作成して候補から除外
        const registeredSiblingIds = new Set(siblings.map(s => s.child_id));
        const unregisteredCandidates = result.data.candidates.filter(
          (c: any) => !registeredSiblingIds.has(c.child_id)
        );

        if (unregisteredCandidates.length > 0) {
          setSiblingCandidates(unregisteredCandidates);
        } else {
          setSiblingCandidates([]);
        }
      } else {
        setSiblingCandidates([]);
      }
    } catch (err) {
      console.error('Failed to search siblings:', err);
      setError(err instanceof Error ? err.message : '兄弟検索に失敗しました');
    } finally {
      setIsSearchingSibling(false);
    }
  };

  // 兄弟紐づけハンドラ
  const handleSiblingLink = async (
    siblingId: string,
    siblingName: string,
    candidateGuardianContacts?: CandidateGuardianContact[]
  ) => {
    const applySiblingGuardianContacts = (contacts: CandidateGuardianContact[]) => {
      if (contacts.length === 0) return;

      const primaryContact = contacts.find(gc => gc.is_primary);
      const nonPrimaryContacts = contacts.filter(gc => !gc.is_primary);

      if (primaryContact) {
        setFormData(prev => ({
          ...prev,
          parent_name: primaryContact.name,
          parent_kana: primaryContact.kana || '',
          parent_relation: primaryContact.relation,
          parent_phone: primaryContact.phone,
        }));
        setPrimaryGuardianId(primaryContact.guardian_id);
        setParentPhotoUrl(emergencyPhotoUrls[primaryContact.guardian_id] ?? null);
      }

      setGuardianContacts(prev => {
        const excludedIds = new Set(
          [primaryContact?.guardian_id, ...nonPrimaryContacts.map(gc => gc.guardian_id)].filter(Boolean)
        );
        const preservedContacts = prev.filter(c => !c.guardianId || !excludedIds.has(c.guardianId));
        const existingIds = new Set(preservedContacts.map(c => c.guardianId).filter(Boolean));
        const nextContacts = nonPrimaryContacts
          .filter(gc => !existingIds.has(gc.guardian_id))
          .map(gc => ({
            id: ++contactIdRef.current,
            guardianId: gc.guardian_id,
            name: gc.name,
            kana: gc.kana || '',
            relation: gc.relation,
            phone: gc.phone,
          }));
        const merged = [...nextContacts, ...preservedContacts].slice(0, MAX_GUARDIAN_CONTACTS);
        const maxId = merged.reduce((max, c) => Math.max(max, c.id), contactIdRef.current);
        contactIdRef.current = maxId;
        return merged;
      });

      setIsDirty(true);
    };

    if (!isEditMode) {
      setSiblingCandidates(prev => prev.filter(c => c.child_id !== siblingId));
      setNameSearchResults(prev => prev.filter(c => c.child_id !== siblingId));
      setSiblings(prev => prev.some(s => s.child_id === siblingId)
        ? prev
        : [...prev, { child_id: siblingId, name: siblingName, relationship: '兄弟' }]
      );
      setPendingSiblingIds(prev => prev.includes(siblingId) ? prev : [...prev, siblingId]);

      if (candidateGuardianContacts && candidateGuardianContacts.length > 0) {
        applySiblingGuardianContacts(candidateGuardianContacts);
      }

      return;
    }

    try {
      const response = await fetch('/api/children/link-sibling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          child_id: childId,
          sibling_id: siblingId,
        }),
      });

      const result = await response.json();
      if (result.success) {
        // candidates から除外
        setSiblingCandidates(prev => prev.filter(c => c.child_id !== siblingId));
        setNameSearchResults(prev => prev.filter(c => c.child_id !== siblingId));
        // siblings に追加
        setSiblings(prev => prev.some(s => s.child_id === siblingId)
          ? prev
          : [...prev, { child_id: siblingId, name: siblingName, relationship: '兄弟' }]
        );
        if (candidateGuardianContacts && candidateGuardianContacts.length > 0) {
          applySiblingGuardianContacts(candidateGuardianContacts);
        }
      } else {
        setError(result.error || '兄弟紐づけに失敗しました');
      }
    } catch (err) {
      setError('兄弟紐づけに失敗しました');
    }
  };

  // 名前で兄弟を検索するハンドラ
  const handleNameSearch = async () => {
    if (!nameSearchQuery.trim()) return;
    setIsSearchingByName(true);
    try {
      const response = await fetch('/api/children/search-by-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameSearchQuery.trim(),
          child_id: isEditMode ? childId : undefined,
        }),
      });
      const result = await response.json();
      if (result.success && result.data.found) {
        const registeredIds = new Set([
          ...siblings.map(s => s.child_id),
          ...siblingCandidates.map(c => c.child_id),
        ]);
        setNameSearchResults(
          result.data.candidates.filter((c: any) => !registeredIds.has(c.child_id))
        );
      } else {
        setNameSearchResults([]);
      }
    } catch (err) {
      console.error('Failed to search by name:', err);
    } finally {
      setIsSearchingByName(false);
    }
  };

  // 写真ファイル選択ハンドラ
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(objectUrl);
  };

  const addGuardianContact = () => {
    if (guardianContacts.length >= MAX_GUARDIAN_CONTACTS) return;
    contactIdRef.current += 1;
    setGuardianContacts([...guardianContacts, { id: contactIdRef.current, guardianId: undefined, name: '', kana: '', relation: '', phone: '' }]);
    setIsDirty(true);
  };

  const updateGuardianContact = (index: number, field: keyof GuardianContact, value: string) => {
    const updated = [...guardianContacts];
    (updated[index] as any)[field] = value;
    setGuardianContacts(updated);
    setIsDirty(true);
  };

  const removeGuardianContact = (id: number) => {
    setGuardianContacts(guardianContacts.filter(c => c.id !== id));
    setIsDirty(true);
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;

    // 生年月日の組み立て
    const birthDate = formData.birth_year && formData.birth_month && formData.birth_day
      ? `${formData.birth_year}-${formData.birth_month.padStart(2, '0')}-${formData.birth_day.padStart(2, '0')}`
      : (isEditMode ? formData.birth_date : '');

    // Validation
    if (
      !formData.family_name ||
      !formData.given_name ||
      !birthDate ||
      !formData.enrolled_at
    ) {
      setError(
        '必須項目を入力してください（氏名、生年月日、入所開始日は必須です）'
      );
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // 写真ファイルがある場合はアップロードしてパスを取得
      // サーバー側でUUIDを生成するため child_id は不要
      let uploadedPhotoPath: string | undefined = undefined;
      if (photoFile) {
        const photoFormData = new FormData();
        photoFormData.append('file', photoFile);

        const uploadResponse = await fetch('/api/storage/upload/child-photo', {
          method: 'POST',
          body: photoFormData,
        });
        const uploadResult = await uploadResponse.json();

        if (!uploadResponse.ok || !uploadResult.success) {
          throw new Error(uploadResult.error || '写真のアップロードに失敗しました');
        }
        uploadedPhotoPath = uploadResult.data.file_path;
      }

      const requestBody = {
        child_id: isEditMode ? childId : undefined,
        sibling_ids: pendingSiblingIds,
        basic_info: {
          family_name: formData.family_name,
          given_name: formData.given_name,
          family_name_kana: formData.family_name_kana,
          given_name_kana: formData.given_name_kana,
          nickname: formData.nickname,
          gender: formData.gender,
          birth_date: birthDate,
          school_id: formData.school_id || null,
          grade_add: formData.grade_add,
          // photo_url: アップロードした場合のみ含める（未変更時は省略して既存値を維持）
          ...(uploadedPhotoPath !== undefined ? { photo_url: uploadedPhotoPath } : {}),
        },
        affiliation: {
          enrollment_status: formData.enrollment_status,
          enrollment_type: formData.enrollment_type,
          enrolled_at: formData.enrolled_at,
          withdrawn_at: formData.withdrawn_at || null,
          class_id: formData.class_id || null,
        },
        contact: {
          parent_name: formData.parent_name,
          parent_kana: formData.parent_kana,
          parent_relation: formData.parent_relation,
          parent_phone: formData.parent_phone,
          parent_email: formData.parent_email,
          emergency_contacts: guardianContacts
            .filter(c => c.name || c.phone)
            .map(c => ({
              guardian_id: c.guardianId,
              name: c.name,
              kana: c.kana,
              relation: c.relation,
              phone: c.phone,
            })),
        },
        care_info: {
          allergies: formData.allergies,
          child_characteristics: formData.child_characteristics,
          parent_characteristics: formData.parent_characteristics,
        },
        permissions: {
          photo_permission_public: formData.photo_permission_public,
          photo_permission_share: formData.photo_permission_share,
        },
      };

      const response = await fetch('/api/children/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || (isEditMode ? '更新に失敗しました' : '登録に失敗しました'));
      }

      if (result.success) {
        setPendingSiblingIds([]);
        setIsDirty(false);
        resetUnsavedChanges(); // refを即座にfalseにして遷移時の警告を抑止
        if (onSuccess) {
          onSuccess();
        } else {
          router.push('/children');
        }
      }
    } catch (err) {
      console.error(`Failed to ${isEditMode ? 'update' : 'register'} child:`, err);
      setError(err instanceof Error ? err.message : (isEditMode ? '更新に失敗しました' : '登録に失敗しました'));
    } finally {
      setSaving(false);
    }
  };

  // Sync hasAllergy state with formData - Removed as has_allergy is no longer in formData

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans text-slate-600 pb-24">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Side Navigation (Sticky) */}
          <nav className="hidden lg:block lg:col-span-3 sticky top-24 space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-3">目次</p>
            {[
              { id: 'basic', label: '基本情報', icon: User },
              { id: 'affiliation', label: '所属・契約', icon: Building2 },
              { id: 'family', label: '家庭・連絡先', icon: Users },
              { id: 'care', label: 'ケア・権限', icon: Shield },
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${activeSection === item.id
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
              >
                <item.icon size={18} className={activeSection === item.id ? 'text-indigo-600' : 'text-slate-400'} />
                {item.label}
              </a>
            ))}

            <div className="mt-8 px-3 py-4 bg-slate-100 rounded-lg border border-slate-200">
              <h4 className="text-xs font-bold text-slate-500 mb-2">入力サポート</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                必須項目は必ず入力してください。<br />
                途中で保存する場合は下部の「一時保存」を使用できます。
              </p>
            </div>
          </nav>

          {/* Main Form Area */}
          <main className="lg:col-span-9">
            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <p className="text-red-600 text-sm flex items-center gap-2">
                  <AlertTriangle size={16} /> {error}
                </p>
              </div>
            )}

            <fieldset disabled={readOnly} className="contents">
            <form id="child-form" onSubmit={handleSubmit}>

              {/* 1. 基本情報 */}
              <SectionCard
                id="basic"
                title="基本情報"
                icon={User}
                description="児童本人の基本的な識別情報を入力します。"
                isActive={activeSection === 'basic'}
              >
                <div className="flex flex-col sm:flex-row gap-8">
                  {/* Photo Upload Area */}
                  <div className="shrink-0 flex flex-col items-center gap-3">
                    <div className="w-32 h-32 rounded-full bg-slate-50 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-100 hover:border-indigo-400 hover:text-indigo-500 transition-all cursor-pointer group relative overflow-hidden">
                      {photoPreviewUrl ? (
                        <img src={photoPreviewUrl} alt="プレビュー" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <>
                          <Camera size={24} className="mb-1" />
                          <span className="text-xs font-medium">写真を追加</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={handlePhotoChange}
                      />
                    </div>
                    <span className="text-xs text-slate-400">推奨: 400x400px</span>
                  </div>

                  {/* Inputs */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FieldGroup label="氏名（漢字）" required>
                      <div className="flex gap-2">
                        <Input
                          placeholder="姓"
                          value={formData.family_name}
                          onChange={(e: any) => updateFormData({ family_name: e.target.value })}
                        />
                        <Input
                          placeholder="名"
                          value={formData.given_name}
                          onChange={(e: any) => updateFormData({ given_name: e.target.value })}
                        />
                      </div>
                    </FieldGroup>
                    <FieldGroup label="氏名（フリガナ）" required>
                      <div className="flex gap-2">
                        <Input
                          placeholder="セイ"
                          value={formData.family_name_kana}
                          onChange={(e: any) => updateFormData({ family_name_kana: e.target.value })}
                        />
                        <Input
                          placeholder="メイ"
                          value={formData.given_name_kana}
                          onChange={(e: any) => updateFormData({ given_name_kana: e.target.value })}
                        />
                      </div>
                    </FieldGroup>

                    <FieldGroup label="呼び名（愛称）">
                      <Input
                        placeholder="例: れんくん"
                        value={formData.nickname}
                        onChange={(e: any) => updateFormData({ nickname: e.target.value })}
                      />
                    </FieldGroup>

                    <FieldGroup label="性別" required>
                      <div className="flex gap-4 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="radio"
                            name="gender"
                            value="male"
                            checked={formData.gender === 'male'}
                            onChange={(e) => updateFormData({ gender: 'male' })}
                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-slate-700 group-hover:text-indigo-700">男児</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="radio"
                            name="gender"
                            value="female"
                            checked={formData.gender === 'female'}
                            onChange={(e) => updateFormData({ gender: 'female' })}
                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-slate-700 group-hover:text-indigo-700">女児</span>
                        </label>
                      </div>
                    </FieldGroup>

                    <FieldGroup label="生年月日" required className="sm:col-span-2">
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number"
                          placeholder="年"
                          className="max-w-[100px]"
                          value={formData.birth_year}
                          onChange={(e: any) => updateFormData({ birth_year: e.target.value })}
                          min="1900"
                          max={new Date().getFullYear()}
                          suppressHydrationWarning
                        />
                        <span className="text-slate-500">年</span>
                        <Input
                          type="number"
                          placeholder="月"
                          className="max-w-[80px]"
                          value={formData.birth_month}
                          onChange={(e: any) => updateFormData({ birth_month: e.target.value })}
                          min="1"
                          max="12"
                        />
                        <span className="text-slate-500">月</span>
                        <Input
                          type="number"
                          placeholder="日"
                          className="max-w-[80px]"
                          value={formData.birth_day}
                          onChange={(e: any) => updateFormData({ birth_day: e.target.value })}
                          min="1"
                          max="31"
                        />
                        <span className="text-slate-500">日</span>
                      </div>
                    </FieldGroup>

                    <FieldGroup label="通学している学校" className="sm:col-span-2">
                      <Select
                        value={formData.school_id}
                        onChange={(e: any) => updateFormData({ school_id: e.target.value })}
                      >
                        <option value="">学校を選択してください</option>
                        {schools.map((school) => (
                          <option key={school.school_id} value={school.school_id}>
                            {school.name}
                          </option>
                        ))}
                      </Select>
                      <p className="text-xs text-slate-400 mt-1">※学校が登録されていない場合は、先に学校マスタから登録してください</p>
                    </FieldGroup>

{/* 学年調整フィールドは非表示（grade_addデータは内部で保持） */}
                  </div>
                </div>
              </SectionCard>

              {/* 2. 所属・契約 */}
              <SectionCard
                id="affiliation"
                title="所属・契約"
                icon={Building2}
                description="ステータスや所属クラスを管理します。"
                isActive={activeSection === 'affiliation'}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FieldGroup label="ステータス" required>
                    <Select
                      value={formData.enrollment_status}
                      onChange={(e: any) => updateFormData({ enrollment_status: e.target.value as 'enrolled' | 'withdrawn' | 'suspended' })}
                    >
                      <option value="enrolled">在籍中</option>
                      <option value="suspended">休園中</option>
                      <option value="withdrawn">退所済</option>
                    </Select>
                  </FieldGroup>

                  <FieldGroup label="契約形態" required>
                    <Select
                      value={formData.enrollment_type}
                      onChange={(e: any) => updateFormData({ enrollment_type: e.target.value as 'regular' | 'temporary' | 'spot' })}
                    >
                      <option value="regular">通年契約（月極）</option>
                      <option value="temporary">一時保育</option>
                      <option value="spot">スポット利用</option>
                    </Select>
                  </FieldGroup>

                  <FieldGroup label="入所開始日" required>
                    <Input
                      type="date"
                      value={formData.enrolled_at}
                      onChange={(e: any) => updateFormData({ enrolled_at: e.target.value })}
                    />
                  </FieldGroup>

                  <FieldGroup label="退所日（退所後に入力）">
                    <Input
                      type="date"
                      placeholder="未定"
                      value={formData.withdrawn_at}
                      onChange={(e: any) => updateFormData({ withdrawn_at: e.target.value })}
                    />
                  </FieldGroup>

                  {classesLoaded && classes.length > 0 && (
                    <FieldGroup label="現在のクラス">
                      <Select
                        value={formData.class_id}
                        onChange={(e: any) => updateFormData({ class_id: e.target.value })}
                      >
                        <option value="">クラスを選択...</option>
                        {classes.map((cls) => (
                          <option key={cls.class_id} value={cls.class_id}>
                            {cls.class_name}
                          </option>
                        ))}
                      </Select>
                      <p className="text-xs text-slate-400 mt-1">※クラスは後から設定することもできます</p>
                    </FieldGroup>
                  )}
                </div>
              </SectionCard>

              {/* 3. 家庭・連絡先・兄弟 */}
              <SectionCard
                id="family"
                title="家庭・連絡先"
                icon={Users}
                description="緊急時の連絡先や家族構成を登録します。"
                isActive={activeSection === 'family'}
              >
                {/* 保護者（主） */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 mb-6">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <User size={16} className="text-indigo-600" /> 保護者情報（筆頭者）
                    {primaryGuardianId && (
                      <Link
                        href={`/guardians/${primaryGuardianId}`}
                        className="text-xs text-indigo-500 hover:text-indigo-700 underline font-normal"
                        target="_blank"
                      >
                        詳細を見る
                      </Link>
                    )}
                    {parentPhotoUrl ? (
                      <button
                        type="button"
                        onClick={() => setZoomPhotoUrl(parentPhotoUrl)}
                        className="cursor-zoom-in ml-1"
                      >
                        <img
                          src={parentPhotoUrl}
                          alt="保護者写真"
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      </button>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                        <User size={14} className="text-slate-400" />
                      </div>
                    )}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FieldGroup label="保護者氏名" required>
                      <Input
                        placeholder="佐藤 太郎"
                        value={formData.parent_name}
                        onChange={(e: any) => updateFormData({ parent_name: e.target.value })}
                      />
                    </FieldGroup>
                    <FieldGroup label="保護者ふりがな">
                      <Input
                        placeholder="さとう たろう（不明の場合は空白）"
                        value={formData.parent_kana}
                        onChange={(e: any) => updateFormData({ parent_kana: e.target.value })}
                      />
                    </FieldGroup>
                    <FieldGroup label="続柄">
                      <Input
                        placeholder="例: 母、父、祖母など"
                        value={formData.parent_relation}
                        onChange={(e: any) => updateFormData({ parent_relation: e.target.value })}
                      />
                    </FieldGroup>
                    <FieldGroup label="メールアドレス">
                      <Input
                        icon={Mail}
                        type="email"
                        placeholder="example@email.com"
                        value={formData.parent_email}
                        onChange={(e: any) => updateFormData({ parent_email: e.target.value })}
                      />
                    </FieldGroup>

                    {/* 紐付け済み兄弟リスト */}
                    {siblings.length > 0 && (
                      <div className="sm:col-span-2">
                        <p className="text-xs font-medium text-slate-700 mb-2">紐付け済みの兄弟・姉妹</p>
                        <div className="space-y-2">
                          {siblings.map((sibling) => (
                            <div key={sibling.child_id} className="flex items-center gap-3 bg-indigo-50/50 border border-indigo-100 rounded-lg px-3 py-2">
                              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                <Users size={14} className="text-indigo-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-900">{sibling.name}</p>
                                <p className="text-xs text-slate-500">{sibling.relationship}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 兄弟紐づけトリガー（電話番号入力で自動検索） */}
                    <FieldGroup label="携帯電話番号" required className="relative sm:col-span-2">
                      <Input
                        icon={Phone}
                        type="tel"
                        placeholder="090-0000-0000"
                        value={formData.parent_phone}
                        onChange={(e: any) => {
                          setSiblingSearchDismissed(false);
                          setSiblingCandidates([]);
                          updateFormData({ parent_phone: e.target.value });
                        }}
                        onBlur={() => {
                          if (formData.parent_phone && !siblingSearchDismissed) {
                            handleSiblingSearch();
                          }
                        }}
                      />
                      {isSearchingSibling && (
                        <p className="text-xs text-indigo-500 mt-1 flex items-center gap-1">
                          <span className="animate-spin w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full inline-block"></span>
                          兄弟を検索中...
                        </p>
                      )}
                      {!isSearchingSibling && (
                        <p className="text-xs text-slate-400 mt-1">※この番号で既存児童を自動検索し、兄弟候補を表示します。</p>
                      )}
                    </FieldGroup>
                  </div>

                  {/* Sibling Candidates from phone search */}
                  {siblingCandidates.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">兄弟候補が見つかりました</span>
                      {siblingCandidates.map((candidate) => (
                        <div key={candidate.child_id} className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                <Users size={18} className="text-indigo-500" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900">{candidate.name} <span className="text-xs font-normal text-slate-500">（{candidate.kana}）</span></p>
                                <p className="text-xs text-slate-500">{candidate.class_name}{candidate.age ? ` (${candidate.age}歳)` : ''} | {candidate.enrollment_status === 'enrolled' ? '在園中' : '退所済'}</p>
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleSiblingLink(candidate.child_id, candidate.name, candidate.guardian_contacts)}
                                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 font-medium shadow-sm"
                              >
                                紐付ける
                              </button>
                              <button
                                type="button"
                                onClick={() => setSiblingCandidates(prev => prev.filter(c => c.child_id !== candidate.child_id))}
                                className="text-xs bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-md hover:bg-slate-50 font-medium shadow-sm"
                              >
                                除外
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => { setSiblingCandidates([]); setSiblingSearchDismissed(true); }}
                        className="text-xs text-slate-400 hover:text-slate-600 mt-1"
                      >
                        すべて兄弟として登録しない
                      </button>
                    </div>
                  )}

                  {/* 名前で兄弟を検索するUI */}
                  <div className="mt-3">
                    {!showNameSearch ? (
                      <button
                        type="button"
                        onClick={() => setShowNameSearch(true)}
                        className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1"
                      >
                        <Users size={12} />
                        登録済みの兄弟を名前で検索
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={nameSearchQuery}
                            onChange={(e) => setNameSearchQuery(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleNameSearch(); }}}
                            placeholder="児童の名前を入力"
                            className="flex-1 bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 placeholder:text-slate-400"
                          />
                          <button
                            type="button"
                            onClick={handleNameSearch}
                            disabled={isSearchingByName || !nameSearchQuery.trim()}
                            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 font-medium disabled:opacity-50"
                          >
                            {isSearchingByName ? '検索中...' : '検索'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowNameSearch(false); setNameSearchQuery(''); setNameSearchResults([]); }}
                            className="text-xs bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-md hover:bg-slate-50 font-medium"
                          >
                            閉じる
                          </button>
                        </div>
                        {nameSearchResults.length > 0 && (
                          <div className="space-y-2">
                            {nameSearchResults.map((candidate) => (
                              <div key={candidate.child_id} className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                      <Users size={14} className="text-indigo-500" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-slate-900">{candidate.name} <span className="text-xs font-normal text-slate-500">（{candidate.kana}）</span></p>
                                      <p className="text-xs text-slate-500">{candidate.class_name}{candidate.age ? ` (${candidate.age}歳)` : ''} | {candidate.enrollment_status === 'enrolled' ? '在園中' : '退所済'}</p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleSiblingLink(candidate.child_id, candidate.name, candidate.guardian_contacts)}
                                    className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 font-medium shadow-sm shrink-0"
                                  >
                                    紐付ける
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {nameSearchResults.length === 0 && !isSearchingByName && nameSearchQuery && (
                          <p className="text-xs text-slate-400">候補が見つかりませんでした</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 保護者連絡先リスト */}
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800">保護者連絡先リスト（優先順）</h3>
                      <button
                        type="button"
                        onClick={addGuardianContact}
                        disabled={!formData.parent_name || !formData.parent_phone || guardianContacts.length >= MAX_GUARDIAN_CONTACTS}
                        className="text-xs flex items-center gap-1 text-indigo-600 font-medium hover:text-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Plus size={14} /> 追加する
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">
                      筆頭保護者以外の連絡先を登録します（最大5件）。筆頭保護者の氏名と電話番号を入力後に追加できます。
                    </p>
                  </div>

                  {guardianContacts.map((contact, index) => (
                    <div key={contact.id} className="flex flex-col gap-2 bg-slate-50/50 p-3 rounded-lg group hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-200 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                          {index + 1}
                        </span>
                        {contact.guardianId && emergencyPhotoUrls[contact.guardianId] ? (
                          <button
                            type="button"
                            onClick={() => setZoomPhotoUrl(emergencyPhotoUrls[contact.guardianId!]!)}
                            className="cursor-zoom-in shrink-0"
                          >
                            <img
                              src={emergencyPhotoUrls[contact.guardianId]!}
                              alt={contact.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          </button>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                            <User size={14} className="text-slate-400" />
                          </div>
                        )}
                        {contact.guardianId && (
                          <Link
                            href={`/guardians/${contact.guardianId}`}
                            className="ml-auto mr-1 text-xs text-indigo-500 hover:text-indigo-700 underline opacity-0 group-hover:opacity-100 transition-opacity"
                            target="_blank"
                          >
                            詳細
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => removeGuardianContact(contact.id)}
                          className={`${contact.guardianId ? '' : 'ml-auto '}text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity`}
                          title="削除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          placeholder="氏名"
                          className="h-9 py-1"
                          value={contact.name}
                          onChange={(e: any) => updateGuardianContact(index, 'name', e.target.value)}
                          disabled={readOnly}
                        />
                        <Input
                          placeholder="ふりがな（不明の場合は空白）"
                          className="h-9 py-1"
                          value={contact.kana}
                          onChange={(e: any) => updateGuardianContact(index, 'kana', e.target.value)}
                          disabled={readOnly}
                        />
                        <Input
                          placeholder="続柄（例: 母、叔母など）"
                          className="h-9 py-1 sm:w-32"
                          value={contact.relation}
                          onChange={(e: any) => updateGuardianContact(index, 'relation', e.target.value)}
                          disabled={readOnly}
                        />
                        <Input
                          placeholder="電話番号"
                          className="h-9 py-1"
                          value={contact.phone}
                          onChange={(e: any) => updateGuardianContact(index, 'phone', e.target.value)}
                          onBlur={() => {
                            if (
                              contact.phone &&
                              index === guardianContacts.length - 1 &&
                              guardianContacts.length < MAX_GUARDIAN_CONTACTS
                            ) {
                              contactIdRef.current += 1;
                              setGuardianContacts(prev => [
                                ...prev,
                                { id: contactIdRef.current, guardianId: undefined, name: '', kana: '', relation: '', phone: '' },
                              ]);
                            }
                          }}
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* 4. ケア・権限設定 */}
              <SectionCard
                id="care"
                title="ケア・権限設定"
                icon={Shield}
                description="アレルギーや配慮事項、プライバシー権限を設定します。"
                isActive={activeSection === 'care'}
              >
                {/* アレルギー設定 */}
                <div className="border border-slate-200 rounded-lg p-5 bg-slate-50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-full bg-orange-100 text-orange-600">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-700">アレルギー情報</h3>
                      <p className="text-xs text-slate-500">
                        除去食の対応が必要な項目を入力してください。
                      </p>
                    </div>
                  </div>

                  <div className="pl-0 sm:pl-14">
                    <FieldGroup label="詳細・除去品目" className="mb-2">
                      <Textarea
                        className="border-orange-200 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="例: 卵、そば、キウイフルーツ。完全除去か微量なら可かなど詳細に記載。"
                        value={formData.allergies}
                        onChange={(e: any) => updateFormData({ allergies: e.target.value })}
                      />
                    </FieldGroup>
                    <div className="flex items-start gap-2 text-orange-800 bg-orange-100/50 p-3 rounded text-xs leading-relaxed">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>この情報は調理室および担任タブレットでハイライト表示されます。医師の診断書の提出も別途必要です。</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Heart size={16} className="text-pink-500" /> 特性・配慮事項</h4>
                    <FieldGroup label="子どもの特性">
                      <Textarea
                        placeholder="例: 大きな音が苦手、特定の布製品にこだわりがある等"
                        value={formData.child_characteristics}
                        onChange={(e: any) => updateFormData({ child_characteristics: e.target.value })}
                      />
                    </FieldGroup>
                    <FieldGroup label="保護者の状況・要望">
                      <Textarea
                        placeholder="例: 日本語があまり得意ではないため、ゆっくり話す必要がある等"
                        value={formData.parent_characteristics}
                        onChange={(e: any) => updateFormData({ parent_characteristics: e.target.value })}
                      />
                    </FieldGroup>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Shield size={16} className="text-teal-500" /> 権限・プライバシー</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                        <Switch
                          label="HP/SNSへの写真掲載"
                          description="園だより等への顔写真掲載許可"
                          checked={formData.photo_permission_public}
                          onChange={(checked: boolean) => updateFormData({ photo_permission_public: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                        <Switch
                          label="レポートへの記名"
                          description="クラス内共有物への名前記載"
                          checked={formData.photo_permission_share}
                          onChange={(checked: boolean) => updateFormData({ photo_permission_share: checked })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>

            </form>
            </fieldset>
          </main>
        </div>
      </div>

      {/* 写真拡大モーダル */}
      {zoomPhotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setZoomPhotoUrl(null)}
        >
          <img
            src={zoomPhotoUrl}
            alt="保護者写真"
            className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6">
          <button
            type="button"
            onClick={() => router.push('/children')}
            className="text-slate-500 hover:text-slate-800 font-medium text-sm px-4 py-2 transition-colors"
          >
            {readOnly ? '戻る' : 'キャンセル'}
          </button>
          {!readOnly && (
            <div className="flex items-center gap-4">
              <button
                type="submit"
                form="child-form"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-8 rounded-lg shadow-md shadow-indigo-200 hover:shadow-lg transition-all text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    {isEditMode ? '更新中...' : '登録中...'}
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    {isEditMode ? '更新する' : '登録する'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
