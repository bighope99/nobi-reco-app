import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

export async function GET() {
  try {
    const session = await getUserSession();
    if (!session || session.role !== 'site_admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Site admin only' },
        { status: 403 }
      );
    }

    const supabase = await createClient();

    const { data: companies, error } = await supabase
      .from('m_companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Companies fetch error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch companies' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: companies,
    });
  } catch (error) {
    console.error('Companies API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getUserSession();
    if (!session || session.role !== 'site_admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Site admin only' },
        { status: 403 }
      );
    }

    const { name, address, phone, email } = await request.json();

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Company name is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: company, error } = await supabase
      .from('m_companies')
      .insert({
        name,
        address,
        phone,
        email,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('Company insert error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create company' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: company,
    });
  } catch (error) {
    console.error('Company create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create company' },
      { status: 500 }
    );
  }
}