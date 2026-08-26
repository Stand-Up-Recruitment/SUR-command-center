import type { LTGPFrame } from '../types';

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
  isEstimated: boolean;
}> {
  const token = import.meta.env.VITE_META_TOKEN as string;
  if (!token) return { candidateSpend: 0, clientSpend: 0, isEstimated: true };

  const campaigns: Array<{ campaign_name: string; spend: string }> = [];
  let nextUrl: string | null =
    `${META_BASE}/${META_ACCOUNT}/insights?level=campaign&fields=campaign_name,spend&${dateParam}&access_token=${encodeURIComponent(token)}`;

  while (nextUrl) {
    const res: { data?: Array<{ campaign_name: string; spend: string }>; paging?: { next?: string } } =
      await fetch(nextUrl).then((r) => r.json());
    if (res.data) campaigns.push(...res.data);
    nextUrl = res.paging?.next ?? null;
  }

  let candidateSpend = 0;
  let clientSpend = 0;
  let unmatchedSpend = 0;
  let anyMatched = false;

  for (const c of campaigns) {
    const name = (c.campaign_name ?? '').toLowerCase();
    const spend = parseFloat(c.spend ?? '0');
    if (name.includes('candidate')) { candidateSpend += spend; anyMatched = true; }
    else if (name.includes('client')) { clientSpend += spend; anyMatched = true; }
    else { unmatchedSpend += spend; }
  }

  if (!anyMatched) {
    return { candidateSpend: unmatchedSpend * 0.6, clientSpend: unmatchedSpend * 0.4, isEstimated: true };
  }

  if (unmatchedSpend > 0) {
    candidateSpend += unmatchedSpend * 0.6;
    clientSpend += unmatchedSpend * 0.4;
    return { candidateSpend, clientSpend, isEstimated: true };
  }

  return { candidateSpend, clientSpend, isEstimated: false };
}

export async function fetchMetaSpendByFrame(frame: LTGPFrame): Promise<{
  candidateSpend: number;
  clientSpend: number;
  isEstimated: boolean;
}> {
  return fetchAndGroupCampaigns(currentDateParam(frame));
}

/** Same candidate/client split for the equal-length period immediately before `frame`. `null` when `frame` is 'all'. */
export async function fetchMetaSpendPrevPeriod(frame: LTGPFrame): Promise<{
  candidateSpend: number;
  clientSpend: number;
  isEstimated: boolean;
} | null> {
  const dateParam = prevDateParam(frame);
  if (!dateParam) return null;
  return fetchAndGroupCampaigns(dateParam);
}
