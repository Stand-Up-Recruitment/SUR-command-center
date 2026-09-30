// Vercel cron: save each channel's follower total at 11:59pm NZ time on the last day
// of the month (Meta only exposes the current total). Scheduled at 10:59 and 11:59 UTC
// so one of the two lands on 23:59 NZ in both NZST (+12) and NZDT (+13).
import { nzDate, addDays, currentMonthKey } from '../../src/lib/nzTime';
import { pageConfigured, instagramUserId, instagramFollowers, facebookFollowers } from '../_lib/meta';
import { supabase, type SnapshotChannel } from '../_lib/supabase';

export async function GET(request: Request): Promise<Response> {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const now = Date.now();
  const force = new URL(request.url).searchParams.get('force') === '1';
  const nzHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Pacific/Auckland', hour: '2-digit', hourCycle: 'h23' }).format(now));
  const today = nzDate(now);
  const isLastDay = addDays(today, 1).slice(8) === '01';
  if (!force && !(isLastDay && nzHour === 23)) return Response.json({ skipped: true, today, nzHour });

  const db = supabase();
  if (!db || !pageConfigured()) return Response.json({ error: 'Supabase or Meta Page token not configured' }, { status: 502 });

  const igId = await instagramUserId();
  const lesId = process.env.META_LES_IG_USER_ID;
  const counts: [SnapshotChannel, number | null][] = [
    ['instagram', igId ? await instagramFollowers(igId) : null],
    ['facebook', await facebookFollowers()],
    ['les', lesId ? await instagramFollowers(lesId) : null],
  ];
  const month = currentMonthKey(now);
  const rows = counts
    .filter((c): c is [SnapshotChannel, number] => c[1] != null)
    .map(([channel, followers]) => ({ channel, month, followers, taken_at: new Date(now).toISOString() }));
  const { error } = await db.from('follower_snapshots').upsert(rows, { onConflict: 'channel,month' });
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json({ saved: rows });
}
