import type { RetentionPlacement } from '../types';

const WEBHOOK_URL = import.meta.env.VITE_N8N_RETENTION_WEBHOOK_URL as string | undefined;

export const hasRetentionCredentials = Boolean(WEBHOOK_URL);

// The webhook reads every placement's notes from JobAdder (rate-limited), so it takes ~25s.
export async function fetchRetentionPlacements(): Promise<RetentionPlacement[]> {
  if (!WEBHOOK_URL) throw new Error('VITE_N8N_RETENTION_WEBHOOK_URL not configured');
  const res = await fetch(WEBHOOK_URL, { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`Retention webhook HTTP ${res.status}`);
  const body = await res.json() as { placements?: RetentionPlacement[] };
  return body.placements ?? [];
}
