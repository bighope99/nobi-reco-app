"use client"
import { use } from "react"
import { StaffLayout } from "@/components/layout/staff-layout";
import ChildForm from "@/components/children/ChildForm";

export default function ChildEditForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <StaffLayout title="園児編集">
      <ChildForm mode="edit" childId={id} />
    </StaffLayout>
  );
}
