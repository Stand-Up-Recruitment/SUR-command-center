// Sales tab v2 rules (Les's brief, 26 Nov 2026): done vs needed by today, today's actions, biggest break.
import type { SalesFunnel, SalesMonth } from '../types';
import { pace, type Pace } from './workingDays.ts';

export const CALL_DAYS = 14;    // unsigned longer than this → personal call today
export const WATCH_DAYS = 8;    // unsigned 8–14 days → call before day 14

/** Meetings had = booked minus no-shows; booked until no-shows are logged. */
export const meetingsHad = (f: SalesFunnel) => f.callsHeld ?? f.callsBooked;
export const pctOf = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);
export const closeRate = (f: SalesFunnel) => pctOf(f.signed, meetingsHad(f));

/** Monthly target × day of month ÷ days in month, rounded up (the full target for a past month). */
export const neededBy = (target: number, dayOfMonth: number, daysInMonth: number) =>
  Math.ceil((target * dayOfMonth) / daysInMonth);

/** Green at or ahead, amber 75–99%, red under 75%, grey with no data or no target. Never green for zero. */
export const vsTarget = (done: number | null, needed: number): Pace => pace(done, needed);

export type OpenStatus = 'CALL' | 'WATCH' | 'IN SEQUENCE';
// "Waiting" clients told us when they'll be back, so they never need a call.
export const openStatus = (t: { stage: string; days: number }): OpenStatus =>
  t.stage !== 'Waiting' && t.days > CALL_DAYS ? 'CALL' : t.stage !== 'Waiting' && t.days >= WATCH_DAYS ? 'WATCH' : 'IN SEQUENCE';

export type SalesLevel = 'CALL NOW' | 'THIS WEEK' | 'PUSH' | 'SET UP';
export interface SalesAction { level: SalesLevel; who: string; title: string; detail: string; action: string }

/** Today's actions, worst first. Emails are automatic (Rachel's sequence), so only calls are flagged. */
export function salesActions(m: SalesMonth, target: number, dayOfMonth: number, daysInMonth: number): SalesAction[] {
  const out: SalesAction[] = [];
  for (const t of m.open.list.filter(t => openStatus(t) === 'CALL')) {
    out.push({ level: 'CALL NOW', who: t.who, title: t.company, detail: `Unsigned ${t.days} days · ${t.stage}`, action: 'Personal call today' });
  }
  const watch = m.open.list.filter(t => openStatus(t) === 'WATCH');
  for (const who of new Set(watch.map(t => t.who))) {
    const mine = watch.filter(t => t.who === who);
    out.push({
      level: 'THIS WEEK', who, title: `${mine.length} ToB${mine.length === 1 ? '' : 's'} unsigned ${WATCH_DAYS}–${CALL_DAYS} days`,
      detail: mine.map(t => `${t.company} (${t.days}d)`).join(', '), action: `Call before day ${CALL_DAYS}`,
    });
  }
  const needed = neededBy(target, dayOfMonth, daysInMonth);
  const left = target - m.cur.signed;
  if (target > 0 && m.cur.signed < needed && left > 0) {
    const daysLeft = daysInMonth - dayOfMonth;
    out.push({
      level: 'PUSH', who: 'Les', title: `${m.cur.signed} signed, need ${needed} by today`,
      detail: `Need ${left} signing${left === 1 ? '' : 's'} in ${daysLeft} day${daysLeft === 1 ? '' : 's'} to hit ${target}`,
      action: 'Chase the warmest open ToBs',
    });
  }
  if (m.cur.noShow == null) {
    out.push({ level: 'SET UP', who: 'Trung', title: 'No-shows not logged', detail: 'Meetings had and close rate use meetings booked until No Show is a call outcome in Airtable', action: 'Add No Show to Client Paid Ads' });
  }
  out.push({ level: 'SET UP', who: 'Rachel → Trung', title: 'Sequence timing missing', detail: 'The tab can’t tell when a ToB’s follow-up sequence has finished', action: 'Send which day each follow-up goes out' });
  return out;
}

/** The funnel step whose conversion dropped the most vs last month, in plain English. null if none dropped. */
export function biggestBreak(m: SalesMonth): string | null {
  const steps = [
    { name: 'Meeting → ToB sent', cur: pctOf(m.cur.tobsSent, meetingsHad(m.cur)), prev: pctOf(m.prev.tobsSent, meetingsHad(m.prev)) },
    { name: 'ToB sent → signed', cur: pctOf(m.cur.signed, m.cur.tobsSent), prev: pctOf(m.prev.signed, m.prev.tobsSent) },
  ];
  const drops = steps
    .filter(s => s.cur != null && s.prev != null && s.cur < s.prev)
    .sort((a, b) => (b.prev! - b.cur!) - (a.prev! - a.cur!));
  const s = drops[0];
  return s ? `${s.name}: ${Math.round(s.cur!)}% vs ${Math.round(s.prev!)}% last month` : null;
}
