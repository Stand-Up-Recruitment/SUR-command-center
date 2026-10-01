// Vercel function: editable Marketing settings (monthly ad budget, posting target,
// monthly targets, and the non-trade categories that don't count as qualified).
// GET  /api/marketing-settings
// PUT  /api/marketing-settings  MarketingSettings  — header x-admin-password
import { supabase } from './_lib/supabase.js';
import { DEFAULT_NON_TRADE_CATEGORIES } from '../src/lib/qualified.js';
import type { MarketingSettings } from '../src/types/index.js';

const DEFAULTS: MarketingSettings = {
  monthlyBudget: null,
  postsPerWeek: 7,
  targets: { callsBooked: null, qualifiedCandidates: null, costPerBookedCall: null, costPerQualifiedCandidate: null },
  nonTradeCategories: DEFAULT_NON_TRADE_CATEGORIES,
};

const num = (v: unknown) => (v == null ? null : Number(v));

export async function GET(): Promise<Response> {
  const db = supabase();
  if (!db) return Response.json({ ...DEFAULTS, error: 'Supabase not configured' });
  const { data, error } = await db.from('marketing_settings').select('*').eq('id', 1).maybeSingle();
  if (error) return Response.json({ ...DEFAULTS, error: error.message });
  return Response.json({
    monthlyBudget: num(data?.monthly_budget),
    postsPerWeek: data?.posts_per_week ?? DEFAULTS.postsPerWeek,
    targets: {
      callsBooked: num(data?.target_calls_booked),
      qualifiedCandidates: num(data?.target_qualified_candidates),
      costPerBookedCall: num(data?.target_cost_per_booked_call),
      costPerQualifiedCandidate: num(data?.target_cost_per_qualified_candidate),
    },
    nonTradeCategories: data?.non_trade_categories ?? DEFAULTS.nonTradeCategories,
  } satisfies MarketingSettings);
}

const okAmount = (v: unknown) => v == null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);

export async function PUT(request: Request): Promise<Response> {
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD ?? process.env.VITE_AUTH_PASSWORD;
  if (!adminPassword || request.headers.get('x-admin-password') !== adminPassword) {
    return Response.json({ error: 'Wrong admin password' }, { status: 401 });
  }
  const db = supabase();
  if (!db) return Response.json({ error: 'Supabase not configured' }, { status: 502 });

  const b = await request.json().catch(() => null) as MarketingSettings | null;
  const t = b?.targets;
  const valid = b && t
    && okAmount(b.monthlyBudget)
    && Number.isInteger(b.postsPerWeek) && b.postsPerWeek > 0
    && okAmount(t.callsBooked) && okAmount(t.qualifiedCandidates)
    && okAmount(t.costPerBookedCall) && okAmount(t.costPerQualifiedCandidate)
    && Array.isArray(b.nonTradeCategories) && b.nonTradeCategories.every(c => typeof c === 'string');
  if (!valid) {
    return Response.json({ error: 'Amounts and targets must be ≥ 0 (or empty), posts per week a whole number > 0, and categories a list of names' }, { status: 400 });
  }
  const settings: MarketingSettings = {
    ...b,
    nonTradeCategories: [...new Set(b.nonTradeCategories.map(c => c.trim()).filter(Boolean))],
  };
  const { error } = await db.from('marketing_settings').upsert({
    id: 1,
    monthly_budget: settings.monthlyBudget,
    posts_per_week: settings.postsPerWeek,
    target_calls_booked: t.callsBooked,
    target_qualified_candidates: t.qualifiedCandidates,
    target_cost_per_booked_call: t.costPerBookedCall,
    target_cost_per_qualified_candidate: t.costPerQualifiedCandidate,
    non_trade_categories: settings.nonTradeCategories,
    updated_at: new Date().toISOString(),
  });
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json(settings);
}
