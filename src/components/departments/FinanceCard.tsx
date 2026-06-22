import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  Cell, ResponsiveContainer,
} from 'recharts';
import { Skeleton } from '../shared/Skeleton';
import { useXeroFinanceData, useAusPlacements } from '../../hooks/queries';

// ─── Palette ──────────────────────────────────────────────────────────────────
const NZ   = '#1D9E75';
const AUS  = '#378ADD';
const PU   = '#534AB7';
const AM   = '#BA7517';
const RD   = '#D85A30';

const BG     = '#111111';
const BG2    = '#1a1a1a';
const BORDER = 'rgba(255,255,255,0.10)';
const TEXT   = '#f5f5f5';
const MUTED  = '#a3a3a3';

const LOW_CASH_THRESHOLD = 20_000;

const fmtNZD = (n: number) => {
  const abs = Math.abs(n).toLocaleString('en-NZ', { maximumFractionDigits: 0 });
  return n < 0 ? `-$${abs}` : `$${abs}`;
};

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

// KP card with an optional delta sub-line (vs last month)
function KPDelta({ label, value, valueColor, accent, delta }: {
  label: string; value: string; valueColor?: string; accent?: string;
  delta?: { value: number; label: string } | null;
}) {
  const deltaColor = delta ? (delta.value >= 0 ? NZ : RD) : MUTED;
  const deltaSign  = delta ? (delta.value >= 0 ? '↑ +' : '↓ ') : '';
  return (
    <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, borderTop: accent ? `3px solid ${accent}` : undefined, padding: '.875rem 1rem' }}>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 500, color: valueColor ?? TEXT, lineHeight: 1.1 }}>{value}</div>
      {delta != null ? (
        <div style={{ fontSize: 11, color: deltaColor, marginTop: 3 }}>
          {deltaSign}{fmtNZD(Math.abs(delta.value))} vs last month
        </div>
      ) : (
        <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>vs last month —</div>
      )}
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

function Card({ children, accent, accentSide }: { children: React.ReactNode; accent?: string; accentSide?: 'top' | 'left' }) {
  const borderTop  = accent && accentSide !== 'left' ? `3px solid ${accent}` : undefined;
  const borderLeft = accent && accentSide === 'left' ? `3px solid ${accent}` : undefined;
  return (
    <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, borderTop, borderLeft, padding: '1.25rem', marginBottom: '.875rem' }}>
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

const statusBadge = (s: string) => {
  const map: Record<string, { bg: string; color: string }> = {
    Live:    { bg: '#052e16', color: '#22c55e' },
    Active:  { bg: '#052e16', color: '#22c55e' },
    End:     { bg: '#1f0a0a', color: '#f87171' },
    Ended:   { bg: '#1f0a0a', color: '#f87171' },
    Pending: { bg: '#1c1007', color: '#f59e0b' },
  };
  const t = map[s] ?? { bg: '#052e16', color: '#22c55e' };
  const label = s === 'End' ? 'Ended' : s || 'Live';
  return (
    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, fontWeight: 500, display: 'inline-block', background: t.bg, color: t.color }}>
      {label}
    </span>
  );
};

// ─── Cash chart (shared between actuals + outlook) ────────────────────────────

