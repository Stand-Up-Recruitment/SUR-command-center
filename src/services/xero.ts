import type { XeroFinanceData } from '../types';
import { env } from '../lib/env.js';

const WEBHOOK_URL = env.VITE_N8N_FINANCE_WEBHOOK_URL as string | undefined;

export const hasXeroCredentials = Boolean(WEBHOOK_URL);

export async function fetchXeroFinanceData(): Promise<XeroFinanceData> {
  if (!WEBHOOK_URL) throw new Error('VITE_N8N_FINANCE_WEBHOOK_URL not configured');
  const res = await fetch(WEBHOOK_URL, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Xero webhook HTTP ${res.status}`);
  return res.json() as Promise<XeroFinanceData>;
}
