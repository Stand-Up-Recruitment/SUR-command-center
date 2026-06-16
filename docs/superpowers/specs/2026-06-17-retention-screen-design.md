# Retention Screen Design

**Date:** 2026-06-17  
**Status:** Approved for implementation

---

## Overview

A Retention screen at `/retention` that replaces the current placeholder card. Displays 5 KPIs that track candidate guarantee exposure and replacement risk. No time frame picker — all metrics are either snapshots of current state or fixed to the current calendar month. Every metric shows a week-on-week movement badge.

---

## Layout

Single `RetentionCard` component following the `RecruiterCard` pattern:

```
┌─────────────────────────────────────────────────────────────────┐
│  Retention                                    [status badge]    │
│  Current state · Updates daily                                  │
├─────────────────────────────────────────────────────────────────┤
│  REPLACEMENT RATE                                               │
│  3%  ↑2%                                                        │
│                                                                 │
│  [Active in Window] [Past Guarantee] [Triggered (mo.)] [In Progress] │
└─────────────────────────────────────────────────────────────────┘
```

- **Hero number:** Replacement Rate % — the most important signal. Large font (44px), with WoW badge inline.
- **4 stat tiles:** 4-column grid below the hero, same `KPIMetric`-style tiles used across the app.
- **Status badge logic:** on-track < 5%, at-risk 5–10%, off-track > 10% replacement rate.

---

## Data Source

**Table:** `Placements` (`tblvttoRo4DuZAIeW`) in `CLIENTS_BASE_ID`

**Fields fetched:**

| Field | Airtable ID | Notes |
|-------|-------------|-------|
| Status | `fldpy0RpyrnoDZRqx` | Has BOM character prefix — resolve with `Object.keys().find()` |
| Candidate Start Date | `fld0zc3tQ7O3kwqgS` | Date |
| Replacement Guarantee End Date | `fldbBzmNZk1m9nXSN` | Formula field — Airtable already computes this |
| Cancellation Date | `fld2zA52Zw2UOfUfP` | Date — set when a placement fails/is cancelled |
| Created Date | `fldQH927QO8b9l6qw` | createdTime |

---

## Metric Definitions

### 1. Active placements (in guarantee window)
**What:** Candidates who have started and are currently inside their guarantee window — live exposure.  
**Main value:** Count where `Candidate Start Date ≤ today` AND `Replacement Guarantee End Date ≥ today` AND `Status ≠ "End"`.  
**WoW:** Same calculation evaluated at `today − 7 days` (shift both date thresholds back by 7 days). Higher is neutral.

### 2. Placements past guarantee
**What:** Candidates whose guarantee window has fully cleared — revenue secured on these.  
**Main value:** Count where `Replacement Guarantee End Date < today`.  
**WoW:** Same calculation at `today − 7 days`. Higher is good (growing secured book).

### 3. Replacements triggered this month
**What:** How many replacement requests have come in during the current calendar month.  
**Main value:** Count where `Status = "End"` AND `Cancellation Date` is within the current calendar month.  
**WoW badge:** replacements with `Cancellation Date` in last 7 days vs prior 7 days. Lower is better (`invertDirection: true`).

### 4. Replacement rate %
**What:** The headline risk metric — replacements ever triggered divided by total placements ever made.  
**Main value:** `(all-time "End" + Cancellation Date set) ÷ all-time placement count × 100`, rounded to 1 decimal.  
**WoW:** Same ratio evaluated at `today − 7 days` (exclude placements/cancellations created within the last 7 days from both numerator and denominator). Lower is better (`invertDirection: true`).

### 5. Replacements in progress
**What:** Replacement fills actively being worked — new placements with `Status = "Replacement"`.  
**Main value:** Count of records where `Status = "Replacement"`.  
**WoW badge:** New "Replacement" records created in last 7 days vs prior 7 days (uses `Created Date`). Higher is neutral (not good or bad, just volume).

---

## TypeScript Interface

Add to `src/types/index.ts`:

```ts
export interface RetentionKPIs {
  activeInWindow: number;
  prevActiveInWindow: number;       // snapshot as of 7 days ago

  pastWindow: number;
  prevPastWindow: number;           // snapshot as of 7 days ago

  replacementsThisMonth: number;
  replacementsThisWeek: number;     // WoW current (last 7d)
  replacementsPrevWeek: number;     // WoW prev (prior 7d)

  replacementRate: number;          // % all-time, today
  prevReplacementRate: number;      // % all-time, as of 7 days ago

  inProgress: number;               // current Status="Replacement" count
  inProgressThisWeek: number;       // new replacement records, last 7d
  inProgressPrevWeek: number;       // new replacement records, prior 7d
}
```

---

## Service Function

Add `fetchRetentionKPIs()` to `src/services/airtable.ts`.

```
fetchRetentionKPIs()
  → fetchAllFromBase(CLIENTS_BASE_ID, PLACEMENTS_TABLE_ID)
  → resolve Status field name (BOM prefix workaround)
  → compute all 5 metrics + their WoW prev values
  → return RetentionKPIs
```

Throws `'Retention credentials not configured'` if `CLIENTS_BASE_ID` is absent (same guard pattern as other fetchers).

---

## Mock Data

Add `MOCK_RETENTION: RetentionKPIs` to `src/services/airtable.ts` — realistic values for demo mode:

```ts
{
  activeInWindow: 12, prevActiveInWindow: 11,
  pastWindow: 34,     prevPastWindow: 32,
  replacementsThisMonth: 2,
  replacementsThisWeek: 1, replacementsPrevWeek: 1,
  replacementRate: 3.2,    prevReplacementRate: 3.1,
  inProgress: 1,
  inProgressThisWeek: 1,   inProgressPrevWeek: 0,
}
```

---

## Component Structure

**New files:**
- `src/components/departments/RetentionCard.tsx` — card with skeleton loader, hero metric, 4 stat tiles

**Modified files:**
- `src/types/index.ts` — add `RetentionKPIs`
- `src/services/airtable.ts` — add `fetchRetentionKPIs()` + `MOCK_RETENTION`
- `src/pages/RetentionPage.tsx` — replace `PlaceholderCard` with `RetentionCard`

`RetentionCard` uses:
- `useAirtable(fetchRetentionKPIs, MOCK_RETENTION, hasCredentials)` — same hook pattern
- `WoWBadge` on every metric
- `StatusBadge` driven by replacement rate thresholds
- `Skeleton` for loading state

---

## Skeleton Loader

Matches the card structure:
- Header row: title + status badge placeholder
- Hero block: large number + badge
- 4-tile grid row

---

## Credential Guard

```ts
const hasRetentionCredentials =
  Boolean(import.meta.env.VITE_AIRTABLE_API_KEY) &&
  Boolean(import.meta.env.VITE_AIRTABLE_CLIENTS_BASE_ID);
```

Falls back to `MOCK_RETENTION` automatically (same as all other cards).
