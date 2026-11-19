// Marketing tab cards and Diagnosis, shared by the Marketing tab and the Overview.
import { money0, money2, int, cmpRag, type Cmp } from '../shared/monthTheme.js';
import type { MonthWindow } from '../../lib/nzTime.js';
import { rate, rateVsTarget, pctChange, isTooEarly, proRata, type Rag, type RagContext } from '../../lib/rag.js';
import { pace, type Pace } from '../../lib/workingDays.js';
import { diagnose, type DiagMetric, type Diagnosis } from '../../lib/diagnosis.js';
import type { MarketingMonth, OrganicChannel, OrganicMonth, MarketingSettings, MarketingTargets } from '../../types';

const div0 = (a: number, b: number) => (b > 0 ? a / b : 0);

export function paidClientCards(m: MarketingMonth, pw: string): Cmp[] {
  const c = m.paid.cur.client, p = m.paid.prev.client;
  return [
    { label: 'Link clicks', cur: c.linkClicks, prev: p.linkClicks, better: 'up', fmt: int, prevWord: pw },
    { label: 'Cost per click', cur: div0(c.spend, c.linkClicks), prev: div0(p.spend, p.linkClicks), better: 'down', fmt: money2, prevWord: pw },
    { label: 'Leads (Meta-reported)', cur: c.leads, prev: p.leads, better: 'up', fmt: int, prevWord: pw },
    { label: 'Cost per lead', cur: div0(c.spend, c.leads), prev: div0(p.spend, p.leads), better: 'down', fmt: money2, prevWord: pw },
  ];
}

export function paidCandidateCards(m: MarketingMonth, pw: string): Cmp[] {
  const c = m.paid.cur.candidate, p = m.paid.prev.candidate;
  return [
    { label: 'Link clicks', cur: c.linkClicks, prev: p.linkClicks, better: 'up', fmt: int, prevWord: pw },
    { label: 'Cost per click', cur: div0(c.spend, c.linkClicks), prev: div0(p.spend, p.linkClicks), better: 'down', fmt: money2, prevWord: pw },
    { label: 'Applications (Meta-reported)', cur: c.applications, prev: p.applications, better: 'up', fmt: int, prevWord: pw },
    { label: 'Cost per application', cur: div0(c.spend, c.applications), prev: div0(p.spend, p.applications), better: 'down', fmt: money2, prevWord: pw },
  ];
}

export function handoffCards(m: MarketingMonth, w: MonthWindow, t: MarketingTargets | undefined): Cmp[] {
  const c = m.handoff.cur, p = m.handoff.prev;
  const same = `Same day ${w.prevShortLabel}`;
  // Count targets are monthly, so they're scaled to the days elapsed; cost targets aren't.
  const count = (v: number | null | undefined) => (v ? { value: proRata(v, w.dayOfMonth, w.daysInMonth), full: v } : null);
  const cost = (v: number | null | undefined) => (v ? { value: v, full: v } : null);
  return [
    { label: 'Calls booked (to sales)', cur: c.callsBooked, prev: p.callsBooked, better: 'up', fmt: int, prevWord: same, target: count(t?.callsBooked) },
    { label: 'Cost per booked call (month)', cur: c.costPerBookedCall, prev: p.costPerBookedCall, better: 'down', fmt: money0, prevWord: same, target: cost(t?.costPerBookedCall) },
    { label: 'Qualified candidates (to recruiters)', cur: c.qualifiedCandidates, prev: p.qualifiedCandidates, better: 'up', fmt: int, prevWord: same, target: count(t?.qualifiedCandidates) },
    { label: 'Cost per qualified candidate (month)', cur: c.costPerQualifiedCandidate, prev: p.costPerQualifiedCandidate, better: 'down', fmt: money2, prevWord: same, target: cost(t?.costPerQualifiedCandidate) },
    { label: 'Qual rate', cur: c.qualRate, prev: p.qualRate, better: 'up', fmt: n => `${n.toFixed(1)}%`, prevWord: same, pts: true },
  ];
}

export function cacCards(m: MarketingMonth): Cmp[] {
  return [
    { label: 'CAC per booked call', cur: m.cac.cur.cacPerBookedCall, prev: m.cac.prev.cacPerBookedCall, better: 'down', fmt: money0, prevWord: 'Last month' },
    { label: 'CAC per qualified candidate', cur: m.cac.cur.cacPerQualifiedCandidate, prev: m.cac.prev.cacPerQualifiedCandidate, better: 'down', fmt: money0, prevWord: 'Last month' },
  ];
}

