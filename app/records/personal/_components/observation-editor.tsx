'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  FileText,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import {
  type AiObservationDraft,
  loadAiDraftsFromCookie,
  markDraftAsSaved,
} from '@/lib/drafts/aiDraftCookie';
import { replaceChildIdsWithNames, replaceChildNamesWithIds } from '@/lib/ai/childIdFormatter';

// TODO: UIコンポーネントライブラリからインポートに置き換え（今後開発）
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
const OBSERVATION_BODY_MAX = 5000
const AI_RESULT_MAX = 5000

// TODO: 実装予定のフック・コンポーネント（今後開発）
// 接続監視フック - オフライン対応実装時に置き換え
const getConnectionMonitor = () => ({
  getStatus: () => true,
  addListener: (callback: (status: boolean) => void) => {
    callback(true);
    return () => {};
  },
});

// 観察記録関連フック - 追記・児童付け替え機能実装時に置き換え
const useObservations = () => ({
  addAddendum: async (id: string, text: string) => ({
    success: true,
    data: { id: 'mock-addendum-id', body_text: text, created_by: 'mock-user', created_at: new Date().toISOString() },
  }),
  reassignChild: async (id: string, childId: string, reason: string) => ({
    success: true,
  }),
});

// 認証コンポーネント - 認証システム実装時に置き換え
const RequireAuth = ({ children }: { children: React.ReactNode }) => <>{children}</>;

// 認証フック - 認証システム実装時に置き換え
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
  ai_action: string;
  ai_opinion: string;
  tag_flags?: Record<string, boolean>;
  created_by: string;
  created_by_name?: string;
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
  ai_action: string;
  ai_opinion: string;
  flags: Record<string, boolean>;
};

type ChildOption = {
  id: string;
  name: string;
  className: string;
};

type ChildApi = {
  child_id: string;
  name: string;
  class_name?: string | null;
};

type ChildListResponse = {
  data?: {
    children?: ChildApi[];
  };
  error?: string;
};

type RecentObservation = {
  id: string;
  observation_date: string;
  content: string;
  created_at: string;
  tag_ids?: string[];
};

