import type {
  AirtableResponse,
  SalesFields,
  RecruiterFields,
  SalesKPIs,
  RecruiterKPIs,
  MarketingKPIs,
  LeadMetric,
  ChannelRow,
  RecruiterStat,
} from '../types';
import { fetchMetaSpend } from './metaAds';

const API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY as string;
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID as string;
const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}`;
const CLIENTS_BASE_ID = import.meta.env.VITE_AIRTABLE_CLIENTS_BASE_ID as string;
const CANDIDATES_BASE_ID = import.meta.env.VITE_AIRTABLE_CANDIDATES_BASE_ID as string;
const CLIENTS_TABLE_ID = 'tblF4uPjZ7eF4BFzP';
const CANDIDATES_TABLE_ID = 'tblHhlHjb7keWPUdE';

// ─── Generic fetch ────────────────────────────────────────────────────────────
async function fetchTable<T>(
  tableName: string,
  params?: Record<string, string>
): Promise<AirtableResponse<T>> {
  const url = new URL(`${BASE_URL}/${encodeURIComponent(tableName)}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(error?.error?.message ?? `Airtable error ${res.status}`);
  }

  return res.json();
}

// ─── Multi-base fetch helpers ─────────────────────────────────────────────────
async function fetchTableFromBase<T>(
  baseId: string,
  tableId: string,
  params?: Record<string, string>
): Promise<AirtableResponse<T>> {
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(error?.error?.message ?? `Airtable error ${res.status}`);
  }
  return res.json();
}

async function fetchAllFromBase<T>(
  baseId: string,
  tableId: string,
  params?: Record<string, string>
): Promise<T[]> {
  const all: T[] = [];
  let offset: string | undefined;
  do {
    const p = { ...params, ...(offset ? { offset } : {}) };
    const data = await fetchTableFromBase<T>(baseId, tableId, p);
    all.push(...data.records.map((r) => r.fields));
    offset = data.offset;
  } while (offset);
  return all;
}

// ─── Sales ────────────────────────────────────────────────────────────────────
export async function fetchSalesKPIs(): Promise<SalesKPIs> {
  const data = await fetchTable<SalesFields>('Sales', {
    sort: JSON.stringify([{ field: 'Month', direction: 'desc' }]),
    maxRecords: '12',
  });

  const records = data.records.map((r) => r.fields);
  const current = records[0];

  if (!current) {
    return {
      revenueThisMonth: 0,
      target: 0,
      pipelineValue: 0,
      activeDeals: 0,
      winRate: 0,
      trend: [],
    };
  }

  const totalDeals = (current.WonDeals ?? 0) + (current.LostDeals ?? 0);
  const winRate = totalDeals > 0 ? Math.round((current.WonDeals / totalDeals) * 100) : 0;

  const trend = records
    .slice(0, 6)
    .reverse()
    .map((r) => ({ month: r.Month, revenue: r.Revenue ?? 0 }));

  return {
    revenueThisMonth: current.Revenue ?? 0,
    target: current.Target ?? 0,
    pipelineValue: current.PipelineValue ?? 0,
    activeDeals: current.ActiveDeals ?? 0,
    winRate,
    trend,
  };
}

// ─── Recruiter ────────────────────────────────────────────────────────────────
export async function fetchRecruiterKPIs(): Promise<RecruiterKPIs> {
  const thisMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  const data = await fetchTable<RecruiterFields>('Recruiters', {
    filterByFormula: `{Month} = "${thisMonth}"`,
  });

  const records = data.records.map((r) => r.fields);

  if (records.length === 0) {
    return {
      totalActiveJobs: 0,
      totalPlacements: 0,
      fillRate: 0,
      avgDaysToFill: 0,
      byRecruiter: [],
    };
  }

  const totalActiveJobs = records.reduce((s, r) => s + (r.ActiveJobs ?? 0), 0);
  const totalPlacements = records.reduce((s, r) => s + (r.Placements ?? 0), 0);
  const totalJobsWorked = records.reduce((s, r) => s + (r.JobsWorked ?? 0), 0);
  const totalDays = records.reduce((s, r) => s + (r.TotalDaysToFill ?? 0), 0);

  const fillRate =
    totalJobsWorked > 0 ? Math.round((totalPlacements / totalJobsWorked) * 100) : 0;
  const avgDaysToFill =
    totalPlacements > 0 ? Math.round(totalDays / totalPlacements) : 0;

  const byRecruiter: RecruiterStat[] = records.map((r) => {
    const rFillRate =
      (r.JobsWorked ?? 0) > 0
        ? Math.round(((r.Placements ?? 0) / r.JobsWorked) * 100)
        : 0;
    const rAvgDays =
      (r.Placements ?? 0) > 0
        ? Math.round((r.TotalDaysToFill ?? 0) / r.Placements)
        : 0;
    return {
      name: r.RecruiterName,
      activeJobs: r.ActiveJobs ?? 0,
      placements: r.Placements ?? 0,
      fillRate: rFillRate,
      avgDaysToFill: rAvgDays,
    };
  });

  return { totalActiveJobs, totalPlacements, fillRate, avgDaysToFill, byRecruiter };
}

