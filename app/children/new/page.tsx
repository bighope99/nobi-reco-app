"use client"
import { useRole } from "@/hooks/useRole";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { StaffLayout } from "@/components/layout/staff-layout";
import ChildForm from "@/components/children/ChildForm";

export default function ChildRegistrationForm() {
  const { isStaff } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (isStaff) {
      router.replace("/children");
    }
  }, [isStaff, router]);

  if (isStaff) return null;

  return (
    <StaffLayout title="新規登録">
      <ChildForm mode="new" />
    </StaffLayout>
  );
}
