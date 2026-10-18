import { useMemo, useState } from 'react';
import { Skeleton } from '../shared/Skeleton';
import { Grid, Metric } from '../shared/monthLayout';
import { NZ, AM, RD, GREY, BG, BG2, BORDER, TEXT, MUTED, int, shortDate } from '../shared/monthTheme';
import { useClientPlacements, useClientInvoices, useCrmTobDates, useRetentionPlacements } from '../../hooks/queries';
import { hasClientInvoicesCredentials } from '../../services/clientInvoices';
import { hasRetentionCredentials } from '../../services/jobadderRetention';
import { buildScorecard, WEIGHTS, UNEXPLAINED_NUDGE_EACH, UNEXPLAINED_NUDGE_CAP, type ClientScore, type Signal, type Tier, type Tone } from '../../lib/clientScorecard';
import { nzDate } from '../../lib/nzTime';

const TONE_COLOR: Record<Tone, string> = { good: NZ, ok: AM, bad: RD, neutral: GREY };
const TIER_COLOR: Record<Tier, string> = { A: NZ, B: NZ, C: AM, D: RD };
const TIER_LABEL: Record<Tier, string> = { A: 'Top tier', B: 'Solid', C: 'Watch', D: 'At risk' };
const pct = (w: number) => `${Math.round(w * 100)}%`;

type SignalKey = 'volume' | 'payment' | 'retention' | 'sales';
const SIGNALS: { key: SignalKey; label: string }[] = [
  { key: 'volume', label: `Volume · ${pct(WEIGHTS.volume)}` },
  { key: 'payment', label: `Payment · ${pct(WEIGHTS.payment)}` },
  { key: 'retention', label: `Retention & Relationship · ${pct(WEIGHTS.retention)}` },
  { key: 'sales', label: 'Sales responsiveness · not scored' },
];

function ClientsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Skeleton height={22} width={220} />
      <div style={{ display: 'flex', gap: 10 }}>{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} height={78} radius={8} style={{ flex: 1 }} />)}</div>
      {[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} height={56} radius={10} />)}
    </div>
  );
}

function TierBadge({ tier }: { tier: Tier }) {
  const c = TIER_COLOR[tier];
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: c, border: `1px solid ${c}`, borderRadius: 999, padding: '1px 8px', whiteSpace: 'nowrap' }}>
      {tier} · {TIER_LABEL[tier]}
    </span>
  );
}

