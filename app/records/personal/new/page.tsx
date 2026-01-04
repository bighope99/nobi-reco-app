'use client';

import { Suspense } from 'react';
import { ObservationEditor } from '../_components/observation-editor';
import { StaffLayout } from '@/components/layout/staff-layout';

export const dynamic = 'force-dynamic';

export default function ObservationNewPage() {
  return (
    <StaffLayout title="個別記録" subtitle="新規作成">
      <Suspense fallback={<div className="p-8 text-center">読み込み中...</div>}>
        <ObservationEditor mode="new" />
      </Suspense>
    </StaffLayout>
  );
}
