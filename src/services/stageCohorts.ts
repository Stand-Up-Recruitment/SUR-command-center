import type { StageCohortKPIs, TimeFrame } from '../types';
import { env } from '../lib/env.js';
import { timeBoundaries } from './airtable.js';

const WEBHOOK_URL = env.VITE_N8N_STAGE_COHORTS_WEBHOOK_URL as string | undefined;

export const hasStageCohortCredentials = Boolean(WEBHOOK_URL);

export async function fetchStageCohorts(frame: TimeFrame = 'month'): Promise<StageCohortKPIs> {
  if (!WEBHOOK_URL) throw new Error('VITE_N8N_STAGE_COHORTS_WEBHOOK_URL not configured');
  const b = timeBoundaries(frame);
  const iso = (ms: number) => new Date(ms).toISOString();
  const params = new URLSearchParams({ currentFrom: iso(b.start), currentTo: iso(b.now), prevFrom: iso(b.prevStart), prevTo: iso(b.prevEnd) });
  const res = await fetch(`${WEBHOOK_URL}?${params}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Stage cohorts webhook HTTP ${res.status}`);
  return res.json() as Promise<StageCohortKPIs>;
}
