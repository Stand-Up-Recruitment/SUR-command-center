// Recruiter capacity / hiring trigger, shared by the Recruitment tab and the settings API.
// Placement targets, breakeven and pace, shared by the Recruitment tab and the Overview.
import type { JobAgingKPIs, RecruiterKPIs, RecruiterStat, RecruitmentSettings, RollingRates, TimeFrame } from '../types';

// Breakeven cost model — update these when Les's costs change (same pattern as
// RECRUITER_COUNT in services/airtable.ts's LTGP calc).
export const TOTAL_WEEKLY_OVERHEAD = 14000;   // NZD/week, manual input owned by Les
export const RECRUITER_WEEKLY_SALARY = 1442;  // NZD/week, ~$75k/year baseline
export const AVG_FEE_PER_PLACEMENT = 20000;   // NZD, blended flat-fee/% average
export const WEEKS_PER_MONTH = 4.33;

// Monthly placement targets per recruiter (by first name); anyone not listed gets the default.
const PLACEMENT_TARGETS_MONTHLY: Record<string, number> = { ayn: 4, ian: 4, lionel: 2 };
const DEFAULT_PLACEMENT_TARGET_MONTHLY = 2;

// Career track (Recruiter Career Track, trial v1, Nov 2026), by first name. Update when someone
// moves up. `next` is the bar for the next tier: Sourcers count sourced submissions + sourced
// placements, Placers count placements over a rolling 3 months.
export interface TierInfo {
  tier: string;
  kind: 'sourcer' | 'placer';
  kicker: number; // NZD per placement
  next?: { tier: string; submissions?: number; placements: number };
}
const TIERS: Record<string, TierInfo> = {
  ian:    { tier: 'Senior Placer', kind: 'placer', kicker: 800 },
  ayn:    { tier: 'Senior Placer', kind: 'placer', kicker: 0 },
  lionel: { tier: 'Intermediate Placer 1', kind: 'placer', kicker: 400, next: { tier: 'Senior Placer', placements: 9 } },
  amir:   { tier: 'Team Lead (in training)', kind: 'placer', kicker: 800 },
  ty:     { tier: 'Sourcer 1', kind: 'sourcer', kicker: 0, next: { tier: 'Sourcer 2', submissions: 10, placements: 1 } },
};
export const tierFor = (name: string): TierInfo | undefined => TIERS[firstName(name)];

// Nihanga is HR & Business Operations, not a recruiter — JobAdder lists her as the
// owner on some open jobs, but she shouldn't appear as a "By Recruiter" card or count
// toward the team's KPI totals.
const NON_RECRUITERS = ['nihanga'];
export const isNonRecruiter = (name: string | undefined) => Boolean(name) && NON_RECRUITERS.includes(firstName(name!));

const DAY_MS = 86_400_000;

