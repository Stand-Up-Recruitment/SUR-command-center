# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the SUR Command Center from a dark sidebar layout to a clean light-mode design with horizontal top-tab navigation and emerald green accent.

**Architecture:** Add a shared `tokens.ts` file as the single source of truth for all colours, then update components top-down (shared → layout → department cards → pages). Each task leaves the app in a running state.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, react-router-dom v6.

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Create | `src/styles/tokens.ts` | All design token constants |
| Create | `src/components/shared/WoWBadge.tsx` | Shared WoW pill badge |
| Modify | `src/index.css` | Body background + scrollbar colours |
| Modify | `src/App.tsx` | Remove Sidebar, set light bg, remove main padding |
| Modify | `src/components/layout/Header.tsx` | Top-tab nav, white/emerald theme |
| Modify | `src/components/shared/StatusBadge.tsx` | Light-mode colour values |
| Modify | `src/components/shared/KPIMetric.tsx` | Stat-card box style, `valueColor` prop rename |
| Modify | `src/components/shared/MiniSparkline.tsx` | Light-mode tooltip style |
| Modify | `src/components/departments/MarketingCard.tsx` | Full light-mode rewrite |
| Modify | `src/pages/MarketingPage.tsx` | 900px centred container |
| Modify | `src/components/departments/SalesCard.tsx` | Hero layout + light-mode |
| Modify | `src/pages/SalesPage.tsx` | 900px centred container |
| Modify | `src/components/shared/RecruiterTable.tsx` | Light-mode colours |
| Modify | `src/components/departments/RecruiterCard.tsx` | Hero layout + light-mode |
| Modify | `src/pages/RecruitmentPage.tsx` | 900px centred container |
| Modify | `src/components/departments/PlaceholderCard.tsx` | Light-mode |
| Modify | `src/pages/FinancePage.tsx` | 900px centred container |
| Modify | `src/pages/RetentionPage.tsx` | 900px centred container |
| Modify | `src/pages/OverviewPage.tsx` | 5-tile grid, emerald borders |
| Delete | `src/components/layout/Sidebar.tsx` | Replaced by Header tabs |

---

## Task 1: Design Tokens

**Files:**
- Create: `src/styles/tokens.ts`

- [ ] **Step 1: Create the tokens file**

```ts
// src/styles/tokens.ts
export const COLORS = {
  bgPage:        '#f1f5f9',
  bgCard:        '#ffffff',
  bgSubtle:      '#f8fafc',
  border:        '#e2e8f0',
  borderSubtle:  '#f1f5f9',
  textPrimary:   '#0f172a',
  textSecondary: '#64748b',
  textMuted:     '#94a3b8',
  accent:        '#059669',
  accentBg:      '#f0fdf4',
  accentBorder:  '#bbf7d0',
  success:       '#16a34a',
  successBg:     '#dcfce7',
  warning:       '#d97706',
  warningBg:     '#fef3c7',
  danger:        '#dc2626',
  dangerBg:      '#fee2e2',
} as const;

export const CARD_STYLE: React.CSSProperties = {
  background:   COLORS.bgCard,
  border:       `1px solid ${COLORS.border}`,
  borderRadius: 12,
  boxShadow:    '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/tokens.ts
git commit -m "feat: add design tokens for light-mode redesign"
```

---

## Task 2: Base Styles

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Update body and scrollbar to light theme**

Replace the entire file with:

```css
@import "tailwindcss";

body {
  background-color: #f1f5f9;
  color: #0f172a;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  margin: 0;
  min-height: 100vh;
}

* {
  box-sizing: border-box;
}

#root {
  min-height: 100vh;
}

::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: #f1f5f9;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/index.css
git commit -m "feat: switch base styles to light theme"
```

---

## Task 3: App Shell

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Remove Sidebar, update outer background, remove main padding**

Replace `src/App.tsx` with:

```tsx
import { useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { OverviewPage } from './pages/OverviewPage';
import { MarketingPage } from './pages/MarketingPage';
import { SalesPage } from './pages/SalesPage';
import { RecruitmentPage } from './pages/RecruitmentPage';
import { FinancePage } from './pages/FinancePage';
import { RetentionPage } from './pages/RetentionPage';

const IS_DEMO =
  !import.meta.env.VITE_AIRTABLE_API_KEY ||
  !import.meta.env.VITE_AIRTABLE_BASE_ID;

export default function App() {
  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header onRefresh={handleRefresh} isDemo={IS_DEMO} />
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <Routes>
          <Route path="/"            element={<OverviewPage />} />
          <Route path="/marketing"   element={<MarketingPage />} />
          <Route path="/sales"       element={<SalesPage />} />
          <Route path="/recruitment" element={<RecruitmentPage />} />
          <Route path="/finance"     element={<FinancePage />} />
          <Route path="/retention"   element={<RetentionPage />} />
        </Routes>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify dev server still starts**

Run: `npm run dev`  
Expected: app loads (sidebar gone, dark background may show briefly until Header/cards updated)

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: remove sidebar from app shell, prep for top-tab nav"
```

---

## Task 4: Header — Top Tab Navigation

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Rewrite Header with top tabs and light theme**

Replace `src/components/layout/Header.tsx` with:

