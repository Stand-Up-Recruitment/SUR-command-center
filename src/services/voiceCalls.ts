import type { TimeFrame, VoiceCallKPIs } from '../types';
import { timeBoundaries } from './airtable';

// Same-origin proxy (api/voice-stats.ts in production, Vite proxy in dev) — the n8n token
// stays server-side.
const PROXY_URL = '/api/voice-stats';

type VoiceStatsResponse = {
  totals: { unique_dialled: number; unique_booked: number };
};

// NZ calendar date (YYYY-MM-DD) — the endpoint counts `days` in Pacific/Auckland days.
const nzDate = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
const daysSince = (ms: number) =>
  Math.round((Date.parse(nzDate(Date.now())) - Date.parse(nzDate(ms))) / 86_400_000) + 1;

// `to` (NZ date, exclusive) closes the range; without it the range runs to today.
async function getStats(days: number, to?: string): Promise<VoiceStatsResponse> {
  const res = await fetch(`${PROXY_URL}?days=${days}${to ? `&to=${to}` : ''}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Voice call stats HTTP ${res.status}`);
  return res.json() as Promise<VoiceStatsResponse>;
}

// From the Voice Call Log, counted per unique phone number so retries and callbacks count once:
// leads contacted = numbers the bot dialled (answered + no answer); booked = numbers the bot
// booked an internal interview for (outbound calls and inbound callbacks).
export async function fetchVoiceCallKPIs(frame: TimeFrame = 'month'): Promise<VoiceCallKPIs> {
  const b = timeBoundaries(frame);
  const [current, prev] = await Promise.all([
    getStats(daysSince(b.start)),
    getStats(daysSince(b.prevStart), nzDate(b.prevEnd)),
  ]);
  return {
    teamLeads: current.totals.unique_dialled,
    prevTeamLeads: prev.totals.unique_dialled,
    teamBooked: current.totals.unique_booked,
    prevTeamBooked: prev.totals.unique_booked,
  };
}
