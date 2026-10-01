// Recruiter capacity / hiring trigger, shared by the Recruitment tab and the settings API.
// Placement targets, breakeven and pace, shared by the Recruitment tab and the Overview.
import type { JobAgingKPIs, RecruiterKPIs, RecruiterStat, RecruitmentSettings, TimeFrame } from '../types';

// Breakeven cost model — update these when Les's costs change (same pattern as
// RECRUITER_COUNT in services/airtable.ts's LTGP calc).
export const TOTAL_WEEKLY_OVERHEAD = 14000;   // NZD/week, manual input owned by Les
export const RECRUITER_WEEKLY_SALARY = 1442;  // NZD/week, ~$75k/year baseline
export const AVG_FEE_PER_PLACEMENT = 20000;   // NZD, blended flat-fee/% average
export const WEEKS_PER_MONTH = 4.33;

// Monthly placement targets per recruiter (by first name); anyone not listed gets the default.
const PLACEMENT_TARGETS_MONTHLY: Record<string, number> = { ayn: 4, ian: 4, kade: 2, lionel: 2 };
const DEFAULT_PLACEMENT_TARGET_MONTHLY = 2;

// Nihanga is HR & Business Operations, not a recruiter — JobAdder lists her as the
// owner on some open jobs, but she shouldn't appear as a "By Recruiter" card.
const NON_RECRUITERS = ['nihanga'];

const DAY_MS = 86_400_000;

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

/**
 * Recruiters shown on the tab: everyone with KPI rows, plus anyone with open jobs (job aging
 * is a live snapshot, not tied to the period). Matched by first name, sorted by name.
 */
export function teamRecruiters(data: RecruiterKPIs, jobs: JobAgingKPIs | undefined): RecruiterStat[] {
  const out: RecruiterStat[] = [...data.byRecruiter];
  for (const stat of jobs?.byRecruiter ?? []) {
    if (NON_RECRUITERS.includes(firstName(stat.name))) continue;
    if (!out.some(r => firstName(r.name) === firstName(stat.name))) {
      out.push({
        name: stat.name, phoneInterviews: 0, prevPhoneInterviews: 0, internalInterviews: 0, prevInternalInterviews: 0,
        clientInterviews: 0, prevClientInterviews: 0, noShows: 0, prevNoShows: 0, placements: 0, prevPlacements: 0,
        fallThroughRate: 0, prevFallThroughRate: 0,
        rolling: { intToClient: 0, clientToContract: 0, monthsOfData: 0 },
        monthlyPlacements: data.months.map(() => null),
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function placementTargetFor(name: string, frame: TimeFrame): number {
  const monthly = PLACEMENT_TARGETS_MONTHLY[firstName(name)] ?? DEFAULT_PLACEMENT_TARGET_MONTHLY;
  return frame === 'week' ? monthly / WEEKS_PER_MONTH : monthly;
}

/** Placements one recruiter needs this period to cover their salary plus a share of overhead. */
export function breakevenPerRecruiter(headcount: number, frame: TimeFrame): number {
  const overheadPerRecruiter = headcount > 0 ? TOTAL_WEEKLY_OVERHEAD / headcount : 0;
  const weekly = (overheadPerRecruiter + RECRUITER_WEEKLY_SALARY) / AVG_FEE_PER_PLACEMENT;
  return frame === 'week' ? weekly : weekly * WEEKS_PER_MONTH;
}

export interface RecruitmentPace {
  placements: number;
  target: number;      // team target = sum of the recruiters' targets
  breakeven: number;   // team breakeven
  projected: number;   // straight-line projection to period end
}

/** `start`/`now` are the period boundaries from timeBoundaries(frame). */
export function recruitmentPace(
  data: RecruiterKPIs, recruiters: RecruiterStat[], frame: TimeFrame, start: number, now: number,
): RecruitmentPace {
  const nowDate = new Date(now);
  const periodDays = frame === 'week' ? 7 : new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0).getDate();
  const daysElapsed = Math.max(1, Math.ceil((now - start) / DAY_MS));
  return {
    placements: data.placements,
    target: recruiters.reduce((s, r) => s + placementTargetFor(r.name, frame), 0),
    breakeven: breakevenPerRecruiter(recruiters.length, frame) * recruiters.length,
    projected: Math.round((data.placements / daysElapsed) * periodDays),
  };
}