```tsx
import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { COLORS } from '../../styles/tokens';

const TABS = [
  { label: 'Overview',    to: '/',            end: true  },
  { label: 'Marketing',   to: '/marketing'              },
  { label: 'Sales',       to: '/sales'                  },
  { label: 'Recruitment', to: '/recruitment'            },
  { label: 'Finance',     to: '/finance',   comingSoon: true },
  { label: 'Retention',   to: '/retention', comingSoon: true },
] as const;

interface HeaderProps {
  onRefresh: () => void;
  isDemo: boolean;
}

export function Header({ onRefresh, isDemo }: HeaderProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const timeStr = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <header
      style={{
        background:    'white',
        borderBottom:  `1px solid ${COLORS.border}`,
        boxShadow:     '0 1px 3px rgba(0,0,0,0.06)',
        height:        56,
        display:       'flex',
        alignItems:    'stretch',
        padding:       '0 28px',
        position:      'sticky',
        top:           0,
        zIndex:        10,
        flexShrink:    0,
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 32 }}>
        <div
          style={{
            width: 28, height: 28,
            background: COLORS.accent,
            borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, lineHeight: 1 }}>
            Stand Up Recruitment
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
            Command Center
          </div>
        </div>
      </div>

      {/* Tabs */}
      <nav style={{ display: 'flex', alignItems: 'stretch', flex: 1, gap: 2 }}>
        {TABS.map((tab) =>
          'comingSoon' in tab && tab.comingSoon ? (
            <span
              key={tab.to}
              style={{
                display: 'flex', alignItems: 'center',
                padding: '0 16px',
                fontSize: 13, fontWeight: 500,
                color: '#cbd5e1',
                whiteSpace: 'nowrap',
                borderBottom: '2px solid transparent',
              }}
            >
              {tab.label}
            </span>
          ) : (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={'end' in tab ? tab.end : undefined}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center',
                padding: '0 16px',
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? COLORS.accent : COLORS.textSecondary,
                borderBottom: `2px solid ${isActive ? COLORS.accent : 'transparent'}`,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s',
              })}
            >
              {tab.label}
            </NavLink>
          )
        )}
      </nav>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
        {isDemo && (
          <span
            style={{
              background: COLORS.warningBg,
              border: '1px solid #fcd34d',
              color: COLORS.warning,
              fontSize: 11, fontWeight: 600,
              padding: '4px 10px', borderRadius: 20,
            }}
          >
            Demo Mode
          </span>
        )}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, lineHeight: 1 }}>
            {timeStr}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
            {dateStr}
          </div>
        </div>
        <button
          onClick={onRefresh}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: COLORS.accentBg,
            border: `1px solid ${COLORS.accentBorder}`,
            color: COLORS.accent,
            fontSize: 12, fontWeight: 600,
            padding: '6px 12px', borderRadius: 7,
            cursor: 'pointer',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Refresh
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify tabs render and active state works**

Run: `npm run dev`, open the app, click between tabs.  
Expected: white header, emerald active tab underline, coming-soon tabs in light grey.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: replace dark sidebar header with light top-tab navigation"
```

---

## Task 5: WoWBadge Shared Component

**Files:**
- Create: `src/components/shared/WoWBadge.tsx`

- [ ] **Step 1: Create WoWBadge**

```tsx
// src/components/shared/WoWBadge.tsx
import { COLORS } from '../../styles/tokens';

interface WoWBadgeProps {
  current: number;
  prev: number;
  /** true = lower is better (e.g. cost). Inverts the green/red direction. */
  invertDirection?: boolean;
  /** true = amber/neutral colouring regardless of direction (e.g. spend). */
  neutral?: boolean;
}

export function WoWBadge({
  current,
  prev,
  invertDirection = false,
  neutral = false,
}: WoWBadgeProps) {
  if (prev === 0) return null;
  const pct = Math.round(((current - prev) / prev) * 100);
  const isUp = pct >= 0;
  const isGood = invertDirection ? !isUp : isUp;

  const bg    = neutral ? COLORS.warningBg : isGood ? COLORS.successBg : COLORS.dangerBg;
  const color = neutral ? COLORS.warning   : isGood ? COLORS.success   : COLORS.danger;

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        fontSize: 11, fontWeight: 700,
        padding: '3px 8px', borderRadius: 20,
        background: bg, color,
        marginLeft: 8,
      }}
    >
      {isUp ? '↑' : '↓'}{Math.abs(pct)}%
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/WoWBadge.tsx
git commit -m "feat: add shared WoWBadge component"
```

---

## Task 6: StatusBadge — Light-Mode Colours

**Files:**
- Modify: `src/components/shared/StatusBadge.tsx`

- [ ] **Step 1: Replace dark semi-transparent colours with light-mode values**

Replace `src/components/shared/StatusBadge.tsx` with:

