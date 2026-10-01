import type { LTGPFrame, MetaPaidTotals, MetaCampaignRow, MetaAdRow } from '../types';

const META_BASE = 'https://graph.facebook.com/v21.0';
const META_ACCOUNT = 'act_1566498283991021';

export async function fetchMetaSpend(): Promise<{ thisWeek: number; prevWeek: number }> {
  const token = import.meta.env.VITE_META_TOKEN as string;

  const thisWeekUrl =
    `${META_BASE}/${META_ACCOUNT}/insights?fields=spend&date_preset=last_7d` +
    `&access_token=${encodeURIComponent(token)}`;

  const now = new Date();
  const prevEnd = new Date(now);
  prevEnd.setDate(now.getDate() - 8);
  const prevStart = new Date(now);
  prevStart.setDate(now.getDate() - 14);
  const timeRange = JSON.stringify({
    since: prevStart.toISOString().slice(0, 10),
    until: prevEnd.toISOString().slice(0, 10),
  });
  const prevWeekUrl =
    `${META_BASE}/${META_ACCOUNT}/insights?fields=spend` +
    `&time_range=${encodeURIComponent(timeRange)}` +
    `&access_token=${encodeURIComponent(token)}`;

  const [thisData, prevData] = await Promise.all([
    fetch(thisWeekUrl).then((r) => r.json()),
    fetch(prevWeekUrl).then((r) => r.json()),
  ]);

  return {
    thisWeek: parseFloat(thisData.data?.[0]?.spend ?? '0'),
    prevWeek: parseFloat(prevData.data?.[0]?.spend ?? '0'),
  };
}

const LEAD_ACTION_TYPES = [
  'lead',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
  'offsite_conversion.fb_pixel_custom',
];

function leadCountFromActions(actions?: Array<{ action_type: string; value: string }>): number {
  if (!actions) return 0;
  return actions
    .filter((a) => LEAD_ACTION_TYPES.includes(a.action_type))
    .reduce((sum, a) => sum + parseFloat(a.value ?? '0'), 0);
}

export async function fetchMetaCprByGroup(): Promise<{
  candidateCpr: number;
  prevCandidateCpr: number;
  clientCpr: number;
  prevClientCpr: number;
}> {
  const token = import.meta.env.VITE_META_TOKEN as string;
  if (!token) return { candidateCpr: 0, prevCandidateCpr: 0, clientCpr: 0, prevClientCpr: 0 };

  const now = new Date();
  const prevEnd = new Date(now);
  prevEnd.setDate(now.getDate() - 8);
  const prevStart = new Date(now);
  prevStart.setDate(now.getDate() - 14);
  const prevTimeRange = JSON.stringify({
    since: prevStart.toISOString().slice(0, 10),
    until: prevEnd.toISOString().slice(0, 10),
  });

  async function fetchCampaigns(dateParam: string) {
    const campaigns: Array<{ campaign_name: string; spend: string; actions?: Array<{ action_type: string; value: string }> }> = [];
    let nextUrl: string | null =
      `${META_BASE}/${META_ACCOUNT}/insights?level=campaign&fields=campaign_name,spend,actions&${dateParam}&access_token=${encodeURIComponent(token)}`;

    while (nextUrl) {
      const res: {
        data?: Array<{ campaign_name: string; spend: string; actions?: Array<{ action_type: string; value: string }> }>;
        paging?: { next?: string };
      } = await fetch(nextUrl).then((r) => r.json());
      if (res.data) campaigns.push(...res.data);
      nextUrl = res.paging?.next ?? null;
    }
    return campaigns;
  }

  function groupCpr(campaigns: Array<{ campaign_name: string; spend: string; actions?: Array<{ action_type: string; value: string }> }>) {
    let candidateSpend = 0, candidateLeads = 0, clientSpend = 0, clientLeads = 0;
    for (const c of campaigns) {
      const name = (c.campaign_name ?? '').toLowerCase();
      const spend = parseFloat(c.spend ?? '0');
      const leads = leadCountFromActions(c.actions);
      if (name.includes('candidate')) { candidateSpend += spend; candidateLeads += leads; }
      else if (name.includes('client')) { clientSpend += spend; clientLeads += leads; }
    }
    return {
      candidateCpr: candidateLeads > 0 ? Math.round(candidateSpend / candidateLeads) : 0,
      clientCpr: clientLeads > 0 ? Math.round(clientSpend / clientLeads) : 0,
    };
  }

  const [thisCampaigns, prevCampaigns] = await Promise.all([
    fetchCampaigns('date_preset=last_7d'),
    fetchCampaigns(`time_range=${encodeURIComponent(prevTimeRange)}`),
  ]);

  const thisGroup = groupCpr(thisCampaigns);
  const prevGroup = groupCpr(prevCampaigns);

  return {
    candidateCpr: thisGroup.candidateCpr,
    prevCandidateCpr: prevGroup.candidateCpr,
    clientCpr: thisGroup.clientCpr,
    prevClientCpr: prevGroup.clientCpr,
  };
}

