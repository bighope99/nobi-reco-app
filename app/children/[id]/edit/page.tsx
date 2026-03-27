"use client"
import { use } from "react"
import { useRole } from "@/hooks/useRole";
import { StaffLayout } from "@/components/layout/staff-layout";
import ChildForm from "@/components/children/ChildForm";

export default function ChildEditForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { isStaff } = useRole();

  return (
    <StaffLayout title={isStaff ? "児童情報" : "児童編集"}>
      <ChildForm mode="edit" childId={id} readOnly={isStaff} />
    </StaffLayout>
  );
}
