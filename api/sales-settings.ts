// Vercel function: editable Sales settings (ToBs signed target per salesperson per month, close-rate target).
// GET  /api/sales-settings
// PUT  /api/sales-settings  { targetPerSalesperson, closeRateTarget }  — header x-admin-password
import { supabase } from './_lib/supabase.js';
import type { SalesSettings } from '../src/types/index.js';

const DEFAULTS: SalesSettings = { targetPerSalesperson: 10, closeRateTarget: 30 };

export async function GET(): Promise<Response> {
  const db = supabase();
  if (!db) return Response.json({ ...DEFAULTS, error: 'Supabase not configured' });
  const { data, error } = await db.from('sales_settings').select('target_per_salesperson, close_rate_target').eq('id', 1).maybeSingle();
  if (error) return Response.json({ ...DEFAULTS, error: error.message });
  return Response.json({
    targetPerSalesperson: data?.target_per_salesperson ?? DEFAULTS.targetPerSalesperson,
    closeRateTarget: Number(data?.close_rate_target ?? DEFAULTS.closeRateTarget),
  } satisfies SalesSettings);
}

export async function PUT(request: Request): Promise<Response> {
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD ?? process.env.VITE_AUTH_PASSWORD;
  if (!adminPassword || request.headers.get('x-admin-password') !== adminPassword) {
    return Response.json({ error: 'Wrong admin password' }, { status: 401 });
  }
  const db = supabase();
  if (!db) return Response.json({ error: 'Supabase not configured' }, { status: 502 });

  const body = await request.json().catch(() => null) as Partial<SalesSettings> | null;
  const target = body?.targetPerSalesperson;
  if (!(Number.isInteger(target) && target! > 0)) {
    return Response.json({ error: 'targetPerSalesperson must be a whole number > 0' }, { status: 400 });
  }
  const close = body?.closeRateTarget;
  if (!(typeof close === 'number' && close > 0 && close <= 100)) {
    return Response.json({ error: 'closeRateTarget must be a % between 0 and 100' }, { status: 400 });
  }
  const { error } = await db.from('sales_settings').upsert({
    id: 1, target_per_salesperson: target, close_rate_target: close, updated_at: new Date().toISOString(),
  });
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json({ targetPerSalesperson: target!, closeRateTarget: close } satisfies SalesSettings);
}
