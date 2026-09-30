// Vercel function: editable Marketing settings (monthly ad budget, posting target).
// GET  /api/marketing-settings
// PUT  /api/marketing-settings  { monthlyBudget, postsPerWeek }  — header x-admin-password
import { supabase } from './_lib/supabase';
import type { MarketingSettings } from '../src/types';

const DEFAULTS: MarketingSettings = { monthlyBudget: null, postsPerWeek: 7 };

export async function GET(): Promise<Response> {
  const db = supabase();
  if (!db) return Response.json({ ...DEFAULTS, error: 'Supabase not configured' });
  const { data, error } = await db.from('marketing_settings').select('monthly_budget, posts_per_week').eq('id', 1).maybeSingle();
  if (error) return Response.json({ ...DEFAULTS, error: error.message });
  return Response.json({
    monthlyBudget: data?.monthly_budget != null ? Number(data.monthly_budget) : null,
    postsPerWeek: data?.posts_per_week ?? DEFAULTS.postsPerWeek,
  } satisfies MarketingSettings);
}

export async function PUT(request: Request): Promise<Response> {
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD ?? process.env.VITE_AUTH_PASSWORD;
  if (!adminPassword || request.headers.get('x-admin-password') !== adminPassword) {
    return Response.json({ error: 'Wrong admin password' }, { status: 401 });
  }
  const db = supabase();
  if (!db) return Response.json({ error: 'Supabase not configured' }, { status: 502 });

  const body = await request.json().catch(() => null) as Partial<MarketingSettings> | null;
  const budget = body?.monthlyBudget;
  const posts = body?.postsPerWeek;
  if ((budget != null && !(Number.isFinite(budget) && budget >= 0)) || !(Number.isInteger(posts) && posts! > 0)) {
    return Response.json({ error: 'monthlyBudget must be ≥ 0 (or empty) and postsPerWeek a whole number > 0' }, { status: 400 });
  }
  const { error } = await db.from('marketing_settings').upsert({
    id: 1, monthly_budget: budget ?? null, posts_per_week: posts, updated_at: new Date().toISOString(),
  });
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json({ monthlyBudget: budget ?? null, postsPerWeek: posts! } satisfies MarketingSettings);
}
