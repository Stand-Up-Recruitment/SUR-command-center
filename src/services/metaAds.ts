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

const LEAD_ACTION_TYPES = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'];

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

export async function fetchMetaSpendByFrame(frame: LTGPFrame): Promise<{
  candidateSpend: number;
  clientSpend: number;
  isEstimated: boolean;
}> {
  const token = import.meta.env.VITE_META_TOKEN as string;
  if (!token) return { candidateSpend: 0, clientSpend: 0, isEstimated: true };

  let dateParam: string;
  if (frame === '30d') {
    dateParam = 'date_preset=last_30d';
  } else if (frame === '90d') {
    dateParam = 'date_preset=last_90d';
  } else if (frame === '12m') {
    dateParam = 'date_preset=last_year';
  } else {
    const timeRange = JSON.stringify({ since: '2020-01-01', until: new Date().toISOString().slice(0, 10) });
    dateParam = `time_range=${encodeURIComponent(timeRange)}`;
  }

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
  let matched = false;

  for (const c of campaigns) {
    const name = (c.campaign_name ?? '').toLowerCase();
    const spend = parseFloat(c.spend ?? '0');
    if (name.includes('candidate')) { candidateSpend += spend; matched = true; }
    else if (name.includes('client')) { clientSpend += spend; matched = true; }
  }

  if (!matched) {
    const total = campaigns.reduce((s, c) => s + parseFloat(c.spend ?? '0'), 0);
    candidateSpend = total * 0.6;
    clientSpend = total * 0.4;
    return { candidateSpend, clientSpend, isEstimated: true };
  }

  return { candidateSpend, clientSpend, isEstimated: false };
}
