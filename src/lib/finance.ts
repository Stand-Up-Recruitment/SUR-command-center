// Finance figures shared by the Finance tab and the Overview.
import type { XeroFinanceData } from '../types';
import type { MonthWindow } from './nzTime';
import { isTooEarly } from './rag';
import { diagnoseFinance, type Diagnosis } from './diagnosis';

/** Placeholder until set on the Overview (⚙). */
export const DEFAULT_NET_PROFIT_TARGET = 40000;

/** Available cash = 00 - Business OPS + 50 - PROFIT only. GST/TAX belongs to IRD and EMP ENT / EMP00 hold staff entitlements. */
export function availableCash(bankAccounts: XeroFinanceData['bankAccounts']): number | null {
  if (!bankAccounts) return null;
  return bankAccounts
    .filter(a => a.name.startsWith('00 -') || a.name.startsWith('50 -'))
    .reduce((sum, a) => sum + a.balance, 0);
}

/** Average weekly costs = mean outflow of the last 4 finished weeks of actual cash flow. */
function avgWeeklyCosts(cashFlow: XeroFinanceData['cashFlow'], today = new Date().toLocaleDateString('en-CA')): number | null {
  const weeks = (cashFlow ?? [])
    .filter(w => w.outflow != null && (!w.weekEnd || w.weekEnd < today))
    .slice(-4);
  if (weeks.length < 4) return null;
  return weeks.reduce((sum, w) => sum + (w.outflow as number), 0) / weeks.length;
}

/** Cash runway in weeks = available cash ÷ average weekly costs (last 4 weeks). */
function cashRunwayWeeks(data: XeroFinanceData): number | null {
  const cash = availableCash(data.bankAccounts);
  const costs = avgWeeklyCosts(data.cashFlow);
  return cash != null && costs != null && costs > 0 ? cash / costs : null;
}

/** This month's AUS net profit so far: the partial isCurrentMonth entry of the 12-month trend. */
function netProfitMonthToDate(data: XeroFinanceData): number | null {
  return data.monthlyTrend?.find(m => m.isCurrentMonth)?.netProfit ?? null;
}

/** Straight-line month-end projection: month to date ÷ days elapsed × days in month. */
function projectMonthEnd(monthToDate: number, dayOfMonth: number, daysInMonth: number): number {
  return (monthToDate / Math.max(1, dayOfMonth)) * daysInMonth;
}

export interface FinanceSummary {
  netProfitMtd: number | null;
  projectedNetProfit: number | null;
  target: number;
  cash: number | null;
  weeklyCosts: number | null;
  runwayWeeks: number | null;
  diagnosis: Diagnosis;
}

/** Everything the Finance tab's target/runway row and Diagnosis show. `w` is the current month's window. */
export function financeSummary(data: XeroFinanceData, target: number, w: MonthWindow): FinanceSummary {
  const netProfitMtd = netProfitMonthToDate(data);
  const projectedNetProfit = netProfitMtd == null ? null : projectMonthEnd(netProfitMtd, w.dayOfMonth, w.daysInMonth);
  const runwayWeeks = cashRunwayWeeks(data);
  return {
    netProfitMtd, projectedNetProfit, target, runwayWeeks,
    cash: availableCash(data.bankAccounts),
    weeklyCosts: avgWeeklyCosts(data.cashFlow),
    diagnosis: diagnoseFinance({
      tooEarly: isTooEarly({ isCurrent: w.isCurrent, dayOfMonth: w.dayOfMonth }),
      projectedNetProfit, target, runwayWeeks,
    }),
  };
}
