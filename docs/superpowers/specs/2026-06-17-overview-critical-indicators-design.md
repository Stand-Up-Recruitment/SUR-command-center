# Overview Page Critical Indicators

**Date:** 2026-06-17  
**Status:** Approved

## Context

The OverviewPage is a department picker — users land here and navigate to a specific department. Currently cards show only the department name and description. Users have no signal about how each department is performing without clicking into each one.

The goal is to surface a status badge (on-track / at-risk / off-track) and the single most important KPI per department directly on the overview cards, so users can triage at a glance.

## Design

Each department card gains two new elements:

1. **StatusBadge** — existing `StatusBadge` component placed in the top-right of the card header row (replaces empty space next to dept name)
2. **Hero KPI** — a small label + value line below the dept name, above the description

### Card layout (after)

```
[DEPT NAME (accent)]         [● On Track]
3 Placements                 ← hero KPI
Placements, fill rate & ...  ← existing description
View →                       ← existing link
```

### Hero KPIs and status thresholds

| Department | Hero KPI | On Track | At Risk | Off Track |
|------------|----------|----------|---------|-----------|
| Marketing  | Qual. leads (candidates + clients) | ≥ 25 | ≥ 13 | < 13 |
| Sales      | Calls-to-close rate (%) | ≥ 40% | ≥ 20% | < 20% |
| Recruitment | Placements | ≥ 2 | ≥ 1 | 0 |
| Revenue    | Revenue collected ($) | ≥ $16k | ≥ $8k | < $8k |
| Finance    | Net profit FY ($) | — (no status) | — | — |
| Retention  | Replacement rate (%) | < 5% | < 10% | ≥ 10% |

Finance uses a different design language on its own page (progress bar vs milestone), so no status badge is shown — only the hero KPI value.

### Loading state

While data is fetching, the hero KPI value renders as a short skeleton element. The StatusBadge renders greyed out / `no-data` state.

## Data Flow

- `OverviewPage` calls all 6 existing department fetch functions (`fetchMarketingKPIs`, `fetchSalesKPIs`, `fetchRecruitmentKPIs`, `fetchRevenueKPIs`, `fetchFinanceKPIs`, `fetchRetentionKPIs`) via 6 `useAirtable` hook calls at the top of the component.
- All 6 fetches run in parallel (independent hooks, no waterfall).
- Status thresholds are defined inline in `OverviewPage` — same values as in each department card, no new shared utility needed.
- The `useAirtable` hook already supports mock-data fallback on error, so the overview degrades gracefully if Airtable is unavailable.

## Files to Modify

- `src/pages/OverviewPage.tsx` — all changes live here

## Files Referenced (read-only)

- `src/services/airtable.ts` — import existing fetch functions
- `src/hooks/useAirtable.ts` — import hook
- `src/components/shared/StatusBadge.tsx` — import component
- `src/styles/tokens.ts` — already imported

## Verification

1. Run the dev server and navigate to the overview page (`/`)
2. Each card should show a StatusBadge (except Finance) and a hero KPI value
3. While loading: skeleton placeholder visible in KPI slot, status badge in no-data state
4. After load: real values and coloured status badges appear
5. Finance card shows net profit value with no status badge
6. Clicking any card still navigates correctly to the department page
