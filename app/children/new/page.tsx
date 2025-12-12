"use client"
import { StaffLayout } from "@/components/layout/staff-layout";
import ChildForm from "@/components/children/ChildForm";

export default function ChildRegistrationForm() {
  return (
    <StaffLayout title="園児登録">
      <ChildForm mode="new" />
    </StaffLayout>
  );
}