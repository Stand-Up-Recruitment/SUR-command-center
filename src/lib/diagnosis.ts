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
