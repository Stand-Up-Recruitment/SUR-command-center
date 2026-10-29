// AU Client Scorecard: Volume 30% + Payment 40% + Retention & Relationship 30%. Rules
// follow the "AU Client Scorecard — Requirements" doc (14 Oct 2026). Pure functions: the
// Clients tab renders this, and the Overview will read it from here rather than recalculate.
import type { ClientInvoice, ClientPlacement, RetentionPlacement } from '../types';
import { companyKey } from './companyKey.js';
import { placementFacts } from './retention.js';

export const WEIGHTS = { volume: 0.3, payment: 0.4, retention: 0.3 } as const;
// Tier cut-offs and the unexplained-departure nudge were reconstructed from the original
// outputs, not read from its code — to confirm with Les before relying on them.
export const TIERS = [{ tier: 'A', min: 80 }, { tier: 'B', min: 70 }, { tier: 'C', min: 50 }, { tier: 'D', min: -Infinity }] as const;
export const UNEXPLAINED_NUDGE_EACH = 5;
export const UNEXPLAINED_NUDGE_CAP = 15;
const LATE_PENALTY_PER_DAY = 3;
const OVERDUE_PENALTY = 15;
const VOID_PENALTY = 5;
const NO_PAID_BASE = 70;
const CLIENT_CAUSED_REASON = 'Client quality';
// NZ clients sit in the same Placements table; they are out of scope.
const NZ_CLIENTS = new Set(['dempsey wood', 'heb', 'rck auckland'].map(n => companyKey(n, n)));

export type Tier = typeof TIERS[number]['tier'];
export type Tone = 'good' | 'ok' | 'bad' | 'neutral';

/** A signal's working: the input rows and the numbered calculation steps. */
export interface Working {
  columns: string[];
  rows: string[][];
  steps: string[];
}

export interface Signal {
  score: number | null; // null = no data, left out of the composite
  tone: Tone;
  headline: string;
  working: Working;
}

export interface ClientScore {
  key: string;
  name: string;
  rank: number;
  score: number;
  tier: Tier;
  placements: number;
  volume: Signal;
  payment: Signal & { overdueCount: number; overdueAmount: number; paidDaysLate: number[] };
  retention: Signal & { redFlags: number };
}

