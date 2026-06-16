# Retention Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Retention screen at `/retention` — replacing the current placeholder with a live card showing 5 KPIs (active placements in guarantee window, past guarantee, replacements triggered, replacement rate %, replacements in progress) each with a week-on-week movement badge.

**Architecture:** Data is fetched from the Placements table in Airtable (`CLIENTS_BASE_ID`), computed entirely in the browser from raw records. `RetentionCard` follows the exact same pattern as `RecruiterCard` — `useAirtable` hook, skeleton loader, WoW badges, status badge.

**Tech Stack:** React 18, TypeScript, Vite, inline styles + `COLORS`/`CARD_STYLE` tokens, `WoWBadge`, `StatusBadge`, `Skeleton` shared components, `useAirtable` hook.

## Global Constraints

- No new dependencies — use only what's already in the project.
- All styles are inline — no CSS files, no Tailwind classes beyond `animate-pulse` on `Skeleton`.
- Import paths use relative `../../` prefix from `src/components/departments/`.
- The Status field in the Placements table has a BOM character prefix (`﻿`). Resolve it with `Object.keys(record).find(k => k.includes('Status'))`.
- `CLIENTS_BASE_ID` = `import.meta.env.VITE_AIRTABLE_CLIENTS_BASE_ID` (already defined at top of `airtable.ts`).
- `PLACEMENTS_TABLE_ID = 'tblvttoRo4DuZAIeW'` (already defined in `airtable.ts`).
- Falls back to `MOCK_RETENTION` automatically when credentials are absent — same pattern as every other card.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/index.ts` | Modify | Add `RetentionKPIs` interface |
| `src/services/airtable.ts` | Modify | Add `fetchRetentionKPIs()` + `MOCK_RETENTION` |
| `src/components/departments/RetentionCard.tsx` | Create | Card UI with skeleton, hero metric, 4 stat tiles |
| `src/pages/RetentionPage.tsx` | Modify | Swap `PlaceholderCard` → `RetentionCard` |

---

### Task 1: Add `RetentionKPIs` type

**Files:**
- Modify: `src/types/index.ts` — append after the `RevenueKPIs` block (~line 106)

**Interfaces:**
- Produces: `RetentionKPIs` — consumed by Tasks 2 and 3

- [ ] **Step 1: Add the interface**

Open `src/types/index.ts`. After the closing `}` of `RevenueKPIs` (around line 106), append:

```ts
// ─── Retention ────────────────────────────────────────────────────────────────
export interface RetentionKPIs {
  activeInWindow: number;
  prevActiveInWindow: number;

  pastWindow: number;
  prevPastWindow: number;

  replacementsThisMonth: number;
  replacementsThisWeek: number;
  replacementsPrevWeek: number;

  replacementRate: number;
  prevReplacementRate: number;

  inProgress: number;
  inProgressThisWeek: number;
  inProgressPrevWeek: number;
}
```

- [ ] **Step 2: Verify TypeScript accepts it**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(retention): add RetentionKPIs type"
```

---

### Task 2: Add `fetchRetentionKPIs` and `MOCK_RETENTION`

**Files:**
- Modify: `src/services/airtable.ts`

**Interfaces:**
- Consumes: `RetentionKPIs` from `../types`
- Consumes: `fetchAllFromBase`, `PLACEMENTS_TABLE_ID`, `CLIENTS_BASE_ID` — already defined in this file
- Produces: `fetchRetentionKPIs(): Promise<RetentionKPIs>`, `MOCK_RETENTION: RetentionKPIs`

- [ ] **Step 1: Add `RetentionKPIs` to the import at the top of `airtable.ts`**

The existing import (lines 1–12) currently reads:
```ts
import type {
  AirtableResponse,
  SalesKPIs,
  RecruiterKPIs,
  RecruiterStat,
  MarketingKPIs,
  RevenueKPIs,
  LeadMetric,
  ChannelRow,
  TimeFrame,
  AusPlacement,
} from '../types';
```

