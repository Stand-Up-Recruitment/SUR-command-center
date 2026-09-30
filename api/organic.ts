// Vercel function: organic content and audience for one month (NZ time), per post.
// GET /api/organic?month=YYYY-MM
import { monthWindow, nzDate, last12Months, toMs, currentMonthKey, type DayRange } from '../src/lib/nzTime.js';
import {
  pageConfigured, instagramUserId, instagramPosts, instagramFollowers,
  facebookPosts, facebookFollowers, type RawPost,
} from './_lib/meta.js';
import { followerSnapshots, type SnapshotChannel } from './_lib/supabase.js';
import type { OrganicChannel, OrganicMonth } from '../src/types/index.js';

const inRange = (p: RawPost, r: DayRange) => {
  const d = nzDate(p.timestamp);
  return d >= r.since && d <= r.until;
};

function sumViews(posts: RawPost[]): number | null {
  if (posts.length === 0) return 0;
  if (posts.every(p => p.views == null)) return null;
  return posts.reduce((s, p) => s + (p.views ?? 0), 0);
}

function channelTotals(
  posts: RawPost[] | null,
  cur: DayRange,
  prev: DayRange,
  followers: number | null,
  prevMonthFollowers: number | null,
): OrganicChannel {
  if (!posts) {
    return { connected: false, posts: null, prevPosts: null, views: null, prevViews: null, engagement: null, prevEngagement: null, followers: null, prevMonthFollowers: null };
  }
  const c = posts.filter(p => inRange(p, cur));
  const pv = posts.filter(p => inRange(p, prev));
  return {
    connected: true,
    posts: c.length,
    prevPosts: pv.length,
    views: sumViews(c),
    prevViews: sumViews(pv),
    engagement: c.reduce((s, p) => s + p.engagement, 0),
    prevEngagement: pv.reduce((s, p) => s + p.engagement, 0),
    followers,
    prevMonthFollowers,
  };
}

const EMPTY: OrganicChannel = { connected: false, posts: null, prevPosts: null, views: null, prevViews: null, engagement: null, prevEngagement: null, followers: null, prevMonthFollowers: null };

export async function GET(request: Request): Promise<Response> {
  const monthParam = new URL(request.url).searchParams.get('month') ?? '';
  const month = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthKey();
  const w = monthWindow(month);
  const months = last12Months(month, w.cur.until);
  const sinceMs = toMs(months[0]).from;
  const prevMonthKey = w.prev.since.slice(0, 7);

  if (!pageConfigured()) {
    return Response.json({
      instagram: EMPTY, facebook: EMPTY, les: EMPTY, topPosts: [],
      series: months.map(m => ({ key: m.key, views: 0, followers: null })),
      error: 'META_PAGE_TOKEN / META_PAGE_ID not configured',
    } satisfies OrganicMonth);
  }

  try {
    const igId = await instagramUserId();
    const lesId = process.env.META_LES_IG_USER_ID;
    const [ig, fb, les, igFollowers, fbFollowers, lesFollowers, snaps] = await Promise.all([
      igId ? instagramPosts(igId, sinceMs, 'Instagram') : Promise.resolve(null),
      facebookPosts(sinceMs),
      lesId ? instagramPosts(lesId, sinceMs, 'Les Instagram').catch(() => null) : Promise.resolve(null),
      igId ? instagramFollowers(igId) : Promise.resolve(null),
      facebookFollowers(),
      lesId ? instagramFollowers(lesId) : Promise.resolve(null),
      followerSnapshots(months[0].key),
    ]);

    // Followers: live total for the current month, month-end snapshot for past months.
    const followersFor = (ch: SnapshotChannel, live: number | null) =>
      w.isCurrent ? live : snaps.get(`${ch}:${month}`) ?? null;
    const prevSnap = (ch: SnapshotChannel) => snaps.get(`${ch}:${prevMonthKey}`) ?? null;

    const all = [...(ig ?? []), ...fb, ...(les ?? [])];
    const currentKey = currentMonthKey();
    const body: OrganicMonth = {
      instagram: channelTotals(ig, w.cur, w.prev, followersFor('instagram', igFollowers), prevSnap('instagram')),
      facebook: channelTotals(fb, w.cur, w.prev, followersFor('facebook', fbFollowers), prevSnap('facebook')),
      les: lesId ? channelTotals(les, w.cur, w.prev, followersFor('les', lesFollowers), prevSnap('les')) : EMPTY,
      topPosts: all
        .filter(p => inRange(p, w.cur))
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 5)
        .map(p => ({ id: p.id, channel: p.channel, caption: p.caption, date: p.timestamp, views: p.views, engagement: p.engagement, permalink: p.permalink })),
      series: months.map(m => {
        const views = all.filter(p => inRange(p, m)).reduce((s, p) => s + (p.views ?? 0), 0);
        const chans: [SnapshotChannel, number | null][] = [['instagram', igFollowers], ['facebook', fbFollowers], ['les', lesFollowers]];
        const vals = chans
          .map(([ch, live]) => (m.key === currentKey ? live : snaps.get(`${ch}:${m.key}`) ?? null))
          .filter((v): v is number => v != null);
        return { key: m.key, views, followers: vals.length ? vals.reduce((a, b) => a + b, 0) : null };
      }),
    };
    return Response.json(body, { headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=300' } });
  } catch (e) {
    return Response.json({ error: `Organic data unavailable: ${(e as Error).message}` }, { status: 502 });
  }
}