// Editable in the Recruitment settings; these are the starting values.
export const DEFAULT_RECRUITMENT_SETTINGS: RecruitmentSettings = {
  maxActiveJobs: 7,
  rampWeeks: 4,
  bufferWeeks: 2,
  recruiters: ['Ayn', 'Ian', 'Ty', 'Lionel', 'Amir'].map(name => ({ name, startDate: null })),
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
 * Pass `listed` (the settings recruiter list) to keep only current recruiters, e.g. drop someone who left.
 */
export function teamRecruiters(data: RecruiterKPIs, jobs: JobAgingKPIs | undefined, listed?: { name: string }[]): RecruiterStat[] {
  const out: RecruiterStat[] = [...data.byRecruiter];
  for (const stat of jobs?.byRecruiter ?? []) {
    if (isNonRecruiter(stat.name)) continue;
    if (!out.some(r => firstName(r.name) === firstName(stat.name))) {
      out.push({
        name: stat.name, phoneInterviews: 0, prevPhoneInterviews: 0, internalInterviews: 0, prevInternalInterviews: 0,
        clientInterviews: 0, prevClientInterviews: 0, noShows: 0, prevNoShows: 0, placements: 0, prevPlacements: 0,
        fallThroughRate: 0, prevFallThroughRate: 0,
        rolling: { intToClient: 0, clientToContract: 0, monthsOfData: 0 },
        monthlyPlacements: data.months.map(() => null),
        placements3m: 0, sourcedSubmissions: 0, sourcedPlacements: 0,
      });
    }
  }
  const keep = listed && new Set(listed.map(r => firstName(r.name)));
  return out.filter(r => !keep || keep.has(firstName(r.name))).sort((a, b) => a.name.localeCompare(b.name));
}

export function placementTargetFor(name: string, frame: TimeFrame): number {
  if (tierFor(name)?.kind === 'sourcer') return 0; // Sourcers book; their Placers place
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

type SourcingRow = { Name?: string; Status?: string; Created?: string; 'Candidates Email'?: string[]; 'Candidate Name'?: string[] };
const normName = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Sourcer tally from the KPI's Recruiter table, keyed by first name. Whoever logged a candidate's
 * earliest row sourced them; it's a sourced submission once the candidate has a Client-Candidate
 * Interview row, and a sourced placement once they have a signed contract (matched by candidate
 * name; fall-overs still count). Bot-booked candidates are logged under the bot, so they don't count.
 * shortcut: counts are all-time, not since the last tier change; add tier dates when someone moves up.
 */
export function sourcedTally(rows: SourcingRow[], placedCandidateNames: string[]) {
  const byCandidate = new Map<string, SourcingRow[]>();
  for (const r of rows) {
    const c = r['Candidates Email']?.[0];
    if (!c || !r.Created || !r.Name?.trim()) continue;
    if (!byCandidate.has(c)) byCandidate.set(c, []);
    byCandidate.get(c)!.push(r);
  }
  const placed = new Set(placedCandidateNames.map(normName));
  const out = new Map<string, { submissions: number; placements: number }>();
  for (const cRows of byCandidate.values()) {
    if (!cRows.some(r => r.Status === 'Client-Candidate Interview')) continue;
    const first = cRows.reduce((a, b) => (Date.parse(b.Created!) < Date.parse(a.Created!) ? b : a));
    const t = out.get(firstName(first.Name!)) ?? { submissions: 0, placements: 0 };
    t.submissions++;
    if (cRows.some(r => r['Candidate Name']?.some(n => placed.has(normName(n))))) t.placements++;
    out.set(firstName(first.Name!), t);
  }
  return out;
}

// ─── Recruitment tab v2: biggest break, today's actions, hire check ─────────────

export interface StageCount { done: number; needed: number }

export interface BoardRow {
  name: string;
  kind: 'placer' | 'sourcer';
  jobs: number;
  internal: StageCount;
  client: StageCount;
  placements: StageCount;
  rolling: RollingRates;   // own 4-month rates
}

export interface Break { stage: string; detail: string; action: string }

/**
 * A Placer's weakest point: an empty desk first, else whichever is furthest below par —
 * internal or client interviews vs needed by today, or their 4-month int → client /
 * client → contract rate vs the team's. Rates above 100% can't be real, so they're skipped.
 * null = nothing below par.
 */
export function biggestBreak(r: BoardRow, team: RollingRates): Break | null {
  if (r.jobs === 0) return { stage: 'No jobs', detail: 'No jobs on their desk.', action: 'Give them jobs today' };
  const rate = (own: number, par: number) => (r.rolling.monthsOfData && par > 0 && own <= 1 ? own / par : null);
  const vs = (s: StageCount) => (s.needed > 0 ? s.done / s.needed : null);
  const pctOf = (n: number) => `${Math.round(n * 100)}%`;
  const candidates: (Break & { ratio: number | null })[] = [
    { stage: 'Internal interviews', detail: `Internal interviews. ${r.internal.done} vs ${r.internal.needed} needed.`, action: 'Book interviews this week', ratio: vs(r.internal) },
    { stage: 'Client interviews', detail: `Client interviews. ${r.client.done} vs ${r.client.needed} needed.`, action: '1:1 on CVs sent', ratio: vs(r.client) },
    { stage: 'Int → client', detail: `Int → client. ${pctOf(r.rolling.intToClient)} vs team ${pctOf(team.intToClient)} (4 months).`, action: 'Review CVs sent to clients', ratio: rate(r.rolling.intToClient, team.intToClient) },
    { stage: 'Closing', detail: `Closing. ${pctOf(r.rolling.clientToContract)} of client interviews become contracts vs team ${pctOf(team.clientToContract)}.`, action: 'Closing coaching', ratio: rate(r.rolling.clientToContract, team.clientToContract) },
  ];
  const worst = candidates
    .filter((c): c is Break & { ratio: number } => c.ratio !== null && c.ratio < 1)
    .sort((a, b) => a.ratio - b.ratio)[0];
  return worst ? { stage: worst.stage, detail: worst.detail, action: worst.action } : null;
}

export type ActionLevel = 'FIX NOW' | 'THIS WEEK' | '1:1' | 'WATCH';
export interface TodayAction { level: ActionLevel; who: string; title: string; detail: string; action: string }

export interface ActionInputs {
  rows: BoardRow[];
  team: RollingRates;
  cap: number;
  jobs: { stale: number; open: number } | null;     // null = no job data
  showUpPct: number | null;                         // null = no interview data
  bot: { dials: number; expected: number; prev: number } | null;  // expected = last period's dials pro-rated to today
  period: string;                                   // 'week' | 'month', for copy
}

const LEVEL_ORDER: ActionLevel[] = ['FIX NOW', 'THIS WEEK', '1:1', 'WATCH'];
export const SHOW_UP_TARGET = 70;
export const STALE_LIMIT = 25;

const list = (names: string[]) => names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

/** "Bot off" proxy. shortcut: under 10% of last period's pace, until the bot sends ON/OFF + last-dial time. */
export const botLooksOff = (bot: ActionInputs['bot']) => bot !== null && bot.expected >= 20 && bot.dials < bot.expected * 0.1;

/** The ranked "Today's actions" list (brief v2 rules). */
export function todaysActions(i: ActionInputs): TodayAction[] {
  const out: TodayAction[] = [];
  if (i.bot && botLooksOff(i.bot)) {
    out.push({ level: 'FIX NOW', who: 'Bot', title: 'Recruitment bot looks off', detail: `${i.bot.dials} leads dialled this ${i.period} vs ${i.bot.prev} last ${i.period}.`, action: 'Turn the bot back on today' });
  }
  const placers = i.rows.filter(r => r.kind === 'placer');
  const empty = placers.filter(p => p.jobs === 0);
  const full = i.rows.filter(r => r.jobs >= i.cap);
  if (empty.length && full.length) {
    out.push({
      level: 'FIX NOW', who: 'Manager', title: 'Jobs sitting with the wrong people',
      detail: `${list(empty.map(e => e.name))} ${empty.length === 1 ? 'has' : 'have'} 0 jobs. ${list(full.map(f => `${f.name} ${f.jobs}`))} against a cap of ${i.cap}.`,
      action: `Move stale jobs to ${list(empty.map(e => e.name))}`,
    });
  }
  if (i.jobs && i.jobs.open > 0 && (i.jobs.stale / i.jobs.open) * 100 > STALE_LIMIT) {
    out.push({ level: 'THIS WEEK', who: 'All Placers', title: `${i.jobs.stale} of ${i.jobs.open} jobs are stale`, detail: `Jobs open 36+ days. Target is under ${Math.floor((i.jobs.open * STALE_LIMIT) / 100)}.`, action: 'Clear or re-brief every stale job' });
  }
  if (i.showUpPct !== null && i.showUpPct < SHOW_UP_TARGET) {
    out.push({ level: 'THIS WEEK', who: 'Team', title: `Show-up rate ${i.showUpPct}%`, detail: `Target ${SHOW_UP_TARGET}%. Booked candidates aren't turning up to internal interviews.`, action: 'Confirm interviews the day before' });
  }
  const flagged = full.length ? new Set(empty.map(e => e.name)) : new Set<string>(); // already in the FIX NOW line
  for (const r of placers.filter(p => !flagged.has(p.name))) {
    const p = r.placements;
    if (p.needed > 0 && p.done / p.needed < 0.75) {
      const b = biggestBreak(r, i.team);
      out.push({ level: '1:1', who: r.name, title: `${p.done} placed, needs ${p.needed} by today`, detail: b?.detail ?? 'No single stage stands out.', action: b?.action ?? 'Review pipeline' });
    } else if (p.needed > 0 && p.done >= p.needed && r.internal.needed > 0 && r.internal.done / r.internal.needed < 0.75) {
      out.push({ level: 'WATCH', who: r.name, title: 'On track now, empty next month', detail: `${p.done} placed (on pace) but ${r.internal.done} internal interviews vs ${r.internal.needed} needed.`, action: 'Book interviews to refill pipeline' });
    }
  }
  return out.sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level));
}

