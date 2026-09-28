import type { TimeFrame, VoiceCallKPIs } from '../types';
import { timeBoundaries } from './airtable';

// Same-origin proxy (api/voice-stats.ts in production, Vite proxy in dev) — the n8n token
// stays server-side.
const PROXY_URL = '/api/voice-stats';

type Tally = { dialled: number };
type VoiceStatsResponse = {
  by_day: (Tally & { date: string })[];
  by_recruiter: (Tally & { recruiter: string })[];
};

// NZ calendar date (YYYY-MM-DD) — the endpoint counts `days` in Pacific/Auckland days.
const nzDate = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
const daysSince = (ms: number) =>
  Math.round((Date.parse(nzDate(Date.now())) - Date.parse(nzDate(ms))) / 86_400_000) + 1;

async function getStats(days: number): Promise<VoiceStatsResponse> {
  const res = await fetch(`${PROXY_URL}?days=${days}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Voice call stats HTTP ${res.status}`);
  return res.json() as Promise<VoiceStatsResponse>;
}

// Leads contacted = calls the bot dialled (answered + no answer), from the Voice Call Log.
// Per-recruiter for the current period; previous period is a team total from by_day.
export async function fetchVoiceCallKPIs(frame: TimeFrame = 'month'): Promise<VoiceCallKPIs> {
  const b = timeBoundaries(frame);
  const [current, span] = await Promise.all([getStats(daysSince(b.start)), getStats(daysSince(b.prevStart))]);
  const prevFrom = nzDate(b.prevStart);
  const prevTo = nzDate(b.prevEnd); // exclusive
  return {
    byRecruiter: current.by_recruiter.map(r => ({ name: r.recruiter, leadsContactedByBot: r.dialled })),
    prevTeamLeads: span.by_day.filter(d => d.date >= prevFrom && d.date < prevTo).reduce((s, d) => s + d.dialled, 0),
  };
}