Add `RetentionKPIs` to that list:
```ts
import type {
  AirtableResponse,
  SalesKPIs,
  RecruiterKPIs,
  RecruiterStat,
  MarketingKPIs,
  RevenueKPIs,
  LeadMetric,
  ChannelRow,
  TimeFrame,
  AusPlacement,
  RetentionKPIs,
} from '../types';
```

- [ ] **Step 2: Add `fetchRetentionKPIs` after the `fetchAusPlacements` function**

Append the following after the closing `}` of `fetchAusPlacements` (around line 498), before the `// ─── Mock data` comment:

```ts
// ─── Retention ───────────────────────────────────────────────────────────────
type RetentionPlacementFields = {
  'Candidate Start Date'?: string;
  'Replacement Guarantee End Date'?: string;
  'Cancellation Date'?: string;
  'Created Date'?: string;
  [key: string]: unknown;
};

export async function fetchRetentionKPIs(): Promise<RetentionKPIs> {
  if (!CLIENTS_BASE_ID) throw new Error('Retention credentials not configured');

  const today = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = today - sevenDaysMs;
  const fourteenDaysAgo = today - 2 * sevenDaysMs;

  const d = new Date();
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();

  const records = await fetchAllFromBase<RetentionPlacementFields>(
    CLIENTS_BASE_ID,
    PLACEMENTS_TABLE_ID,
    {}
  );

  // Resolve BOM-prefixed Status field name
  const statusKey = records.length > 0
    ? (Object.keys(records[0]).find(k => k.includes('Status')) ?? '')
    : '';

  const getStatus = (f: RetentionPlacementFields): string =>
    (f[statusKey] as string | undefined) ?? '';

  // ── Metric 1: Active in guarantee window ─────────────────────────────────
  const activeInWindow = records.filter(f => {
    const start = f['Candidate Start Date'] ? new Date(f['Candidate Start Date']).getTime() : null;
    const end = f['Replacement Guarantee End Date'] ? new Date(f['Replacement Guarantee End Date']).getTime() : null;
    return start !== null && end !== null && start <= today && end >= today && getStatus(f) !== 'End';
  }).length;

  const prevActiveInWindow = records.filter(f => {
    const start = f['Candidate Start Date'] ? new Date(f['Candidate Start Date']).getTime() : null;
    const end = f['Replacement Guarantee End Date'] ? new Date(f['Replacement Guarantee End Date']).getTime() : null;
    return start !== null && end !== null && start <= sevenDaysAgo && end >= sevenDaysAgo && getStatus(f) !== 'End';
  }).length;

  // ── Metric 2: Past guarantee window ──────────────────────────────────────
  const pastWindow = records.filter(f => {
    const end = f['Replacement Guarantee End Date'] ? new Date(f['Replacement Guarantee End Date']).getTime() : null;
    return end !== null && end < today;
  }).length;

  const prevPastWindow = records.filter(f => {
    const end = f['Replacement Guarantee End Date'] ? new Date(f['Replacement Guarantee End Date']).getTime() : null;
    return end !== null && end < sevenDaysAgo;
  }).length;

  // ── Metric 3: Replacements triggered ─────────────────────────────────────
  const isTriggered = (f: RetentionPlacementFields) =>
    getStatus(f) === 'End' && Boolean(f['Cancellation Date']);

  const replacementsThisMonth = records.filter(f => {
    if (!isTriggered(f)) return false;
    const t = new Date(f['Cancellation Date']!).getTime();
    return t >= monthStart && t <= today;
  }).length;

  const replacementsThisWeek = records.filter(f => {
    if (!isTriggered(f)) return false;
    const t = new Date(f['Cancellation Date']!).getTime();
    return t >= sevenDaysAgo && t <= today;
  }).length;

  const replacementsPrevWeek = records.filter(f => {
    if (!isTriggered(f)) return false;
    const t = new Date(f['Cancellation Date']!).getTime();
    return t >= fourteenDaysAgo && t < sevenDaysAgo;
  }).length;

  // ── Metric 4: Replacement rate % (all-time) ───────────────────────────────
  const totalPlacements = records.length;
  const totalTriggered = records.filter(isTriggered).length;
  const replacementRate = totalPlacements > 0
    ? Math.round((totalTriggered / totalPlacements) * 1000) / 10
    : 0;

  const placementsBefore7d = records.filter(f => {
    const created = f['Created Date'] ? new Date(f['Created Date']).getTime() : 0;
    return created < sevenDaysAgo;
  });
  const triggeredBefore7d = placementsBefore7d.filter(f =>
    isTriggered(f) && new Date(f['Cancellation Date']!).getTime() < sevenDaysAgo
  ).length;
  const prevReplacementRate = placementsBefore7d.length > 0
    ? Math.round((triggeredBefore7d / placementsBefore7d.length) * 1000) / 10
    : 0;

  // ── Metric 5: Replacements in progress (Status = "Replacement") ───────────
  const inProgress = records.filter(f => getStatus(f) === 'Replacement').length;

  const inProgressThisWeek = records.filter(f => {
    if (getStatus(f) !== 'Replacement') return false;
    const created = f['Created Date'] ? new Date(f['Created Date']).getTime() : 0;
    return created >= sevenDaysAgo && created <= today;
  }).length;

  const inProgressPrevWeek = records.filter(f => {
    if (getStatus(f) !== 'Replacement') return false;
    const created = f['Created Date'] ? new Date(f['Created Date']).getTime() : 0;
    return created >= fourteenDaysAgo && created < sevenDaysAgo;
  }).length;

  return {
    activeInWindow, prevActiveInWindow,
    pastWindow, prevPastWindow,
    replacementsThisMonth, replacementsThisWeek, replacementsPrevWeek,
    replacementRate, prevReplacementRate,
    inProgress, inProgressThisWeek, inProgressPrevWeek,
  };
}
```

