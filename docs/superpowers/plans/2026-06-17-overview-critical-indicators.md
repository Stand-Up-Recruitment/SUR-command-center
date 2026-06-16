# Overview Critical Indicators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display a status badge (on-track / at-risk / off-track) and a single hero KPI value on each department card in the OverviewPage.

**Architecture:** `OverviewPage.tsx` calls all 6 existing department fetch functions via the existing `useAirtable` hook (parallel, independent). Status thresholds and hero KPI formatting live inline in the component. Only `OverviewPage.tsx` is modified.

**Tech Stack:** React, TypeScript, Vite, `useAirtable` hook, `StatusBadge` component, `Skeleton` component.

## Global Constraints

- Modify only `src/pages/OverviewPage.tsx` — no other files.
- Follow existing inline-style pattern (no CSS classes or new styled components).
- Reuse `MOCK_*` exports from `src/services/airtable.ts` as fallback data so cards render without credentials.
- Finance card shows hero KPI but no status badge (Finance uses a different status model on its own page).
- Status thresholds must match those used in the department card components exactly.

---

### Task 1: Replace OverviewPage.tsx with indicator-aware implementation

**Files:**
- Modify: `src/pages/OverviewPage.tsx`

**Interfaces:**
- Consumes:
  - `fetchMarketingKPIs(): Promise<MarketingKPIs>` from `src/services/airtable.ts`
  - `fetchSalesKPIs(): Promise<SalesKPIs>` from `src/services/airtable.ts`
  - `fetchRecruiterKPIs(): Promise<RecruiterKPIs>` from `src/services/airtable.ts`
  - `fetchRevenueKPIs(): Promise<RevenueKPIs>` from `src/services/airtable.ts`
  - `fetchRetentionKPIs(): Promise<RetentionKPIs>` from `src/services/airtable.ts`
  - `fetchXeroFinanceData(): Promise<XeroFinanceData>` from `src/services/xero.ts`
  - `MOCK_MARKETING, MOCK_SALES, MOCK_RECRUITER, MOCK_REVENUE, MOCK_RETENTION` from `src/services/airtable.ts`
  - `hasXeroCredentials: boolean` from `src/services/xero.ts`
  - `useAirtable<T>(fetcher, mockData?, credentialsReady?): { data: T | null, loading: boolean }` from `src/hooks/useAirtable.ts`
  - `StatusBadge({ status: DepartmentStatus })` from `src/components/shared/StatusBadge.tsx`
  - `Skeleton({ height, width, radius? })` from `src/components/shared/Skeleton.tsx`
  - `DepartmentStatus = 'on-track' | 'at-risk' | 'off-track' | 'no-data'` from `src/types/index.ts`

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/pages/OverviewPage.tsx` with the following:

```tsx
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

const hasMarketingCredentials  = hasAirtableKey && hasClientsBase && hasCandidatesBase && Boolean(import.meta.env.VITE_META_ADS_TOKEN);
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
```

- [ ] **Step 2: Check for TypeScript errors**

Run: `npx tsc --noEmit`

Expected: no errors. If you see a type error on the `Skeleton` `radius` prop, check `src/components/shared/Skeleton.tsx` — the prop may be named `borderRadius` instead of `radius`. Adjust accordingly.

- [ ] **Step 3: Start the dev server and verify**

Run: `npm run dev`

Open `http://localhost:5173` (or the port shown). Verify:

1. All 6 department cards load with a hero KPI value and (for 5 of them) a status badge.
2. Marketing, Sales, Recruitment, Revenue, Retention each show a coloured status badge (On Track / At Risk / Off Track) matching their mock data values.
3. Finance shows the hero KPI (net profit) but **no status badge**.
4. While loading (briefly on first paint with credentials configured), the badge and KPI slots show grey skeleton placeholders.
5. Clicking any card navigates to the correct department page.

- [ ] **Step 4: Commit**

```bash
git add src/pages/OverviewPage.tsx
git commit -m "feat(overview): add status badge and hero KPI to each department card"
```

---

## Verification Checklist

- [ ] Each of the 6 department cards shows a hero KPI value
- [ ] 5 cards (all except Finance) show a status badge
- [ ] Status badge colours match: green = On Track, amber = At Risk, red = Off Track, grey = No Data
- [ ] Finance card shows net profit value, no badge
- [ ] Loading skeletons appear in badge/KPI slots while fetching
- [ ] Navigating to any department page still works correctly
- [ ] `npx tsc --noEmit` exits with 0 errors
