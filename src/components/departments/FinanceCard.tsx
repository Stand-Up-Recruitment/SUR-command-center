import { useState } from 'react';
import { Skeleton } from '../shared/Skeleton';
import {
  useXeroFinanceData, useScheduledInvoices, useCacKPIs, usePlacementPlan, useRecruiterKPIs, useJobAging, useRecruitmentSettings, useClientInvoices,
} from '../../hooks/queries';
import { AUD_TO_NZD_APPROX, timeBoundaries } from '../../services/airtable';
import { availableCash as availableCashOf, financeSummary, forecastWeeklyOutflow, OUTFLOW_BUFFER, type FinanceSummary } from '../../lib/finance';
import { monthWindow, currentMonthKey, recentMonthKeys, addDays, type MonthWindow } from '../../lib/nzTime';
import { recruitmentPace, teamRecruiters, DEFAULT_RECRUITMENT_SETTINGS } from '../../lib/recruitment';
import { avgDaysLateByClient } from '../../lib/clientScorecard';
import { companyKey } from '../../lib/companyKey';
import type { PlacementPlan } from '../../lib/placementPlan';
import { DiagnosisTile } from '../shared/DiagnosisTile';
import { C, NUM_FONT, CARD } from '../shared/v2Theme';
import { Tile, Big, Line as TextLine } from '../shared/v2Layout';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import type { XeroFinanceData, CacKPIs } from '../../types';

// ─── Palette (the Marketing / Recruitment v2 colours) ──────────────────────────
const NZ   = C.green;
const AUS  = C.blue;
const PU   = '#A99CF5'; // net profit / plan: a lighter violet that reads on the v2 cards
const AM   = C.amber;
const RD   = C.red;

const BG     = C.inset;
const BG2    = C.card;
const BORDER = C.border;
const TEXT   = C.text;
const MUTED  = C.muted;

const fmtNZD = (n: number) => {
  const abs = Math.abs(n).toLocaleString('en-NZ', { maximumFractionDigits: 0 });
  return n < 0 ? `-$${abs}` : `$${abs}`;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });

// ─── Layout helpers ───────────────────────────────────────────────────────────

function SH({ label, sub }: { label: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12, margin: '32px 0 14px' }}>
      <h2 style={{ margin: 0, fontFamily: NUM_FONT, fontSize: 22, fontWeight: 700, color: C.text }}>{label}</h2>
      {sub && <span style={{ fontSize: 14, color: C.muted }}>{sub}</span>}
    </div>
  );
}

// Tile in the Marketing style: label, big number, muted line. `accent` is kept for callers but no longer drawn.
function KP({ label, value, unit, sub, valueColor }: {
  label: string; value: string; unit?: string; sub?: string; accent?: string; valueColor?: string;
}) {
  return (
    <Tile label={label.toUpperCase()} chip={null}>
      <Big value={value} color={valueColor ?? C.text} size={40} unit={unit} />
      {sub && <TextLine muted>{sub}</TextLine>}
    </Tile>
  );
}

type MonthMetric = 'revenue' | 'grossProfit' | 'opex' | 'netProfit';
type MonthFigures = Partial<Record<MonthMetric, number>>;
type MonthCompare = {
  currentName: string; lastName: string; isCurrent: boolean;
  current?: MonthFigures; samePoint?: MonthFigures | null; lastTotal?: MonthFigures;
};

