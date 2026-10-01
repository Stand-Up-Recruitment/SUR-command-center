import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  fetchSalesKPIs,
  fetchMarketingKPIs,
  fetchRecruiterKPIs,
  fetchRevenueKPIs,
  fetchRetentionKPIs,
  fetchAusPlacements,
  fetchScheduledInvoices,
  fetchCacKPIs,
  fetchMarketingMonth,
  fetchSalesMonth,
} from '../services/airtable';
import { fetchXeroFinanceData, hasXeroCredentials } from '../services/xero';
import { fetchMetaSpendByFrame, fetchMetaCampaignBreakdown, fetchMetaAdBreakdown } from '../services/metaAds';
import { fetchVoiceCallKPIs } from '../services/voiceCalls';
import { fetchJobAdderStageKPIs, hasJobAdderStageCredentials } from '../services/jobadderStages';
import { fetchJobAging, hasOpenJobsCredentials } from '../services/jobadderJobs';
import { monthWindow } from '../lib/nzTime';
import type { TimeFrame, LTGPFrame, OrganicMonth, MarketingSettings, SalesSettings } from '../types';

const hasAirtableKey    = Boolean(import.meta.env.VITE_AIRTABLE_API_KEY);
const hasClientsBase    = Boolean(import.meta.env.VITE_AIRTABLE_CLIENTS_BASE_ID);
const hasCandidatesBase = Boolean(import.meta.env.VITE_AIRTABLE_CANDIDATES_BASE_ID);

export const hasSalesCredentials      = hasAirtableKey && hasClientsBase;
export const hasMarketingCredentials  = hasAirtableKey && hasClientsBase && hasCandidatesBase && Boolean(import.meta.env.VITE_META_TOKEN);
export const hasRecruitCredentials    = hasAirtableKey && hasCandidatesBase && hasClientsBase;
export const hasRevenueCredentials    = hasAirtableKey && hasClientsBase;
export const hasRetentionCredentials  = hasAirtableKey && hasClientsBase;

export function useSalesKPIs(frame: TimeFrame = 'month') {
  return useQuery({
    queryKey: ['sales', frame],
    queryFn: () => fetchSalesKPIs(frame),
    enabled: hasSalesCredentials,
    placeholderData: keepPreviousData,
  });
}

export function useMarketingKPIs(frame: TimeFrame = 'month') {
  return useQuery({
    queryKey: ['marketing', frame],
    queryFn: () => fetchMarketingKPIs(frame),
    enabled: hasMarketingCredentials,
    placeholderData: keepPreviousData,
  });
}

export function useRecruiterKPIs(frame: TimeFrame = 'month') {
  return useQuery({
    queryKey: ['recruitment', frame],
    queryFn: () => fetchRecruiterKPIs(frame),
    enabled: hasRecruitCredentials,
    placeholderData: keepPreviousData,
  });
}

export function useVoiceCallKPIs(frame: TimeFrame = 'month') {
  return useQuery({
    queryKey: ['recruitment-voice-calls', frame],
    queryFn: () => fetchVoiceCallKPIs(frame),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000, // endpoint data changes a few times an hour; proxy caches 5 min
    retry: 1,
  });
}

export function useJobAdderStageKPIs(frame: TimeFrame = 'month') {
  return useQuery({
    queryKey: ['recruitment-jobadder-stages', frame],
    queryFn: () => fetchJobAdderStageKPIs(frame),
    enabled: hasJobAdderStageCredentials,
    placeholderData: keepPreviousData,
  });
}

export function useJobAging() {
  return useQuery({
    queryKey: ['job-aging'],
    queryFn: fetchJobAging,
    enabled: hasOpenJobsCredentials,
  });
}

export function useRevenueKPIs(frame: TimeFrame = 'month') {
  return useQuery({
    queryKey: ['revenue', frame],
    queryFn: () => fetchRevenueKPIs(frame),
    enabled: hasRevenueCredentials,
    placeholderData: keepPreviousData,
  });
}

export function useRetentionKPIs() {
  return useQuery({
    queryKey: ['retention'],
    queryFn: fetchRetentionKPIs,
    enabled: hasRetentionCredentials,
  });
}

export function useXeroFinanceData() {
  return useQuery({
    queryKey: ['finance-xero'],
    queryFn: fetchXeroFinanceData,
    enabled: hasXeroCredentials,
  });
}