// ─── Marketing ────────────────────────────────────────────────────────────────
type ClientLeadFields = {
  Status?: string;
  Source?: string;
  Created?: string;
};

type CandidateLeadFields = {
  'NZ Citizenship Status'?: string;
  'Trade / Occupation'?: string;
  UTMs?: string;
  Created?: string;
};

type MarketingConfigFields = {
  Name?: string;
  WeeklyBudget?: number;
};

function weekFilters() {
  const MS_7D = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const t7 = new Date(now - MS_7D).toISOString();
  const t14 = new Date(now - 2 * MS_7D).toISOString();
  return {
    thisWeek: `IS_AFTER({Created}, "${t7}")`,
    prevWeek: `AND(IS_AFTER({Created}, "${t14}"), NOT(IS_AFTER({Created}, "${t7}")))`,
  };
}

function isClientQualified(f: ClientLeadFields) {
  return f.Status === 'Moved to CRM';
}

function isCandidateQualified(f: CandidateLeadFields) {
  return (
    f['NZ Citizenship Status'] === 'NZ Citizen' &&
    Boolean(f['Trade / Occupation']?.trim())
  );
}

function buildLeadMetric(
  thisRecs: (ClientLeadFields | CandidateLeadFields)[],
  prevRecs: (ClientLeadFields | CandidateLeadFields)[],
  isQual: (f: ClientLeadFields | CandidateLeadFields) => boolean,
  spendThis: number,
  spendPrev: number
): LeadMetric {
  const total = thisRecs.length;
  const qualified = thisRecs.filter(isQual).length;
  const qualRate = total > 0 ? Math.round((qualified / total) * 100) : 0;
  const cpl = qualified > 0 ? Math.round(spendThis / qualified) : 0;

  const prevTotal = prevRecs.length;
  const prevQualified = prevRecs.filter(isQual).length;
  const prevQualRate = prevTotal > 0 ? Math.round((prevQualified / prevTotal) * 100) : 0;
  const prevCpl = prevQualified > 0 ? Math.round(spendPrev / prevQualified) : 0;

  return { total, qualified, qualRate, cpl, prevTotal, prevQualified, prevQualRate, prevCpl };
}

function buildChannels(
  thisClients: ClientLeadFields[],
  thisCandidates: CandidateLeadFields[],
  spend: number
): ChannelRow[] {
  const paidClients = thisClients.filter((f) => f.Source === 'Paid Ads');
  const organicClients = thisClients.filter((f) => f.Source !== 'Paid Ads');
  const paidCandidates = thisCandidates.filter((f) => Boolean(f.UTMs?.trim()));
  const organicCandidates = thisCandidates.filter((f) => !f.UTMs?.trim());

  const paidTotal = paidClients.length + paidCandidates.length;
  const paidQual =
    paidClients.filter(isClientQualified).length +
    paidCandidates.filter(isCandidateQualified).length;
  const paidQualRate = paidTotal > 0 ? Math.round((paidQual / paidTotal) * 100) : 0;
  const paidCpl = paidQual > 0 ? Math.round(spend / paidQual) : 0;

  const orgTotal = organicClients.length + organicCandidates.length;
  const orgQual =
    organicClients.filter(isClientQualified).length +
    organicCandidates.filter(isCandidateQualified).length;
  const orgQualRate = orgTotal > 0 ? Math.round((orgQual / orgTotal) * 100) : 0;

  return [
    { channel: 'Meta Paid', leads: paidTotal, qualRate: paidQualRate, cpl: paidTotal > 0 ? paidCpl : null },
    { channel: 'Instagram Organic', leads: orgTotal, qualRate: orgQualRate, cpl: null },
  ];
}

