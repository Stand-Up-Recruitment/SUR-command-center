import type { ClientInvoice } from '../types';

const WEBHOOK_URL = import.meta.env.VITE_N8N_CLIENT_INVOICES_WEBHOOK_URL as string | undefined;

export const hasClientInvoicesCredentials = Boolean(WEBHOOK_URL);

// Every Australian sales invoice (AUTHORISED or PAID, all dates) with its paid date.
export async function fetchClientInvoices(): Promise<ClientInvoice[]> {
  if (!WEBHOOK_URL) throw new Error('VITE_N8N_CLIENT_INVOICES_WEBHOOK_URL not configured');
  const res = await fetch(WEBHOOK_URL, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Client invoices webhook HTTP ${res.status}`);
  const body = await res.json() as { invoices?: ClientInvoice[] };
  return body.invoices ?? [];
}