```tsx
import type { DepartmentStatus } from '../../types';
import { COLORS } from '../../styles/tokens';

const STATUS_CONFIG: Record<
  DepartmentStatus,
  { label: string; bg: string; border: string; text: string; dot: string }
> = {
  'on-track': {
    label: 'On Track',
    bg:     COLORS.accentBg,
    border: COLORS.accentBorder,
    text:   '#15803d',
    dot:    COLORS.success,
  },
  'at-risk': {
    label: 'At Risk',
    bg:     COLORS.warningBg,
    border: '#fcd34d',
    text:   COLORS.warning,
    dot:    COLORS.warning,
  },
  'off-track': {
    label: 'Off Track',
    bg:     COLORS.dangerBg,
    border: '#fca5a5',
    text:   COLORS.danger,
    dot:    COLORS.danger,
  },
  'no-data': {
    label: 'No Data',
    bg:     COLORS.bgSubtle,
    border: COLORS.border,
    text:   COLORS.textMuted,
    dot:    COLORS.textMuted,
  },
};

interface StatusBadgeProps {
  status: DepartmentStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.text,
        fontSize: 12, fontWeight: 600,
        padding: '5px 12px', borderRadius: 20,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6, height: 6,
          background: cfg.dot,
          borderRadius: '50%',
          display: 'inline-block',
        }}
      />
      {cfg.label}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/StatusBadge.tsx
git commit -m "feat: update StatusBadge to light-mode colours"
```

---

## Task 7: KPIMetric — Stat-Card Style

The current API uses `accentColor`, `trend`, `trendLabel`, `subValue`. This task changes it to `valueColor`, `trendText`, `trendColor` and adds the stat-card box style. SalesCard and RecruiterCard prop calls are updated in the same commit to keep the build clean.

**Files:**
- Modify: `src/components/shared/KPIMetric.tsx`
- Modify: `src/components/departments/SalesCard.tsx` (prop name fixes only)
- Modify: `src/components/departments/RecruiterCard.tsx` (prop name fixes only)

- [ ] **Step 1: Rewrite KPIMetric with stat-card box**

Replace `src/components/shared/KPIMetric.tsx` with:

```tsx
import { COLORS } from '../../styles/tokens';

interface KPIMetricProps {
  label: string;
  value: string | number;
  valueColor?: string;
  trendText?: string;
  trendColor?: string;
}

export function KPIMetric({
  label,
  value,
  valueColor = COLORS.textPrimary,
  trendText,
  trendColor = COLORS.textMuted,
}: KPIMetricProps) {
  return (
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
          fontSize: 10, fontWeight: 600,
          color: COLORS.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: valueColor }}>
        {value}
      </div>
      {trendText && (
        <div style={{ fontSize: 10, fontWeight: 600, color: trendColor, marginTop: 4 }}>
          {trendText}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Fix SalesCard prop names (minimal — full redesign in Task 10)**

In `src/components/departments/SalesCard.tsx`, update the four KPIMetric calls:

```tsx
// OLD:
<KPIMetric label="Revenue" value={fmt(data?.revenueThisMonth ?? 0)} accentColor={COLOR} />
<KPIMetric label="Pipeline" value={fmt(data?.pipelineValue ?? 0)} accentColor="#e2e8f0" />
<KPIMetric label="Win Rate" value={`${data?.winRate ?? 0}%`} accentColor={data?.winRate && data.winRate >= 60 ? '#10b981' : '#f59e0b'} />
<KPIMetric label="Active Deals" value={data?.activeDeals ?? 0} accentColor="#e2e8f0" />

// NEW:
<KPIMetric label="Revenue" value={fmt(data?.revenueThisMonth ?? 0)} valueColor={COLOR} />
<KPIMetric label="Pipeline" value={fmt(data?.pipelineValue ?? 0)} valueColor={COLORS.textPrimary} />
<KPIMetric label="Win Rate" value={`${data?.winRate ?? 0}%`} valueColor={data?.winRate && data.winRate >= 60 ? '#10b981' : '#f59e0b'} />
<KPIMetric label="Active Deals" value={data?.activeDeals ?? 0} valueColor={COLORS.textPrimary} />
```

Also add this import at the top of SalesCard:
```tsx
import { COLORS } from '../../styles/tokens';
```

- [ ] **Step 3: Fix RecruiterCard prop names**

In `src/components/departments/RecruiterCard.tsx`, update the four KPIMetric calls:

```tsx
// OLD:
<KPIMetric label="Active Jobs" value={data?.totalActiveJobs ?? 0} accentColor={COLOR} />
<KPIMetric label="Placements" value={data?.totalPlacements ?? 0} accentColor="#e2e8f0" subValue="this month" />
<KPIMetric label="Team Fill Rate" value={`${data?.fillRate ?? 0}%`} accentColor={...} />
<KPIMetric label="Avg Days to Fill" value={`${data?.avgDaysToFill ?? 0}d`} accentColor="#e2e8f0" />

// NEW:
<KPIMetric label="Active Jobs" value={data?.totalActiveJobs ?? 0} valueColor={COLOR} />
<KPIMetric label="Placements" value={data?.totalPlacements ?? 0} valueColor={COLORS.textPrimary} trendText="this month" />
<KPIMetric
  label="Team Fill Rate"
  value={`${data?.fillRate ?? 0}%`}
  valueColor={
    (data?.fillRate ?? 0) >= 70 ? '#10b981'
    : (data?.fillRate ?? 0) >= 50 ? '#f59e0b'
    : '#ef4444'
  }
/>
<KPIMetric label="Avg Days to Fill" value={`${data?.avgDaysToFill ?? 0}d`} valueColor={COLORS.textPrimary} />
```

Also add this import at the top of RecruiterCard:
```tsx
import { COLORS } from '../../styles/tokens';
```

- [ ] **Step 4: Run TypeScript check**

```bash
npm run build 2>&1 | head -30
```

Expected: no TypeScript errors related to KPIMetric props.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/KPIMetric.tsx src/components/departments/SalesCard.tsx src/components/departments/RecruiterCard.tsx
git commit -m "feat: update KPIMetric to stat-card style, fix callers"
```