const FRAME_DAYS: Record<Exclude<LTGPFrame, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '12m': 365,
};

function currentDateParam(frame: LTGPFrame): string {
  if (frame === '7d') return 'date_preset=last_7d';
  if (frame === '30d') return 'date_preset=last_30d';
  if (frame === '90d') return 'date_preset=last_90d';
  if (frame === '12m') return 'date_preset=last_year';
  const timeRange = JSON.stringify({ since: '2020-01-01', until: new Date().toISOString().slice(0, 10) });
  return `time_range=${encodeURIComponent(timeRange)}`;
}

/** Time range for the equal-length window immediately preceding the current one. `null` for 'all' (no prior period). */
function prevDateParam(frame: LTGPFrame): string | null {
  if (frame === 'all') return null;
  const days = FRAME_DAYS[frame];
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(now.getDate() - days);
  const prevStart = new Date(currentStart);
  prevStart.setDate(currentStart.getDate() - days);
  const timeRange = JSON.stringify({
    since: prevStart.toISOString().slice(0, 10),
    until: currentStart.toISOString().slice(0, 10),
  });
  return `time_range=${encodeURIComponent(timeRange)}`;
}

async function fetchAndGroupCampaigns(dateParam: string): Promise<{
  candidateSpend: number;
  clientSpend: number;
}> {
  const token = import.meta.env.VITE_META_TOKEN as string;
  if (!token) return { candidateSpend: 0, clientSpend: 0 };

  const campaigns: Array<{ campaign_name: string; spend: string }> = [];
  let nextUrl: string | null =
    `${META_BASE}/${META_ACCOUNT}/insights?level=campaign&fields=campaign_name,spend&${dateParam}&access_token=${encodeURIComponent(token)}`;

  while (nextUrl) {
    const res: { data?: Array<{ campaign_name: string; spend: string }>; paging?: { next?: string } } =
      await fetch(nextUrl).then((r) => r.json());
    if (res.data) campaigns.push(...res.data);
    nextUrl = res.paging?.next ?? null;
  }

  // Calculation Rules 3.1 / 4.1: only campaigns with "Candidates" / "Clients"
  // in the name count; spend on any other campaign is left out entirely.
  let candidateSpend = 0;
  let clientSpend = 0;

  for (const c of campaigns) {
    const name = (c.campaign_name ?? '').toLowerCase();
    const spend = parseFloat(c.spend ?? '0');
    if (name.includes('candidate')) candidateSpend += spend;
    else if (name.includes('client')) clientSpend += spend;
  }

  return { candidateSpend, clientSpend };
}

export async function fetchMetaSpendByFrame(frame: LTGPFrame): Promise<{
  candidateSpend: number;
  clientSpend: number;
}> {
  return fetchAndGroupCampaigns(currentDateParam(frame));
}

