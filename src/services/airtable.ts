import type {
  AirtableResponse,
  SalesKPIs,
  RecruiterKPIs,
  RecruiterStat,
  RollingRates,
  MarketingKPIs,
  RevenueKPIs,
  LeadMetric,
  ChannelRow,
  TimeFrame,
  AusPlacement,
  ScheduledInvoice,
  RetentionKPIs,
  CacKPIs,
  AcquisitionCacs,
  HandoffTotals,
  MarketingMonth,
} from '../types';
import {
  fetchMetaSpend, fetchMetaSpendByFrame, fetchMetaSpendPrevPeriod, fetchMetaCprByGroup,
  fetchMetaPaidRange, fetchMetaSpendRange, fetchMetaSpendMonthly,
} from './metaAds';
import { toMs, trailingDays, last12Months, type MonthWindow } from '../lib/nzTime';

const API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY as string;
const CLIENTS_BASE_ID = import.meta.env.VITE_AIRTABLE_CLIENTS_BASE_ID as string;
const CANDIDATES_BASE_ID = import.meta.env.VITE_AIRTABLE_CANDIDATES_BASE_ID as string;
const CLIENTS_TABLE_ID = 'tblF4uPjZ7eF4BFzP';
const CANDIDATES_TABLE_ID = 'tblHhlHjb7keWPUdE';
const CRM_TABLE_ID = 'tbl4XcHW2Gb7PF4fw';
const MAIN_CLIENT_TABLE_ID = 'tblHJjDpCeTgevOvI';
const SALES_TRANSCRIPT_TABLE_ID = 'tblUntytJJFaaWW6w'; // lives in CLIENTS_BASE_ID, confirmed against the live schema
const SALES_TIME_COST_PER_CALL = 0.25 * 72; // 15 min @ $72/hr

// Approximate flat AUD→NZD rate, shared so it isn't duplicated per call site.
// The Calculation Rules doc specifies a monthly-average rate per transaction month;
// LTGP uses the webhook's audNzdMonthlyRates and falls back to this when a month is
// missing. Cash-flow invoice conversion still uses this flat approximation.
export const AUD_TO_NZD_APPROX = 1 / 0.90;

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

  const d = new Date();
  const thisMonthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const lastMonthStart = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
  const tobSignedThisMonth = allMainClient.filter(f => isInPeriod(f['Signed Date'], thisMonthStart, Date.now())).length;
  const tobSignedLastMonth = allMainClient.filter(f => isInPeriod(f['Signed Date'], lastMonthStart, thisMonthStart)).length;

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
    tobSignedThisMonth,
    tobSignedLastMonth,
  };
}

// ─── Recruiter / Revenue ──────────────────────────────────────────────────────
const PIPELINE_TABLE_ID    = 'tblpHoIL0R3MTQOXF';
const PLACEMENTS_TABLE_ID  = 'tblvttoRo4DuZAIeW';
const INSTALMENTS_TABLE_ID = 'tblzsNY9hiQunnopk';

// A placement is a "fall-through" when it was later terminated (Status='End' with a
// Cancellation Date) — same predicate the Retention card uses. Attributed to the period
// the contract was signed ('Created Date'), not the period it terminated, per spec.
const isFallThrough = (f: { Status?: string; 'Cancellation Date'?: string }) =>
  f.Status === 'End' && Boolean(f['Cancellation Date']);

type PipelineFields = { Status?: string; Created?: string; Name?: string; 'Candidates Email'?: string[] };
type RecruiterPlacementFields = { 'Created Date'?: string; Recruiter?: string; Status?: string; 'Cancellation Date'?: string };

