import { StaffLayout } from "@/components/layout/staff-layout";
import ReportClient from "./_components/report-client";

export default function ReportPage() {
  return (
    <StaffLayout title="AIレポート（検証）">
      <ReportClient />
    </StaffLayout>
  );
}
