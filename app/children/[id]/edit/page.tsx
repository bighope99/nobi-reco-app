"use client"
import { StaffLayout } from "@/components/layout/staff-layout";
import ChildForm from "@/components/children/ChildForm";

export default function ChildEditForm({ params }: { params: { id: string } }) {
  return (
    <StaffLayout title="園児編集">
      <ChildForm mode="edit" childId={params.id} />
    </StaffLayout>
  );
}