- [ ] **Step 3: Add `MOCK_RETENTION` to the mock data section**

In the `// ─── Mock data` section (after line 500), append at the end of the file:

```ts
export const MOCK_RETENTION: RetentionKPIs = {
  activeInWindow: 12,      prevActiveInWindow: 11,
  pastWindow: 34,          prevPastWindow: 32,
  replacementsThisMonth: 2,
  replacementsThisWeek: 1, replacementsPrevWeek: 1,
  replacementRate: 3.2,    prevReplacementRate: 3.1,
  inProgress: 1,
  inProgressThisWeek: 1,   inProgressPrevWeek: 0,
};
```

- [ ] **Step 4: Verify TypeScript accepts it**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/services/airtable.ts
git commit -m "feat(retention): add fetchRetentionKPIs and MOCK_RETENTION"
```

---

### Task 3: Create `RetentionCard` component

**Files:**
- Create: `src/components/departments/RetentionCard.tsx`

**Interfaces:**
- Consumes: `fetchRetentionKPIs`, `MOCK_RETENTION` from `../../services/airtable`
- Consumes: `RetentionKPIs`, `DepartmentStatus` from `../../types`
- Consumes: `useAirtable` from `../../hooks/useAirtable`
- Consumes: `WoWBadge`, `StatusBadge`, `Skeleton` from `../shared/`
- Consumes: `COLORS`, `CARD_STYLE` from `../../styles/tokens`

- [ ] **Step 1: Create the file**

Create `src/components/departments/RetentionCard.tsx` with this exact content:

```tsx
import { useCallback } from 'react';
import { StatusBadge } from '../shared/StatusBadge';
import { WoWBadge } from '../shared/WoWBadge';
import { Skeleton } from '../shared/Skeleton';
import { useAirtable } from '../../hooks/useAirtable';
import { fetchRetentionKPIs, MOCK_RETENTION } from '../../services/airtable';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import type { DepartmentStatus } from '../../types';

const hasRetentionCredentials =
  Boolean(import.meta.env.VITE_AIRTABLE_API_KEY) &&
  Boolean(import.meta.env.VITE_AIRTABLE_CLIENTS_BASE_ID);

