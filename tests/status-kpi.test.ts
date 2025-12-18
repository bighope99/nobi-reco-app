import assert from 'node:assert';
import { calculateKpis, determineStatus } from '../app/api/dashboard/summary/utils';

const baseLog = {
  child_id: 'child-1',
  checked_in_at: '2024-05-01T09:00:00Z',
  checked_out_at: null as string | null,
};

const closedLog = {
  ...baseLog,
  child_id: 'child-2',
  checked_out_at: '2024-05-01T12:00:00Z',
};

type MinimalAttendanceListItem = Pick<
  Parameters<typeof calculateKpis>[0][number],
  'status' | 'is_scheduled_today'
>;

(() => {
  assert.strictEqual(determineStatus(baseLog, null, 'scheduled'), 'checked_in');
  assert.strictEqual(determineStatus(null, closedLog, 'scheduled'), 'checked_out');
  assert.strictEqual(determineStatus(null, null, 'absent'), 'absent');
})();

(() => {
  const attendanceList: MinimalAttendanceListItem[] = [
    { status: 'checked_in', is_scheduled_today: true },
    { status: 'checked_out', is_scheduled_today: true },
    { status: 'absent', is_scheduled_today: true },
    { status: 'absent', is_scheduled_today: false },
  ];

  const kpis = calculateKpis(attendanceList as Parameters<typeof calculateKpis>[0]);
  assert.deepStrictEqual(kpis, {
    scheduledToday: 3,
    presentNow: 1,
    notArrived: 1,
    checkedOut: 1,
  });
})();

console.log('status and KPI calculations remain consistent');
