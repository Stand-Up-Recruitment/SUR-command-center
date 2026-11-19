// Vercel function: demand signals for the Marketing tab ("Where should the ads point?").
// n8n "Marketing - Demand Signals Feed" gives open JobAdder jobs and the Ready To Go folder
// (email + preferred locations); each candidate's trade comes from Airtable Category by email.
// Only counts by trade and location leave this function — no candidate details.
// GET /api/marketing-demand
import { buildDemand, tradeOf, type DemandCandidate, type DemandJob, type DemandSignals } from '../src/lib/demand.js';

export const maxDuration = 60; // n8n feed ~5 s + Airtable lookups ~3 s

const UPSTREAM = 'https://n8n.srv1303295.hstgr.cloud/webhook/marketing-demand';
const CANDIDATES_TABLE_ID = 'tblHhlHjb7keWPUdE';

type Feed = { jobs: DemandJob[]; readyToGo: { email: string; city: string }[] };
type CandidateFields = { 'Email Address'?: string; Category?: string; 'Trade / Occupation'?: string; 'Preferred Location'?: string };

/** Airtable trade + preferred location per lower-cased email, looked up 40 emails per request. */
async function airtableByEmail(emails: string[]): Promise<Map<string, CandidateFields>> {
  const key = process.env.VITE_AIRTABLE_API_KEY;
  const base = process.env.VITE_AIRTABLE_CANDIDATES_BASE_ID;
  if (!key || !base) throw new Error('Airtable not configured');
  const out = new Map<string, CandidateFields>();
  const chunks: string[][] = [];
  for (let i = 0; i < emails.length; i += 40) chunks.push(emails.slice(i, i + 40));
  const fields = ['Email Address', 'Category', 'Trade / Occupation', 'Preferred Location'].map(f => `fields[]=${encodeURIComponent(f)}`).join('&');
  // 4 requests at a time stays under Airtable's 5 requests a second per base.
  for (let i = 0; i < chunks.length; i += 4) {
    await Promise.all(chunks.slice(i, i + 4).map(async chunk => {
      const formula = `OR(${chunk.map(e => `LOWER(TRIM({Email Address}))='${e.replace(/['\\]/g, '')}'`).join(',')})`;
      let offset = '';
      do {
        const res = await fetch(
          `https://api.airtable.com/v0/${base}/${CANDIDATES_TABLE_ID}?${fields}&filterByFormula=${encodeURIComponent(formula)}${offset ? `&offset=${offset}` : ''}`,
          { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) },
        );
        if (!res.ok) throw new Error(`Airtable HTTP ${res.status}`);
        const body = await res.json() as { records: { fields: CandidateFields }[]; offset?: string };
        for (const r of body.records) {
          const email = r.fields['Email Address']?.trim().toLowerCase();
          // Duplicate records: keep the one that has a trade.
          if (email && (!out.has(email) || (!out.get(email)!.Category && r.fields.Category))) out.set(email, r.fields);
        }
        offset = body.offset ?? '';
      } while (offset);
    }));
  }
  return out;
}

export async function GET(): Promise<Response> {
  const token = process.env.N8N_DASH_TOKEN;
  if (!token) return Response.json({ error: 'N8N_DASH_TOKEN not configured' }, { status: 502 });

  const res = await fetch(UPSTREAM, { headers: { 'x-dashboard-token': token }, signal: AbortSignal.timeout(45_000) }).catch(() => null);
  if (!res?.ok) return Response.json({ error: `Demand feed unavailable (${res?.status ?? 'timeout'})` }, { status: 502 });
  const feed = await res.json() as Feed;

  let airtable: Map<string, CandidateFields>;
  try {
    airtable = await airtableByEmail([...new Set(feed.readyToGo.map(c => c.email).filter(Boolean))]);
  } catch (e) {
    return Response.json({ error: `Airtable lookup failed: ${(e as Error).message}` }, { status: 502 });
  }

  const candidates: DemandCandidate[] = feed.readyToGo.map(c => {
    const a = airtable.get(c.email);
    return {
      trade: tradeOf(a?.Category) ?? tradeOf(a?.['Trade / Occupation']),
      locations: c.city || a?.['Preferred Location'] || '',
    };
  });
  const body: DemandSignals = { generatedAt: new Date().toISOString(), ...buildDemand(feed.jobs, candidates, Date.now()) };
  return Response.json(body, { headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=300' } });
}
