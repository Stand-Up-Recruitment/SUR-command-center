// Vercel function: editable Retention settings (status thresholds on fall-over rate, Rachel cut-off date).
// GET  /api/retention-settings
// PUT  /api/retention-settings  RetentionSettings  — header x-admin-password
import { supabase } from './_lib/supabase.js';
import { DEFAULT_RETENTION_SETTINGS as DEFAULTS } from '../src/lib/retention.js';
import type { RetentionSettings } from '../src/types/index.js';

export async function GET(): Promise<Response> {
  const db = supabase();
  if (!db) return Response.json({ ...DEFAULTS, error: 'Supabase not configured' });
  const { data, error } = await db.from('retention_settings').select('*').eq('id', 1).maybeSingle();
  if (error) return Response.json({ ...DEFAULTS, error: error.message });
  return Response.json({
    greenBelow: data ? Number(data.green_below) : DEFAULTS.greenBelow,
    amberBelow: data ? Number(data.amber_below) : DEFAULTS.amberBelow,
    rachelCutoff: data?.rachel_cutoff ?? DEFAULTS.rachelCutoff,
  } satisfies RetentionSettings);
}

const isPct = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));

export async function PUT(request: Request): Promise<Response> {
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD ?? process.env.VITE_AUTH_PASSWORD;
  if (!adminPassword || request.headers.get('x-admin-password') !== adminPassword) {
    return Response.json({ error: 'Wrong admin password' }, { status: 401 });
  }
  const db = supabase();
  if (!db) return Response.json({ error: 'Supabase not configured' }, { status: 502 });

  const b = await request.json().catch(() => null) as RetentionSettings | null;
  if (!b || !isPct(b.greenBelow) || !isPct(b.amberBelow) || b.greenBelow > b.amberBelow || !isDate(b.rachelCutoff)) {
    return Response.json({ error: 'Thresholds must be 0–100 with green ≤ amber, and the cut-off a date' }, { status: 400 });
  }
  const settings: RetentionSettings = { greenBelow: b.greenBelow, amberBelow: b.amberBelow, rachelCutoff: b.rachelCutoff };
  const { error } = await db.from('retention_settings').upsert({
    id: 1, green_below: settings.greenBelow, amber_below: settings.amberBelow, rachel_cutoff: settings.rachelCutoff,
    updated_at: new Date().toISOString(),
  });
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json(settings);
}
