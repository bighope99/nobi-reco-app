'use client';

import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { BookOpen, Calendar, User, Clock, Plus, RefreshCw, SwitchCamera, Loader2, CheckCircle, Brain, MessageSquare, Hash, FileText, Pencil, Save, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

// モックコンポーネント
const Dialog = ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) => {
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

const Alert = ({ variant, className, children }: { variant?: 'destructive' | 'default'; className?: string; children: React.ReactNode }) => {
  const baseClass = variant === 'destructive' 
    ? 'border-red-200 bg-red-50 text-red-800' 
    : 'border-blue-200 bg-blue-50 text-blue-800';
  return (
    <div className={`rounded-md border p-4 ${baseClass} ${className || ''}`}>
      {children}
    </div>
  );
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
  facility_id: string;
  child_id: string;
  child_name?: string;
  observed_at: string;
  body_text: string;
  body_text_hash: string;
  ai_date_text: string;
  ai_action: string;
  ai_opinion: string;
  flag_emo: number;
  flag_emp: number;
  flag_social: number;
  flag_assert: number;
  flag_listen: number;
  flag_resilient: number;
  flag_efficacy: number;
  flag_motive: number;
  flag_meta: number;
  flag_adapt: number;
  flag_creative: number;
  flag_positive: number;
  flag_negative: number;
  flag_responsibility: number;
  flag_emotion_control: number;
  flag_cooperation: number;
  flag_flexibility: number;
  flag_self_motivation: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  addenda: Addendum[];
  observation_addenda?: Addendum[];
}

const flagLabels: Record<string, string> = {
  flag_responsibility: '責任をもって粘り強く取り組む力',
  flag_emotion_control: '感情をうまくコントロールする力',
  flag_cooperation: '他者と良い関係を築く協調性・共感力',
  flag_flexibility: '新しいことを受け入れる柔軟性',
  flag_self_motivation: '自ら目標を持ち、行動する力',
  flag_positive: 'ポジティブ',
  flag_negative: 'ネガティブ',
};

export default function ObservationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const observationId = useMemo(() => {
    const rawId = (params as Record<string, string | string[]> | undefined)?.id;
    if (!rawId) return '';
    return Array.isArray(rawId) ? rawId[0] : rawId;
  }, [params]);
  const { addAddendum, reassignChild } = useObservations();
  const [observation, setObservation] = useState<Observation | null>(null);
  const [newAddendum, setNewAddendum] = useState('');
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [selectedNewChild, setSelectedNewChild] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
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
  const autoAiTriggeredRef = useRef(false);
  const autoAiParam = searchParams?.get('autoAi');

  const buildFlagState = (obs: Observation | null) => {
    if (!obs) {
      return Object.keys(flagLabels).reduce((acc, key) => {
        acc[key] = false;
        return acc;
      }, {} as Record<string, boolean>);
    }
    return Object.keys(flagLabels).reduce((acc, key) => {
      acc[key] = (obs as any)[key] === 1;
      return acc;
    }, {} as Record<string, boolean>);
  };

  useEffect(() => {
    if (observation && !isEditing) {
      setEditText(observation.body_text || '');
    }
  }, [observation, isEditing]);

  // 接続状態の監視（モック: 常にオンライン）
  useEffect(() => {
    setIsOnline(true);
  }, []);

  useEffect(() => {
    if (!observation) return;
    const flagState = buildFlagState(observation);
    setAiEditForm({
      ai_date_text: observation.ai_date_text || '',
      ai_action: observation.ai_action || '',
      ai_opinion: observation.ai_opinion || '',
      flags: flagState,
    });
  }, [observation]);

  useEffect(() => {
    if (!observationId || !autoAiParam || autoAiTriggeredRef.current) return;
    if (!observation) return;

    const hasAiOutput = Boolean(
      observation.ai_action?.trim() ||
      observation.ai_opinion?.trim() ||
      observation.ai_date_text?.trim()
    );

    autoAiTriggeredRef.current = true;

    if (!hasAiOutput) {
      handleReanalyze();
    }

  }, [autoAiParam, observation, observationId, router]);


  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', weekday: 'short'
    });
  };

  const load = async (id: string) => {
    setError('');
    
    // モックデータで表示
    try {
      // モック観察データ
      const mockObservation: Observation = {
        id: id || 'mock-observation-id',
        facility_id: 'mock-facility-id',
        child_id: '1',
        child_name: '田中 太郎',
        observed_at: new Date().toISOString(),
        body_text: '今日は積み木で高い塔を作っていました。集中力がついてきています。友達と協力して、とても高い塔を作ることができました。',
        body_text_hash: 'mock-hash',
        ai_date_text: '2024-01-15',
        ai_action: '積み木で高い塔を作成。友達と協力して作業を行った。',
        ai_opinion: '集中力と協調性が向上している。',
        flag_emo: 0,
        flag_emp: 0,
        flag_social: 1,
        flag_assert: 0,
        flag_listen: 0,
        flag_resilient: 0,
        flag_efficacy: 0,
        flag_motive: 0,
        flag_meta: 0,
        flag_adapt: 0,
        flag_creative: 1,
        flag_positive: 1,
        flag_negative: 0,
        flag_responsibility: 1,
        flag_emotion_control: 0,
        flag_cooperation: 1,
        flag_flexibility: 0,
        flag_self_motivation: 0,
        created_by: 'mock-user-id',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        addenda: [
          {
            id: 'mock-addendum-1',
            body_text: '追記: 完成した塔の写真を撮影しました。',
            created_by: 'mock-user-id',
            created_at: new Date().toISOString(),
          },
        ],
      };
      
      setObservation(mockObservation);
    } catch (err) {
      console.error('Load error:', err);
      const errorMessage = err instanceof Error ? err.message : 'データの読み込みに失敗しました。';
      setError(errorMessage);
    }
  };

  useEffect(() => {
    const id = observationId || (params?.id as string | undefined);
    console.log('load useEffect', id);
    if (id) {
      load(id);
    } else {
      // IDがない場合もモックデータで表示
      load('mock-observation-id');
    }
  }, [observationId, params?.id]);


  const handleAddAddendum = async () => {
    if (!newAddendum.trim() || !observation) return;
    setLoading(true);
    try {
      const res = await addAddendum(observation.id, newAddendum.trim());
      if (!res.success || !res.data) throw new Error('追記に失敗しました');
      const item: Addendum = { id: res.data.id, body_text: res.data.body_text, created_by: res.data.created_by, created_at: res.data.created_at };
      setObservation(prev => prev ? { ...prev, addenda: [...prev.addenda, item] } : prev);
      setNewAddendum('');
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedNewChild || !reassignReason.trim() || !observation) return;
    setLoading(true);
    try {
      const res = await reassignChild(observation.id, selectedNewChild, reassignReason.trim());
      if (!res.success) throw new Error('付け替えに失敗しました');
      // モック: 児童名を設定
      let newChildName: string | undefined = 'モック児童';
      setObservation(prev => prev ? { ...prev, child_id: selectedNewChild, child_name: newChildName } : prev);
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
    const nextFlags = buildFlagState(null);
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
      
      // 実際の更新処理はコメントアウト（モック表示用）
      // const supabase = createClient();
      // const { error: updateError } = await supabase
      //   .from('observations')
      //   .update(payload)
      //   .eq('id', observation.id);
      // if (updateError) {
      //   throw updateError;
      // }

      console.log('ai edit success　', observation.id);
      setAiEditSuccess(true);
      await load(observation.id);
      
      // 3秒後に成功メッセージを非表示
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

  const handleSaveEdit = async () => {
    if (!observation) return;
    const text = editText.trim();
    if (!text) { setError('本文を入力してください'); return; }
    setSavingEdit(true);
    setError('');
    try {
      // モック: 更新処理をシミュレート
      console.log('Mock update body_text:', text);
      
      // 実際の更新処理はコメントアウト（モック表示用）
      // const supabase = createClient();
      // const { error } = await supabase
      //   .from('observations')
      //   .update({ body_text: text })
      //   .eq('id', observation.id);
      // if (error) throw error;
      
      setObservation(prev => prev ? { ...prev, body_text: text } : prev);
      setIsEditing(false);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '更新に失敗しました';
      setError(errorMessage);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleReanalyze = async () => {
    if (!observation) return;
    setAiProcessing(true);
    try {
      // モック: AI再解析をシミュレート
      console.log('Mock reanalyze:', observation.id);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
      // const res = await fetch(`/api/observations/${observation.id}/reanalyze`, { method: 'POST' });
      // if (!res.ok) {
      //   console.error('reanalyze failed', await res.text());
      // } else {
      //   console.log('reanalyze success');
      //   await load(observation.id);
      // }
      await load(observation.id);
    } finally {
      setAiProcessing(false);
    }
  };

  return (
    <RequireAuth>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <BookOpen className="h-5 w-5" /> 観察詳細
                </h1>
                <p className="text-gray-600 flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" /> 記録の確認と編集
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.back()}>戻る</Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-6 grid gap-6 lg:grid-cols-3">
          {!isOnline && (
            <Alert variant="destructive">
              <AlertDescription>オフラインです。インターネット接続を確認してください。</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                {error}
                <div className="mt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => observation && load(observation.id)}
                    className="text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> 再試行
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Observation Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" /> 観察内容
                </CardTitle>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {observation?.child_name || observation?.child_id}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {observation ? formatDateTime(observation.observed_at) : ''}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    記録: {observation ? formatDateTime(observation.created_at) : ''}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!isEditing ? (
                  <>
                    <div className="text-gray-900 leading-relaxed whitespace-pre-wrap">
                      {observation?.body_text}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button variant="outline" onClick={() => {
                        setEditText(observation?.body_text || '');
                        setIsEditing(true);
                      }}>
                        <Pencil className="h-4 w-4 mr-2" /> 編集
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <Label htmlFor="edit_body">本文</Label>
                    <Textarea 
                      id="edit_body" 
                      autoFocus 
                      className="min-h-[200px]" 
                      value={editText} 
                      onChange={(e) => setEditText(e.target.value)} 
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => { setIsEditing(false); setEditText(observation?.body_text || ''); }}>
                        <X className="h-4 w-4 mr-2" /> キャンセル
                      </Button>
                      <Button className="bg-blue-600 hover:bg-blue-700" onClick={async () => {
                        try {
                          await handleSaveEdit();
                          // 保存成功後にAI解析を実行
                          handleReanalyze();
                        } catch (error) {
                          console.error('保存またはAI解析でエラーが発生しました:', error);
                        }
                      }} disabled={savingEdit || !editText.trim()}>
                        {savingEdit ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> 保存中...</>
                        ) : (
                          <><Save className="h-4 w-4 mr-2" /> 保存</>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Analysis Results */}
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
                    <Label className="text-sm font-medium text-gray-700">日付</Label>
                    <Input
                      type="date"
                      value={aiEditForm.ai_date_text}
                      onChange={(e) => handleAiFieldChange('ai_date_text', e.target.value)}
                      disabled={aiEditSaving}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">抽出された事実</Label>
                    <Textarea
                      className="min-h-[120px]"
                      value={aiEditForm.ai_action}
                      onChange={(e) => handleAiFieldChange('ai_action', e.target.value)}
                      disabled={aiEditSaving}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">解釈・所感</Label>
                    <Textarea
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
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {Object.entries(flagLabels).map(([flagKey, label]) => (
                        <label key={flagKey} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm">
                          <Checkbox
                            checked={aiEditForm.flags[flagKey] ?? false}
                            onCheckedChange={(checked) => handleAiFlagToggle(flagKey, checked === true)}
                            disabled={aiEditSaving}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
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
                    <Button type="submit" className="bg-purple-600 hover:bg-purple-700" disabled={aiEditSaving}>
                      {aiEditSaving ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> 保存中...</>
                      ) : (
                        <><Save className="h-4 w-4 mr-2" /> 保存</>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Addenda */}
            {observation && observation.addenda.length > 0 && (
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

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">観察情報</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Hash className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">ID:</span>
                  <span className="font-mono text-xs">{observation?.id}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-blue-600" />
                  <span className="text-gray-600">対象児童:</span>
                  <span className="font-medium">{observation?.child_name || observation?.child_id}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-green-600" />
                  <span className="text-gray-600">観察日時</span>
                  <span>{observation ? formatDateTime(observation.observed_at) : ''}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-purple-600" />
                  <span className="text-gray-600">記録日時</span>
                  <span>{observation ? formatDateTime(observation.created_at) : ''}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-orange-600" />
                  <span className="text-gray-600">記録者</span>
                  <span className="font-medium">
                    {observation?.created_by === user?.id 
                      ? (user?.display_name || user?.email || '現在のユーザー')
                      : (observation?.created_by || '不明')
                    }
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full border-orange-200 text-orange-600 hover:bg-orange-50" onClick={() => setShowReassignDialog(true)}>
                  <SwitchCamera className="h-4 w-4 mr-2" /> 児童付け替え
                </Button>

                <Button variant="outline" className="w-full border-purple-200 text-purple-600 hover:bg-purple-50" onClick={handleReanalyze}>
                  <RefreshCw className="h-4 w-4 mr-2" /> AI再解析
                </Button>
                
                <Button variant="outline" className="w-full border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => observation && load(observation.id)}>
                  <RefreshCw className="h-4 w-4 mr-2" /> データを元に戻す
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Reassign Dialog */}
        <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>児童付け替え</DialogTitle>
              <DialogDescription>誤登録などの場合に対象児童を変更します。</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label>新しい児童ID</Label>
              <InputLikeSelect value={selectedNewChild} onChange={setSelectedNewChild} />
              <Label>理由</Label>
              <Textarea value={reassignReason} onChange={(e) => setReassignReason(e.target.value)} className="min-h-[80px]" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowReassignDialog(false)}>キャンセル</Button>
                <Button onClick={handleReassign} disabled={loading || !selectedNewChild || !reassignReason.trim()} className="bg-orange-600 hover:bg-orange-700">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SwitchCamera className="mr-2 h-4 w-4" />} 付け替え実行
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </RequireAuth>
  );
}

// 簡易な入力セレクト（今はID文字列を直接入力）
function InputLikeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="新しい児童のIDを入力"
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}