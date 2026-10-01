// Recruiter capacity / hiring trigger, shared by the Recruitment tab and the settings API.
import type { JobAgingKPIs, RecruitmentSettings } from '../types';

// Editable in the Recruitment settings; these are the starting values.
export const DEFAULT_RECRUITMENT_SETTINGS: RecruitmentSettings = {
  maxActiveJobs: 7,
  rampWeeks: 4,
  bufferWeeks: 2,
  recruiters: ['Ayn', 'Ian', 'Kade', 'Lionel'].map(name => ({ name, startDate: null })),
};

// "Hire soon" runs this many weeks past the hire-now point (ramp + buffer).
const HIRE_SOON_BAND_WEEKS = 2;

export const firstName = (n: string) => n.trim().split(' ')[0].toLowerCase();

export type HiringState = 'hire-now' | 'hire-soon' | 'ok' | 'no-data';

export interface HiringTrigger {
  state: HiringState;
  slots: number;          // recruiters × max active jobs
  activeJobs: number;     // open jobs owned by listed recruiters + unowned
  growthPerWeek: number | null;  // (opened − closed) ÷ 4 over the last 28 days; null until the webhook sends it
  weeksUntilFull: number | null; // null when full, flat/falling, or no growth data
  hireNowAt: number;      // ramp + buffer
}

/**
 * Weeks until full = spare slots ÷ net jobs added per week. Only jobs owned by recruiters on
 * the settings list, plus jobs with no owner, count; anyone else (e.g. Nihanga) is left out.
 * A recruiter still ramping counts as full slots.
 */
export function hiringTrigger(jobs: JobAgingKPIs, s: RecruitmentSettings): HiringTrigger {
  const listed = new Set(s.recruiters.map(r => firstName(r.name)));
  const isListed = (name: string) => listed.has(firstName(name));

  const slots = s.recruiters.length * s.maxActiveJobs;
  const activeJobs = jobs.byRecruiter.filter(r => isListed(r.name)).reduce((n, r) => n + r.totalOpenJobs, 0)
    + (jobs.unassigned?.totalOpenJobs ?? 0);
  const spare = slots - activeJobs;

  const g = jobs.growth28;
  const growthPerWeek = g
    ? ([...g.byOwner.filter(o => isListed(o.name)), g.unassigned].reduce((n, f) => n + f.opened - f.closed, 0)) / 4
    : null;

  const hireNowAt = s.rampWeeks + s.bufferWeeks;
  const weeksUntilFull = spare > 0 && growthPerWeek !== null && growthPerWeek > 0 ? spare / growthPerWeek : null;
  const state: HiringState =
    spare <= 0 ? 'hire-now'
    : growthPerWeek === null ? 'no-data'
    : weeksUntilFull === null ? 'ok'
    : weeksUntilFull <= hireNowAt ? 'hire-now'
    : weeksUntilFull <= hireNowAt + HIRE_SOON_BAND_WEEKS ? 'hire-soon'
    : 'ok';

  return { state, slots, activeJobs, growthPerWeek, weeksUntilFull, hireNowAt };
}
