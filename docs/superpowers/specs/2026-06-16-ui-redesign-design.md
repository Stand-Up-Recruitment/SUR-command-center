# SUR Command Center — UI/UX Redesign Spec
**Date:** 2026-06-16  
**Status:** Approved

---

## Context

The current dashboard uses a dark theme (`#0f1117` background) with a left sidebar. The redesign moves to a clean light theme with horizontal tab navigation and a consistent design system across all department pages.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Visual theme | Executive Light | Professional, office-readable, Stripe/Notion aesthetic |
| Navigation | Top tabs | Maximises content width; familiar horizontal nav pattern |
| Metric layout | Hero + Grid | Hierarchy: biggest number dominates, supporting stats below |
| Accent colour | Emerald Green (`#059669`) | Growth-oriented, fits recruitment brand, distinctive |

---

## Colour Palette

| Token | Value | Usage |
|---|---|---|
| `bg-page` | `#f1f5f9` | Page background |
| `bg-card` | `#ffffff` | Card surfaces |
| `bg-subtle` | `#f8fafc` | Table headers, stat card backgrounds |
| `border` | `#e2e8f0` | All card/table borders |
| `border-subtle` | `#f1f5f9` | Table row dividers |
| `text-primary` | `#0f172a` | Headings, values |
| `text-secondary` | `#64748b` | Table headers, labels |
| `text-muted` | `#94a3b8` | Metric labels, subtitles, timestamps |
| `accent` | `#059669` | Active tabs, buttons, progress fills, positive indicators |
| `accent-bg` | `#f0fdf4` | Accent-tinted backgrounds |
| `accent-border` | `#bbf7d0` | Accent-tinted borders |
| `success` | `#16a34a` | WoW up arrows, on-track badges |
| `success-bg` | `#dcfce7` | Success badge backgrounds |
| `warning` | `#d97706` | At-risk badges, amber qual rates |
| `warning-bg` | `#fef3c7` | Warning badge backgrounds |
| `danger` | `#dc2626` | Off-track badges, WoW down arrows |
| `danger-bg` | `#fee2e2` | Danger badge backgrounds |

---

## Typography

- **Font stack:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- **Hero numbers:** `font-size: 44px`, `font-weight: 900`, `letter-spacing: -2px`
- **Section numbers:** `font-size: 32px`, `font-weight: 900`, `letter-spacing: -1.5px`
- **Stat values:** `font-size: 20px`, `font-weight: 800`
- **Spend values:** `font-size: 26px`, `font-weight: 900`, `letter-spacing: -1px`
- **Labels:** `font-size: 10–11px`, `font-weight: 600–700`, `text-transform: uppercase`, `letter-spacing: 0.07em`, `color: text-muted`
- **Body / table:** `font-size: 13px`, `font-weight: 500`

---

## Layout System

### Header (56px tall, sticky)
- White background, 1px bottom border, subtle box-shadow
- **Left:** Brand icon (emerald square) + "Stand Up Recruitment" / "Command Center" subtitle
- **Centre:** Horizontal tab nav — Overview | Marketing | Sales | Recruitment | Finance | Retention
  - Active tab: `color: accent`, `border-bottom: 2px solid accent`
  - Inactive tab: `color: text-secondary`, hover darkens
  - Coming-soon tabs (Finance, Retention): `color: #cbd5e1`, no hover effect
- **Right:** Live clock (time + date) + Refresh button (emerald outline style)

### Page Container
- `max-width: 900px`, `margin: 0 auto`, `padding: 28px 24px`
- Each department page has:
  - **Page header row:** title (22px/900) + subtitle + status pill (top-right)
  - **Content stack:** vertically stacked cards with 16px gap

### Card
- `background: white`, `border: 1px solid #e2e8f0`, `border-radius: 12px`
- `box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`
- No coloured top border (removed from current design)
- Standard padding: `20px` or `24px` for hero cards

---

## Shared Components

### WoW Badge
Inline pill showing week-on-week change:
```
↑ 12%   → green background (#dcfce7), green text (#16a34a)
↓ 8%    → red background (#fee2e2), red text (#dc2626)
```
- `font-size: 11px`, `font-weight: 700`, `padding: 3px 8px`, `border-radius: 20px`
- For spend WoW: amber colouring (neutral, not good/bad)

### Status Pill
```
● On Track    → emerald bg + border, green text + dot
● At Risk     → amber bg + border, amber text + dot  
● Off Track   → red bg + border, red text + dot
```

