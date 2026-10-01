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
  prevPhoneInterviews: number;
  internalInterviews: number;
  prevInternalInterviews: number;
  clientInterviews: number;
  prevClientInterviews: number;
  // Internal interviews missed (JobAdder Internal Interview → No Show-up), per candidate;
  // excludes candidates who later attended a rebooked interview.
  noShows: number;
  prevNoShows: number;
  placements: number;
  prevPlacements: number;
  fallThroughRate: number;     // % of contracts signed this period later terminated (Status='End' + Cancellation Date)
  prevFallThroughRate: number;
  // Optional — merged in from the Voice Call Log / JobAdder webhooks; absent until that
  // hook's data has loaded, or if the recruiter has no matching calls / JobAdder owner.
  leadsContactedByBot?: number;
  referenceChecks?: number;
  prevReferenceChecks?: number;
  candidatesPitched?: number;
  prevCandidatesPitched?: number;
  internalInterviewsBotBooked?: number;
  prevInternalInterviewsBotBooked?: number;
  // Rolling rates over the last 4 full calendar months — only used for the
  // "What it takes" line. 0 when the recruiter has no denominator in the window.
  rolling: RollingRates;
  // Placements per month, last 12 months oldest-first (current month last, partial);
  // null for months before the recruiter's first activity.
  monthlyPlacements: (number | null)[];
}

export interface RollingRates {
  intToClient: number;       // client interviews ÷ internal interviews, 0–1
  clientToContract: number;  // placements ÷ client interviews, 0–1
  monthsOfData: number;      // full months in the window with interview data (0–4)
}

// ─── Voice Call Log (leads contacted by bot) ───────────────────────────────────
export interface VoiceCallKPIs {
  byRecruiter: { name: string; leadsContactedByBot: number }[];  // calls dialled, current period
  prevTeamLeads: number;                                         // calls dialled, previous period (team)
}

// ─── JobAdder pipeline stages + Calendly bot bookings ──────────────────────────
// referenceChecks/candidatesPitched come from JobAdder; internalInterviewsBotBooked
// comes from Calendly (the bot books via Autocalls -> Calendly, not via a JobAdder
// field) — manually-booked is derived client-side as internalInterviews (existing
// Airtable total) minus this bot count, not tracked separately here.
export interface JobAdderStageStat {
  name: string;
  referenceChecks: number;
  prevReferenceChecks: number;
  candidatesPitched: number;
  prevCandidatesPitched: number;
  internalInterviewsBotBooked: number;
  prevInternalInterviewsBotBooked: number;
}

export interface JobAdderStageKPIs {
  byRecruiter: JobAdderStageStat[];
}

