import { Link } from 'react-router-dom';
import { COLORS, CARD_STYLE } from '../styles/tokens';
import { StatusBadge } from '../components/shared/StatusBadge';
import { Skeleton } from '../components/shared/Skeleton';
import {
  useSalesKPIs,
  useMarketingKPIs,
  useRecruiterKPIs,
  useRevenueKPIs,
  useRetentionKPIs,
  useXeroFinanceData,
  useLTGPKPIs,
} from '../hooks/queries';
import {
  OverviewMarketingChart,
  OverviewSalesChart,
  OverviewRecruitmentChart,
  OverviewRevenueChart,
  OverviewFinanceChart,
  OverviewRetentionChart,
  OverviewLTGPChart,
} from '../components/overview/OverviewCharts';
import type { DepartmentStatus } from '../types';

const departments = [
  { name: 'Marketing',   path: '/marketing',   description: 'Leads, ad spend & channel performance' },
  { name: 'Sales',       path: '/sales',        description: 'Revenue, pipeline & win rate' },
  { name: 'Recruitment', path: '/recruitment',  description: 'Placements, fill rate & recruiter KPIs' },
  { name: 'Revenue',     path: '/revenue',      description: 'Invoices, collections & payment flow' },
  { name: 'Finance',     path: '/finance',      description: 'P&L, cash flow & invoices' },
  { name: 'Retention',   path: '/retention',    description: 'Candidate & client retention' },
  { name: 'LTGP:CAC',   path: '/ltgp',         description: 'Lifetime Gross Profit vs acquisition cost' },
] as const;

function fmtMoney(n: number): string {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
}

export function OverviewPage() {
  const { data: mkt, isLoading: mktLoading } = useMarketingKPIs();
  const { data: sal, isLoading: salLoading } = useSalesKPIs();
  const { data: rec, isLoading: recLoading } = useRecruiterKPIs();
  const { data: rev, isLoading: revLoading } = useRevenueKPIs();
  const { data: ret, isLoading: retLoading } = useRetentionKPIs();
  const { data: fin, isLoading: finLoading } = useXeroFinanceData();
  const { data: ltgp, isLoading: ltgpLoading } = useLTGPKPIs();

  const indicators: Record<string, { loading: boolean; status: DepartmentStatus; kpi: string; showStatus: boolean }> = {
    '/marketing': {
      loading: mktLoading,
      showStatus: true,
      status: !mkt ? 'no-data' : (() => {
        const totalQual = mkt.candidates.qualified + mkt.clients.qualified;
        return totalQual >= 25 ? 'on-track' : totalQual >= 13 ? 'at-risk' : 'off-track';
      })(),
      kpi: mkt ? `${mkt.candidates.qualified + mkt.clients.qualified} qual. leads` : '—',
    },
    '/sales': {
      loading: salLoading,
      showStatus: true,
      status: sal
        ? (sal.callsToCloseRate >= 40 ? 'on-track' : sal.callsToCloseRate >= 20 ? 'at-risk' : 'off-track')
        : 'no-data',
      kpi: sal ? `${sal.callsToCloseRate}% calls-to-close` : '—',
    },
    '/recruitment': {
      loading: recLoading,
      showStatus: true,
      status: rec
        ? (rec.placements >= 2 ? 'on-track' : rec.placements >= 1 ? 'at-risk' : 'off-track')
        : 'no-data',
      kpi: rec ? `${rec.placements} placement${rec.placements !== 1 ? 's' : ''}` : '—',
    },
    '/revenue': {
      loading: revLoading,
      showStatus: true,
      status: rev
        ? (rev.totalRevenue >= 16000 ? 'on-track' : rev.totalRevenue >= 8000 ? 'at-risk' : 'off-track')
        : 'no-data',
      kpi: rev ? `${fmtMoney(rev.totalRevenue)} collected` : '—',
    },
    '/finance': {
      loading: finLoading,
      showStatus: false,
      status: 'no-data',
      kpi: fin ? `${fmtMoney(fin.netProfit)} net profit` : '—',
    },
    '/retention': {
      loading: retLoading,
      showStatus: true,
      status: ret
        ? (ret.replacementRate < 5 ? 'on-track' : ret.replacementRate < 10 ? 'at-risk' : 'off-track')
        : 'no-data',
      kpi: ret ? `${ret.replacementRate}% replacement rate` : '—',
    },
    '/ltgp': {
      loading: ltgpLoading,
      showStatus: true,
      status: ltgp
        ? (ltgp.ltgpCacRatio >= 9 ? 'on-track' : ltgp.ltgpCacRatio >= 6 ? 'at-risk' : 'off-track')
        : 'no-data',
      kpi: ltgp && ltgp.ltgpCacRatio > 0 ? `${ltgp.ltgpCacRatio.toFixed(1)}× LTGP:CAC` : '—',
    },
  };

  const chartFor = (path: string) => {
    if (path === '/marketing') return mkt ? <OverviewMarketingChart data={mkt} /> : null;
    if (path === '/sales') return sal ? <OverviewSalesChart data={sal} /> : null;
    if (path === '/recruitment') return rec ? <OverviewRecruitmentChart data={rec} /> : null;
    if (path === '/revenue') return rev ? <OverviewRevenueChart data={rev} /> : null;
    if (path === '/finance') return fin ? <OverviewFinanceChart data={fin} /> : null;
    if (path === '/retention') return ret ? <OverviewRetentionChart data={ret} /> : null;
    if (path === '/ltgp') return ltgp ? <OverviewLTGPChart data={ltgp} /> : null;
    return null;
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>
          Command Center
        </h2>
        <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>
          Select a department to view its metrics.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {departments.map((dept) => {
          const ind = indicators[dept.path];
          const chart = chartFor(dept.path);
          return (
            <Link
              key={dept.path}
              to={dept.path}
              style={{
                ...CARD_STYLE,
                borderTop: `3px solid ${COLORS.accent}`,
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'column',
                padding: 18,
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
                  {dept.name}
                </p>
                {ind.showStatus && (
                  ind.loading
                    ? <Skeleton height={22} width={80} radius={20} />
                    : <StatusBadge status={ind.status} />
                )}
              </div>

              <div style={{ minHeight: 18 }}>
                {ind.loading
                  ? <Skeleton height={14} width={120} />
                  : <p style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary, margin: 0 }}>{ind.kpi}</p>
                }
              </div>

              <p style={{ fontSize: 12, color: COLORS.textSecondary, margin: 0 }}>
                {dept.description}
              </p>

              <div style={{ marginTop: 6 }}>
                {ind.loading
                  ? <Skeleton height={110} width="100%" />
                  : (chart ?? null)
                }
              </div>

              <p style={{ fontSize: 12, fontWeight: 600, color: COLORS.accent, margin: '2px 0 0' }}>
                View →
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
