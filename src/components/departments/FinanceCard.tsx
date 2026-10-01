import { useState } from 'react';
import { Skeleton } from '../shared/Skeleton';
import { useXeroFinanceData, useScheduledInvoices, useCacKPIs, useOverviewSettings } from '../../hooks/queries';
import { AUD_TO_NZD_APPROX } from '../../services/airtable';
import { availableCash as availableCashOf, financeSummary, DEFAULT_NET_PROFIT_TARGET, type FinanceSummary } from '../../lib/finance';
import { monthWindow, currentMonthKey } from '../../lib/nzTime';
import { DiagnosisTile } from '../shared/DiagnosisTile';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import type { XeroFinanceData } from '../../types';

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

// KP card with an optional static sub-line and an optional % delta sub-line
function KPDelta({ label, value, valueColor, accent, sub, deltaPct, invert }: {
  label: string; value: string; valueColor?: string; accent?: string; sub?: string;
  deltaPct?: { value: number; label: string } | null;
  invert?: boolean;
}) {
  const isGood = deltaPct ? (invert ? deltaPct.value <= 0 : deltaPct.value >= 0) : true;
  return (
    <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, borderTop: accent ? `3px solid ${accent}` : undefined, padding: '.875rem 1rem' }}>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 500, color: valueColor ?? TEXT, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>{sub}</div>}
      {deltaPct != null && (
        <div style={{ fontSize: 11, color: isGood ? NZ : RD, marginTop: 3 }}>
          {deltaPct.value >= 0 ? '↑ +' : '↓ '}{Math.abs(deltaPct.value).toFixed(1)}% {deltaPct.label}
        </div>
      )}
    </div>
  );
}

type MonthMetric = 'revenue' | 'grossProfit' | 'opex' | 'netProfit';
type MonthFigures = Partial<Record<MonthMetric, number>>;
type MonthCompare = {
  currentName: string; lastName: string;
  current?: MonthFigures; samePoint?: MonthFigures | null; lastTotal?: MonthFigures;
};

// Top-row card: big FY-to-date number, then "[Month] so far" and a same-point
// comparison with last month. ▲/▼ is green/red, reversed when `invert` (opex).
function KPMonth({ label, value, valueColor, accent, metric, compare, invert }: {
  label: string; value: string; valueColor?: string; accent?: string;
  metric: MonthMetric; compare: MonthCompare; invert?: boolean;
}) {
  const cur = compare.current?.[metric];
  const prev = compare.samePoint?.[metric];
  const lastTotal = compare.lastTotal?.[metric];
  // Divide by |prev| so ▲ always means "went up", even when last month's
  // figure was negative (e.g. a net loss).
  const pct = cur != null && prev ? ((cur - prev) / Math.abs(prev)) * 100 : null;
  const pctColor = pct == null ? MUTED : (invert ? pct <= 0 : pct >= 0) ? NZ : RD;
  return (
    <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, borderTop: accent ? `3px solid ${accent}` : undefined, padding: '.875rem 1rem' }}>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 500, color: valueColor ?? TEXT, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
        {compare.currentName} so far: {cur != null ? fmtNZD(cur) : '—'}
      </div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
        <span style={{ color: pctColor }}>
          {pct == null ? '—' : `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}%`}
        </span>
        {` vs ${compare.lastName} at the same point · ${compare.lastName} total ${lastTotal != null ? fmtNZD(lastTotal) : '—'}`}
      </div>
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

function Card({ children, accent, accentSide }: { children: React.ReactNode; accent?: string; accentSide?: 'top' | 'left' }) {
  const borderTop  = accent && accentSide !== 'left' ? `3px solid ${accent}` : undefined;
  const borderLeft = accent && accentSide === 'left' ? `3px solid ${accent}` : undefined;
  return (
    <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, borderTop, borderLeft, padding: '1.25rem', marginBottom: '.875rem' }}>
      {children}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10, marginBottom: '.875rem' }}>{[0,1,2,3,4].map(kpCard)}</div>
      <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, padding: '1.25rem', marginBottom: '.875rem' }}>
        <Skeleton height={240} />
      </div>
      <SH color={MUTED} label="Cash Position" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: '.875rem' }}>{[0,1,2,3].map(kpCard)}</div>
      <SH color={AM} label="Variance Commentary" />
      <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, padding: '1.25rem', marginBottom: '.875rem' }}>
        <Skeleton height={13} width={400} style={{ marginBottom: 8 }} />
        <Skeleton height={13} width={320} />
      </div>
      <SH color={AUS} label="13-Week Cash Outlook" />
      <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, padding: '1.25rem', marginBottom: '.875rem' }}>
        <Skeleton height={220} />
      </div>
    </div>
  );
}