---

## Task 8: MiniSparkline — Light-Mode Tooltip

**Files:**
- Modify: `src/components/shared/MiniSparkline.tsx`

- [ ] **Step 1: Update tooltip contentStyle to light theme**

In `src/components/shared/MiniSparkline.tsx`, change the Tooltip contentStyle:

```tsx
// OLD:
contentStyle={{
  background: '#1a1d27',
  border: '1px solid #2a2d3e',
  borderRadius: 6,
  fontSize: 12,
  color: '#e2e8f0',
}}

// NEW:
contentStyle={{
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  fontSize: 12,
  color: '#0f172a',
}}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/MiniSparkline.tsx
git commit -m "feat: update sparkline tooltip to light theme"
```

---

## Task 9: MarketingCard + MarketingPage

**Files:**
- Modify: `src/components/departments/MarketingCard.tsx`
- Modify: `src/pages/MarketingPage.tsx`

- [ ] **Step 1: Rewrite MarketingCard with light-mode three-card layout**

Replace `src/components/departments/MarketingCard.tsx` with:

```tsx
import { useCallback } from 'react';
import { StatusBadge } from '../shared/StatusBadge';
import { WoWBadge } from '../shared/WoWBadge';
import { useAirtable } from '../../hooks/useAirtable';
import { fetchMarketingKPIs, MOCK_MARKETING } from '../../services/airtable';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import type { DepartmentStatus } from '../../types';

function fmtCurrency(n: number) {
  return `$${n.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
}

const hasMarketingCredentials =
  Boolean(import.meta.env.VITE_AIRTABLE_API_KEY) &&
  Boolean(import.meta.env.VITE_AIRTABLE_CLIENTS_BASE_ID) &&
  Boolean(import.meta.env.VITE_AIRTABLE_CANDIDATES_BASE_ID) &&
  Boolean(import.meta.env.VITE_META_TOKEN);