export function postsTarget(postsPerWeek: number, w: MonthWindow) {
  return Math.round((postsPerWeek * w.dayOfMonth) / 7);
}

/** The Marketing tab's Diagnosis: same colour rule as the cards. */
export function marketingDiagnosis(
  m: MarketingMonth, organic: OrganicMonth | undefined, settings: MarketingSettings | undefined, w: MonthWindow,
): Diagnosis {
  const ctx: RagContext = { isCurrent: w.isCurrent, dayOfMonth: w.dayOfMonth };
  const pw = w.prevShortLabel;
  const [cacCall, cacCand] = cacCards(m);
  const [calls, costPerCall, qualified, costPerQual, qualRate] = handoffCards(m, w, settings?.targets);
  const asDiag = (name: string, c: Cmp): DiagMetric => c.target
    ? { name, rag: cmpRag(c, ctx), pct: (c.cur / c.target.value - 1) * 100, basis: 'target' }
    : { name, rag: cmpRag(c, ctx), pct: pctChange(c.cur, c.prev) };
  const target = postsTarget(settings?.postsPerWeek ?? 7, w);
  const postsDiag = (name: string, ch: OrganicChannel | undefined): DiagMetric[] =>
    ch?.connected && ch.posts != null && target > 0
      ? [{ name, rag: rate(ch.posts, target, 'up', ctx), pct: (ch.posts / target - 1) * 100, basis: 'target' as const }]
      : [];
  const [cClicks, cCpc, cLeads, cCpl] = paidClientCards(m, pw);
  const [kClicks, kCpc, kApps, kCpa] = paidCandidateCards(m, pw);
  return diagnose({
    tooEarly: isTooEarly(ctx),
    marketingMetrics: [
      asDiag('Calls booked', calls),
      asDiag('Cost per booked call', costPerCall),
      asDiag('Qualified candidates', qualified),
      asDiag('Cost per qualified candidate', costPerQual),
      asDiag('CAC per booked call', cacCall),
      asDiag('CAC per qualified candidate', cacCand),
      asDiag('Qual rate', qualRate),
      asDiag('Client link clicks', cClicks), asDiag('Client cost per click', cCpc),
      asDiag('Client leads from Meta', cLeads), asDiag('Client cost per lead', cCpl),
      asDiag('Candidate link clicks', kClicks), asDiag('Candidate cost per click', kCpc),
      asDiag('Candidate applications from Meta', kApps), asDiag('Cost per application', kCpa),
      ...postsDiag('Instagram posts', organic?.instagram),
      ...postsDiag('Facebook posts', organic?.facebook),
    ],
    cacPerSignedClient: {
      rag: rate(m.cac.cur.cacPerSignedClient, m.cac.prev.cacPerSignedClient, 'down', ctx),
      pct: pctChange(m.cac.cur.cacPerSignedClient, m.cac.prev.cacPerSignedClient),
    },
  });
}

// ─── Marketing tab v2 (brief 19 Nov 2026) ─────────────────────────────────────
// Counts: done vs needed by today (calendar days, ads run every day): ≥100% green, 75–99% amber, under 75% red.
// Costs: at or under target green, up to 20% over amber, 20%+ red. No target → same day last month, labelled.

export interface CountCheck { cur: number; prev: number; target: number | null; needed: number | null; rag: Pace }
export function countCheck(cur: number, prev: number, monthlyTarget: number | null | undefined, w: MonthWindow): CountCheck {
  if (!monthlyTarget) return { cur, prev, target: null, needed: null, rag: 'grey' };
  const needed = Math.round(proRata(monthlyTarget, w.dayOfMonth, w.daysInMonth));
  return { cur, prev, target: monthlyTarget, needed, rag: pace(cur, needed) };
}

export interface CostCheck { cur: number; cmp: number; rag: Rag; worsePct: number | null; vs: string }
export function costCheck(cur: number, prev: number, target: number | null | undefined, ctx: RagContext, pw: string, fmt: (n: number) => string): CostCheck {
  const cmp = target || prev;
  return {
    cur, cmp,
    rag: target ? rateVsTarget(cur, target, 'down', ctx) : rate(cur, prev, 'down', ctx),
    worsePct: cmp > 0 ? (cur / cmp - 1) * 100 : null,
    vs: target ? `${fmt(target)} target` : `${fmt(prev)} same day ${pw}`,
  };
}

