import type { Alert, KPI } from "@/app/dashboard/_components/types"

/**
 * Mirrors the optimistic update logic in dashboard-client.tsx
 * for alert and KPI updates after attendance actions.
 */
function updateAlertsAndKpi(
  alerts: Alert,
  kpi: KPI,
  action: string,
  childId: string
): { alerts: Alert; kpi: KPI } {
  const updatedAlerts = { ...alerts }
  const updatedKpi = { ...kpi }

  switch (action) {
    case "check_in":
      updatedAlerts.late = alerts.late.filter((a) => a.child_id !== childId)
      updatedKpi.present_now += 1
      updatedKpi.not_arrived = Math.max(0, updatedKpi.not_arrived - 1)
      break
    case "check_out":
      updatedAlerts.overdue = alerts.overdue.filter((a) => a.child_id !== childId)
      updatedKpi.present_now = Math.max(0, updatedKpi.present_now - 1)
      updatedKpi.checked_out += 1
      break
    case "mark_absent":
      updatedAlerts.late = alerts.late.filter((a) => a.child_id !== childId)
      updatedKpi.not_arrived = Math.max(0, updatedKpi.not_arrived - 1)
      break
    case "confirm_unexpected":
      updatedAlerts.unexpected = alerts.unexpected.filter((a) => a.child_id !== childId)
      break
  }

  return { alerts: updatedAlerts, kpi: updatedKpi }
}

describe("Dashboard optimistic update - alerts and KPI", () => {
  const baseAlerts: Alert = {
    overdue: [
      {
        child_id: "child-1",
        name: "田中太郎",
        kana: "たなかたろう",
        class_name: "ひまわり組",
        age_group: "lower",
        grade: 2,
        grade_label: "2年生",
        school_id: null,
        school_name: null,
        scheduled_end_time: "17:00",
        actual_in_time: "14:00",
        minutes_overdue: 45,
        guardian_phone: "090-1234-5678",
      },
    ],
    late: [
      {
        child_id: "child-2",
        name: "佐藤花子",
        kana: "さとうはなこ",
        class_name: "たんぽぽ組",
        age_group: "upper",
        grade: 4,
        grade_label: "4年生",
        school_id: null,
        school_name: null,
        scheduled_start_time: "14:00",
        minutes_late: 30,
        guardian_phone: null,
        alert_triggered_at: "2026-03-12T05:30:00.000Z",
      },
    ],
    unexpected: [
      {
        child_id: "child-3",
        name: "鈴木一郎",
        kana: "すずきいちろう",
        class_name: "ひまわり組",
        age_group: "lower",
        actual_in_time: "13:30",
      },
    ],
  }

  const baseKpi: KPI = {
    scheduled_today: 20,
    present_now: 10,
    not_arrived: 5,
    checked_out: 3,
  }

  describe("check_in action", () => {
    it("removes child from late alerts", () => {
      const { alerts } = updateAlertsAndKpi(baseAlerts, baseKpi, "check_in", "child-2")
      expect(alerts.late).toHaveLength(0)
    })

    it("does not affect overdue or unexpected alerts", () => {
      const { alerts } = updateAlertsAndKpi(baseAlerts, baseKpi, "check_in", "child-2")
      expect(alerts.overdue).toHaveLength(1)
      expect(alerts.unexpected).toHaveLength(1)
    })

    it("increments present_now and decrements not_arrived", () => {
      const { kpi } = updateAlertsAndKpi(baseAlerts, baseKpi, "check_in", "child-2")
      expect(kpi.present_now).toBe(11)
      expect(kpi.not_arrived).toBe(4)
    })
  })

  describe("check_out action", () => {
    it("removes child from overdue alerts", () => {
      const { alerts } = updateAlertsAndKpi(baseAlerts, baseKpi, "check_out", "child-1")
      expect(alerts.overdue).toHaveLength(0)
    })

    it("decrements present_now and increments checked_out", () => {
      const { kpi } = updateAlertsAndKpi(baseAlerts, baseKpi, "check_out", "child-1")
      expect(kpi.present_now).toBe(9)
      expect(kpi.checked_out).toBe(4)
    })
  })

  describe("mark_absent action", () => {
    it("removes child from late alerts", () => {
      const { alerts } = updateAlertsAndKpi(baseAlerts, baseKpi, "mark_absent", "child-2")
      expect(alerts.late).toHaveLength(0)
    })

    it("decrements not_arrived", () => {
      const { kpi } = updateAlertsAndKpi(baseAlerts, baseKpi, "mark_absent", "child-2")
      expect(kpi.not_arrived).toBe(4)
    })

    it("does not change present_now", () => {
      const { kpi } = updateAlertsAndKpi(baseAlerts, baseKpi, "mark_absent", "child-2")
      expect(kpi.present_now).toBe(10)
    })
  })

  describe("confirm_unexpected action", () => {
    it("removes child from unexpected alerts", () => {
      const { alerts } = updateAlertsAndKpi(baseAlerts, baseKpi, "confirm_unexpected", "child-3")
      expect(alerts.unexpected).toHaveLength(0)
    })

    it("does not affect KPI counters", () => {
      const { kpi } = updateAlertsAndKpi(baseAlerts, baseKpi, "confirm_unexpected", "child-3")
      expect(kpi.present_now).toBe(10)
      expect(kpi.not_arrived).toBe(5)
      expect(kpi.checked_out).toBe(3)
    })
  })

  describe("edge cases", () => {
    it("does not go below 0 for not_arrived", () => {
      const kpiWithZero: KPI = { ...baseKpi, not_arrived: 0 }
      const { kpi } = updateAlertsAndKpi(baseAlerts, kpiWithZero, "check_in", "child-2")
      expect(kpi.not_arrived).toBe(0)
    })

    it("does not go below 0 for present_now on check_out", () => {
      const kpiWithZero: KPI = { ...baseKpi, present_now: 0 }
      const { kpi } = updateAlertsAndKpi(baseAlerts, kpiWithZero, "check_out", "child-1")
      expect(kpi.present_now).toBe(0)
    })

    it("handles non-matching child_id gracefully", () => {
      const { alerts, kpi } = updateAlertsAndKpi(baseAlerts, baseKpi, "check_in", "non-existent")
      expect(alerts.late).toHaveLength(1)
      expect(kpi.present_now).toBe(11) // still increments
    })
  })
})