function RetentionSkeleton() {
  const tile = (i: number) => (
    <div
      key={i}
      style={{
        background: COLORS.bgSubtle,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: '14px 16px',
      }}
    >
      <Skeleton height={10} width={80} style={{ marginBottom: 10 }} />
      <Skeleton height={22} width={60} style={{ marginBottom: 8 }} />
      <Skeleton height={10} width={50} />
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton height={22} width={120} />
          <Skeleton height={13} width={160} />
        </div>
        <Skeleton height={28} width={80} radius={8} />
      </div>
      <div style={{ ...CARD_STYLE, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton height={11} width={140} />
        <Skeleton height={44} width={80} radius={4} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[0, 1, 2, 3].map(tile)}
        </div>
      </div>
    </div>
  );
}

export function RetentionCard() {
  const fetcher = useCallback(() => fetchRetentionKPIs(), []);
  const { data, error } = useAirtable(fetcher, MOCK_RETENTION, hasRetentionCredentials);

  if (!data) return <RetentionSkeleton />;

  const status: DepartmentStatus =
    data.replacementRate < 5  ? 'on-track' :
    data.replacementRate < 10 ? 'at-risk'  : 'off-track';

  const statTile = (
    label: string,
    value: string | number,
    wowCurrent: number,
    wowPrev: number,
    invertDirection = false,
  ) => (
    <div
      style={{
        background: COLORS.bgSubtle,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: '14px 16px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: COLORS.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>{value}</div>
      <WoWBadge current={wowCurrent} prev={wowPrev} invertDirection={invertDirection} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: COLORS.textPrimary,
              letterSpacing: '-0.5px',
              margin: 0,
            }}
          >
            Retention
          </h2>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>
            Current state · Updates daily
          </p>
        </div>
        <StatusBadge status={error ? 'no-data' : status} />
      </div>

      <div style={{ ...CARD_STYLE, padding: 24 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: COLORS.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            marginBottom: 10,
          }}
        >
          Replacement Rate
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 20 }}>
          <span
            style={{
              fontSize: 44,
              fontWeight: 900,
              color: COLORS.textPrimary,
              letterSpacing: '-2px',
              lineHeight: 1,
            }}
          >
            {data.replacementRate}%
          </span>
          <WoWBadge
            current={data.replacementRate}
            prev={data.prevReplacementRate}
            invertDirection
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {statTile(
            'Active in Window',
            data.activeInWindow,
            data.activeInWindow,
            data.prevActiveInWindow,
          )}
          {statTile(
            'Past Guarantee',
            data.pastWindow,
            data.pastWindow,
            data.prevPastWindow,
          )}
          {statTile(
            'Triggered (mo.)',
            data.replacementsThisMonth,
            data.replacementsThisWeek,
            data.replacementsPrevWeek,
            true,
          )}
          {statTile(
            'In Progress',
            data.inProgress,
            data.inProgressThisWeek,
            data.inProgressPrevWeek,
          )}
        </div>
      </div>

      {error && (
        <p style={{ color: COLORS.warning, fontSize: 12, margin: 0 }}>
          ⚠ Connection error — {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript accepts it**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/departments/RetentionCard.tsx
git commit -m "feat(retention): add RetentionCard component with skeleton"
```

---

### Task 4: Wire up RetentionPage

**Files:**
- Modify: `src/pages/RetentionPage.tsx`

**Interfaces:**
- Consumes: `RetentionCard` from `../components/departments/RetentionCard`

- [ ] **Step 1: Replace the file content**

Replace the entire contents of `src/pages/RetentionPage.tsx` with:

```tsx
import { RetentionCard } from '../components/departments/RetentionCard';

export function RetentionPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
      <RetentionCard />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript and build pass**

```bash
npx tsc --noEmit && npm run build
```

Expected: no TypeScript errors, build completes successfully (output in `dist/`).

- [ ] **Step 3: Run the dev server and verify visually**

```bash
npm run dev
```

Open `http://localhost:5173/retention`. Verify:
- Skeleton flashes briefly then card renders (in demo mode, instantly)
- Hero number shows `3.2%` with a green/red WoW badge
- 4 stat tiles below: Active in Window (12), Past Guarantee (34), Triggered (mo.) (2), In Progress (1)
- All 4 tiles have WoW badges
- Status badge shows `on-track` (green) since 3.2% < 5%

- [ ] **Step 4: Commit**

```bash
git add src/pages/RetentionPage.tsx
git commit -m "feat(retention): wire RetentionPage to RetentionCard"
```
