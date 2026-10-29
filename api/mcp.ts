// Vercel function: MCP server (Streamable HTTP, stateless JSON) so Claude can read the dashboard.
// Added in claude.ai as a custom connector; sign-in is the OAuth flow in api/oauth.ts.
// POST /api/mcp  JSON-RPC  — header Authorization: Bearer <access token>
// Each tool returns what its dashboard tab shows: the raw numbers plus the tab's Diagnosis.
import { verify } from './_lib/oauth.js';
import { GET as salesSettings } from './sales-settings.js';
import { GET as marketingSettings } from './marketing-settings.js';
import { GET as recruitmentSettings } from './recruitment-settings.js';
import { GET as retentionSettings } from './retention-settings.js';
import { GET as overviewSettings } from './overview-settings.js';
import { GET as organicGET } from './organic.js';
import { GET as voiceStatsGET } from './voice-stats.js';
import {
  fetchSalesMonth, fetchMarketingMonth, fetchRecruiterKPIs, fetchClientPlacements,
  fetchScheduledInvoices, fetchCacKPIs, timeBoundaries,
} from '../src/services/airtable.js';
import { fetchMetaCampaignBreakdown, fetchMetaAdBreakdown } from '../src/services/metaAds.js';
import { fetchVoiceCallKPIs, type VoiceStatsResponse } from '../src/services/voiceCalls.js';
import { fetchJobAdderStageKPIs } from '../src/services/jobadderStages.js';
import { fetchJobAging } from '../src/services/jobadderJobs.js';
import { fetchRetentionPlacements } from '../src/services/jobadderRetention.js';
import { fetchFirstSubmitKPIs } from '../src/services/firstSubmit.js';
import { fetchXeroFinanceData } from '../src/services/xero.js';
import { fetchClientInvoices } from '../src/services/clientInvoices.js';
import { monthWindow, currentMonthKey, nzDate } from '../src/lib/nzTime.js';
import { hiringTrigger, teamRecruiters, recruitmentPace, DEFAULT_RECRUITMENT_SETTINGS } from '../src/lib/recruitment.js';
import { summariseRetention, DEFAULT_RETENTION_SETTINGS } from '../src/lib/retention.js';
import { diagnoseRetention, diagnoseRecruitment, type Diagnosis } from '../src/lib/diagnosis.js';
import { financeSummary, DEFAULT_NET_PROFIT_TARGET } from '../src/lib/finance.js';
import { buildScorecard } from '../src/lib/clientScorecard.js';
import { salesDiagnosis, targetsFor, DEFAULT_TARGET_PER_SALESPERSON } from '../src/components/departments/salesMetrics.js';
import { marketingDiagnosis } from '../src/components/departments/marketingMetrics.js';
import type {
  TimeFrame, RecruitmentSettings, RetentionSettings, SalesSettings, OverviewSettings, MarketingSettings, OrganicMonth,
} from '../src/types/index.js';

type Args = { month?: string; frame?: string };

// Settings come from Supabase; on failure the handlers return defaults plus an `error` field.
const settings = async <T>(get: () => Promise<Response>) => await (await get()).json() as T;
// Secondary sources shouldn't sink a whole tool: report their error in place of the data.
const soft = <T>(p: Promise<T>) => p.catch((e: Error) => ({ error: e.message }));
const month = (a: Args) => (/^\d{4}-\d{2}$/.test(a.month ?? '') ? a.month! : currentMonthKey());
const frame = (a: Args): TimeFrame => (a.frame === 'week' ? 'week' : 'month');

async function sales(m: string) {
  const w = monthWindow(m);
  const [data, s] = await Promise.all([fetchSalesMonth(w), settings<SalesSettings>(salesSettings)]);
  const perPerson = s.targetPerSalesperson ?? DEFAULT_TARGET_PER_SALESPERSON;
  return { month: m, diagnosis: salesDiagnosis(data, w, perPerson), targets: targetsFor(data, w, perPerson), ...data };
}

async function marketing(m: string, breakdown: boolean) {
  const w = monthWindow(m);
  const [data, organicRes, s, campaigns, ads] = await Promise.all([
    fetchMarketingMonth(w),
    organicGET(new Request(`http://local/api/organic?month=${m}`)),
    settings<MarketingSettings>(marketingSettings),
    breakdown ? soft(fetchMetaCampaignBreakdown(w.cur, w.prev)) : undefined,
    breakdown ? soft(fetchMetaAdBreakdown(w.cur)) : undefined,
  ]);
  const organic = await organicRes.json() as OrganicMonth & { error?: string };
  return {
    month: m, diagnosis: marketingDiagnosis(data, organicRes.ok ? organic : undefined, s, w),
    ...data, organic, targets: s.targets, postsPerWeekTarget: s.postsPerWeek, metaCampaigns: campaigns, metaAds: ads,
  };
}

