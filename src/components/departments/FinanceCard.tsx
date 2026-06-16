import { useCallback } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  Cell, ResponsiveContainer,
} from 'recharts';
import { Skeleton } from '../shared/Skeleton';
import { useAirtable } from '../../hooks/useAirtable';
import { fetchXeroFinanceData, hasXeroCredentials } from '../../services/xero';
import { fetchAusPlacements } from '../../services/airtable';
import type { XeroFinanceData, AusPlacement } from '../../types';

// ─── Palette ──────────────────────────────────────────────────────────────────
const NZ   = '#1D9E75';
const AUS  = '#378ADD';
const PU   = '#534AB7';
const AM   = '#BA7517';
const RD   = '#D85A30';

const BG     = '#f5f4f0';
const BG2    = '#ffffff';
const BORDER = 'rgba(0,0,0,0.10)';
const TEXT   = '#1a1a18';
const MUTED  = '#5F5E5A';

const fmtNZD = (n: number) =>
  '$' + Math.abs(n).toLocaleString('en-NZ', { maximumFractionDigits: 0 });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });

// ─── Layout helpers ───────────────────────────────────────────────────────────

function SH({ color, label, sub }: { color: string; label: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '1.4rem 0 .75rem' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase' as const, color }}>{label}</span>
      <div style={{ flex: 1, height: .5, background: BORDER }} />
      {sub && <span style={{ fontSize: 11, color: MUTED }}>{sub}</span>}
    </div>
  );
}

function KP({ label, value, sub, accent, valueColor }: {
  label: string; value: string; sub?: string; accent?: string; valueColor?: string;
}) {
  return (
    <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, borderTop: accent ? `3px solid ${accent}` : undefined, padding: '.875rem 1rem' }}>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 500, color: valueColor ?? TEXT, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function G4({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: '.875rem' }}>
      {children}
    </div>
  );
}

function G3({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: '.875rem' }}>
      {children}
    </div>
  );
}

function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, borderTop: accent ? `3px solid ${accent}` : undefined, padding: '1.25rem', marginBottom: '.875rem' }}>
      {children}
    </div>
  );
}

function BR({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
      <div style={{ fontSize: 11, color: MUTED, width: 175, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{label}</div>
      <div style={{ flex: 1, background: BORDER, borderRadius: 2, height: 5 }}>
        <div style={{ width: `${Math.max(pct, 0.06)}%`, height: 5, borderRadius: 2, background: color }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 500, color: TEXT, width: 62, textAlign: 'right' as const, flexShrink: 0 }}>{value}</div>
    </div>
  );
}

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.5, padding: '6px 8px', background: BG, borderRadius: 8, marginTop: 6 }}>
      {children}
    </div>
  );
}

function HC({ title, body, action, color }: { title: string; body: string; action: string; color: string }) {
  return (
    <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, borderTop: `3px solid ${color}`, padding: '.875rem 1rem' }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: TEXT, marginBottom: 5 }}>{title}</div>
      <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.55 }}>{body}</div>
      <div style={{ fontSize: 10, fontWeight: 500, marginTop: 6, color }}>{action}</div>
    </div>
  );
}

