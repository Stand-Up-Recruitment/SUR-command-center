// Sales tab targets, rates and Diagnosis, shared by the Sales tab and the Overview.
import { int, cmpRag, type Cmp } from '../shared/monthTheme';
import type { MonthWindow } from '../../lib/nzTime';
import { rate, pctChange, isTooEarly, type Rag, type RagContext } from '../../lib/rag';
import { diagnoseSales, type SalesDiagMetric, type Diagnosis } from '../../lib/diagnosis';
import type { SalesFunnel, SalesMonth } from '../../types';

export const STALE_DAYS = 14;
export const DEFAULT_TARGET_PER_SALESPERSON = 10;
export const ratio = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);
export const signRate = (f: SalesFunnel) => ratio(f.signed, f.tobsSent);
export const showRate = (f: SalesFunnel) => (f.noShow == null ? null : ratio(f.callsBooked - f.noShow, f.callsBooked));
export const share = (n: number | null, f: SalesFunnel) => (n == null ? null : ratio(n, f.callsBooked));
export const staleRag = (n: number): Rag => (n === 0 ? 'green' : n <= 5 ? 'amber' : 'red');

export interface Targets { perPerson: number; full: number; proRata: number; perPersonProRata: number }

export function targetsFor(m: SalesMonth, w: MonthWindow, perPerson: number): Targets {
  const elapsed = w.isCurrent ? w.dayOfMonth / w.daysInMonth : 1;
  const full = perPerson * m.salespeople.length;
  return { perPerson, full, proRata: full * elapsed, perPersonProRata: perPerson * elapsed };
}

export function callsCmpFor(m: SalesMonth, w: MonthWindow): Cmp {
  const same = w.isCurrent ? `Same day ${w.prevShortLabel}` : w.prevShortLabel;
  return { label: 'Calls booked', cur: m.cur.callsBooked, prev: m.prev.callsBooked, better: 'up', fmt: int, prevWord: same };
}

/** The Sales tab's Diagnosis: same colour rule as the cards. */
export function salesDiagnosis(m: SalesMonth, w: MonthWindow, perPerson: number): Diagnosis {
  const ctx: RagContext = { isCurrent: w.isCurrent, dayOfMonth: w.dayOfMonth };
  const t = targetsFor(m, w, perPerson);
  const { cur, prev } = m;
  const metric = (name: string, c: number | null, p: number | null, better: 'up' | 'down', group: SalesDiagMetric['group'], section: number): SalesDiagMetric[] =>
    c == null ? [] : [{ name, rag: rate(c, p, better, ctx), pct: p == null ? null : pctChange(c, p), group, section }];
  const tts = m.timeToSign;
  const onTarget = cur.signed >= t.proRata;
  return diagnoseSales({
    tooEarly: isTooEarly(ctx),
    lead: `Signings ${onTarget ? 'on target' : 'behind target'} (${cur.signed} of ${Math.round(t.proRata)}).`,
    onTarget,
    metrics: [
      ...metric('Show rate', showRate(cur), showRate(prev), 'up', 'sales', 2),
      ...metric('Sign rate', signRate(cur), signRate(prev), 'up', 'sales', 1),
      { name: 'Stale ToBs', rag: staleRag(m.open.stale), pct: null, group: 'sales', section: 4,
        phrase: `${m.open.stale} ToB${m.open.stale === 1 ? ' has' : 's have'} sat unsigned for over ${STALE_DAYS} days` },
      { name: 'Calls booked', rag: cmpRag(callsCmpFor(m, w), ctx), pct: pctChange(cur.callsBooked, prev.callsBooked), group: 'upstream', section: 2 },
      ...metric('Not a Fit share', share(cur.notFit, cur), share(prev.notFit, prev), 'down', 'upstream', 2),
      ...metric('Waitlist share', share(cur.waitlist, cur), share(prev.waitlist, prev), 'down', 'supply', 5),
    ],
    note: m.open.stale > 0 && tts.total > 0
      ? tts.max <= STALE_DAYS
        ? `No client in ${tts.label} took longer than ${STALE_DAYS} days to sign.`
        : `Median time to sign in ${tts.label} was ${tts.median} days.`
      : undefined,
  });
}
