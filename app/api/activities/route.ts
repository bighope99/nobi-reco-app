import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // 認証チェック
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // セッションからfacility_idを取得
    const userSession = await getUserSession(session.user.id);
    if (!userSession?.current_facility_id) {
      return NextResponse.json(
        { success: false, error: 'Facility not found in session' },
        { status: 400 }
      );
    }

    const facility_id = userSession.current_facility_id;
    const dateParam = searchParams.get('date');
    const class_id = searchParams.get('class_id');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 対象日（デフォルトは今日）
    const targetDate = dateParam || new Date().toISOString().split('T')[0];

    // 活動記録を取得
    let query = supabase
      .from('r_activity')
      .select(`
        id,
        activity_date,
        title,
        content,
        snack,
        photos,
        class_id,
        mentioned_children,
        created_at,
        updated_at,
        m_classes!inner (
          id,
          name
        ),
        m_users!r_activity_created_by_fkey (
          id,
          name
        )
      `)
      .eq('facility_id', facility_id)
      .is('deleted_at', null)
      .order('activity_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 日付フィルター
    if (dateParam) {
      query = query.eq('activity_date', targetDate);
    }

    // クラスフィルター
    if (class_id) {
      query = query.eq('class_id', class_id);
    }

    const { data: activities, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      );
    }

    // 各活動の観察記録数を取得
    const activityIds = activities?.map(a => a.id) || [];
    let observationCounts: { [key: string]: number } = {};

    if (activityIds.length > 0) {
      const { data: observations } = await supabase
        .from('r_observation')
        .select('activity_id')
        .in('activity_id', activityIds)
        .is('deleted_at', null);

      if (observations) {
        observations.forEach((obs: any) => {
          observationCounts[obs.activity_id] = (observationCounts[obs.activity_id] || 0) + 1;
        });
      }
    }

    // データを整形
    const formattedActivities = (activities || []).map((activity: any) => ({
      activity_id: activity.id,
      activity_date: activity.activity_date,
      title: activity.title || '無題',
      content: activity.content,
      snack: activity.snack,
      photos: activity.photos || [],
      class_id: activity.class_id,
      class_name: activity.m_classes?.name || '',
      mentioned_children: activity.mentioned_children || [],
      created_by: activity.m_users?.name || '',
      created_at: activity.created_at,
      individual_record_count: observationCounts[activity.id] || 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        activities: formattedActivities,
        total: count || formattedActivities.length,
        has_more: (count || 0) > offset + limit,
      },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // セッションからfacility_idを取得
    const userSession = await getUserSession(session.user.id);
    if (!userSession?.current_facility_id) {
      return NextResponse.json(
        { success: false, error: 'Facility not found in session' },
        { status: 400 }
      );
    }

    const facility_id = userSession.current_facility_id;
    const body = await request.json();
    const { activity_date, class_id, title, content, snack, child_ids, photos } = body;

    if (!activity_date || !class_id || !content) {
      return NextResponse.json(
        { success: false, error: 'activity_date, class_id, and content are required' },
        { status: 400 }
      );
    }

    if (photos && !Array.isArray(photos)) {
      return NextResponse.json(
        { success: false, error: 'photos must be an array' },
        { status: 400 }
      );
    }

    if (Array.isArray(photos) && photos.length > 6) {
      return NextResponse.json(
        { success: false, error: '写真は最大6枚までです' },
        { status: 400 }
      );
    }

    const normalizedPhotos = Array.isArray(photos)
      ? photos
          .map((photo: any) => {
            if (!photo || typeof photo.url !== 'string') return null;
            return {
              url: photo.url,
              caption: typeof photo.caption === 'string' ? photo.caption : null,
              thumbnail_url: typeof photo.thumbnail_url === 'string' ? photo.thumbnail_url : null,
              file_id: typeof photo.file_id === 'string' ? photo.file_id : null,
              file_path: typeof photo.file_path === 'string' ? photo.file_path : null,
            };
          })
          .filter(Boolean)
      : null;

    // 活動記録を作成
    const { data: activity, error: activityError } = await supabase
      .from('r_activity')
      .insert({
        facility_id,
        class_id,
        activity_date,
        title: title || '活動記録',
        content,
        snack,
        photos: normalizedPhotos,
        created_by: session.user.id,
      })
      .select()
      .single();

    if (activityError) {
      console.error('Activity insert error:', activityError);
      return NextResponse.json(
        { success: false, error: 'Failed to create activity' },
        { status: 500 }
      );
    }

    // LangChainで個別記録を生成（簡素化版：入力をそのまま返す）
    const observations = [];
    if (child_ids && child_ids.length > 0) {
      // Initialize LangChain
      const model = new ChatOpenAI({
        modelName: 'gpt-4o-mini',
        temperature: 0.7,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });

      // Simple prompt that returns the input as-is
      const template = `以下の活動内容から、児童の様子を記録してください。

活動内容: {content}

記録:`;

      const prompt = PromptTemplate.fromTemplate(template);
      const chain = prompt.pipe(model);

      for (const child_id of child_ids) {
        try {
          // Call LangChain (minimal implementation)
          const result = await chain.invoke({ content });
          const observationContent = result.content || content;

          // Insert observation record
          const { error: obsError } = await supabase
            .from('r_observation')
            .insert({
              child_id,
              facility_id,
              activity_id: activity.id,
              recorded_at: new Date().toISOString(),
              content: observationContent,
              created_by: session.user.id,
            });

          if (!obsError) {
            observations.push({ child_id, content: observationContent });
          }
        } catch (error) {
          console.error('LangChain error for child:', child_id, error);
          // Continue with next child even if one fails
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        activity_id: activity.id,
        activity_date: activity.activity_date,
        title: activity.title,
        content: activity.content,
        observations_created: observations.length,
        observations,
      },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
