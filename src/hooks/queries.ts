import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  fetchSalesKPIs,
  fetchMarketingKPIs,
  fetchRecruiterKPIs,
  fetchRevenueKPIs,
  fetchRetentionKPIs,
  fetchAusPlacements,
  fetchLTGPKPIs,
} from '../services/airtable';
import { fetchXeroFinanceData, hasXeroCredentials } from '../services/xero';
import type { TimeFrame, LTGPFrame } from '../types';

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

export const hasLTGPCredentials = hasAirtableKey && hasClientsBase;

export function useLTGPKPIs(frame: LTGPFrame = '30d') {
  return useQuery({
    queryKey: ['ltgp', frame],
    queryFn: () => fetchLTGPKPIs(frame),
    enabled: hasLTGPCredentials,
    placeholderData: keepPreviousData,
  });
}
