import type { JobAgingKPIs } from '../types';

const WEBHOOK_URL = import.meta.env.VITE_N8N_OPEN_JOBS_WEBHOOK_URL as string | undefined;

export const hasOpenJobsCredentials = Boolean(WEBHOOK_URL);

export async function fetchJobAging(): Promise<JobAgingKPIs> {
  if (!WEBHOOK_URL) throw new Error('VITE_N8N_OPEN_JOBS_WEBHOOK_URL not configured');
  const res = await fetch(WEBHOOK_URL, { method: 'POST', signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Open jobs webhook HTTP ${res.status}`);
  return res.json() as Promise<JobAgingKPIs>;
}
