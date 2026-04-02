import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

export async function GET() {
  try {
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { data: tags, error: tagError } = await supabase
      .from('m_observation_tags')
      .select('id, name, description, color, sort_order')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order');

    if (tagError) {
      console.error('Failed to load observation tags:', tagError);
      return NextResponse.json({ success: false, error: tagError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: tags ?? [] });
  } catch (error) {
    console.error('Observation tags API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
