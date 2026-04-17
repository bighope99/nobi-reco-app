'use client';

import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ChildItem = {
  id: string;
  name: string;
  grade: number | null;
};

type ReportResult = {
  yaml: string;
  report: string;
  prompt_template: string;
  child_name: string;
  observation_count: number;
  truncated: boolean;
};

function ChildSelect({
  children,
  value,
  onChange,
}: {
  children: ChildItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<number | null, ChildItem[]>();
    for (const child of children) {
      const grade = child.grade;
      if (!map.has(grade)) map.set(grade, []);
      map.get(grade)!.push(child);
    }
    // 学年の降順でソート（null は最後）
    const entries = [...map.entries()].sort((a, b) => {
      if (a[0] === null) return 1;
      if (b[0] === null) return -1;
      return b[0] - a[0];
    });
    return entries;
  }, [children]);

  const gradeLabel = (grade: number | null) => {
    if (grade === null) return '学年不明';
    if (grade === 0) return '未就学';
    return `${grade}年生`;
  };

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="子どもを選択してください" />
      </SelectTrigger>
      <SelectContent>
        {grouped.map(([grade, items]: [number | null, ChildItem[]]) => (
          <SelectGroup key={String(grade)}>
            <SelectLabel>{gradeLabel(grade)}</SelectLabel>
            {items.map((child: ChildItem) => (
              <SelectItem key={child.id} value={child.id}>
                {child.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function ReportClient() {
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showYaml, setShowYaml] = useState(false);

  useEffect(() => {
    fetch('/api/children?status=enrolled&sort_by=name&sort_order=asc&limit=200')
      .then((r) => r.json())
      .then((data) => {
        const kids = (data.data?.children || []).map((c: { child_id: string; name: string; grade?: number | null }) => ({
          id: c.child_id,
          name: c.name,
          grade: c.grade ?? null,
        }));
        setChildren(kids);
      })
      .catch((err) => {
        console.error('Failed to fetch children:', err);
      });
  }, []);

  const canGenerate = selectedChildId && startDate && endDate && !loading;

  const handleGenerate = async () => {
    if (!selectedChildId || !startDate || !endDate) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/records/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          child_id: selectedChildId,
          from_date: format(startDate, 'yyyy-MM-dd'),
          to_date: format(endDate, 'yyyy-MM-dd'),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const msg = json.error || 'レポート生成に失敗しました';
        setError(msg);
        toast.error(msg);
        return;
      }

      setResult(json.data as ReportResult);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'レポート生成中にエラーが発生しました';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      {/* 操作パネル */}
      <Card>
        <CardHeader>
          <CardTitle>レポート生成条件</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">子どもを選択</label>
            <ChildSelect
              children={children}
              value={selectedChildId}
              onChange={setSelectedChildId}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">開始日</label>
              <DatePicker
                date={startDate}
                onSelect={setStartDate}
                placeholder="開始日を選択"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">終了日</label>
              <DatePicker
                date={endDate}
                onSelect={setEndDate}
                placeholder="終了日を選択"
              />
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                生成中...
              </>
            ) : (
              'AIレポートを生成'
            )}
          </Button>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <>
          {/* プロンプトテンプレート（折りたたみ） */}
          <Card>
            <CardContent className="pt-4">
              <button
                type="button"
                className="flex w-full items-center justify-between text-sm font-medium"
                onClick={() => setShowPrompt(!showPrompt)}
              >
                <span>プロンプトテンプレート</span>
                {showPrompt ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </button>
              {showPrompt && (
                <pre className="mt-3 overflow-auto rounded bg-slate-50 p-4 text-xs">
                  {result.prompt_template}
                </pre>
              )}
            </CardContent>
          </Card>

          {/* YAMLデータ（折りたたみ） */}
          <Card>
            <CardContent className="pt-4">
              <button
                type="button"
                className="flex w-full items-center justify-between text-sm font-medium"
                onClick={() => setShowYaml(!showYaml)}
              >
                <span>
                  入力データ (YAML) — {result.observation_count}件
                  {result.truncated && ' (100件で切り捨て)'}
                </span>
                {showYaml ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </button>
              {showYaml && (
                <pre className="mt-3 overflow-auto rounded bg-slate-50 p-4 text-xs">
                  {result.yaml}
                </pre>
              )}
            </CardContent>
          </Card>

          {/* 生成レポート */}
          <Card>
            <CardHeader>
              <CardTitle>{result.child_name} の成長レポート</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {result.report}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