export interface RecruiterKPIs {
  phoneInterviews: number;
  prevPhoneInterviews: number;
  internalInterviews: number;
  prevInternalInterviews: number;
  clientInterviews: number;
  prevClientInterviews: number;
  noShows: number;             // see RecruiterStat.noShows
  prevNoShows: number;
  placements: number;
  prevPlacements: number;
  conversionRate: number;      // placements ÷ client interviews × 100
  prevConversionRate: number;
  fallThroughRate: number;     // terminations within probation ÷ contracts signed, same period × 100
  prevFallThroughRate: number;
  activePipeline: number;      // total candidates in any stage (snapshot)
  rolling: RollingRates;       // team rolling 4-month rates
  months: string[];            // labels for monthlyPlacements, e.g. "Oct", oldest-first
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

// Jobs opened / closed over the last 28 days, any status. JobAdder has no close date, so
// "closed" = now inactive with updatedAt in the window.
export interface JobFlow { opened: number; closed: number }

export interface JobAgingKPIs {
  totalOpenJobs: number;
  fresh: number;
  ageing: number;
  stale: number;
  // Active jobs with no owner — optional until the n8n workflow change is live.
  unassigned?: Omit<JobAgingStat, 'name'>;
  byRecruiter: JobAgingStat[];
  // Optional until the n8n workflow change is live.
  growth28?: { byOwner: (JobFlow & { name: string })[]; unassigned: JobFlow };
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
  // Job Board Advertising (Xero Opex account), 100% AUS, trailing 90 days — for the
  // CAC formulas, since advertising/ausAdvertising above are FY-to-date (wrong period).
  jobBoardAdvertising90d?: number;
  prevJobBoardAdvertising90d?: number;
  // Unpaid ACCREC invoices already raised in Xero, past their due date (NZD).
  // Distinct from the frontend's own Airtable-scheduled overdue total.
  overdueXeroInvoices?: number;
  // Unpaid Xero invoices to Australian clients (lines coded to Sales -
  // International / Sales - Relocation Fees), NZD at Xero's rate. Overdue =
  // due date before today (NZ).
  ausReceivables?: {
    owedTotal: number; owedCount: number; overdueTotal: number; overdueCount: number;
    // Australian invoices: every unpaid one, plus ones paid that were due in the
    // last ~8 weeks. Amounts ex GST, NZD at Xero's invoice rate.
    invoices?: { invoiceNumber: string; contact: string; dueDate: string; status: string; amountExGst: number; amountDueExGst: number }[];
  };
  // Trailing 12 months of AUS-only figures, oldest first, for the 12-month
  // trend chart and the top-row month comparisons. Each entry is that single
  // month's own total, not a running total. The last entry (isCurrentMonth) is
  // a partial month-to-date (1st to today, NZ).
  monthlyTrend?: { month: string; revenue: number; grossProfit?: number; opex?: number; netProfit: number; isCurrentMonth?: boolean }[];
  // Last month from the 1st to the same day number as today (capped at month end).
  lastMonthSamePoint?: { revenue: number; grossProfit: number; opex: number; netProfit: number; periodStart: string; periodEnd: string } | null;
  // Monthly average AUD→NZD rates keyed 'YYYY-MM', for converting AUD placement fees.
  audNzdMonthlyRates?: Record<string, number>;
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

// ─── CAC ──────────────────────────────────────────────────────────────────────
export type LTGPFrame = '7d' | '30d' | '90d' | '12m' | 'all';

export interface CacKPIs {
  // CAC per Signed Client = (client Meta spend + sales time) ÷ ToBs signed.
  cacPerSignedClient: number;
  placementCac: number;
  hasPrevPeriod: boolean;
  prevCacPerSignedClient: number;
  prevPlacementCac: number;

  // CAC per Qualified Candidate = candidate Meta spend ÷ qualified candidates.
  // Qualified candidate = Airtable candidate who is an NZ Citizen and whose Category
  // (from the AI category matcher) is a skilled trade, i.e. not in the editable
  // non-trade list in the Marketing settings.
  cacPerQualifiedCandidate: number;
  prevCacPerQualifiedCandidate: number;

  // Unit economics: LTGP and LTGP:CAC
  ltgp: number;
  ltgpMethod: 'median' | 'average';
  placementRate: number;
  costPerPlacedClient: number;
  ltgpToCac: number;
  cohortSize: number;
  placedClientCount: number;

