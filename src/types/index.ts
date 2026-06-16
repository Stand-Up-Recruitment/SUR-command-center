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
}

// ─── Recruiter ────────────────────────────────────────────────────────────────
export interface RecruiterFields {
  RecruiterName: string;
  Month: string;
  ActiveJobs: number;
  Placements: number;
  JobsWorked: number;
  TotalDaysToFill: number;  // sum, divide by placements for avg
}

export interface RecruiterKPIs {
  totalActiveJobs: number;
  totalPlacements: number;
  fillRate: number;        // %
  avgDaysToFill: number;
  byRecruiter: RecruiterStat[];
}

export interface RecruiterStat {
  name: string;
  activeJobs: number;
  placements: number;
  fillRate: number;
  avgDaysToFill: number;
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

// ─── Shared ───────────────────────────────────────────────────────────────────
export type DepartmentStatus = 'on-track' | 'at-risk' | 'off-track' | 'no-data';

export interface TrendPoint {
  label: string;
  value: number;
}