const voiceStats = (days: number, to?: string) =>
  voiceStatsGET(new Request(`http://local/api/voice-stats?days=${days}${to ? `&to=${to}` : ''}`)).then(async r => {
    const body = await r.json();
    if (!r.ok) throw new Error(body.error);
    return body as VoiceStatsResponse;
  });

async function recruitment(f: TimeFrame) {
  const [data, jobs, sRes, stages, voiceBot, firstSubmit] = await Promise.all([
    fetchRecruiterKPIs(f), fetchJobAging(), settings<RecruitmentSettings>(recruitmentSettings),
    soft(fetchJobAdderStageKPIs(f)), soft(fetchVoiceCallKPIs(f, voiceStats)), soft(fetchFirstSubmitKPIs()),
  ]);
  const s = { ...DEFAULT_RECRUITMENT_SETTINGS, ...sRes };
  const { start, now } = timeBoundaries(f);
  const pace = recruitmentPace(data, teamRecruiters(data, jobs), f, start, now);
  const hiring = hiringTrigger(jobs, s);
  const diagnosis = diagnoseRecruitment({
    ...pace, periodLabel: f,
    hiring: { state: hiring.state, weeksUntilFull: hiring.weeksUntilFull, full: hiring.activeJobs >= hiring.slots },
  });
  return { frame: f, diagnosis, pace, hiringTrigger: hiring, team: data, openJobs: jobs, pipelineStages: stages, voiceBot, daysToFirstCv: firstSubmit };
}

async function retention() {
  const [placements, sRes] = await Promise.all([fetchRetentionPlacements(), settings<RetentionSettings>(retentionSettings)]);
  const s = { ...DEFAULT_RETENTION_SETTINGS, ...sRes };
  const summary = summariseRetention(placements, s);
  return { diagnosis: diagnoseRetention(summary, s), settings: s, summary };
}

async function finance(full: boolean) {
  const [data, s, scheduled] = await Promise.all([
    fetchXeroFinanceData(), settings<OverviewSettings>(overviewSettings), full ? soft(fetchScheduledInvoices()) : undefined,
  ]);
  const summary = financeSummary(data, s.netProfitTarget ?? DEFAULT_NET_PROFIT_TARGET, monthWindow(currentMonthKey()));
  if (!full) return { diagnosis: summary.diagnosis, summary };
  // Same inputs the Finance tab passes to its LTGP:CAC row.
  const grossMarginPct = data.ausRevenue > 0 ? (data.ausGrossProfit / data.ausRevenue) * 100 : undefined;
  const cac = await soft(fetchCacKPIs(grossMarginPct, data.jobBoardAdvertising90d, data.prevJobBoardAdvertising90d, data.audNzdMonthlyRates));
  return { diagnosis: summary.diagnosis, summary, ltgpCac: cac, scheduledInvoices: scheduled, xero: data };
}

/** The Overview page: every department's Diagnosis and the top things needing attention. */
async function overview(m: string) {
  const depts = await Promise.all([
    ['Marketing', soft(marketing(m, false))],
    ['Sales', soft(sales(m))],
    ['Recruitment (live month)', soft(recruitment('month'))],
    ['Retention (current)', soft(retention())],
    ['Finance (live month)', soft(finance(false))],
  ].map(async ([name, p]) => ({ name: name as string, result: await (p as Promise<{ diagnosis?: Diagnosis; error?: string }>) })));
  // Red before amber, department order within each, top 5 — same as the dashboard.
  const items = depts.flatMap(d => (d.result.diagnosis?.items ?? []).map(i => ({ ...i, department: d.name })));
  const needsAttention = [...items.filter(i => i.rag === 'red'), ...items.filter(i => i.rag === 'amber')].slice(0, 5);
  return {
    month: m, needsAttention,
    departments: depts.map(d => ({ name: d.name, diagnosis: d.result.diagnosis ?? null, error: d.result.error })),
  };
}

const MONTH = { month: { type: 'string', description: 'Month as YYYY-MM (NZ time). Defaults to the current month.' } };
const FRAME = { frame: { type: 'string', enum: ['week', 'month'], description: 'Week or month to date. Defaults to month.' } };

