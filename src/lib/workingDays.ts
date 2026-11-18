// Working days (Mon–Fri minus NZ public holidays) and the v2 "needed by today" + colour rules.
import type { TimeFrame } from '../types';

// shortcut: national holidays only, hardcoded to 2027; regional anniversary days are ignored.
// Add each new year's dates before it starts.
const NZ_HOLIDAYS = new Set([
  '2026-01-01', '2026-01-02', '2026-02-06', '2026-04-03', '2026-04-06', '2026-04-27', '2026-06-01',
  '2026-07-10', '2026-10-26', '2026-12-25', '2026-12-28',
  '2027-01-01', '2027-01-04', '2027-02-08', '2027-03-26', '2027-03-29', '2027-04-26', '2027-06-07',
  '2027-06-25', '2027-10-25', '2027-12-27', '2027-12-28',
]);

const NZ_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' });

const isWorkingDay = (d: Date) => {
  const dow = d.getUTCDay();
  return dow !== 0 && dow !== 6 && !NZ_HOLIDAYS.has(d.toISOString().slice(0, 10));
};

export interface WorkingDays { elapsed: number; total: number }

/** Working days elapsed (today included if it's one) and in total, for the NZ week or month containing `now`. */
export function workingDays(frame: TimeFrame, now = Date.now()): WorkingDays {
  const [y, m, d] = NZ_DATE.format(now).split('-').map(Number);
  const today = Date.UTC(y, m - 1, d);
  const dow = (new Date(today).getUTCDay() + 6) % 7; // 0 = Monday
  const [first, last] = frame === 'week'
    ? [today - dow * 86_400_000, today + (6 - dow) * 86_400_000]
    : [Date.UTC(y, m - 1, 1), Date.UTC(y, m, 0)];
  let elapsed = 0, total = 0;
  for (let t = first; t <= last; t += 86_400_000) {
    if (!isWorkingDay(new Date(t))) continue;
    total++;
    if (t <= today) elapsed++;
  }
  return { elapsed, total };
}

/** Target × share of working days elapsed, rounded to a whole number. */
export const neededByToday = (target: number, wd: WorkingDays) =>
  wd.total > 0 ? Math.round((target * wd.elapsed) / wd.total) : 0;

export type Pace = 'green' | 'amber' | 'red' | 'grey';

/** Done ÷ needed by today: ≥100% green, 75–99% amber, under 75% red; grey when nothing is needed yet or nothing happened. */
export function pace(done: number | null | undefined, needed: number): Pace {
  if (done == null || needed <= 0) return 'grey';
  const r = done / needed;
  if (done === 0) return 'red';
  return r >= 1 ? 'green' : r >= 0.75 ? 'amber' : 'red';
}

export const PACE_LABEL: Record<Pace, string> = { green: 'ON TRACK', amber: 'AT RISK', red: 'OFF TRACK', grey: 'NO DATA' };