export interface Scorecard {
  asAt: string;
  clients: ClientScore[];
  kpis: { clients: number; placements: number; redFlagClients: number; overdueClients: number; avgDaysLate: number | null };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const dayNum = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86_400_000;
const daysBetween = (from: string, to: string) => dayNum(to) - dayNum(from);
const clamp = (n: number) => Math.min(100, Math.max(0, n));
const r1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const money = (n: number) => `$${Math.round(n).toLocaleString('en-NZ')}`;
const personKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
const scoreTone = (s: number): Tone => (s >= 70 ? 'good' : s >= 50 ? 'ok' : 'bad');

export const tierOf = (score: number): Tier => TIERS.find(t => score >= t.min)!.tier;

// ─── Volume (30%) ─────────────────────────────────────────────────────────────
export function volumeSignal(n: number, maxN: number): Signal {
  const score = r1(Math.min(100, (n / maxN) * 100));
  return {
    score,
    // One placement is a small client, not a bad one.
    tone: n >= 3 ? 'good' : n === 2 ? 'ok' : 'neutral',
    headline: `${n} placement${n === 1 ? '' : 's'}`,
    working: {
      columns: [], rows: [],
      steps: [
        `${n} placement${n === 1 ? '' : 's'} with this client`,
        `Largest client has ${maxN}`,
        `${n} ÷ ${maxN} × 100 = ${fmt(score)} (capped at 100)`,
      ],
    },
  };
}

// ─── Payment (40%) — Xero only ────────────────────────────────────────────────
export type InvoiceClass = 'paid' | 'void' | 'overdue' | 'notDue' | 'other';

export function classifyInvoice(inv: ClientInvoice, asAt: string): { cls: InvoiceClass; daysLate: number | null } {
  if (inv.status === 'PAID') {
    if (inv.amountPaid > 0) {
      const daysLate = inv.fullyPaidOnDate && inv.dueDate ? daysBetween(inv.dueDate, inv.fullyPaidOnDate) : null;
      return { cls: 'paid', daysLate };
    }
    return { cls: 'void', daysLate: null }; // fully credited, no cash received
  }
  if (inv.status === 'AUTHORISED' && inv.dueDate) {
    return inv.dueDate < asAt ? { cls: 'overdue', daysLate: daysBetween(inv.dueDate, asAt) } : { cls: 'notDue', daysLate: null };
  }
  return { cls: 'other', daysLate: null };
}

const CLASS_LABEL: Record<InvoiceClass, string> = { paid: 'Paid', void: 'Void / credited', overdue: 'Overdue now', notDue: 'Not yet due', other: '—' };

export function paymentSignal(invoices: ClientInvoice[], asAt: string): ClientScore['payment'] {
  const rows = invoices
    .map(inv => ({ inv, ...classifyInvoice(inv, asAt) }))
    .sort((a, b) => (a.inv.date ?? '').localeCompare(b.inv.date ?? ''));
  const paid = rows.filter(r => r.cls === 'paid' && r.daysLate != null);
  const overdue = rows.filter(r => r.cls === 'overdue');
  const voids = rows.filter(r => r.cls === 'void');
  const notDue = rows.filter(r => r.cls === 'notDue');
  const overdueAmount = overdue.reduce((s, r) => s + r.inv.amountDue, 0);
  const paidDaysLate = paid.map(r => r.daysLate!);

  const working: Working = {
    columns: ['Invoice', 'Type', 'Issued', 'Due', 'Paid', 'Amount', 'Due now', 'Days late'],
    rows: rows.map(r => [
      r.inv.invoiceNumber, CLASS_LABEL[r.cls], r.inv.date ?? '—', r.inv.dueDate ?? '—',
      r.cls === 'paid' ? r.inv.fullyPaidOnDate ?? '—' : '—',
      `${money(r.inv.total)} ${r.inv.currency}`.trim(),
      r.cls === 'overdue' || r.cls === 'notDue' ? money(r.inv.amountDue) : '—',
      r.daysLate == null ? '—' : String(r.daysLate),
    ]),
    steps: [],
  };

  if (rows.length === 0) {
    working.steps.push('No Australian invoices found in Xero for this client — Payment left out of the score');
    return { score: null, tone: 'neutral', headline: 'no invoices yet', working, overdueCount: 0, overdueAmount: 0, paidDaysLate };
  }

  let base: number;
  if (paid.length === 0) {
    base = NO_PAID_BASE;
    working.steps.push(`No paid invoices to average — base starts at a neutral ${NO_PAID_BASE}`);
  } else {
    const avg = paidDaysLate.reduce((s, d) => s + d, 0) / paid.length;
    base = avg <= 0 ? 100 : Math.max(0, 100 - avg * LATE_PENALTY_PER_DAY);
    working.steps.push(`Average days late over ${paid.length} paid invoice${paid.length === 1 ? '' : 's'}: ${fmt(r1(avg))}`);
    working.steps.push(avg <= 0 ? 'Paid on time or early on average — base 100' : `Base = 100 − ${fmt(r1(avg))} × ${LATE_PENALTY_PER_DAY} = ${fmt(r1(base))}`);
  }
  let score = base;
  if (overdue.length) {
    score -= overdue.length * OVERDUE_PENALTY;
    working.steps.push(`− ${OVERDUE_PENALTY} × ${overdue.length} overdue now (${money(overdueAmount)} outstanding) = ${fmt(r1(score))}`);
  }
  if (voids.length) {
    score -= voids.length * VOID_PENALTY;
    working.steps.push(`− ${VOID_PENALTY} × ${voids.length} void / credited = ${fmt(r1(score))}`);
  }
  if (notDue.length) working.steps.push(`${notDue.length} not yet due — shown, not penalised`);
  score = r1(clamp(score));
  working.steps.push(`Clamped to 0–100: ${fmt(score)}`);

  const avgLate = paid.length ? r1(paidDaysLate.reduce((s, d) => s + d, 0) / paid.length) : null;
  const headline = overdue.length
    ? `${overdue.length} overdue · ${money(overdueAmount)}`
    : avgLate == null ? 'nothing paid yet' : avgLate <= 0 ? 'pays on time' : `${fmt(avgLate)} days late on average`;
  return { score, tone: overdue.length ? 'bad' : scoreTone(score), headline, working, overdueCount: overdue.length, overdueAmount, paidDaysLate };
}

// ─── Retention & Relationship (30%) — reason-aware ───────────────────────────
export function retentionSignal(
  placements: ClientPlacement[],
  jobAdder: { candidate: string; reason: string | null; dropped: boolean }[],
): ClientScore['retention'] {
  const byCandidate = new Map(jobAdder.map(j => [personKey(j.candidate), j]));
  const rows: string[][] = [];
  let redFlags = 0;
  let unexplained = 0;
  const matched = new Set<string>();

  for (const p of placements) {
    if (p.status !== 'End') continue;
    const ja = byCandidate.get(personKey(p.candidate));
    if (ja) matched.add(personKey(p.candidate));
    const reason = ja?.reason ?? null;
    let verdict: string;
    if (reason === CLIENT_CAUSED_REASON) { redFlags++; verdict = 'Client-caused (red flag)'; }
    else if (reason) verdict = 'No penalty';
    else { unexplained++; verdict = 'Unexplained'; }
    rows.push([p.candidate, p.cancellationDate ?? '—', reason ?? 'no reason logged', verdict]);
  }
  // A client-caused drop-off logged in JobAdder but not yet ended in Airtable still counts.
  for (const j of jobAdder) {
    if (j.dropped && j.reason === CLIENT_CAUSED_REASON && !matched.has(personKey(j.candidate))) {
      redFlags++;
      rows.push([j.candidate, '—', j.reason, 'Client-caused (red flag)']);
    }
  }

  const total = placements.length;
  const flagHit = (redFlags / total) * 100;
  const nudge = Math.min(UNEXPLAINED_NUDGE_CAP, unexplained * UNEXPLAINED_NUDGE_EACH);
  const score = r1(clamp(100 - flagHit - nudge));
  const departures = rows.length;
  const steps = [
    `${total} placement${total === 1 ? '' : 's'}, ${departures} departure${departures === 1 ? '' : 's'}`,
    `${redFlags} client-caused red flag${redFlags === 1 ? '' : 's'}: ${redFlags} ÷ ${total} × 100 = ${fmt(r1(flagHit))}`,
    `${unexplained} unexplained: nudge ${UNEXPLAINED_NUDGE_EACH} each, capped at ${UNEXPLAINED_NUDGE_CAP} = ${nudge}`,
    `100 − ${fmt(r1(flagHit))} − ${nudge} = ${fmt(score)}`,
  ];
  const headline = redFlags ? `${redFlags} client-caused departure${redFlags === 1 ? '' : 's'}`
    : departures === 0 ? 'no departures' : unexplained ? `${unexplained} unexplained departure${unexplained === 1 ? '' : 's'}` : 'departures not client-caused';
  return {
    score,
    tone: redFlags ? 'bad' : unexplained ? 'ok' : 'good',
    headline,
    working: { columns: ['Candidate', 'Ended', 'Reason (JobAdder)', 'Counts as'], rows, steps },
    redFlags,
  };
}

// ─── Composite ────────────────────────────────────────────────────────────────
/** Weighted score; a component with no data is dropped and the other weights rescaled. */
export function composite(sub: { volume: number | null; payment: number | null; retention: number | null }): number {
  const parts = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).filter(k => sub[k] != null);
  const w = parts.reduce((s, k) => s + WEIGHTS[k], 0);
  return r1(parts.reduce((s, k) => s + sub[k]! * WEIGHTS[k], 0) / w);
}

