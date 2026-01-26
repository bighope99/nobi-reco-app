'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { StaffLayout } from '@/components/layout/staff-layout';
import { ObservationEditor } from '../../_components/observation-editor';

export default function ObservationEditPage() {
  const params = useParams();
  const observationId = useMemo(() => {
    const rawId = (params as Record<string, string | string[]> | undefined)?.id;
    if (!rawId) return '';
    return Array.isArray(rawId) ? rawId[0] : rawId;
  }, [params]);

  return (
    <StaffLayout title="児童記録" subtitle="編集">
      <ObservationEditor mode="edit" observationId={observationId} />
    </StaffLayout>
  );
}
