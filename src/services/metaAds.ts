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
