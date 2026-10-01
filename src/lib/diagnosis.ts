import type { Rag } from './rag';

export interface DiagMetric {
  name: string;          // as it reads in a sentence, e.g. "Calls booked"
  rag: Rag;
  pct: number | null;    // % change vs the comparison
  basis?: 'target' | 'last-month'; // what the colour was judged against (default last month)
}

export type DiagState = 'early' | 'both' | 'marketing' | 'after-handoff' | 'watch' | 'healthy';

export interface Diagnosis {
  state: DiagState;
  badge: string;
  tone: Rag;
  text: string;
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
  if (input.tooEarly) {
    return { state: 'early', badge: 'Too early', tone: 'grey', text: 'Too early in the month to call. Colours switch on from day 8.' };
  }
  const red = input.marketingMetrics.filter(m => m.rag === 'red');
  const amber = input.marketingMetrics.filter(m => m.rag === 'amber');
  const after = input.cacPerSignedClient.rag === 'red';
  const afterNote = after
    ? ` The cost after handoff is also rising: CAC per Signed Client${input.cacPerSignedClient.pct != null ? ` up ${input.cacPerSignedClient.pct.toFixed(0)}%` : ''}.`
    : '';

  if (red.length) {
    const alsoAmber = amber.length ? ` Also amber: ${marketingPhrase(amber)}.` : '';
    return {
      state: after ? 'both' : 'marketing',
      badge: after ? 'Marketing + after handoff' : 'Marketing problem',
      tone: 'red',
      text: `Marketing problem. ${marketingPhrase(red)}, red.${alsoAmber}${afterNote}`,
    };
  }
  if (amber.length) {
    return {
      state: after ? 'both' : 'watch',
      badge: after ? 'Watch + after handoff' : 'Watch',
      tone: 'amber',
      text: `Watch. ${marketingPhrase(amber)}, amber.${afterNote}`,
    };
  }
  if (after) {
    return { state: 'after-handoff', badge: 'After handoff', tone: 'amber', text: 'Marketing numbers held. The cost rise is after handoff, not a marketing issue.' };
  }
  return { state: 'healthy', badge: 'Healthy', tone: 'green', text: 'No marketing problem. Everything at or better than target and last month.' };
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
export function diagnoseSales(input: { tooEarly: boolean; lead: string; metrics: SalesDiagMetric[]; note?: string }): Diagnosis {
  if (input.tooEarly) {
    return { state: 'early', badge: 'Too early', tone: 'grey', text: 'Too early in the month to call. Colours switch on from day 8.' };
  }
  const flagged = input.metrics.filter(m => m.rag === 'amber' || m.rag === 'red');
  const first = SALES_GROUPS.find(g => flagged.some(m => m.group === g.group));
  if (!first) {
    return { state: 'healthy', badge: 'Healthy', tone: 'green', text: `${input.lead} Healthy: everything at or better than last month.` };
  }
  const tone: Rag = flagged.some(m => m.group === first.group && m.rag === 'red') ? 'red' : 'amber';
  const parts = flagged.map(m => `${m.phrase ?? `${describe([m])} on last month`}, ${m.rag}.`);
  const sections = [...new Set(flagged.map(m => m.section))].sort((a, b) => a - b);
  const see = `See section${sections.length > 1 ? 's' : ''} ${sections.length > 1 ? `${sections.slice(0, -1).join(', ')} and ${sections[sections.length - 1]}` : sections[0]}.`;
  return {
    state: 'watch',
    badge: first.badge,
    tone,
    text: [input.lead, first.lead, ...parts, input.note, see].filter(Boolean).join(' '),
  };
}
