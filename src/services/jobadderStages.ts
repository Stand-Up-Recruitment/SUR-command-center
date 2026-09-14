import type { JobAdderStageKPIs, TimeFrame } from '../types';
import { timeBoundaries } from './airtable';

const WEBHOOK_URL = import.meta.env.VITE_N8N_JOBADDER_STAGES_WEBHOOK_URL as string | undefined;

export const hasJobAdderStageCredentials = Boolean(WEBHOOK_URL);

const toDateParam = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export async function fetchJobAdderStageKPIs(frame: TimeFrame = 'month'): Promise<JobAdderStageKPIs> {
  if (!WEBHOOK_URL) throw new Error('VITE_N8N_JOBADDER_STAGES_WEBHOOK_URL not configured');
  const b = timeBoundaries(frame);
  const params = new URLSearchParams({
    currentFrom: toDateParam(b.start),
    currentTo: toDateParam(b.now),
    prevFrom: toDateParam(b.prevStart),
    prevTo: toDateParam(b.prevEnd),
  });
  const res = await fetch(`${WEBHOOK_URL}?${params}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`JobAdder stages webhook HTTP ${res.status}`);
  return res.json() as Promise<JobAdderStageKPIs>;
}
