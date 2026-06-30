import type {
  AirtableResponse,
  SalesKPIs,
  RecruiterKPIs,
  RecruiterStat,
  MarketingKPIs,
  RevenueKPIs,
  LeadMetric,
  ChannelRow,
  TimeFrame,
  AusPlacement,
  RetentionKPIs,
  LTGPFrame,
  LTGPKPIs,
  LTGPFlag,
} from '../types';
import { fetchMetaSpend, fetchMetaSpendByFrame, fetchMetaCprByGroup } from './metaAds';

const API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY as string;
const CLIENTS_BASE_ID = import.meta.env.VITE_AIRTABLE_CLIENTS_BASE_ID as string;
const CANDIDATES_BASE_ID = import.meta.env.VITE_AIRTABLE_CANDIDATES_BASE_ID as string;
const CLIENTS_TABLE_ID = 'tblF4uPjZ7eF4BFzP';
const CANDIDATES_TABLE_ID = 'tblHhlHjb7keWPUdE';
const CRM_TABLE_ID = 'tbl4XcHW2Gb7PF4fw';
const MAIN_CLIENT_TABLE_ID = 'tblHJjDpCeTgevOvI';

// ─── Multi-base fetch helpers ─────────────────────────────────────────────────
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

// Like fetchAllFromBase but returns { id, fields } so callers can join on record IDs.
async function fetchAllWithIdsFromBase<T>(
  baseId: string,
  tableId: string,
): Promise<{ id: string; fields: T }[]> {
  const all: { id: string; fields: T }[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}`);
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${API_KEY}` } });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
      throw new Error(error?.error?.message ?? `Airtable error ${res.status}`);
    }
    const data: AirtableResponse<T> = await res.json();
    all.push(...data.records.map(r => ({ id: r.id, fields: r.fields })));
    offset = data.offset;
  } while (offset);
  return all;
}

// ─── Sales ────────────────────────────────────────────────────────────────────
export async function fetchSalesKPIs(frame: TimeFrame = 'month'): Promise<SalesKPIs> {
  if (!CLIENTS_BASE_ID) throw new Error('Sales credentials not configured');

  const b = timeBoundaries(frame);

  const [allClients, allCRM, allMainClient] = await Promise.all([
    fetchAllFromBase<{ Status?: string; 'Last Updated Date'?: string; Created?: string }>(
      CLIENTS_BASE_ID, CLIENTS_TABLE_ID, {}
    ),
    fetchAllFromBase<{ 'Sent Date'?: string; 'TOB Status'?: string }>(CLIENTS_BASE_ID, CRM_TABLE_ID, {}),
    fetchAllFromBase<{ 'Signed Date'?: string }>(CLIENTS_BASE_ID, MAIN_CLIENT_TABLE_ID, {}),
  ]);

  const bookedCalls     = allClients.filter(f => f.Status === 'Moved to CRM' && isInPeriod(f['Last Updated Date'], b.start, b.now)).length;
  const prevBookedCalls = allClients.filter(f => f.Status === 'Moved to CRM' && isInPeriod(f['Last Updated Date'], b.prevStart, b.prevEnd)).length;

  const crmThis  = allCRM.filter(f => isInPeriod(f['Sent Date'], b.start, b.now)).length;
  const crmPrev  = allCRM.filter(f => isInPeriod(f['Sent Date'], b.prevStart, b.prevEnd)).length;

  const closedThis = allMainClient.filter(f => isInPeriod(f['Signed Date'], b.start, b.now)).length;
  const closedPrev = allMainClient.filter(f => isInPeriod(f['Signed Date'], b.prevStart, b.prevEnd)).length;

  const leadsThis = allClients.filter(f => isInPeriod(f.Created, b.start, b.now)).length;
  const leadsPrev = allClients.filter(f => isInPeriod(f.Created, b.prevStart, b.prevEnd)).length;

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
    leadsThisWeek: leadsThis,
    leadsPrevWeek: leadsPrev,
    hotPipeline: allCRM.filter(f => Boolean(f['TOB Status'])).length,
  };
}

// ─── Recruiter / Revenue ──────────────────────────────────────────────────────
const PIPELINE_TABLE_ID    = 'tblpHoIL0R3MTQOXF';
const PLACEMENTS_TABLE_ID  = 'tblvttoRo4DuZAIeW';
const INSTALMENTS_TABLE_ID = 'tblzsNY9hiQunnopk';