export function useAusPlacements() {
  return useQuery({
    queryKey: ['finance-aus-placements'],
    queryFn: fetchAusPlacements,
  });
}

export function useScheduledInvoices() {
  return useQuery({
    queryKey: ['finance-scheduled-invoices'],
    queryFn: fetchScheduledInvoices,
  });
}

export const hasMetaCredentials = Boolean(import.meta.env.VITE_META_TOKEN);

export function useMetaAusSpend(frame: LTGPFrame = '30d') {
  return useQuery({
    queryKey: ['meta-aus-spend', frame],
    queryFn: () => fetchMetaSpendByFrame(frame),
    enabled: hasMetaCredentials,
    placeholderData: keepPreviousData,
  });
}

export const hasCacCredentials = hasAirtableKey && hasClientsBase;

export function useCacKPIs(grossMarginPct?: number, jobBoardAdvertising90d?: number, prevJobBoardAdvertising90d?: number, audNzdMonthlyRates?: Record<string, number>) {
  return useQuery({
    queryKey: ['cac', grossMarginPct ?? 0, jobBoardAdvertising90d ?? 0, prevJobBoardAdvertising90d ?? 0, audNzdMonthlyRates ?? {}],
    queryFn: () => fetchCacKPIs(grossMarginPct, jobBoardAdvertising90d, prevJobBoardAdvertising90d, audNzdMonthlyRates),
    enabled: hasCacCredentials,
    placeholderData: keepPreviousData,
  });
}

// ─── Marketing tab (month view) ───────────────────────────────────────────────
export function useMarketingMonth(month: string) {
  return useQuery({
    queryKey: ['marketing-month', month],
    queryFn: () => fetchMarketingMonth(monthWindow(month)),
    enabled: hasMarketingCredentials,
    placeholderData: keepPreviousData,
  });
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({ error: `${url} returned ${res.status}` }));
  if (!res.ok) throw new Error(body.error ?? `${url} returned ${res.status}`);
  return body as T;
}

export function useOrganicMonth(month: string) {
  return useQuery({
    queryKey: ['marketing-organic', month],
    queryFn: () => getJson<OrganicMonth>(`/api/organic?month=${month}`),
    placeholderData: keepPreviousData,
    staleTime: 15 * 60_000,
    retry: 1,
  });
}

export function useMarketingSettings() {
  return useQuery({
    queryKey: ['marketing-settings'],
    queryFn: () => getJson<MarketingSettings & { error?: string }>('/api/marketing-settings'),
    retry: 1,
  });
}

export function useSaveMarketingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ settings, adminPassword }: { settings: MarketingSettings; adminPassword: string }) =>
      getJson<MarketingSettings>('/api/marketing-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
        body: JSON.stringify(settings),
      }),
    onSuccess: data => qc.setQueryData(['marketing-settings'], data),
  });
}

// ─── Sales tab (month view) ───────────────────────────────────────────────────
export function useSalesMonth(month: string) {
  return useQuery({
    queryKey: ['sales-month', month],
    queryFn: () => fetchSalesMonth(monthWindow(month)),
    enabled: hasSalesCredentials,
    placeholderData: keepPreviousData,
  });
}

export function useSalesSettings() {
  return useQuery({
    queryKey: ['sales-settings'],
    queryFn: () => getJson<SalesSettings & { error?: string }>('/api/sales-settings'),
    retry: 1,
  });
}

export function useSaveSalesSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ settings, adminPassword }: { settings: SalesSettings; adminPassword: string }) =>
      getJson<SalesSettings>('/api/sales-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
        body: JSON.stringify(settings),
      }),
    onSuccess: data => qc.setQueryData(['sales-settings'], data),
  });
}

/** Campaign table + per-ad rows for the Paid lane drill-down; only fetched once opened. */
export function useMetaBreakdown(month: string, enabled: boolean) {
  return useQuery({
    queryKey: ['marketing-breakdown', month],
    queryFn: async () => {
      const w = monthWindow(month);
      const [campaigns, ads] = await Promise.all([fetchMetaCampaignBreakdown(w.cur, w.prev), fetchMetaAdBreakdown(w.cur)]);
      return { campaigns, ads };
    },
    enabled: enabled && hasMetaCredentials,
    staleTime: 10 * 60_000,
  });
}
