import type { Rag } from './rag';

export interface DiagMetric {
  name: string;          // as it reads in a sentence, e.g. "Calls booked"
  rag: Rag;
  pct: number | null;    // % change vs the comparison
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

/**
 * Checked in order: marketing problem (a handoff count or a Marketing CAC is red),
 * after handoff (calls booked held but CAC per Signed Client is red), both, then
 * Healthy — or Watch if anything is amber/red.
 */
export function diagnose(input: {
  tooEarly: boolean;
  marketingMetrics: DiagMetric[];   // calls booked, qualified candidates, CAC/booked call, CAC/qualified candidate
  callsBooked: Rag;
  cacPerSignedClient: Rag;          // read from the shared CAC calc, not displayed
  otherMetrics: DiagMetric[];       // every other coloured card
}): Diagnosis {
  if (input.tooEarly) {
    return { state: 'early', badge: 'Too early', tone: 'grey', text: 'Too early in the month to call. Colours switch on from day 8.' };
  }
  const redMarketing = input.marketingMetrics.filter(m => m.rag === 'red');
  const mkt = redMarketing.length > 0;
  const after = (input.callsBooked === 'green' || input.callsBooked === 'amber') && input.cacPerSignedClient === 'red';

  if (mkt && after) {
    return {
      state: 'both', badge: 'Both', tone: 'red',
      text: `Marketing problem, and the cost is also rising after handoff. ${describe(redMarketing)} on last month, red. CAC per Signed Client is also red.`,
    };
  }
  if (mkt) {
    return { state: 'marketing', badge: 'Marketing problem', tone: 'red', text: `Marketing problem. ${describe(redMarketing)} on last month, red.` };
  }
  if (after) {
    return { state: 'after-handoff', badge: 'After handoff', tone: 'amber', text: 'Calls booked held. The cost rise is after handoff, not a marketing issue.' };
  }
  const flagged = [...input.marketingMetrics, ...input.otherMetrics].filter(m => m.rag === 'amber' || m.rag === 'red');
  if (flagged.length > 0) {
    const amber = flagged.filter(m => m.rag === 'amber');
    const red = flagged.filter(m => m.rag === 'red');
    const bits = [
      amber.length ? `${describe(amber)} on last month, amber.` : '',
      red.length ? `${describe(red)} on last month, red.` : '',
    ].filter(Boolean).join(' ');
    const tail = red.length ? 'Handoff and CACs are holding.' : 'Nothing red upstream or after handoff.';
    return { state: 'watch', badge: 'Watch', tone: 'amber', text: `No marketing problem. ${bits} ${tail}` };
  }
  return { state: 'healthy', badge: 'Healthy', tone: 'green', text: 'No marketing problem. Everything at or better than last month.' };
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
