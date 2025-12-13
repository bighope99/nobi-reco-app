import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getUserSession();
    if (!session || session.role !== 'site_admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Site admin only' },
        { status: 403 }
      );
    }

    const supabase = await createClient();

    const { data: company, error } = await supabase
      .from('m_companies')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: company,
    });
  } catch (error) {
    console.error('Company fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getUserSession();
    if (!session || session.role !== 'site_admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Site admin only' },
        { status: 403 }
      );
    }

    const { name, address, phone, email, status } = await request.json();

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Company name is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: company, error } = await supabase
      .from('m_companies')
      .update({
        name,
        address,
        phone,
        email,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Company update error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update company' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: company,
    });
  } catch (error) {
    console.error('Company update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update company' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getUserSession();
    if (!session || session.role !== 'site_admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Site admin only' },
        { status: 403 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('m_companies')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('id', params.id);

    if (error) {
      console.error('Company delete error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete company' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Company deleted successfully',
    });
  } catch (error) {
    console.error('Company delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete company' },
      { status: 500 }
    );
  }
}