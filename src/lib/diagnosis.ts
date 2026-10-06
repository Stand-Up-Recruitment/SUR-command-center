import type { Rag } from './rag';
import { rateRag, type RetentionSummary } from './retention.js';
import type { RetentionSettings } from '../types';

export interface DiagMetric {
  name: string;          // as it reads in a sentence, e.g. "Calls booked"
  rag: Rag;
  pct: number | null;    // % change vs the comparison
  basis?: 'target' | 'last-month'; // what the colour was judged against (default last month)
}

export type DiagState = 'early' | 'both' | 'marketing' | 'after-handoff' | 'watch' | 'problem' | 'healthy';

/** One red or amber number, listed under "Needs attention" on the Overview. */
export interface AttentionItem { rag: 'red' | 'amber'; text: string }

export interface Diagnosis {
  state: DiagState;
  badge: string;
  tone: Rag;
  text: string;            // full sentence for the tab's own Diagnosis tile
  summary: string;         // one line for the Overview card
  items: AttentionItem[];  // red first, then amber
}

const EARLY: Diagnosis = {
  state: 'early', badge: 'Too early', tone: 'grey',
  text: 'Too early in the month to call. Colours switch on from day 8.',
  summary: 'Too early to call. Colours switch on from day 8.',
  items: [],
};

/** Red entries first, then amber; green and grey dropped. */
function flaggedFirst<T extends { rag: Rag }>(ms: T[]): (T & { rag: AttentionItem['rag'] })[] {
  return [...ms.filter(m => m.rag === 'red'), ...ms.filter(m => m.rag === 'amber')] as (T & { rag: AttentionItem['rag'] })[];
}

const more = (n: number) => (n > 1 ? ` (+${n - 1} more)` : '');

/** Badge/state for the tabs that use the plain Off / Watch / Healthy wording. */
function plain(tone: Rag): Pick<Diagnosis, 'state' | 'badge'> {
  return tone === 'red' ? { state: 'problem', badge: 'Off' }
    : tone === 'amber' ? { state: 'watch', badge: 'Watch' }
    : tone === 'green' ? { state: 'healthy', badge: 'Healthy' }
    : { state: 'early', badge: 'No data' };
}

