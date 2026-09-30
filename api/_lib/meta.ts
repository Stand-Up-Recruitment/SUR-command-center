// Server-side Meta Graph API access for organic (Page + Instagram) data.
// Uses a Page access token (META_PAGE_TOKEN); account-level views/reach are never
// used because they include people reached by ads. Everything is per post.
const GRAPH = 'https://graph.facebook.com/v21.0';

export interface RawPost {
  id: string;
  channel: 'Instagram' | 'Facebook' | 'Les Instagram';
  caption: string;
  timestamp: string;
  views: number | null;
  engagement: number;
  permalink?: string;
}

type Paged<T> = { data?: T[]; paging?: { next?: string }; error?: { message: string } };

function token() {
  return process.env.META_PAGE_TOKEN;
}

async function graph<T>(pathOrUrl: string): Promise<T> {
  const url = pathOrUrl.startsWith('http')
    ? pathOrUrl
    : `${GRAPH}/${pathOrUrl}${pathOrUrl.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token() ?? '')}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const body = await res.json() as T & { error?: { message: string } };
  if (body.error) throw new Error(body.error.message);
  return body;
}

/** Runs `fn` over `items` with limited concurrency. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

export function pageConfigured() {
  return Boolean(token() && process.env.META_PAGE_ID);
}

export async function instagramUserId(): Promise<string | null> {
  if (process.env.META_IG_USER_ID) return process.env.META_IG_USER_ID;
  const page = await graph<{ instagram_business_account?: { id: string } }>(
    `${process.env.META_PAGE_ID}?fields=instagram_business_account`);
  return page.instagram_business_account?.id ?? null;
}

type IgMedia = { id: string; caption?: string; timestamp: string; like_count?: number; comments_count?: number; permalink?: string };

/** Instagram posts published on/after `sinceMs`, with per-post views and engagement (likes + comments + shares + saves). */
export async function instagramPosts(igUserId: string, sinceMs: number, channel: RawPost['channel']): Promise<RawPost[]> {
  const media: IgMedia[] = [];
  let next: string | undefined = `${igUserId}/media?fields=id,caption,timestamp,like_count,comments_count,permalink&limit=100`;
  while (next) {
    const page: Paged<IgMedia> = await graph<Paged<IgMedia>>(next);
    const batch = page.data ?? [];
    media.push(...batch.filter(m => new Date(m.timestamp).getTime() >= sinceMs));
    const reachedEnd = batch.length === 0 || new Date(batch[batch.length - 1].timestamp).getTime() < sinceMs;
    next = reachedEnd ? undefined : page.paging?.next;
  }
  return mapLimit(media, 8, async m => {
    let views: number | null = null, shares = 0, saved = 0;
    try {
      const ins = await graph<{ data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(
        `${m.id}/insights?metric=views,shares,saved`);
      const val = (n: string) => {
        const d = ins.data.find(x => x.name === n);
        return d?.total_value?.value ?? d?.values?.[0]?.value ?? 0;
      };
      views = val('views'); shares = val('shares'); saved = val('saved');
    } catch { /* some media types have no insights; views stays null */ }
    return {
      id: m.id, channel, caption: m.caption ?? '', timestamp: m.timestamp, permalink: m.permalink,
      views, engagement: (m.like_count ?? 0) + (m.comments_count ?? 0) + shares + saved,
    };
  });
}

export async function instagramFollowers(igUserId: string): Promise<number | null> {
  try {
    const r = await graph<{ followers_count?: number }>(`${igUserId}?fields=followers_count`);
    return r.followers_count ?? null;
  } catch { return null; }
}

type FbPost = {
  id: string; message?: string; created_time: string; permalink_url?: string;
  shares?: { count: number };
  likes?: { summary?: { total_count: number } };
  comments?: { summary?: { total_count: number } };
};

/** Facebook Page posts on/after `sinceMs`. Engagement = likes + comments + shares. Views (organic only) need read_insights: null without it. */
export async function facebookPosts(sinceMs: number): Promise<RawPost[]> {
  const posts: FbPost[] = [];
  let next: string | undefined =
    `${process.env.META_PAGE_ID}/posts?fields=id,message,created_time,permalink_url,shares,` +
    `likes.summary(total_count).limit(0),comments.summary(total_count).limit(0)` +
    `&since=${Math.floor(sinceMs / 1000)}&limit=100`;
  while (next) {
    const page: Paged<FbPost> = await graph<Paged<FbPost>>(next);
    posts.push(...(page.data ?? []));
    next = page.paging?.next;
  }
  let insightsOk = true;
  return mapLimit(posts, 8, async p => {
    let views: number | null = null;
    if (insightsOk) {
      try {
        // Organic views only: drop the share of views that came from ads.
        const ins = await graph<{ data: { values?: { value: number; is_from_ads?: string }[] }[] }>(
          `${p.id}/insights?metric=post_media_view&breakdown=is_from_ads`);
        views = ins.data[0]?.values?.find(v => v.is_from_ads === '0')?.value ?? null;
      } catch { insightsOk = false; }
    }
    return {
      id: p.id, channel: 'Facebook' as const, caption: p.message ?? '', timestamp: p.created_time, permalink: p.permalink_url,
      views,
      engagement: (p.likes?.summary?.total_count ?? 0) + (p.comments?.summary?.total_count ?? 0) + (p.shares?.count ?? 0),
    };
  });
}

export async function facebookFollowers(): Promise<number | null> {
  try {
    const r = await graph<{ followers_count?: number }>(`${process.env.META_PAGE_ID}?fields=followers_count`);
    return r.followers_count ?? null;
  } catch { return null; }
}
