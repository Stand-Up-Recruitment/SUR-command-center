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
export interface SalesFields {
  Month: string;          // e.g. "2026-04"
  Revenue: number;
  Target: number;
  PipelineValue: number;
  ActiveDeals: number;
  WonDeals: number;
  LostDeals: number;
}

export interface SalesKPIs {
  revenueThisMonth: number;
  target: number;
  pipelineValue: number;
  activeDeals: number;
  winRate: number;
  trend: { month: string; revenue: number }[];
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