### Section Label
`font-size: 10px`, `font-weight: 700`, `color: text-muted`, `text-transform: uppercase`, `letter-spacing: 0.08em`, `margin-bottom: 10px`

### Stat Card
`background: #f8fafc`, `border: 1px solid #e2e8f0`, `border-radius: 10px`, `padding: 14px 16px`  
Contains: label → value (coloured by status) → WoW trend text

### Data Table
- `th`: `#f8fafc` background, 10px uppercase labels, right-aligned except first column
- `td`: 13px, 500 weight, `border-bottom: 1px solid #f1f5f9`
- Last row has no border

### Progress Bar
`height: 5px`, `border-radius: 3px`, emerald fill. Used for budget vs spend.

---

## Department Pages

### Marketing (`/marketing`)
Three stacked cards:

**1. Hero Card — Leads**
Two-column split (Candidate Leads | Client Leads), divided by 1px vertical line:
- Each column: section label → hero number + WoW badge → 2-column stat grid (Qual Rate, Cost per Lead)
- Candidate number: 44px. Client number: 32px (secondary hierarchy).

**2. Channel Breakdown**
Full-width data table: Channel | Leads | Qual % | Cost per Qual. Lead
- Channel column has a coloured dot indicator (emerald = paid, slate = organic)
- CPL for organic shows `—`

**3. Ad Spend**
Two-block row divided by vertical line:
- Left: "This Week" spend value + WoW badge + vs-last-week sub-label
- Right: "Weekly Budget" value + % used label + emerald progress bar + remaining sub-label

### Sales (`/sales`)
Hero card: Revenue this month (large) + WoW vs last month  
Stat grid: Target, Pipeline Value, Active Deals, Win Rate  
Optional: 6-month sparkline (kept from current design, restyled)

### Recruitment (`/recruitment`)
Hero card: Total Placements (large) + Fill Rate  
Stat grid: Active Jobs, Avg Days to Fill  
Per-recruiter table: Name | Active Jobs | Placements | Fill Rate (with inline bar) | Avg Days

### Finance + Retention (`/finance`, `/retention`)
Placeholder cards: white card with coming-soon message, muted styling.

### Overview (`/`)
5-tile grid — one tile per department:
- White card, emerald top border for active departments, muted for placeholders
- Shows: department name, one-line description, "View →" link
- No live data fetching on overview page

---

## What Changes from Current

| Area | Before | After |
|---|---|---|
| Background | `#0f1117` dark | `#f1f5f9` light slate |
| Navigation | Left sidebar (200px) | Top horizontal tabs |
| Card style | Dark `#1a1d27`, coloured top border | White, neutral border, subtle shadow |
| Typography | Light text on dark | Dark text on light |
| Accent | Per-department colours (amber/blue/green) | Single emerald `#059669` across all |
| Status badge | Coloured dot pill | Same pattern, light-mode colours |
| WoW indicators | `↑↓` inline text | Pill badge with bg colour |
| Hero layout | 2-col KPI grid | Big number + supporting stat grid |

---

## Files to Create / Modify

### Shared design tokens
Create `src/styles/tokens.ts` — exports colour and spacing constants used across components so there's a single source of truth.

### Components to rewrite
- `src/components/layout/Header.tsx` — new top-tab nav, emerald branding
- `src/components/layout/Sidebar.tsx` — **delete** (replaced by tabs in Header)
- `src/components/shared/StatusBadge.tsx` — light-mode colours
- `src/components/shared/KPIMetric.tsx` — new stat card style
- `src/components/shared/WoWBadge.tsx` — **new component** (extracted from MarketingCard, reused across all department cards)

### Pages to rewrite (layout + styling)
- `src/pages/OverviewPage.tsx`
- `src/pages/MarketingPage.tsx` + `src/components/departments/MarketingCard.tsx`
- `src/pages/SalesPage.tsx` + `src/components/departments/SalesCard.tsx`
- `src/pages/RecruitmentPage.tsx` + `src/components/departments/RecruiterCard.tsx`
- `src/pages/FinancePage.tsx`
- `src/pages/RetentionPage.tsx`

### App shell
- `src/App.tsx` — remove sidebar, adjust layout (no more flex row with sidebar)
- `src/index.css` — update base body background to `#f1f5f9`

---

## Out of Scope
- No new data sources or API changes
- No changes to `src/services/`, `src/hooks/`, or `src/types/`
- No animations beyond existing CSS transitions
- Mobile responsiveness: tabs collapse gracefully (scroll-x), cards stack to single column
