import type { Alert, KPI } from '@/app/dashboard/_components/types';

/**
 * Optimistic update for alerts and KPI after an attendance action.
 * KPI counters are only adjusted when the target child is found in
 * the relevant alert list, preventing incorrect counts for unknown IDs.
 */
export function updateAlertsAndKpi(
  alerts: Alert,
  kpi: KPI,
  action: string,
  childId: string
): { alerts: Alert; kpi: KPI } {
  const updatedAlerts = { ...alerts };
  const updatedKpi = { ...kpi };

  switch (action) {
    case 'check_in': {
      const hadLateAlert = alerts.late.some((a) => a.child_id === childId);
      updatedAlerts.late = alerts.late.filter((a) => a.child_id !== childId);
      if (hadLateAlert) {
        updatedKpi.present_now += 1;
        updatedKpi.not_arrived = Math.max(0, updatedKpi.not_arrived - 1);
      }
      break;
    }
    case 'check_out': {
      const hadOverdueAlert = alerts.overdue.some((a) => a.child_id === childId);
      updatedAlerts.overdue = alerts.overdue.filter((a) => a.child_id !== childId);
      if (hadOverdueAlert) {
        updatedKpi.present_now = Math.max(0, updatedKpi.present_now - 1);
        updatedKpi.checked_out += 1;
      }
      break;
    }
    case 'mark_absent': {
      updatedAlerts.late = alerts.late.filter((a) => a.child_id !== childId);
      // 欠席確定により未到着カウントから除外（遅刻・未登所どちらの場合も）
      updatedKpi.not_arrived = Math.max(0, updatedKpi.not_arrived - 1);
      break;
    }
    case 'confirm_unexpected':
      updatedAlerts.unexpected = alerts.unexpected.filter((a) => a.child_id !== childId);
      break;
    case 'cancel_check_out':
      // 帰宅取り消し: checked_out → checked_in に戻る
      updatedKpi.present_now += 1;
      updatedKpi.checked_out = Math.max(0, updatedKpi.checked_out - 1);
      break;
    case 'cancel_check_in':
      // 登所取り消し: checked_in → absent に戻る
      updatedKpi.present_now = Math.max(0, updatedKpi.present_now - 1);
      updatedKpi.not_arrived += 1;
      break;
  }

  return { alerts: updatedAlerts, kpi: updatedKpi };
}
