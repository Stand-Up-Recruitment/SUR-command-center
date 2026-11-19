// The annual placement plan: one formula, set on the Overview (⚙), read by every tab.
//   must stick / month = annual plan × (1 − planned fall-over) ÷ 12
//   must make / month  = must stick ÷ (1 − live fall-over), rounded up
//   breakeven / month  = avg monthly costs ÷ gross profit per placement ÷ (1 − live fall-over), rounded up
//   projected net profit = must stick × gross profit per placement − avg monthly costs
import type { RetentionPlacement, XeroFinanceData } from '../types';
import { placementFacts } from './retention.js';

export interface PlanSettings {
  planAnnualPlacements: number;  // placements made in the plan year
  planFallOverPct: number;       // planned fall-over, %
  planYear: number;              // 1 Jan – 31 Dec
}
export const DEFAULT_PLAN_SETTINGS: PlanSettings = { planAnnualPlacements: 170, planFallOverPct: 30, planYear: 2027 };

/** One Airtable placement's fee, for gross profit per placement. */
export interface PlacementFee { startDate: string; status: string; cancelled: boolean; feeAud: number }

const ceil = (n: number) => Math.ceil(n - 1e-9); // guard float noise, e.g. 15.0000000001
const monthsBack = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
};

/** Live fall-over rate: placements that started in the last 6 months (Retention tab's rule) that fell over. */
export function liveFallOver(placements: RetentionPlacement[], today: string): { rate: number; fell: number; started: number } | null {
  const from = monthsBack(today, 6);
  const started = placements.filter(p => p.startDate && p.startDate > from).map(p => placementFacts(p, today)).filter(f => f.started);
  if (!started.length) return null;
  const fell = started.filter(f => f.dropped).length;
  return { rate: fell / started.length, fell, started: started.length };
}

/** Gross profit per placement = average full fee (NZD) of placements that started in the last 6 months and stuck (Live / Completed, not cancelled). */
export function grossProfitPerPlacement(fees: PlacementFee[], rates: Record<string, number> | undefined, today: string, fallbackRate: number): { value: number; count: number } | null {
  const from = monthsBack(today, 6);
  const stuck = fees.filter(f => f.startDate > from && f.startDate <= today && ['Live', 'Completed'].includes(f.status) && !f.cancelled && f.feeAud > 0);
  if (!stuck.length) return null;
  const total = stuck.reduce((s, f) => s + f.feeAud * (rates?.[f.startDate.slice(0, 7)] ?? fallbackRate), 0);
  return { value: total / stuck.length, count: stuck.length };
}

/** Average monthly costs = Australian operating expenses, last 3 full months. */
export function avgMonthlyCosts(trend: XeroFinanceData['monthlyTrend']): { value: number; months: string[] } | null {
  const full = (trend ?? []).filter(m => !m.isCurrentMonth && m.opex != null).slice(-3);
  if (full.length < 3) return null;
  return { value: full.reduce((s, m) => s + (m.opex as number), 0) / 3, months: full.map(m => m.month) };
}

export interface PlacementPlan {
  settings: PlanSettings;
  fallOver: { rate: number; fell: number; started: number; live: boolean };  // live = from data, else the planned rate
  gp: { value: number; count: number } | null;
  costs: { value: number; months: string[] } | null;
  mustStick: number;
  mustMake: number;
  breakeven: number | null;
  projectedNetProfit: number | null;
}

export function placementPlan(settings: PlanSettings, inputs: {
  fallOver: { rate: number; fell: number; started: number } | null;
  gp: PlacementPlan['gp'];
  costs: PlacementPlan['costs'];
}): PlacementPlan {
  const planned = settings.planFallOverPct / 100;
  const fallOver = inputs.fallOver ? { ...inputs.fallOver, live: true } : { rate: planned, fell: 0, started: 0, live: false };
  const keep = Math.max(0.01, 1 - fallOver.rate);
  const mustStick = (settings.planAnnualPlacements * (1 - planned)) / 12;
  const { gp, costs } = inputs;
  return {
    settings, fallOver, gp, costs, mustStick,
    mustMake: ceil(mustStick / keep),
    breakeven: gp && costs && gp.value > 0 ? ceil(costs.value / gp.value / keep) : null,
    projectedNetProfit: gp && costs ? mustStick * gp.value - costs.value : null,
  };
}

/** Year-to-date from 1 Jan of the plan year: placements made (signed) and stuck (made minus fallen over so far). */
export function planYearToDate(placements: RetentionPlacement[], s: PlanSettings, today: string) {
  const made = placements.filter(p => p.createdAt.slice(0, 4) === String(s.planYear) && p.createdAt.slice(0, 10) <= today);
  const fell = made.filter(p => placementFacts(p, today).dropped).length;
  return {
    started: today >= `${s.planYear}-01-01`,
    made: made.length, stuck: made.length - fell,
    madeTarget: s.planAnnualPlacements,
    stuckTarget: Math.round(s.planAnnualPlacements * (1 - s.planFallOverPct / 100)),
  };
}

// Self-check against Les's brief (20 Nov 2026): 170 at 30% → 9.9 stick, 16 make at 36.8% live, 15 at 30%, breakeven 7.
{
  const s = DEFAULT_PLAN_SETTINGS;
  const costs = { value: 85524, months: [] };
  const gp = { value: 19500, count: 1 };
  const live = placementPlan(s, { fallOver: { rate: 0.368, fell: 14, started: 38 }, gp, costs });
  const at30 = placementPlan(s, { fallOver: { rate: 0.3, fell: 3, started: 10 }, gp, costs });
  console.assert(live.mustStick.toFixed(1) === '9.9' && live.mustMake === 16 && at30.mustMake === 15 && live.breakeven === 7, 'placementPlan self-check failed');
}
