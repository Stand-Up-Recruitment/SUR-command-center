// Server-only Supabase client (service role). Files under api/_lib are not routes.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export type SnapshotChannel = 'instagram' | 'facebook' | 'les';

/** Month-end follower snapshots, keyed `${channel}:${YYYY-MM}`. */
export async function followerSnapshots(sinceMonth: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const db = supabase();
  if (!db) return out;
  const { data } = await db
    .from('follower_snapshots')
    .select('channel, month, followers')
    .gte('month', sinceMonth);
  for (const r of data ?? []) out.set(`${r.channel}:${r.month}`, r.followers);
  return out;
}
