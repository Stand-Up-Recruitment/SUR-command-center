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
}

// ─── Recruiter ────────────────────────────────────────────────────────────────
export interface RecruiterStat {
  name: string;
  phoneInterviews: number;
  internalInterviews: number;
  clientInterviews: number;
  placements: number;
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
  activePipeline: number;      // total candidates in any stage (snapshot)
  byRecruiter: RecruiterStat[];
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
}

export interface AusPlacement {
  candidate: string;
  client: string;
  status: string;
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
  ausTotalCosts: number;
  ausNetContribution: number;
  advertising: number;
  travelInternational: number;
  nzActiveWorkers?: number;
  bankAccounts?: { name: string; balance: number }[];
  plLastMonth?: { revenue: number; grossProfit: number; netProfit: number };
  varianceCommentary?: string | null;
  recommendation?: string | null;
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
    totalInflow?: number;
    totalOutflow?: number;
  };
}

// ─── LTGP:CAC ─────────────────────────────────────────────────────────────────
export type LTGPFrame = '30d' | '90d' | '12m' | 'all';

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
  // LTGP inputs
  avgPlacementValueAud: number;
  monthlyRecruiterCostAud: number;
  recruiterCostPerPlacement: number;
  grossProfitPerPlacement: number;
  avgPlacementsPerClient: number;
  // Outputs
  candidateCac: number;
  clientCac: number;
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
