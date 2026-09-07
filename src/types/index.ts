// ─── Airtable raw record shape ──────────────────────────────────────────────
export interface AirtableRecord<T> {
  id: string;
  createdTime: string;
  fields: T;
}

export interface AirtableResponse<T> {
  records: AirtableRecord<T>[];
  offset?: string;
}

// ─── Sales ────────────────────────────────────────────────────────────────────
export interface SalesKPIs {
  bookedCalls: number;
  prevBookedCalls: number;
  closedClients: number;
  prevClosedClients: number;
  callsToCloseRate: number;      // %
  prevCallsToCloseRate: number;
  leadToCloseRate: number;       // %
  prevLeadToCloseRate: number;
  openPipeline: number;          // total CRM records (current snapshot)
  newPipelineThisWeek: number;
  newPipelinePrevWeek: number;
  leadsThisWeek: number;
  leadsPrevWeek: number;
  hotPipeline: number;           // CRM records with TOB Status set (snapshot)
  tobSignedThisMonth: number;    // T.O.B.s signed, real calendar month-to-date
  tobSignedLastMonth: number;    // T.O.B.s signed, full previous calendar month
}

// ─── Recruiter ────────────────────────────────────────────────────────────────
export interface RecruiterStat {
  name: string;
  phoneInterviews: number;
  internalInterviews: number;
  prevInternalInterviews: number;
  clientInterviews: number;
  prevClientInterviews: number;
  placements: number;
  prevPlacements: number;
  fallThroughRate: number;     // % of contracts signed this period later terminated (Status='End' + Cancellation Date)
  prevFallThroughRate: number;
}

export interface RecruiterKPIs {
  phoneInterviews: number;
  prevPhoneInterviews: number;
  internalInterviews: number;
  prevInternalInterviews: number;
  clientInterviews: number;
  prevClientInterviews: number;
  placements: number;
  prevPlacements: number;
  conversionRate: number;      // placements ÷ client interviews × 100
  prevConversionRate: number;
  fallThroughRate: number;     // terminations within probation ÷ contracts signed, same period × 100
  prevFallThroughRate: number;
  activePipeline: number;      // total candidates in any stage (snapshot)
  byRecruiter: RecruiterStat[];
}

// ─── Job aging ──────────────────────────────────────────────────────────────
export interface JobAgingStat {
  name: string;
  totalOpenJobs: number;
  fresh: number;   // open ≤ 21 days
  ageing: number;  // open 22–35 days
  stale: number;   // open 36+ days
}

export interface JobAgingKPIs {
  totalOpenJobs: number;
  fresh: number;
  ageing: number;
  stale: number;
  byRecruiter: JobAgingStat[];
}

// ─── Marketing ────────────────────────────────────────────────────────────────
export interface LeadMetric {
  total: number;
  qualified: number;
  qualRate: number;       // %
  cpl: number;            // cost per qualified lead
  prevTotal: number;
  prevQualified: number;
  prevQualRate: number;
  prevCpl: number;
}

export interface ChannelRow {
  channel: string;
  leads: number;
  qualRate: number;       // %
  cpl: number | null;     // null = no spend attribution (organic)
}

export interface MarketingKPIs {
  candidates: LeadMetric;
  clients: LeadMetric;
  channels: ChannelRow[];
  spend: { thisWeek: number; prevWeek: number };
  weeklyBudget: number;
}

// ─── Revenue ──────────────────────────────────────────────────────────────────
export interface RevenueKPIs {
  // Placements
  placements: number;
  prevPlacements: number;
  // First payment flow
  firstInvoiced: number;
  prevFirstInvoiced: number;
  firstCollected: number;
  prevFirstCollected: number;
  firstCollectedAmount: number;
  // Second payment
  pendingSecond: number;           // snapshot: candidates started, 2nd invoice not yet sent
  secondCollected: number;
  prevSecondCollected: number;
  secondCollectedAmount: number;
  // Totals
  totalRevenue: number;
  prevTotalRevenue: number;
  // CAC (0 if data unavailable)
  cac: number;
  prevCac: number;
  adSpend: number;
  clientsClosed: number;
}

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

// ─── Finance (Xero P&L) ───────────────────────────────────────────────────────
export interface XeroAgedReceivable {
  contact: string;
  outstanding: number;
  current: number;
  overdue30: number;   // 1–30 days
  overdue60: number;   // 31–60 days
  overdue90: number;   // 61+ days
}

export interface XeroRevenueData {
  asOf: string;
  periodStart: string;
  periodEnd: string;
  invoicesRaised: { count: number; amount: number };
  paymentsReceived: { count: number; amount: number };
  outstandingTotal: number;
  outstandingCount: number;
  agedReceivables: XeroAgedReceivable[];
}


