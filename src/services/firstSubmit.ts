import type { FirstSubmitKPIs } from '../types';
import { env } from '../lib/env.js';

const WEBHOOK_URL = env.VITE_N8N_FIRST_SUBMIT_WEBHOOK_URL as string | undefined;

export const hasFirstSubmitCredentials = Boolean(WEBHOOK_URL);

// The webhook pages through every "Submitted to client" note in JobAdder, so it takes ~20s.
export async function fetchFirstSubmitKPIs(): Promise<FirstSubmitKPIs> {
  if (!WEBHOOK_URL) throw new Error('VITE_N8N_FIRST_SUBMIT_WEBHOOK_URL not configured');
  const res = await fetch(WEBHOOK_URL, { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`First submit webhook HTTP ${res.status}`);
  return res.json() as Promise<FirstSubmitKPIs>;
}
