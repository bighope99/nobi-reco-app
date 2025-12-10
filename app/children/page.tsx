"use client"
import React, { useState, useMemo, useEffect } from 'react';
import { StaffLayout } from "@/components/layout/staff-layout";

import {
    Search,
    Filter,
    Plus,
    MoreHorizontal,
    Phone,
    ChevronRight,
    ArrowUpDown,
    Baby,
    Power,
    RotateCcw,
    Users
} from 'lucide-react';

// --- Types ---

type ContractType = 'regular' | 'temporary' | 'spot';
type EnrollmentStatus = 'enrolled' | 'withdrawn' | 'suspended';
type StatusType = 'active' | 'inactive';

interface APIChild {
    child_id: string;
    name: string;
    kana: string;
    gender: 'male' | 'female';
    birth_date: string;
    grade: string;
    class_id: string | null;
    class_name: string;
    enrollment_status: EnrollmentStatus;
    contract_type: ContractType;
    has_allergy: boolean;
    allergy_detail: string | null;
    photo_allowed: boolean;
    report_allowed: boolean;
    parent_name: string | null;
    parent_phone: string | null;
    siblings: Array<{ child_id: string; name: string; relationship: string }>;
    created_at: string;
    updated_at: string;
}

interface ChildrenAPIResponse {
    success: boolean;
    data: {
        children: APIChild[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            total_pages: number;
        };
        summary: {
            total_children: number;
            enrolled: number;
            withdrawn: number;
            suspended: number;
        };
        filters: {
            classes: Array<{ class_id: string; class_name: string }>;
        };
    };
    error?: string;
}

interface Student {
    id: string;
    name: string;
    kana: string;
    gender: 'male' | 'female';
    birthDate: string;
    grade: string;
    gradeOrder: number;
    className: string;
    parentName: string;
    parentPhone: string;
    siblings: string[];
    hasAllergy: boolean;
    allergyDetail?: string;
    photoAllowed: boolean;
    reportAllowed: boolean;
    status: StatusType;
    contractType: ContractType;
}

type SortKey = 'name' | 'grade' | 'className' | 'contractType' | 'allergy' | 'siblings';
type SortOrder = 'asc' | 'desc';

// --- Helper Functions ---

const convertAPIChildToStudent = (apiChild: APIChild): Student => {
    // Extract grade order from grade string (e.g., "1年生" -> 1)
    const gradeMatch = apiChild.grade.match(/(\d+)/);
    const gradeOrder = gradeMatch ? parseInt(gradeMatch[1]) : 0;

    // Map enrollment_status to status
    const status: StatusType = apiChild.enrollment_status === 'enrolled' ? 'active' : 'inactive';

    // Format siblings array
    const siblings = apiChild.siblings.map(s => s.name);

    return {
        id: apiChild.child_id,
        name: apiChild.name,
        kana: apiChild.kana,
        gender: apiChild.gender,
        birthDate: apiChild.birth_date,
        grade: apiChild.grade,
        gradeOrder,
        className: apiChild.class_name,
        parentName: apiChild.parent_name || '',
        parentPhone: apiChild.parent_phone || '',
        siblings,
        hasAllergy: apiChild.has_allergy,
        allergyDetail: apiChild.allergy_detail || undefined,
        photoAllowed: apiChild.photo_allowed,
        reportAllowed: apiChild.report_allowed,
        status,
        contractType: apiChild.contract_type,
    };
};

// --- Components ---

