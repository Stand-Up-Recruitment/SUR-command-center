import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { COLORS, CARD_STYLE } from '../styles/tokens';
import { StatusBadge } from '../components/shared/StatusBadge';
import { Skeleton } from '../components/shared/Skeleton';
import { useAirtable } from '../hooks/useAirtable';
import {
  fetchMarketingKPIs, MOCK_MARKETING,
  fetchSalesKPIs, MOCK_SALES,
  fetchRecruiterKPIs, MOCK_RECRUITER,
  fetchRevenueKPIs, MOCK_REVENUE,
  fetchRetentionKPIs, MOCK_RETENTION,
} from '../services/airtable';
import { fetchXeroFinanceData, hasXeroCredentials } from '../services/xero';
import type { DepartmentStatus } from '../types';

const hasAirtableKey   = Boolean(import.meta.env.VITE_AIRTABLE_API_KEY);
const hasClientsBase   = Boolean(import.meta.env.VITE_AIRTABLE_CLIENTS_BASE_ID);
const hasCandidatesBase = Boolean(import.meta.env.VITE_AIRTABLE_CANDIDATES_BASE_ID);

const hasMarketingCredentials  = hasAirtableKey && hasClientsBase && hasCandidatesBase && Boolean(import.meta.env.VITE_META_TOKEN);
const hasSalesCredentials      = hasAirtableKey && hasClientsBase;
const hasRecruitmentCredentials = hasAirtableKey && hasCandidatesBase && hasClientsBase;
const hasRevenueCredentials    = hasAirtableKey && hasClientsBase;
const hasRetentionCredentials  = hasAirtableKey && hasClientsBase;

const departments = [
  { name: 'Marketing',   path: '/marketing',   description: 'Leads, ad spend & channel performance' },
  { name: 'Sales',       path: '/sales',        description: 'Revenue, pipeline & win rate' },
  { name: 'Recruitment', path: '/recruitment',  description: 'Placements, fill rate & recruiter KPIs' },
  { name: 'Revenue',     path: '/revenue',      description: 'Invoices, collections & payment flow' },
  { name: 'Finance',     path: '/finance',      description: 'P&L, cash flow & invoices' },
  { name: 'Retention',   path: '/retention',    description: 'Candidate & client retention' },
] as const;

function fmtMoney(n: number): string {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
}

export function OverviewPage() {
  const mktFetcher  = useCallback(() => fetchMarketingKPIs(),  []);
  const salFetcher  = useCallback(() => fetchSalesKPIs(),       []);
  const recFetcher  = useCallback(() => fetchRecruiterKPIs(),   []);
  const revFetcher  = useCallback(() => fetchRevenueKPIs(),     []);
  const retFetcher  = useCallback(() => fetchRetentionKPIs(),   []);
  const finFetcher  = useCallback(() => fetchXeroFinanceData(), []);

  const { data: mkt, loading: mktLoading } = useAirtable(mktFetcher, MOCK_MARKETING,  hasMarketingCredentials);
  const { data: sal, loading: salLoading } = useAirtable(salFetcher, MOCK_SALES,       hasSalesCredentials);
  const { data: rec, loading: recLoading } = useAirtable(recFetcher, MOCK_RECRUITER,   hasRecruitmentCredentials);
  const { data: rev, loading: revLoading } = useAirtable(revFetcher, MOCK_REVENUE,     hasRevenueCredentials);
  const { data: ret, loading: retLoading } = useAirtable(retFetcher, MOCK_RETENTION,   hasRetentionCredentials);
  const { data: fin, loading: finLoading } = useAirtable(finFetcher, undefined,        hasXeroCredentials);

  const indicators: Record<string, { loading: boolean; status: DepartmentStatus; kpi: string; showStatus: boolean }> = {
    '/marketing': {
      loading: mktLoading,
      showStatus: true,
      status: mkt
        ? (mkt.candidates.qualified >= 20 && mkt.clients.qualified >= 5 ? 'on-track'
          : mkt.candidates.qualified + mkt.clients.qualified >= 13 ? 'at-risk' : 'off-track')
        : 'no-data',
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
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>
          Command Center
        </h2>
        <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>
          Select a department to view its metrics.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {departments.map((dept) => {
          const ind = indicators[dept.path];
          return (
            <Link
              key={dept.path}
              to={dept.path}
              style={{
                ...CARD_STYLE,
                borderTop: `3px solid ${COLORS.accent}`,
                padding: 20,
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
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

              <p style={{ fontSize: 13, fontWeight: 500, color: COLORS.textSecondary, margin: 0 }}>
                {dept.description}
              </p>
              <p style={{ fontSize: 12, fontWeight: 600, color: COLORS.accent, margin: 0, marginTop: 4 }}>
                View →
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