/** Spend vs budget pro-rated to today. */
export function budgetCheck(spend: number, budget: number | null, w: MonthWindow) {
  if (!budget) return { rag: 'grey' as Pace, expected: null, usedPct: null, duePct: null };
  const expected = proRata(budget, w.dayOfMonth, w.daysInMonth);
  const rag: Pace = spend > budget ? 'red' : spend > expected * 1.1 ? 'amber' : 'green';
  return { rag, expected, usedPct: (spend / budget) * 100, duePct: (w.dayOfMonth / w.daysInMonth) * 100 };
}

export type MktLevel = 'FIX NOW' | 'PUSH' | 'THIS WEEK' | 'SET UP' | 'WATCH';
export interface MktAction { level: MktLevel; who: string; title: string; detail: string; action: string }
const LEVEL_ORDER: MktLevel[] = ['FIX NOW', 'PUSH', 'THIS WEEK', 'SET UP', 'WATCH'];

const CHANNELS = [
  { key: 'instagram', name: 'Instagram' },
  { key: 'facebook', name: 'Facebook' },
  { key: 'les', name: 'Les’s Instagram' },
] as const;

/** Today's actions, ranked. Built only from the numbers the tab shows. */
export function marketingActions(
  m: MarketingMonth, organic: OrganicMonth | undefined, settings: MarketingSettings | undefined, w: MonthWindow,
): MktAction[] {
  const ctx: RagContext = { isCurrent: w.isCurrent, dayOfMonth: w.dayOfMonth };
  const pw = w.prevShortLabel;
  const t = settings?.targets;
  const h = m.handoff;
  const out: MktAction[] = [];
  const bad = (r: Rag) => r === 'red' || r === 'amber';

  const budget = settings?.monthlyBudget ?? null;
  const spend = m.paid.cur.totalSpend;
  const b = budgetCheck(spend, budget, w);
  if (b.rag === 'red') {
    out.push({ level: 'FIX NOW', who: 'Brinda', title: 'Ad spend over the monthly budget', detail: `${money0(spend)} spent vs ${money0(budget!)} budget.`, action: 'Trim or pause ad sets today' });
  } else if (b.rag === 'amber') {
    out.push({ level: 'THIS WEEK', who: 'Brinda', title: 'Spend running ahead of budget', detail: `${Math.round(b.usedPct!)}% of budget used, should be at ${Math.round(b.duePct!)}% today.`, action: 'Lower daily budgets' });
  }

  const calls = countCheck(h.cur.callsBooked, h.prev.callsBooked, t?.callsBooked, w);
  if (bad(calls.rag)) {
    out.push({ level: 'PUSH', who: 'Brinda', title: 'Calls booked behind', detail: `${calls.cur} calls vs ${calls.needed} needed by today.`, action: 'Push client ads' });
  }
  const qual = countCheck(h.cur.qualifiedCandidates, h.prev.qualifiedCandidates, t?.qualifiedCandidates, w);
  if (bad(qual.rag)) {
    out.push({ level: 'PUSH', who: 'Brinda', title: 'Qualified candidates behind', detail: `${qual.cur} qualified vs ${qual.needed} needed by today.`, action: 'Push candidate ads' });
  }

  const flat = (cur: number, prev: number) => (cur > prev ? `up from ${prev}` : cur < prev ? `down from ${prev}` : `flat at ${cur}`);
  const callCost = costCheck(h.cur.costPerBookedCall, h.prev.costPerBookedCall, t?.costPerBookedCall, ctx, pw, money0);
  if (bad(callCost.rag)) {
    out.push({ level: 'THIS WEEK', who: 'Brinda', title: 'Client calls costing more', detail: `Cost per booked call ${money0(callCost.cur)} vs ${callCost.vs}. Calls ${flat(calls.cur, calls.prev)}.`, action: 'Find the client ad sets driving it' });
  }
  const qualCost = costCheck(h.cur.costPerQualifiedCandidate, h.prev.costPerQualifiedCandidate, t?.costPerQualifiedCandidate, ctx, pw, money2);
  if (bad(qualCost.rag)) {
    out.push({ level: 'THIS WEEK', who: 'Brinda', title: 'Candidates costing more', detail: `Cost per qualified candidate ${money2(qualCost.cur)} vs ${qualCost.vs}. Qualified ${flat(qual.cur, qual.prev)}.`, action: 'Find the candidate ad sets driving it' });
  }

  const missing = [
    !(t?.callsBooked || t?.qualifiedCandidates || t?.costPerBookedCall || t?.costPerQualifiedCandidate) && 'No targets set',
    !budget && 'no ad budget set',
  ].filter(Boolean) as string[];
  if (missing.length) {
    out.push({ level: 'SET UP', who: 'Les', title: 'Targets and budget', detail: `${missing.join(', ').replace(/^./, c => c.toUpperCase())}, so cards compare to same day ${pw} instead.`, action: 'Fill in Edit targets' });
  }

  const target = postsTarget(settings?.postsPerWeek ?? 7, w);
  const connected = CHANNELS.filter(c => organic?.[c.key]?.connected); // channels are missing when the organic API errors
  const offline = CHANNELS.filter(c => organic?.[c.key] && !organic[c.key].connected);
  const behind = connected.filter(c => bad(pace(organic![c.key].posts, target)));
  const postsText = connected.map(c => `${c.name} ${organic![c.key].posts ?? 0}`).join(', ');
  if (behind.length) {
    out.push({ level: 'THIS WEEK', who: 'Emma', title: `Behind on posts: ${behind.map(c => c.name).join(', ')}`, detail: `${postsText} posts vs ${target} needed by today, per channel.`, action: 'Catch up the posting plan' });
  } else if (connected.length && target > 0) {
    out.push({ level: 'WATCH', who: 'Emma', title: 'Organic on target', detail: `${postsText} posts vs ${target} needed by today, per channel.`, action: 'Keep the cadence going' });
  }
  if (offline.length) {
    out.push({ level: 'SET UP', who: 'Trung', title: `${offline.map(c => c.name).join(', ')} not connected`, detail: 'Posts, views and followers can’t be tracked until it is.', action: 'Connect the account' });
  }

  return out.sort((a, z) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(z.level));
}

