// Marketing tab cards and Diagnosis, shared by the Marketing tab and the Overview.
import { money0, money2, int, cmpRag, type Cmp } from '../shared/monthTheme';
import type { MonthWindow } from '../../lib/nzTime';
import { rate, pctChange, isTooEarly, proRata, type RagContext } from '../../lib/rag';
import { diagnose, type DiagMetric, type Diagnosis } from '../../lib/diagnosis';
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