export default function StudentList() {
    // State
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterClass, setFilterClass] = useState('all');
    const [activeTab, setActiveTab] = useState<StatusType>('active');
    const [classOptions, setClassOptions] = useState<Array<{ class_id: string; class_name: string }>>([]);
    const [totalCount, setTotalCount] = useState(0);

    // Sort State
    const [sortKey, setSortKey] = useState<SortKey>('grade');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

    // Fetch children data from API
    useEffect(() => {
        const fetchChildren = async () => {
            try {
                setLoading(true);
                setError(null);

                const params = new URLSearchParams();

                // Map activeTab to enrollment status
                if (activeTab === 'active') {
                    params.append('status', 'enrolled');
                } else {
                    params.append('status', 'withdrawn');
                }

                if (filterClass !== 'all') {
                    params.append('class_id', filterClass);
                }

                if (searchTerm) {
                    params.append('search', searchTerm);
                }

                const response = await fetch(`/api/children?${params.toString()}`);
                const result: ChildrenAPIResponse = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Failed to fetch children');
                }

                if (result.success) {
                    const convertedStudents = result.data.children.map(convertAPIChildToStudent);
                    setStudents(convertedStudents);
                    setClassOptions(result.data.filters.classes);
                    setTotalCount(result.data.summary.total_children);
                }
            } catch (err) {
                console.error('Failed to fetch children:', err);
                setError(err instanceof Error ? err.message : 'Failed to fetch children');
            } finally {
                setLoading(false);
            }
        };

        fetchChildren();
    }, [activeTab, filterClass, searchTerm]);

    // Toggle Status Function (Now updates via API)
    const toggleStatus = async (id: string, currentStatus: StatusType) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        const newEnrollmentStatus = newStatus === 'active' ? 'enrolled' : 'withdrawn';

        if (confirm(`${currentStatus === 'active' ? '退所済みに変更' : '所属中に復帰'}しますか？`)) {
            try {
                const response = await fetch(`/api/children/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        affiliation: { enrollment_status: newEnrollmentStatus }
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to update status');
                }

                // Optimistically update UI
                setStudents(prev => prev.map(s =>
                    s.id === id ? { ...s, status: newStatus } : s
                ));
            } catch (err) {
                console.error('Failed to update status:', err);
                alert('ステータスの更新に失敗しました');
            }
        }
    };

    // Sort Handler
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('asc');
        }
    };

    // Filter & Sort Logic
    const processedStudents = useMemo(() => {
        // 1. Filter
        let result = students.filter(student => {
            // Status Tab Filter
            if (student.status !== activeTab) return false;

            // Search Text
            const matchText =
                student.name.includes(searchTerm) ||
                student.kana.includes(searchTerm) ||
                student.parentName.includes(searchTerm);
            if (!matchText) return false;

            // Class Filter
            if (filterClass !== 'all' && student.className !== filterClass) return false;

            return true;
        });

        // 2. Sort
        result.sort((a, b) => {
            let comparison = 0;
            switch (sortKey) {
                case 'name':
                    comparison = a.kana.localeCompare(b.kana);
                    break;
                case 'grade':
                    comparison = a.gradeOrder - b.gradeOrder;
                    break;
                case 'className':
                    comparison = a.className.localeCompare(b.className);
                    break;
                case 'contractType':
                    comparison = a.contractType.localeCompare(b.contractType);
                    break;
                case 'allergy':
                    comparison = (a.hasAllergy === b.hasAllergy) ? 0 : a.hasAllergy ? -1 : 1;
                    break;
                case 'siblings':
                    // 兄弟の数でソート
                    comparison = a.siblings.length - b.siblings.length;
                    break;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [students, searchTerm, filterClass, activeTab, sortKey, sortOrder]);

    // Helper: Contract Badge
    const getContractBadge = (type: ContractType) => {
        switch (type) {
            case 'regular': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 whitespace-nowrap" > 通年 </span>;
            case 'temporary': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100 whitespace-nowrap" > 一時 </span>;
            case 'spot': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap" > スポット </span>;
        }
    };

    // Helper: Sort Icon
    const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
        if (sortKey !== columnKey) return <ArrowUpDown size={12} className="text-slate-300 opacity-50" />;
        return (
            <ArrowUpDown
                size={12}
                className={`text-indigo-600 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`
                }
            />
        );
    };

    return (
        <StaffLayout title="園児管理">
            <div className="min-h-screen bg-gray-50 text-slate-900 font-sans" >
                <style>
                    {`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');`}
                </style>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ fontFamily: '"Noto Sans JP", sans-serif' }}>

                    {/* Header Area */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6" >
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2" >
                                <Baby className="text-indigo-500" />
                                児童台帳
                            </h1>
                            <p className="text-sm text-slate-500 mt-1" >
                                {loading ? '読み込み中...' : `全 ${totalCount} 名の児童情報を管理 （${activeTab === 'active' ? '所属中' : '退所済み'} 表示中）`}
                            </p>
                        </div>

                        <button
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg shadow-sm transition-colors font-bold text-sm"
                            onClick={() => window.location.href = '/children/new'}
                        >
                            <Plus size={18} />
                            新規登録
                        </button>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex items-center gap-1 mb-0 border-b border-gray-200" >
                        <button
                            onClick={() => setActiveTab('active')}
                            className={`px-6 py-2.5 text-sm font-bold border-b-2 transition-colors ${activeTab === 'active'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                }`}
                        >
                            所属中
                        </button>
                        <button
                            onClick={() => setActiveTab('inactive')}
                            className={`px-6 py-2.5 text-sm font-bold border-b-2 transition-colors ${activeTab === 'inactive'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                }`}
                        >
                            退所済み
                        </button>
                    </div>

                    {/* Filter Toolbar */}
                    <div className="bg-white p-4 rounded-b-xl border border-t-0 border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between" >

                        {/* Left: Search & Class Filter */}
                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto" >
                            <div className="relative" >
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="名前・保護者名で検索..."
                                    className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-full sm:w-auto" >
                                <Filter size={16} className="text-slate-400" />
                                <select
                                    className="bg-transparent border-none text-sm text-slate-700 focus:ring-0 cursor-pointer p-0 min-w-[120px]"
                                    value={filterClass}
                                    onChange={(e) => setFilterClass(e.target.value)}
                                >
                                    <option value="all" > 全クラス </option>
                                    {
                                        classOptions.map(cls => (
                                            <option key={cls.class_id} value={cls.class_id} > {cls.class_name} </option>
                                        ))
                                    }
                                </select>
                            </div>
                        </div>

                        {/* Right: Menu */}
                        <div className="flex items-center gap-4 w-full md:w-auto justify-end" >
                            <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" >
                                <MoreHorizontal size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Error State */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                            <p className="text-red-600 text-sm">エラー: {error}</p>
                        </div>
                    )}

                    {/* Student List Table */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" >
                        {loading ? (
                            <div className="p-12 text-center text-slate-400">
                                <p>読み込み中...</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto" >
                                <table className="w-full text-left border-collapse min-w-[1100px]" >
                                <thead className="bg-gray-50 border-b border-gray-100" >
                                    <tr>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-12 text-center" >
                                            状態
                                        </th>
                                        <th
                                            className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-48 cursor-pointer hover:bg-gray-100 transition-colors select-none group"
                                            onClick={() => handleSort('name')}
                                        >
                                            <div className="flex items-center gap-1" >
                                                児童名
                                                <SortIcon columnKey="name" />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32 cursor-pointer hover:bg-gray-100 transition-colors select-none group"
                                            onClick={() => handleSort('grade')}
                                        >
                                            <div className="flex items-center gap-1" >
                                                学年
                                                <SortIcon columnKey="grade" />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-36 cursor-pointer hover:bg-gray-100 transition-colors select-none group"
                                            onClick={() => handleSort('className')}
                                        >
                                            <div className="flex items-center gap-1" >
                                                クラス
                                                <SortIcon columnKey="className" />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28 cursor-pointer hover:bg-gray-100 transition-colors select-none group"
                                            onClick={() => handleSort('contractType')}
                                        >
                                            <div className="flex items-center gap-1" >
                                                契約
                                                <SortIcon columnKey="contractType" />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-48 cursor-pointer hover:bg-gray-100 transition-colors select-none group"
                                            onClick={() => handleSort('siblings')}
                                        >
                                            <div className="flex items-center gap-1" >
                                                兄弟
                                                <SortIcon columnKey="siblings" />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-48 cursor-pointer hover:bg-gray-100 transition-colors select-none group"
                                            onClick={() => handleSort('allergy')}
                                        >
                                            <div className="flex items-center gap-1" >
                                                アレルギー
                                                <SortIcon columnKey="allergy" />
                                            </div>
                                        </th>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-48" > 保護者連絡先 </th>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-12" > </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100" >
                                    {
                                        processedStudents.map((student) => (
                                            <tr
                                                key={student.id}
                                                className={`group transition-colors cursor-pointer ${student.status === 'inactive' ? 'bg-slate-50/50' : 'hover:bg-indigo-50/30'}`}
                                                onClick={() => window.location.href = `/children/${student.id}/edit`}
                                            >
                                                {/* Status Toggle */}
                                                <td className="px-6 py-4 text-center" >
                                                    <button
                                                        onClick={
                                                            (e) => {
                                                                e.stopPropagation();
                                                                toggleStatus(student.id, student.status);
                                                            }
                                                        }
                                                        className={`p-1.5 rounded-full border transition-all ${student.status === 'active'
                                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                                                            : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200'
                                                            }`}
                                                        title={student.status === 'active' ? "退所にする" : "復帰させる"}
                                                    >
                                                        {student.status === 'active' ? <Power size={16} /> : <RotateCcw size={16} />}
                                                    </button>
                                                </td>

                                                {/* Name */}
                                                <td className="px-6 py-4" >
                                                    <div>
                                                        <div className="flex items-center gap-2" >
                                                            <span className={`font-bold text-base ${student.status === 'inactive' ? 'text-slate-400' : 'text-slate-800'}`}>
                                                                {student.name}
                                                            </span>
                                                            {
                                                                student.status === 'inactive' && (
                                                                    <span className="px-1.5 py-0.5 bg-gray-200 text-gray-500 text-[10px] rounded font-bold" > 退所 </span>
                                                                )
                                                            }
                                                        </div>
                                                        <div className="text-xs text-slate-400 mt-0.5 font-mono" >
                                                            {student.kana}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Grade */}
                                                <td className="px-6 py-4" >
                                                    <span className="text-sm font-medium text-slate-700" > {student.grade} </span>
                                                </td>

                                                {/* Class */}
                                                <td className="px-6 py-4" >
                                                    <span className="text-sm text-slate-600" > {student.className} </span>
                                                </td>

                                                {/* Contract Type */}
                                                <td className="px-6 py-4" >
                                                    {getContractBadge(student.contractType)}
                                                </td>

                                                {/* Siblings */}
                                                <td className="px-6 py-4" >
                                                    {
                                                        student.siblings.length > 0 ? (
                                                            <div className="flex items-center gap-1 text-sm text-slate-600" >
                                                                <Users size={14} className="text-indigo-400" />
                                                                <span className="truncate" title={student.siblings.join(', ')} >
                                                                    {student.siblings[0]} {student.siblings.length > 1 && `他${student.siblings.length - 1}名`}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300 text-sm" > -</span>
                                                        )}
                                                </td>

                                                {/* Allergy (Max 2 lines) */}
                                                <td className="px-6 py-4" >
                                                    {
                                                        student.hasAllergy ? (
                                                            <div
                                                                className="text-sm text-rose-600 font-medium leading-tight line-clamp-2"
                                                                title={student.allergyDetail}
                                                            >
                                                                {student.allergyDetail || 'あり'}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300 text-sm" > -</span>
                                                        )}
                                                </td>

                                                {/* Parent Contact */}
                                                <td className="px-6 py-4" >
                                                    <div className="flex items-center gap-3" >
                                                        <button
                                                            className="p-2 rounded-full bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors border border-slate-100 shrink-0"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                alert(`発信: ${student.parentPhone}`);
                                                            }}
                                                        >
                                                            <Phone size={14} />
                                                        </button>
                                                        <div className="text-sm truncate" >
                                                            <div className="font-medium text-slate-700" > {student.parentName} </div>
                                                            <div className="text-xs text-slate-400 font-mono" > {student.parentPhone} </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Action */}
                                                <td className="px-6 py-4 text-right" >
                                                    <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>

                            {
                                processedStudents.length === 0 && !loading && (
                                    <div className="p-12 text-center text-slate-400" >
                                        <p>該当する児童は見つかりませんでした </p>
                                    </div>
                                )
                            }
                        </div>
                        )}
                    </div>

                </div>
            </div>
        </StaffLayout>
    );
}