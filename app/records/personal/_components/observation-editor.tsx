'use client';

import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BookOpen,
  Calendar,
  User,
  Clock,
  RefreshCw,
  SwitchCamera,
  Loader2,
  CheckCircle,
  Brain,
  MessageSquare,
  Hash,
  FileText,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import { mockChildren } from '@/lib/mock-data';

type AiObservationDraft = {
  draft_id: string;
  activity_id: string | null;
  child_id: string;
  child_display_name: string;
  observation_date: string;
  content: string;
  status: 'pending' | 'saved';
  observation_id?: string;
};

const AI_DRAFT_COOKIE = 'nobiRecoAiDrafts';

const readCookieValue = (name: string) => {
  if (typeof document === 'undefined') return null;
  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`));
  if (!cookie) return null;
  return cookie.split('=').slice(1).join('=');
};

const loadAiDraftsFromCookie = () => {
  const raw = readCookieValue(AI_DRAFT_COOKIE);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as AiObservationDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to parse AI drafts cookie:', error);
    return [];
  }
};

const persistAiDraftsToCookie = (drafts: AiObservationDraft[]) => {
  if (typeof document === 'undefined') return;
  if (drafts.length === 0) {
    document.cookie = `${AI_DRAFT_COOKIE}=; path=/; max-age=0`;
    return;
  }
  const value = encodeURIComponent(JSON.stringify(drafts));
  document.cookie = `${AI_DRAFT_COOKIE}=${value}; path=/; max-age=86400`;
};

// モックコンポーネント
const Dialog = ({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => onOpenChange(false)}>
      <div className="bg-white rounded-lg p-6 max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

const DialogContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
const DialogHeader = ({ children }: { children: React.ReactNode }) => <div className="mb-4">{children}</div>;
const DialogTitle = ({ children }: { children: React.ReactNode }) => <h2 className="text-lg font-semibold">{children}</h2>;
const DialogDescription = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-gray-600 mt-1">{children}</p>;

const Alert = ({
  variant,
  className,
  children,
}: {
  variant?: 'destructive' | 'default';
  className?: string;
  children: React.ReactNode;
}) => {
  const baseClass = variant === 'destructive' ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-800';
  return <div className={`rounded-md border p-4 ${baseClass} ${className || ''}`}>{children}</div>;
};

const AlertDescription = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;

// モックフック
const getConnectionMonitor = () => ({
  getStatus: () => true,
  addListener: (callback: (status: boolean) => void) => {
    callback(true);
    return () => {};
  },
});

const useObservations = () => ({
  addAddendum: async (id: string, text: string) => ({
    success: true,
    data: { id: 'mock-addendum-id', body_text: text, created_by: 'mock-user', created_at: new Date().toISOString() },
  }),
  reassignChild: async (id: string, childId: string, reason: string) => ({
    success: true,
  }),
});

const RequireAuth = ({ children }: { children: React.ReactNode }) => <>{children}</>;

const useAuth = () => ({
  user: { id: 'mock-user-id', email: 'mock@example.com', display_name: 'モックユーザー' },
});

interface Addendum {
  id: string;
  body_text: string;
  created_by: string;
  created_at: string;
}

interface Observation {
  id: string;
  child_id: string;
  child_name?: string;
  observed_at: string;
  body_text: string;
  ai_date_text: string;
  ai_action: string;
  ai_opinion: string;
  tag_flags?: Record<string, boolean>;
  created_by: string;
  created_at: string;
  updated_at: string;
  addenda: Addendum[];
  observation_addenda?: Addendum[];
}

type ObservationEditorMode = 'new' | 'edit';

type ObservationEditorProps = {
  mode: ObservationEditorMode;
  observationId?: string;
  initialChildId?: string;
};

type ObservationTag = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
};

type AiAnalysisResult = {
  ai_date_text: string;
  ai_action: string;
  ai_opinion: string;
  flags: Record<string, boolean>;
};

const buildDefaultTagFlags = (tags: ObservationTag[]) =>
  tags.reduce((acc, tag) => {
    acc[tag.id] = false;
    return acc;
  }, {} as Record<string, boolean>);

const normalizeTagFlags = (tags: ObservationTag[], rawFlags?: Record<string, unknown>) => {
  const nextFlags = buildDefaultTagFlags(tags);
  if (!rawFlags || typeof rawFlags !== 'object') {
    return nextFlags;
  }
  tags.forEach((tag) => {
    const byId = rawFlags[tag.id];
    const byName = rawFlags[tag.name];
    if (byId === true || byId === 1 || byName === true || byName === 1) {
      nextFlags[tag.id] = true;
    }
  });
  return nextFlags;
};


const ChildSelect = ({
  value,
  onChange,
  placeholder,
  testId,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  testId?: string;
  disabled?: boolean;
}) => (
  <Select value={value} onValueChange={onChange} disabled={disabled}>
    <SelectTrigger data-testid={testId} aria-label={placeholder}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent>
      {mockChildren.map((child) => (
        <SelectItem key={child.id} value={child.id}>
          {child.name}（{child.className}）
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export function ObservationEditor({ mode, observationId, initialChildId }: ObservationEditorProps) {
  const isNew = mode === 'new';
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams?.get('draftId');
  const { user } = useAuth();
  const { reassignChild } = useObservations();
  const [observation, setObservation] = useState<Observation | null>(null);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [selectedNewChild, setSelectedNewChild] = useState('');
  const [selectedChildId, setSelectedChildId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(isNew);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [aiEditForm, setAiEditForm] = useState({
    ai_date_text: '',
    ai_action: '',
    ai_opinion: '',
    flags: {} as Record<string, boolean>,
  });
  const [aiEditSaving, setAiEditSaving] = useState(false);
  const [aiEditError, setAiEditError] = useState('');
  const [aiEditSuccess, setAiEditSuccess] = useState(false);
  const [isOnline, setIsOnline] = useState(getConnectionMonitor().getStatus());
  const [observationTags, setObservationTags] = useState<ObservationTag[]>([]);
  const [tagError, setTagError] = useState('');
  const autoAiTriggeredRef = useRef(false);
  const autoAiParam = searchParams?.get('autoAi');

  const selectedChild = useMemo(
    () => mockChildren.find((child) => child.id === selectedChildId),
    [selectedChildId],
  );

  const buildFlagState = (obs: Observation | null) => {
    if (!obs) {
      return buildDefaultTagFlags(observationTags);
    }
    return normalizeTagFlags(observationTags, obs.tag_flags);
  };

  useEffect(() => {
    if (observation && !isEditing) {
      setEditText(observation.body_text || '');
    }
  }, [observation, isEditing]);

  useEffect(() => {
    if (isNew) {
      setObservation(null);
      setEditText('');
      setIsEditing(true);
      setAiEditForm({
        ai_date_text: '',
        ai_action: '',
        ai_opinion: '',
        flags: buildDefaultTagFlags(observationTags),
      });
    }
  }, [isNew, observationTags]);

  useEffect(() => {
    if (!isNew || !initialChildId) return;
    setSelectedChildId(initialChildId);
  }, [initialChildId, isNew]);

  useEffect(() => {
    let isMounted = true;

    const loadTags = async () => {
      setTagError('');
      try {
        const response = await fetch('/api/records/personal/tags');
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'タグの取得に失敗しました');
        }

        if (isMounted) {
          setObservationTags((result.data as ObservationTag[]) || []);
        }
      } catch (err) {
        console.error('Tag load error:', err);
        if (isMounted) {
          setObservationTags([]);
          setTagError('観点タグの取得に失敗しました。');
        }
      }
    };

    loadTags();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isNew || !draftId) return;
    const drafts = loadAiDraftsFromCookie();
    const draft = drafts.find((item) => item.draft_id === draftId);
    if (!draft) return;
    setSelectedChildId(draft.child_id);
    setEditText(draft.content);
    setAiEditForm({
      ai_date_text: draft.observation_date || '',
      ai_action: '',
      ai_opinion: '',
      flags: buildDefaultTagFlags(observationTags),
    });
  }, [draftId, isNew, observationTags]);

  // 接続状態の監視（モック: 常にオンライン）
  useEffect(() => {
    setIsOnline(true);
  }, []);

  useEffect(() => {
    if (!observation && !observationTags.length) return;
    const flagState = buildFlagState(observation);
    setAiEditForm((prev) => ({
      ai_date_text: observation?.ai_date_text || '',
      ai_action: observation?.ai_action || '',
      ai_opinion: observation?.ai_opinion || '',
      flags: Object.keys(prev.flags).length ? prev.flags : flagState,
    }));
  }, [observation, observationTags]);

  useEffect(() => {
    if (!observationId || !autoAiParam || autoAiTriggeredRef.current || !observation) return;

    const hasAiOutput = Boolean(
      observation.ai_action?.trim() || observation.ai_opinion?.trim() || observation.ai_date_text?.trim(),
    );

    autoAiTriggeredRef.current = true;

    if (!hasAiOutput) {
      handleReanalyze();
    }
  }, [autoAiParam, observation, observationId]);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    });
  };

  const applyAiResult = (aiResult: AiAnalysisResult) => {
    setAiEditForm({
      ai_date_text: aiResult.ai_date_text,
      ai_action: aiResult.ai_action,
      ai_opinion: aiResult.ai_opinion,
      flags: aiResult.flags,
    });
    if (!observation) return;

    setObservation((prev) =>
      prev
        ? {
            ...prev,
            ai_date_text: aiResult.ai_date_text,
            ai_action: aiResult.ai_action,
            ai_opinion: aiResult.ai_opinion,
            tag_flags: aiResult.flags,
          }
        : prev,
    );
  };

  const runAiAnalysis = async (text: string) => {
    const response = await fetch('/api/records/personal/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'AI解析に失敗しました');
    }
    const objective = result.data?.objective ?? result.data?.ai_action ?? '';
    const subjective = result.data?.subjective ?? result.data?.ai_opinion ?? '';
    const flags = normalizeTagFlags(observationTags, result.data?.flags as Record<string, unknown>);
    return {
      ai_date_text: '',
      ai_action: objective,
      ai_opinion: subjective,
      flags,
    };
  };

  const load = async (id: string) => {
    setError('');

    try {
      const response = await fetch(`/api/records/personal/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'データが見つかりませんでした');
      }

      const data = result.data;
      const childName = data.child_name || '';
      const observedAt = data.observation_date
        ? new Date(data.observation_date).toISOString()
        : data.created_at || new Date().toISOString();

      const observationRecord: Observation = {
        id: data.id,
        child_id: data.child_id,
        child_name: childName || undefined,
        observed_at: observedAt,
        body_text: data.content || '',
        ai_date_text: '',
        ai_action: '',
        ai_opinion: '',
        tag_flags: {},
        created_by: data.created_by || '',
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
        addenda: [],
      };

      setObservation(observationRecord);
    } catch (err) {
      console.error('Load error:', err);
      const errorMessage = err instanceof Error ? err.message : 'データの読み込みに失敗しました。';
      setError(errorMessage);
    }
  };

  useEffect(() => {
    if (isNew || !observationId) return;
    load(observationId);
  }, [isNew, observationId]);

  const handleReassign = async () => {
    if (!selectedNewChild || !reassignReason.trim() || !observation) return;
    setLoading(true);
    try {
      const res = await reassignChild(observation.id, selectedNewChild, reassignReason.trim());
      if (!res.success) throw new Error('付け替えに失敗しました');
      const newChildName = mockChildren.find((child) => child.id === selectedNewChild)?.name || 'モック児童';
      setObservation((prev) => (prev ? { ...prev, child_id: selectedNewChild, child_name: newChildName } : prev));
      setSelectedNewChild('');
      setReassignReason('');
      setShowReassignDialog(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAiFieldChange = (field: 'ai_date_text' | 'ai_action' | 'ai_opinion', value: string) => {
    setAiEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAiFlagToggle = (flagKey: string, checked: boolean) => {
    setAiEditForm((prev) => ({
      ...prev,
      flags: {
        ...prev.flags,
        [flagKey]: checked,
      },
    }));
  };

  const handleAiSelectAll = (checked: boolean) => {
    const nextFlags = buildDefaultTagFlags(observationTags);
    Object.keys(nextFlags).forEach((key) => {
      nextFlags[key] = checked;
    });
    setAiEditForm((prev) => ({
      ...prev,
      flags: nextFlags,
    }));
  };

  const handleAiEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!observation) return;
    setAiEditSaving(true);
    setAiEditError('');
    setAiEditSuccess(false);
    try {
      const normalizedFlags: Record<string, number> = {};
      Object.entries(aiEditForm.flags).forEach(([key, value]) => {
        normalizedFlags[key] = value ? 1 : 0;
      });
      const payload: Record<string, string | number> = {
        ai_date_text: aiEditForm.ai_date_text.trim(),
        ai_action: aiEditForm.ai_action.trim(),
        ai_opinion: aiEditForm.ai_opinion.trim(),
        ...normalizedFlags,
      };

      // モック: 更新処理をシミュレート
      console.log('Mock update:', payload);

      setAiEditSuccess(true);
      setObservation((prev) => (prev ? { ...prev, ...payload } : prev));

      setTimeout(() => {
        setAiEditSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('ai edit error', err);
      const message = err instanceof Error ? err.message : undefined;
      setAiEditError(message || 'Failed to save AI analysis results');
    } finally {
      setAiEditSaving(false);
    }
  };

  const handleUpdateObservation = async () => {
    if (!observation) return;
    const text = editText.trim();
    if (!text) {
      setError('本文を入力してください');
      return;
    }
    setSavingEdit(true);
    setError('');
    try {
      console.log('Mock update body_text:', text);
      setObservation((prev) => (prev ? { ...prev, body_text: text } : prev));
      setIsEditing(false);
      setAiProcessing(true);
      const aiResult = await runAiAnalysis(text);
      applyAiResult(aiResult);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '更新に失敗しました';
      setError(errorMessage);
    } finally {
      setAiProcessing(false);
      setSavingEdit(false);
    }
  };

  const handleCreateObservation = async () => {
    const text = editText.trim();
    if (!selectedChildId) {
      setError('対象児童を選択してください');
      return;
    }
    if (!text) {
      setError('本文を入力してください');
      return;
    }
    setSavingEdit(true);
    setError('');
    try {
      setAiProcessing(true);
      const aiResult = await runAiAnalysis(text);
      const now = new Date().toISOString();
      const newObservation: Observation = {
        id: `mock-observation-${Date.now()}`,
        child_id: selectedChildId,
        child_name: selectedChild?.name || '不明',
        observed_at: now,
        body_text: text,
        ai_date_text: aiResult.ai_date_text,
        ai_action: aiResult.ai_action,
        ai_opinion: aiResult.ai_opinion,
        tag_flags: aiResult.flags,
        created_by: user?.id || 'mock-user-id',
        created_at: now,
        updated_at: now,
        addenda: [],
      };
      setObservation(newObservation);
      applyAiResult(aiResult);
      setIsEditing(false);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '新規保存に失敗しました';
      setError(errorMessage);
    } finally {
      setAiProcessing(false);
      setSavingEdit(false);
    }
  };

  const handleSaveEdit = async () => {
    if (isNew) {
      if (draftId) {
        const text = editText.trim();
        if (!selectedChildId) {
          setError('対象児童を選択してください');
          return;
        }
        if (!text) {
          setError('本文を入力してください');
          return;
        }
        setSavingEdit(true);
        setError('');
        try {
          const drafts = loadAiDraftsFromCookie();
          const target = drafts.find((item) => item.draft_id === draftId);
          if (!target) {
            throw new Error('下書きが見つかりませんでした');
          }

          const childName = mockChildren.find((child) => child.id === selectedChildId)?.name || '不明';
          const next = drafts.map((item) =>
            item.draft_id === draftId
              ? {
                  ...item,
                  child_id: selectedChildId,
                  child_display_name: childName,
                  content: text,
                  observation_date: item.observation_date || new Date().toISOString().split('T')[0],
                }
              : item,
          );

          persistAiDraftsToCookie(next);
          router.back();
        } catch (err) {
          const message = err instanceof Error ? err.message : '下書きの更新に失敗しました';
          setError(message);
        } finally {
          setSavingEdit(false);
        }
        return;
      }
      await handleCreateObservation();
      return;
    }
    await handleUpdateObservation();
  };

  const handleReanalyze = async () => {
    const sourceText = observation?.body_text || editText;
    if (!sourceText.trim()) return;
    setAiProcessing(true);
    try {
      const aiResult = await runAiAnalysis(sourceText.trim());
      applyAiResult(aiResult);
    } finally {
      setAiProcessing(false);
    }
  };

  const childDisplayName = isNew ? selectedChild?.name || '未選択' : observation?.child_name || observation?.child_id;
  const createdByName =
    observation?.created_by === user?.id ? user?.display_name || user?.email || '現在のユーザー' : observation?.created_by || '不明';

  return (
    <RequireAuth>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <BookOpen className="h-5 w-5" /> {isNew ? '個別記録の新規作成' : '観察詳細'}
                </h1>
                <p className="text-gray-600 flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" /> {isNew ? '新しい記録を登録します' : '記録の確認と編集'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.back()}>
                  戻る
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-6 grid gap-6 lg:grid-cols-3">
          {isNew && draftId && (
            <Alert>
              <AlertDescription>AI下書きを編集中です。保存すると下書きを更新して前の画面に戻ります。</AlertDescription>
            </Alert>
          )}
          {!isOnline && (
            <Alert variant="destructive">
              <AlertDescription>オフラインです。インターネット接続を確認してください。</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                {error}
                {!isNew && (
                  <div className="mt-2">
                    <Button variant="outline" size="sm" onClick={() => observation && load(observation.id)} className="text-xs">
                      <RefreshCw className="h-3 w-3 mr-1" /> 再試行
                    </Button>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" /> 観察内容
                </CardTitle>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {isNew ? (
                      <div className="min-w-[220px]">
                        <ChildSelect
                          value={selectedChildId}
                          onChange={setSelectedChildId}
                          placeholder="対象児童を選択"
                          testId="child-select-trigger"
                          disabled={savingEdit}
                        />
                      </div>
                    ) : (
                      <span>{childDisplayName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {observation ? formatDateTime(observation.observed_at) : '未保存'}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    記録: {observation ? formatDateTime(observation.created_at) : '未保存'}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!isEditing ? (
                  <>
                    <div className="text-gray-900 leading-relaxed whitespace-pre-wrap">{observation?.body_text}</div>
                    <div className="mt-4 flex justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditText(observation?.body_text || '');
                          setIsEditing(true);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" /> 編集
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <Label htmlFor="observation_body">本文</Label>
                    <Textarea
                      id="observation_body"
                      autoFocus
                      className="min-h-[200px]"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      {!isNew && (
                        <Button variant="outline" onClick={() => setIsEditing(false)}>
                          <X className="h-4 w-4 mr-2" /> キャンセル
                        </Button>
                      )}
                      <Button
                        data-testid="observation-save"
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={handleSaveEdit}
                        disabled={savingEdit || !editText.trim() || (isNew && !selectedChildId)}
                      >
                        {savingEdit ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 保存中...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" /> 保存
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-600" /> AI解析結果
                  </CardTitle>
                  {aiProcessing && (
                    <Badge className="bg-blue-100 text-blue-700">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" /> 解析中...
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <form className="space-y-4" onSubmit={handleAiEditSubmit}>
                  <div>
                    <Label htmlFor="ai_date_text" className="text-sm font-medium text-gray-700">
                      日付
                    </Label>
                    <Input
                      id="ai_date_text"
                      type="date"
                      value={aiEditForm.ai_date_text}
                      onChange={(e) => handleAiFieldChange('ai_date_text', e.target.value)}
                      disabled={aiEditSaving}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ai_action" className="text-sm font-medium text-gray-700">
                      抽出された事実
                    </Label>
                    <Textarea
                      id="ai_action"
                      className="min-h-[120px]"
                      value={aiEditForm.ai_action}
                      onChange={(e) => handleAiFieldChange('ai_action', e.target.value)}
                      disabled={aiEditSaving}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ai_opinion" className="text-sm font-medium text-gray-700">
                      解釈・所感
                    </Label>
                    <Textarea
                      id="ai_opinion"
                      className="min-h-[120px]"
                      value={aiEditForm.ai_opinion}
                      onChange={(e) => handleAiFieldChange('ai_opinion', e.target.value)}
                      disabled={aiEditSaving}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-gray-700 mb-3 block">非認知能力フラグ</Label>
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleAiSelectAll(true)} disabled={aiEditSaving}>
                          全選択
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleAiSelectAll(false)} disabled={aiEditSaving}>
                          全解除
                        </Button>
                      </div>
                    </div>
                    {tagError ? (
                      <Alert variant="destructive">
                        <AlertDescription>{tagError}</AlertDescription>
                      </Alert>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {observationTags.length === 0 && <div className="text-sm text-gray-500">タグがありません。</div>}
                        {observationTags.map((tag) => (
                          <label key={tag.id} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm">
                            <Checkbox
                              checked={aiEditForm.flags[tag.id] ?? false}
                              onCheckedChange={(checked) => handleAiFlagToggle(tag.id, checked === true)}
                              disabled={aiEditSaving}
                            />
                            <span>{tag.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {aiEditError && (
                    <Alert variant="destructive">
                      <AlertDescription>{aiEditError}</AlertDescription>
                    </Alert>
                  )}
                  {aiEditSuccess && (
                    <div className="rounded-md border border-green-200 bg-green-50 p-4 text-green-800">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>AI解析結果を保存しました</span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button type="submit" data-testid="ai-save" className="bg-purple-600 hover:bg-purple-700" disabled={aiEditSaving}>
                      {aiEditSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 保存中...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" /> 保存
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {!isNew && observation && observation.addenda.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-green-600" /> 追記（{observation.addenda.length}件）
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {observation.addenda.map((addendum) => (
                      <div key={addendum.id} className="border-l-4 border-green-200 pl-4 py-2">
                        <p className="text-gray-900 mb-2">{addendum.body_text}</p>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <span>追記者: {addendum.created_by}</span>
                          <span>•</span>
                          <span>{formatDateTime(addendum.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">観察情報</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Hash className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">ID:</span>
                  <span className="font-mono text-xs">{observation?.id || '未保存'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-blue-600" />
                  <span className="text-gray-600">対象児童:</span>
                  <span className="font-medium">{childDisplayName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-green-600" />
                  <span className="text-gray-600">観察日時</span>
                  <span>{observation ? formatDateTime(observation.observed_at) : '未保存'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-purple-600" />
                  <span className="text-gray-600">記録日時</span>
                  <span>{observation ? formatDateTime(observation.created_at) : '未保存'}</span>
                </div>
                {!isNew && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-orange-600" />
                    <span className="text-gray-600">記録者</span>
                    <span className="font-medium">{createdByName}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isNew && (
                  <Button
                    variant="outline"
                    className="w-full border-orange-200 text-orange-600 hover:bg-orange-50"
                    onClick={() => setShowReassignDialog(true)}
                  >
                    <SwitchCamera className="h-4 w-4 mr-2" /> 児童付け替え
                  </Button>
                )}

                <Button variant="outline" className="w-full border-purple-200 text-purple-600 hover:bg-purple-50" onClick={handleReanalyze}>
                  <RefreshCw className="h-4 w-4 mr-2" /> AI再解析
                </Button>

                {!isNew && (
                  <Button
                    variant="outline"
                    className="w-full border-blue-200 text-blue-600 hover:bg-blue-50"
                    onClick={() => observation && load(observation.id)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" /> データを元に戻す
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {!isNew && (
          <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>児童付け替え</DialogTitle>
                <DialogDescription>誤登録などの場合に対象児童を変更します。</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Label>新しい児童</Label>
                <ChildSelect value={selectedNewChild} onChange={setSelectedNewChild} placeholder="新しい児童を選択" />
                <Label>理由</Label>
                <Textarea value={reassignReason} onChange={(e) => setReassignReason(e.target.value)} className="min-h-[80px]" />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowReassignDialog(false)}>
                    キャンセル
                  </Button>
                  <Button
                    onClick={handleReassign}
                    disabled={loading || !selectedNewChild || !reassignReason.trim()}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SwitchCamera className="mr-2 h-4 w-4" />} 付け替え実行
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </RequireAuth>
  );
}