const statusBadge = (s: string) => {
  const map: Record<string, { bg: string; color: string }> = {
    Live:    { bg: '#E1F5EE', color: '#0F6E56' },
    Active:  { bg: '#E1F5EE', color: '#0F6E56' },
    End:     { bg: '#FAECE7', color: '#993C1D' },
    Ended:   { bg: '#FAECE7', color: '#993C1D' },
    Pending: { bg: '#FAEEDA', color: '#854F0B' },
  };
  const t = map[s] ?? { bg: '#E1F5EE', color: '#0F6E56' };
  const label = s === 'End' ? 'Ended' : s || 'Live';
  return (
    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, fontWeight: 500, display: 'inline-block', background: t.bg, color: t.color }}>
      {label}
    </span>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FinanceSkeleton() {
  const kpCard = (i: number) => (
    <div key={i} style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, padding: '.875rem 1rem' }}>
      <Skeleton height={10} width={90} style={{ marginBottom: 8 }} />
      <Skeleton height={22} width={70} style={{ marginBottom: 6 }} />
      <Skeleton height={10} width={60} />
    </div>
  );
  const barRow = (i: number) => (
    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
      <Skeleton height={10} width={120} />
      <div style={{ flex: 1 }}><Skeleton height={5} radius={2} /></div>
      <Skeleton height={10} width={50} />
    </div>
  );
  return (
    <div>
      {/* Header */}
      <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
        <div><Skeleton height={17} width={280} style={{ marginBottom: 8 }} /><Skeleton height={12} width={200} /></div>
        <div style={{ textAlign: 'right' }}><Skeleton height={11} width={50} style={{ marginBottom: 6 }} /><Skeleton height={13} width={80} /></div>
      </div>
      {/* Milestone card */}
      <SH color={PU} label="$1M Net Profit Milestone" />
      <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, borderTop: `3px solid ${PU}`, padding: '1.25rem', marginBottom: '.875rem' }}>
        <Skeleton height={13} width={260} style={{ marginBottom: 10 }} />
        <Skeleton height={8} radius={4} style={{ marginBottom: 6 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, margin: '.6rem 0' }}>
          {[0,1,2].map(i => <div key={i} style={{ background: BG, borderRadius: 8, padding: '.75rem', textAlign: 'center' as const }}><Skeleton height={22} width={80} style={{ margin: '0 auto 8px' }} /><Skeleton height={10} width={60} style={{ margin: '0 auto' }} /></div>)}
        </div>
      </div>
      {/* NZ */}
      <SH color={NZ} label="New Zealand Business" sub="Labour hire operations" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: '.875rem' }}>{[0,1,2,3].map(kpCard)}</div>
      <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, borderTop: `3px solid ${NZ}`, padding: '1.25rem', marginBottom: '.875rem' }}>
        <Skeleton height={13} width={200} style={{ marginBottom: 12 }} />
        {[0,1,2,3,4].map(barRow)}
      </div>
      {/* AUS */}
      <SH color={AUS} label="Australia Business" sub="International placements & operations" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: '.875rem' }}>{[0,1,2,3].map(kpCard)}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FinanceCard() {
  const fetcher = useCallback(() => fetchXeroFinanceData(), []);
  const { data, error } = useAirtable<XeroFinanceData>(fetcher, undefined, hasXeroCredentials);

  const placementsFetcher = useCallback(() => fetchAusPlacements(), []);
  const { data: placements } = useAirtable<AusPlacement[]>(placementsFetcher, undefined, true);

  if (!data) return <FinanceSkeleton />;

  const fyYear = new Date(data.fyStart).getFullYear() + 1;
  const ausPlacementsCount = placements?.length ?? 0;

  const MILESTONE = 1_000_000;
  const NET_PER_PLACEMENT = 11_600;
  const pct = Math.min(Math.round((data.netProfit / MILESTONE) * 100 * 10) / 10, 100);
  const remaining = MILESTONE - data.netProfit;
  const placementsNeeded = Math.round(remaining / NET_PER_PLACEMENT);
  const cac = ausPlacementsCount > 0 ? Math.round((data.advertising + data.travelInternational) / ausPlacementsCount) : 0;
  const nzCogsMax = Math.max(...data.nzCogs.map(r => r.value), 1);
  const ausCostsMax = Math.max(...data.ausCosts.map(r => r.value), 1);
  const minBal = data.cashFlow.length > 0 ? Math.min(...data.cashFlow.map(d => d.balance)) : 0;
  const maxBal = data.cashFlow.length > 0 ? Math.max(...data.cashFlow.map(d => d.balance)) : 0;

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* Dashboard header */}
      <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500, color: TEXT }}>Stand Up Recruitment — CEO Dashboard</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>
            FY{fyYear} Year-to-Date &nbsp;·&nbsp; {new Date(data.fyStart).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })} – {fmtDate(data.asOf)} &nbsp;·&nbsp; All figures NZD
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: MUTED }}>Live · Updated</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{fmtDate(data.asOf)}</div>
        </div>
      </div>

      {/* ── $1M Milestone ─────────────────────────────────────────── */}
      <SH color={PU} label="$1M Net Profit Milestone" />

      <Card accent={PU}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.4rem' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>FY{fyYear} net profit towards $1,000,000</div>
          <div style={{ fontSize: 12, color: PU, fontWeight: 500 }}>{pct}% complete</div>
        </div>
        <div style={{ background: BORDER, borderRadius: 4, height: 8, marginBottom: 4 }}>
          <div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: PU }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: MUTED, marginBottom: '.75rem' }}>
          <span>{fmtNZD(data.netProfit)} net profit earned</span>
          <span>{fmtNZD(remaining)} remaining to target</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, margin: '.6rem 0' }}>
          {[
            { value: fmtNZD(data.netProfit), color: NZ, label: 'Net profit to date\nFY' + fyYear },
            { value: fmtNZD(remaining),      color: RD, label: 'Still needed\nto hit $1M' },
            { value: String(placementsNeeded), color: PU, label: 'AUS placements needed*\nat $11,600 net each' },
          ].map(m => (
            <div key={m.label} style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, padding: '.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 500, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 3, lineHeight: 1.4, whiteSpace: 'pre-line' }}>{m.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: MUTED }}>*Remaining ÷ $11,600 est. net per AUS placement (60% margin, ex NZ labour costs).</div>
      </Card>

      {/* ── New Zealand ───────────────────────────────────────────── */}
      <SH color={NZ} label="New Zealand Business" sub="Labour hire operations" />

      <G4>
        <KP accent={NZ} label="NZ revenue"            value={fmtNZD(data.nzRevenue)}    sub="Sales income only" />
        <KP accent={NZ} label="NZ COGS"               value={fmtNZD(data.nzTotalCogs)}  sub={`${Math.round(data.nzTotalCogs / data.nzRevenue * 100)}% of NZ revenue`} valueColor={RD} />
        <KP accent={NZ} label="Gross profit"          value={fmtNZD(data.nzGrossProfit)} sub={`${Math.round(data.nzGrossProfit / data.nzRevenue * 100)}% GP margin`} valueColor={NZ} />
        <KP accent={NZ} label="Active labour hire workers" value={String(data.nzActiveWorkers)} sub="On Xero payroll (active)" />
      </G4>

      <Card accent={NZ}>
        <div style={{ fontSize: 13, fontWeight: 500, color: TEXT, marginBottom: '.75rem' }}>NZ cost of goods sold — {fmtNZD(data.nzTotalCogs)}</div>
        {data.nzCogs
          .slice()
          .sort((a, b) => b.value - a.value)
          .map(row => (
            <BR
              key={row.label}
              label={row.label}
              value={fmtNZD(row.value)}
              pct={Math.round((row.value / nzCogsMax) * 100)}
              color={NZ}
            />
          ))}
        <NoteBox>NZ gross profit ({fmtNZD(data.nzGrossProfit)}) funds all shared business overheads. NZ operates as a self-contained P&amp;L.</NoteBox>
      </Card>

      {/* ── Australia ─────────────────────────────────────────────── */}
      <SH color={AUS} label="Australia Business" sub="International placements & operations" />

      <G4>
        <KP accent={AUS} label="AUS revenue (NZD)"  value={fmtNZD(data.ausRevenue)}      sub="Placement + relocation fees" />
        <KP accent={AUS} label="AUS total costs"    value={fmtNZD(data.ausTotalCosts)}   sub="All operating expenses" valueColor={RD} />
        <KP accent={AUS} label="Net contribution"   value={fmtNZD(data.ausNetContribution)} sub={`${Math.round(data.ausNetContribution / data.ausRevenue * 100)}% margin`} valueColor={data.ausNetContribution >= 0 ? NZ : RD} />
        <KP accent={AUS} label="CAC per placement"  value={ausPlacementsCount > 0 ? fmtNZD(cac) : '—'} sub={`Adv. ${fmtNZD(data.advertising)} + travel ${fmtNZD(data.travelInternational)}`} valueColor={AUS} />
      </G4>

      <Card accent={AUS}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: TEXT, marginBottom: '.75rem' }}>AUS cost breakdown — {fmtNZD(data.ausTotalCosts)}</div>
            {data.ausCosts.map((row, i) => (
              <BR
                key={row.label}
                label={row.label}
                value={fmtNZD(row.value)}
                pct={Math.round((row.value / ausCostsMax) * 100)}
                color={i === 0 ? AUS : AM}
              />
            ))}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: TEXT, marginBottom: '.75rem' }}>FY{fyYear} placements — {ausPlacementsCount} confirmed</div>
            {placements === undefined ? (
              <div>{[0,1,2,3].map(i => <div key={i} style={{ marginBottom: 8 }}><Skeleton height={28} /></div>)}</div>
            ) : placements.length === 0 ? (
              <div style={{ fontSize: 12, color: MUTED }}>No placements recorded for FY{fyYear}.</div>
            ) : (
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Candidate', 'Client', 'Status'].map(h => (
                      <th key={h} style={{ fontSize: 11, fontWeight: 500, color: MUTED, textAlign: 'left', padding: '4px 6px', borderBottom: `.5px solid ${BORDER}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {placements.map((p, i) => (
                    <tr key={i}>
                      <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, color: TEXT }}>{p.candidate}</td>
                      <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, color: TEXT }}>{p.client}</td>
                      <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}` }}>{statusBadge(p.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Card>

      {/* ── Cash Position (last 8 weeks actuals) ─────────────────── */}
      <SH color={MUTED} label="Cash position"
        sub={data.cashFlow.length > 0
          ? `8-week actuals · ${fmtDate(data.cashKpis.openingDate)} – ${fmtDate(data.cashKpis.closingDate)}`
          : '8-week actuals'} />

      <G3>
        <KP label="Opening balance"
            value={fmtNZD(data.cashKpis.openingBalance)}
            sub={fmtDate(data.cashKpis.openingDate)} />
        <KP label="W8 closing (actual)"
            value={fmtNZD(data.cashKpis.closingBalance)}
            sub={fmtDate(data.cashKpis.closingDate)}
            valueColor={data.cashKpis.closingBalance < data.cashKpis.openingBalance ? RD : NZ} />
        <KP label="Avg weekly outflow"
            value={`−${fmtNZD(data.cashKpis.avgWeeklyOutflow)}`}
            sub="Negative-flow weeks avg" valueColor={RD} />
      </G3>

      {data.cashFlow.length > 0 && (
        <Card>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={data.cashFlow} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tickFormatter={v => (v < 0 ? '−' : '') + Math.abs(v / 1000).toFixed(0) + 'k'} tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} width={36} />
              <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} tickFormatter={v => '$' + (v / 1000).toFixed(0) + 'k'} tick={{ fontSize: 11, fill: AUS }} axisLine={false} tickLine={false} width={42} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  const sign = value >= 0 ? '+' : '−';
                  return [sign + fmtNZD(Math.abs(value)), name === 'net' ? 'Weekly net' : 'Closing balance'];
                }}
                labelFormatter={(_: string, payload: { payload?: { weekLabel: string } }[]) =>
                  payload?.[0]?.payload?.weekLabel ?? ''
                }
                contentStyle={{ fontSize: 12, borderRadius: 8, border: `.5px solid ${BORDER}` }}
              />
              <Bar yAxisId="left" dataKey="net" radius={[2, 2, 0, 0]}>
                {data.cashFlow.map((d, i) => <Cell key={i} fill={d.net >= 0 ? NZ : RD} />)}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="balance" stroke={AUS} strokeWidth={2}
                dot={(props: { cx: number; cy: number; payload: { balance: number } }) => {
                  const isMin = props.payload.balance === minBal;
                  const isMax = props.payload.balance === maxBal;
                  const r = isMin || isMax ? 6 : 3;
                  const fill = isMin ? AM : isMax ? '#185FA5' : AUS;
                  return <circle key={props.cx} cx={props.cx} cy={props.cy} r={r} fill={fill} stroke={fill} />;
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', fontSize: 11, color: MUTED, margin: '8px 0 10px' }}>
            {[{ color: NZ, w: 10, h: 10, label: 'Inflow week' }, { color: RD, w: 10, h: 10, label: 'Outflow week' }, { color: AUS, w: 10, h: 2, label: 'Closing balance' }].map(l => (
              <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: l.w, height: l.h, borderRadius: 2, background: l.color, display: 'inline-block' }} />
                {l.label}
              </span>
            ))}
          </div>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ fontSize: 10, fontWeight: 500, color: MUTED, textAlign: 'left', padding: '4px 6px', borderBottom: `.5px solid ${BORDER}` }}>Week</th>
                <th style={{ fontSize: 10, fontWeight: 500, color: MUTED, textAlign: 'right', padding: '4px 6px', borderBottom: `.5px solid ${BORDER}` }}>Net flow</th>
                <th style={{ fontSize: 10, fontWeight: 500, color: MUTED, textAlign: 'right', padding: '4px 6px', borderBottom: `.5px solid ${BORDER}` }}>Close balance</th>
              </tr>
            </thead>
            <tbody>
              {data.cashFlow.map((d, i) => (
                <tr key={i} style={{ background: d.balance === maxBal ? 'rgba(29,158,117,0.07)' : d.balance === minBal ? 'rgba(216,90,48,0.07)' : 'transparent' }}>
                  <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, color: MUTED }}>{d.weekLabel}</td>
                  <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, textAlign: 'right', color: d.net >= 0 ? NZ : RD }}>{d.net >= 0 ? '+' : '−'}{fmtNZD(Math.abs(d.net))}</td>
                  <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, textAlign: 'right', color: TEXT }}>{fmtNZD(d.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── Key Highlights ────────────────────────────────────────── */}
      <SH color={PU} label="Key highlights" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '.875rem' }}>
        <HC color={NZ} title="NZ is self-sustaining — AUS is the growth engine"
          body={`NZ GP (${fmtNZD(data.nzGrossProfit)}) covers all shared fixed costs. AUS net (${fmtNZD(data.ausNetContribution)}) is pure additional profit. Every incremental AUS placement adds ~$11,600 to the $1M net profit goal with minimal overhead increase.`}
          action="→ Protect NZ margin, push AUS volume" />
        <HC color={AM} title={ausPlacementsCount > 0 ? `CAC ${fmtNZD(cac)} — strong payback, track channels` : 'CAC — no placements yet this FY'}
          body={`${fmtNZD(data.advertising + data.travelInternational)} on advertising + travel for ${ausPlacementsCount} placement${ausPlacementsCount !== 1 ? 's' : ''}. ${ausPlacementsCount > 0 ? 'CAC is recovered in under half a placement at $11,600 net. ' : ''}Need channel-level data to know which spend is actually converting.`}
          action="→ Review ad channel data with Brinda" />
        <HC color={AUS} title="AUS margin understated — marginal margin is 60%+"
          body="Office staff and fixed OpEx are already absorbed. Adding more placements = revenue at near-zero marginal cost. Reported net margin improves rapidly with each placement added."
          action="→ Scale placements, not headcount" />
        <HC color={RD} title="Monitor cash — watch for low-balance weeks"
          body={`Opening balance ${fmtNZD(data.cashKpis.openingBalance)}. Lowest point over the past 8 weeks was ${fmtNZD(minBal)}. All outstanding invoices must be issued and chased promptly to avoid a cash crunch.`}
          action="→ Issue and chase all pending invoices" />
      </div>

      {/* ── Footnotes ─────────────────────────────────────────────── */}
      <div style={{ fontSize: 10, color: MUTED, borderTop: `.5px solid ${BORDER}`, paddingTop: '.625rem', marginTop: '1.25rem', lineHeight: 1.65 }}>
        <strong style={{ color: TEXT }}>Sources:</strong> Xero P&L + bank transactions + payroll (live via n8n webhook) · Airtable AUS Placements Tracker (live)<br />
        <strong style={{ color: TEXT }}>FX:</strong> 1 AUD = 1.207 NZD · Other income (Stripe + interest) included in net profit total
      </div>

      {error && (
        <p style={{ color: RD, fontSize: 12, margin: '8px 0 0' }}>⚠ Xero connection error — {error}</p>
      )}
    </div>
  );
}