/** Same candidate/client split for the equal-length period immediately before `frame`. `null` when `frame` is 'all'. */
export async function fetchMetaSpendPrevPeriod(frame: LTGPFrame): Promise<{
  candidateSpend: number;
  clientSpend: number;
} | null> {
  const dateParam = prevDateParam(frame);
  if (!dateParam) return null;
  return fetchAndGroupCampaigns(dateParam);
}

// ─── Marketing tab: month windows ─────────────────────────────────────────────
// Client vs candidate is split by campaign name ("Clients" / "Candidates").
type Action = { action_type: string; value: string };
type CampaignRow = {
  campaign_name: string; spend?: string; impressions?: string; frequency?: string;
  actions?: Action[]; conversions?: Action[]; date_start?: string;
  ad_id?: string; ad_name?: string;
};

export function campaignGroup(name: string | undefined): 'client' | 'candidate' | null {
  const n = (name ?? '').toLowerCase();
  if (n.includes('candidate')) return 'candidate';
  if (n.includes('client')) return 'client';
  return null;
}

function actionValue(actions: Action[] | undefined, type: string): number {
  return parseFloat(actions?.find(a => a.action_type === type)?.value ?? '0');
}

async function fetchCampaignInsights(range: { since: string; until: string }, fields: string, extra = '', level: 'campaign' | 'ad' = 'campaign'): Promise<CampaignRow[]> {
  const token = import.meta.env.VITE_META_TOKEN as string;
  if (!token) throw new Error('Meta token not configured');
  const rows: CampaignRow[] = [];
  let nextUrl: string | null =
    `${META_BASE}/${META_ACCOUNT}/insights?level=${level}&fields=${fields}` +
    `&time_range=${encodeURIComponent(JSON.stringify(range))}&limit=500${extra}` +
    `&access_token=${encodeURIComponent(token)}`;
  while (nextUrl) {
    const res: { data?: CampaignRow[]; paging?: { next?: string }; error?: { message: string } } =
      await fetch(nextUrl).then(r => r.json());
    if (res.error) throw new Error(`Meta: ${res.error.message}`);
    if (res.data) rows.push(...res.data);
    nextUrl = res.paging?.next ?? null;
  }
  return rows;
}

/** Meta-reported paid figures for an inclusive date range (impressions, not reach: reach can't be summed). */
export async function fetchMetaPaidRange(range: { since: string; until: string }): Promise<MetaPaidTotals> {
  const rows = await fetchCampaignInsights(range, 'campaign_name,spend,impressions,actions,conversions');
  const out: MetaPaidTotals = {
    totalSpend: 0, impressions: 0,
    client: { spend: 0, linkClicks: 0, leads: 0 },
    candidate: { spend: 0, linkClicks: 0, applications: 0 },
  };
  for (const r of rows) {
    const g = campaignGroup(r.campaign_name);
    if (!g) continue;
    const spend = parseFloat(r.spend ?? '0');
    out.totalSpend += spend;
    out.impressions += parseFloat(r.impressions ?? '0');
    out[g].spend += spend;
    out[g].linkClicks += actionValue(r.actions, 'link_click');
    if (g === 'client') out.client.leads += actionValue(r.actions, 'lead');
    // submit_application_total is reported under `conversions`, not `actions`.
    else out.candidate.applications += actionValue(r.conversions, 'submit_application_total');
  }
  return out;
}

/** Client / candidate spend for an inclusive date range. */
export async function fetchMetaSpendRange(range: { since: string; until: string }): Promise<{ candidateSpend: number; clientSpend: number }> {
  const rows = await fetchCampaignInsights(range, 'campaign_name,spend');
  let candidateSpend = 0, clientSpend = 0;
  for (const r of rows) {
    const g = campaignGroup(r.campaign_name);
    if (g === 'candidate') candidateSpend += parseFloat(r.spend ?? '0');
    else if (g === 'client') clientSpend += parseFloat(r.spend ?? '0');
  }
  return { candidateSpend, clientSpend };
}

