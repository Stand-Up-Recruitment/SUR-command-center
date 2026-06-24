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
  const last4Actuals = cashFlow.slice(-4);
  const next4Outlook = (cashOutlook).slice(0, 4);
  const combined = [
    ...last4Actuals.map(r => ({ ...r, isForecast: false })),
    ...next4Outlook.map(r => ({ ...r, isForecast: true })),
  ];

  let runningYtd = 0;
  const ytdNets = combined.map(r => { runningYtd += r.net; return runningYtd; });

  const cashFlowHasDetail = last4Actuals.some(d => d.inflow != null || d.outflow != null);


  const minBal = combined.length > 0 ? Math.min(...combined.map(d => d.balance)) : 0;
  const maxBal = combined.length > 0 ? Math.max(...combined.map(d => d.balance)) : 0;
  const MILESTONE = 1_000_000;
  const NET_PER_PLACEMENT = 11_600;
  const pct = Math.min(Math.round((data.netProfit / MILESTONE) * 100 * 10) / 10, 100);
  const remaining = MILESTONE - data.netProfit;
  const placementsNeeded = Math.round(remaining / NET_PER_PLACEMENT);
  const daysSinceFYStart = Math.max(0, (Date.now() - new Date(data.fyStart).getTime()) / 86_400_000);
  const elapsedPct = Math.min(daysSinceFYStart / 365, 1);
  const onTrack = (data.netProfit / MILESTONE) >= elapsedPct;
  const paceGap = Math.abs(data.netProfit - elapsedPct * MILESTONE);

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
        sub={combined.length > 0
          ? `4-week actuals · 4-week forecast · as at ${fmtDate(cashKpis.closingDate)}`
          : '4-week actuals · 4-week forecast'} />

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${2 + (cashKpis.totalInflow != null ? 1 : 0) + (cashKpis.totalOutflow != null ? 1 : 0)}, minmax(0,1fr))`, gap: 10, marginBottom: '.875rem' }}>
        <KP accent={closingBalance >= 0 ? NZ : RD}
            label="Current bank balance"
            value={fmtNZD(closingBalance)}
            sub={`Xero reconciled · ${fmtDate(cashKpis.closingDate)}`}
            valueColor={closingBalance >= 0 ? NZ : RD} />
        <KP accent={RD}
            label="Avg weekly outflow"
            value={`−${fmtNZD(cashKpis.avgWeeklyOutflow)}`}
            sub="Negative-flow weeks avg" valueColor={RD} />
        {cashKpis.totalInflow != null && (
          <KP accent={NZ}
              label="8-week total inflow"
              value={fmtNZD(cashKpis.totalInflow)}
              sub="Gross receipts, 8 weeks"
              valueColor={NZ} />
        )}
        {cashKpis.totalOutflow != null && (
          <KP accent={RD}
              label="8-week total outflow"
              value={`−${fmtNZD(cashKpis.totalOutflow)}`}
              sub="Gross payments, 8 weeks"
              valueColor={RD} />
        )}
      </div>

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

      {/* 4-week actuals + 4-week forecast table */}
      {combined.length > 0 && (
        <Card>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ fontSize: 10, fontWeight: 500, color: MUTED, textAlign: 'left', padding: '4px 6px', borderBottom: `.5px solid ${BORDER}` }}>Week</th>
                {cashFlowHasDetail && (
                  <th style={{ fontSize: 10, fontWeight: 500, color: MUTED, textAlign: 'right', padding: '4px 6px', borderBottom: `.5px solid ${BORDER}` }}>Inflow</th>
                )}
                {cashFlowHasDetail && (
                  <th style={{ fontSize: 10, fontWeight: 500, color: MUTED, textAlign: 'right', padding: '4px 6px', borderBottom: `.5px solid ${BORDER}` }}>Outflow</th>
                )}
                <th style={{ fontSize: 10, fontWeight: 500, color: MUTED, textAlign: 'right', padding: '4px 6px', borderBottom: `.5px solid ${BORDER}` }}>Net flow</th>
                <th style={{ fontSize: 10, fontWeight: 500, color: MUTED, textAlign: 'right', padding: '4px 6px', borderBottom: `.5px solid ${BORDER}` }}>YTD net</th>
              </tr>
            </thead>
            <tbody>
              {combined.map((d, i) => {
                const isFirstForecast = d.isForecast && (i === 0 || !combined[i - 1].isForecast);
                const forecastBorder = isFirstForecast ? `1px dashed rgba(255,255,255,0.15)` : undefined;
                const ytd = ytdNets[i];
                return (
                  <tr key={i} style={{ background: d.balance === maxBal ? 'rgba(29,158,117,0.15)' : d.balance === minBal ? 'rgba(216,90,48,0.15)' : 'transparent' }}>
                    <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, borderTop: forecastBorder, color: MUTED }}>
                      {d.weekLabel}
                      {d.isForecast && <span style={{ color: 'rgba(163,163,163,0.5)', marginLeft: 4 }}>(est.)</span>}
                    </td>
                    {cashFlowHasDetail && (
                      <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, borderTop: forecastBorder, textAlign: 'right', color: NZ }}>
                        {d.inflow != null ? fmtNZD(d.inflow) : '—'}
                      </td>
                    )}
                    {cashFlowHasDetail && (
                      <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, borderTop: forecastBorder, textAlign: 'right', color: RD }}>
                        {d.outflow != null ? `−${fmtNZD(d.outflow)}` : '—'}
                      </td>
                    )}
                    <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, borderTop: forecastBorder, textAlign: 'right', color: d.net >= 0 ? NZ : RD }}>{d.net >= 0 ? '+' : '−'}{fmtNZD(Math.abs(d.net))}</td>
                    <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, borderTop: forecastBorder, textAlign: 'right', color: ytd >= 0 ? NZ : RD }}>{ytd >= 0 ? '+' : '−'}{fmtNZD(Math.abs(ytd))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

      {/* ── NZ Business (detail) ────────────────────────────────────── */}
      <SH color={NZ} label="New Zealand Business" sub="Labour hire operations" />

      <G4>
        <KP accent={NZ} label="Revenue"      value={fmtNZD(data.nzRevenue)}     sub="NZ sales income" />
        <KP accent={NZ} label="COGS"         value={fmtNZD(data.nzTotalCogs)}   sub={`${Math.round(data.nzTotalCogs / data.nzRevenue * 100)}% of revenue`} valueColor={RD} />
        <KP accent={NZ} label="Gross profit" value={fmtNZD(data.nzGrossProfit)} sub={`${Math.round(data.nzGrossProfit / data.nzRevenue * 100)}% GP margin`} valueColor={data.nzGrossProfit >= 0 ? NZ : RD} />
        <KP accent={NZ} label="Net"          value={fmtNZD(data.nzNetProfit ?? data.nzGrossProfit)} sub="Net contribution" valueColor={(data.nzNetProfit ?? data.nzGrossProfit) >= 0 ? NZ : RD} />
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
        {nzActiveWorkers !== '—' && (
          <div style={{ marginTop: 8, fontSize: 11, color: MUTED }}>
            Active labour hire workers: <span style={{ color: TEXT, fontWeight: 500 }}>{nzActiveWorkers}</span> on Xero payroll
          </div>
        )}
      </Card>

      {/* ── AUS Business (detail) ───────────────────────────────────── */}
      <SH color={AUS} label="Australia Business" sub="International placements & operations" />

      <G4>
        <KP accent={AUS} label="Revenue" value={fmtNZD(data.ausRevenue)}         sub="Placement + relocation fees (NZD)" />
        <KP accent={AUS} label="Costs"   value={fmtNZD(data.ausTotalCosts)}      sub="All operating expenses" valueColor={RD} />
        <KP accent={AUS} label="Gross"   value={fmtNZD(data.ausNetContribution)} sub={`${Math.round(data.ausNetContribution / data.ausRevenue * 100)}% margin`} valueColor={data.ausNetContribution >= 0 ? NZ : RD} />
        <KP accent={AUS} label="Net"     value={fmtNZD(data.ausNetProfit ?? data.ausNetContribution)} sub="Net contribution" valueColor={(data.ausNetProfit ?? data.ausNetContribution) >= 0 ? NZ : RD} />
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
