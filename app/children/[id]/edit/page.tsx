
"use client"
import React, { useState, useEffect, useRef } from 'react';
import { StaffLayout } from "@/components/layout/staff-layout";

import {
  User,
  Calendar,
  Users,
  Briefcase,
  Phone,
  Mail,
  AlertTriangle,
  Heart,
  Shield,
  Camera,
  Upload,
  Search,
  Plus,
  Trash2,
  Check,
  ChevronRight,
  Save,
  X,
  Building2,
  Baby,
  FileText
} from 'lucide-react';

/**
 * ============================================================================
 * Design System Components & Utilities
 * ============================================================================
 */

// カラーパレット定数（Tailwindクラスとして使用する前提ですが、概念として定義）
// Primary: Indigo-600
// Text Main: Slate-900
// Text Sub: Slate-500
// Border: Slate-200
// Background: Slate-50

// セクションカード: 各入力グループをまとめる白いカード
const SectionCard = ({ id, title, icon: Icon, description, children, isActive }: any) => (
  <section
    id={id}
    className={`bg - white rounded - xl border transition - all duration - 300 scroll - mt - 24 mb - 8 ${isActive ? 'border-indigo-200 shadow-md ring-1 ring-indigo-50' : 'border-slate-200 shadow-sm'
      } `}
  >
    <div className="px-6 py-5 border-b border-slate-100 flex items-start gap-4">
      <div className={`p - 2.5 rounded - lg shrink - 0 ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'} `}>
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
  <div className={`flex flex - col gap - 2 ${className} `}>
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
      className={`w - full bg - white border border - slate - 300 text - slate - 900 text - sm rounded - lg focus: ring - 2 focus: ring - indigo - 500 focus: border - indigo - 500 block p - 2.5 transition - all placeholder: text - slate - 400 disabled: bg - slate - 50 disabled: text - slate - 500 ${Icon ? 'pl-10' : ''} ${className} `}
      {...props}
    />
  </div>
);

// セレクトボックス
const Select = ({ children, className = "", ...props }: any) => (
  <div className="relative">
    <select
      className={`w - full bg - white border border - slate - 300 text - slate - 900 text - sm rounded - lg focus: ring - 2 focus: ring - indigo - 500 focus: border - indigo - 500 block p - 2.5 appearance - none cursor - pointer transition - shadow ${className} `}
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
    className={`w - full bg - white border border - slate - 300 text - slate - 900 text - sm rounded - lg focus: ring - 2 focus: ring - indigo - 500 focus: border - indigo - 500 block p - 3 min - h - [100px] transition - all resize - y placeholder: text - slate - 400 ${className} `}
    {...props}
  />
);

