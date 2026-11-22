// Finance figures shared by the Finance tab and the Overview.
import type { XeroFinanceData } from '../types';
import { addDays, type MonthWindow } from './nzTime.js';
import { isTooEarly } from './rag.js';
import { diagnoseFinance, type Diagnosis } from './diagnosis.js';

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

/** Buffer on top of average weekly costs for future weeks' outflow. */
export const OUTFLOW_BUFFER = 1500;

/** Forecast weekly outflow = average cash out of the last 4 finished weeks + buffer. */
export function forecastWeeklyOutflow(cashFlow: XeroFinanceData['cashFlow']): number | null {
  const avg = avgWeeklyCosts(cashFlow);
  return avg == null ? null : avg + OUTFLOW_BUFFER;
}

/** Cash runway in weeks = available cash ÷ average weekly costs (last 4 weeks). */
function cashRunwayWeeks(data: XeroFinanceData): number | null {
  const cash = availableCash(data.bankAccounts);
  const costs = avgWeeklyCosts(data.cashFlow);
  return cash != null && costs != null && costs > 0 ? cash / costs : null;
}

/** AUS net profit for `w`'s month from the 12-month trend: the partial isCurrentMonth entry, or a past month matched by name. */
function netProfitMonthToDate(data: XeroFinanceData, w: MonthWindow): number | null {
  const entry = data.monthlyTrend?.find(m => w.isCurrent ? m.isCurrentMonth : !m.isCurrentMonth && m.month.startsWith(w.shortLabel));
  return entry?.netProfit ?? null;
}

/** Straight-line month-end projection: month to date ÷ days elapsed × days in month. */
function projectMonthEnd(monthToDate: number, dayOfMonth: number, daysInMonth: number): number {
  return (monthToDate / Math.max(1, dayOfMonth)) * daysInMonth;
}

/** Placement pace for the month against the placement plan (Recruitment tab's count and projection). */
export interface PlacementPace { placements: number; projected: number; mustMake: number; breakeven: number | null }

export interface FinanceSummary {
  netProfitMtd: number | null;
  projectedNetProfit: number | null;
  cash: number | null;
  weeklyCosts: number | null;
  runwayWeeks: number | null;
  diagnosis: Diagnosis;
}

/** Everything the Finance tab's target/runway row and Diagnosis show. `w` is the selected month's window. */
export function financeSummary(data: XeroFinanceData, w: MonthWindow, pace: PlacementPace | null): FinanceSummary {
  const netProfitMtd = netProfitMonthToDate(data, w);
  const projectedNetProfit = netProfitMtd == null ? null : projectMonthEnd(netProfitMtd, w.dayOfMonth, w.daysInMonth);
  const runwayWeeks = cashRunwayWeeks(data);
  return {
    netProfitMtd, projectedNetProfit, runwayWeeks,
    cash: availableCash(data.bankAccounts),
    weeklyCosts: avgWeeklyCosts(data.cashFlow),
    diagnosis: diagnoseFinance({
      tooEarly: isTooEarly({ isCurrent: w.isCurrent, dayOfMonth: w.dayOfMonth }),
      projectedNetProfit, pace, runwayWeeks,
    }),
  };
}

/** Days late assumed for a client with no payment history (same rule as the Finance tab's cash forecast). */
export const NO_HISTORY_DAYS = 7;

export interface ExpectedReceipt { client: string; amount: number; dueDate: string; expected: string; source: 'Xero' | 'Scheduled' }

/**
 * Money still to come in, NZD ex GST: unpaid Australian Xero invoices plus Airtable instalments
 * scheduled but not yet invoiced. Each is expected on its due date + that client's average days late.
 */
export function expectedReceipts(
  data: XeroFinanceData, scheduled: { amount: number; dueDate: string; client: string }[] | undefined,
  lateDays: (client: string) => number, audToNzd: number,
): ExpectedReceipt[] {
  const out: ExpectedReceipt[] = [];
  for (const inv of data.ausReceivables?.invoices ?? []) {
    if (inv.amountDueExGst <= 0) continue;
    out.push({ client: inv.contact, amount: inv.amountDueExGst, dueDate: inv.dueDate, expected: addDays(inv.dueDate, lateDays(inv.contact)), source: 'Xero' });
  }
  for (const s of scheduled ?? []) {
    const due = s.dueDate.slice(0, 10);
    out.push({ client: s.client, amount: s.amount * audToNzd, dueDate: due, expected: addDays(due, lateDays(s.client)), source: 'Scheduled' });
  }
  return out.sort((a, b) => a.expected.localeCompare(b.expected));
}
