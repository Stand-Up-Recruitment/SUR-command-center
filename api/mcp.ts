// Vercel function: MCP server (Streamable HTTP, stateless JSON) so Claude can read the dashboard.
// Added in claude.ai as a custom connector; sign-in is the OAuth flow in api/oauth.ts.
// POST /api/mcp  JSON-RPC  — header Authorization: Bearer <access token>
import { verify } from './_lib/oauth.js';
import { GET as salesSettings } from './sales-settings.js';
import { GET as recruitmentSettings } from './recruitment-settings.js';
import { GET as retentionSettings } from './retention-settings.js';
import { GET as overviewSettings } from './overview-settings.js';
import {
  fetchSalesMonth, fetchMarketingMonth, fetchRecruiterKPIs, fetchClientPlacements,
} from '../src/services/airtable.js';
import { fetchJobAdderStageKPIs } from '../src/services/jobadderStages.js';
import { fetchJobAging } from '../src/services/jobadderJobs.js';
import { fetchRetentionPlacements } from '../src/services/jobadderRetention.js';
import { fetchXeroFinanceData } from '../src/services/xero.js';
import { fetchClientInvoices } from '../src/services/clientInvoices.js';
import { monthWindow, currentMonthKey, nzDate } from '../src/lib/nzTime.js';
import { hiringTrigger } from '../src/lib/recruitment.js';
import { summariseRetention } from '../src/lib/retention.js';
import { diagnoseRetention } from '../src/lib/diagnosis.js';
import { financeSummary } from '../src/lib/finance.js';
import { buildScorecard } from '../src/lib/clientScorecard.js';
import type { TimeFrame, RecruitmentSettings, RetentionSettings, SalesSettings, OverviewSettings } from '../src/types/index.js';

type Args = { month?: string; frame?: string };

const settings = async <T>(get: () => Promise<Response>) => await (await get()).json() as T;
const month = (a: Args) => (/^\d{4}-\d{2}$/.test(a.month ?? '') ? a.month! : currentMonthKey());
const frame = (a: Args): TimeFrame => (['day', 'week', 'month', 'year'].includes(a.frame ?? '') ? a.frame as TimeFrame : 'month');

const MONTH = { month: { type: 'string', description: 'Month as YYYY-MM (NZ time). Defaults to the current month.' } };
const FRAME = { frame: { type: 'string', enum: ['day', 'week', 'month', 'year'], description: 'Period to date. Defaults to month.' } };

const TOOLS: { name: string; description: string; properties: object; run: (a: Args) => Promise<unknown> }[] = [
  {
    name: 'get_sales',
    description: 'Sales tab: Terms of Business signed, sales funnel and activity per salesperson for a month, plus the monthly target per salesperson.',
    properties: MONTH,
    run: async a => ({
      month: month(a),
      settings: await settings<SalesSettings>(salesSettings),
      ...await fetchSalesMonth(monthWindow(month(a))),
    }),
  },
  {
    name: 'get_marketing',
    description: 'Marketing tab: paid (Meta ads) and lead channel results for a month — spend, leads, cost per result, qualified candidates and clients.',
    properties: MONTH,
    run: async a => ({ month: month(a), ...await fetchMarketingMonth(monthWindow(month(a))) }),
  },
  {
    name: 'get_recruitment',
    description: 'Recruitment tab: placements, submissions and interviews per recruiter, JobAdder pipeline stages, open job aging and the hire-a-recruiter trigger.',
    properties: FRAME,
    run: async a => {
      const [recruiters, stages, jobs, s] = await Promise.all([
        fetchRecruiterKPIs(frame(a)), fetchJobAdderStageKPIs(frame(a)), fetchJobAging(), settings<RecruitmentSettings>(recruitmentSettings),
      ]);
      return { frame: frame(a), recruiters, pipelineStages: stages, openJobs: jobs, hiringTrigger: hiringTrigger(jobs, s) };
    },
  },
  {
    name: 'get_retention',
    description: 'Retention tab: placements still inside the 16-week guarantee, fall-over rates by recruiter/client/trade, reasons, and the RAG diagnosis.',
    properties: {},
    run: async () => {
      const [placements, s] = await Promise.all([fetchRetentionPlacements(), settings<RetentionSettings>(retentionSettings)]);
      const summary = summariseRetention(placements, s);
      return { summary, diagnosis: diagnoseRetention(summary, s) };
    },
  },
  {
    name: 'get_finance',
    description: 'Finance tab (Xero): net profit month to date, projected month end vs target, cash, weekly costs, runway and the diagnosis.',
    properties: {},
    run: async () => {
      const [data, s] = await Promise.all([fetchXeroFinanceData(), settings<OverviewSettings>(overviewSettings)]);
      return financeSummary(data, s.netProfitTarget, monthWindow(currentMonthKey()));
    },
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
