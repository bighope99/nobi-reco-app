import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { encryptPII } from '@/utils/crypto/piiEncryption';
import { decryptOrFallback } from '@/utils/crypto/decryption-helper';
import { normalizePhone } from '@/lib/children/import-csv';
import {
  updateSearchIndex,
  deleteSearchIndex,
} from '@/utils/pii/searchIndex';

const SIGNED_URL_EXPIRES_IN = 3600;
const GUARDIAN_PHOTO_BUCKET = 'guardian-photos';

async function getSignedPhotoUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  photoPath: string | null
): Promise<string | null> {
  if (!photoPath) return null;
  const { data, error } = await supabase.storage
    .from(GUARDIAN_PHOTO_BUCKET)
    .createSignedUrl(photoPath, SIGNED_URL_EXPIRES_IN);
  if (error || !data) return null;
  return data.signedUrl;
}

// GET /api/guardians/[id] — 保護者詳細取得
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { current_facility_id } = metadata;
    if (!current_facility_id) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    }

    const { data: guardian, error } = await supabase
      .from('m_guardians')
      .select(`
        id,
        family_name,
        family_name_kana,
        phone,
        photo_path,
        notes,
        updated_at,
        created_at,
        _child_guardian (
          relationship,
          is_primary,
          is_emergency_contact,
          child_id,
          m_children (
            id,
            family_name,
            given_name,
            _child_class (
              is_current,
              m_classes ( name )
            )
          )
        )
      `)
      .eq('id', id)
      .eq('facility_id', current_facility_id)
      .is('deleted_at', null)
      .single();

    if (error || !guardian) {
      return NextResponse.json({ error: '保護者が見つかりません' }, { status: 404 });
    }

    const name = decryptOrFallback(guardian.family_name) ?? '';
    const kana = decryptOrFallback(guardian.family_name_kana) ?? '';
    const phone = decryptOrFallback(guardian.phone) ?? '';
    const photoUrl = await getSignedPhotoUrl(supabase, guardian.photo_path);

    const linkedChildren = (guardian._child_guardian ?? [])
      .filter((link: { m_children: unknown }) => link.m_children)
      .map((link: {
        relationship: string | null;
        is_primary: boolean;
        is_emergency_contact: boolean;
        child_id: string;
        m_children: {
          id: string;
          family_name: string;
          given_name: string;
          _child_class: Array<{ is_current: boolean; m_classes: { name: string } | null }>;
        } | null;
      }) => {
        const currentClass = link.m_children!._child_class?.find(c => c.is_current);
        return {
          id: link.m_children!.id,
          name: [
            decryptOrFallback(link.m_children!.family_name),
            decryptOrFallback(link.m_children!.given_name),
          ]
            .filter(Boolean)
            .join(' '),
          class_name: currentClass?.m_classes?.name ?? null,
          relationship: link.relationship,
          is_primary: link.is_primary,
          is_emergency_contact: link.is_emergency_contact,
        };
      });

    const primaryLink = (guardian._child_guardian as Array<{ is_primary: boolean; relationship: string | null }>)
      ?.find(l => l.is_primary);
    const relationship = primaryLink?.relationship ?? (guardian._child_guardian as Array<{ relationship: string | null }>)?.[0]?.relationship ?? null;

    return NextResponse.json({
      data: {
        id: guardian.id,
        name,
        kana,
        phone,
        relationship,
        photo_url: photoUrl,
        photo_path: guardian.photo_path,
        notes: guardian.notes ?? '',
        linked_children: linkedChildren,
        updated_at: guardian.updated_at,
        created_at: guardian.created_at,
      },
    });
  } catch (error) {
    console.error('Guardian GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH /api/guardians/[id] — 保護者更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { current_facility_id } = metadata;
    if (!current_facility_id) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    }

    // 施設スコープ確認
    const { data: existing, error: existingError } = await supabase
      .from('m_guardians')
      .select('id')
      .eq('id', id)
      .eq('facility_id', current_facility_id)
      .is('deleted_at', null)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: '保護者が見つかりません' }, { status: 404 });
    }

    const body = await request.json();
    const { name, kana, phone, notes, photo_path } = body;

    if (name !== undefined && !name?.trim()) {
      return NextResponse.json({ error: '氏名は必須です' }, { status: 400 });
    }

    const normalizedPhone = phone !== undefined
      ? (phone ? normalizePhone(phone) : null)
      : undefined;

    const updateValues: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      updateValues.family_name = encryptPII(name.trim());
    }
    if (kana !== undefined) {
      updateValues.family_name_kana = kana?.trim() ? encryptPII(kana.trim()) : null;
    }
    if (phone !== undefined) {
      updateValues.phone = normalizedPhone ? encryptPII(normalizedPhone) : null;
    }
    if (notes !== undefined) {
      updateValues.notes = notes?.trim() || null;
    }
    if (photo_path !== undefined) {
      updateValues.photo_path = photo_path;
    }

    const { error: updateError } = await supabase
      .from('m_guardians')
      .update(updateValues)
      .eq('id', id)
      .eq('facility_id', current_facility_id);

    if (updateError) {
      console.error('Guardian update error:', updateError.message);
      return NextResponse.json({ error: '保護者の更新に失敗しました' }, { status: 500 });
    }

    // 検索インデックス更新
    const indexUpdates: Promise<void>[] = [];
    if (name !== undefined) {
      indexUpdates.push(updateSearchIndex(supabase, 'guardian', id, 'name', name.trim()));
    }
    if (normalizedPhone !== undefined) {
      indexUpdates.push(updateSearchIndex(supabase, 'guardian', id, 'phone', normalizedPhone));
    }
    await Promise.all(indexUpdates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Guardian PATCH error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/guardians/[id] — 保護者削除（論理削除）
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { current_facility_id } = metadata;
    if (!current_facility_id) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('m_guardians')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('facility_id', current_facility_id)
      .is('deleted_at', null);

    if (error) {
      console.error('Guardian delete error:', error.message);
      return NextResponse.json({ error: '保護者の削除に失敗しました' }, { status: 500 });
    }

    await deleteSearchIndex(supabase, 'guardian', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Guardian DELETE error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