// Top-row card: big FY-to-date number, then "[Month] so far" and a same-point
// comparison with last month. ▲/▼ is green/red, reversed when `invert` (opex).
function KPMonth({ label, value, valueColor, metric, compare, invert }: {
  label: string; value: string; valueColor?: string; accent?: string;
  metric: MonthMetric; compare: MonthCompare; invert?: boolean;
}) {
  const cur = compare.current?.[metric];
  const prev = compare.samePoint?.[metric];
  const lastTotal = compare.lastTotal?.[metric];
  // Dollar difference: a % breaks when last month was negative (e.g. a net loss).
  const diff = cur != null && prev != null ? cur - prev : null;
  const diffColor = diff == null ? MUTED : (invert ? diff <= 0 : diff >= 0) ? NZ : RD;
  return (
    <Tile label={label.toUpperCase()} chip={null}>
      <Big value={value} color={valueColor ?? C.text} size={40} />
      <TextLine>
        {compare.currentName} {compare.isCurrent ? 'so far' : 'total'}: <strong>{cur != null ? fmtNZD(cur) : '—'}</strong>
      </TextLine>
      <TextLine muted>
        <span style={{ color: diffColor, fontWeight: 600 }}>
          {diff == null ? '—' : `${diff >= 0 ? '▲ +' : '▼ −'}${fmtNZD(Math.abs(diff))}`}
        </span>
        {compare.isCurrent
          ? ` vs ${compare.lastName} at the same point · ${compare.lastName} total ${lastTotal != null ? fmtNZD(lastTotal) : '—'}`
          : ` vs ${compare.lastName} total ${lastTotal != null ? fmtNZD(lastTotal) : '—'}`}
      </TextLine>
    </Tile>
  );
}

function G4({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
      {children}
    </div>
  );
}

function Card({ children, accent, accentSide }: { children: React.ReactNode; accent?: string; accentSide?: 'top' | 'left' }) {
  const borderTop  = accent && accentSide !== 'left' ? `3px solid ${accent}` : undefined;
  const borderLeft = accent && accentSide === 'left' ? `3px solid ${accent}` : undefined;
  return (
    <div style={{ ...CARD, borderTop, borderLeft, padding: 20, marginBottom: 14 }}>
      {children}
    </div>
  );
}

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5, padding: '10px 12px', background: BG, borderRadius: 8, marginTop: 8 }}>
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
      <SH label="P&L Summary" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10, marginBottom: '.875rem' }}>{[0,1,2,3,4].map(kpCard)}</div>
      <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, padding: '1.25rem', marginBottom: '.875rem' }}>
        <Skeleton height={240} />
      </div>
      <SH label="Cash Position" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>{[0,1,2,3].map(kpCard)}</div>
      <SH label="Variance Commentary" />
      <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, padding: '1.25rem', marginBottom: '.875rem' }}>
        <Skeleton height={13} width={400} style={{ marginBottom: 8 }} />
        <Skeleton height={13} width={320} />
      </div>
      <SH label="13-Week Cash Outlook" />
      <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, padding: '1.25rem', marginBottom: '.875rem' }}>
        <Skeleton height={220} />
      </div>
    </div>
  );
}

// ─── Section components ───────────────────────────────────────────────────────

function TwelveMonthTrendChart({ data, plan }: { data: XeroFinanceData['monthlyTrend']; plan: PlacementPlan }) {
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
          <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 4 }}>12-Month Trend</div>
          <div style={{ fontSize: 13, color: MUTED }}>Revenue (bars) · Net profit (line) · Australia only · NZD</div>
          {view === 'monthly' && (
            <div style={{ fontSize: 13, color: MUTED }}>
              <span style={{ color: AM }}>- - Breakeven</span> = revenue that covers average monthly costs ({plan.costs ? fmtNZD(plan.costs.value) : '—'}) ·{' '}
              <span style={{ color: PU }}>- - Plan</span> = net profit the plan delivers at current costs ({plan.projectedNetProfit != null ? fmtNZD(plan.projectedNetProfit) : '—'})
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {(['monthly', 'overall'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                fontSize: 13,
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
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: MUTED }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 12, fill: MUTED }}
            axisLine={false}
            tickLine={false}
            tickFormatter={fmtAxis}
            domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max, view === 'monthly' ? (plan.projectedNetProfit ?? 0) * 1.05 : 0)]}
          />
          <ReferenceLine y={0} stroke={BORDER} />
          {view === 'monthly' && plan.costs && <ReferenceLine y={plan.costs.value} stroke={AM} strokeDasharray="5 4" label={{ value: 'Breakeven', position: 'insideTopLeft', fill: AM, fontSize: 12 }} />}
          {view === 'monthly' && plan.projectedNetProfit != null && <ReferenceLine y={plan.projectedNetProfit} stroke={PU} strokeDasharray="5 4" label={{ value: 'Plan', position: 'insideTopLeft', fill: PU, fontSize: 12 }} />}
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