const buildDefaultTagFlags = (tags: ObservationTag[]) =>
  tags.reduce((acc, tag) => {
    acc[tag.id] = false;
    return acc;
  }, {} as Record<string, boolean>);

  const normalizeTagFlags = (tags: ObservationTag[], rawFlags?: Record<string, unknown> | unknown[]) => {
  const nextFlags = buildDefaultTagFlags(tags);
  if (!rawFlags) {
    return nextFlags;
  }
  if (Array.isArray(rawFlags)) {
    rawFlags.forEach((entry) => {
      const id =
        typeof entry === 'string'
          ? entry
          : entry && typeof entry === 'object' && 'tag_id' in entry
            ? (entry as { tag_id?: string }).tag_id
            : undefined;
      if (id && id in nextFlags) {
        nextFlags[id] = true;
      }
    });
    return nextFlags;
  }
  if (typeof rawFlags !== 'object') {
    return nextFlags;
  }
  tags.forEach((tag) => {
    const byId = (rawFlags as Record<string, unknown>)[tag.id];
    const byName = (rawFlags as Record<string, unknown>)[tag.name];
    const byUuid = (rawFlags as Record<string, unknown>)[tag.id?.toLowerCase?.() || ''];
    if (byId === true || byId === 1 || byId === '1' || byName === true || byName === 1 || byName === '1') {
      nextFlags[tag.id] = true;
    } else if (byUuid === true || byUuid === 1 || byUuid === '1') {
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
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  testId?: string;
  disabled?: boolean;
  options: ChildOption[];
}) => (
  <Select value={value} onValueChange={onChange} disabled={disabled}>
    <SelectTrigger data-testid={testId} aria-label={placeholder}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent>
      {options.map((child) => (
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
  const paramChildId = searchParams?.get('childId')?.trim() || '';
  const paramChildName = searchParams?.get('childName')?.trim() || '';
  const paramActivityId = searchParams?.get('activityId')?.trim() || '';
  const { user } = useAuth();
  const { reassignChild } = useObservations();
  const [observation, setObservation] = useState<Observation | null>(null);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [selectedNewChild, setSelectedNewChild] = useState('');
  const [selectedChildId, setSelectedChildId] = useState('');
  const [activityId, setActivityId] = useState<string | null>(null);
  const [lockedChildName, setLockedChildName] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(isNew);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [aiEditForm, setAiEditForm] = useState({
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
  const [recentObservations, setRecentObservations] = useState<RecentObservation[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState('');
  const [childOptions, setChildOptions] = useState<ChildOption[]>([]);
  const [childOptionsError, setChildOptionsError] = useState('');
  const [childOptionsLoading, setChildOptionsLoading] = useState(false);
  const autoAiTriggeredRef = useRef(false);
  const autoAiDraftTriggeredRef = useRef(false);
  const aiFlagsInitializedRef = useRef(false);
  const autoAiParam = searchParams?.get('autoAi');
  const lockedChildId = paramChildId || initialChildId || '';
  const isChildLocked = !isNew && Boolean(lockedChildId);

  const nameByIdMap = useMemo(() => {
    const map = new Map<string, string>();
    childOptions.forEach((child) => {
      if (child.id && child.name) {
        map.set(child.id, child.name);
      }
    });
    if (lockedChildId && lockedChildName) {
      map.set(lockedChildId, lockedChildName);
    }
    if (observation?.child_id && observation?.child_name) {
      map.set(observation.child_id, observation.child_name);
    }
    return map;
  }, [childOptions, lockedChildId, lockedChildName, observation?.child_id, observation?.child_name]);

  const toDisplayText = useCallback(
    (text: string) => replaceChildIdsWithNames(text, nameByIdMap),
    [nameByIdMap],
  );
  const toIdText = useCallback(
    (text: string) => replaceChildNamesWithIds(text, nameByIdMap),
    [nameByIdMap],
  );

  const selectedChild = useMemo(
    () => childOptions.find((child) => child.id === selectedChildId),
    [childOptions, selectedChildId],
  );

  const buildFlagState = (obs: Observation | null) => {
    if (!obs) {
      return buildDefaultTagFlags(observationTags);
    }
    return normalizeTagFlags(observationTags, obs.tag_flags);
  };

  useEffect(() => {
    if (observation && !isEditing) {
      setEditText(toDisplayText(observation.body_text || ''));
    }
  }, [observation, isEditing, toDisplayText]);

  useEffect(() => {
    if (isNew) {
      setObservation(null);
      setEditText('');
      setIsEditing(true);
      setAiEditForm({
        ai_action: '',
        ai_opinion: '',
        flags: buildDefaultTagFlags(observationTags),
      });
    }
  }, [isNew, observationTags]);

  useEffect(() => {
    if (!isNew || !lockedChildId) return;
    setSelectedChildId(lockedChildId);
    if (paramChildName) {
      setLockedChildName(paramChildName);
    }
  }, [isNew, lockedChildId, paramChildName]);

  useEffect(() => {
    if (!isNew || !lockedChildId || lockedChildName) return;
    const resolvedName = childOptions.find((child) => child.id === lockedChildId)?.name;
    if (resolvedName) {
      setLockedChildName(resolvedName);
    }
  }, [childOptions, isNew, lockedChildId, lockedChildName]);

  useEffect(() => {
    if (!isNew || !lockedChildId) return;
    setSelectedChildId(lockedChildId);
  }, [isNew, lockedChildId]);

  useEffect(() => {
    if (!paramChildName) return;
    setLockedChildName(paramChildName);
  }, [paramChildName]);

  // activity_idをURLパラメータまたはドラフトから取得
  useEffect(() => {
    if (!isNew) return;

    // 優先順位: URLパラメータ > ドラフト
    if (paramActivityId) {
      setActivityId(paramActivityId);
      return;
    }

    // ドラフトからactivity_idを取得
    if (draftId) {
      const drafts = loadAiDraftsFromCookie();
      const draft = drafts.find((d) => d.draft_id === draftId);
      if (draft?.activity_id) {
        setActivityId(draft.activity_id);
      }
    }
  }, [isNew, paramActivityId, draftId]);

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
    let isMounted = true;

    const loadChildren = async () => {
      setChildOptionsLoading(true);
      setChildOptionsError('');
      try {
        const response = await fetch('/api/children?status=enrolled&sort_by=name&sort_order=asc&limit=200');
        const result = (await response.json()) as ChildListResponse;
        if (!response.ok || result.error) {
          throw new Error(result.error || '児童一覧の取得に失敗しました');
        }
        const children = (result.data?.children || []).map((child) => ({
          id: child.child_id,
          name: child.name,
          className: child.class_name || '未設定',
        }));
        if (isMounted) {
          setChildOptions(children);
        }
      } catch (err) {
        console.error('Children load error:', err);
        if (isMounted) {
          setChildOptions([]);
          setChildOptionsError('児童一覧の取得に失敗しました。');
        }
      } finally {
        if (isMounted) {
          setChildOptionsLoading(false);
        }
      }
    };

    loadChildren();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isNew || !draftId) return;
    const drafts = loadAiDraftsFromCookie();
    const draft = drafts.find((item) => item.draft_id === draftId);
    if (!draft) return;
    setSelectedChildId(lockedChildId || draft.child_id);
    setEditText(toDisplayText(draft.content));
    setLockedChildName((prev) => draft.child_display_name || prev);
    setAiEditForm({
      ai_action: '',
      ai_opinion: '',
      flags: buildDefaultTagFlags(observationTags),
    });
  }, [draftId, isNew, lockedChildId, observationTags, toDisplayText]);

  useEffect(() => {
    if (!nameByIdMap.size) return;
    if (!editText.includes('child:')) return;
    const replaced = toDisplayText(editText);
    if (replaced !== editText) {
      setEditText(replaced);
    }
  }, [editText, toDisplayText]);

  useEffect(() => {
    if (!nameByIdMap.size) return;
    if (!aiEditForm.ai_action.includes('child:') && !aiEditForm.ai_opinion.includes('child:')) return;
    const nextAction = toDisplayText(aiEditForm.ai_action);
    const nextOpinion = toDisplayText(aiEditForm.ai_opinion);
    if (nextAction === aiEditForm.ai_action && nextOpinion === aiEditForm.ai_opinion) return;
    setAiEditForm((prev) => ({
      ...prev,
      ai_action: nextAction,
      ai_opinion: nextOpinion,
    }));
  }, [aiEditForm.ai_action, aiEditForm.ai_opinion, nameByIdMap, toDisplayText]);

  useEffect(() => {
    if (!isNew || !draftId) return;
    if (autoAiDraftTriggeredRef.current) return;
    if (!editText.trim()) return;
    if (!observationTags.length && !tagError) return;

    autoAiDraftTriggeredRef.current = true;
    const runDraftAnalysis = async () => {
      setAiProcessing(true);
      setError('');
      try {
        const aiResult = await runAiAnalysis(toIdText(editText.trim()));
        applyAiResult(aiResult);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'AI解析に失敗しました';
        setError(message);
      } finally {
        setAiProcessing(false);
      }
    };

    runDraftAnalysis();
  }, [draftId, editText, isNew, observationTags, tagError]);

  // TODO: 接続状態の監視（今後開発：オフライン対応実装時に実装）
  useEffect(() => {
    setIsOnline(true);
  }, []);

  useEffect(() => {
    if (observation && observationTags.length === 0) return;
    if (!observation && !observationTags.length) return;
    const flagState = buildFlagState(observation);
    setAiEditForm((prev) => ({
      ai_action: observation?.ai_action || '',
      ai_opinion: observation?.ai_opinion || '',
      flags: observation
        ? aiFlagsInitializedRef.current
          ? prev.flags
          : flagState
        : Object.keys(prev.flags).length
          ? prev.flags
          : flagState,
    }));
    if (observation && !aiFlagsInitializedRef.current) {
      aiFlagsInitializedRef.current = true;
    }
  }, [observation, observationTags]);

  useEffect(() => {
    if (!observationId || !autoAiParam || autoAiTriggeredRef.current || !observation) return;

    const hasAiOutput = Boolean(
      observation.ai_action?.trim() || observation.ai_opinion?.trim(),
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
      ai_action: toDisplayText(aiResult.ai_action),
      ai_opinion: toDisplayText(aiResult.ai_opinion),
      flags: aiResult.flags,
    });
    if (!observation) return;

    setObservation((prev) =>
      prev
        ? {
            ...prev,
            ai_action: toDisplayText(aiResult.ai_action),
            ai_opinion: toDisplayText(aiResult.ai_opinion),
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

      const displayContent = toDisplayText(data.content || '');
      const observationRecord: Observation = {
        id: data.id,
        child_id: data.child_id,
        child_name: childName || undefined,
        observed_at: observedAt,
        body_text: displayContent,
        ai_action: toDisplayText(data.objective || ''),
        ai_opinion: toDisplayText(data.subjective || ''),
        tag_flags: data.tag_flags || {},
        created_by: data.created_by || '',
        created_by_name: data.created_by_name || '',
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
        addenda: [],
      };

      setObservation(observationRecord);
      setAiEditForm({
        ai_action: observationRecord.ai_action,
        ai_opinion: observationRecord.ai_opinion,
        flags:
          data.tag_flags && typeof data.tag_flags === 'object'
            ? (data.tag_flags as Record<string, boolean>)
            : buildDefaultTagFlags(observationTags),
      });
      aiFlagsInitializedRef.current = true;
      setRecentObservations((data.recent_observations as RecentObservation[]) || []);
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

  useEffect(() => {
    if (!isNew) return;
    if (!selectedChildId) {
      setRecentObservations([]);
      setRecentError('');
      return;
    }
    let isMounted = true;
    const fetchRecent = async () => {
      setRecentLoading(true);
      setRecentError('');
      try {
        const response = await fetch(`/api/records/personal/child/${selectedChildId}/recent`);
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || '過去記録の取得に失敗しました');
        }
        if (isMounted) {
          setRecentObservations((result.data?.recent_observations as RecentObservation[]) || []);
        }
      } catch (err) {
        console.error('Recent observations load error:', err);
        if (isMounted) {
          setRecentObservations([]);
          setRecentError('過去記録の取得に失敗しました。');
        }
      } finally {
        if (isMounted) {
          setRecentLoading(false);
        }
      }
    };

    fetchRecent();

    return () => {
      isMounted = false;
    };
  }, [isNew, selectedChildId]);

  const handleReassign = async () => {
    if (!selectedNewChild || !reassignReason.trim() || !observation) return;
    setLoading(true);
    try {
      const res = await reassignChild(observation.id, selectedNewChild, reassignReason.trim());
      if (!res.success) throw new Error('付け替えに失敗しました');
      const newChildName = childOptions.find((child) => child.id === selectedNewChild)?.name || '児童';
      setObservation((prev) => (prev ? { ...prev, child_id: selectedNewChild, child_name: newChildName } : prev));
      setSelectedNewChild('');
      setReassignReason('');
      setShowReassignDialog(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAiFieldChange = (field: 'ai_action' | 'ai_opinion', value: string) => {
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
    if (isNew) {
      setAiEditSaving(true);
      setAiEditError('');
      try {
        await handleCreateObservation();
      } finally {
        setAiEditSaving(false);
      }
      return;
    }
    if (!observation) return;
    setAiEditSaving(true);
    setAiEditError('');
    setAiEditSuccess(false);
    try {
      const normalizedFlags: Record<string, number> = {};
      Object.entries(aiEditForm.flags).forEach(([key, value]) => {
        normalizedFlags[key] = value ? 1 : 0;
      });
      const aiAction = toIdText(aiEditForm.ai_action.trim());
      const aiOpinion = toIdText(aiEditForm.ai_opinion.trim());
      const payload: Record<string, string | number> = {
        ai_action: aiAction,
        ai_opinion: aiOpinion,
        ...normalizedFlags,
      };

      // TODO: API実装 - AI解析結果の更新処理
      const response = await fetch(`/api/records/personal/${observation.id}/ai`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'AI解析結果の保存に失敗しました');
      }

      setAiEditSuccess(true);
      setObservation((prev) =>
        prev
          ? {
              ...prev,
              ai_action: toDisplayText(aiAction),
              ai_opinion: toDisplayText(aiOpinion),
              tag_flags: aiEditForm.flags,
            }
          : prev,
      );

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
    const displayText = editText.trim();
    const text = toIdText(displayText).trim();
    if (!text) {
      setError('本文を入力してください');
      return;
    }
    setSavingEdit(true);
    setError('');
    try {
      const response = await fetch(`/api/records/personal/${observation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '更新に失敗しました');
      }

      setObservation((prev) => (prev ? { ...prev, body_text: displayText } : prev));
      setIsEditing(false);
      setAiProcessing(true);
      const aiResult = await runAiAnalysis(text);
      const aiAction = toIdText(aiResult.ai_action);
      const aiOpinion = toIdText(aiResult.ai_opinion);
      const aiSaveResponse = await fetch(`/api/records/personal/${observation.id}/ai`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ai_action: aiAction,
          ai_opinion: aiOpinion,
          ...aiResult.flags,
        }),
      });
      const aiSaveResult = await aiSaveResponse.json();
      if (!aiSaveResponse.ok || !aiSaveResult.success) {
        throw new Error(aiSaveResult.error || 'AI解析結果の保存に失敗しました');
      }
      applyAiResult({ ...aiResult, ai_action: aiAction, ai_opinion: aiOpinion });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '更新に失敗しました';
      setError(errorMessage);
    } finally {
      setAiProcessing(false);
      setSavingEdit(false);
    }
  };

  const handleCreateObservation = async ({ forceAi = false }: { forceAi?: boolean } = {}) => {
    const displayText = editText.trim();
    const text = toIdText(displayText).trim();
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
      const hasAiOutput =
        aiEditForm.ai_action.trim() ||
        aiEditForm.ai_opinion.trim() ||
        Object.values(aiEditForm.flags).some(Boolean);
      let aiResult: AiAnalysisResult;
      if (!forceAi && hasAiOutput) {
        aiResult = {
          ai_action: toIdText(aiEditForm.ai_action),
          ai_opinion: toIdText(aiEditForm.ai_opinion),
          flags: aiEditForm.flags,
        };
      } else {
        setAiProcessing(true);
        aiResult = await runAiAnalysis(text);
        applyAiResult(aiResult);
      }

      const observationDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式

      // APIに保存
      const response = await fetch('/api/records/personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          child_id: selectedChildId,
          observation_date: observationDate,
          content: text,
          activity_id: activityId || null,
          ai_action: aiResult.ai_action,
          ai_opinion: aiResult.ai_opinion,
          tag_flags: aiResult.flags,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '保存に失敗しました');
      }

      // 保存成功時、観察記録を設定
      const resolvedChildName = lockedChildName || selectedChild?.name || '不明';
      const newObservation: Observation = {
        id: result.data.id,
        child_id: selectedChildId,
        child_name: resolvedChildName,
        observed_at: new Date().toISOString(),
        body_text: displayText,
        ai_action: toDisplayText(aiResult.ai_action),
        ai_opinion: toDisplayText(aiResult.ai_opinion),
        tag_flags: aiResult.flags,
        created_by: user?.id || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        addenda: [],
      };
      setObservation(newObservation);
      setIsEditing(false);

      // draftIdがある場合、ステータスを'saved'に更新
      if (draftId) {
        markDraftAsSaved(
          draftId,
          result.data.id,
          result.data.observation_date,
          result.data.content ?? text,
        );
        if (typeof window !== 'undefined') {
          const lastSaved = {
            draft_id: draftId,
            activity_id: activityId,
            child_id: selectedChildId,
            child_display_name: resolvedChildName,
            observation_date: result.data.observation_date ?? new Date().toISOString().split('T')[0],
            content: result.data.content ?? text,
            status: 'saved' as const,
            observation_id: result.data.id,
          };
          window.sessionStorage.setItem('nobiRecoAiLastSavedDraft', JSON.stringify(lastSaved));
        }
        // 一覧画面に戻る（activityページに戻る）
        router.push('/records/activity?aiModal=1');
      }
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
      await handleCreateObservation({ forceAi: true });
      return;
    }
    await handleUpdateObservation();
  };

  const getTagBadges = (tagIds?: string[]) => {
    if (!tagIds?.length) return [];
    return tagIds.map((tagId) => {
      const tag = observationTags.find((item) => item.id === tagId);
      return {
        id: tagId,
        name: tag?.name || tagId,
      };
    });
  };

  const hasAiOutput =
    aiProcessing ||
    Boolean(observation?.ai_action?.trim() || observation?.ai_opinion?.trim()) ||
    Object.values(aiEditForm.flags).some(Boolean) ||
    aiEditForm.ai_action.trim().length > 0 ||
    aiEditForm.ai_opinion.trim().length > 0;

  const displayRecentContent = useCallback(
    (text: string) => toDisplayText(text),
    [toDisplayText],
  );

  const handleReanalyze = async () => {
    const sourceText = observation?.body_text || editText;
    if (!sourceText.trim()) return;
    setAiProcessing(true);
    try {
      const aiResult = await runAiAnalysis(toIdText(sourceText.trim()));
      applyAiResult(aiResult);
    } finally {
      setAiProcessing(false);
    }
  };

  const childDisplayName = isNew
    ? lockedChildName || selectedChild?.name || (selectedChildId ? '不明' : '未選択')
    : observation?.child_name || observation?.child_id;
  const createdByName =
    observation?.created_by_name ||
    (observation?.created_by === user?.id
      ? user?.display_name || user?.email || '現在のユーザー'
      : observation?.created_by || '不明');

  const handleEditRecent = (id: string) => {
    router.push(`/records/personal/${id}/edit`);
  };

  return (
    <RequireAuth>
      <div className="space-y-6">
        {/* ヘッダー（全幅） */}
        <div className="border-b -m-4 sm:-m-6 px-4 sm:px-6 py-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.back()}>
                  戻る
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* アラートメッセージ（全幅） */}
        <div className="max-w-6xl mx-auto space-y-4">
          {isNew && draftId && (
            <Alert>
              <AlertDescription>AI下書きを編集中です。保存すると記録を保存して前の画面に戻ります。</AlertDescription>
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
          {childOptionsError && (
            <Alert variant="destructive">
              <AlertDescription>{childOptionsError}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* メインコンテンツ */}
        <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-3">
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
                      isChildLocked ? (
                        <span className="font-medium">{childDisplayName}</span>
                      ) : (
                        <div className="min-w-[220px]">
                          <ChildSelect
                            value={selectedChildId}
                            onChange={setSelectedChildId}
                            placeholder="対象児童を選択"
                            testId="child-select-trigger"
                            disabled={savingEdit || childOptionsLoading}
                            options={childOptions}
                          />
                        </div>
                      )
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
                    <div className="text-gray-900 leading-relaxed whitespace-pre-wrap">
                      {toDisplayText(observation?.body_text || '')}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditText(toDisplayText(observation?.body_text || ''));
                          setIsEditing(true);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" /> 編集
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="observation_body">本文</Label>
                      <span className="text-sm text-gray-500">
                        {editText.length}/{OBSERVATION_BODY_MAX}文字
                      </span>
                    </div>
                    <Textarea
                      id="observation_body"
                      autoFocus
                      className="min-h-[200px]"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      maxLength={OBSERVATION_BODY_MAX}
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

            {hasAiOutput && (
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
                      <div className="flex items-center justify-between">
                        <Label htmlFor="ai_action" className="text-sm font-medium text-gray-700">
                          抽出された事実
                        </Label>
                        <span className="text-sm text-gray-500">
                          {aiEditForm.ai_action.length}/{AI_RESULT_MAX}文字
                        </span>
                      </div>
                      <Textarea
                        id="ai_action"
                        className="min-h-[120px]"
                        value={aiEditForm.ai_action}
                        onChange={(e) => handleAiFieldChange('ai_action', e.target.value)}
                        disabled={aiEditSaving}
                        maxLength={AI_RESULT_MAX}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="ai_opinion" className="text-sm font-medium text-gray-700">
                          解釈・所感
                        </Label>
                        <span className="text-sm text-gray-500">
                          {aiEditForm.ai_opinion.length}/{AI_RESULT_MAX}文字
                        </span>
                      </div>
                      <Textarea
                        id="ai_opinion"
                        className="min-h-[120px]"
                        value={aiEditForm.ai_opinion}
                        onChange={(e) => handleAiFieldChange('ai_opinion', e.target.value)}
                        disabled={aiEditSaving}
                        maxLength={AI_RESULT_MAX}
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
            )}

            {(Boolean(selectedChildId) || !isNew) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">過去の記録（直近10件）</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentLoading ? (
                    <p className="text-sm text-gray-500">読み込み中...</p>
                  ) : recentError ? (
                    <p className="text-sm text-red-600">{recentError}</p>
                  ) : recentObservations.length === 0 ? (
                    <p className="text-sm text-gray-500">過去の記録はありません。</p>
                  ) : (
                    recentObservations.map((item) => {
                      const tagBadges = getTagBadges(item.tag_ids);
                      return (
                        <div key={item.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                          <div className="flex items-start justify-between gap-2 text-xs text-gray-500">
                            <span>{item.observation_date ? formatDateTime(item.observation_date) : '日付不明'}</span>
                            <Button variant="outline" size="sm" onClick={() => handleEditRecent(item.id)}>
                              編集
                            </Button>
                          </div>
                          <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">
                            {displayRecentContent(item.content)}
                          </p>
                          {tagBadges.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {tagBadges.map((tag) => (
                                <Badge key={tag.id} variant="secondary" className="bg-white text-gray-700 border border-gray-200">
                                  {tag.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            )}

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
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>児童付け替え</DialogTitle>
                <DialogDescription>誤登録などの場合に対象児童を変更します。</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Label>新しい児童</Label>
                <ChildSelect
                  value={selectedNewChild}
                  onChange={setSelectedNewChild}
                  placeholder="新しい児童を選択"
                  options={childOptions}
                />
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
