import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from 'recharts';
import { COLORS } from '../../styles/tokens';
import type { MarketingKPIs, SalesKPIs, RecruiterKPIs, RevenueKPIs, XeroFinanceData, RetentionKPIs, LTGPKPIs } from '../../types';

const CHART_H = 110;
const TT = {
  contentStyle: { background: '#1a1a1a', border: '1px solid #2d2d2d', borderRadius: 6, fontSize: 12, color: '#f5f5f5' },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
};
const AX = { tick: { fontSize: 11, fill: COLORS.textMuted }, axisLine: false as const, tickLine: false as const };

function fmt(n: number): string {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
}

function NoData() {
  return <p style={{ fontSize: 12, color: COLORS.textMuted, margin: 0 }}>No data</p>;
}

export function OverviewMarketingChart({ data }: { data: MarketingKPIs }) {
  const d = [
    { name: 'Candidates', current: data.candidates.qualified, prev: data.candidates.prevQualified },
    { name: 'Clients', current: data.clients.qualified, prev: data.clients.prevQualified },
  ];
  return (
    <ResponsiveContainer width="100%" height={CHART_H}>
      <BarChart data={d} barGap={3} barCategoryGap="15%">
        <XAxis dataKey="name" {...AX} />
        <YAxis hide />
        <Tooltip {...TT} />
        <Bar dataKey="current" fill={COLORS.accent} name="This Period" radius={[3, 3, 0, 0]} maxBarSize={50} />
        <Bar dataKey="prev" fill={COLORS.textMuted} name="Prev Period" radius={[3, 3, 0, 0]} maxBarSize={50} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OverviewSalesChart({ data }: { data: SalesKPIs }) {
  const d = [
    { stage: 'Leads', count: data.leadsThisWeek },
    { stage: 'Booked', count: data.bookedCalls },
    { stage: 'Signed', count: data.closedClients },
  ];
  return (
    <ResponsiveContainer width="100%" height={CHART_H}>
      <BarChart layout="vertical" data={d} margin={{ left: 0, right: 8 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="stage" {...AX} width={46} />
        <Tooltip {...TT} />
        <Bar dataKey="count" fill={COLORS.accent} name="Count" radius={[0, 3, 3, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OverviewRecruitmentChart({ data }: { data: RecruiterKPIs }) {
  if (!data.byRecruiter.length) return <NoData />;
  const d = data.byRecruiter.map(r => ({ name: r.name.split(' ')[0], placements: r.placements }));
  return (
    <ResponsiveContainer width="100%" height={CHART_H}>
      <BarChart data={d} barCategoryGap="20%">
        <XAxis dataKey="name" {...AX} />
        <YAxis hide allowDecimals={false} />
        <Tooltip {...TT} />
        <Bar dataKey="placements" fill={COLORS.accent} name="Placements" radius={[3, 3, 0, 0]} maxBarSize={52} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OverviewRevenueChart({ data }: { data: RevenueKPIs }) {
  const d = [
    { name: '1st Pay', amount: data.firstCollectedAmount },
    { name: '2nd Pay', amount: data.secondCollectedAmount },
  ];
  return (
    <ResponsiveContainer width="100%" height={CHART_H}>
      <BarChart data={d} barCategoryGap="20%">
        <XAxis dataKey="name" {...AX} />
        <YAxis hide />
        <Tooltip {...TT} formatter={(v: unknown) => [fmt(v as number), 'Collected']} />
        <Bar dataKey="amount" fill={COLORS.success} name="Collected" radius={[3, 3, 0, 0]} maxBarSize={72} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OverviewFinanceChart({ data }: { data: XeroFinanceData }) {
  if (!data.cashFlow.length) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height={CHART_H}>
      <AreaChart data={data.cashFlow} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id="finGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.25} />
            <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" {...AX} />
        <YAxis hide />
        <Tooltip {...TT} formatter={(v: unknown) => [fmt(v as number), 'Net Cash']} />
        <Area type="monotone" dataKey="net" stroke={COLORS.success} fill="url(#finGrad)" strokeWidth={2} dot={false} name="Net Cash" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const RETENTION_COLORS = [COLORS.success, COLORS.warning, COLORS.accent];

export function OverviewRetentionChart({ data }: { data: RetentionKPIs }) {
  const d = [
    { name: 'Active', count: data.activeInWindow },
    { name: 'In Progress', count: data.inProgress },
    { name: 'Replaced', count: data.replacementsThisMonth },
  ];
  return (
    <ResponsiveContainer width="100%" height={CHART_H}>
      <BarChart data={d} barCategoryGap="15%">
        <XAxis dataKey="name" {...AX} />
        <YAxis hide allowDecimals={false} />
        <Tooltip {...TT} />
        <Bar dataKey="count" name="Count" radius={[3, 3, 0, 0]} maxBarSize={56}>
          {d.map((_, i) => <Cell key={i} fill={RETENTION_COLORS[i]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ltgpColor(ratio: number): string {
  if (ratio >= 9) return COLORS.success;
  if (ratio >= 6) return COLORS.warning;
  return COLORS.danger;
}

export function OverviewLTGPChart({ data }: { data: LTGPKPIs }) {
  const color = data.ltgpCacRatio > 0 ? ltgpColor(data.ltgpCacRatio) : COLORS.textMuted;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 48, fontWeight: 900, color, letterSpacing: '-2px', lineHeight: 1 }}>
        {data.ltgpCacRatio > 0 ? `${data.ltgpCacRatio.toFixed(1)}×` : '—'}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        LTGP:CAC
      </div>
      {data.paybackPeriodDays > 0 && (
        <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>
          {Math.round(data.paybackPeriodDays)}d payback
        </div>
      )}
    </div>
  );
}
