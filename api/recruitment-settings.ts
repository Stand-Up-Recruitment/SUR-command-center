// Vercel function: editable Recruitment settings (job cap per recruiter, ramp + buffer weeks for
// the hiring trigger, and the recruiter list that sets headcount and start dates).
// GET  /api/recruitment-settings
// PUT  /api/recruitment-settings  RecruitmentSettings  — header x-admin-password
import { supabase } from './_lib/supabase.js';
import { DEFAULT_RECRUITMENT_SETTINGS as DEFAULTS, firstName } from '../src/lib/recruitment.js';
import type { RecruitmentSettings } from '../src/types/index.js';

export async function GET(): Promise<Response> {
  const db = supabase();
  if (!db) return Response.json({ ...DEFAULTS, error: 'Supabase not configured' });
  const { data, error } = await db.from('recruitment_settings').select('*').eq('id', 1).maybeSingle();
  if (error) return Response.json({ ...DEFAULTS, error: error.message });
  return Response.json({
    maxActiveJobs: data?.max_active_jobs ?? DEFAULTS.maxActiveJobs,
    rampWeeks: data?.ramp_weeks ?? DEFAULTS.rampWeeks,
    bufferWeeks: data?.buffer_weeks ?? DEFAULTS.bufferWeeks,
    recruiters: data?.recruiters ?? DEFAULTS.recruiters,
  } satisfies RecruitmentSettings);
}

const wholeAtLeast = (v: unknown, min: number) => Number.isInteger(v) && (v as number) >= min;
const isDate = (v: unknown) => v === null || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)));

export async function PUT(request: Request): Promise<Response> {
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD ?? process.env.VITE_AUTH_PASSWORD;
  if (!adminPassword || request.headers.get('x-admin-password') !== adminPassword) {
    return Response.json({ error: 'Wrong admin password' }, { status: 401 });
  }
  const db = supabase();
  if (!db) return Response.json({ error: 'Supabase not configured' }, { status: 502 });

  const b = await request.json().catch(() => null) as RecruitmentSettings | null;
  const recruiters = Array.isArray(b?.recruiters)
    ? b.recruiters.map(r => ({ name: typeof r?.name === 'string' ? r.name.trim() : '', startDate: r?.startDate ?? null }))
    : null;
  // Recruiters are matched to JobAdder/Airtable by first name, so first names must be unique.
  const firstNames = recruiters?.map(r => firstName(r.name)) ?? [];
  const valid = b && recruiters
    && wholeAtLeast(b.maxActiveJobs, 1) && wholeAtLeast(b.rampWeeks, 0) && wholeAtLeast(b.bufferWeeks, 0)
    && recruiters.every(r => r.name && isDate(r.startDate))
    && new Set(firstNames).size === firstNames.length;
  if (!valid) {
    return Response.json({ error: 'Max jobs must be a whole number > 0, ramp and buffer whole weeks ≥ 0, and each recruiter needs a name (unique first name) and an optional start date' }, { status: 400 });
  }
  const settings: RecruitmentSettings = {
    maxActiveJobs: b.maxActiveJobs, rampWeeks: b.rampWeeks, bufferWeeks: b.bufferWeeks, recruiters,
  };
  const { error } = await db.from('recruitment_settings').upsert({
    id: 1,
    max_active_jobs: settings.maxActiveJobs,
    ramp_weeks: settings.rampWeeks,
    buffer_weeks: settings.bufferWeeks,
    recruiters: settings.recruiters,
    updated_at: new Date().toISOString(),
  });
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json(settings);
}
