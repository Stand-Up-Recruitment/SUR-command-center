import type {
  AirtableResponse,
  SalesKPIs,
  RecruiterKPIs,
  MarketingKPIs,
  LeadMetric,
  ChannelRow,
} from '../types';
import { fetchMetaSpend } from './metaAds';

const API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY as string;
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID as string;
const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}`;
const CLIENTS_BASE_ID = import.meta.env.VITE_AIRTABLE_CLIENTS_BASE_ID as string;
const CANDIDATES_BASE_ID = import.meta.env.VITE_AIRTABLE_CANDIDATES_BASE_ID as string;
const CLIENTS_TABLE_ID = 'tblF4uPjZ7eF4BFzP';
const CANDIDATES_TABLE_ID = 'tblHhlHjb7keWPUdE';
const CRM_TABLE_ID = 'tbl4XcHW2Gb7PF4fw';
const MAIN_CLIENT_TABLE_ID = 'tblHJjDpCeTgevOvI';

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
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}`);
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
  params?: Record<string, string>,
  fields?: string[]
): Promise<T[]> {
  const all: T[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}`);
    const p = { ...params, ...(offset ? { offset } : {}) };
    Object.entries(p).forEach(([k, v]) => url.searchParams.set(k, v));
    if (fields) {
      fields.forEach((f) => url.searchParams.append('fields[]', f));
    }
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
      throw new Error(error?.error?.message ?? `Airtable error ${res.status}`);
    }
    const data: AirtableResponse<T> = await res.json();
    all.push(...data.records.map((r) => r.fields));
    offset = data.offset;
  } while (offset);
  return all;
}

// ─── Sales ────────────────────────────────────────────────────────────────────
export async function fetchSalesKPIs(): Promise<SalesKPIs> {
  if (!CLIENTS_BASE_ID) throw new Error('Sales credentials not configured');

  const b = weekBoundaries();

  const [allClients, allCRM, allMainClient] = await Promise.all([
    fetchAllFromBase<{ Status?: string; 'Last Updated Date'?: string; Created?: string }>(
      CLIENTS_BASE_ID, CLIENTS_TABLE_ID, {}
    ),
    fetchAllFromBase<{ 'Sent Date'?: string }>(CLIENTS_BASE_ID, CRM_TABLE_ID, {}),
    fetchAllFromBase<{ 'Signed Date'?: string }>(CLIENTS_BASE_ID, MAIN_CLIENT_TABLE_ID, {}),
  ]);

  const bookedCalls     = allClients.filter(f => f.Status === 'Moved to CRM' && isThisWeek(f['Last Updated Date'], b)).length;
  const prevBookedCalls = allClients.filter(f => f.Status === 'Moved to CRM' && isPrevWeek(f['Last Updated Date'], b)).length;

  const crmThis  = allCRM.filter(f => isThisWeek(f['Sent Date'], b)).length;
  const crmPrev  = allCRM.filter(f => isPrevWeek(f['Sent Date'], b)).length;

  const closedThis = allMainClient.filter(f => isThisWeek(f['Signed Date'], b)).length;
  const closedPrev = allMainClient.filter(f => isPrevWeek(f['Signed Date'], b)).length;

  const leadsThis = allClients.filter(f => isThisWeek(f.Created, b)).length;
  const leadsPrev = allClients.filter(f => isPrevWeek(f.Created, b)).length;

  return {
    bookedCalls,
    prevBookedCalls,
    closedClients: closedThis,
    prevClosedClients: closedPrev,
    callsToCloseRate:     crmThis > 0 ? Math.round(closedThis / crmThis * 100) : 0,
    prevCallsToCloseRate: crmPrev > 0 ? Math.round(closedPrev / crmPrev * 100) : 0,
    leadToCloseRate:     leadsThis > 0 ? Math.round(closedThis / leadsThis * 100) : 0,
    prevLeadToCloseRate: leadsPrev > 0 ? Math.round(closedPrev / leadsPrev * 100) : 0,
    openPipeline: allCRM.length,
    newPipelineThisWeek: crmThis,
    newPipelinePrevWeek: crmPrev,
  };
}

// ─── Recruiter ────────────────────────────────────────────────────────────────
const PIPELINE_TABLE_ID = 'tblpHoIL0R3MTQOXF';
const PLACEMENTS_TABLE_ID = 'tblvttoRo4DuZAIeW';

export async function fetchRecruiterKPIs(): Promise<RecruiterKPIs> {
  const b = weekBoundaries();

  const [pipeline, placements] = await Promise.all([
    fetchAllFromBase<{ Status?: string; Created?: string }>(
      CANDIDATES_BASE_ID, PIPELINE_TABLE_ID, {}
    ),
    fetchAllFromBase<{ 'Created Date'?: string }>(
      CLIENTS_BASE_ID, PLACEMENTS_TABLE_ID, {}
    ),
  ]);

  const phoneThis    = pipeline.filter(f => f.Status === 'Phone Interview'             && isThisWeek(f.Created, b)).length;
  const phonePrev    = pipeline.filter(f => f.Status === 'Phone Interview'             && isPrevWeek(f.Created, b)).length;
  const internalThis = pipeline.filter(f => f.Status === 'Internal Interview'          && isThisWeek(f.Created, b)).length;
  const internalPrev = pipeline.filter(f => f.Status === 'Internal Interview'          && isPrevWeek(f.Created, b)).length;
  const clientThis   = pipeline.filter(f => f.Status === 'Client-Candidate Interview'  && isThisWeek(f.Created, b)).length;
  const clientPrev   = pipeline.filter(f => f.Status === 'Client-Candidate Interview'  && isPrevWeek(f.Created, b)).length;

  const placementsThis = placements.filter(f => isThisWeek(f['Created Date'], b)).length;
  const placementsPrev = placements.filter(f => isPrevWeek(f['Created Date'], b)).length;

  return {
    phoneInterviews: phoneThis,
    prevPhoneInterviews: phonePrev,
    internalInterviews: internalThis,
    prevInternalInterviews: internalPrev,
    clientInterviews: clientThis,
    prevClientInterviews: clientPrev,
    placements: placementsThis,
    prevPlacements: placementsPrev,
  };
}

// ─── Marketing ────────────────────────────────────────────────────────────────
type ClientLeadFields = {
  Status?: string;
  Source?: string;
  Created?: string;
  'Last Updated Date'?: string;
};

type CandidateLeadFields = {
  'NZ Citizenship Status'?: string;
  'Trade / Occupation'?: string;
  UTMs?: string;
  Created?: string;
};

type MarketingConfigFields = {
  Name?: string;
  'Weekly Budget'?: number;
};

function weekBoundaries() {
  const MS_7D = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  return { t7: now - MS_7D, t14: now - 2 * MS_7D };
}

function isThisWeek(created: string | undefined, b: { t7: number; t14: number }) {
  if (!created) return false;
  const t = new Date(created).getTime();
  return !isNaN(t) && t >= b.t7;
}

function isPrevWeek(created: string | undefined, b: { t7: number; t14: number }) {
  if (!created) return false;
  const t = new Date(created).getTime();
  return !isNaN(t) && t >= b.t14 && t < b.t7;
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

  const [
    allClients,
    allCandidates,
    spend,
    budgetRecords,
  ] = await Promise.all([
    fetchAllFromBase<ClientLeadFields>(CLIENTS_BASE_ID, CLIENTS_TABLE_ID, {}),
    fetchAllFromBase<CandidateLeadFields>(CANDIDATES_BASE_ID, CANDIDATES_TABLE_ID, {}),
    fetchMetaSpend(),
    fetchAllFromBase<MarketingConfigFields>(CLIENTS_BASE_ID, 'Marketing Config', {
      maxRecords: '1',
    }).catch(() => [] as MarketingConfigFields[]),
  ]);

  const b = weekBoundaries();

  // Candidates: bucket by Created date
  const thisCandidates = allCandidates.filter(f => isThisWeek(f.Created, b));
  const prevCandidates = allCandidates.filter(f => isPrevWeek(f.Created, b));

  // Client totals: new contacts created this week
  const thisClients = allClients.filter(f => isThisWeek(f.Created, b));
  const prevClients = allClients.filter(f => isPrevWeek(f.Created, b));

  // Client qualified: moved to CRM this week (by Last Updated Date, not Created)
  const qualClientsThis = allClients.filter(
    f => f.Status === 'Moved to CRM' && isThisWeek(f['Last Updated Date'], b)
  );
  const qualClientsPrev = allClients.filter(
    f => f.Status === 'Moved to CRM' && isPrevWeek(f['Last Updated Date'], b)
  );

  const clientQualRate = thisClients.length > 0
    ? Math.round((qualClientsThis.length / thisClients.length) * 100) : 0;
  const clientPrevQualRate = prevClients.length > 0
    ? Math.round((qualClientsPrev.length / prevClients.length) * 100) : 0;
  const clientCpl = qualClientsThis.length > 0
    ? Math.round(spend.thisWeek / qualClientsThis.length) : 0;
  const clientPrevCpl = qualClientsPrev.length > 0
    ? Math.round(spend.prevWeek / qualClientsPrev.length) : 0;

  const clientMetric: LeadMetric = {
    total: thisClients.length,
    qualified: qualClientsThis.length,
    qualRate: clientQualRate,
    cpl: clientCpl,
    prevTotal: prevClients.length,
    prevQualified: qualClientsPrev.length,
    prevQualRate: clientPrevQualRate,
    prevCpl: clientPrevCpl,
  };

  const weeklyBudget = budgetRecords[0]?.['Weekly Budget'] ?? 0;

  return {
    candidates: buildLeadMetric(thisCandidates, prevCandidates, isCandidateQualified, spend.thisWeek, spend.prevWeek),
    clients: clientMetric,
    channels: buildChannels(thisClients, thisCandidates, spend.thisWeek),
    spend,
    weeklyBudget,
  };
}

// ─── Mock data (used when no API key is configured) ───────────────────────────
export const MOCK_SALES: SalesKPIs = {
  bookedCalls: 5,
  prevBookedCalls: 3,
  closedClients: 2,
  prevClosedClients: 1,
  callsToCloseRate: 40,
  prevCallsToCloseRate: 33,
  leadToCloseRate: 18,
  prevLeadToCloseRate: 12,
  openPipeline: 14,
  newPipelineThisWeek: 5,
  newPipelinePrevWeek: 3,
};

export const MOCK_RECRUITER: RecruiterKPIs = {
  phoneInterviews: 8,
  prevPhoneInterviews: 5,
  internalInterviews: 4,
  prevInternalInterviews: 3,
  clientInterviews: 2,
  prevClientInterviews: 1,
  placements: 1,
  prevPlacements: 2,
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
