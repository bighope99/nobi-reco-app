"use client"
import { StaffLayout } from "@/components/layout/staff-layout";
import ChildForm from "@/components/children/ChildForm";

export default function ChildRegistrationForm() {
  return (
    <StaffLayout title="児童登録">
      <ChildForm mode="new" />
    </StaffLayout>
  );
}