export function MarketingCard() {
  const fetcher = useCallback(() => fetchMarketingKPIs(), []);
  const { data, loading, error } = useAirtable(fetcher, MOCK_MARKETING, hasMarketingCredentials);

  const qualCandidates = data?.candidates.qualified ?? 0;
  const qualClients    = data?.clients.qualified ?? 0;

  const status: DepartmentStatus = !data
    ? 'no-data'
    : qualCandidates >= 20 && qualClients >= 5
    ? 'on-track'
    : qualCandidates >= 10 || qualClients >= 3
    ? 'at-risk'
    : 'off-track';

  const spend = data?.spend.thisWeek ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>
            Marketing
          </h2>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>
            Week to date · Updates every 60s
          </p>
        </div>
        <StatusBadge status={error ? 'no-data' : status} />
      </div>

      {loading && !data ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div
            style={{
              width: 24, height: 24,
              border: `2px solid ${COLORS.accent}`,
              borderTopColor: 'transparent',
              borderRadius: '50%',
            }}
            className="animate-spin"
          />
        </div>
      ) : (
        <>
          {/* HERO CARD: Candidate + Client leads */}
          <div style={{ ...CARD_STYLE, padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 24 }}>
              {/* Candidate leads */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                  Candidate Leads
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 16 }}>
                  <span style={{ fontSize: 44, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-2px', lineHeight: 1 }}>
                    {data!.candidates.qualified}
                  </span>
                  <WoWBadge current={data!.candidates.qualified} prev={data!.candidates.prevQualified} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Qual Rate</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: data!.candidates.qualRate >= 50 ? COLORS.accent : COLORS.warning }}>
                      {data!.candidates.qualRate}%
                    </div>
                    <WoWBadge current={data!.candidates.qualRate} prev={data!.candidates.prevQualRate} />
                  </div>
                  <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Cost per Lead</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>
                      {spend > 0 && data!.candidates.qualified > 0 ? fmtCurrency(data!.candidates.cpl) : '—'}
                    </div>
                    {data!.candidates.prevCpl > 0 && data!.candidates.cpl > 0 && (
                      <WoWBadge current={data!.candidates.prevCpl} prev={data!.candidates.cpl} invertDirection />
                    )}
                  </div>
                </div>
              </div>

              {/* Column divider */}
              <div style={{ background: COLORS.borderSubtle }} />

              {/* Client leads */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                  Client Leads
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 16 }}>
                  <span style={{ fontSize: 32, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-1.5px', lineHeight: 1 }}>
                    {data!.clients.qualified}
                  </span>
                  <WoWBadge current={data!.clients.qualified} prev={data!.clients.prevQualified} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Qual Rate</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: data!.clients.qualRate >= 50 ? COLORS.accent : COLORS.warning }}>
                      {data!.clients.qualRate}%
                    </div>
                    <WoWBadge current={data!.clients.qualRate} prev={data!.clients.prevQualRate} />
                  </div>
                  <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Cost per Lead</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>
                      {spend > 0 && data!.clients.qualified > 0 ? fmtCurrency(data!.clients.cpl) : '—'}
                    </div>
                    {data!.clients.prevCpl > 0 && data!.clients.cpl > 0 && (
                      <WoWBadge current={data!.clients.prevCpl} prev={data!.clients.cpl} invertDirection />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CHANNEL BREAKDOWN CARD */}
          <div style={CARD_STYLE}>
            <div style={{ padding: '16px 20px 0' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Channel Breakdown
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Channel', 'Leads', 'Qual %', 'Cost per Qual. Lead'].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        fontSize: 10, fontWeight: 700, color: COLORS.textMuted,
                        textTransform: 'uppercase', letterSpacing: '0.07em',
                        padding: '10px 14px',
                        textAlign: i === 0 ? 'left' : 'right',
                        background: COLORS.bgSubtle,
                        borderBottom: `1px solid ${COLORS.border}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.channels ?? []).map((row, i) => (
                  <tr key={row.channel}>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: COLORS.textPrimary, borderBottom: i < (data?.channels.length ?? 0) - 1 ? `1px solid ${COLORS.borderSubtle}` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.cpl !== null ? COLORS.accent : COLORS.textMuted }} />
                        {row.channel}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: COLORS.textPrimary, textAlign: 'right', borderBottom: i < (data?.channels.length ?? 0) - 1 ? `1px solid ${COLORS.borderSubtle}` : 'none' }}>
                      {row.leads}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: row.qualRate >= 50 ? COLORS.accent : COLORS.warning, textAlign: 'right', borderBottom: i < (data?.channels.length ?? 0) - 1 ? `1px solid ${COLORS.borderSubtle}` : 'none' }}>
                      {row.leads > 0 ? `${row.qualRate}%` : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: row.cpl !== null ? COLORS.textPrimary : COLORS.textMuted, textAlign: 'right', borderBottom: i < (data?.channels.length ?? 0) - 1 ? `1px solid ${COLORS.borderSubtle}` : 'none' }}>
                      {row.cpl !== null && row.cpl > 0 ? fmtCurrency(row.cpl) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* AD SPEND CARD */}
          <div style={{ ...CARD_STYLE, padding: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
              Ad Spend
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              {/* This week */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>This Week</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 26, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-1px' }}>
                    {fmtCurrency(Math.round(spend))}
                  </span>
                  {data && <WoWBadge current={data.spend.thisWeek} prev={data.spend.prevWeek} neutral />}
                </div>
                <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 3 }}>
                  vs {fmtCurrency(Math.round(data?.spend.prevWeek ?? 0))} last week
                </div>
              </div>

              <div style={{ width: 1, background: COLORS.border, alignSelf: 'stretch' }} />

              {/* Weekly budget */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Weekly Budget</div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 26, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-1px' }}>
                    {data && data.weeklyBudget > 0 ? fmtCurrency(data.weeklyBudget) : '—'}
                  </span>
                  {data && data.weeklyBudget > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.accent }}>
                      {Math.round((spend / data.weeklyBudget) * 100)}% used
                    </span>
                  )}
                </div>
                {data && data.weeklyBudget > 0 && (
                  <>
                    <div style={{ background: COLORS.border, borderRadius: 3, height: 5, marginTop: 8, overflow: 'hidden' }}>
                      <div
                        style={{
                          background: COLORS.accent,
                          height: '100%',
                          borderRadius: 3,
                          width: `${Math.min(Math.round((spend / data.weeklyBudget) * 100), 100)}%`,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 6 }}>
                      {fmtCurrency(Math.max(0, Math.round(data.weeklyBudget - spend)))} remaining
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {error && (
        <p style={{ color: COLORS.warning, fontSize: 12, margin: 0 }}>
          ⚠ Using demo data — {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update MarketingPage container**

Replace `src/pages/MarketingPage.tsx` with:

```tsx
import { MarketingCard } from '../components/departments/MarketingCard';

export function MarketingPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
      <MarketingCard />
    </div>
  );
}
```

- [ ] **Step 3: Verify Marketing page renders correctly**

Run: `npm run dev`, navigate to `/marketing`.  
Expected: white cards, emerald accent, hero number visible, channel table present.

- [ ] **Step 4: Commit**

```bash
git add src/components/departments/MarketingCard.tsx src/pages/MarketingPage.tsx
git commit -m "feat: redesign MarketingCard to light theme with hero layout"
```

---

## Task 10: SalesCard + SalesPage

**Files:**
- Modify: `src/components/departments/SalesCard.tsx`
- Modify: `src/pages/SalesPage.tsx`

- [ ] **Step 1: Rewrite SalesCard with hero layout and light theme**

Replace `src/components/departments/SalesCard.tsx` with:

```tsx
import { useCallback } from 'react';
import { KPIMetric } from '../shared/KPIMetric';
import { MiniSparkline } from '../shared/MiniSparkline';
import { StatusBadge } from '../shared/StatusBadge';
import { WoWBadge } from '../shared/WoWBadge';
import { useAirtable } from '../../hooks/useAirtable';
import { fetchSalesKPIs, MOCK_SALES } from '../../services/airtable';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import type { DepartmentStatus } from '../../types';

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

export function SalesCard() {
  const fetcher = useCallback(() => fetchSalesKPIs(), []);
  const { data, loading, error } = useAirtable(fetcher, MOCK_SALES);

  const status: DepartmentStatus = !data
    ? 'no-data'
    : data.revenueThisMonth >= data.target
    ? 'on-track'
    : data.revenueThisMonth >= data.target * 0.8
    ? 'at-risk'
    : 'off-track';

  const progressPct = data
    ? Math.min(Math.round((data.revenueThisMonth / (data.target || 1)) * 100), 100)
    : 0;

  const sparkData = (data?.trend ?? []).map((t) => ({ label: t.month, value: t.revenue }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>
            Sales
          </h2>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>
            {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} · Updates every 60s
          </p>
        </div>
        <StatusBadge status={error ? 'no-data' : status} />
      </div>

      {loading && !data ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div
            style={{ width: 24, height: 24, border: `2px solid ${COLORS.accent}`, borderTopColor: 'transparent', borderRadius: '50%' }}
            className="animate-spin"
          />
        </div>
      ) : (
        <>
          {/* HERO CARD: Revenue this month */}
          <div style={{ ...CARD_STYLE, padding: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Revenue This Month
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 20 }}>
              <span style={{ fontSize: 44, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-2px', lineHeight: 1 }}>
                {fmt(data?.revenueThisMonth ?? 0)}
              </span>
            </div>

            {/* Stat grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
              <KPIMetric
                label="Monthly Target"
                value={fmt(data?.target ?? 0)}
                valueColor={COLORS.textSecondary}
              />
              <KPIMetric
                label="Pipeline Value"
                value={fmt(data?.pipelineValue ?? 0)}
                valueColor={COLORS.textPrimary}
              />
              <KPIMetric
                label="Active Deals"
                value={data?.activeDeals ?? 0}
                valueColor={COLORS.textPrimary}
              />
              <KPIMetric
                label="Win Rate"
                value={`${data?.winRate ?? 0}%`}
                valueColor={data?.winRate && data.winRate >= 60 ? COLORS.accent : COLORS.warning}
              />
            </div>

            {/* Progress bar toward target */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Target Progress
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: progressPct >= 100 ? COLORS.accent : COLORS.textSecondary }}>
                  {progressPct}%
                </span>
              </div>
              <div style={{ background: COLORS.border, borderRadius: 3, height: 5, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${progressPct}%`,
                    background: progressPct >= 100 ? COLORS.accent : progressPct >= 80 ? COLORS.accent : COLORS.warning,
                    height: '100%',
                    borderRadius: 3,
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
            </div>
          </div>

          {/* SPARKLINE CARD */}
          {sparkData.length > 0 && (
            <div style={{ ...CARD_STYLE, padding: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                6-Month Revenue Trend
              </div>
              <MiniSparkline data={sparkData} color={COLORS.accent} valuePrefix="$" />
            </div>
          )}
        </>
      )}

      {error && (
        <p style={{ color: COLORS.warning, fontSize: 12, margin: 0 }}>
          ⚠ Using demo data — {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update SalesPage container**

Replace `src/pages/SalesPage.tsx` with:

```tsx
import { SalesCard } from '../components/departments/SalesCard';

export function SalesPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
      <SalesCard />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/departments/SalesCard.tsx src/pages/SalesPage.tsx
git commit -m "feat: redesign SalesCard to light theme with hero layout"
```

---

## Task 11: RecruiterTable — Light-Mode

**Files:**
- Modify: `src/components/shared/RecruiterTable.tsx`

- [ ] **Step 1: Update RecruiterTable to light theme colours**

Replace `src/components/shared/RecruiterTable.tsx` with:

```tsx
import { COLORS } from '../../styles/tokens';
import type { RecruiterStat } from '../../types';

interface RecruiterTableProps {
  recruiters: RecruiterStat[];
}

function FillBar({ pct }: { pct: number }) {
  const color = pct >= 70 ? COLORS.accent : pct >= 50 ? COLORS.warning : COLORS.danger;
  return (
    <div style={{ background: COLORS.border, borderRadius: 3, height: 5, width: '100%', overflow: 'hidden' }}>
      <div
        style={{ width: `${Math.min(pct, 100)}%`, background: color, height: '100%', borderRadius: 3, transition: 'width 0.5s' }}
      />
    </div>
  );
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

const AVATAR_COLORS = [COLORS.accent, '#3b82f6', COLORS.warning, '#8b5cf6'];

export function RecruiterTable({ recruiters }: RecruiterTableProps) {
  if (recruiters.length === 0) {
    return (
      <p style={{ color: COLORS.textMuted, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
        No recruiter data this month.
      </p>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Table header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto auto auto',
          gap: '0 12px',
          fontSize: 10, fontWeight: 700, color: COLORS.textMuted,
          textTransform: 'uppercase', letterSpacing: '0.07em',
          padding: '10px 0',
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.bgSubtle,
        }}
      >
        <span style={{ paddingLeft: 14 }}>Recruiter</span>
        <span style={{ textAlign: 'right', width: 48, paddingRight: 14 }}>Jobs</span>
        <span style={{ textAlign: 'right', width: 56, paddingRight: 14 }}>Placed</span>
        <span style={{ textAlign: 'right', width: 72, paddingRight: 14 }}>Fill Rate</span>
        <span style={{ textAlign: 'right', width: 64, paddingRight: 14 }}>Avg Days</span>
      </div>

      {/* Rows */}
      {recruiters.map((r, i) => (
        <div
          key={r.name}
          style={{
            borderBottom: i < recruiters.length - 1 ? `1px solid ${COLORS.borderSubtle}` : 'none',
            padding: '10px 0',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '0 12px', alignItems: 'center' }}>
            {/* Name + avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 14 }}>
              <div
                style={{
                  width: 28, height: 28,
                  borderRadius: '50%',
                  background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: 'white',
                  flexShrink: 0,
                }}
              >
                {initials(r.name)}
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.textPrimary }}>
                {r.name.split(' ')[0]}
              </span>
            </div>
            <span style={{ fontSize: 13, color: COLORS.textPrimary, textAlign: 'right', width: 48, paddingRight: 14 }}>{r.activeJobs}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.accent, textAlign: 'right', width: 56, paddingRight: 14 }}>{r.placements}</span>
            <span
              style={{
                fontSize: 13, fontWeight: 600, textAlign: 'right', width: 72, paddingRight: 14,
                color: r.fillRate >= 70 ? COLORS.accent : r.fillRate >= 50 ? COLORS.warning : COLORS.danger,
              }}
            >
              {r.fillRate}%
            </span>
            <span style={{ fontSize: 13, color: COLORS.textMuted, textAlign: 'right', width: 64, paddingRight: 14 }}>{r.avgDaysToFill}d</span>
          </div>
          {/* Fill bar */}
          <div style={{ paddingLeft: 52, paddingRight: 14, paddingTop: 6 }}>
            <FillBar pct={r.fillRate} />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/RecruiterTable.tsx
git commit -m "feat: update RecruiterTable to light theme"
```

---

## Task 12: RecruiterCard + RecruitmentPage

**Files:**
- Modify: `src/components/departments/RecruiterCard.tsx`
- Modify: `src/pages/RecruitmentPage.tsx`

- [ ] **Step 1: Rewrite RecruiterCard with hero layout and light theme**

Replace `src/components/departments/RecruiterCard.tsx` with:

```tsx
import { useCallback } from 'react';
import { KPIMetric } from '../shared/KPIMetric';
import { StatusBadge } from '../shared/StatusBadge';
import { RecruiterTable } from '../shared/RecruiterTable';
import { useAirtable } from '../../hooks/useAirtable';
import { fetchRecruiterKPIs, MOCK_RECRUITER } from '../../services/airtable';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import type { DepartmentStatus } from '../../types';

export function RecruiterCard() {
  const fetcher = useCallback(() => fetchRecruiterKPIs(), []);
  const { data, loading, error } = useAirtable(fetcher, MOCK_RECRUITER);

  const status: DepartmentStatus = !data
    ? 'no-data'
    : data.fillRate >= 70
    ? 'on-track'
    : data.fillRate >= 50
    ? 'at-risk'
    : 'off-track';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>
            Recruitment
          </h2>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>
            {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} · Updates every 60s
          </p>
        </div>
        <StatusBadge status={error ? 'no-data' : status} />
      </div>

      {loading && !data ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div
            style={{ width: 24, height: 24, border: `2px solid ${COLORS.accent}`, borderTopColor: 'transparent', borderRadius: '50%' }}
            className="animate-spin"
          />
        </div>
      ) : (
        <>
          {/* HERO CARD: Placements */}
          <div style={{ ...CARD_STYLE, padding: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Total Placements
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 20 }}>
              <span style={{ fontSize: 44, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-2px', lineHeight: 1 }}>
                {data?.totalPlacements ?? 0}
              </span>
              <span style={{ fontSize: 13, color: COLORS.textMuted, marginLeft: 12 }}>this month</span>
            </div>

            {/* Stat grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <KPIMetric
                label="Active Jobs"
                value={data?.totalActiveJobs ?? 0}
                valueColor={COLORS.accent}
              />
              <KPIMetric
                label="Team Fill Rate"
                value={`${data?.fillRate ?? 0}%`}
                valueColor={
                  (data?.fillRate ?? 0) >= 70 ? COLORS.accent
                  : (data?.fillRate ?? 0) >= 50 ? COLORS.warning
                  : COLORS.danger
                }
              />
              <KPIMetric
                label="Avg Days to Fill"
                value={`${data?.avgDaysToFill ?? 0}d`}
                valueColor={COLORS.textPrimary}
              />
              <KPIMetric
                label="Recruiters"
                value={data?.byRecruiter.length ?? 0}
                valueColor={COLORS.textSecondary}
              />
            </div>
          </div>

          {/* PER-RECRUITER TABLE CARD */}
          <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
            <div style={{ padding: '16px 14px 0' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                By Recruiter — {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
              </div>
            </div>
            <RecruiterTable recruiters={data?.byRecruiter ?? []} />
          </div>
        </>
      )}

      {error && (
        <p style={{ color: COLORS.warning, fontSize: 12, margin: 0 }}>
          ⚠ Using demo data — {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update RecruitmentPage container**

Replace `src/pages/RecruitmentPage.tsx` with:

```tsx
import { RecruiterCard } from '../components/departments/RecruiterCard';

export function RecruitmentPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
      <RecruiterCard />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/departments/RecruiterCard.tsx src/pages/RecruitmentPage.tsx
git commit -m "feat: redesign RecruiterCard to light theme with hero layout"
```

---

## Task 13: PlaceholderCard + Finance / Retention Pages

**Files:**
- Modify: `src/components/departments/PlaceholderCard.tsx`
- Modify: `src/pages/FinancePage.tsx`
- Modify: `src/pages/RetentionPage.tsx`

- [ ] **Step 1: Rewrite PlaceholderCard with light theme**

Replace `src/components/departments/PlaceholderCard.tsx` with:

```tsx
import { COLORS, CARD_STYLE } from '../../styles/tokens';

interface PlaceholderCardProps {
  department: string;
  description?: string;
}

export function PlaceholderCard({
  department,
  description = 'Data integration coming soon.',
}: PlaceholderCardProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>
            {department}
          </h2>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>
            Coming soon
          </p>
        </div>
        <span
          style={{
            background: COLORS.bgSubtle,
            border: `1px dashed ${COLORS.border}`,
            color: COLORS.textMuted,
            fontSize: 12, fontWeight: 600,
            padding: '5px 12px', borderRadius: 20,
          }}
        >
          Coming Soon
        </span>
      </div>

      {/* Placeholder card */}
      <div style={{ ...CARD_STYLE, padding: 24, opacity: 0.6 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[80, 60, 70].map((w, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ background: COLORS.border, borderRadius: 4, height: 12, width: `${w}%` }} />
              <div style={{ background: COLORS.borderSubtle, borderRadius: 4, height: 8, width: '40%' }} />
            </div>
          ))}
        </div>
        <p style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 16 }}>
          {description}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update FinancePage container and remove colour prop**

Replace `src/pages/FinancePage.tsx` with:

```tsx
import { PlaceholderCard } from '../components/departments/PlaceholderCard';

export function FinancePage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
      <PlaceholderCard
        department="Finance"
        description="Connect your Xero data to see P&L, cash flow, and invoice metrics."
      />
    </div>
  );
}
```

- [ ] **Step 3: Update RetentionPage container and remove colour prop**

Replace `src/pages/RetentionPage.tsx` with:

```tsx
import { PlaceholderCard } from '../components/departments/PlaceholderCard';

export function RetentionPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
      <PlaceholderCard
        department="Retention"
        description="Candidate and client retention metrics coming soon."
      />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/departments/PlaceholderCard.tsx src/pages/FinancePage.tsx src/pages/RetentionPage.tsx
git commit -m "feat: update PlaceholderCard and placeholder pages to light theme"
```

---

## Task 14: OverviewPage — 5-Tile Grid

**Files:**
- Modify: `src/pages/OverviewPage.tsx`

- [ ] **Step 1: Rewrite OverviewPage with light-mode tiles**

Replace `src/pages/OverviewPage.tsx` with:

```tsx
import { Link } from 'react-router-dom';
import { COLORS, CARD_STYLE } from '../styles/tokens';

const departments = [
  { name: 'Marketing',   path: '/marketing',   description: 'Leads, ad spend & channel performance' },
  { name: 'Sales',       path: '/sales',        description: 'Revenue, pipeline & win rate'          },
  { name: 'Recruitment', path: '/recruitment',  description: 'Placements, fill rate & recruiter KPIs' },
  { name: 'Finance',     path: '/finance',      description: 'P&L, cash flow & invoices',  placeholder: true },
  { name: 'Retention',   path: '/retention',    description: 'Candidate & client retention', placeholder: true },
] as const;

export function OverviewPage() {
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
        {departments.map((dept) => (
          <Link
            key={dept.path}
            to={dept.path}
            style={{
              ...CARD_STYLE,
              borderTop: `3px solid ${dept.placeholder ? COLORS.border : COLORS.accent}`,
              padding: 20,
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              opacity: dept.placeholder ? 0.6 : 1,
              transition: 'box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!dept.placeholder) {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = CARD_STYLE.boxShadow as string;
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: dept.placeholder ? COLORS.textMuted : COLORS.accent, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
                {dept.name}
              </p>
              {dept.placeholder && (
                <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, padding: '2px 8px', borderRadius: 12 }}>
                  Coming Soon
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: COLORS.textPrimary, margin: 0 }}>
              {dept.description}
            </p>
            {!dept.placeholder && (
              <p style={{ fontSize: 12, fontWeight: 600, color: COLORS.accent, margin: 0, marginTop: 4 }}>
                View →
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/OverviewPage.tsx
git commit -m "feat: redesign OverviewPage to 5-tile light-mode grid"
```

---

## Task 15: Delete Sidebar + Final Build Check

**Files:**
- Delete: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Delete Sidebar**

```bash
rm src/components/layout/Sidebar.tsx
```

- [ ] **Step 2: Confirm nothing imports it**

```bash
grep -r "Sidebar" src/
```

Expected: no results (App.tsx was already updated in Task 3 to not import Sidebar).

- [ ] **Step 3: Run full TypeScript build**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Manual smoke test in browser**

Run: `npm run dev`

Check each route:
- `/` — 5-tile overview grid, emerald "View →" links
- `/marketing` — white header, hero split (Candidate | Client), channel table, spend+budget row
- `/sales` — hero revenue number, 4 stat cards, progress bar, sparkline
- `/recruitment` — hero placements, 4 stat cards, per-recruiter table with fill bars
- `/finance` — placeholder card, "Coming Soon" badge
- `/retention` — placeholder card
- Header tabs: active tab has emerald underline, Finance/Retention are grey (non-clickable feel)
- Refresh button: emerald outline style

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: complete UI redesign — light theme, top tabs, emerald accent"
```