function CashChart({ data, minBal, maxBal }: {
  data: { label: string; weekLabel: string; net: number; balance: number }[];
  minBal: number;
  maxBal: number;
}) {
  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" tickFormatter={v => (v < 0 ? '−' : '') + Math.abs(v / 1000).toFixed(0) + 'k'} tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} width={36} />
          <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} tickFormatter={v => (v < 0 ? '-$' : '$') + Math.abs(v / 1000).toFixed(0) + 'k'} tick={{ fontSize: 11, fill: AUS }} axisLine={false} tickLine={false} width={42} />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => {
              const n = Number(value);
              const sign = n >= 0 ? '+' : '−';
              return [sign + fmtNZD(Math.abs(n)), name === 'net' ? 'Weekly net' : 'Closing balance'];
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            labelFormatter={(_: any, payload: readonly any[]) =>
              (payload?.[0]?.payload?.weekLabel as string | undefined) ?? ''
            }
            contentStyle={{ fontSize: 12, borderRadius: 8, border: `.5px solid ${BORDER}` }}
          />
          <Bar yAxisId="left" dataKey="net" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.net >= 0 ? NZ : RD} />)}
          </Bar>
          <Line yAxisId="right" type="monotone" dataKey="balance" stroke={AUS} strokeWidth={2}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dot={(props: any) => {
              const isMin = props.payload?.balance === minBal;
              const isMax = props.payload?.balance === maxBal;
              const r = isMin || isMax ? 6 : 3;
              const fill = isMin ? AM : isMax ? '#60a5fa' : AUS;
              const cx = props.cx ?? 0;
              const cy = props.cy ?? 0;
              return <circle key={cx} cx={cx} cy={cy} r={r} fill={fill} stroke={fill} />;
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
    </>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FinanceSkeleton() {
  const kpCard = (i: number) => (
    <div key={i} style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, padding: '.875rem 1rem' }}>
      <Skeleton height={10} width={90} style={{ marginBottom: 8 }} />
      <Skeleton height={22} width={70} style={{ marginBottom: 6 }} />
      <Skeleton height={10} width={60} />
    </div>
  );
  return (
    <div>
      <SH color={TEXT} label="P&L Summary" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: '.875rem' }}>{[0,1,2].map(kpCard)}</div>
      <SH color={MUTED} label="Cash Position" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: '.875rem' }}>{[0,1,2].map(kpCard)}</div>
      <SH color={AM} label="Variance Commentary" />
      <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, padding: '1.25rem', marginBottom: '.875rem' }}>
        <Skeleton height={13} width={400} style={{ marginBottom: 8 }} />
        <Skeleton height={13} width={320} />
      </div>
      <SH color={AUS} label="13-Week Cash Outlook" />
      <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, padding: '1.25rem', marginBottom: '.875rem' }}>
        <Skeleton height={220} />
      </div>
      <SH color={PU} label="YTD Pace — $1M Net Profit" />
      <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, borderTop: `3px solid ${PU}`, padding: '1.25rem', marginBottom: '.875rem' }}>
        <Skeleton height={8} radius={4} style={{ marginBottom: 6 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, margin: '.6rem 0' }}>
          {[0,1,2].map(i => <div key={i} style={{ background: BG, borderRadius: 8, padding: '.75rem', textAlign: 'center' as const }}><Skeleton height={22} width={80} style={{ margin: '0 auto 8px' }} /><Skeleton height={10} width={60} style={{ margin: '0 auto' }} /></div>)}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FinanceCard() {
  const { data, error } = useXeroFinanceData();
  const { data: placements } = useAusPlacements();

  if (!data) return <FinanceSkeleton />;

  const fyYear = new Date(data.fyStart).getFullYear() + 1;
  const ausPlacementsCount = placements?.length ?? 0;

  // ── Computed values ─────────────────────────────────────────────────────────
  const totalRevenue    = data.nzRevenue + data.ausRevenue;
  const totalGrossProfit = data.nzGrossProfit + data.ausNetContribution;
  const lm = data.plLastMonth;

  const cashKpis    = data.cashKpis ?? { openingBalance: 0, closingBalance: 0, closingBalanceActual: 0, avgWeeklyOutflow: 0, openingDate: data.asOf, closingDate: data.asOf };
  const cashFlow    = data.cashFlow ?? [];
  const cashOutlook = data.cashOutlook ?? [];
  const closingBalance = cashKpis.closingBalanceActual ?? cashKpis.closingBalance;
  const runwayWeeks = cashKpis.avgWeeklyOutflow > 0
    ? Math.round(closingBalance / cashKpis.avgWeeklyOutflow)
    : null;
  const runwayColor = runwayWeeks == null ? MUTED : runwayWeeks >= 8 ? NZ : runwayWeeks >= 4 ? AM : RD;

  const minBal = cashFlow.length > 0 ? Math.min(...cashFlow.map(d => d.balance)) : 0;
  const maxBal = cashFlow.length > 0 ? Math.max(...cashFlow.map(d => d.balance)) : 0;
  const minOutlook = cashOutlook.length > 0 ? Math.min(...cashOutlook.map(d => d.balance)) : 0;
  const maxOutlook = cashOutlook.length > 0 ? Math.max(...cashOutlook.map(d => d.balance)) : 0;

  const MILESTONE = 1_000_000;
  const NET_PER_PLACEMENT = 11_600;
  const pct = Math.min(Math.round((data.netProfit / MILESTONE) * 100 * 10) / 10, 100);
  const remaining = MILESTONE - data.netProfit;
  const placementsNeeded = Math.round(remaining / NET_PER_PLACEMENT);
  const daysSinceFYStart = Math.max(0, (Date.now() - new Date(data.fyStart).getTime()) / 86_400_000);
  const elapsedPct = Math.min(daysSinceFYStart / 365, 1);
  const onTrack = (data.netProfit / MILESTONE) >= elapsedPct;
  const paceGap = Math.abs(data.netProfit - elapsedPct * MILESTONE);

  const cac = ausPlacementsCount > 0 ? Math.round((data.advertising + data.travelInternational) / ausPlacementsCount) : 0;
  const nzCogsMax  = Math.max(...data.nzCogs.map(r => r.value), 1);
  const ausCostsMax = Math.max(...data.ausCosts.map(r => r.value), 1);
  const nzActiveWorkers = data.nzActiveWorkers ?? '—';

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* ── 1. P&L Summary ──────────────────────────────────────────── */}
      <SH color={TEXT} label="P&L Summary" sub="revenue · gross profit · net profit" />

      <G3>
        <KPDelta
          accent={NZ}
          label="Total revenue"
          value={fmtNZD(totalRevenue)}
          valueColor={NZ}
          delta={lm ? { value: totalRevenue - lm.revenue, label: 'vs last month' } : null}
        />
        <KPDelta
          accent={NZ}
          label="Gross profit"
          value={fmtNZD(totalGrossProfit)}
          valueColor={totalGrossProfit >= 0 ? NZ : RD}
          delta={lm ? { value: totalGrossProfit - lm.grossProfit, label: 'vs last month' } : null}
        />
        <KPDelta
          accent={PU}
          label="Net profit (FY to date)"
          value={fmtNZD(data.netProfit)}
          valueColor={data.netProfit >= 0 ? NZ : RD}
          delta={lm ? { value: data.netProfit - lm.netProfit, label: 'vs last month' } : null}
        />
      </G3>

      {/* ── 2. Cash Position ────────────────────────────────────────── */}
      <SH color={MUTED} label="Cash Position"
        sub={cashFlow.length > 0
          ? `8-week actuals · ${fmtDate(cashKpis.openingDate)} – ${fmtDate(cashKpis.closingDate)}`
          : '8-week actuals'} />

      <G3>
        <KP label="Current bank balance"
            value={fmtNZD(closingBalance)}
            sub={`Xero reconciled · ${fmtDate(cashKpis.closingDate)}`}
            valueColor={closingBalance >= 0 ? NZ : RD} />
        <KP label="Avg weekly outflow"
            value={`−${fmtNZD(cashKpis.avgWeeklyOutflow)}`}
            sub="Negative-flow weeks avg" valueColor={RD} />
        <KP label="Runway"
            value={runwayWeeks != null ? `${runwayWeeks} weeks` : '—'}
            sub="At current avg outflow rate"
            valueColor={runwayColor} />
      </G3>

      {/* Bank accounts (Profit First) */}
      {data.bankAccounts && data.bankAccounts.length > 0 ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: '.875rem' }}>
          {data.bankAccounts.map(acct => (
            <div key={acct.name} style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, padding: '.625rem .875rem', flex: '1 1 auto', minWidth: 120 }}>
              <div style={{ fontSize: 10, color: MUTED, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acct.name}</div>
              <div style={{ fontSize: 17, fontWeight: 500, color: acct.balance >= 0 ? TEXT : RD }}>{fmtNZD(acct.balance)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, padding: '.625rem 1rem', marginBottom: '.875rem', fontSize: 12, color: MUTED, fontStyle: 'italic' }}>
          Bank account breakdown not yet available
        </div>
      )}

      {/* 8-week actuals chart */}
      {cashFlow.length > 0 && (
        <Card>
          <CashChart data={cashFlow} minBal={minBal} maxBal={maxBal} />
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Week', 'Net flow', 'Close balance'].map(h => (
                  <th key={h} style={{ fontSize: 10, fontWeight: 500, color: MUTED, textAlign: h === 'Week' ? 'left' : 'right', padding: '4px 6px', borderBottom: `.5px solid ${BORDER}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cashFlow.map((d, i) => (
                <tr key={i} style={{ background: d.balance === maxBal ? 'rgba(29,158,117,0.15)' : d.balance === minBal ? 'rgba(216,90,48,0.15)' : 'transparent' }}>
                  <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, color: MUTED }}>{d.weekLabel}</td>
                  <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, textAlign: 'right', color: d.net >= 0 ? NZ : RD }}>{d.net >= 0 ? '+' : '−'}{fmtNZD(Math.abs(d.net))}</td>
                  <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, textAlign: 'right', color: d.balance >= 0 ? TEXT : RD }}>{fmtNZD(d.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── 3. Variance Commentary ──────────────────────────────────── */}
      <SH color={AM} label="Variance Commentary" sub="what moved · why · concern level" />

      <Card accent={AM} accentSide="left">
        {data.varianceCommentary ? (
          <p style={{ fontSize: 13, color: TEXT, lineHeight: 1.65, margin: 0 }}>{data.varianceCommentary}</p>
        ) : (
          <p style={{ fontSize: 13, color: MUTED, fontStyle: 'italic', margin: 0 }}>
            Variance commentary not yet available — add <code style={{ fontSize: 11 }}>ANTHROPIC_API_KEY</code> to n8n environment variables to enable AI-generated commentary.
          </p>
        )}
      </Card>

      {/* ── 4. 13-Week Cash Outlook ─────────────────────────────────── */}
      <SH color={AUS} label="13-Week Cash Outlook" sub="projected from avg of last 4 actuals" />

      {cashOutlook.length > 0 ? (
        <Card>
          <CashChart data={cashOutlook} minBal={minOutlook} maxBal={maxOutlook} />
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Week', 'Projected net', 'Projected balance'].map(h => (
                  <th key={h} style={{ fontSize: 10, fontWeight: 500, color: MUTED, textAlign: h === 'Week' ? 'left' : 'right', padding: '4px 6px', borderBottom: `.5px solid ${BORDER}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cashOutlook.map((d, i) => {
                const isLow = d.balance < LOW_CASH_THRESHOLD;
                return (
                  <tr key={i} style={{ background: isLow ? 'rgba(216,90,48,0.15)' : 'transparent' }}>
                    <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, color: MUTED }}>
                      {d.weekLabel}
                      {isLow && <span style={{ marginLeft: 6, fontSize: 10, color: RD, fontWeight: 600 }}>⚠ Low cash</span>}
                    </td>
                    <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, textAlign: 'right', color: d.net >= 0 ? NZ : RD }}>{d.net >= 0 ? '+' : '−'}{fmtNZD(Math.abs(d.net))}</td>
                    <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, textAlign: 'right', color: d.balance >= 0 ? TEXT : RD }}>{fmtNZD(d.balance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <NoteBox>Projection based on average weekly net cash flow from the last 4 actual weeks. Does not account for known future commitments or seasonal variation.</NoteBox>
        </Card>
      ) : (
        <Card>
          <p style={{ fontSize: 13, color: MUTED, fontStyle: 'italic', margin: 0 }}>13-week cash outlook not yet available — workflow is computing projections.</p>
        </Card>
      )}

      {/* ── 5. YTD Pace ─────────────────────────────────────────────── */}
      <SH color={PU} label="YTD Pace — $1M Net Profit" />

      <Card accent={PU}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>FY{fyYear} net profit towards $1,000,000</div>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
              background: onTrack ? 'rgba(29,158,117,0.15)' : 'rgba(216,90,48,0.15)',
              color: onTrack ? NZ : RD,
            }}>
              {onTrack ? '↑ On Track' : '↓ Off Track'}
            </span>
            <span style={{ fontSize: 11, color: MUTED }}>
              {fmtNZD(paceGap)} {onTrack ? 'ahead of pace' : 'behind pace'}
            </span>
          </div>
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

      {/* ── 6. Recommendation ───────────────────────────────────────── */}
      <SH color={AM} label="Recommendation" sub="one thing Les should decide or act on" />

      <Card accent={AM}>
        {data.recommendation ? (
          <>
            <div style={{ fontSize: 10, color: AM, fontWeight: 500, letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>Les should decide or act on:</div>
            <p style={{ fontSize: 14, fontWeight: 500, color: TEXT, lineHeight: 1.6, margin: 0 }}>{data.recommendation}</p>
          </>
        ) : (
          <p style={{ fontSize: 13, color: MUTED, fontStyle: 'italic', margin: 0 }}>
            Recommendation not yet available — add <code style={{ fontSize: 11 }}>ANTHROPIC_API_KEY</code> to n8n environment variables to enable AI-generated recommendations.
          </p>
        )}
      </Card>

      {/* ── NZ Business (detail) ────────────────────────────────────── */}
      <SH color={NZ} label="New Zealand Business" sub="Labour hire operations" />

      <G4>
        <KP accent={NZ} label="NZ revenue"            value={fmtNZD(data.nzRevenue)}    sub="Sales income only" />
        <KP accent={NZ} label="NZ COGS"               value={fmtNZD(data.nzTotalCogs)}  sub={`${Math.round(data.nzTotalCogs / data.nzRevenue * 100)}% of NZ revenue`} valueColor={RD} />
        <KP accent={NZ} label="Gross profit"          value={fmtNZD(data.nzGrossProfit)} sub={`${Math.round(data.nzGrossProfit / data.nzRevenue * 100)}% GP margin`} valueColor={NZ} />
        <KP accent={NZ} label="Active labour hire workers" value={String(nzActiveWorkers)} sub="On Xero payroll (active)" />
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

      {/* ── AUS Business (detail) ───────────────────────────────────── */}
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
            {placements == null ? (
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

      {error && (
        <p style={{ color: RD, fontSize: 12, margin: '8px 0 0' }}>⚠ Xero connection error — {error?.message}</p>
      )}
    </div>
  );
}
