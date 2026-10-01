// Vercel function: editable Overview settings (net profit target + the current constraint).
// GET  /api/overview-settings
// PUT  /api/overview-settings  { netProfitTarget, constraintHeadline, constraintDetail, confirmedBy }  — header x-admin-password
// confirmedAt is set to today (NZ) whenever the headline, detail or confirmed-by name changes.
import { supabase } from './_lib/supabase.js';
import { nzDate } from '../src/lib/nzTime.js';
import { DEFAULT_NET_PROFIT_TARGET } from '../src/lib/finance.js';
import type { OverviewSettings } from '../src/types/index.js';

const DEFAULTS: OverviewSettings = {
  netProfitTarget: DEFAULT_NET_PROFIT_TARGET, constraintHeadline: '', constraintDetail: '', confirmedBy: '', confirmedAt: null,
};

type Row = { net_profit_target: number; constraint_headline: string; constraint_detail: string; confirmed_by: string; confirmed_at: string | null };

const fromRow = (r: Row | null): OverviewSettings => ({
  netProfitTarget: r?.net_profit_target ?? DEFAULTS.netProfitTarget,
  constraintHeadline: r?.constraint_headline ?? DEFAULTS.constraintHeadline,
  constraintDetail: r?.constraint_detail ?? DEFAULTS.constraintDetail,
  confirmedBy: r?.confirmed_by ?? DEFAULTS.confirmedBy,
  confirmedAt: r?.confirmed_at ?? DEFAULTS.confirmedAt,
});

export async function GET(): Promise<Response> {
  const db = supabase();
  if (!db) return Response.json({ ...DEFAULTS, error: 'Supabase not configured' });
  const { data, error } = await db.from('overview_settings').select('*').eq('id', 1).maybeSingle();
  if (error) return Response.json({ ...DEFAULTS, error: error.message });
  return Response.json(fromRow(data) satisfies OverviewSettings);
}

export async function PUT(request: Request): Promise<Response> {
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD ?? process.env.VITE_AUTH_PASSWORD;
  if (!adminPassword || request.headers.get('x-admin-password') !== adminPassword) {
    return Response.json({ error: 'Wrong admin password' }, { status: 401 });
  }
  const db = supabase();
  if (!db) return Response.json({ error: 'Supabase not configured' }, { status: 502 });

  const body = await request.json().catch(() => null) as Partial<OverviewSettings> | null;
  const target = body?.netProfitTarget;
  if (!(Number.isInteger(target) && target! > 0)) {
    return Response.json({ error: 'netProfitTarget must be a whole number > 0' }, { status: 400 });
  }
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : null);
  const headline = text(body?.constraintHeadline);
  const detail = text(body?.constraintDetail);
  const confirmedBy = text(body?.confirmedBy);
  if (headline === null || detail === null || confirmedBy === null) {
    return Response.json({ error: 'constraintHeadline, constraintDetail and confirmedBy must be text' }, { status: 400 });
  }

  const { data: existing, error: readError } = await db.from('overview_settings').select('*').eq('id', 1).maybeSingle();
  if (readError) return Response.json({ error: readError.message }, { status: 502 });
  const before = fromRow(existing);
  const constraintChanged = headline !== before.constraintHeadline || detail !== before.constraintDetail || confirmedBy !== before.confirmedBy;
  const confirmedAt = constraintChanged ? nzDate(Date.now()) : before.confirmedAt;

  const { error } = await db.from('overview_settings').upsert({
    id: 1, net_profit_target: target, constraint_headline: headline, constraint_detail: detail,
    confirmed_by: confirmedBy, confirmed_at: confirmedAt, updated_at: new Date().toISOString(),
  });
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json({
    netProfitTarget: target!, constraintHeadline: headline, constraintDetail: detail, confirmedBy, confirmedAt,
  } satisfies OverviewSettings);
}