function PLSummarySection({ w, totalRevenue, totalGrossProfit, totalOpex, netProfit, lastMonthSamePoint, cac, monthlyTrend, plan }: {
  w: MonthWindow;
  totalRevenue: number; totalGrossProfit: number; totalOpex: number; netProfit: number;
  lastMonthSamePoint: XeroFinanceData['lastMonthSamePoint'];
  cac: CacKPIs | undefined;
  monthlyTrend: XeroFinanceData['monthlyTrend'];
  plan: PlacementPlan;
}) {
  const grossMarginPct = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
  // Per placement, like per placed client: candidate cost is a product cost (off the profit), client cost is the CAC.
  const candCac = cac?.candidateCacLoaded;
  const clientCacPerPlacement = cac?.placementCacLoaded != null && candCac != null ? cac.placementCacLoaded - candCac : null;
  const perPlacement = plan.gp && candCac != null && clientCacPerPlacement ? (plan.gp.value - candCac) / clientCacPerPlacement : null;
  const fmtRatio = (r: number | null | undefined) => (r != null ? `${r.toFixed(1)}:1` : '—');
  const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Selected month = the trend's partial isCurrentMonth entry, or a past month
  // matched by name; last month's total = the entry before it. "Same point" =
  // last month 1st → same day for the current month, else last month's total.
  const curIdx = (monthlyTrend ?? []).findIndex(m => w.isCurrent ? m.isCurrentMonth : !m.isCurrentMonth && m.month.startsWith(w.shortLabel));
  const currentMonth = curIdx >= 0 ? monthlyTrend?.[curIdx] : undefined;
  const lastMonth = curIdx > 0 ? monthlyTrend?.[curIdx - 1] : undefined;
  const compare: MonthCompare = {
    currentName: w.shortLabel,
    lastName: w.prevShortLabel,
    isCurrent: w.isCurrent,
    current: currentMonth,
    samePoint: w.isCurrent ? lastMonthSamePoint : lastMonth,
    lastTotal: lastMonth,
  };

  return (
    <>
      <SH label="P&L Summary" sub="Australia only · revenue · gross profit · opex · net profit · LTGP:CAC" />

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

      <TwelveMonthTrendChart data={monthlyTrend} plan={plan} />

      {/* Unit economics: LTGP:CAC with the two CACs behind it (moved from Marketing). Last 30 days vs the prior 30. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginBottom: 14 }}>
        <KP
          label="LTGP:CAC"
          value={fmtRatio(perPlacement)}
          valueColor={PU}
          sub={`Per placement · GP ${plan.gp && candCac != null ? fmtNZD(plan.gp.value - candCac) : '—'} (after candidate cost) ÷ CAC per placement ${clientCacPerPlacement != null ? fmtNZD(clientCacPerPlacement) : '—'} · per placed client ${fmtRatio(cac?.ltgpToCac)}`}
        />
        {([
          ['CLIENT CAC · LAST 30 DAYS', 'per signed client', cac?.clientCacLoaded, cac?.prevClientCacLoaded, 'Client Meta spend + Les’s sales time ($28/hr, 60%) ÷ ToBs signed'],
          ['CANDIDATE CAC · LAST 30 DAYS', 'per placed candidate', cac?.candidateCacLoaded, cac?.prevCandidateCacLoaded, 'Candidate Meta + job board ads + 60% of recruiters’ pay ÷ placements signed'],
        ] as const).map(([label, unit, cur, prev, formula]) => {
          const compare = cac?.hasPrevPeriod && cur != null && prev != null;
          return (
            <Tile key={label} label={label} chip={null}>
              <Big value={cur != null ? fmtNZD(cur) : '—'} color={compare ? (cur <= prev ? NZ : RD) : TEXT} size={40} unit={unit} />
              <TextLine muted>{formula}</TextLine>
              {compare && <TextLine muted>Prior 30 days {fmtNZD(prev)} · {cur >= prev ? '+' : '−'}{fmtNZD(Math.abs(cur - prev))}</TextLine>}
            </Tile>
          );
        })}
      </div>
    </>
  );
}

// expected = what was / is expected to come in that week (due date + the client's average days late);
// actual = cash actually received (undefined for forecast weeks); isPast = the week has finished;
// stillDue = this week only: unpaid amounts still expected later this week.
type MonthCashRow = { weekLabel: string; isForecast: boolean; isPast: boolean; isThisWeek: boolean; expected: number; actual?: number; outflow?: number; stillDue?: number };

/** Net cash flow: finished weeks actual − outflow; this week received so far + still due − outflow; future weeks expected − forecast outflow. */
const rowNet = (r: MonthCashRow) =>
  (r.isPast ? r.actual ?? 0 : r.isThisWeek ? (r.actual ?? 0) + (r.stillDue ?? 0) : r.expected) - (r.outflow ?? 0);

function MonthCashCard({ title, monthLabel, rows, cashFlowHasDetail }: {
  title: string; monthLabel: string; rows: MonthCashRow[];
  cashFlowHasDetail: boolean;
}) {
  const th = { fontSize: 12, fontWeight: 700, color: MUTED, padding: '8px 8px', borderBottom: `1px solid ${C.rowBorder}` } as const;
  const td = { padding: '9px 8px', borderBottom: `1px solid ${C.rowBorder}`, textAlign: 'right' as const, whiteSpace: 'nowrap' as const };
  return (
    <Card>
      <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>{title}</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 12 }}>{monthLabel}</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: MUTED, fontStyle: 'italic' }}>No weeks in range</div>
      ) : (
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
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
        // See rowNet: finished weeks actual, this week so far + still due, future weeks expected.
        const netCashFlow = rows.reduce((sum, r) => sum + rowNet(r), 0);
        return (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: `.5px solid ${BORDER}` }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: MUTED }}>Net cash flow</span>
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
  cashKpis, bankAccounts, ausReceivables, cashFlowHasDetail,
  monthBuckets, hasCombined, forecastOutflow,
}: {
  cashKpis: { closingDate: string };
  bankAccounts: Array<{ name: string; balance: number }> | undefined;
  forecastOutflow: number | null;
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

  const overdueCount = ausReceivables?.overdueCount ?? 0;

  return (
    <>
      <SH label="Cash Position"
        sub={hasCombined
          ? `Actuals · forecast · as at ${fmtDate(cashKpis.closingDate)}`
          : 'Actuals · forecast'} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
        <KP accent={availableCash >= 0 ? NZ : RD}
            label="Available cash"
            value={bankAccounts ? fmtNZD(availableCash) : '—'}
            sub={bankAccounts ? `Ops + Profit accounts only, excluding the GST/Tax and Employee Entitlements accounts · total in bank ${fmtNZD(totalInBank)}` : undefined}
            valueColor={availableCash >= 0 ? NZ : RD} />
        <KP accent={AM}
            label="Owed to us"
            value={ausReceivables ? fmtNZD(ausReceivables.owedTotal) : '—'}
            valueColor={AM} />
        <KP accent={RD}
            label="Overdue"
            value={ausReceivables ? fmtNZD(ausReceivables.overdueTotal) : '—'}
            sub={ausReceivables ? `${overdueCount} invoice${overdueCount === 1 ? '' : 's'}` : undefined}
            valueColor={ausReceivables && ausReceivables.overdueTotal > 0 ? RD : MUTED} />
      </div>

      {/* Previous / current / next month cash outlook, side by side */}
      {hasCombined && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            <MonthCashCard title="Previous month" monthLabel={monthBuckets.previous.label} rows={monthBuckets.previous.rows} cashFlowHasDetail={cashFlowHasDetail} />
            <MonthCashCard title="Current month" monthLabel={monthBuckets.current.label} rows={monthBuckets.current.rows} cashFlowHasDetail={cashFlowHasDetail} />
            <MonthCashCard title="Next month" monthLabel={monthBuckets.next.label} rows={monthBuckets.next.rows} cashFlowHasDetail={cashFlowHasDetail} />
          </div>
          <NoteBox>
            Expected Receive = Australian Xero invoices plus Airtable scheduled instalments (not yet invoiced), each moved from its due date by that client's average days late (Clients tab; due date + 7 days if the client has no payment history; early payers count as on time).
            An unpaid invoice whose expected date has passed moves into next week. Actual Received = Australian cash received (Xero, ex GST).
            Future weeks' Outflow = average cash out of the last 4 finished weeks + {fmtNZD(OUTFLOW_BUFFER)}{forecastOutflow != null ? ` (${fmtNZD(forecastOutflow)}/week)` : ''}.
          </NoteBox>
        </>
      )}
    </>
  );
}