export async function fetchRecruiterKPIs(frame: TimeFrame = 'month'): Promise<RecruiterKPIs> {
  const b = timeBoundaries(frame);

  const [pipeline, placements] = await Promise.all([
    fetchAllFromBase<{ Status?: string; Created?: string; Name?: string }>(
      CANDIDATES_BASE_ID, PIPELINE_TABLE_ID, {}
    ),
    fetchAllFromBase<{ 'Created Date'?: string; Recruiter?: string }>(
      CLIENTS_BASE_ID, PLACEMENTS_TABLE_ID, {}
    ),
  ]);

  const phoneThis    = pipeline.filter(f => f.Status === 'Phone Interview'             && isInPeriod(f.Created, b.start, b.now)).length;
  const phonePrev    = pipeline.filter(f => f.Status === 'Phone Interview'             && isInPeriod(f.Created, b.prevStart, b.prevEnd)).length;
  const internalThis = pipeline.filter(f => f.Status === 'Internal Interview'          && isInPeriod(f.Created, b.start, b.now)).length;
  const internalPrev = pipeline.filter(f => f.Status === 'Internal Interview'          && isInPeriod(f.Created, b.prevStart, b.prevEnd)).length;
  const clientThis   = pipeline.filter(f => f.Status === 'Client-Candidate Interview'  && isInPeriod(f.Created, b.start, b.now)).length;
  const clientPrev   = pipeline.filter(f => f.Status === 'Client-Candidate Interview'  && isInPeriod(f.Created, b.prevStart, b.prevEnd)).length;

  const placementsThis = placements.filter(f => isInPeriod(f['Created Date'], b.start, b.now)).length;
  const placementsPrev = placements.filter(f => isInPeriod(f['Created Date'], b.prevStart, b.prevEnd)).length;

  // Group by recruiter (current period only)
  const recruiterMap = new Map<string, RecruiterStat>();
  const getOrCreate = (name: string) => {
    if (!recruiterMap.has(name)) {
      recruiterMap.set(name, { name, phoneInterviews: 0, internalInterviews: 0, clientInterviews: 0, placements: 0 });
    }
    return recruiterMap.get(name)!;
  };

  for (const f of pipeline.filter(f => isInPeriod(f.Created, b.start, b.now))) {
    const name = f.Name?.trim();
    if (!name) continue;
    const stat = getOrCreate(name);
    if (f.Status === 'Phone Interview')                  stat.phoneInterviews++;
    else if (f.Status === 'Internal Interview')          stat.internalInterviews++;
    else if (f.Status === 'Client-Candidate Interview')  stat.clientInterviews++;
  }

  for (const f of placements.filter(f => isInPeriod(f['Created Date'], b.start, b.now))) {
    const name = f.Recruiter?.trim();
    if (!name) continue;
    getOrCreate(name).placements++;
  }

  const byRecruiter = Array.from(recruiterMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  return {
    phoneInterviews: phoneThis,
    prevPhoneInterviews: phonePrev,
    internalInterviews: internalThis,
    prevInternalInterviews: internalPrev,
    clientInterviews: clientThis,
    prevClientInterviews: clientPrev,
    placements: placementsThis,
    prevPlacements: placementsPrev,
    conversionRate:     clientThis > 0 ? Math.round(placementsThis / clientThis * 100) : 0,
    prevConversionRate: clientPrev > 0 ? Math.round(placementsPrev / clientPrev * 100) : 0,
    activePipeline: pipeline.length,
    byRecruiter,
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

function timeBoundaries(frame: TimeFrame) {
  const now = Date.now();
  const d = new Date();
  let start: number;
  let prevStart: number;
  let prevEnd: number;

  if (frame === 'day') {
    const todayMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    start    = todayMidnight;
    prevEnd  = todayMidnight;
    prevStart = todayMidnight - 86_400_000;
  } else if (frame === 'week') {
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1; // days since Monday
    const monMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow).getTime();
    start    = monMidnight;
    prevEnd  = monMidnight;
    prevStart = monMidnight - 7 * 86_400_000;
  } else if (frame === 'month') {
    start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const elapsed = now - start;
    prevEnd  = start;
    prevStart = start - elapsed;
  } else { // 'year'
    start = new Date(d.getFullYear(), 0, 1).getTime();
    const elapsed = now - start;
    prevEnd  = start;
    prevStart = start - elapsed;
  }

  return { start, prevStart, prevEnd, now };
}

function isInPeriod(date: string | undefined, from: number, to: number) {
  if (!date) return false;
  const t = new Date(date).getTime();
  return !isNaN(t) && t >= from && t < to;
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
  const paidCandidates    = thisCandidates.filter(f => Boolean(f.UTMs?.trim()) && f.UTMs !== 'social');
  const socialCandidates  = thisCandidates.filter(f => f.UTMs === 'social');
  const organicCandidates = thisCandidates.filter(f => !f.UTMs?.trim());

  const paidClients    = thisClients.filter(f => f.Source === 'Paid Ads');
  const organicClients = thisClients.filter(f => f.Source !== 'Paid Ads');

  const paidTotal    = paidClients.length + paidCandidates.length;
  const paidQual     = paidClients.filter(isClientQualified).length + paidCandidates.filter(isCandidateQualified).length;
  const paidQualRate = paidTotal > 0 ? Math.round(paidQual / paidTotal * 100) : 0;
  const paidCpl      = paidQual > 0 ? Math.round(spend / paidQual) : 0;

  const socOrgTotal    = socialCandidates.length + organicClients.length + organicCandidates.length;
  const socOrgQual     = socialCandidates.filter(isCandidateQualified).length
                       + organicClients.filter(isClientQualified).length
                       + organicCandidates.filter(isCandidateQualified).length;
  const socOrgQualRate = socOrgTotal > 0 ? Math.round(socOrgQual / socOrgTotal * 100) : 0;

  return [
    { channel: 'Meta Paid',        leads: paidTotal,   qualRate: paidQualRate,   cpl: paidTotal > 0 ? paidCpl : null },
    { channel: 'Social / Organic', leads: socOrgTotal, qualRate: socOrgQualRate, cpl: null },
  ];
}

export async function fetchMarketingKPIs(frame: TimeFrame = 'month'): Promise<MarketingKPIs> {
  if (!CLIENTS_BASE_ID || !CANDIDATES_BASE_ID || !import.meta.env.VITE_META_TOKEN) {
    throw new Error('Marketing credentials not configured');
  }

  const [
    allClients,
    allCandidates,
    spend,
    budgetRecords,
    cpr,
  ] = await Promise.all([
    fetchAllFromBase<ClientLeadFields>(CLIENTS_BASE_ID, CLIENTS_TABLE_ID, {}),
    fetchAllFromBase<CandidateLeadFields>(CANDIDATES_BASE_ID, CANDIDATES_TABLE_ID, {}),
    fetchMetaSpend(),
    fetchAllFromBase<MarketingConfigFields>(CLIENTS_BASE_ID, 'Marketing Config', {
      maxRecords: '1',
    }).catch(() => [] as MarketingConfigFields[]),
    fetchMetaCprByGroup(),
  ]);

  const b = timeBoundaries(frame);

  // Candidates: bucket by Created date
  const thisCandidates = allCandidates.filter(f => isInPeriod(f.Created, b.start, b.now));
  const prevCandidates = allCandidates.filter(f => isInPeriod(f.Created, b.prevStart, b.prevEnd));

  // Client totals: new contacts created in period
  const thisClients = allClients.filter(f => isInPeriod(f.Created, b.start, b.now));
  const prevClients = allClients.filter(f => isInPeriod(f.Created, b.prevStart, b.prevEnd));

  // Client qualified: moved to CRM in period (by Last Updated Date, not Created)
  const qualClientsThis = allClients.filter(
    f => f.Status === 'Moved to CRM' && isInPeriod(f['Last Updated Date'], b.start, b.now)
  );
  const qualClientsPrev = allClients.filter(
    f => f.Status === 'Moved to CRM' && isInPeriod(f['Last Updated Date'], b.prevStart, b.prevEnd)
  );

  const clientQualRate = thisClients.length > 0
    ? Math.round((qualClientsThis.length / thisClients.length) * 100) : 0;
  const clientPrevQualRate = prevClients.length > 0
    ? Math.round((qualClientsPrev.length / prevClients.length) * 100) : 0;

  const clientMetric: LeadMetric = {
    total: thisClients.length,
    qualified: qualClientsThis.length,
    qualRate: clientQualRate,
    cpl: cpr.clientCpr,
    prevTotal: prevClients.length,
    prevQualified: qualClientsPrev.length,
    prevQualRate: clientPrevQualRate,
    prevCpl: cpr.prevClientCpr,
  };

  const weeklyBudget = budgetRecords[0]?.['Weekly Budget'] ?? 0;

  const candidateMetric = buildLeadMetric(thisCandidates, prevCandidates, isCandidateQualified, spend.thisWeek, spend.prevWeek);
  candidateMetric.cpl = cpr.candidateCpr;
  candidateMetric.prevCpl = cpr.prevCandidateCpr;

  return {
    candidates: candidateMetric,
    clients: clientMetric,
    channels: buildChannels(thisClients, thisCandidates, spend.thisWeek),
    spend,
    weeklyBudget,
  };
}

// ─── Revenue ──────────────────────────────────────────────────────────────────
type PlacementFields = {
  'Created Date'?: string;
  'Candidate Start Date'?: string;
};

type InstalmentFields = {
  'Installments #'?: number;
  'Sent Date'?: string;
  'Invoice Amount'?: number;
  Status?: string;
  Placements?: string[];
};

export async function fetchRevenueKPIs(frame: TimeFrame = 'month'): Promise<RevenueKPIs> {
  if (!CLIENTS_BASE_ID) throw new Error('Revenue credentials not configured');

  const b = timeBoundaries(frame);
  const today = Date.now();

  const [allPlacements, allInstalments, spend, salesData] = await Promise.all([
    fetchAllWithIdsFromBase<PlacementFields>(CLIENTS_BASE_ID, PLACEMENTS_TABLE_ID),
    fetchAllWithIdsFromBase<InstalmentFields>(CLIENTS_BASE_ID, INSTALMENTS_TABLE_ID),
    fetchMetaSpend().catch(() => ({ thisWeek: 0, prevWeek: 0 })),
    fetchSalesKPIs(frame).catch(() => null),
  ]);

  // Build placement lookup
  const placementMap = new Map(allPlacements.map(p => [p.id, p.fields]));

  // Group instalments by placement ID, sorted by Installments # ascending
  const byPlacement = new Map<string, typeof allInstalments>();
  for (const inst of allInstalments) {
    const pid = inst.fields.Placements?.[0];
    if (!pid) continue;
    if (!byPlacement.has(pid)) byPlacement.set(pid, []);
    byPlacement.get(pid)!.push(inst);
  }
  for (const insts of byPlacement.values()) {
    insts.sort((a, b) => (a.fields['Installments #'] ?? 0) - (b.fields['Installments #'] ?? 0));
  }

  const firstInstalments: InstalmentFields[] = [];
  const secondInstalments: InstalmentFields[] = [];
  let pendingSecond = 0;

  for (const [pid, insts] of byPlacement) {
    if (insts[0]) firstInstalments.push(insts[0].fields);
    if (insts[1]) {
      secondInstalments.push(insts[1].fields);
      if (insts[1].fields.Status === 'Scheduled') {
        const pf = placementMap.get(pid);
        const start = pf?.['Candidate Start Date'];
        if (start && new Date(start).getTime() <= today) pendingSecond++;
      }
    }
  }

  const wasInvoiced = (f: InstalmentFields) =>
    ['Sent', 'Wait', 'Paid'].includes(f.Status ?? '');

  const firstInvoiced     = firstInstalments.filter(f => wasInvoiced(f) && isInPeriod(f['Sent Date'], b.start, b.now)).length;
  const prevFirstInvoiced = firstInstalments.filter(f => wasInvoiced(f) && isInPeriod(f['Sent Date'], b.prevStart, b.prevEnd)).length;

  const firstPaid     = firstInstalments.filter(f => f.Status === 'Paid' && isInPeriod(f['Sent Date'], b.start, b.now));
  const prevFirstPaid = firstInstalments.filter(f => f.Status === 'Paid' && isInPeriod(f['Sent Date'], b.prevStart, b.prevEnd));

  const secondPaid     = secondInstalments.filter(f => f.Status === 'Paid' && isInPeriod(f['Sent Date'], b.start, b.now));
  const prevSecondPaid = secondInstalments.filter(f => f.Status === 'Paid' && isInPeriod(f['Sent Date'], b.prevStart, b.prevEnd));

  const sum = (arr: InstalmentFields[]) => arr.reduce((s, f) => s + (f['Invoice Amount'] ?? 0), 0);

  const firstCollectedAmount  = sum(firstPaid);
  const secondCollectedAmount = sum(secondPaid);
  const totalRevenue          = firstCollectedAmount + secondCollectedAmount;
  const prevTotalRevenue      = sum(prevFirstPaid) + sum(prevSecondPaid);

  const placements_    = allPlacements.filter(p => isInPeriod(p.fields['Created Date'], b.start, b.now)).length;
  const prevPlacements = allPlacements.filter(p => isInPeriod(p.fields['Created Date'], b.prevStart, b.prevEnd)).length;

  const clientsClosed = salesData?.closedClients ?? 0;
  const prevClientsClosed = salesData?.prevClosedClients ?? 0;
  const cac     = clientsClosed > 0 ? Math.round(spend.thisWeek / clientsClosed) : 0;
  const prevCac = prevClientsClosed > 0 ? Math.round(spend.prevWeek / prevClientsClosed) : 0;

  return {
    placements: placements_,
    prevPlacements,
    firstInvoiced,
    prevFirstInvoiced,
    firstCollected: firstPaid.length,
    prevFirstCollected: prevFirstPaid.length,
    firstCollectedAmount,
    pendingSecond,
    secondCollected: secondPaid.length,
    prevSecondCollected: prevSecondPaid.length,
    secondCollectedAmount,
    totalRevenue,
    prevTotalRevenue,
    cac,
    prevCac,
    adSpend: Math.round(spend.thisWeek),
    clientsClosed,
  };
}

// ─── AUS Placements (Finance dashboard) ──────────────────────────────────────
export async function fetchAusPlacements(): Promise<AusPlacement[]> {
  if (!CLIENTS_BASE_ID) throw new Error('Airtable credentials not configured');

  // NZ FY starts April 1 — if month < 3 (Jan–Mar) we're still in the previous FY year
  const now = new Date();
  const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  const records = await fetchAllFromBase<{
    'Candidate Name'?: string;
    'Company Name'?: string[];
    'Placement Year'?: number;
    [key: string]: unknown;
  }>(CLIENTS_BASE_ID, PLACEMENTS_TABLE_ID, {
    filterByFormula: `{Placement Year} = ${fyYear}`,
  });

  return records.map(f => {
    // Status field has a BOM character prefix — locate it by substring match
    const statusKey = Object.keys(f).find(k => k.includes('Status')) ?? '';
    const rawStatus = (f[statusKey] as string | undefined) ?? '';
    const companyName = f['Company Name'];
    return {
      candidate: (f['Candidate Name'] as string | undefined) ?? '',
      client: Array.isArray(companyName) ? companyName[0] ?? '' : (companyName as string | undefined) ?? '',
      status: rawStatus,
    };
  });
}

// ─── Retention ───────────────────────────────────────────────────────────────
type RetentionPlacementFields = {
  'Candidate Start Date'?: string;
  'Replacement Guarantee End Date'?: string;
  'Cancellation Date'?: string;
  'Created Date'?: string;
  [key: string]: unknown;
};

export async function fetchRetentionKPIs(): Promise<RetentionKPIs> {
  if (!CLIENTS_BASE_ID) throw new Error('Retention credentials not configured');

  const today = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = today - sevenDaysMs;
  const fourteenDaysAgo = today - 2 * sevenDaysMs;

  const d = new Date();
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();

  const records = await fetchAllFromBase<RetentionPlacementFields>(
    CLIENTS_BASE_ID,
    PLACEMENTS_TABLE_ID,
    {}
  );

  // Resolve BOM-prefixed Status field name
  const statusKey = records.length > 0
    ? (Object.keys(records[0]).find(k => k.includes('Status')) ?? '')
    : '';

  const getStatus = (f: RetentionPlacementFields): string =>
    (f[statusKey] as string | undefined) ?? '';

  // ── Metric 1: Active in guarantee window ─────────────────────────────────
  const activeInWindow = records.filter(f => {
    const start = f['Candidate Start Date'] ? new Date(f['Candidate Start Date']).getTime() : null;
    const end = f['Replacement Guarantee End Date'] ? new Date(f['Replacement Guarantee End Date']).getTime() : null;
    return start !== null && end !== null && start <= today && end >= today && getStatus(f) !== 'End';
  }).length;

  const prevActiveInWindow = records.filter(f => {
    const start = f['Candidate Start Date'] ? new Date(f['Candidate Start Date']).getTime() : null;
    const end = f['Replacement Guarantee End Date'] ? new Date(f['Replacement Guarantee End Date']).getTime() : null;
    return start !== null && end !== null && start <= sevenDaysAgo && end >= sevenDaysAgo && getStatus(f) !== 'End';
  }).length;

  // ── Metric 2: Past guarantee window ──────────────────────────────────────
  const pastWindow = records.filter(f => {
    const end = f['Replacement Guarantee End Date'] ? new Date(f['Replacement Guarantee End Date']).getTime() : null;
    return end !== null && end < today;
  }).length;

  const prevPastWindow = records.filter(f => {
    const end = f['Replacement Guarantee End Date'] ? new Date(f['Replacement Guarantee End Date']).getTime() : null;
    return end !== null && end < sevenDaysAgo;
  }).length;

  // ── Metric 3: Replacements triggered ─────────────────────────────────────
  const isTriggered = (f: RetentionPlacementFields) =>
    getStatus(f) === 'End' && Boolean(f['Cancellation Date']);

  const replacementsThisMonth = records.filter(f => {
    if (!isTriggered(f)) return false;
    const t = new Date(f['Cancellation Date']!).getTime();
    return t >= monthStart && t <= today;
  }).length;

  const replacementsThisWeek = records.filter(f => {
    if (!isTriggered(f)) return false;
    const t = new Date(f['Cancellation Date']!).getTime();
    return t >= sevenDaysAgo && t <= today;
  }).length;

  const replacementsPrevWeek = records.filter(f => {
    if (!isTriggered(f)) return false;
    const t = new Date(f['Cancellation Date']!).getTime();
    return t >= fourteenDaysAgo && t < sevenDaysAgo;
  }).length;

  // ── Metric 4: Replacement rate % (all-time) ───────────────────────────────
  const totalPlacements = records.length;
  const totalTriggered = records.filter(isTriggered).length;
  const replacementRate = totalPlacements > 0
    ? Math.round((totalTriggered / totalPlacements) * 1000) / 10
    : 0;

  const placementsBefore7d = records.filter(f => {
    const created = f['Created Date'] ? new Date(f['Created Date']).getTime() : 0;
    return created < sevenDaysAgo;
  });
  const triggeredBefore7d = placementsBefore7d.filter(f =>
    isTriggered(f) && new Date(f['Cancellation Date']!).getTime() < sevenDaysAgo
  ).length;
  const prevReplacementRate = placementsBefore7d.length > 0
    ? Math.round((triggeredBefore7d / placementsBefore7d.length) * 1000) / 10
    : 0;

  // ── Metric 5: Replacements in progress (Status = "Replacement") ───────────
  const inProgress = records.filter(f => getStatus(f) === 'Replacement').length;

  const inProgressThisWeek = records.filter(f => {
    if (getStatus(f) !== 'Replacement') return false;
    const created = f['Created Date'] ? new Date(f['Created Date']).getTime() : 0;
    return created >= sevenDaysAgo && created <= today;
  }).length;

  const inProgressPrevWeek = records.filter(f => {
    if (getStatus(f) !== 'Replacement') return false;
    const created = f['Created Date'] ? new Date(f['Created Date']).getTime() : 0;
    return created >= fourteenDaysAgo && created < sevenDaysAgo;
  }).length;

  return {
    activeInWindow, prevActiveInWindow,
    pastWindow, prevPastWindow,
    replacementsThisMonth, replacementsThisWeek, replacementsPrevWeek,
    replacementRate, prevReplacementRate,
    inProgress, inProgressThisWeek, inProgressPrevWeek,
  };
}

// ─── LTGP:CAC ─────────────────────────────────────────────────────────────────
// Actual contracted rates — update here if contracts change
const NZD_TO_AUD = 0.90;
const RECRUITER_HOURLY_NZD = 30;
const RECRUITER_HOURS_WEEK = 42.5;
const RECRUITER_COUNT = 2;
const WEEKS_PER_MONTH = 4.33;
const OWNER_MONTHLY_GROSS_NZD = 2500;
const OWNER_HOURS_WEEK = 42.5;
const CALL_DURATION_HRS = 0.5;
// Avg days from placement confirmed to fully billed ($8k at start + $8k at 30d = ~45 day midpoint)
const AVG_PLACEMENT_CYCLE_DAYS = 45;

function ltgpBoundaries(frame: LTGPFrame): { start: number; now: number } {
  const now = Date.now();
  if (frame === '30d')  return { start: now - 30  * 86_400_000, now };
  if (frame === '90d')  return { start: now - 90  * 86_400_000, now };
  if (frame === '12m')  return { start: now - 365 * 86_400_000, now };
  return { start: 0, now }; // 'all'
}

type LTGPPlacementFields = {
  'Created Date'?: string;
  'Company Name'?: string[] | string;
};

type LTGPInstalmentFields = {
  'Installments #'?: number;
  'Invoice Amount'?: number;
  Placements?: string[];
};

export async function fetchLTGPKPIs(frame: LTGPFrame): Promise<LTGPKPIs> {
  if (!CLIENTS_BASE_ID) throw new Error('LTGP credentials not configured');

  const [allPlacements, allInstalments, allCrmRecords, allClientLeads, metaResult] = await Promise.all([
    fetchAllFromBase<LTGPPlacementFields>(CLIENTS_BASE_ID, PLACEMENTS_TABLE_ID),
    fetchAllFromBase<LTGPInstalmentFields>(CLIENTS_BASE_ID, INSTALMENTS_TABLE_ID),
    fetchAllFromBase<{ 'TOB Status'?: string; 'Signed Date'?: string }>(CLIENTS_BASE_ID, CRM_TABLE_ID),
    fetchAllFromBase<{ 'Call Booked'?: string }>(CLIENTS_BASE_ID, CLIENTS_TABLE_ID),
    fetchMetaSpendByFrame(frame).catch(() => ({ candidateSpend: 0, clientSpend: 0, isEstimated: true })),
  ]);

  // ── avg_placements_per_client (all-time, lifetime metric) ──────────────────
  const companySet = new Set<string>();
  let totalPlacementsAllTime = 0;
  for (const p of allPlacements) {
    const co = Array.isArray(p['Company Name']) ? p['Company Name'][0] : p['Company Name'];
    const name = co?.trim();
    if (name) { companySet.add(name); totalPlacementsAllTime++; }
  }
  const avgPlacementsPerClient = companySet.size > 0 ? totalPlacementsAllTime / companySet.size : 1;

  // ── avg_placement_value from real invoice data (all-time) ──────────────────
  const feeByPlacement = new Map<string, number>();
  for (const inst of allInstalments) {
    const pid = inst.Placements?.[0];
    if (pid && inst['Invoice Amount']) {
      feeByPlacement.set(pid, (feeByPlacement.get(pid) ?? 0) + inst['Invoice Amount']);
    }
  }
  const totalFees = Array.from(feeByPlacement.values()).reduce((s, v) => s + v, 0);
  const avgPlacementValueAud = feeByPlacement.size > 0 ? totalFees / feeByPlacement.size : 16_000;

  // ── Period-filtered counts ─────────────────────────────────────────────────
  const { start, now } = ltgpBoundaries(frame);
  const candidatesPlaced = allPlacements.filter(p => isInPeriod(p['Created Date'], start, now)).length;
  const clientsWon = allCrmRecords.filter(
    c => c['TOB Status'] === 'Signed' && isInPeriod(c['Signed Date'], start, now)
  ).length;
  const ownerCallsCompleted = allClientLeads.filter(
    f => f['Call Booked'] != null && f['Call Booked'] !== '' && isInPeriod(f['Call Booked'], start, now)
  ).length;

  // ── Cost calculations ──────────────────────────────────────────────────────
  const monthlyRecruiterCostAud =
    RECRUITER_HOURLY_NZD * RECRUITER_HOURS_WEEK * RECRUITER_COUNT * WEEKS_PER_MONTH * NZD_TO_AUD;
  const ownerHourlyAud = (OWNER_MONTHLY_GROSS_NZD / (OWNER_HOURS_WEEK * WEEKS_PER_MONTH)) * NZD_TO_AUD;
  const ownerCostPerCall = ownerHourlyAud * CALL_DURATION_HRS;
  const ownerAcquisitionCost = ownerCallsCompleted * ownerCostPerCall;

  // Meta spend is billed in NZD — convert to AUD
  const candidateMetaSpend = metaResult.candidateSpend * NZD_TO_AUD;
  const clientMetaSpend = metaResult.clientSpend * NZD_TO_AUD;

  // ── CAC ───────────────────────────────────────────────────────────────────
  const candidateCac = candidatesPlaced > 0 ? candidateMetaSpend / candidatesPlaced : 0;
  const clientCac = clientsWon > 0
    ? (clientMetaSpend + ownerAcquisitionCost) / clientsWon
    : 0;

  // ── LTGP ──────────────────────────────────────────────────────────────────
  const recruiterCostPerPlacement = candidatesPlaced > 0 ? monthlyRecruiterCostAud / candidatesPlaced : 0;
  const grossProfitPerPlacement = avgPlacementValueAud - recruiterCostPerPlacement;
  const ltgpPerClient = grossProfitPerPlacement * avgPlacementsPerClient;

  // ── Ratio & checks ────────────────────────────────────────────────────────
  const ltgpCacRatio = clientCac > 0 ? ltgpPerClient / clientCac : 0;
  const paybackPeriodDays = grossProfitPerPlacement > 0
    ? (clientCac / grossProfitPerPlacement) * AVG_PLACEMENT_CYCLE_DAYS
    : 0;
  const clientFinancedPass = clientCac > 0 ? 8_000 > 2 * clientCac : false;

  // ── Flags ─────────────────────────────────────────────────────────────────
  const candidateCplNzd = candidatesPlaced > 0 ? (candidateMetaSpend / NZD_TO_AUD) / candidatesPlaced : 0;
  const clientCplNzd    = clientsWon > 0 ? (clientMetaSpend / NZD_TO_AUD) / clientsWon : 0;

  const flags: LTGPFlag[] = [
    {
      label: 'LTGP:CAC below 9:1',
      triggered: ltgpCacRatio > 0 && ltgpCacRatio < 9,
      severity: 'amber',
      formula: 'LTGP:CAC ratio < 9',
      actual: `${ltgpCacRatio.toFixed(1)}:1`,
      suggestion: 'Check candidate conversion rate, Meta lead quality, and avg placements per client.',
    },
    {
      label: 'LTGP:CAC below 6:1',
      triggered: ltgpCacRatio > 0 && ltgpCacRatio < 6,
      severity: 'red',
      formula: 'LTGP:CAC ratio < 6',
      actual: `${ltgpCacRatio.toFixed(1)}:1`,
      suggestion: 'Critical — acquisition is eating margin. Immediate review required.',
    },
    {
      label: 'Client-financed check fail',
      triggered: clientCac > 0 && !clientFinancedPass,
      severity: 'amber',
      formula: '$8,000 < 2 × Client CAC',
      actual: `$8,000 vs 2 × $${Math.round(clientCac).toLocaleString()}`,
      suggestion: 'First payment does not cover acquisition cost. Review client CAC and payment terms.',
    },
    {
      label: 'Candidate cost per lead > NZD $150',
      triggered: candidateCplNzd > 150,
      severity: 'amber',
      formula: 'Candidate Meta spend ÷ candidates placed > $150 NZD',
      actual: `NZD $${Math.round(candidateCplNzd).toLocaleString()}`,
      suggestion: 'Meta candidate spend is inefficient. Review creative and audience targeting.',
    },
    {
      label: 'Client cost per lead > NZD $200',
      triggered: clientCplNzd > 200,
      severity: 'amber',
      formula: 'Client Meta spend ÷ clients won > $200 NZD',
      actual: `NZD $${Math.round(clientCplNzd).toLocaleString()}`,
      suggestion: 'Client Meta spend is inefficient. Check creative and owner close rate.',
    },
    {
      label: 'Avg placements per client < 1.5',
      triggered: avgPlacementsPerClient < 1.5,
      severity: 'amber',
      formula: 'All-time placements ÷ unique clients < 1.5',
      actual: avgPlacementsPerClient.toFixed(2),
      suggestion: 'Clients not returning. Investigate post-placement relationship.',
    },
    {
      label: 'Candidates placed < 3 in period',
      triggered: candidatesPlaced > 0 && candidatesPlaced < 3,
      severity: 'amber',
      formula: 'candidates placed < 3',
      actual: String(candidatesPlaced),
      suggestion: 'Volume low relative to fixed recruiter cost. Candidate CAC will spike.',
    },
    {
      label: 'No placements in period',
      triggered: candidatesPlaced === 0,
      severity: 'red',
      formula: 'candidates placed = 0',
      actual: '0',
      suggestion: 'No placements recorded. Check date range or Airtable data.',
    },
  ];

  return {
    candidateMetaSpend,
    clientMetaSpend,
    metaSplitIsEstimated: metaResult.isEstimated,
    ownerCallsCompleted,
    ownerCostPerCall,
    ownerAcquisitionCost,
    candidatesPlaced,
    clientsWon,
    avgPlacementValueAud,
    monthlyRecruiterCostAud,
    recruiterCostPerPlacement,
    grossProfitPerPlacement,
    avgPlacementsPerClient,
    candidateCac,
    clientCac,
    ltgpPerClient,
    ltgpCacRatio,
    paybackPeriodDays,
    clientFinancedPass,
    flags,
  };
}