export interface HireTest { label: string; pass: boolean | null; now: string }

/** "Should we hire?": HIRE only when all three tests pass. pass null = no data (counts as not passed). */
export function shouldWeHire(
  load: { jobs: number; people: number; empty: number } | null, jobs: { stale: number; open: number } | null, netNewPerWeek: number | null,
): { hire: boolean; tests: HireTest[] } {
  const avg = load && load.people ? load.jobs / load.people : null;
  const stalePct = jobs && jobs.open ? Math.round((jobs.stale / jobs.open) * 100) : null;
  const tests: HireTest[] = [
    {
      label: 'Desk is full: average 6+ jobs each', pass: avg === null ? null : avg >= 6,
      now: !load || avg === null ? 'No job data' : `${load.jobs} jobs across ${load.people} Placers (${avg.toFixed(1)} each)${load.empty ? `, but ${load.empty} have none` : ''}`,
    },
    { label: `Stale jobs under ${STALE_LIMIT}%`, pass: stalePct === null ? null : stalePct < STALE_LIMIT, now: stalePct === null ? 'No job data' : `Now ${stalePct}% (${jobs!.stale} of ${jobs!.open})` },
    // shortcut: one 4-week net figure, not "positive every week for 4 weeks"; needs weekly opened/closed.
    {
      label: 'New jobs growing 4 weeks in a row', pass: netNewPerWeek === null ? null : netNewPerWeek > 0,
      now: netNewPerWeek === null ? 'Needs opened / closed feed' : `${netNewPerWeek > 0 ? '+' : ''}${netNewPerWeek.toFixed(1)} a week, 4-week average`,
    },
  ];
  return { hire: tests.every(t => t.pass === true), tests };
}