// ─── Net profit & runway (read by the Overview) ───────────────────────────────

function TargetRunwaySection({ s, w }: { s: FinanceSummary; w: MonthWindow }) {
  const npColor = (n: number | null) => n == null ? MUTED : n >= 0 ? NZ : RD;
  const rwColor = s.runwayWeeks == null ? MUTED : s.runwayWeeks >= 8 ? NZ : s.runwayWeeks >= 4 ? AM : RD;
  return (
    <>
      <SH label="Net profit & runway" sub={`Australia only · ${w.isCurrent ? 'month to date' : 'full month'}`} />
      <G4>
        <KP accent={PU}
            label={w.isCurrent ? 'Net profit this month' : `Net profit · ${w.label}`}
            value={s.netProfitMtd != null ? fmtNZD(s.netProfitMtd) : '—'} />
        <KP accent={npColor(s.projectedNetProfit)}
            label="Projected month end"
            value={s.projectedNetProfit != null ? fmtNZD(s.projectedNetProfit) : '—'}
            valueColor={npColor(s.projectedNetProfit)}
            sub={s.projectedNetProfit != null ? 'Month to date ÷ days elapsed × days in month' : undefined} />
        <KP accent={rwColor}
            label="Cash runway"
            value={s.runwayWeeks != null ? `${s.runwayWeeks.toFixed(1)} weeks` : '—'}
            valueColor={rwColor}
            sub="Available cash ÷ average weekly costs (last 4 weeks) · as of today" />
        <KP accent={MUTED}
            label="Average weekly costs"
            value={s.weeklyCosts != null ? fmtNZD(s.weeklyCosts) : '—'}
            sub="Cash out, last 4 finished weeks · as of today" />
      </G4>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

// Days added to the due date when a client has no payment history.
const NO_HISTORY_DAYS = 7;

export function FinanceCard() {
  const { data, error } = useXeroFinanceData();
  const { data: scheduledInvoices } = useScheduledInvoices();
  const { data: clientInvoices } = useClientInvoices();
  const { plan } = usePlacementPlan();
  const { data: rec } = useRecruiterKPIs('month');
  const { data: jobs } = useJobAging();
  const { data: recSettings } = useRecruitmentSettings();
  const [month, setMonth] = useState(currentMonthKey);
  const w = monthWindow(month);

  // ── Computed values ─────────────────────────────────────────────────────────
  // Finance tab is Australia only — every headline number uses only the aus*
  // fields the webhook already computes correctly; NZ revenue/costs never
  // enter these totals (that mismatch was the source of the inflated Net Profit).
  const totalRevenue     = data?.ausRevenue ?? 0;
  const totalGrossProfit = data?.ausGrossProfit ?? 0;
  const totalOpex        = data?.ausTotalCosts ?? 0;
  const netProfit         = data?.ausNetProfit ?? data?.ausGrossProfit ?? 0;

  const grossMarginPct = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : undefined;
  const { data: cac } = useCacKPIs(grossMarginPct, data?.jobBoardAdvertising90d, data?.prevJobBoardAdvertising90d, data?.audNzdMonthlyRates, data?.opex90d, data?.prevOpex90d, data?.placementFeeLines);

  if (!data) return <FinanceSkeleton />;

  // Placement pace this month, same count and projection as the Recruitment tab and Overview.
  const targets = { mustMake: plan.mustMake, breakeven: plan.breakeven };
  const { start, now: nowMs } = timeBoundaries('month');
  const recruiterList = recSettings?.recruiters ? recSettings.recruiters : DEFAULT_RECRUITMENT_SETTINGS.recruiters;
  const pace = rec ? recruitmentPace(rec, teamRecruiters(rec, jobs, recruiterList), 'month', start, nowMs, targets) : null;
  const placementPace = pace && { placements: pace.placements, projected: pace.projected, ...targets };
  // Diagnosis stays on the current month (same as the Overview); the net profit row follows the dropdown.
  const summary = financeSummary(data, monthWindow(currentMonthKey()), placementPace);
  const monthSummary = w.isCurrent ? summary : financeSummary(data, w, placementPace);

  const cashKpis    = data.cashKpis ?? { openingBalance: 0, closingBalance: 0, closingBalanceActual: 0, avgWeeklyOutflow: 0, openingDate: data.asOf, closingDate: data.asOf };
  const cashFlow    = data.cashFlow ?? [];
  const forecastOutflow = forecastWeeklyOutflow(cashFlow);
  // Future weeks' outflow = last 4 finished weeks' average + buffer, not the webhook's figure.
  const combined = [
    ...cashFlow.map(r => ({ ...r, isForecast: false })),
    ...(data.cashOutlook ?? []).map(r => ({ ...r, isForecast: true, outflow: forecastOutflow ?? r.outflow })),
  ];

  const currentIdx = combined.reduce((last, r, i) => (r.isForecast ? last : i), -1);
  // The week containing today's (local) date — not simply the last actual row, which
  // lags a week whenever the webhook data was built before this Monday.
  const todayStr = new Date().toLocaleDateString('en-CA');
  const thisWeekIdx = combined.findIndex(r => r.weekStart && r.weekEnd && r.weekStart <= todayStr && todayStr <= r.weekEnd);
  // Unpaid amounts whose expected date has passed are expected next week.
  const rollIdx = (thisWeekIdx >= 0 ? thisWeekIdx : currentIdx) + 1;

  // Week bounds as YYYY-MM-DD; rows without real dates fall back to closing date + 7 days per week.
  const closing = cashKpis.closingDate.slice(0, 10);
  const weekBounds = (i: number): [string, string] => {
    const r = combined[i];
    return r.weekStart && r.weekEnd ? [r.weekStart, r.weekEnd] : [addDays(closing, (i - currentIdx - 1) * 7 + 1), addDays(closing, (i - currentIdx) * 7)];
  };
  const weekOf = (date: string) => combined.findIndex((_, i) => { const [a, b] = weekBounds(i); return date >= a && date <= b; });
  const hasStarted = (i: number) => weekBounds(i)[0] <= todayStr; // finished week or this week

  // Expected date = due date + that client's average days late (Clients tab); no history → due + 7.
  // Early payers count as on time.
  const lateBy = clientInvoices ? avgDaysLateByClient(clientInvoices, todayStr) : null;
  const lateDays = (client: string) => {
    const d = lateBy?.get(companyKey(client, client));
    return d == null ? NO_HISTORY_DAYS : Math.max(0, Math.round(d));
  };

  // expectedByWeek: finished weeks and this week show everything expected then (paid or not);
  // future weeks show unpaid amounts only. stillDue: unpaid amounts expected later this week.
  const expectedByWeek = combined.map(() => 0);
  let stillDue = 0;
  const place = (exp: string, original: number, unpaid: number) => {
    const wi = weekOf(exp);
    if (wi >= 0 && hasStarted(wi)) expectedByWeek[wi] += original;
    if (unpaid <= 0) return;
    if (exp < todayStr) { if (rollIdx < combined.length) expectedByWeek[rollIdx] += unpaid; }
    else if (wi === thisWeekIdx) stillDue += unpaid;
    else if (wi >= 0) expectedByWeek[wi] += unpaid;
  };
  // Australian Xero invoices (ex GST, NZD).
  for (const inv of data.ausReceivables?.invoices ?? []) {
    place(addDays(inv.dueDate, lateDays(inv.contact)), inv.amountExGst, inv.amountDueExGst);
  }
  // Scheduled-but-unbilled Airtable instalments (Status = Scheduled, InvoiceID blank), AUD → NZD.
  for (const si of scheduledInvoices ?? []) {
    const amountNZD = si.amount * AUD_TO_NZD_APPROX;
    place(addDays(si.dueDate.slice(0, 10), lateDays(si.client)), amountNZD, amountNZD);
  }

  const cashFlowHasDetail = cashFlow.some(d => d.inflow != null || d.outflow != null);

  // Bucket each week into previous/current/next calendar month, anchored on today's real date
  // so "current month" always matches the calendar rather than the (often lagging) Xero closing date.
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
    const weekDate = new Date(`${weekBounds(i)[0]}T00:00:00`);
    const isThisWeek = i === thisWeekIdx;
    // Actual Received = the week's real cash-basis AU inflow (so far, for the
    // current week); forecast weeks haven't happened yet.
    const row: MonthCashRow = {
      weekLabel: d.weekLabel, isForecast: d.isForecast, isPast: !d.isForecast && !isThisWeek, isThisWeek,
      expected: Math.round(expectedByWeek[i]),
      actual: d.isForecast ? undefined : d.inflow,
      outflow: d.outflow,
      stillDue: isThisWeek ? Math.round(stillDue) : undefined,
    };
    const key = monthKey(weekDate);
    if (key === monthKey(prevMonthDate)) monthBuckets.previous.rows.push(row);
    else if (key === monthKey(today)) monthBuckets.current.rows.push(row);
    else if (key === monthKey(nextMonthDate)) monthBuckets.next.rows.push(row);
  });

  return (
    <div style={{ color: C.text }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ margin: 0, fontFamily: NUM_FONT, fontSize: 34, fontWeight: 700, letterSpacing: '-0.5px', color: C.text }}>Finance</h1>
          <p style={{ margin: 0, fontSize: 14, color: C.muted }}>Australia only · NZD · the month picker sets net profit and the P&amp;L</p>
        </div>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          aria-label="Month"
          style={{ height: 44, background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '0 12px', fontSize: 14 }}
        >
          {recentMonthKeys(12).map(k => <option key={k} value={k}>{monthWindow(k).label}</option>)}
        </select>
      </header>
      <DiagnosisTile diagnosis={summary.diagnosis} />
      <TargetRunwaySection s={monthSummary} w={w} />

      <PLSummarySection w={w} totalRevenue={totalRevenue} totalGrossProfit={totalGrossProfit} totalOpex={totalOpex} netProfit={netProfit} lastMonthSamePoint={data.lastMonthSamePoint} cac={cac} monthlyTrend={data.monthlyTrend} plan={plan} />

      <CashPositionSection
        cashKpis={cashKpis}
        bankAccounts={data.bankAccounts}
        ausReceivables={data.ausReceivables}
        cashFlowHasDetail={cashFlowHasDetail}
        monthBuckets={monthBuckets}
        hasCombined={combined.length > 0}
        forecastOutflow={forecastOutflow}
      />

      {error && (
        <p style={{ color: RD, fontSize: 12, margin: '8px 0 0' }}>⚠ Xero connection error — {error?.message}</p>
      )}
    </div>
  );
}
