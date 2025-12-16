"use client"
import React, { useState, useEffect } from 'react';
import {
  User,
  Users,
  Phone,
  Mail,
  AlertTriangle,
  Heart,
  Shield,
  Camera,
  Search,
  Plus,
  Trash2,
  Check,
  ChevronRight,
  Save,
  Building2,
  School,
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
}

export default function ChildForm({ mode, childId, onSuccess }: ChildFormProps) {
  const isEditMode = mode === 'edit';
  const [activeSection, setActiveSection] = useState('basic');
  const [isSearchingSibling, setIsSearchingSibling] = useState(false);
  const [siblingResult, setSiblingResult] = useState<any>(null);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<Array<{ class_id: string; class_name: string }>>([]);
  const [schools, setSchools] = useState<Array<{ school_id: string; name: string }>>([]);

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

    // 所属・契約
    enrollment_status: 'enrolled' as 'enrolled' | 'withdrawn' | 'suspended',
    enrollment_type: 'regular' as 'regular' | 'temporary' | 'spot',
    enrolled_at: '',
    withdrawn_at: '',
    class_id: '',

    // 連絡先
    parent_name: '',
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

  const [emergencyContacts, setEmergencyContacts] = useState([
    { id: 1, name: '', relation: '', phone: '' }
  ]);

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
            enrollment_status: data.affiliation?.enrollment_status || 'enrolled',
            enrollment_type: data.affiliation?.enrollment_type || 'regular',
            enrolled_at: data.affiliation?.enrolled_at ? data.affiliation.enrolled_at.split('T')[0] : '',
            withdrawn_at: data.affiliation?.withdrawn_at ? data.affiliation.withdrawn_at.split('T')[0] : '',
            class_id: data.affiliation?.class_id || '',
            parent_name: '',
            parent_phone: data.contact?.parent_phone || '',
            parent_email: data.contact?.parent_email || '',
            allergies: data.care_info?.allergies || '',
            child_characteristics: data.care_info?.child_characteristics || '',
            parent_characteristics: data.care_info?.parent_characteristics || '',
            photo_permission_public: data.permissions?.photo_permission_public ?? true,
            photo_permission_share: data.permissions?.photo_permission_share ?? true,
          });
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

  // デモ用: スクロールスパイの実装
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['basic', 'affiliation', 'family', 'care'];
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top >= 0 && rect.top <= 300) {
            setActiveSection(section);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 兄弟検索ロジック
  const handleSiblingSearch = async () => {
    // 電話番号が入力されていない場合はスキップ
    if (!formData.parent_phone) {
      setError('電話番号を入力してください');
      return;
    }

    setIsSearchingSibling(true);
    setSiblingResult(null);
    setError(null);

    try {
      const response = await fetch('/api/children/search-siblings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formData.parent_phone }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '検索に失敗しました');
      }

      if (result.success && result.data.found && result.data.candidates.length > 0) {
        // 最初の候補を表示
        const candidate = result.data.candidates[0];
        setSiblingResult({
          id: candidate.child_id,
          name: candidate.name,
          kana: candidate.kana,
          class: `${candidate.class_name}${candidate.age ? ` (${candidate.age}歳)` : ''}`,
          status: candidate.enrollment_status === 'enrolled' ? '在園中' : '退所済',
          image: candidate.photo_url || 'https://i.pravatar.cc/150?u=default'
        });
      } else {
        setError('同じ電話番号の児童が見つかりませんでした');
      }
    } catch (err) {
      console.error('Failed to search siblings:', err);
      setError(err instanceof Error ? err.message : '兄弟検索に失敗しました');
    } finally {
      setIsSearchingSibling(false);
    }
  };

  const addEmergencyContact = () => {
    setEmergencyContacts([...emergencyContacts, { id: Date.now(), name: '', relation: '', phone: '' }]);
  };

  const removeEmergencyContact = (id: number) => {
    setEmergencyContacts(emergencyContacts.filter(c => c.id !== id));
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 生年月日の組み立て
    const birthDate = formData.birth_year && formData.birth_month && formData.birth_day
      ? `${formData.birth_year}-${formData.birth_month.padStart(2, '0')}-${formData.birth_day.padStart(2, '0')}`
      : (isEditMode ? formData.birth_date : '');

    // Validation
    if (!formData.family_name || !formData.given_name || !birthDate || !formData.school_id || !formData.enrolled_at) {
      setError('必須項目を入力してください（氏名、生年月日、学校、入所開始日は必須です）');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const requestBody = {
        child_id: isEditMode ? childId : undefined,
        basic_info: {
          family_name: formData.family_name,
          given_name: formData.given_name,
          family_name_kana: formData.family_name_kana,
          given_name_kana: formData.given_name_kana,
          nickname: formData.nickname,
          gender: formData.gender,
          birth_date: birthDate,
          school_id: formData.school_id || null,
        },
        affiliation: {
          enrollment_status: formData.enrollment_status,
          enrollment_type: formData.enrollment_type,
          enrolled_at: formData.enrolled_at,
          withdrawn_at: formData.withdrawn_at || null,
          class_id: formData.class_id || null,
        },
        contact: {
          parent_phone: formData.parent_phone,
          parent_email: formData.parent_email,
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
        alert(isEditMode ? '児童情報を更新しました' : '児童を登録しました');
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.href = '/children';
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-600 pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
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
                      <Camera size={24} className="mb-1" />
                      <span className="text-xs font-medium">写真を追加</span>
                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" />
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
                          onChange={(e: any) => setFormData({ ...formData, family_name: e.target.value })}
                        />
                        <Input
                          placeholder="名"
                          value={formData.given_name}
                          onChange={(e: any) => setFormData({ ...formData, given_name: e.target.value })}
                        />
                      </div>
                    </FieldGroup>
                    <FieldGroup label="氏名（フリガナ）" required>
                      <div className="flex gap-2">
                        <Input
                          placeholder="セイ"
                          value={formData.family_name_kana}
                          onChange={(e: any) => setFormData({ ...formData, family_name_kana: e.target.value })}
                        />
                        <Input
                          placeholder="メイ"
                          value={formData.given_name_kana}
                          onChange={(e: any) => setFormData({ ...formData, given_name_kana: e.target.value })}
                        />
                      </div>
                    </FieldGroup>

                    <FieldGroup label="呼び名（愛称）">
                      <Input
                        placeholder="例: れんくん"
                        value={formData.nickname}
                        onChange={(e: any) => setFormData({ ...formData, nickname: e.target.value })}
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
                            onChange={(e) => setFormData({ ...formData, gender: 'male' })}
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
                            onChange={(e) => setFormData({ ...formData, gender: 'female' })}
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
                          onChange={(e: any) => setFormData({ ...formData, birth_year: e.target.value })}
                          min="1900"
                          max={new Date().getFullYear()}
                        />
                        <span className="text-slate-500">年</span>
                        <Input
                          type="number"
                          placeholder="月"
                          className="max-w-[80px]"
                          value={formData.birth_month}
                          onChange={(e: any) => setFormData({ ...formData, birth_month: e.target.value })}
                          min="1"
                          max="12"
                        />
                        <span className="text-slate-500">月</span>
                        <Input
                          type="number"
                          placeholder="日"
                          className="max-w-[80px]"
                          value={formData.birth_day}
                          onChange={(e: any) => setFormData({ ...formData, birth_day: e.target.value })}
                          min="1"
                          max="31"
                        />
                        <span className="text-slate-500">日</span>
                      </div>
                    </FieldGroup>

                    <FieldGroup label="通学している学校" required className="sm:col-span-2">
                      <Select
                        value={formData.school_id}
                        onChange={(e: any) => setFormData({ ...formData, school_id: e.target.value })}
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
                  </div>
                </div>
              </SectionCard>

              {/* 2. 所属・契約 */}
              <SectionCard
                id="affiliation"
                title="所属・契約"
                icon={Building2}
                description="園でのステータスや所属クラスを管理します。"
                isActive={activeSection === 'affiliation'}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FieldGroup label="ステータス" required>
                    <Select
                      value={formData.enrollment_status}
                      onChange={(e: any) => setFormData({ ...formData, enrollment_status: e.target.value as any })}
                    >
                      <option value="enrolled">在籍中</option>
                      <option value="suspended">休園中</option>
                      <option value="withdrawn">退所済</option>
                    </Select>
                  </FieldGroup>

                  <FieldGroup label="契約形態" required>
                    <Select
                      value={formData.enrollment_type}
                      onChange={(e: any) => setFormData({ ...formData, enrollment_type: e.target.value as any })}
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
                      onChange={(e: any) => setFormData({ ...formData, enrolled_at: e.target.value })}
                    />
                  </FieldGroup>

                  <FieldGroup label="退所日（退所後に入力）">
                    <Input
                      type="date"
                      placeholder="未定"
                      value={formData.withdrawn_at}
                      onChange={(e: any) => setFormData({ ...formData, withdrawn_at: e.target.value })}
                    />
                  </FieldGroup>

                  <FieldGroup label="現在のクラス">
                    <Select
                      value={formData.class_id}
                      onChange={(e: any) => setFormData({ ...formData, class_id: e.target.value })}
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
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FieldGroup label="保護者氏名" required>
                      <Input
                        placeholder="佐藤 太郎"
                        value={formData.parent_name}
                        onChange={(e: any) => setFormData({ ...formData, parent_name: e.target.value })}
                      />
                    </FieldGroup>
                    <FieldGroup label="メールアドレス">
                      <Input
                        icon={Mail}
                        type="email"
                        placeholder="example@email.com"
                        value={formData.parent_email}
                        onChange={(e: any) => setFormData({ ...formData, parent_email: e.target.value })}
                      />
                    </FieldGroup>

                    {/* 兄弟紐づけトリガー */}
                    <FieldGroup label="携帯電話番号" required className="relative sm:col-span-2">
                      <div className="flex gap-2">
                        <Input
                          icon={Phone}
                          type="tel"
                          placeholder="090-0000-0000"
                          value={formData.parent_phone}
                          onChange={(e: any) => setFormData({ ...formData, parent_phone: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={handleSiblingSearch}
                          className="shrink-0 bg-white border border-indigo-200 text-indigo-600 px-4 rounded-lg text-sm font-medium hover:bg-indigo-50 hover:border-indigo-300 transition-colors flex items-center gap-2 shadow-sm"
                        >
                          {isSearchingSibling ? <div className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full"></div> : <Search size={16} />}
                          兄弟検索
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">※この番号で既存児童を検索し、紐付け候補を表示します。</p>
                    </FieldGroup>
                  </div>

                  {/* Sibling Result Card */}
                  {siblingResult && (
                    <div className="mt-4 bg-indigo-50/50 border border-indigo-100 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1 block">兄弟候補が見つかりました</span>
                          <div className="flex items-center gap-3">
                            <img src={siblingResult.image} alt="" className="w-10 h-10 rounded-full bg-slate-200 border border-white shadow-sm" />
                            <div>
                              <p className="text-sm font-bold text-slate-900">{siblingResult.name} <span className="text-xs font-normal text-slate-500">（{siblingResult.kana}）</span></p>
                              <p className="text-xs text-slate-500">{siblingResult.class} | {siblingResult.status}</p>
                            </div>
                          </div>
                        </div>
                        <button type="button" className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 font-medium flex items-center gap-1 shadow-sm">
                          <Check size={12} /> 紐付ける
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 緊急連絡先リスト */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-bold text-slate-800">緊急連絡先リスト（優先順）</h3>
                    <button type="button" onClick={addEmergencyContact} className="text-xs flex items-center gap-1 text-indigo-600 font-medium hover:text-indigo-800">
                      <Plus size={14} /> 追加する
                    </button>
                  </div>

                  {emergencyContacts.map((contact, index) => (
                    <div key={contact.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-slate-50/50 p-3 rounded-lg group hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
                      <span className="bg-slate-200 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                        {index + 1}
                      </span>
                      <Input placeholder="氏名" className="h-9 py-1" />
                      <Input placeholder="続柄" className="h-9 py-1 sm:w-24" />
                      <Input placeholder="電話番号" className="h-9 py-1" />
                      <button
                        type="button"
                        onClick={() => removeEmergencyContact(contact.id)}
                        className="text-slate-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="削除"
                      >
                        <Trash2 size={16} />
                      </button>
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
                        onChange={(e: any) => setFormData({ ...formData, allergies: e.target.value })}
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
                        onChange={(e: any) => setFormData({ ...formData, child_characteristics: e.target.value })}
                      />
                    </FieldGroup>
                    <FieldGroup label="保護者の状況・要望">
                      <Textarea
                        placeholder="例: 日本語があまり得意ではないため、ゆっくり話す必要がある等"
                        value={formData.parent_characteristics}
                        onChange={(e: any) => setFormData({ ...formData, parent_characteristics: e.target.value })}
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
                          onChange={(checked: boolean) => setFormData({ ...formData, photo_permission_public: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                        <Switch
                          label="レポートへの記名"
                          description="クラス内共有物への名前記載"
                          checked={formData.photo_permission_share}
                          onChange={(checked: boolean) => setFormData({ ...formData, photo_permission_share: checked })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>

            </form>
          </main>
        </div>
      </div>

      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6">
          <button
            type="button"
            onClick={() => window.location.href = '/children'}
            className="text-slate-500 hover:text-slate-800 font-medium text-sm px-4 py-2 transition-colors"
          >
            キャンセル
          </button>
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
        </div>
      </div>
    </div>
  );
}