export interface XeroCostRow {
  label: string;
  value: number;
}

export interface CashWeek {
  label: string;     // e.g. 'W1\nJun 9'
  weekLabel: string; // e.g. 'W1 Jun 9–13'
  net: number;
  balance: number;
  inflow?: number;
  outflow?: number;
  weekStart?: string; // ISO date, e.g. '2026-09-07'
  weekEnd?: string;   // ISO date, e.g. '2026-09-13'
}

export interface AusPlacement {
  candidate: string;
  client: string;
  status: string;
}

export interface ScheduledInvoice {
  amount: number;
  dueDate: string; // ISO date
}

export interface NZWorkerStats {
  dataAvailable: boolean;
  matchedWorkers: number;
  workerCount: number;
  avgBillRate: number;
  avgPayRate: number;
  avgHoursPerWorker: number;
  grossMarginPerHour: number;
  casualLoadingPerHour: number;
  accLevyPerHour: number;
  accLevyRate: number;
  netMarginPerHour: number;
  netProfitPerWorkerPerWeek: number;
  overheadPerWorkerPerWeek: number;
  trueNetPerWorkerPerWeek: number;
  totalWeeklyNetProfit: number | null;
  workers: Array<{
    name: string;
    billRate: number;
    payRate: number;
    hours: number;
    grossMarginPerHour: number;
    netMarginPerHour: number;
    netProfitThisWeek: number;
  }>;
}

export interface XeroFinanceData {
  asOf: string;
  fyStart: string;
  netProfit: number;
  nzRevenue: number;
  nzCogs: XeroCostRow[];
  nzTotalCogs: number;
  nzGrossProfit: number;
  ausRevenue: number;
  ausCosts: XeroCostRow[];
  ausTotalCogs: number;
  ausTotalCosts: number;
  ausGrossProfit: number;
  ausRecruiterBonuses?: number; // "Salaries - Commissions" from Xero, reclassified as AUS COGS
  advertising: number;
  ausAdvertising?: number;
  nzAdvertising?: number;
  subscriptions?: number;
  travelInternational: number;
  nzActiveWorkers?: number;
  nzTotalOpex?: number;
  nzNetProfit?: number;
  ausNetProfit?: number;
  bankAccounts?: { name: string; balance: number }[];
  plLastMonth?: { revenue: number; grossProfit: number; netProfit: number; opex?: number };
  varianceCommentary?: string | null;
  recommendation?: string | null;
  audNzdRate?: number;
  nzWorkerStats?: NZWorkerStats;
  cashFlow: CashWeek[];
  cashOutlook?: CashWeek[];
  revenue?: XeroRevenueData;
  cashKpis: {
    openingBalance: number;
    closingBalance: number;
    closingBalanceActual?: number;
    avgWeeklyOutflow: number;
    openingDate: string;
    closingDate: string;
  };
}

// ─── LTGP:CAC ─────────────────────────────────────────────────────────────────
export type LTGPFrame = '7d' | '30d' | '90d' | '12m' | 'all';

export interface LTGPFlag {
  label: string;
  triggered: boolean;
  severity: 'amber' | 'red';
  formula: string;
  actual: string;
  suggestion: string;
}

export interface LTGPKPIs {
  // CAC inputs
  candidateMetaSpend: number;
  clientMetaSpend: number;
  metaSplitIsEstimated: boolean;
  ownerCallsCompleted: number;
  ownerCostPerCall: number;
  ownerAcquisitionCost: number;
  candidatesPlaced: number;
  clientsWon: number;
  qualifiedCandidates: number;
  qualifiedClients: number;
  // LTGP inputs
  avgPlacementValueAud: number;
  monthlyRecruiterCostAud: number;
  recruiterCostPerPlacement: number;
  grossProfitPerPlacement: number;
  avgPlacementsPerClient: number;
  // Outputs
  candidateCac: number;
  clientCac: number;
  qualifiedCandidateCac: number;
  qualifiedClientCac: number;
  // Previous-period comparison
  hasPrevPeriod: boolean;
  prevCandidateCac: number;
  prevClientCac: number;
  prevQualifiedCandidateCac: number;
  prevQualifiedClientCac: number;
  prevLtgpPerClient: number;
  ltgpPerClient: number;
  ltgpCacRatio: number;
  paybackPeriodDays: number;
  clientFinancedPass: boolean;
  flags: LTGPFlag[];
}

// ─── Shared ───────────────────────────────────────────────────────────────────
export type DepartmentStatus = 'on-track' | 'at-risk' | 'off-track' | 'no-data';
export type TimeFrame = 'day' | 'week' | 'month' | 'year';

export interface TrendPoint {
  label: string;
  value: number;
}
