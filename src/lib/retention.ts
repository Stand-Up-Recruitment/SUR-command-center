// Retention tab maths (spec: Retention_Tab_Spec_Trung_Rachel, 6 Oct 2026). Pure functions over the
// JobAdder placements returned by the n8n Retention webhook, shared by the Retention tab and Overview.
import { nzDate } from './nzTime.js';
import type { RetentionPlacement, RetentionSettings } from '../types';

export const GUARANTEE_DAYS = 112;            // 16 weeks, counted from the start date
const DROP_OFF_STATUS_ID = 5177;              // "Placement drop off"
const FAMILY_FLAG_SHARE = 0.2;                // family/personal above this = used as a hiding spot

export const DEFAULT_RETENTION_SETTINGS: RetentionSettings = { greenMax: 20, amberMax: 30, rachelCutoff: '2026-09-01' };

// ─── Rachel's labels (see docs/retention/labelling-guide.md) ──────────────────
export type ReasonOwner = 'Recruiter' | 'Sales' | 'Rachel' | 'None';
export const REASONS: { name: string; stage: 'Pre' | 'Post' | 'Either'; owner: ReasonOwner; match: RegExp }[] = [
  { name: 'Cold feet / buy-in', stage: 'Pre', owner: 'Recruiter', match: /cold feet|buy-in/i },
  { name: 'Client pulled role', stage: 'Pre', owner: 'Sales', match: /client pulled/i },
  { name: 'Skills', stage: 'Post', owner: 'Recruiter', match: /skill/i },
  { name: 'Attitude', stage: 'Post', owner: 'Recruiter', match: /attitude/i },
  { name: 'Settling in', stage: 'Post', owner: 'Rachel', match: /settling/i },
  { name: 'Client quality', stage: 'Post', owner: 'Sales', match: /client quality/i },
  { name: 'Family / personal', stage: 'Either', owner: 'None', match: /family|personal/i },
];
export const OWNERS: ReasonOwner[] = ['Recruiter', 'Sales', 'Rachel', 'None'];

/** "Key: value" line from a note, e.g. field(text, 'Reason'). */
function field(text: string, key: string): string | null {
  const m = text.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, 'im'));
  return m ? m[1].trim() : null;
}

const LABEL_LINE = /^\s*(Reason|Stage|Signalled by|Signal date|Outcome|Amount lost|Replaces)\s*:/i;

/** Note text without its "Key: value" label lines. */
function freeText(text: string): string {
  return text.split('\n').filter(l => !LABEL_LINE.test(l)).join(' ').replace(/\s+/g, ' ').trim();
}

// ─── Dates (YYYY-MM-DD, NZ calendar days) ─────────────────────────────────────
const dayNum = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86_400_000;
const daysBetween = (from: string, to: string) => dayNum(to) - dayNum(from);
export const addDaysYmd = (ymd: string, n: number) => new Date((dayNum(ymd) + n) * 86_400_000).toISOString().slice(0, 10);

// ─── Per-placement facts ──────────────────────────────────────────────────────
export interface PlacementFacts {
  p: RetentionPlacement;
  started: boolean;            // start date on or before today
  dropped: boolean;
  stage: 'pre' | 'post' | null; // for drop-offs only
  dropDate: string | null;     // date the drop-off status was set
  problemDate: string | null;  // first At Risk / Dropoff Reason / drop-off status
  reason: string | null;       // one of REASONS, null if unlabelled
  atRisk: { date: string; by: string; issue: string } | null;
  feeOutcome: { outcome: string; amountLost: number } | null;
  replaces: number | null;     // this placement replaces that placementId
  guaranteeEnd: string | null;
}