// The pipeline table logs one record per stage per candidate, but a candidate is sometimes
// logged twice at the same stage. Count each candidate once per stage per period.
function uniqueStageRecords(records: PipelineFields[], perRecruiter: boolean) {
  const seen = new Set<string>();
  return records.filter(f => {
    const key = [f['Candidates Email']?.[0] ?? f.Created, f.Status, perRecruiter ? f.Name?.trim() : ''].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const monthKey = (d: string | Date) => {
  const x = new Date(d);
  return x.getFullYear() * 12 + x.getMonth();
};

// Int → client and client → contract over a window (the last 4 full calendar months).
function rollingRates(pipeline: PipelineFields[], placements: RecruiterPlacementFields[], from: number, to: number): RollingRates {
  const inWindow = uniqueStageRecords(pipeline.filter(f => isInPeriod(f.Created, from, to)), false);
  const internal = inWindow.filter(f => f.Status === 'Internal Interview').length;
  const client = inWindow.filter(f => f.Status === 'Client-Candidate Interview').length;
  const placed = placements.filter(f => f.Status !== 'End' && isInPeriod(f['Created Date'], from, to)).length;
  return {
    intToClient: internal > 0 ? client / internal : 0,
    clientToContract: client > 0 ? placed / client : 0,
    monthsOfData: new Set(inWindow.map(f => monthKey(f.Created!))).size,
  };
}

export async function fetchRecruiterKPIs(frame: TimeFrame = 'month'): Promise<RecruiterKPIs> {
  const b = timeBoundaries(frame);

  const [pipeline, placements] = await Promise.all([
    fetchAllFromBase<PipelineFields>(CANDIDATES_BASE_ID, PIPELINE_TABLE_ID, {}),
    fetchAllFromBase<RecruiterPlacementFields>(CLIENTS_BASE_ID, PLACEMENTS_TABLE_ID, {}),
  ]);

  const pipelineThis = pipeline.filter(f => isInPeriod(f.Created, b.start, b.now));
  const pipelinePrev = pipeline.filter(f => isInPeriod(f.Created, b.prevStart, b.prevEnd));
  const teamThis = uniqueStageRecords(pipelineThis, false);
  const teamPrev = uniqueStageRecords(pipelinePrev, false);
  const countStage = (records: PipelineFields[], stage: string) => records.filter(f => f.Status === stage).length;

  const phoneThis    = countStage(teamThis, 'Phone Interview');
  const phonePrev    = countStage(teamPrev, 'Phone Interview');
  const internalThis = countStage(teamThis, 'Internal Interview');
  const internalPrev = countStage(teamPrev, 'Internal Interview');
  const clientThis   = countStage(teamThis, 'Client-Candidate Interview');
  const clientPrev   = countStage(teamPrev, 'Client-Candidate Interview');

  // "No Show-up" rows are logged when a recruiter moves a candidate from Internal Interview
  // to No Show-up in JobAdder. Counted per candidate: a no-show is dropped if the same
  // candidate later has an Internal Interview row (rebooked and attended).
  const lastAttended = new Map<string, number>();
  for (const f of pipeline) {
    const c = f['Candidates Email']?.[0];
    if (f.Status !== 'Internal Interview' || !c || !f.Created) continue;
    lastAttended.set(c, Math.max(lastAttended.get(c) ?? 0, Date.parse(f.Created)));
  }
  const isNoShow = (f: PipelineFields) => {
    if (f.Status !== 'No Show-up') return false;
    const c = f['Candidates Email']?.[0];
    return !c || !f.Created || (lastAttended.get(c) ?? 0) <= Date.parse(f.Created);
  };
  const noShowsThis = teamThis.filter(isNoShow).length;
  const noShowsPrev = teamPrev.filter(isNoShow).length;

  const placementsThis = placements.filter(f => f.Status !== 'End' && isInPeriod(f['Created Date'], b.start, b.now)).length;
  const placementsPrev = placements.filter(f => f.Status !== 'End' && isInPeriod(f['Created Date'], b.prevStart, b.prevEnd)).length;

  // Fall-through rate uses ALL contracts signed in the period (including ones that later
  // ended) as the denominator, unlike placementsThis/Prev above which excludes ended ones.
  const signedThis = placements.filter(f => isInPeriod(f['Created Date'], b.start, b.now));
  const signedPrev = placements.filter(f => isInPeriod(f['Created Date'], b.prevStart, b.prevEnd));
  const fallThroughsThis = signedThis.filter(isFallThrough).length;
  const fallThroughsPrev = signedPrev.filter(isFallThrough).length;
  const fallThroughRate     = signedThis.length > 0 ? Math.round(fallThroughsThis / signedThis.length * 100) : 0;
  const prevFallThroughRate = signedPrev.length > 0 ? Math.round(fallThroughsPrev / signedPrev.length * 100) : 0;

  // Rolling window (last 4 full months) and 12-month chart range — always monthly,
  // independent of the selected frame.
  const today = new Date();
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const rollingStart = new Date(today.getFullYear(), today.getMonth() - 4, 1).getTime();
  const chartMonthKeys = Array.from({ length: 12 }, (_, i) => monthKey(today) - 11 + i);
  const months = chartMonthKeys.map(k =>
    new Date(Math.floor(k / 12), k % 12, 1).toLocaleDateString('en-NZ', { month: 'short' }));

  // Group by recruiter
  const recruiterMap = new Map<string, RecruiterStat>();
  const getOrCreate = (name: string) => {
    if (!recruiterMap.has(name)) {
      recruiterMap.set(name, {
        name, phoneInterviews: 0, prevPhoneInterviews: 0, internalInterviews: 0, prevInternalInterviews: 0,
        clientInterviews: 0, prevClientInterviews: 0, noShows: 0, prevNoShows: 0, placements: 0, prevPlacements: 0,
        fallThroughRate: 0, prevFallThroughRate: 0,
        rolling: { intToClient: 0, clientToContract: 0, monthsOfData: 0 },
        monthlyPlacements: [],
      });
    }
    return recruiterMap.get(name)!;
  };
  const signedCountByRecruiter = new Map<string, number>();
  const fallThroughCountByRecruiter = new Map<string, number>();
  const prevSignedCountByRecruiter = new Map<string, number>();
  const prevFallThroughCountByRecruiter = new Map<string, number>();

  for (const f of uniqueStageRecords(pipelineThis, true)) {
    const name = f.Name?.trim();
    if (!name) continue;
    const stat = getOrCreate(name);
    if (f.Status === 'Phone Interview')                  stat.phoneInterviews++;
    else if (f.Status === 'Internal Interview')          stat.internalInterviews++;
    else if (f.Status === 'Client-Candidate Interview')  stat.clientInterviews++;
    else if (isNoShow(f))                                stat.noShows++;
  }

  for (const f of uniqueStageRecords(pipelinePrev, true)) {
    const name = f.Name?.trim();
    if (!name) continue;
    const stat = getOrCreate(name);
    if (f.Status === 'Phone Interview')                  stat.prevPhoneInterviews++;
    else if (f.Status === 'Internal Interview')          stat.prevInternalInterviews++;
    else if (f.Status === 'Client-Candidate Interview')  stat.prevClientInterviews++;
    else if (isNoShow(f))                                stat.prevNoShows++;
  }

  for (const f of placements.filter(f => f.Status !== 'End' && isInPeriod(f['Created Date'], b.start, b.now))) {
    const name = f.Recruiter?.trim();
    if (!name) continue;
    getOrCreate(name).placements++;
  }

  for (const f of placements.filter(f => f.Status !== 'End' && isInPeriod(f['Created Date'], b.prevStart, b.prevEnd))) {
    const name = f.Recruiter?.trim();
    if (!name) continue;
    getOrCreate(name).prevPlacements++;
  }

  for (const f of signedThis) {
    const name = f.Recruiter?.trim();
    if (!name) continue;
    getOrCreate(name); // ensure recruiter exists even if all their signings later ended
    signedCountByRecruiter.set(name, (signedCountByRecruiter.get(name) ?? 0) + 1);
    if (isFallThrough(f)) fallThroughCountByRecruiter.set(name, (fallThroughCountByRecruiter.get(name) ?? 0) + 1);
  }

  for (const f of signedPrev) {
    const name = f.Recruiter?.trim();
    if (!name) continue;
    getOrCreate(name);
    prevSignedCountByRecruiter.set(name, (prevSignedCountByRecruiter.get(name) ?? 0) + 1);
    if (isFallThrough(f)) prevFallThroughCountByRecruiter.set(name, (prevFallThroughCountByRecruiter.get(name) ?? 0) + 1);
  }

  for (const [name, stat] of recruiterMap) {
    const signed = signedCountByRecruiter.get(name) ?? 0;
    const prevSigned = prevSignedCountByRecruiter.get(name) ?? 0;
    stat.fallThroughRate     = signed > 0 ? Math.round((fallThroughCountByRecruiter.get(name) ?? 0) / signed * 100) : 0;
    stat.prevFallThroughRate = prevSigned > 0 ? Math.round((prevFallThroughCountByRecruiter.get(name) ?? 0) / prevSigned * 100) : 0;

    const ownPipeline = pipeline.filter(f => f.Name?.trim() === name);
    const ownPlacements = placements.filter(f => f.Recruiter?.trim() === name);
    stat.rolling = rollingRates(ownPipeline, ownPlacements, rollingStart, thisMonthStart);

    // Months before the recruiter's first activity (any pipeline record or contract) are null.
    const activityKeys = [
      ...ownPipeline.filter(f => f.Created).map(f => monthKey(f.Created!)),
      ...ownPlacements.filter(f => f['Created Date']).map(f => monthKey(f['Created Date']!)),
    ];
    const firstKey = activityKeys.length > 0 ? Math.min(...activityKeys) : Infinity;
    stat.monthlyPlacements = chartMonthKeys.map(k => k < firstKey ? null
      : ownPlacements.filter(f => f.Status !== 'End' && f['Created Date'] && monthKey(f['Created Date']) === k).length);
  }

  const byRecruiter = Array.from(recruiterMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  return {
    phoneInterviews: phoneThis,
    prevPhoneInterviews: phonePrev,
    internalInterviews: internalThis,
    prevInternalInterviews: internalPrev,
    clientInterviews: clientThis,
    prevClientInterviews: clientPrev,
    noShows: noShowsThis,
    prevNoShows: noShowsPrev,
    placements: placementsThis,
    prevPlacements: placementsPrev,
    conversionRate:     clientThis > 0 ? Math.round(placementsThis / clientThis * 100) : 0,
    prevConversionRate: clientPrev > 0 ? Math.round(placementsPrev / clientPrev * 100) : 0,
    fallThroughRate,
    prevFallThroughRate,
    activePipeline: pipeline.length,
    rolling: rollingRates(pipeline, placements, rollingStart, thisMonthStart),
    months,
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

export function timeBoundaries(frame: TimeFrame) {
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
    prevEnd   = start;
    prevStart = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
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
    // Status field name is exactly "Status", but the raw record key can carry a leading
    // BOM character — strip it before comparing so this matches the "Status" column only,
    // not any of the table's other *Status fields (Relocation Status, Testimonial Status, etc).
    const statusKey = Object.keys(f).find(k => k.replace(/^\uFEFF/, '') === 'Status') ?? '';
    const rawStatus = (f[statusKey] as string | undefined) ?? '';
    const companyName = f['Company Name'];
    return {
      candidate: (f['Candidate Name'] as string | undefined) ?? '',
      client: Array.isArray(companyName) ? companyName[0] ?? '' : (companyName as string | undefined) ?? '',
      status: rawStatus,
    };
  });
}

export async function fetchScheduledInvoices(): Promise<ScheduledInvoice[]> {
  if (!CLIENTS_BASE_ID) throw new Error('Airtable credentials not configured');

  const records = await fetchAllFromBase<{
    Status?: string;
    InvoiceID?: string;
    'Invoice Amount'?: number;
    'Due Date'?: string;
  }>(CLIENTS_BASE_ID, INSTALMENTS_TABLE_ID, {
    filterByFormula: `AND({Status} = 'Scheduled', {InvoiceID} = '')`,
  });

  return records
    .filter(f => f['Due Date'])
    .map(f => ({ amount: f['Invoice Amount'] ?? 0, dueDate: f['Due Date']! }));
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

  // Resolve the "Status" field name (raw record key can carry a leading BOM character);
  // exact match only — this table also has Relocation Status, Testimonial Status, etc.
  const statusKey = records.length > 0
    ? (Object.keys(records[0]).find(k => k.replace(/^\uFEFF/, '') === 'Status') ?? '')
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

// ─── CAC ──────────────────────────────────────────────────────────────────────
const CAC_WINDOW_DAYS = 90;

type MainClientFields = {
  'Signed Date'?: string;
  'Company Name'?: string;
};

type PlacementCacFields = {
  'Created Date'?: string;
  'Candidate Start Date'?: string;
  'Cancellation Date'?: string;
  Status?: string;
  'Total Amount'?: number;
  'Candidate-Client Contract Sign Status'?: boolean;
  'Company ID'?: string[]; // linked Main Client record ID(s)
};

// Calculation Rules 4.3: placements created in the window with a signed
// candidate-client contract (Pending counts), excluding $0 fees and ones
// cancelled before the candidate started.
function isPlacementCountedForCac(p: PlacementCacFields, from: number, to: number) {
  if (!isInPeriod(p['Created Date'], from, to)) return false;
  if (p['Candidate-Client Contract Sign Status'] !== true) return false;
  if (!p['Total Amount']) return false;
  if (p['Cancellation Date'] && p['Candidate Start Date']) {
    const cancelled = new Date(p['Cancellation Date']).getTime();
    const started = new Date(p['Candidate Start Date']).getTime();
    if (cancelled < started) return false;
  }
  return true;
}

function isPlacementCountedForLtgp(p: PlacementCacFields) {
  if (p.Status === 'Pending') return false;
  if (!['Live', 'Completed', 'End'].includes(p.Status ?? '')) return false;
  if (!p['Total Amount']) return false;
  if (p['Cancellation Date'] && p['Candidate Start Date']) {
    const cancelled = new Date(p['Cancellation Date']).getTime();
    const started = new Date(p['Candidate Start Date']).getTime();
    if (cancelled < started) return false;
  }
  return true;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

type CallBookingFields = {
  Created?: string;
  'Meeting Link'?: string;
  'Call Booked'?: string;
};

// Calls booked = Client Paid Ads rows with a booked meeting, counted by the date the
// row was created (the booking), whatever happened after (no-shows still count).
function countCallsBooked(rows: CallBookingFields[], from: number, to: number) {
  return rows.filter(r =>
    Boolean(r['Meeting Link']?.trim() || r['Call Booked']?.trim()) && isInPeriod(r.Created, from, to)
  ).length;
}

function countCandidates(rows: CandidateLeadFields[], from: number, to: number) {
  const inWindow = rows.filter(c => isInPeriod(c.Created, from, to));
  return { total: inWindow.length, qualified: inWindow.filter(isCandidateQualified).length };
}

type AcquisitionData = {
  mainClients: MainClientFields[];      // "Stand Up Recruitment" test record already excluded
  salesTranscripts: { Created?: string }[];
  candidates: CandidateLeadFields[];
  callBookings: CallBookingFields[];
};

// The one place every acquisition CAC is defined. Each tab reads its CAC from here.
function acquisitionCacs(
  d: AcquisitionData,
  from: number,
  to: number,
  meta: { clientSpend: number; candidateSpend: number },
): AcquisitionCacs & { clientAcquisitionCost: number } {
  const clientsWon = d.mainClients.filter(c => isInPeriod(c['Signed Date'], from, to)).length;
  const salesCalls = d.salesTranscripts.filter(t => isInPeriod(t.Created, from, to)).length;
  const callsBooked = countCallsBooked(d.callBookings, from, to);
  const { qualified } = countCandidates(d.candidates, from, to);
  const clientAcquisitionCost = meta.clientSpend + salesCalls * SALES_TIME_COST_PER_CALL;
  return {
    clientAcquisitionCost,
    cacPerSignedClient: clientsWon > 0 ? clientAcquisitionCost / clientsWon : 0,
    cacPerBookedCall: callsBooked > 0 ? meta.clientSpend / callsBooked : 0,
    cacPerQualifiedCandidate: qualified > 0 ? meta.candidateSpend / qualified : 0,
  };
}

async function fetchAcquisitionData(): Promise<AcquisitionData> {
  const [mainClients, salesTranscripts, candidates, callBookings] = await Promise.all([
    fetchAllFromBase<MainClientFields>(CLIENTS_BASE_ID, MAIN_CLIENT_TABLE_ID, {}, ['Signed Date', 'Company Name']),
    fetchAllFromBase<{ Created?: string }>(CLIENTS_BASE_ID, SALES_TRANSCRIPT_TABLE_ID, {}, ['Created'])
      .catch(() => [] as { Created?: string }[]),
    fetchAllFromBase<CandidateLeadFields>(CANDIDATES_BASE_ID, CANDIDATES_TABLE_ID, {}, ['NZ Citizenship Status', 'Trade / Occupation', 'Created']),
    fetchAllFromBase<CallBookingFields>(CLIENTS_BASE_ID, CLIENTS_TABLE_ID, {}, ['Created', 'Meeting Link', 'Call Booked']),
  ]);
  return {
    mainClients: mainClients.filter(c => c['Company Name'] !== 'Stand Up Recruitment'),
    salesTranscripts, candidates, callBookings,
  };
}

export async function fetchCacKPIs(
  grossMarginPct: number = 0,
  jobBoardAdvertising90d: number = 0,
  prevJobBoardAdvertising90d: number = 0,
  audNzdMonthlyRates: Record<string, number> = {},
): Promise<CacKPIs> {
  if (!CLIENTS_BASE_ID || !CANDIDATES_BASE_ID) throw new Error('CAC credentials not configured');

  const [allMainClientsRaw, allPlacements, acquisition, metaResult, prevMetaResult] = await Promise.all([
    fetchAllWithIdsFromBase<MainClientFields>(CLIENTS_BASE_ID, MAIN_CLIENT_TABLE_ID),
    fetchAllFromBase<PlacementCacFields>(CLIENTS_BASE_ID, PLACEMENTS_TABLE_ID),
    fetchAcquisitionData(),
    fetchMetaSpendByFrame('90d').catch(() => ({ candidateSpend: 0, clientSpend: 0 })),
    fetchMetaSpendPrevPeriod('90d').catch(() => null),
  ]);

  // Exclude the "Stand Up Recruitment" test record from every client-based count.
  const allMainClients = allMainClientsRaw.filter(c => c.fields['Company Name'] !== 'Stand Up Recruitment');

  const now = Date.now();
  const start = now - CAC_WINDOW_DAYS * 86_400_000;
  const prevEnd = start;
  const prevStart = prevEnd - CAC_WINDOW_DAYS * 86_400_000;

  const cur = acquisitionCacs(acquisition, start, now, metaResult);
  const cacPerSignedClient = cur.cacPerSignedClient;
  const cacPerQualifiedCandidate = cur.cacPerQualifiedCandidate;

  // Job Board Advertising (Xero Opex account, 100% AUS, trailing 90 days) comes from
  // the n8n Finance webhook's jobBoardAdvertising90d field — its own advertising/
  // ausAdvertising fields are FY-to-date and cover the wrong period for this window.
  const placementsInWindow = allPlacements.filter(p => isPlacementCountedForCac(p, start, now)).length;
  const placementCac = placementsInWindow > 0
    ? (cur.clientAcquisitionCost + metaResult.candidateSpend + jobBoardAdvertising90d) / placementsInWindow
    : 0;

  const hasPrevPeriod = prevMetaResult !== null;
  let prevCacPerSignedClient = 0;
  let prevPlacementCac = 0;
  let prevCacPerQualifiedCandidate = 0;
  if (prevMetaResult) {
    const prev = acquisitionCacs(acquisition, prevStart, prevEnd, prevMetaResult);
    prevCacPerSignedClient = prev.cacPerSignedClient;
    prevCacPerQualifiedCandidate = prev.cacPerQualifiedCandidate;

    const prevPlacementsInWindow = allPlacements.filter(
      p => isPlacementCountedForCac(p, prevStart, prevEnd)
    ).length;
    prevPlacementCac = prevPlacementsInWindow > 0
      ? (prev.clientAcquisitionCost + prevMetaResult.candidateSpend + prevJobBoardAdvertising90d) / prevPlacementsInWindow
      : 0;
  }

  // ── CAC card deltas: last 90 days vs the prior 90 days, as a % change ──────
  const pctChange = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);
  const cacPerSignedClientDeltaPct = hasPrevPeriod ? pctChange(cacPerSignedClient, prevCacPerSignedClient) : null;
  const placementCacDeltaPct = hasPrevPeriod ? pctChange(placementCac, prevPlacementCac) : null;
  const cacPerQualifiedCandidateDeltaPct = hasPrevPeriod ? pctChange(cacPerQualifiedCandidate, prevCacPerQualifiedCandidate) : null;

  // ── LTGP / LTGP:CAC ──────────────────────────────────────────────────────────
  // Cohort clients are joined to their placements via Placements' "Company ID"
  // linked-record field (confirmed against the live Airtable schema).
  const cohortStart = new Date('2026-04-01').getTime();
  const cohortEnd = now - CAC_WINDOW_DAYS * 86_400_000;
  const cohortClients = allMainClients.filter(c => isInPeriod(c.fields['Signed Date'], cohortStart, cohortEnd));

  const placementsByClientId = new Map<string, PlacementCacFields[]>();
  for (const p of allPlacements) {
    if (!isPlacementCountedForLtgp(p)) continue;
    for (const clientId of p['Company ID'] ?? []) {
      if (!placementsByClientId.has(clientId)) placementsByClientId.set(clientId, []);
      placementsByClientId.get(clientId)!.push(p);
    }
  }

  const placedClientGrossProfits: number[] = [];
  for (const client of cohortClients) {
    const linked = placementsByClientId.get(client.id);
    if (!linked || linked.length === 0) continue;
    // Calculation Rules 3.2 step 4: monthly average AUD→NZD rate for the month
    // the candidate started, falling back to the flat rate if that month is missing.
    const feesNZD = linked.reduce((sum, p) => {
      const rate = audNzdMonthlyRates[(p['Candidate Start Date'] ?? '').slice(0, 7)] ?? AUD_TO_NZD_APPROX;
      return sum + (p['Total Amount'] ?? 0) * rate;
    }, 0);
    placedClientGrossProfits.push(feesNZD * (grossMarginPct / 100));
  }

  const cohortSize = cohortClients.length;
  const placedClientCount = placedClientGrossProfits.length;
  const ltgpMethod: 'median' | 'average' = placedClientCount < 30 ? 'median' : 'average';
  const ltgp = ltgpMethod === 'median'
    ? median(placedClientGrossProfits)
    : placedClientGrossProfits.reduce((a, b) => a + b, 0) / (placedClientCount || 1);
  const placementRate = cohortSize > 0 ? placedClientCount / cohortSize : 0;
  const costPerPlacedClient = placementRate > 0 ? cacPerSignedClient / placementRate : 0;
  const ltgpToCac = costPerPlacedClient > 0 ? ltgp / costPerPlacedClient : 0;

  return {
    cacPerSignedClient,
    placementCac,
    hasPrevPeriod,
    prevCacPerSignedClient,
    prevPlacementCac,
    cacPerQualifiedCandidate,
    prevCacPerQualifiedCandidate,
    ltgp,
    ltgpMethod,
    placementRate,
    costPerPlacedClient,
    ltgpToCac,
    cohortSize,
    placedClientCount,
    cacPerSignedClientDeltaPct,
    placementCacDeltaPct,
    cacPerQualifiedCandidateDeltaPct,
  };
}

// ─── Marketing tab (month view) ───────────────────────────────────────────────
function handoffTotals(d: AcquisitionData, range: { since: string; until: string }, clientSpend: number): HandoffTotals {
  const { from, to } = toMs(range);
  const callsBooked = countCallsBooked(d.callBookings, from, to);
  const { total, qualified } = countCandidates(d.candidates, from, to);
  return {
    callsBooked,
    qualifiedCandidates: qualified,
    totalCandidates: total,
    qualRate: total > 0 ? (qualified / total) * 100 : 0,
    costPerBookedCall: callsBooked > 0 ? clientSpend / callsBooked : 0,
  };
}

/**
 * Everything the Marketing tab needs for one month: paid (Meta-reported), handoff
 * (our own systems), and the trailing-90 CACs as of the window's last day vs the
 * same day last month, all via acquisitionCacs, never recalculated here.
 */
export async function fetchMarketingMonth(w: MonthWindow): Promise<MarketingMonth> {
  if (!CLIENTS_BASE_ID || !CANDIDATES_BASE_ID) throw new Error('Marketing credentials not configured');
  const cacCur = trailingDays(w.cur.until, CAC_WINDOW_DAYS);
  const cacPrev = trailingDays(w.prev.until, CAC_WINDOW_DAYS);
  const months = last12Months(w.month, w.cur.until);

  const [data, paidCur, paidPrev, spend90Cur, spend90Prev, monthly] = await Promise.all([
    fetchAcquisitionData(),
    fetchMetaPaidRange(w.cur),
    fetchMetaPaidRange(w.prev),
    fetchMetaSpendRange(cacCur),
    fetchMetaSpendRange(cacPrev),
    fetchMetaSpendMonthly({ since: months[0].since, until: w.cur.until }),
  ]);

  const cac = (range: { since: string; until: string }, spend: { clientSpend: number; candidateSpend: number }) => {
    const { from, to } = toMs(range);
    const { cacPerSignedClient, cacPerBookedCall, cacPerQualifiedCandidate } = acquisitionCacs(data, from, to, spend);
    return { cacPerSignedClient, cacPerBookedCall, cacPerQualifiedCandidate };
  };

  return {
    paid: { cur: paidCur, prev: paidPrev },
    cac: { cur: cac(cacCur, spend90Cur), prev: cac(cacPrev, spend90Prev) },
    handoff: {
      cur: handoffTotals(data, w.cur, paidCur.client.spend),
      prev: handoffTotals(data, w.prev, paidPrev.client.spend),
    },
    spendSeries: months.map(m => ({
      key: m.key, label: m.label,
      client: monthly[m.key]?.client ?? 0,
      candidate: monthly[m.key]?.candidate ?? 0,
    })),
    handoffSeries: months.map(m => {
      const h = handoffTotals(data, m, 0);
      return { key: m.key, label: m.label, callsBooked: h.callsBooked, qualifiedCandidates: h.qualifiedCandidates };
    }),
  };
}
