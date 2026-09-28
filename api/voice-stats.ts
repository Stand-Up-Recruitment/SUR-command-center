// Vercel function: server-side proxy to the n8n "Voice Call Dashboard API" webhook.
// Keeps N8N_DASH_TOKEN off the browser and strips the per-call rows (candidate names,
// phones, emails) — the dashboard only needs the aggregates.
const UPSTREAM = 'https://n8n.srv1303295.hstgr.cloud/webhook/voice-call-stats';

export async function GET(request: Request): Promise<Response> {
  const token = process.env.N8N_DASH_TOKEN;
  if (!token) return Response.json({ error: 'N8N_DASH_TOKEN not configured' }, { status: 502 });

  const days = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get('days') ?? '', 10) || 30, 1), 365);
  const res = await fetch(`${UPSTREAM}?days=${days}`, {
    headers: { Authorization: token },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res?.ok) return Response.json({ error: `Call stats unavailable (${res?.status ?? 'timeout'})` }, { status: 502 });

  const { range, totals, by_day, by_recruiter } = await res.json() as Record<string, unknown>;
  return Response.json(
    { range, totals, by_day, by_recruiter },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } },
  );
}