const isStatusTo = (text: string, status: string) => new RegExp(`\\bto ${status}\\b`, 'i').test(text);
const notesOf = (p: RetentionPlacement, type: string) =>
  p.notes.filter(n => n.type.trim().toLowerCase() === type.toLowerCase()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export function placementFacts(p: RetentionPlacement, today: string): PlacementFacts {
  const statusNotes = notesOf(p, 'Status change');
  const dropNote = statusNotes.find(n => isStatusTo(n.text, 'Placement drop off'));
  const dropped = p.statusId === DROP_OFF_STATUS_ID;
  const dropDate = dropped ? (dropNote ? nzDate(dropNote.createdAt) : today) : null;

  // Labels may be added to the original Dropoff Reason note or in a later one (backfill): the
  // latest labelled note wins; the earliest note dates when the problem was logged.
  const reasonNotes = notesOf(p, 'Dropoff Reason');
  const firstReasonNote = reasonNotes[0] ?? null;
  const reasonText = reasonNotes.map(n => field(n.text, 'Reason')).filter(Boolean).at(-1) ?? null;
  const reason = reasonText ? REASONS.find(r => r.match.test(reasonText))?.name ?? null : null;

  // Pre-start = never reached Contract Live before the drop-off. "Stage: Pre-start" on the
  // Dropoff Reason note corrects Contract Live that the old calendar automation set.
  let stage: PlacementFacts['stage'] = null;
  if (dropped) {
    const reachedLive = statusNotes.some(n => isStatusTo(n.text, 'Contract Live') && (!dropNote || n.createdAt <= dropNote.createdAt));
    const forcedPre = reasonNotes.some(n => /pre/i.test(field(n.text, 'Stage') ?? ''));
    stage = reachedLive && !forcedPre ? 'post' : 'pre';
  }

  const riskNote = notesOf(p, 'At Risk')[0] ?? null;
  const atRisk = riskNote ? {
    date: field(riskNote.text, 'Signal date')?.slice(0, 10) ?? nzDate(riskNote.createdAt),
    by: field(riskNote.text, 'Signalled by') ?? '—',
    issue: freeText(riskNote.text) || '—',
  } : null;

  const signals = [atRisk?.date, firstReasonNote && nzDate(firstReasonNote.createdAt), dropDate].filter((d): d is string => Boolean(d)).sort();
  const feeNote = notesOf(p, 'Fee Outcome').at(-1);
  const replacesNote = notesOf(p, 'Replacement')[0];
  const replaces = replacesNote ? Number(field(replacesNote.text, 'Replaces')?.match(/\d+/)?.[0]) || null : null;

  return {
    p,
    started: Boolean(p.startDate && p.startDate <= today),
    dropped, stage, dropDate,
    problemDate: signals[0] ?? null,
    reason, atRisk,
    feeOutcome: feeNote ? {
      outcome: field(feeNote.text, 'Outcome') ?? '',
      amountLost: Number((field(feeNote.text, 'Amount lost') ?? '0').replace(/[^\d.]/g, '')) || 0,
    } : null,
    replaces,
    guaranteeEnd: p.startDate ? addDaysYmd(p.startDate, GUARANTEE_DAYS) : null,
  };
}

// ─── Tab summary ──────────────────────────────────────────────────────────────
export interface RateRow { name: string; signed: number; fell: number; pre: number; post: number; rate: number }
export interface Cohort { month: string; label: string; placed: number; live: (number | null)[]; afterCutoff: boolean }
export interface AtRiskRow { placementId: number; candidate: string; client: string; by: string; issue: string; days: number; state: 'Live' | 'Saved' | 'Lost' }

export interface RetentionSummary {
  today: string;
  periodLabel: string;           // "Jun–Sep 2026"
  signed: number;
  fallOvers: number;
  pre: number;
  post: number;
  startedCount: number;          // signed minus pre-start
  fallOverRate: number;          // %
  preRate: number;
  inGuaranteeRate: number;       // post ÷ started
  saves: number;
  lost: number;
  saveRate: number | null;
  liveRescues: number;
  notStarted: number;
  notStartedMonths: string;      // "October"
  activeInGuarantee: number;
  guaranteeComplete: number;
  nextClear: { client: string; date: string } | null;
  replacementsOwed: { placementId: number; client: string }[];
  replacementsInProgress: number;
  feeLost: number;
  feeOutcomesLogged: number;
  weekBands: { label: string; count: number }[];
  reasons: { name: string; stage: string; owner: ReasonOwner; count: number }[];
  unlabelled: number;
  byOwner: Record<ReasonOwner, number>;
  familyShare: number;           // 0..1 of all drop-offs
  familyFlag: boolean;
  byClient: RateRow[];
  byTrade: RateRow[];
  byRecruiter: RateRow[];
  cohorts: Cohort[];
  atRiskRows: AtRiskRow[];
  last2Months: { signed: number; fell: number };
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const TRADES: [RegExp, string][] = [
  [/roof/i, 'Roofing'],
  [/carpent|formwork/i, 'Carpentry'],
  [/electric/i, 'Electrical'],
  [/plumb/i, 'Plumbing'],
  [/paint/i, 'Painting'],
  [/fabricat|boilermak|fitter|welder/i, 'Metal / fabrication'],
];
export const tradeOf = (jobTitle: string) => TRADES.find(([re]) => re.test(jobTitle))?.[1] ?? 'Other trades';

/** Rows grouped by key; groups under `minSigned` roll into "All other (n)". */
function rateRows(fs: PlacementFacts[], key: (f: PlacementFacts) => string, minSigned: number, otherLabel: (n: number) => string): RateRow[] {
  const map = new Map<string, PlacementFacts[]>();
  for (const f of fs) map.set(key(f), [...(map.get(key(f)) ?? []), f]);
  const row = (name: string, g: PlacementFacts[]): RateRow => {
    const fell = g.filter(f => f.dropped);
    return { name, signed: g.length, fell: fell.length, pre: fell.filter(f => f.stage === 'pre').length, post: fell.filter(f => f.stage === 'post').length, rate: pct(fell.length, g.length) };
  };
  const big = [...map].filter(([, g]) => g.length >= minSigned).map(([n, g]) => row(n, g)).sort((a, b) => b.signed - a.signed || a.name.localeCompare(b.name));
  const small = [...map].filter(([, g]) => g.length < minSigned);
  if (small.length) big.push(row(otherLabel(small.length), small.flatMap(([, g]) => g)));
  return big;
}

export function summariseRetention(placements: RetentionPlacement[], settings: RetentionSettings, today = nzDate(Date.now())): RetentionSummary {
  const all = placements.filter(p => p.startDate).map(p => placementFacts(p, today));
  const period = all.filter(f => f.started);                  // rates: start date in period (1 Jun → today)
  const future = all.filter(f => !f.started);
  const drops = period.filter(f => f.dropped);
  const pre = drops.filter(f => f.stage === 'pre');
  const post = drops.filter(f => f.stage === 'post');
  const started = period.filter(f => f.stage !== 'pre');
  const live = started.filter(f => !f.dropped);
  const inGuarantee = (f: PlacementFacts) => f.guaranteeEnd! > today;

  // Saves: At Risk, then 16 weeks with no drop-off and no reduced / refunded / replacement outcome.
  const flagged = all.filter(f => f.atRisk);
  const badFee = (f: PlacementFacts) => /reduced|refund|replacement/i.test(f.feeOutcome?.outcome ?? '');
  const saved = flagged.filter(f => !f.dropped && !inGuarantee(f) && !badFee(f));
  const lost = flagged.filter(f => f.dropped || (!inGuarantee(f) && badFee(f)));
  const rescues = flagged.filter(f => f.started && !f.dropped && inGuarantee(f));

  // Replacements: "Replacement owed" fee outcome, matched to a later placement whose Replacement note names it.
  const replacedBy = new Map(all.filter(f => f.replaces).map(f => [f.replaces!, f]));
  const owedAll = all.filter(f => f.dropped && /replacement owed/i.test(f.feeOutcome?.outcome ?? ''));
  const owed = owedAll.filter(f => !replacedBy.has(f.p.placementId));
  const inProgress = owedAll.filter(f => { const r = replacedBy.get(f.p.placementId); return r && !(r.started && !inGuarantee(r)); });

  // Post-start timing: week of employment (from start date) when the problem was first logged.
  const bands = [{ label: '0–2 wks', max: 2 }, { label: '3–6 wks', max: 6 }, { label: '7–12 wks', max: 12 }, { label: '13–16 wks', max: Infinity }];
  const weekBands = bands.map(b => ({ label: b.label, count: 0 }));
  for (const f of post) {
    const week = Math.ceil(daysBetween(f.p.startDate!, f.problemDate ?? f.dropDate ?? today) / 7);
    weekBands[bands.findIndex(b => week <= b.max)].count++;
  }

  const reasons = REASONS.map(r => ({ name: r.name, stage: r.stage, owner: r.owner, count: drops.filter(f => f.reason === r.name).length }));
  const byOwner = Object.fromEntries(OWNERS.map(o => [o, reasons.filter(r => r.owner === o).reduce((n, r) => n + r.count, 0)])) as Record<ReasonOwner, number>;
  const family = reasons.find(r => r.owner === 'None')!.count;
  const familyShare = drops.length ? family / drops.length : 0;

  // Cohorts: month signed; % still live N weeks after start, over placements that have reached N weeks.
  const cohortMap = new Map<string, PlacementFacts[]>();
  for (const f of all) { const m = nzDate(f.p.createdAt).slice(0, 7); cohortMap.set(m, [...(cohortMap.get(m) ?? []), f]); }
  const cohorts = [...cohortMap].sort(([a], [b]) => a.localeCompare(b)).map(([month, g]) => ({
    month,
    label: MONTHS[+month.slice(5) - 1],
    placed: g.length,
    live: [4, 8, 16].map(w => {
      const matured = g.filter(f => addDaysYmd(f.p.startDate!, w * 7) <= today);
      if (!matured.length) return null;
      const stillLive = matured.filter(f => !f.dropped || (f.stage === 'post' && daysBetween(f.p.startDate!, f.dropDate!) > w * 7));
      return pct(stillLive.length, matured.length);
    }),
    afterCutoff: month >= settings.rachelCutoff.slice(0, 7),
  }));

  const firstStart = period.map(f => f.p.startDate!).sort()[0];
  const lastStart = period.map(f => f.p.startDate!).sort().at(-1);
  const periodLabel = firstStart && lastStart
    ? `${MONTHS[+firstStart.slice(5, 7) - 1]}–${MONTHS[+lastStart.slice(5, 7) - 1]} ${lastStart.slice(0, 4)}`
    : '—';
  const futureMonths = [...new Set(future.map(f => LONG_MONTHS[+f.p.startDate!.slice(5, 7) - 1]))];
  const clearing = live.filter(inGuarantee).sort((a, b) => a.guaranteeEnd!.localeCompare(b.guaranteeEnd!))[0];
  const since2m = addDaysYmd(today, -61);
  const recent = all.filter(f => nzDate(f.p.createdAt) >= since2m);

  return {
    today, periodLabel,
    signed: period.length,
    fallOvers: drops.length,
    pre: pre.length,
    post: post.length,
    startedCount: started.length,
    fallOverRate: pct(drops.length, period.length),
    preRate: pct(pre.length, period.length),
    inGuaranteeRate: pct(post.length, started.length),
    saves: saved.length,
    lost: lost.length,
    saveRate: saved.length + lost.length > 0 ? pct(saved.length, saved.length + lost.length) : null,
    liveRescues: rescues.length,
    notStarted: future.length,
    notStartedMonths: futureMonths.length ? `${futureMonths.join(', ')} starts` : 'None booked',
    activeInGuarantee: live.filter(inGuarantee).length,
    guaranteeComplete: live.filter(f => !inGuarantee(f)).length,
    nextClear: clearing ? { client: clearing.p.company.name, date: clearing.guaranteeEnd! } : null,
    replacementsOwed: owed.map(f => ({ placementId: f.p.placementId, client: f.p.company.name })),
    replacementsInProgress: inProgress.length,
    feeLost: all.reduce((n, f) => n + (/reduced|refund/i.test(f.feeOutcome?.outcome ?? '') ? f.feeOutcome!.amountLost : 0), 0),
    feeOutcomesLogged: all.filter(f => f.feeOutcome).length,
    weekBands,
    reasons,
    unlabelled: drops.filter(f => !f.reason).length,
    byOwner,
    familyShare,
    familyFlag: familyShare > FAMILY_FLAG_SHARE,
    byClient: rateRows(period, f => f.p.company.name || 'Unknown', 2, n => `All other clients (${n})`),
    byTrade: rateRows(period, f => tradeOf(f.p.jobTitle), 3, () => 'Other trades').reduce<RateRow[]>((rows, r) => {
      // "Other trades" from keyword misses and small trades merge into one row.
      const other = rows.find(x => x.name === 'Other trades');
      if (r.name === 'Other trades' && other) {
        Object.assign(other, { signed: other.signed + r.signed, fell: other.fell + r.fell, pre: other.pre + r.pre, post: other.post + r.post });
        other.rate = pct(other.fell, other.signed);
      } else rows.push(r);
      return rows;
    }, []).sort((a, b) => Number(a.name === 'Other trades') - Number(b.name === 'Other trades')),
    byRecruiter: rateRows(period, f => f.p.createdBy.split(' ')[0] || 'Unknown', 1, () => 'Other'),
    cohorts,
    atRiskRows: flagged.map(f => ({
      placementId: f.p.placementId, candidate: f.p.candidate, client: f.p.company.name,
      by: f.atRisk!.by, issue: f.atRisk!.issue,
      days: daysBetween(f.atRisk!.date, f.dropDate ?? (inGuarantee(f) ? today : f.guaranteeEnd!)),
      state: (saved.includes(f) ? 'Saved' : lost.includes(f) ? 'Lost' : 'Live') as AtRiskRow['state'],
    })).sort((a, b) => b.days - a.days),
    last2Months: { signed: recent.length, fell: recent.filter(f => f.dropped).length },
  };
}

/** RAG for a fall-over style rate against the admin-set thresholds. */
export const rateRag = (rate: number, s: RetentionSettings) => (rate <= s.greenMax ? 'green' : rate <= s.amberMax ? 'amber' : 'red');