  // Last-90-days vs prior-90-days % change for the CAC card deltas (null when
  // the prior period's CAC is 0).
  cacPerSignedClientDeltaPct: number | null;
  placementCacDeltaPct: number | null;
  cacPerQualifiedCandidateDeltaPct: number | null;
}

// ─── Marketing tab (month view) ───────────────────────────────────────────────
export interface MetaPaidTotals {
  totalSpend: number;
  impressions: number;
  client: { spend: number; linkClicks: number; leads: number };
  candidate: { spend: number; linkClicks: number; applications: number };
}

/** The three acquisition CACs over a trailing-90-day window. */
export interface AcquisitionCacs {
  cacPerSignedClient: number;
  cacPerBookedCall: number;
  cacPerQualifiedCandidate: number;
}

export interface HandoffTotals {
  callsBooked: number;
  qualifiedCandidates: number;
  totalCandidates: number;
  qualRate: number;           // qualified ÷ total candidate leads, as a %
  costPerBookedCall: number;  // client Meta spend in the window ÷ calls booked
  costPerQualifiedCandidate: number; // candidate Meta spend in the window ÷ qualified candidates
}

export interface MarketingMonth {
  paid: { cur: MetaPaidTotals; prev: MetaPaidTotals };
  cac: { cur: AcquisitionCacs; prev: AcquisitionCacs };
  handoff: { cur: HandoffTotals; prev: HandoffTotals };
  spendSeries: { key: string; label: string; client: number; candidate: number }[];
  handoffSeries: {
    key: string; label: string;
    callsBooked: number; qualifiedCandidates: number;
    costPerBookedCall: number; costPerQualifiedCandidate: number;
  }[];
}

export interface OrganicChannel {
  connected: boolean;
  posts: number | null;
  prevPosts: number | null;
  views: number | null;       // null = not available (e.g. waiting on Page insights)
  prevViews: number | null;
  engagement: number | null;
  prevEngagement: number | null;
  followers: number | null;
  prevMonthFollowers: number | null; // month-end snapshot of the previous month
}

export interface OrganicPost {
  id: string;
  channel: 'Instagram' | 'Facebook' | 'Les Instagram';
  caption: string;
  date: string;               // ISO timestamp
  views: number | null;
  engagement: number;
  permalink?: string;
}

export interface OrganicMonth {
  instagram: OrganicChannel;
  facebook: OrganicChannel;
  les: OrganicChannel;
  topPosts: OrganicPost[];
  series: { key: string; views: number; followers: number | null }[];
  error?: string;
}

export interface MetaCampaignRow {
  campaign: string;
  group: 'client' | 'candidate';
  spend: number;
  prevSpend: number;            // same span last month
  results: number;              // leads (client) / applications (candidate)
  costPerResult: number | null;
  linkClicks: number;
  frequency: number;
}

export interface MetaAdRow {
  id: string;
  ad: string;
  campaign: string;
  group: 'client' | 'candidate';
  spend: number;
  results: number;
  costPerResult: number | null;
  frequency: number;            // average times each person saw the ad
}

export interface MarketingTargets {
  callsBooked: number | null;               // per month
  qualifiedCandidates: number | null;       // per month
  costPerBookedCall: number | null;
  costPerQualifiedCandidate: number | null;
}

export interface MarketingSettings {
  monthlyBudget: number | null;
  postsPerWeek: number;
  targets: MarketingTargets;
  nonTradeCategories: string[];
}

// ─── Recruitment ──────────────────────────────────────────────────────────────
export interface RecruitmentSettings {
  maxActiveJobs: number;  // per recruiter
  rampWeeks: number;
  bufferWeeks: number;
  recruiters: { name: string; startDate: string | null }[];  // headcount for capacity; startDate YYYY-MM-DD
}

// ─── Sales tab (month view) ───────────────────────────────────────────────────
export interface SalesSettings {
  targetPerSalesperson: number;
}

/** One window of the booked-call → signed-ToB funnel. Call outcomes are null until they're recorded in Airtable. */
export interface SalesFunnel {
  callsBooked: number;    // Client Paid Ads (paid source), by call date
  noShow: number | null;
  notFit: number | null;
  waitlist: number | null;
  callsHeld: number | null;
  closedNoToB: number;    // calls whose outcome is Closed / No Show / Not a Fit / Waitlist
  paidTobs: number;       // calls marked "Moved to CRM"
  tobsSent: number;       // CRM, all sources
  signed: number;
}

export interface SalespersonRow {
  name: string;
  calls: number;
  noShow: number | null;
  sent: number;
  signed: number;
  open: number;
  stale: number;
}

export interface OpenTob { company: string; stage: string; days: number }

export interface SalesMonth {
  cur: SalesFunnel;
  prev: SalesFunnel;
  salespeople: SalespersonRow[];
  open: {
    total: number;
    stages: { sent: number; waiting: number; fu1: number; fu2: number; fu3: number };
    stale: number;
    oldest: OpenTob[];
  };
  timeToSign: { label: string; total: number; median: number; within7: number; max: number };
  waitlist: { count: number; rows: { trade: string; town: string; count: number }[] } | null;
  cac: { cur: number; prev: number } | null;   // CAC per Signed Client, trailing 90 days, from acquisitionCacs
  series: { key: string; label: string; signed: number; sent: number; signRate: number | null }[];
}

// ─── Shared ───────────────────────────────────────────────────────────────────
export type DepartmentStatus = 'on-track' | 'at-risk' | 'off-track' | 'no-data';
export type TimeFrame = 'day' | 'week' | 'month' | 'year';

export interface TrendPoint {
  label: string;
  value: number;
}