export function buildScorecard(
  placements: ClientPlacement[],
  invoices: ClientInvoice[] | null,
  jobAdder: RetentionPlacement[] | null,
  asAt: string,
): Scorecard {
  const groups = new Map<string, ClientPlacement[]>();
  for (const p of placements) {
    const key = companyKey(p.client, p.client);
    if (NZ_CLIENTS.has(key)) continue;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const maxN = Math.max(...[...groups.values()].map(g => g.length), 1);

  const invoicesBy = new Map<string, ClientInvoice[]>();
  for (const inv of invoices ?? []) {
    const k = companyKey(inv.contact, inv.contact);
    invoicesBy.set(k, [...(invoicesBy.get(k) ?? []), inv]);
  }
  const jaBy = new Map<string, { candidate: string; reason: string | null; dropped: boolean }[]>();
  for (const p of jobAdder ?? []) {
    const f = placementFacts(p, asAt);
    const k = companyKey(p.company.name, p.company.name);
    jaBy.set(k, [...(jaBy.get(k) ?? []), { candidate: p.candidate, reason: f.reason, dropped: f.dropped }]);
  }

  const scored = [...groups.entries()].map(([key, ps]) => {
    const volume = volumeSignal(ps.length, maxN);
    const payment = paymentSignal(invoices ? invoicesBy.get(key) ?? [] : [], asAt);
    if (!invoices) payment.working.steps = ['Xero invoices unavailable — Payment left out of the score'];
    const retention = retentionSignal(ps, jaBy.get(key) ?? []);
    if (!jobAdder) retention.working.steps.unshift('JobAdder notes unavailable — every departure treated as unexplained');
    const score = composite({ volume: volume.score, payment: payment.score, retention: retention.score });
    return { key, name: ps[0].client, rank: 0, score, tier: tierOf(score), placements: ps.length, volume, payment, retention };
  });
  scored.sort((a, b) => b.score - a.score || b.placements - a.placements || a.name.localeCompare(b.name));
  scored.forEach((c, i) => { c.rank = i + 1; });

  const allLate = scored.flatMap(c => c.payment.paidDaysLate);
  return {
    asAt,
    clients: scored,
    kpis: {
      clients: scored.length,
      placements: scored.reduce((s, c) => s + c.placements, 0),
      redFlagClients: scored.filter(c => c.retention.redFlags > 0).length,
      overdueClients: scored.filter(c => c.payment.overdueCount > 0).length,
      avgDaysLate: allLate.length ? r1(allLate.reduce((s, d) => s + d, 0) / allLate.length) : null,
    },
  };
}