function Working({ signal }: { signal: Signal }) {
  const { columns, rows, steps } = signal.working;
  return (
    <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, padding: '.75rem 1rem', marginTop: 10 }}>
      {rows.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: 10 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead>
              <tr>{columns.map(c => <th key={c} style={{ textAlign: 'left', color: MUTED, fontWeight: 500, padding: '4px 8px', borderBottom: `.5px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>{r.map((v, j) => <td key={j} style={{ color: TEXT, padding: '4px 8px', borderBottom: `.5px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ol style={{ margin: 0, paddingLeft: 18, color: TEXT, fontSize: 12, lineHeight: 1.7 }}>
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </div>
  );
}

function ClientRow({ c }: { c: ClientScore }) {
  const [open, setOpen] = useState(false);
  const [signal, setSignal] = useState<SignalKey | null>(null);
  const color = TIER_COLOR[c.tier];
  return (
    <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 10, marginBottom: 8 }}>
      <button
        onClick={() => { setOpen(o => !o); setSignal(null); }}
        aria-expanded={open}
        style={{ all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', padding: '.75rem 1rem', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
      >
        <span style={{ width: 24, color: MUTED, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{c.rank}</span>
        <span style={{ flex: '1 1 180px', color: TEXT, fontSize: 14, fontWeight: 600, minWidth: 0 }}>{c.name}</span>
        <TierBadge tier={c.tier} />
        <span style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, height: 6, background: '#2a2a2a', borderRadius: 3, overflow: 'hidden' }}>
            <span style={{ display: 'block', width: `${c.score}%`, height: '100%', background: color }} />
          </span>
          <span style={{ width: 36, textAlign: 'right', color: TEXT, fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{c.score.toFixed(0)}</span>
        </span>
        <span style={{ color: MUTED, fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 1rem 1rem' }}>
          <Grid cols="repeat(auto-fit, minmax(190px, 1fr))">
            {SIGNALS.map(s => {
              const sig = c[s.key];
              const active = signal === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setSignal(active ? null : s.key)}
                  aria-pressed={active}
                  style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', background: BG, borderTop: `.5px solid ${active ? TEXT : BORDER}`, borderRight: `.5px solid ${active ? TEXT : BORDER}`, borderBottom: `.5px solid ${active ? TEXT : BORDER}`, borderLeft: `3px solid ${TONE_COLOR[sig.tone]}`, borderRadius: 8, padding: '.75rem 1rem' }}
                >
                  <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: sig.score == null ? MUTED : TEXT }}>{sig.score == null ? '—' : sig.score.toFixed(0)}</div>
                  <div style={{ fontSize: 12, color: TONE_COLOR[sig.tone] === GREY ? MUTED : TONE_COLOR[sig.tone] }}>{sig.headline}</div>
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>{active ? 'Hide working' : 'Show working'}</div>
                </button>
              );
            })}
          </Grid>
          {signal && <Working signal={c[signal]} />}
        </div>
      )}
    </div>
  );
}

export function ClientsCard() {
  const placementsQ = useClientPlacements();
  const invoicesQ = useClientInvoices();
  const crmQ = useCrmTobDates();
  const jobAdderQ = useRetentionPlacements();
  const [filter, setFilter] = useState<Tier | 'All'>('All');

  const [asAt] = useState(() => nzDate(Date.now()));
  const invoicesDone = !hasClientInvoicesCredentials || !invoicesQ.isLoading;
  const jobAdderDone = !hasRetentionCredentials || !jobAdderQ.isLoading;

  const card = useMemo(
    () => placementsQ.data && invoicesDone && jobAdderDone && !crmQ.isLoading
      ? buildScorecard(placementsQ.data, invoicesQ.data ?? null, jobAdderQ.data ?? null, crmQ.data ?? null, asAt)
      : null,
    [placementsQ.data, invoicesQ.data, jobAdderQ.data, crmQ.data, invoicesDone, jobAdderDone, crmQ.isLoading, asAt],
  );

  if (placementsQ.error) return <div style={{ color: RD, fontSize: 13 }}>Could not load placements: {(placementsQ.error as Error).message}</div>;
  if (!card) return <ClientsSkeleton />;

  const missing = [
    !invoicesQ.data && 'Xero invoices (Payment left out of every score)',
    !jobAdderQ.data && 'JobAdder notes (departures treated as unexplained)',
    !crmQ.data && 'Airtable CRM (Sales responsiveness blank)',
  ].filter(Boolean) as string[];

  const counts = { All: card.clients.length, A: 0, B: 0, C: 0, D: 0 } as Record<Tier | 'All', number>;
  card.clients.forEach(c => { counts[c.tier]++; });
  const shown = filter === 'All' ? card.clients : card.clients.filter(c => c.tier === filter);
  const k = card.kpis;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: TEXT }}>AU Client Scorecard</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
          As at {shortDate(card.asAt)} · every Australian client with a placement, ranked on volume, payment and relationship
        </div>
      </div>

      {missing.length > 0 && (
        <div style={{ background: 'rgba(186,117,23,0.12)', border: `.5px solid ${AM}`, borderRadius: 8, padding: '.6rem .9rem', fontSize: 12, color: TEXT, marginBottom: 12 }}>
          Missing data: {missing.join(' · ')}
        </div>
      )}

      <Grid cols="repeat(auto-fit, minmax(150px, 1fr))">
        <Metric label="Clients scored" value={int(k.clients)} rag="grey" />
        <Metric label="Total placements" value={int(k.placements)} rag="grey" />
        <Metric label="Relationship red flag" value={int(k.redFlagClients)} rag={k.redFlagClients ? 'red' : 'green'}>clients with a client-caused departure</Metric>
        <Metric label="Invoice overdue now" value={int(k.overdueClients)} rag={k.overdueClients ? 'red' : 'green'}>clients</Metric>
        <Metric label="Average days late" value={k.avgDaysLate == null ? '—' : k.avgDaysLate.toFixed(1)} rag="grey">across paid invoices</Metric>
      </Grid>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '6px 0 14px' }}>
        {(['All', 'A', 'B', 'C', 'D'] as const).map(t => {
          const active = filter === t;
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              aria-pressed={active}
              style={{ all: 'unset', cursor: 'pointer', fontSize: 12, padding: '5px 12px', borderRadius: 999, border: `.5px solid ${active ? TEXT : BORDER}`, background: active ? '#2a2a2a' : 'transparent', color: active ? TEXT : MUTED }}
            >
              {t === 'All' ? 'All' : `Tier ${t}`} · {counts[t]}
            </button>
          );
        })}
      </div>

      {shown.length === 0
        ? <div style={{ color: MUTED, fontSize: 13, padding: '1rem 0' }}>No clients in this tier.</div>
        : shown.map(c => <ClientRow key={c.key} c={c} />)}

      <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, padding: '1rem 1.25rem', marginTop: 16, fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
        <div style={{ color: TEXT, fontWeight: 600, marginBottom: 6 }}>How the score works</div>
        <div><b style={{ color: TEXT }}>Volume (30%)</b>: placements with the client ÷ placements with our biggest client × 100.</div>
        <div><b style={{ color: TEXT }}>Payment (40%)</b>, from Xero: 100 if invoices are paid on time on average, minus 3 per average day late (a neutral 70 if nothing is paid yet), minus 15 for each invoice overdue now and 5 for each void / credited invoice.</div>
        <div><b style={{ color: TEXT }}>Retention & Relationship (30%)</b>, from JobAdder drop-off reasons: only client-caused departures ("Client quality") count against the client. Candidate-side reasons cost nothing. Unexplained departures cost {UNEXPLAINED_NUDGE_EACH} each, capped at {UNEXPLAINED_NUDGE_CAP}.</div>
        <div><b style={{ color: TEXT }}>Sales responsiveness</b>: days from ToB sent to signed in the CRM. Shown only, not scored.</div>
        <div>If a client has no data for a component, the other weights are rescaled. Tiers: A 80+, B 70–79.9, C 50–69.9, D under 50.</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
          {(['good', 'ok', 'bad', 'neutral'] as Tone[]).map(t => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: TONE_COLOR[t] }} />{t}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          Assumptions to confirm with Les: the tier cut-offs and the unexplained-departure nudge were reconstructed; volume is relative to the biggest client; each void / credited invoice costs 5. JobAdder reasons cover placements starting from 1 Jun 2026.
        </div>
      </div>
    </div>
  );
}
