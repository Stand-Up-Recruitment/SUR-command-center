import { supabase } from '../lib/supabase';
import type {
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
} from '../types';
import { fetchMetaSpend } from './metaAds';

// ─── Supabase fetch helpers ───────────────────────────────────────────────────
async function fetchAll<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

async function fetchWhere<T>(table: string, column: string, value: unknown): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').eq(column, value);
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

// ─── Time helpers ─────────────────────────────────────────────────────────────
function timeBoundaries(frame: TimeFrame) {
  const now = Date.now();
  const d = new Date();
  let start: number;
  let prevStart: number;
  let prevEnd: number;

  if (frame === 'day') {
    const todayMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    start     = todayMidnight;
    prevEnd   = todayMidnight;
    prevStart = todayMidnight - 86_400_000;
  } else if (frame === 'week') {
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const monMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow).getTime();
    start     = monMidnight;
    prevEnd   = monMidnight;
    prevStart = monMidnight - 7 * 86_400_000;
  } else if (frame === 'month') {
    start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const elapsed = now - start;
    prevEnd   = start;
    prevStart = start - elapsed;
  } else {
    start = new Date(d.getFullYear(), 0, 1).getTime();
    const elapsed = now - start;
    prevEnd   = start;
    prevStart = start - elapsed;
  }

  return { start, prevStart, prevEnd, now };
}

function isInPeriod(date: string | undefined | null, from: number, to: number) {
  if (!date) return false;
  const t = new Date(date).getTime();
  return !isNaN(t) && t >= from && t < to;
}

// ─── Sales ────────────────────────────────────────────────────────────────────
export async function fetchSalesKPIs(frame: TimeFrame = 'month'): Promise<SalesKPIs> {
  const b = timeBoundaries(frame);

  const [allClients, allCRM, allMainClient] = await Promise.all([
    fetchAll<{ status?: string; last_updated_date?: string; created_at?: string }>('clients'),
    fetchAll<{ sent_date?: string; tob_status?: string }>('crm_pipeline'),
    fetchAll<{ signed_date?: string }>('closed_clients'),
  ]);

  const bookedCalls     = allClients.filter(f => f.status === 'Moved to CRM' && isInPeriod(f.last_updated_date, b.start, b.now)).length;
  const prevBookedCalls = allClients.filter(f => f.status === 'Moved to CRM' && isInPeriod(f.last_updated_date, b.prevStart, b.prevEnd)).length;

  const crmThis  = allCRM.filter(f => isInPeriod(f.sent_date, b.start, b.now)).length;
  const crmPrev  = allCRM.filter(f => isInPeriod(f.sent_date, b.prevStart, b.prevEnd)).length;

  const closedThis = allMainClient.filter(f => isInPeriod(f.signed_date, b.start, b.now)).length;
  const closedPrev = allMainClient.filter(f => isInPeriod(f.signed_date, b.prevStart, b.prevEnd)).length;

  const leadsThis = allClients.filter(f => isInPeriod(f.created_at, b.start, b.now)).length;
  const leadsPrev = allClients.filter(f => isInPeriod(f.created_at, b.prevStart, b.prevEnd)).length;

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
    hotPipeline: allCRM.filter(f => Boolean(f.tob_status)).length,
  };
}