// ─── Section components ───────────────────────────────────────────────────────

function TwelveMonthTrendChart({ data }: { data: XeroFinanceData['monthlyTrend'] }) {
  const [view, setView] = useState<'monthly' | 'overall'>('monthly');

  if (!data || data.length === 0) return null;

  const fmtAxis = (n: number) => {
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1000) return `${sign}$${Math.round(abs / 1000)}K`;
    return `${sign}$${Math.round(abs)}`;
  };

  const chartData = view === 'overall'
    ? data.reduce<typeof data>((acc, d, i) => {
        const prev = acc[i - 1];
        acc.push({
          month: d.month,
          revenue: (prev?.revenue ?? 0) + d.revenue,
          netProfit: (prev?.netProfit ?? 0) + d.netProfit,
          isCurrentMonth: d.isCurrentMonth,
        });
        return acc;
      }, [])
    : data;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: '.75rem' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: TEXT, marginBottom: 2 }}>12-Month Trend</div>
          <div style={{ fontSize: 11, color: MUTED }}>Revenue (bars) · Net profit (line) · Australia only · NZD</div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {(['monthly', 'overall'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 6,
                border: `.5px solid ${BORDER}`,
                background: view === v ? PU : 'transparent',
                color: view === v ? TEXT : MUTED,
                cursor: 'pointer',
                textTransform: 'capitalize' as const,
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: MUTED }}
            axisLine={false}
            tickLine={false}
            tickFormatter={fmtAxis}
            domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]}
          />
          <ReferenceLine y={0} stroke={BORDER} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${BORDER}`, background: BG2 }}
            labelStyle={{ color: TEXT }}
            formatter={(value, name) => [fmtNZD(Number(value)), String(name)]}
          />
          <Bar dataKey="revenue" name="Revenue" fill={NZ} radius={[3, 3, 0, 0]} maxBarSize={36}>
            {chartData.map((d, i) => (
              <Cell
                key={i}
                fill={NZ}
                fillOpacity={d.isCurrentMonth ? 0.35 : 1}
                stroke={d.isCurrentMonth ? NZ : 'none'}
                strokeDasharray={d.isCurrentMonth ? '3 3' : undefined}
              />
            ))}
          </Bar>
          <Line
            dataKey="netProfit"
            name="Net profit"
            stroke={PU}
            strokeWidth={2}
            dot={(props: { cx?: number; cy?: number; payload?: { isCurrentMonth?: boolean }; index?: number }) => {
              const { cx, cy, payload, index } = props;
              return (
                <circle
                  key={`dot-${index}`}
                  cx={cx}
                  cy={cy}
                  r={4}
                  fill={payload?.isCurrentMonth ? BG2 : PU}
                  stroke={PU}
                  strokeWidth={2}
                />
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}

function PLSummarySection({ totalRevenue, totalGrossProfit, totalOpex, netProfit, lastMonthSamePoint, cac, monthlyTrend }: {
  totalRevenue: number; totalGrossProfit: number; totalOpex: number; netProfit: number;
  lastMonthSamePoint: XeroFinanceData['lastMonthSamePoint'];
  cac: {
    cacPerSignedClient: number; prevCacPerSignedClient: number;
    cacPerQualifiedCandidate: number; prevCacPerQualifiedCandidate: number;
    placementCac: number; prevPlacementCac: number;
    hasPrevPeriod: boolean;
    cacPerSignedClientDeltaPct: number | null;
    placementCacDeltaPct: number | null;
    cacPerQualifiedCandidateDeltaPct: number | null;
    ltgp: number; costPerPlacedClient: number; ltgpToCac: number;
  } | undefined;
  monthlyTrend: XeroFinanceData['monthlyTrend'];
}) {
  const grossMarginPct = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
  const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Current month = the trend's partial isCurrentMonth entry; last month's
  // total = the entry before it; "same point" = last month 1st → same day.
  const curIdx = (monthlyTrend ?? []).findIndex(m => m.isCurrentMonth);
  const currentMonth = curIdx >= 0 ? monthlyTrend?.[curIdx] : undefined;
  const lastMonth = curIdx > 0 ? monthlyTrend?.[curIdx - 1] : undefined;
  const shortMonth = (label?: string) => label?.split(' ')[0] ?? '—';
  const compare: MonthCompare = {
    currentName: shortMonth(currentMonth?.month),
    lastName: shortMonth(lastMonth?.month),
    current: currentMonth,
    samePoint: lastMonthSamePoint,
    lastTotal: lastMonth,
  };

  return (
    <>
      <SH color={TEXT} label="P&L Summary" sub="Australia only · revenue · gross profit · opex · net profit · client CAC · qualified candidate CAC · placement CAC · LTGP:CAC" />

      <G4>
        <KPMonth
          accent={NZ}
          label="Total revenue"
          value={fmtNZD(totalRevenue)}
          valueColor={NZ}
          metric="revenue"
          compare={compare}
        />
        <KPMonth
          accent={NZ}
          label={`Gross profit · ${grossMarginPct.toFixed(1)}% margin`}
          value={fmtNZD(totalGrossProfit)}
          valueColor={totalGrossProfit >= 0 ? NZ : RD}
          metric="grossProfit"
          compare={compare}
        />
        <KPMonth
          accent={AM}
          label="Total operating expenses"
          value={fmtNZD(totalOpex)}
          valueColor={AM}
          metric="opex"
          compare={compare}
          invert
        />
        <KPMonth
          accent={PU}
          label={`Net profit (FY to date) · ${netMarginPct.toFixed(0)}% net margin`}
          value={fmtNZD(netProfit)}
          valueColor={netProfit >= 0 ? NZ : RD}
          metric="netProfit"
          compare={compare}
        />
      </G4>

      <TwelveMonthTrendChart data={monthlyTrend} />

      <G4>
        <KPDelta
          accent={RD}
          label="CAC per Signed Client"
          value={cac ? fmtNZD(cac.cacPerSignedClient) : '—'}
          valueColor={RD}
          invert
          deltaPct={cac?.cacPerSignedClientDeltaPct != null ? { value: cac.cacPerSignedClientDeltaPct, label: 'vs prior 90 days' } : null}
        />
        <KPDelta
          accent={RD}
          label="CAC per Qualified Candidate"
          value={cac ? fmtNZD(cac.cacPerQualifiedCandidate) : '—'}
          valueColor={RD}
          invert
          sub="Candidate Meta spend ÷ NZ Citizen + Trade/Occupation candidates"
          deltaPct={cac?.cacPerQualifiedCandidateDeltaPct != null ? { value: cac.cacPerQualifiedCandidateDeltaPct, label: 'vs prior 90 days' } : null}
        />
        <KPDelta
          accent={RD}
          label="Placement CAC"
          value={cac ? fmtNZD(cac.placementCac) : '—'}
          valueColor={RD}
          invert
          deltaPct={cac?.placementCacDeltaPct != null ? { value: cac.placementCacDeltaPct, label: 'vs prior 90 days' } : null}
        />
        <KP
          accent={PU}
          label="LTGP:CAC"
          value={cac ? `${cac.ltgpToCac.toFixed(1)}:1` : '—'}
          valueColor={PU}
          sub={cac ? `LTGP ${fmtNZD(cac.ltgp)} · cost per placed client ${fmtNZD(cac.costPerPlacedClient)}` : undefined}
        />
      </G4>
    </>
  );
}

// expected = what was / is due to come in that week; actual = cash actually
// received (undefined for forecast weeks); isPast = the week has finished.
type MonthCashRow = { weekLabel: string; isForecast: boolean; isPast: boolean; expected: number; actual?: number; outflow?: number };

function MonthCashCard({ title, monthLabel, rows, cashFlowHasDetail }: {
  title: string; monthLabel: string; rows: MonthCashRow[];
  cashFlowHasDetail: boolean;
}) {
  const th = { fontSize: 10, fontWeight: 700, color: MUTED, padding: '4px 6px', borderBottom: `.5px solid ${BORDER}` } as const;
  const td = { padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, textAlign: 'right' as const, whiteSpace: 'nowrap' as const };
  return (
    <Card>
      <div style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{title}</div>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: '.75rem' }}>{monthLabel}</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 11, color: MUTED, fontStyle: 'italic' }}>No weeks in range</div>
      ) : (
        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>Week</th>
              <th style={{ ...th, textAlign: 'right' }}>Expected Receive</th>
              {cashFlowHasDetail && <th style={{ ...th, textAlign: 'right' }}>Outflow</th>}
              {cashFlowHasDetail && <th style={{ ...th, textAlign: 'right' }}>Actual Received</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => (
              <tr key={i}>
                <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, color: MUTED }}>
                  {d.weekLabel}
                  {d.isForecast && <span style={{ color: 'rgba(163,163,163,0.5)', marginLeft: 4 }}>(est.)</span>}
                </td>
                <td style={{ ...td, color: d.expected > 0 ? AUS : MUTED }}>
                  {d.expected > 0 ? fmtNZD(d.expected) : '—'}
                </td>
                {cashFlowHasDetail && (
                  <td style={{ ...td, color: RD }}>
                    {`−${fmtNZD(d.outflow ?? 0)}`}
                  </td>
                )}
                {cashFlowHasDetail && (
                  <td style={{ ...td, color: d.actual != null ? NZ : MUTED }}>
                    {d.actual != null ? fmtNZD(d.actual) : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length > 0 && (() => {
        // Finished weeks count what actually came in; the current and future
        // weeks count what's expected, so the month total is a best estimate.
        const netCashFlow = rows.reduce((sum, r) => sum + (r.isPast ? (r.actual ?? 0) : r.expected) - (r.outflow ?? 0), 0);
        return (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: `.5px solid ${BORDER}` }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>Net cash flow</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: netCashFlow >= 0 ? NZ : RD, whiteSpace: 'nowrap' }}>
              {netCashFlow >= 0 ? '+' : '−'}{fmtNZD(Math.abs(netCashFlow))}
            </span>
          </div>
        );
      })()}
    </Card>
  );
}

function CashPositionSection({
  cashKpis, bankAccounts, monthlyTrend, ausReceivables, cashFlowHasDetail,
  monthBuckets, hasCombined,
}: {
  cashKpis: { closingDate: string };
  bankAccounts: Array<{ name: string; balance: number }> | undefined;
  monthlyTrend: XeroFinanceData['monthlyTrend'];
  ausReceivables: XeroFinanceData['ausReceivables'];
  cashFlowHasDetail: boolean;
  monthBuckets: { previous: { label: string; rows: MonthCashRow[] }; current: { label: string; rows: MonthCashRow[] }; next: { label: string; rows: MonthCashRow[] } };
  hasCombined: boolean;
}) {
  // Available cash = 00 - Business OPS + 50 - PROFIT only. GST/TAX belongs to
  // IRD and EMP ENT / EMP00 hold staff entitlements, so they're left out.
  const accounts = bankAccounts ?? [];
  const availableCash = availableCashOf(accounts) ?? 0;
  const totalInBank = accounts.reduce((sum, a) => sum + a.balance, 0);

  // Cash cover = available cash ÷ average AU opex (same basis as the Operating
  // Expenses card) over the last 3 full months. Actuals only, no forecast.
  const fullMonthOpex = (monthlyTrend ?? [])
    .filter(m => !m.isCurrentMonth && m.opex != null)
    .slice(-3)
    .map(m => m.opex as number);
  const avgMonthlyOpex = fullMonthOpex.length === 3 ? fullMonthOpex.reduce((a, b) => a + b, 0) / 3 : null;
  const cashCover = avgMonthlyOpex && avgMonthlyOpex > 0 ? availableCash / avgMonthlyOpex : null;

  const overdueCount = ausReceivables?.overdueCount ?? 0;

  return (
    <>
      <SH color={MUTED} label="Cash Position"
        sub={hasCombined
          ? `Actuals · forecast · as at ${fmtDate(cashKpis.closingDate)}`
          : 'Actuals · forecast'} />

      <G4>
        <KP accent={availableCash >= 0 ? NZ : RD}
            label="Available cash"
            value={bankAccounts ? fmtNZD(availableCash) : '—'}
            sub={bankAccounts ? `Total in bank ${fmtNZD(totalInBank)}` : undefined}
            valueColor={availableCash >= 0 ? NZ : RD} />
        <KP accent={AUS}
            label="Cash cover"
            value={cashCover != null ? `${cashCover.toFixed(1)} months` : '—'}
            sub={`Average spend ${avgMonthlyOpex != null ? fmtNZD(avgMonthlyOpex) : '—'}/month · how long available cash lasts if nothing comes in`} />
        <KP accent={AM}
            label="Owed to us"
            value={ausReceivables ? fmtNZD(ausReceivables.owedTotal) : '—'}
            valueColor={AM} />
        <KP accent={RD}
            label="Overdue"
            value={ausReceivables ? `${fmtNZD(ausReceivables.overdueTotal)} · ${overdueCount} invoice${overdueCount === 1 ? '' : 's'}` : '—'}
            valueColor={ausReceivables && ausReceivables.overdueTotal > 0 ? RD : MUTED} />
      </G4>

      {/* Previous / current / next month cash outlook, side by side */}
      {hasCombined && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
            <MonthCashCard title="Previous month" monthLabel={monthBuckets.previous.label} rows={monthBuckets.previous.rows} cashFlowHasDetail={cashFlowHasDetail} />
            <MonthCashCard title="Current month" monthLabel={monthBuckets.current.label} rows={monthBuckets.current.rows} cashFlowHasDetail={cashFlowHasDetail} />
            <MonthCashCard title="Next month" monthLabel={monthBuckets.next.label} rows={monthBuckets.next.rows} cashFlowHasDetail={cashFlowHasDetail} />
          </div>
          <NoteBox>Expected Receive = Australian Xero invoices due that week plus Airtable scheduled instalments (not yet invoiced). This week also includes overdue invoices. Actual Received = Australian cash received (Xero, ex GST).</NoteBox>
        </>
      )}
    </>
  );
}

// ─── Profit target & runway (read by the Overview) ────────────────────────────

function TargetRunwaySection({ s }: { s: FinanceSummary }) {
  const k = (n: number) => `$${Math.round(n / 1000)}k`;
  const npColor = (n: number | null) => n == null ? MUTED : n >= s.target ? NZ : n >= s.target * 0.75 ? AM : RD;
  const rwColor = s.runwayWeeks == null ? MUTED : s.runwayWeeks >= 8 ? NZ : s.runwayWeeks >= 4 ? AM : RD;
  return (
    <>
      <SH color={TEXT} label="Profit target & runway" sub="Australia only · month to date · target set on the Overview (⚙)" />
      <G4>
        <KP accent={PU}
            label="Net profit this month"
            value={s.netProfitMtd != null ? fmtNZD(s.netProfitMtd) : '—'}
            sub={`Target ${k(s.target)} a month`} />
        <KP accent={npColor(s.projectedNetProfit)}
            label="Projected month end"
            value={s.projectedNetProfit != null ? fmtNZD(s.projectedNetProfit) : '—'}
            valueColor={npColor(s.projectedNetProfit)}
            sub={s.projectedNetProfit != null ? `${Math.round((s.projectedNetProfit / s.target) * 100)}% of target · month to date ÷ days elapsed × days in month` : undefined} />
        <KP accent={rwColor}
            label="Cash runway"
            value={s.runwayWeeks != null ? `${s.runwayWeeks.toFixed(1)} weeks` : '—'}
            valueColor={rwColor}
            sub="Available cash ÷ average weekly costs (last 4 weeks)" />
        <KP accent={MUTED}
            label="Average weekly costs"
            value={s.weeklyCosts != null ? fmtNZD(s.weeklyCosts) : '—'}
            sub="Cash out, last 4 finished weeks" />
      </G4>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FinanceCard() {
  const { data, error } = useXeroFinanceData();
  const { data: scheduledInvoices } = useScheduledInvoices();
  const { data: overviewSettings } = useOverviewSettings();

  // ── Computed values ─────────────────────────────────────────────────────────
  // Finance tab is Australia only — every headline number uses only the aus*
  // fields the webhook already computes correctly; NZ revenue/costs never
  // enter these totals (that mismatch was the source of the inflated Net Profit).
  const totalRevenue     = data?.ausRevenue ?? 0;
  const totalGrossProfit = data?.ausGrossProfit ?? 0;
  const totalOpex        = data?.ausTotalCosts ?? 0;
  const netProfit         = data?.ausNetProfit ?? data?.ausGrossProfit ?? 0;

  const grossMarginPct = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : undefined;
  const { data: cac } = useCacKPIs(grossMarginPct, data?.jobBoardAdvertising90d, data?.prevJobBoardAdvertising90d, data?.audNzdMonthlyRates);

  if (!data) return <FinanceSkeleton />;

  const summary = financeSummary(data, overviewSettings?.netProfitTarget ?? DEFAULT_NET_PROFIT_TARGET, monthWindow(currentMonthKey()));

  const cashKpis    = data.cashKpis ?? { openingBalance: 0, closingBalance: 0, closingBalanceActual: 0, avgWeeklyOutflow: 0, openingDate: data.asOf, closingDate: data.asOf };
  const cashFlow    = data.cashFlow ?? [];
  const cashOutlook = data.cashOutlook ?? [];
  const actualWeeks = cashFlow;
  const forecastWeeks = cashOutlook;
  const combined = [
    ...actualWeeks.map(r => ({ ...r, isForecast: false })),
    ...forecastWeeks.map(r => ({ ...r, isForecast: true })),
  ];

  const currentIdx = combined.reduce((last, r, i) => (r.isForecast ? last : i), -1);
  // The week containing today's (local) date — not simply the last actual row, which
  // lags a week whenever the webhook data was built before this Monday.
  const todayStr = new Date().toLocaleDateString('en-CA');
  const thisWeekIdx = combined.findIndex(r => r.weekStart && r.weekEnd && r.weekStart <= todayStr && todayStr <= r.weekEnd);

  // Scheduled-but-unbilled Airtable invoices (Status = Scheduled, InvoiceID blank).
  // Each invoice is bucketed into exactly one week — the week its due date falls in —
  // using each week's real weekStart/weekEnd from the API, falling back to anchoring
  // on cashKpis.closingDate and stepping 7 days per week if a row lacks real dates.
  // Overdue invoices (due date already passed) are excluded from every week bucket
  // and summed separately instead, since they aren't guaranteed cash for any given week.
  const closing = new Date(cashKpis.closingDate).getTime();
  const todayMs = new Date().getTime();
  // Airtable-scheduled-but-not-yet-invoiced amounts already past due; added to
  // the current week's Expected Receive below.
  let scheduledOverdue = 0;
  const scheduledByWeek = combined.map(() => 0);
  (scheduledInvoices ?? []).forEach(s => {
    const due = new Date(s.dueDate).getTime();
    const amountNZD = s.amount * AUD_TO_NZD_APPROX;
    if (due < todayMs) {
      scheduledOverdue += amountNZD;
      return;
    }
    for (let i = 0; i < combined.length; i++) {
      const r = combined[i];
      const [weekStart, weekEnd] = r.weekStart && r.weekEnd
        ? [new Date(r.weekStart).getTime(), new Date(r.weekEnd).getTime()]
        : [closing + (i - currentIdx - 1) * 7 * 86_400_000, closing + (i - currentIdx) * 7 * 86_400_000];
      if (due >= weekStart && due < weekEnd) {
        scheduledByWeek[i] += amountNZD;
        break; // an invoice belongs to exactly one week — stop at the first match
      }
    }
  });

  const cashFlowHasDetail = actualWeeks.some(d => d.inflow != null || d.outflow != null);

  // Expected Receive per week from Australian Xero invoices (ex GST, NZD):
  //   past week    → every invoice that was due that week (paid or not)
  //   current week → same, plus unpaid invoices that went overdue before it
  //   future week  → invoices still unpaid that fall due that week
  const ausInvoices = data.ausReceivables?.invoices ?? [];
  const expectedFromInvoices = (weekStart: string | undefined, weekEnd: string | undefined, i: number) => {
    if (!weekStart || !weekEnd) return 0;
    const dueInWeek = ausInvoices.filter(inv => inv.dueDate >= weekStart && inv.dueDate <= weekEnd);
    if (i === thisWeekIdx) {
      const overdue = ausInvoices.filter(inv => inv.amountDueExGst > 0 && inv.dueDate < weekStart);
      return dueInWeek.reduce((sum, inv) => sum + inv.amountExGst, 0)
        + overdue.reduce((sum, inv) => sum + inv.amountDueExGst, 0);
    }
    if (weekEnd < todayStr) return dueInWeek.reduce((sum, inv) => sum + inv.amountExGst, 0);
    return dueInWeek.reduce((sum, inv) => sum + inv.amountDueExGst, 0);
  };

  // Bucket each week into previous/current/next calendar month, anchored on today's real date
  // so "current month" always matches the calendar rather than the (often lagging) Xero closing date.
  // Uses each week's real weekStart from the API when available, falling back to the
  // closing-date + 7-days-per-week approximation used for scheduledByWeek above.
  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const today = new Date();
  const prevMonthDate = new Date(today); prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const nextMonthDate = new Date(today); nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
  const monthName = (d: Date) => d.toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' });

  const monthBuckets = {
    previous: { label: monthName(prevMonthDate), rows: [] as MonthCashRow[] },
    current:  { label: monthName(today), rows: [] as MonthCashRow[] },
    next:     { label: monthName(nextMonthDate), rows: [] as MonthCashRow[] },
  };
  combined.forEach((d, i) => {
    const weekDate = d.weekStart ? new Date(d.weekStart) : new Date(closing + (i - currentIdx) * 7 * 86_400_000);
    const expected = expectedFromInvoices(d.weekStart, d.weekEnd, i)
      + scheduledByWeek[i]
      + (i === thisWeekIdx ? scheduledOverdue : 0);
    // Actual Received = the week's real cash-basis AU inflow (so far, for the
    // current week); forecast weeks haven't happened yet.
    const isPast = !d.isForecast && i !== thisWeekIdx;
    const row: MonthCashRow = {
      weekLabel: d.weekLabel, isForecast: d.isForecast, isPast,
      expected: Math.round(expected),
      actual: d.isForecast ? undefined : d.inflow,
      outflow: d.outflow,
    };
    const key = monthKey(weekDate);
    if (key === monthKey(prevMonthDate)) monthBuckets.previous.rows.push(row);
    else if (key === monthKey(today)) monthBuckets.current.rows.push(row);
    else if (key === monthKey(nextMonthDate)) monthBuckets.next.rows.push(row);
  });

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <DiagnosisTile diagnosis={summary.diagnosis} />
      <TargetRunwaySection s={summary} />

      <PLSummarySection totalRevenue={totalRevenue} totalGrossProfit={totalGrossProfit} totalOpex={totalOpex} netProfit={netProfit} lastMonthSamePoint={data.lastMonthSamePoint} cac={cac} monthlyTrend={data.monthlyTrend} />

      <CashPositionSection
        cashKpis={cashKpis}
        bankAccounts={data.bankAccounts}
        monthlyTrend={data.monthlyTrend}
        ausReceivables={data.ausReceivables}
        cashFlowHasDetail={cashFlowHasDetail}
        monthBuckets={monthBuckets}
        hasCombined={combined.length > 0}
      />

      {error && (
        <p style={{ color: RD, fontSize: 12, margin: '8px 0 0' }}>⚠ Xero connection error — {error?.message}</p>
      )}
    </div>
  );
}