function describe(ms: DiagMetric[]) {
  const parts = ms.map(m => m.pct == null
    ? m.name
    : `${m.name} ${m.pct >= 0 ? 'up' : 'down'} ${Math.abs(m.pct).toFixed(0)}%`);
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// "Calls booked down 15% on last month" / "Cost per booked call 12% over target".
function marketingPhrase(ms: DiagMetric[]) {
  const parts = ms.map((m, i) => {
    // Mid-sentence names start lower case, except acronyms like "CAC".
    const name = i > 0 && !/^[A-Z]{2}/.test(m.name) ? m.name[0].toLowerCase() + m.name.slice(1) : m.name;
    if (m.pct == null) return name;
    const abs = Math.abs(m.pct);
    const n = abs < 1 ? abs.toFixed(1) : abs.toFixed(0);
    return m.basis === 'target'
      ? `${name} ${n}% ${m.pct >= 0 ? 'over' : 'under'} target`
      : `${name} ${m.pct >= 0 ? 'up' : 'down'} ${n}% on last month`;
  });
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * Any amber or red marketing number is named (red first). The after-handoff check
 * (CAC per Signed Client red) is reported alongside it, or on its own when every
 * marketing number held.
 */
export function diagnose(input: {
  tooEarly: boolean;
  marketingMetrics: DiagMetric[];   // every coloured card on the Marketing tab
  cacPerSignedClient: { rag: Rag; pct: number | null }; // read from the shared CAC calc, not displayed
}): Diagnosis {
  if (input.tooEarly) return EARLY;
  const red = input.marketingMetrics.filter(m => m.rag === 'red');
  const amber = input.marketingMetrics.filter(m => m.rag === 'amber');
  const after = input.cacPerSignedClient.rag === 'red';
  const cacPhrase = `CAC per Signed Client${input.cacPerSignedClient.pct != null ? ` up ${input.cacPerSignedClient.pct.toFixed(0)}%` : ''}`;
  const afterNote = after ? ` The cost after handoff is also rising: ${cacPhrase}.` : '';
  const flagged = flaggedFirst(input.marketingMetrics);
  const items: AttentionItem[] = [
    ...flagged.map(m => ({ rag: m.rag, text: marketingPhrase([m]) })),
    ...(after ? [{ rag: 'amber' as const, text: `${cacPhrase} (after handoff)` }] : []),
  ];
  const lead = flagged.length ? `${marketingPhrase(flagged.slice(0, 1))}${more(flagged.length)}` : '';

  if (red.length) {
    const alsoAmber = amber.length ? ` Also amber: ${marketingPhrase(amber)}.` : '';
    return {
      state: after ? 'both' : 'marketing',
      badge: after ? 'Marketing + after handoff' : 'Marketing problem',
      tone: 'red',
      text: `Marketing problem. ${marketingPhrase(red)}, red.${alsoAmber}${afterNote}`,
      summary: `Off: ${lead}`,
      items,
    };
  }
  if (amber.length) {
    return {
      state: after ? 'both' : 'watch',
      badge: after ? 'Watch + after handoff' : 'Watch',
      tone: 'amber',
      text: `Watch. ${marketingPhrase(amber)}, amber.${afterNote}`,
      summary: `Watch: ${lead}`,
      items,
    };
  }
  if (after) {
    return {
      state: 'after-handoff', badge: 'After handoff', tone: 'amber',
      text: 'Marketing numbers held. The cost rise is after handoff, not a marketing issue.',
      summary: `Marketing held; ${cacPhrase} after handoff`,
      items,
    };
  }
  return {
    state: 'healthy', badge: 'Healthy', tone: 'green',
    text: 'No marketing problem. Everything at or better than target and last month.',
    summary: 'Everything at or better than target and last month',
    items,
  };
}

// ─── Sales tab ────────────────────────────────────────────────────────────────
export interface SalesDiagMetric extends DiagMetric {
  group: 'sales' | 'upstream' | 'supply';
  section: number;       // which page section to look at
  phrase?: string;       // overrides "X down 12% on last month"
}

const SALES_GROUPS = [
  { group: 'sales', badge: 'Sales problem', lead: 'Sales problem.' },
  { group: 'upstream', badge: 'Upstream', lead: 'Upstream: marketing is sending fewer or weaker calls.' },
  { group: 'supply', badge: 'Candidate supply', lead: 'Candidate supply: more clients are waiting for candidates.' },
] as const;

/**
 * Checked in order: sales problem (show rate, sign rate or stale ToBs amber/red), upstream
 * (calls booked down or Not a Fit share up), candidate supply (Waitlist share up), else Healthy.
 * Every amber and red metric is named, with the section to look at.
 */
export function diagnoseSales(input: { tooEarly: boolean; lead: string; onTarget: boolean; metrics: SalesDiagMetric[]; note?: string }): Diagnosis {
  if (input.tooEarly) return EARLY;
  const flagged = input.metrics.filter(m => m.rag === 'amber' || m.rag === 'red');
  const first = SALES_GROUPS.find(g => flagged.some(m => m.group === g.group));
  const pace = input.onTarget ? 'On target' : 'Behind target';
  if (!first) {
    return {
      state: 'healthy', badge: 'Healthy', tone: 'green',
      text: `${input.lead} Healthy: everything at or better than last month.`,
      summary: `${pace}. Everything at or better than last month`,
      items: [],
    };
  }
  const tone: Rag = flagged.some(m => m.group === first.group && m.rag === 'red') ? 'red' : 'amber';
  const phrase = (m: SalesDiagMetric) => m.phrase ?? `${describe([m])} on last month`;
  const parts = flagged.map(m => `${phrase(m)}, ${m.rag}.`);
  const sections = [...new Set(flagged.map(m => m.section))].sort((a, b) => a - b);
  const see = `See section${sections.length > 1 ? 's' : ''} ${sections.length > 1 ? `${sections.slice(0, -1).join(', ')} and ${sections[sections.length - 1]}` : sections[0]}.`;
  const ordered = flaggedFirst(flagged);
  const lead = phrase(ordered[0]);
  return {
    state: 'watch',
    badge: first.badge,
    tone,
    text: [input.lead, first.lead, ...parts, input.note, see].filter(Boolean).join(' '),
    summary: `${pace}, but ${lead[0].toLowerCase()}${lead.slice(1)}${more(ordered.length)}`,
    items: ordered.map(m => ({ rag: m.rag, text: phrase(m) })),
  };
}

// ─── Recruitment tab ──────────────────────────────────────────────────────────
/**
 * Two checks, worst wins: placements pace (projected period end ≥ team target green,
 * ≥ breakeven amber, else red) and the hiring trigger (hire-now red, hire-soon amber).
 */
export function diagnoseRecruitment(input: {
  placements: number; target: number; breakeven: number; projected: number; periodLabel: string;
  hiring: { state: 'hire-now' | 'hire-soon' | 'ok' | 'no-data'; weeksUntilFull: number | null; full: boolean } | null;
}): Diagnosis {
  const { placements, target, breakeven, projected, periodLabel, hiring } = input;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const paceRag: Rag = projected >= target ? 'green' : projected >= breakeven ? 'amber' : 'red';
  const paceWord = paceRag === 'green' ? 'On target' : paceRag === 'amber' ? 'Below target' : 'Behind target';

  const hireRag: Rag = hiring?.state === 'hire-now' ? 'red' : hiring?.state === 'hire-soon' ? 'amber' : 'green';
  const hireWord = hiring?.state === 'hire-now' ? 'Hire now' : 'Hire soon';
  const weeks = hiring?.weeksUntilFull != null ? Math.round(hiring.weeksUntilFull) : null;
  const weeksText = `${weeks} week${weeks === 1 ? '' : 's'}`;
  const hireText = hiring?.full ? 'Hire now: team is full' : `${hireWord}: team full in ${weeksText}`;

  const items = flaggedFirst([
    { rag: hireRag, text: hireText },
    { rag: paceRag, text: `Placements ${placements} of ${fmt(target)}, projected ${projected}` },
  ]).map(c => ({ rag: c.rag, text: c.text }));
  const tone: Rag = items.some(i => i.rag === 'red') ? 'red' : items.length ? 'amber' : 'green';
  const hireShort = hireRag === 'green' ? '' : hiring?.full ? ', and Hire now: team is full' : `, and ${hireWord}: capacity in ${weeksText}`;

  return {
    ...plain(tone),
    tone,
    text: `${paceWord}: ${placements} of ${fmt(target)} placements this ${periodLabel}, projected ${projected} (breakeven ${breakeven.toFixed(1)}).${hireRag !== 'green' ? ` ${hireText}.` : ''}`,
    summary: `${paceWord}${hireShort}`,
    items,
  };
}

// ─── Retention tab ────────────────────────────────────────────────────────────
/**
 * Tone from the fall-over rate against the admin-set thresholds. Replacements owed, unlabelled
 * drop-offs and family/personal over 20% of drop-offs add amber items.
 */
export function diagnoseRetention(s: RetentionSummary, settings: RetentionSettings): Diagnosis {
  if (!s.signed) {
    return { state: 'early', badge: 'No data', tone: 'grey', text: 'No placements have started since 1 Jun yet.', summary: 'No placements started yet', items: [] };
  }
  const rag = rateRag(s.fallOverRate, settings);
  const owed = s.replacementsOwed.length;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const items = flaggedFirst([
    { rag, text: `Fall-over rate ${s.fallOverRate}% (${s.fallOvers} of ${s.signed} signed)` },
    { rag: owed ? 'amber' as const : 'green' as const, text: `${plural(owed, 'replacement')} owed` },
    { rag: s.unlabelled ? 'amber' as const : 'green' as const, text: `${plural(s.unlabelled, 'drop-off')} without a reason label` },
    { rag: s.familyFlag ? 'amber' as const : 'green' as const, text: `Family / personal is ${Math.round(s.familyShare * 100)}% of drop-offs (over 20%)` },
  ]).map(c => ({ rag: c.rag, text: c.text }));

  const leak = s.pre >= s.post
    ? `${s.pre} of ${s.fallOvers} fall-overs are pre-start: candidates going cold before day 1 is the biggest leak.`
    : `${s.post} of ${s.fallOvers} fall-overs happen after starting: in-guarantee losses are the biggest leak.`;
  return {
    ...plain(rag),
    tone: rag,
    text: `Fall-over rate ${s.fallOverRate}% (green ${settings.greenMax}% and under, amber up to ${settings.amberMax}%). ${s.fallOvers ? leak + ' ' : ''}${plural(owed, 'replacement')} owed. ${plural(s.liveRescues, 'live rescue')} logged.`,
    summary: `Fall-over rate ${s.fallOverRate}%, ${s.fallOvers ? (s.pre >= s.post ? `${s.pre} of ${s.fallOvers} pre-start` : `${s.post} of ${s.fallOvers} after starting`) : 'no fall-overs'}`,
    items,
  };
}

// ─── Finance tab ──────────────────────────────────────────────────────────────
/**
 * Off if projected net profit is under 75% of target or runway under 4 weeks; Watch if
 * projected net profit is under target or runway under 8 weeks. The profit check is grey
 * for days 1–7 like every other tab; runway is judged every day.
 */
export function diagnoseFinance(input: {
  tooEarly: boolean; projectedNetProfit: number | null; target: number; runwayWeeks: number | null;
}): Diagnosis {
  const { tooEarly, projectedNetProfit: np, target, runwayWeeks: rw } = input;
  const k = (n: number) => `$${Math.round(n / 1000)}k`;
  const npRag: Rag = tooEarly || np == null || target <= 0 ? 'grey' : np < target * 0.75 ? 'red' : np < target ? 'amber' : 'green';
  const rwRag: Rag = rw == null ? 'grey' : rw < 4 ? 'red' : rw < 8 ? 'amber' : 'green';
  const npText = np != null ? `Net profit on pace for ${k(np)} of ${k(target)} a month` : '';
  const rwText = rw != null ? `Cash covers ${rw.toFixed(0)} weeks of costs` : '';
  const items = flaggedFirst([{ rag: npRag, text: npText }, { rag: rwRag, text: rwText }]).map(c => ({ rag: c.rag, text: c.text }));

  if (!items.length && tooEarly) {
    return { ...EARLY, summary: rwText ? `Too early for profit. ${rwText}` : EARLY.summary };
  }
  const tone: Rag = items.some(i => i.rag === 'red') ? 'red'
    : items.length ? 'amber'
    : npRag === 'green' || rwRag === 'green' ? 'green' : 'grey';
  const pace = np != null && target > 0 ? `On pace for ${Math.round((np / target) * 100)}% of profit target` : '';
  return {
    ...plain(tone),
    tone,
    text: [npText && `${npText} (projected month end, Australia).`, rwText && `${rwText} (available cash ÷ average weekly costs, last 4 weeks).`]
      .filter(Boolean).join(' ') || 'Finance data not available.',
    summary: [pace, rwText].filter(Boolean).join('. ') || 'Finance data not available',
    items,
  };
}
