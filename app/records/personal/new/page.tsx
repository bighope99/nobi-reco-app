'use client';

import { ObservationEditor } from '../_components/observation-editor';
import { StaffLayout } from '@/components/layout/staff-layout';

export default function ObservationNewPage() {
  return (
    <StaffLayout title="個別記録" subtitle="新規作成">
      <ObservationEditor mode="new" />
    </StaffLayout>
  );
}