const TOOLS: { name: string; description: string; properties: object; run: (a: Args) => Promise<unknown> }[] = [
  {
    name: 'get_overview',
    description: 'Start here. Overview page: each department\'s status (Diagnosis) and the top 5 things needing attention, for a month. Slow (~1 min): it loads every department.',
    properties: MONTH,
    run: a => overview(month(a)),
  },
  {
    name: 'get_sales',
    description: 'Sales tab: Diagnosis, targets, Terms of Business sent/signed, funnel, stale ToBs, time to sign and activity per salesperson, vs the previous month.',
    properties: MONTH,
    run: a => sales(month(a)),
  },
  {
    name: 'get_marketing',
    description: 'Marketing tab: Diagnosis, Meta ad spend/clicks/leads/applications, handoff to sales and recruiters with targets, CAC, organic Instagram/Facebook (followers, posts, reach), and the per-campaign and per-ad breakdown.',
    properties: MONTH,
    run: a => marketing(month(a), true),
  },
  {
    name: 'get_recruitment',
    description: 'Recruitment tab: Diagnosis, placement pace vs target and breakeven, per-recruiter interviews/submissions/placements, JobAdder pipeline stages, open job aging, hire-a-recruiter trigger, voice bot calls, and days from new client to first CV.',
    properties: FRAME,
    run: a => recruitment(frame(a)),
  },
  {
    name: 'get_retention',
    description: 'Retention tab: Diagnosis, placements inside the 16-week guarantee, fall-over rates by recruiter/client/trade, reasons, cohorts and replacements owed.',
    properties: {},
    run: () => retention(),
  },
  {
    name: 'get_finance',
    description: 'Finance tab (Xero, Australia): Diagnosis, net profit vs target, cash and runway, P&L, cash flow and outlook, 12-month trend, LTGP:CAC, and scheduled invoices.',
    properties: {},
    run: () => finance(true),
  },
  {
    name: 'get_clients',
    description: 'Clients tab: A–D scorecard per client from placement volume, invoice payment behaviour and candidate retention.',
    properties: {},
    run: async () => {
      const [placements, invoices, jobAdder] = await Promise.all([
        fetchClientPlacements(), fetchClientInvoices().catch(() => null), fetchRetentionPlacements().catch(() => null),
      ]);
      return buildScorecard(placements, invoices, jobAdder, nzDate(Date.now()));
    },
  },
];

type Rpc = { jsonrpc: '2.0'; id?: string | number; method: string; params?: { name?: string; arguments?: Args; protocolVersion?: string } };

async function handle(msg: Rpc): Promise<unknown> {
  switch (msg.method) {
    case 'initialize':
      return {
        protocolVersion: msg.params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'sur-command-center', version: '1.0.0' },
        instructions: 'Stand Up Recruitment command center. Money is NZD unless a field says AUD. Dates are NZ time.',
      };
    case 'ping':
      return {};
    case 'tools/list':
      return {
        tools: TOOLS.map(t => ({
          name: t.name, description: t.description,
          inputSchema: { type: 'object', properties: t.properties, additionalProperties: false },
          annotations: { readOnlyHint: true },
        })),
      };
    case 'tools/call': {
      const tool = TOOLS.find(t => t.name === msg.params?.name);
      if (!tool) throw Object.assign(new Error(`Unknown tool ${msg.params?.name}`), { code: -32602 });
      try {
        return { content: [{ type: 'text', text: JSON.stringify(await tool.run(msg.params?.arguments ?? {})) }] };
      } catch (e) {
        return { isError: true, content: [{ type: 'text', text: `Could not load data: ${(e as Error).message}` }] };
      }
    }
    default:
      throw Object.assign(new Error(`Method not found: ${msg.method}`), { code: -32601 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!verify(token, 'access')) {
    return Response.json({ error: 'unauthorized' }, {
      status: 401,
      headers: { 'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"` },
    });
  }

  const msg = await request.json().catch(() => null) as Rpc | null;
  if (!msg?.method) return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 });
  if (msg.id === undefined) return new Response(null, { status: 202 }); // notification
  try {
    return Response.json({ jsonrpc: '2.0', id: msg.id, result: await handle(msg) });
  } catch (e) {
    return Response.json({ jsonrpc: '2.0', id: msg.id, error: { code: (e as { code?: number }).code ?? -32603, message: (e as Error).message } });
  }
}

// Stateless server: no server-to-client stream.
export function GET(): Response {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } });
}
