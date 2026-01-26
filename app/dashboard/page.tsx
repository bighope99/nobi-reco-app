import { StaffLayout } from "@/components/layout/staff-layout";
import DashboardClient from "./_components/dashboard-client";

export default function DashboardPage() {
  return (
    <StaffLayout title="ダッシュボード">
      <DashboardClient />
    </StaffLayout>
  );
}
