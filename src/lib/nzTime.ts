// NZ-time date helpers. Every Marketing-tab window is defined in Pacific/Auckland
// calendar days, as inclusive YYYY-MM-DD strings (the shape Meta's time_range takes),
// and converted to UTC-ms half-open ranges for filtering Airtable timestamps.
const TZ = 'Pacific/Auckland';

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function nzParts(t: number) {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(t)).map(x => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

function offsetMs(t: number) {
  const p = nzParts(t);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(t / 1000) * 1000;
}

/** UTC ms of 00:00 NZ time on the given calendar day (month is 1-based, overflow allowed). */
function nzMidnight(y: number, m: number, d: number): number {
  const guess = Date.UTC(y, m - 1, d);
  const first = guess - offsetMs(guess);
  return guess - offsetMs(first);
}

export function ymd(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toISOString().slice(0, 10);
}

function parseYmd(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(s: string, n: number): string {
  const { y, m, d } = parseYmd(s);
  return ymd(y, m, d + n);
}

/** Half-open UTC-ms range covering inclusive NZ days [since, until]. */
export function toMs(r: DayRange): { from: number; to: number } {
  const a = parseYmd(r.since);
  const b = parseYmd(r.until);
  return { from: nzMidnight(a.y, a.m, a.d), to: nzMidnight(b.y, b.m, b.d + 1) };
}

/** NZ calendar date (YYYY-MM-DD) of a timestamp. */
export function nzDate(t: number | string): string {
  const p = nzParts(typeof t === 'string' ? new Date(t).getTime() : t);
  return ymd(p.y, p.m, p.d);
}

export interface DayRange { since: string; until: string }

export interface MonthWindow {
  month: string;            // 'YYYY-MM'
  label: string;            // 'September 2026'
  shortLabel: string;       // 'Sep'
  prevShortLabel: string;   // 'Aug'
  cur: DayRange;            // month to date (or full month when past)
  prev: DayRange;           // same span of the previous month
  isCurrent: boolean;
  dayOfMonth: number;       // days elapsed in cur (inclusive)
  daysInMonth: number;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function currentMonthKey(now = Date.now()): string {
  const p = nzParts(now);
  return `${p.y}-${String(p.m).padStart(2, '0')}`;
}

/** The last `n` month keys ending at the current NZ month, newest first. */
export function recentMonthKeys(n: number, now = Date.now()): string[] {
  const p = nzParts(now);
  return Array.from({ length: n }, (_, i) => ymd(p.y, p.m - i, 1).slice(0, 7));
}

/**
 * Current month: 1st → today, vs 1st → same day last month (clamped to last month's
 * length; on the last day of this month, compares with all of last month).
 * Past month: full month vs full previous month.
 */
export function monthWindow(month: string, now = Date.now()): MonthWindow {
  const [y, m] = month.split('-').map(Number);
  const today = nzParts(now);
  const isCurrent = today.y === y && today.m === m;
  const dim = daysInMonth(y, m);
  const prevDim = daysInMonth(y, m - 1);
  const day = isCurrent ? today.d : dim;
  const prevDay = day === dim ? prevDim : Math.min(day, prevDim);
  const prevMonth = parseYmd(ymd(y, m - 1, 1));
  return {
    month,
    label: `${MONTHS[m - 1]} ${y}`,
    shortLabel: MONTHS[m - 1].slice(0, 3),
    prevShortLabel: MONTHS[prevMonth.m - 1].slice(0, 3),
    cur: { since: ymd(y, m, 1), until: ymd(y, m, day) },
    prev: { since: ymd(prevMonth.y, prevMonth.m, 1), until: ymd(prevMonth.y, prevMonth.m, prevDay) },
    isCurrent,
    dayOfMonth: day,
    daysInMonth: dim,
  };
}

/** Trailing-N-days range ending on (and including) `until`. */
export function trailingDays(until: string, days: number): DayRange {
  return { since: addDays(until, -(days - 1)), until };
}

/** The 12 full-month ranges ending with `month` (oldest first); the last one is clipped to `untilCap`. */
export function last12Months(month: string, untilCap: string): (DayRange & { key: string; label: string })[] {
  const [y, m] = month.split('-').map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const mm = parseYmd(ymd(y, m - 11 + i, 1));
    const until = ymd(mm.y, mm.m, daysInMonth(mm.y, mm.m));
    return {
      key: `${mm.y}-${String(mm.m).padStart(2, '0')}`,
      label: MONTHS[mm.m - 1].slice(0, 3),
      since: ymd(mm.y, mm.m, 1),
      until: until > untilCap ? untilCap : until,
    };
  });
}
