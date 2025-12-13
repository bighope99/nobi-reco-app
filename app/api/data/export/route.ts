import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const session = await getUserSession();
    if (!session?.facility_id || session.role === 'staff') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Facility admin only' },
        { status: 403 }
      );
    }

    const { type } = await request.json();

    if (!type) {
      return NextResponse.json(
        { success: false, error: 'Export type is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    let csvData = '';
    let filename = '';

    switch (type) {
      case 'children':
        const { data: children } = await supabase
          .from('m_children')
          .select(`
            id,
            family_name,
            given_name,
            kana_family_name,
            kana_given_name,
            birthday,
            gender,
            enrollment_status,
            enrollment_type,
            school_grade,
            created_at
          `)
          .eq('facility_id', session.facility_id)
          .is('deleted_at', null)
          .order('family_name', { ascending: true });

        if (children) {
          const headers = [
            'ID', '姓', '名', 'セイ', 'メイ', '生年月日', '性別', 
            '在籍状況', '契約形態', '学年', '登録日'
          ];
          
          const rows = children.map(child => [
            child.id,
            child.family_name || '',
            child.given_name || '',
            child.kana_family_name || '',
            child.kana_given_name || '',
            child.birthday || '',
            child.gender || '',
            child.enrollment_status || '',
            child.enrollment_type || '',
            child.school_grade || '',
            child.created_at || ''
          ]);

          csvData = [headers, ...rows].map(row => 
            row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
          ).join('\n');
        }
        
        filename = `children_${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'records':
        const { data: records } = await supabase
          .from('r_observation')
          .select(`
            id,
            observation_date,
            category,
            content,
            m_children(family_name, given_name),
            m_users(name)
          `)
          .eq('facility_id', session.facility_id)
          .order('observation_date', { ascending: false });

        if (records) {
          const headers = ['記録ID', '記録日', 'カテゴリ', '内容', '児童名', '記録者'];
          
          const rows = records.map((record: any) => [
            record.id,
            record.observation_date || '',
            record.category || '',
            record.content || '',
            record.m_children ? `${record.m_children.family_name} ${record.m_children.given_name}` : '',
            record.m_users ? record.m_users.name : ''
          ]);

          csvData = [headers, ...rows].map(row => 
            row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
          ).join('\n');
        }
        
        filename = `records_${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'attendance':
        const { data: attendance } = await supabase
          .from('h_attendance')
          .select(`
            attendance_date,
            status,
            checked_in_at,
            checked_out_at,
            notes,
            m_children(family_name, given_name)
          `)
          .eq('facility_id', session.facility_id)
          .order('attendance_date', { ascending: false });

        if (attendance) {
          const headers = ['出席日', '状況', 'チェックイン時刻', 'チェックアウト時刻', 'メモ', '児童名'];
          
          const rows = attendance.map((att: any) => [
            att.attendance_date || '',
            att.status || '',
            att.checked_in_at || '',
            att.checked_out_at || '',
            att.notes || '',
            att.m_children ? `${att.m_children.family_name} ${att.m_children.given_name}` : ''
          ]);

          csvData = [headers, ...rows].map(row => 
            row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
          ).join('\n');
        }
        
        filename = `attendance_${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'backup':
        // For full backup, we'd need to implement a more comprehensive solution
        // For now, return a simple response
        return NextResponse.json({
          success: false,
          error: 'Full backup functionality is under development',
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid export type' },
          { status: 400 }
        );
    }

    if (!csvData) {
      return NextResponse.json(
        { success: false, error: 'No data available for export' },
        { status: 404 }
      );
    }

    // Return CSV data as a file download
    const response = new NextResponse(csvData);
    response.headers.set('Content-Type', 'text/csv; charset=utf-8');
    response.headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    
    return response;

  } catch (error) {
    console.error('Data export error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export data' },
      { status: 500 }
    );
  }
}