/** Client / candidate spend per calendar month ('YYYY-MM') across an inclusive range. */
export async function fetchMetaSpendMonthly(range: { since: string; until: string }): Promise<Record<string, { client: number; candidate: number }>> {
  const rows = await fetchCampaignInsights(range, 'campaign_name,spend', '&time_increment=monthly');
  const out: Record<string, { client: number; candidate: number }> = {};
  for (const r of rows) {
    const g = campaignGroup(r.campaign_name);
    if (!g || !r.date_start) continue;
    const key = r.date_start.slice(0, 7);
    out[key] ??= { client: 0, candidate: 0 };
    out[key][g] += parseFloat(r.spend ?? '0');
  }
  return out;
}

// ─── Marketing tab: campaigns and ads drill-down ──────────────────────────────
// Result = leads for client campaigns, applications (submit_application_total,
// reported under `conversions`) for candidate campaigns.
function results(r: CampaignRow, group: 'client' | 'candidate') {
  return group === 'client' ? actionValue(r.actions, 'lead') : actionValue(r.conversions, 'submit_application_total');
}

const BREAKDOWN_FIELDS = 'campaign_name,spend,impressions,frequency,actions,conversions';

/** Spend and results per campaign this period, with last period's spend alongside. */
export async function fetchMetaCampaignBreakdown(
  cur: { since: string; until: string },
  prev: { since: string; until: string },
): Promise<MetaCampaignRow[]> {
  const [curRows, prevRows] = await Promise.all([
    fetchCampaignInsights(cur, BREAKDOWN_FIELDS),
    fetchCampaignInsights(prev, 'campaign_name,spend'),
  ]);
  const prevSpend = new Map(prevRows.map(r => [r.campaign_name, parseFloat(r.spend ?? '0')]));
  const out: MetaCampaignRow[] = [];
  for (const r of curRows) {
    const group = campaignGroup(r.campaign_name);
    if (!group) continue;
    const spend = parseFloat(r.spend ?? '0');
    const res = results(r, group);
    out.push({
      campaign: r.campaign_name, group, spend,
      prevSpend: prevSpend.get(r.campaign_name) ?? 0,
      results: res,
      costPerResult: res > 0 ? spend / res : null,
      linkClicks: actionValue(r.actions, 'link_click'),
      frequency: parseFloat(r.frequency ?? '0'),
    });
  }
  // Campaigns that spent last period but nothing this period have "gone quiet" too.
  for (const r of prevRows) {
    const group = campaignGroup(r.campaign_name);
    if (!group || out.some(o => o.campaign === r.campaign_name)) continue;
    out.push({ campaign: r.campaign_name, group, spend: 0, prevSpend: parseFloat(r.spend ?? '0'), results: 0, costPerResult: null, linkClicks: 0, frequency: 0 });
  }
  return out.sort((a, b) => b.spend - a.spend);
}

/** Per-ad spend, results and frequency (average times each person saw the ad). */
export async function fetchMetaAdBreakdown(cur: { since: string; until: string }): Promise<MetaAdRow[]> {
  const rows = await fetchCampaignInsights(cur, `ad_id,ad_name,${BREAKDOWN_FIELDS}`, '', 'ad');
  const out: MetaAdRow[] = [];
  for (const r of rows) {
    const group = campaignGroup(r.campaign_name);
    if (!group) continue;
    const spend = parseFloat(r.spend ?? '0');
    const res = results(r, group);
    out.push({
      id: r.ad_id ?? `${r.campaign_name}:${r.ad_name}`,
      ad: r.ad_name ?? '(unnamed ad)', campaign: r.campaign_name, group, spend,
      results: res, costPerResult: res > 0 ? spend / res : null,
      frequency: parseFloat(r.frequency ?? '0'),
    });
  }
  return out;
}
