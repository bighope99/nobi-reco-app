import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';
import { extractChildContent } from '@/lib/ai/contentExtractor';

type ChildInfo = {
  id: string;
  family_name: string | null;
  given_name: string | null;
  nickname: string | null;
};

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const replaceMentionTokens = (
  content: string,
  replacements: Array<{ name: string; childId: string }>
) => {
  let next = content;
  replacements.forEach(({ name, childId }) => {
    if (!name) return;
    const pattern = new RegExp(`@${escapeRegex(name)}(?=\\s|$|[、。,.!?])`, 'g');
    next = next.replace(pattern, `@child:${childId}`);
  });
  return next;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getUserSession(user.id);
    if (!session || !session.current_facility_id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    const activityDate = typeof body?.activity_date === 'string' ? body.activity_date : '';
    const mentionedChildren = Array.isArray(body?.mentioned_children) ? body.mentioned_children : [];
    const activityId = typeof body?.activity_id === 'string' ? body.activity_id : null;

    if (!content) {
      return NextResponse.json({ success: false, error: '活動内容を入力してください' }, { status: 400 });
    }

    if (!activityDate) {
      return NextResponse.json({ success: false, error: '日付を入力してください' }, { status: 400 });
    }

    if (mentionedChildren.length === 0) {
      return NextResponse.json({ success: false, error: 'メンションされた児童がありません' }, { status: 400 });
    }

    const { data: children, error: childrenError } = await supabase
      .from('m_children')
      .select('id, family_name, given_name, nickname')
      .in('id', mentionedChildren)
      .eq('facility_id', session.current_facility_id)
      .is('deleted_at', null);

    if (childrenError) {
      console.error('AI observation children fetch error:', childrenError);
      return NextResponse.json({ success: false, error: '児童情報の取得に失敗しました' }, { status: 500 });
    }

    const childMap = new Map<string, ChildInfo>();
    (children as ChildInfo[] | null)?.forEach((child) => {
      childMap.set(child.id, child);
    });

    const replacements: Array<{ name: string; childId: string }> = [];
    childMap.forEach((child) => {
      const fullName = `${child.family_name ?? ''} ${child.given_name ?? ''}`.trim();
      if (fullName) {
        replacements.push({ name: fullName, childId: child.id });
      }
      if (child.nickname) {
        replacements.push({ name: child.nickname, childId: child.id });
      }
    });

    const sanitizedContent = replaceMentionTokens(content, replacements);

    const analysisResults = [];
    const errors = [];

    for (const childId of mentionedChildren) {
      const child = childMap.get(childId);
      if (!child) {
        errors.push({ child_id: childId, error: 'Child not found' });
        continue;
      }

      const fullName = `${child.family_name ?? ''} ${child.given_name ?? ''}`.trim();
      const displayName = child.nickname || fullName || '不明';

      try {
        const extracted = await extractChildContent(sanitizedContent, childId, childId);
        analysisResults.push({
          draft_id: randomUUID(),
          activity_id: activityId,
          child_id: childId,
          child_display_name: displayName,
          observation_date: activityDate,
          content: extracted,
          status: 'pending' as const,
        });
      } catch (error) {
        console.error(`AI extraction failed for child ${childId}:`, error);
        errors.push({
          child_id: childId,
          error: error instanceof Error ? error.message : 'AI extraction failed',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        analysis_results: analysisResults,
      },
      ...(errors.length > 0 && { errors }),
    });
  } catch (error) {
    console.error('AI observation API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