/** The worst cost along both strips, or null when nothing is amber or red. */
export function biggestMarketingBreak(m: MarketingMonth, settings: MarketingSettings | undefined, w: MonthWindow): string | null {
  const ctx: RagContext = { isCurrent: w.isCurrent, dayOfMonth: w.dayOfMonth };
  const pw = w.prevShortLabel;
  const t = settings?.targets;
  const { cur, prev } = m.paid;
  const h = m.handoff;
  const stages = [
    { side: 'Client side', label: 'Cost per click', c: costCheck(div0(cur.client.spend, cur.client.linkClicks), div0(prev.client.spend, prev.client.linkClicks), null, ctx, pw, money2), fmt: money2 },
    { side: 'Client side', label: 'Cost per lead', c: costCheck(div0(cur.client.spend, cur.client.leads), div0(prev.client.spend, prev.client.leads), null, ctx, pw, money2), fmt: money2 },
    { side: 'Client side', label: 'Cost per booked call', c: costCheck(h.cur.costPerBookedCall, h.prev.costPerBookedCall, t?.costPerBookedCall, ctx, pw, money0), fmt: money0 },
    { side: 'Candidate side', label: 'Cost per click', c: costCheck(div0(cur.candidate.spend, cur.candidate.linkClicks), div0(prev.candidate.spend, prev.candidate.linkClicks), null, ctx, pw, money2), fmt: money2 },
    { side: 'Candidate side', label: 'Cost per application', c: costCheck(div0(cur.candidate.spend, cur.candidate.applications), div0(prev.candidate.spend, prev.candidate.applications), null, ctx, pw, money2), fmt: money2 },
    { side: 'Candidate side', label: 'Cost per qualified candidate', c: costCheck(h.cur.costPerQualifiedCandidate, h.prev.costPerQualifiedCandidate, t?.costPerQualifiedCandidate, ctx, pw, money2), fmt: money2 },
  ].filter(s => s.c.rag === 'red' || s.c.rag === 'amber');
  if (!stages.length) return null;
  const worst = stages.reduce((a, s) => ((s.c.worsePct ?? 0) > (a.c.worsePct ?? 0) ? s : a));
  return `${worst.side}. ${worst.label} ${worst.fmt(worst.c.cur)} vs ${worst.c.vs}.`;
}