// ─── Recruiter ────────────────────────────────────────────────────────────────
export async function fetchRecruiterKPIs(frame: TimeFrame = 'month'): Promise<RecruiterKPIs> {
  const b = timeBoundaries(frame);

  const [pipeline, placements] = await Promise.all([
    fetchAll<{ status?: string; created_at?: string; name?: string }>('candidates_pipeline'),
    fetchAll<{ created_at?: string; recruiter?: string }>('placements'),
  ]);

  const phoneThis    = pipeline.filter(f => f.status === 'Phone Interview'            && isInPeriod(f.created_at, b.start, b.now)).length;
  const phonePrev    = pipeline.filter(f => f.status === 'Phone Interview'            && isInPeriod(f.created_at, b.prevStart, b.prevEnd)).length;
  const internalThis = pipeline.filter(f => f.status === 'Internal Interview'         && isInPeriod(f.created_at, b.start, b.now)).length;
  const internalPrev = pipeline.filter(f => f.status === 'Internal Interview'         && isInPeriod(f.created_at, b.prevStart, b.prevEnd)).length;
  const clientThis   = pipeline.filter(f => f.status === 'Client-Candidate Interview' && isInPeriod(f.created_at, b.start, b.now)).length;
  const clientPrev   = pipeline.filter(f => f.status === 'Client-Candidate Interview' && isInPeriod(f.created_at, b.prevStart, b.prevEnd)).length;

  const placementsThis = placements.filter(f => isInPeriod(f.created_at, b.start, b.now)).length;
  const placementsPrev = placements.filter(f => isInPeriod(f.created_at, b.prevStart, b.prevEnd)).length;

  const recruiterMap = new Map<string, RecruiterStat>();
  const getOrCreate = (name: string) => {
    if (!recruiterMap.has(name)) {
      recruiterMap.set(name, { name, phoneInterviews: 0, internalInterviews: 0, clientInterviews: 0, placements: 0 });
    }
    return recruiterMap.get(name)!;
  };

  for (const f of pipeline.filter(f => isInPeriod(f.created_at, b.start, b.now))) {
    const name = f.name?.trim();
    if (!name) continue;
    const stat = getOrCreate(name);
    if (f.status === 'Phone Interview')                  stat.phoneInterviews++;
    else if (f.status === 'Internal Interview')          stat.internalInterviews++;
    else if (f.status === 'Client-Candidate Interview')  stat.clientInterviews++;
  }

  for (const f of placements.filter(f => isInPeriod(f.created_at, b.start, b.now))) {
    const name = f.recruiter?.trim();
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
type ClientLeadRow = {
  status?: string;
  source?: string;
  created_at?: string;
  last_updated_date?: string;
};

type CandidateLeadRow = {
  nz_citizenship_status?: string;
  trade_occupation?: string;
  utm_source?: string;
  created_at?: string;
};

type MarketingConfigRow = {
  weekly_budget?: number;
};

function isClientQualified(f: ClientLeadRow) {
  return f.status === 'Moved to CRM';
}

function isCandidateQualified(f: CandidateLeadRow) {
  return (
    f.nz_citizenship_status === 'NZ Citizen' &&
    Boolean(f.trade_occupation?.trim())
  );
}

function buildLeadMetric(
  thisRecs: (ClientLeadRow | CandidateLeadRow)[],
  prevRecs: (ClientLeadRow | CandidateLeadRow)[],
  isQual: (f: ClientLeadRow | CandidateLeadRow) => boolean,
  spendThis: number,
  spendPrev: number,
): LeadMetric {
  const total      = thisRecs.length;
  const qualified  = thisRecs.filter(isQual).length;
  const qualRate   = total > 0 ? Math.round((qualified / total) * 100) : 0;
  const cpl        = qualified > 0 ? Math.round(spendThis / qualified) : 0;

  const prevTotal     = prevRecs.length;
  const prevQualified = prevRecs.filter(isQual).length;
  const prevQualRate  = prevTotal > 0 ? Math.round((prevQualified / prevTotal) * 100) : 0;
  const prevCpl       = prevQualified > 0 ? Math.round(spendPrev / prevQualified) : 0;

  return { total, qualified, qualRate, cpl, prevTotal, prevQualified, prevQualRate, prevCpl };
}

function buildChannels(
  thisClients: ClientLeadRow[],
  thisCandidates: CandidateLeadRow[],
  spend: number,
): ChannelRow[] {
  const paidCandidates    = thisCandidates.filter(f => Boolean(f.utm_source?.trim()) && f.utm_source !== 'social');
  const socialCandidates  = thisCandidates.filter(f => f.utm_source === 'social');
  const organicCandidates = thisCandidates.filter(f => !f.utm_source?.trim());

  const paidClients    = thisClients.filter(f => f.source === 'Paid Ads');
  const organicClients = thisClients.filter(f => f.source !== 'Paid Ads');

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
  const [allClients, allCandidates, spend, budgetRecords] = await Promise.all([
    fetchAll<ClientLeadRow>('clients'),
    fetchAll<CandidateLeadRow>('candidates'),
    fetchMetaSpend(),
    fetchAll<MarketingConfigRow>('marketing_config').catch(() => [] as MarketingConfigRow[]),
  ]);

  const b = timeBoundaries(frame);

  const thisCandidates = allCandidates.filter(f => isInPeriod(f.created_at, b.start, b.now));
  const prevCandidates = allCandidates.filter(f => isInPeriod(f.created_at, b.prevStart, b.prevEnd));

  const thisClients = allClients.filter(f => isInPeriod(f.created_at, b.start, b.now));
  const prevClients = allClients.filter(f => isInPeriod(f.created_at, b.prevStart, b.prevEnd));

  const qualClientsThis = allClients.filter(
    f => f.status === 'Moved to CRM' && isInPeriod(f.last_updated_date, b.start, b.now)
  );
  const qualClientsPrev = allClients.filter(
    f => f.status === 'Moved to CRM' && isInPeriod(f.last_updated_date, b.prevStart, b.prevEnd)
  );

  const clientQualRate     = thisClients.length > 0 ? Math.round((qualClientsThis.length / thisClients.length) * 100) : 0;
  const clientPrevQualRate = prevClients.length > 0 ? Math.round((qualClientsPrev.length / prevClients.length) * 100) : 0;
  const clientCpl          = qualClientsThis.length > 0 ? Math.round(spend.thisWeek / qualClientsThis.length) : 0;
  const clientPrevCpl      = qualClientsPrev.length > 0 ? Math.round(spend.prevWeek / qualClientsPrev.length) : 0;

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

  const weeklyBudget = budgetRecords[0]?.weekly_budget ?? 0;

  return {
    candidates: buildLeadMetric(thisCandidates, prevCandidates, isCandidateQualified, spend.thisWeek, spend.prevWeek),
    clients: clientMetric,
    channels: buildChannels(thisClients, thisCandidates, spend.thisWeek),
    spend,
    weeklyBudget,
  };
}

// ─── Revenue ──────────────────────────────────────────────────────────────────
type PlacementRow = {
  airtable_id: string;
  created_at?: string;
  candidate_start_date?: string;
};

type InstalmentRow = {
  airtable_id: string;
  instalment_number?: number;
  sent_date?: string;
  invoice_amount?: number;
  status?: string;
  placement_ids?: string[];
};

export async function fetchRevenueKPIs(frame: TimeFrame = 'month'): Promise<RevenueKPIs> {
  const b = timeBoundaries(frame);
  const today = Date.now();

  const [allPlacements, allInstalments, spend, salesData] = await Promise.all([
    fetchAll<PlacementRow>('placements'),
    fetchAll<InstalmentRow>('instalments'),
    fetchMetaSpend().catch(() => ({ thisWeek: 0, prevWeek: 0 })),
    fetchSalesKPIs(frame).catch(() => null),
  ]);

  const placementMap = new Map(allPlacements.map(p => [p.airtable_id, p]));

  const byPlacement = new Map<string, InstalmentRow[]>();
  for (const inst of allInstalments) {
    const pid = inst.placement_ids?.[0];
    if (!pid) continue;
    if (!byPlacement.has(pid)) byPlacement.set(pid, []);
    byPlacement.get(pid)!.push(inst);
  }
  for (const insts of byPlacement.values()) {
    insts.sort((a, b) => (a.instalment_number ?? 0) - (b.instalment_number ?? 0));
  }

  const firstInstalments: InstalmentRow[] = [];
  const secondInstalments: InstalmentRow[] = [];
  let pendingSecond = 0;

  for (const [pid, insts] of byPlacement) {
    if (insts[0]) firstInstalments.push(insts[0]);
    if (insts[1]) {
      secondInstalments.push(insts[1]);
      if (insts[1].status === 'Scheduled') {
        const pf = placementMap.get(pid);
        const start = pf?.candidate_start_date;
        if (start && new Date(start).getTime() <= today) pendingSecond++;
      }
    }
  }

  const wasInvoiced = (f: InstalmentRow) => ['Sent', 'Wait', 'Paid'].includes(f.status ?? '');

  const firstInvoiced     = firstInstalments.filter(f => wasInvoiced(f) && isInPeriod(f.sent_date, b.start, b.now)).length;
  const prevFirstInvoiced = firstInstalments.filter(f => wasInvoiced(f) && isInPeriod(f.sent_date, b.prevStart, b.prevEnd)).length;

  const firstPaid     = firstInstalments.filter(f => f.status === 'Paid' && isInPeriod(f.sent_date, b.start, b.now));
  const prevFirstPaid = firstInstalments.filter(f => f.status === 'Paid' && isInPeriod(f.sent_date, b.prevStart, b.prevEnd));

  const secondPaid     = secondInstalments.filter(f => f.status === 'Paid' && isInPeriod(f.sent_date, b.start, b.now));
  const prevSecondPaid = secondInstalments.filter(f => f.status === 'Paid' && isInPeriod(f.sent_date, b.prevStart, b.prevEnd));

  const sum = (arr: InstalmentRow[]) => arr.reduce((s, f) => s + (f.invoice_amount ?? 0), 0);

  const firstCollectedAmount  = sum(firstPaid);
  const secondCollectedAmount = sum(secondPaid);
  const totalRevenue          = firstCollectedAmount + secondCollectedAmount;
  const prevTotalRevenue      = sum(prevFirstPaid) + sum(prevSecondPaid);

  const placements_    = allPlacements.filter(p => isInPeriod(p.created_at, b.start, b.now)).length;
  const prevPlacements = allPlacements.filter(p => isInPeriod(p.created_at, b.prevStart, b.prevEnd)).length;

  const clientsClosed     = salesData?.closedClients ?? 0;
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

// ─── AUS Placements ───────────────────────────────────────────────────────────
export async function fetchAusPlacements(): Promise<AusPlacement[]> {
  const now = new Date();
  const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  const records = await fetchWhere<{
    candidate_name?: string;
    company_name?: string;
    status?: string;
    placement_year?: number;
  }>('placements', 'placement_year', fyYear);

  return records.map(f => ({
    candidate: f.candidate_name ?? '',
    client:    f.company_name ?? '',
    status:    f.status ?? '',
  }));
}

// ─── Retention ────────────────────────────────────────────────────────────────
type RetentionRow = {
  candidate_start_date?: string;
  replacement_guarantee_end_date?: string;
  cancellation_date?: string;
  created_at?: string;
  status?: string;
};

export async function fetchRetentionKPIs(): Promise<RetentionKPIs> {
  const today         = Date.now();
  const sevenDaysMs   = 7 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo  = today - sevenDaysMs;
  const fourteenAgo   = today - 2 * sevenDaysMs;

  const d = new Date();
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();

  const records = await fetchAll<RetentionRow>('placements');

  const activeInWindow = records.filter(f => {
    const start = f.candidate_start_date ? new Date(f.candidate_start_date).getTime() : null;
    const end   = f.replacement_guarantee_end_date ? new Date(f.replacement_guarantee_end_date).getTime() : null;
    return start !== null && end !== null && start <= today && end >= today && f.status !== 'End';
  }).length;

  const prevActiveInWindow = records.filter(f => {
    const start = f.candidate_start_date ? new Date(f.candidate_start_date).getTime() : null;
    const end   = f.replacement_guarantee_end_date ? new Date(f.replacement_guarantee_end_date).getTime() : null;
    return start !== null && end !== null && start <= sevenDaysAgo && end >= sevenDaysAgo && f.status !== 'End';
  }).length;

  const pastWindow = records.filter(f => {
    const end = f.replacement_guarantee_end_date ? new Date(f.replacement_guarantee_end_date).getTime() : null;
    return end !== null && end < today;
  }).length;

  const prevPastWindow = records.filter(f => {
    const end = f.replacement_guarantee_end_date ? new Date(f.replacement_guarantee_end_date).getTime() : null;
    return end !== null && end < sevenDaysAgo;
  }).length;

  const isTriggered = (f: RetentionRow) => f.status === 'End' && Boolean(f.cancellation_date);

  const replacementsThisMonth = records.filter(f => {
    if (!isTriggered(f)) return false;
    const t = new Date(f.cancellation_date!).getTime();
    return t >= monthStart && t <= today;
  }).length;

  const replacementsThisWeek = records.filter(f => {
    if (!isTriggered(f)) return false;
    const t = new Date(f.cancellation_date!).getTime();
    return t >= sevenDaysAgo && t <= today;
  }).length;

  const replacementsPrevWeek = records.filter(f => {
    if (!isTriggered(f)) return false;
    const t = new Date(f.cancellation_date!).getTime();
    return t >= fourteenAgo && t < sevenDaysAgo;
  }).length;

  const totalPlacements = records.length;
  const totalTriggered  = records.filter(isTriggered).length;
  const replacementRate = totalPlacements > 0
    ? Math.round((totalTriggered / totalPlacements) * 1000) / 10
    : 0;

  const placementsBefore7d  = records.filter(f => {
    const created = f.created_at ? new Date(f.created_at).getTime() : 0;
    return created < sevenDaysAgo;
  });
  const triggeredBefore7d   = placementsBefore7d.filter(f =>
    isTriggered(f) && new Date(f.cancellation_date!).getTime() < sevenDaysAgo
  ).length;
  const prevReplacementRate = placementsBefore7d.length > 0
    ? Math.round((triggeredBefore7d / placementsBefore7d.length) * 1000) / 10
    : 0;

  const inProgress = records.filter(f => f.status === 'Replacement').length;

  const inProgressThisWeek = records.filter(f => {
    if (f.status !== 'Replacement') return false;
    const created = f.created_at ? new Date(f.created_at).getTime() : 0;
    return created >= sevenDaysAgo && created <= today;
  }).length;

  const inProgressPrevWeek = records.filter(f => {
    if (f.status !== 'Replacement') return false;
    const created = f.created_at ? new Date(f.created_at).getTime() : 0;
    return created >= fourteenAgo && created < sevenDaysAgo;
  }).length;

  return {
    activeInWindow, prevActiveInWindow,
    pastWindow, prevPastWindow,
    replacementsThisMonth, replacementsThisWeek, replacementsPrevWeek,
    replacementRate, prevReplacementRate,
    inProgress, inProgressThisWeek, inProgressPrevWeek,
  };
}