export async function fetchMarketingKPIs(): Promise<MarketingKPIs> {
  if (!CLIENTS_BASE_ID || !CANDIDATES_BASE_ID || !import.meta.env.VITE_META_TOKEN) {
    throw new Error('Marketing credentials not configured');
  }

  const filters = weekFilters();
  const clientFields = ['Status', 'Source', 'Created'];
  const candidateFields = ['NZ Citizenship Status', 'Trade / Occupation', 'UTMs', 'Created'];

  const [
    thisClients,
    prevClients,
    thisCandidates,
    prevCandidates,
    spend,
    budgetRecords,
  ] = await Promise.all([
    fetchAllFromBase<ClientLeadFields>(CLIENTS_BASE_ID, CLIENTS_TABLE_ID, {
      filterByFormula: filters.thisWeek,
      fields: JSON.stringify(clientFields),
    }),
    fetchAllFromBase<ClientLeadFields>(CLIENTS_BASE_ID, CLIENTS_TABLE_ID, {
      filterByFormula: filters.prevWeek,
      fields: JSON.stringify(clientFields),
    }),
    fetchAllFromBase<CandidateLeadFields>(CANDIDATES_BASE_ID, CANDIDATES_TABLE_ID, {
      filterByFormula: filters.thisWeek,
      fields: JSON.stringify(candidateFields),
    }),
    fetchAllFromBase<CandidateLeadFields>(CANDIDATES_BASE_ID, CANDIDATES_TABLE_ID, {
      filterByFormula: filters.prevWeek,
      fields: JSON.stringify(candidateFields),
    }),
    fetchMetaSpend(),
    fetchAllFromBase<MarketingConfigFields>(CLIENTS_BASE_ID, 'Marketing Config', {
      maxRecords: '1',
    }).catch(() => [] as MarketingConfigFields[]),
  ]);

  const weeklyBudget = budgetRecords[0]?.WeeklyBudget ?? 0;

  return {
    candidates: buildLeadMetric(thisCandidates, prevCandidates, isCandidateQualified, spend.thisWeek, spend.prevWeek),
    clients: buildLeadMetric(thisClients, prevClients, isClientQualified, spend.thisWeek, spend.prevWeek),
    channels: buildChannels(thisClients, thisCandidates, spend.thisWeek),
    spend,
    weeklyBudget,
  };
}

// ─── Mock data (used when no API key is configured) ───────────────────────────
export const MOCK_SALES: SalesKPIs = {
  revenueThisMonth: 142500,
  target: 180000,
  pipelineValue: 420000,
  activeDeals: 23,
  winRate: 68,
  trend: [
    { month: '2025-11', revenue: 98000 },
    { month: '2025-12', revenue: 115000 },
    { month: '2026-01', revenue: 127000 },
    { month: '2026-02', revenue: 134000 },
    { month: '2026-03', revenue: 158000 },
    { month: '2026-04', revenue: 142500 },
  ],
};

export const MOCK_RECRUITER: RecruiterKPIs = {
  totalActiveJobs: 18,
  totalPlacements: 7,
  fillRate: 70,
  avgDaysToFill: 22,
  byRecruiter: [
    { name: 'Ian De La Cruz', activeJobs: 8, placements: 4, fillRate: 80, avgDaysToFill: 18 },
    { name: 'Ayn Galado', activeJobs: 5, placements: 2, fillRate: 60, avgDaysToFill: 24 },
    { name: 'Emma Hatch', activeJobs: 5, placements: 1, fillRate: 50, avgDaysToFill: 28 },
  ],
};

export const MOCK_MARKETING: MarketingKPIs = {
  candidates: {
    total: 37,
    qualified: 24,
    qualRate: 65,
    cpl: 46,
    prevTotal: 31,
    prevQualified: 20,
    prevQualRate: 65,
    prevCpl: 51,
  },
  clients: {
    total: 19,
    qualified: 8,
    qualRate: 42,
    cpl: 138,
    prevTotal: 15,
    prevQualified: 6,
    prevQualRate: 40,
    prevCpl: 171,
  },
  channels: [
    { channel: 'Meta Paid', leads: 42, qualRate: 60, cpl: 40 },
    { channel: 'Instagram Organic', leads: 14, qualRate: 35, cpl: null },
  ],
  spend: { thisWeek: 1107, prevWeek: 1025 },
  weeklyBudget: 1500,
};