// スイッチ（トグル）
const Switch = ({ checked, onChange, label, description }: any) => (
  <div className="flex items-start gap-3 cursor-pointer group" onClick={() => onChange(!checked)}>
    <div
      className={`relative inline - flex h - 6 w - 11 shrink - 0 cursor - pointer rounded - full border - 2 border - transparent transition - colors duration - 200 ease -in -out focus: outline - none focus - visible: ring - 2 focus - visible: ring - indigo - 600 focus - visible: ring - offset - 2 ${checked ? 'bg-indigo-600' : 'bg-slate-200'} `}
    >
      <span
        aria-hidden="true"
        className={`pointer - events - none inline - block h - 5 w - 5 transform rounded - full bg - white shadow ring - 0 transition duration - 200 ease -in -out ${checked ? 'translate-x-5' : 'translate-x-0'} `}
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
 * Main Application Component
 * ============================================================================
 */
export default function ChildRegistrationForm() {
  const [activeSection, setActiveSection] = useState('basic');
  const [isSearchingSibling, setIsSearchingSibling] = useState(false);
  const [siblingResult, setSiblingResult] = useState<any>(null);
  const [hasAllergy, setHasAllergy] = useState(false);

  // フォームの状態（一部抜粋）
  const [emergencyContacts, setEmergencyContacts] = useState([
    { id: 1, name: '', relation: '', phone: '' }
  ]);

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

  // 兄弟検索ロジック（モック）
  const handleSiblingSearch = () => {
    setIsSearchingSibling(true);
    // 擬似的なAPIコール
    setTimeout(() => {
      setSiblingResult({
        id: 101,
        name: '佐藤 蓮',
        kana: 'サトウ レン',
        class: 'きりん組（4歳児）',
        status: '在園中',
        image: 'https://i.pravatar.cc/150?u=ren'
      });
      setIsSearchingSibling(false);
    }, 1000);
  };

  const addEmergencyContact = () => {
    setEmergencyContacts([...emergencyContacts, { id: Date.now(), name: '', relation: '', phone: '' }]);
  };

  const removeEmergencyContact = (id: number) => {
    setEmergencyContacts(emergencyContacts.filter(c => c.id !== id));
  };

  return (
    <StaffLayout title="園児編集">
      <div className="min-h-screen bg-slate-50 font-sans text-slate-600 pb-24">

        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center text-sm text-slate-500 gap-2">
                <span className="hover:text-indigo-600 cursor-pointer">児童台帳</span>
                <ChevronRight size={14} />
                <span className="font-medium text-slate-900">新規登録</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-medium border border-indigo-100">
                編集中...
              </span>
            </div>
          </div>
        </header>

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
                  href={`#${item.id} `}
                  className={`flex items - center gap - 3 px - 3 py - 2.5 text - sm font - medium rounded - lg transition - all ${activeSection === item.id
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    } `}
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
              <form onSubmit={(e) => e.preventDefault()}>

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
                          <Input placeholder="姓" />
                          <Input placeholder="名" />
                        </div>
                      </FieldGroup>
                      <FieldGroup label="氏名（フリガナ）" required>
                        <div className="flex gap-2">
                          <Input placeholder="セイ" />
                          <Input placeholder="メイ" />
                        </div>
                      </FieldGroup>

                      <FieldGroup label="呼び名（愛称）">
                        <Input placeholder="例: れんくん" />
                      </FieldGroup>

                      <FieldGroup label="性別" required>
                        <div className="flex gap-4 pt-1">
                          {['男児', '女児', 'その他'].map((gender) => (
                            <label key={gender} className="flex items-center gap-2 cursor-pointer group">
                              <input type="radio" name="gender" className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                              <span className="text-sm text-slate-700 group-hover:text-indigo-700">{gender}</span>
                            </label>
                          ))}
                        </div>
                      </FieldGroup>

                      <FieldGroup label="生年月日" required className="sm:col-span-2">
                        <div className="flex gap-2 items-center">
                          <Input type="date" className="max-w-[200px]" icon={Calendar} />
                          <span className="text-sm text-slate-500 ml-2">（満 5歳 3ヶ月）</span>
                        </div>
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
                      <Select>
                        <option>在籍中</option>
                        <option>休園中</option>
                        <option>退所済</option>
                        <option>入所前</option>
                      </Select>
                    </FieldGroup>

                    <FieldGroup label="契約形態" required>
                      <Select>
                        <option>通年契約（月極）</option>
                        <option>一時保育</option>
                        <option>スポット利用</option>
                      </Select>
                    </FieldGroup>

                    <FieldGroup label="在籍期間" required>
                      <div className="flex items-center gap-2">
                        <Input type="date" />
                        <span className="text-slate-400">~</span>
                        <Input type="date" placeholder="未定" />
                      </div>
                    </FieldGroup>

                    <FieldGroup label="現在のクラス" required>
                      <Select>
                        <option value="">クラスを選択...</option>
                        <option>ひよこ組（0歳児）</option>
                        <option>りす組（1歳児）</option>
                        <option>うさぎ組（2歳児）</option>
                        <option>きりん組（3-5歳児）</option>
                      </Select>
                    </FieldGroup>

                    <FieldGroup label="保護者勤務先（主）" className="sm:col-span-2">
                      <Input icon={Briefcase} placeholder="株式会社〇〇" />
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
                        <Input placeholder="佐藤 太郎" />
                      </FieldGroup>
                      <FieldGroup label="続柄" required>
                        <Input placeholder="父" className="max-w-[120px]" />
                      </FieldGroup>
                      <FieldGroup label="メールアドレス">
                        <Input icon={Mail} type="email" placeholder="example@email.com" />
                      </FieldGroup>

                      {/* 兄弟紐づけトリガー */}
                      <FieldGroup label="携帯電話番号" required className="relative">
                        <div className="flex gap-2">
                          <Input icon={Phone} type="tel" placeholder="090-0000-0000" />
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

                    {/* Sibling Result Card (Mock) */}
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
                  <div className={`border rounded - lg p - 5 transition - colors duration - 300 ${hasAllergy ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'} `}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p - 2 rounded - full ${hasAllergy ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 text-slate-500'} `}>
                          <AlertTriangle size={20} />
                        </div>
                        <div>
                          <h3 className={`text - sm font - bold ${hasAllergy ? 'text-orange-900' : 'text-slate-700'} `}>アレルギー有無</h3>
                          <p className={`text - xs ${hasAllergy ? 'text-orange-700' : 'text-slate-500'} `}>
                            {hasAllergy ? '除去食の対応が必要な項目を入力してください。' : 'アレルギー対応が必要な場合は有効にしてください。'}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={hasAllergy}
                        onChange={setHasAllergy}
                        label={hasAllergy ? "あり" : "なし"}
                      />
                    </div>

                    {hasAllergy && (
                      <div className="mt-4 pl-0 sm:pl-14 animate-in fade-in zoom-in-95 duration-200">
                        <FieldGroup label="詳細・除去品目" required className="mb-2">
                          <Textarea
                            className="border-orange-200 focus:ring-orange-500 focus:border-orange-500"
                            placeholder="例: 卵、そば、キウイフルーツ。完全除去か微量なら可かなど詳細に記載。"
                          />
                        </FieldGroup>
                        <div className="flex items-start gap-2 text-orange-800 bg-orange-100/50 p-3 rounded text-xs leading-relaxed">
                          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                          <span>この情報は調理室および担任タブレットでハイライト表示されます。医師の診断書の提出も別途必要です。</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Heart size={16} className="text-pink-500" /> 特性・配慮事項</h4>
                      <FieldGroup label="子どもの特性">
                        <Textarea placeholder="例: 大きな音が苦手、特定の布製品にこだわりがある等" />
                      </FieldGroup>
                      <FieldGroup label="保護者の状況・要望">
                        <Textarea placeholder="例: 日本語があまり得意ではないため、ゆっくり話す必要がある等" />
                      </FieldGroup>
                    </div>

                    <div className="space-y-6">
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Shield size={16} className="text-teal-500" /> 権限・プライバシー</h4>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                          <Switch label="HP/SNSへの写真掲載" description="園だより等への顔写真掲載許可" checked={true} onChange={() => { }} />
                        </div>
                        <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                          <Switch label="レポートへの記名" description="クラス内共有物への名前記載" checked={true} onChange={() => { }} />
                        </div>
                        <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                          <Switch label="医療行為の同意" description="緊急時の応急処置への同意" checked={false} onChange={() => { }} />
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
            <button type="button" className="text-slate-500 hover:text-slate-800 font-medium text-sm px-4 py-2 transition-colors">
              キャンセル
            </button>
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-400 hidden sm:inline">最終保存: 10分前</span>
              <button type="button" className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold py-2.5 px-6 rounded-lg shadow-sm transition-all text-sm">
                一時保存
              </button>
              <button type="button" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-8 rounded-lg shadow-md shadow-indigo-200 hover:shadow-lg transition-all text-sm flex items-center gap-2">
                <Save size={18} />
                登録する
              </button>
            </div>
          </div>
        </div>

      </div>
    </StaffLayout>
  );
}