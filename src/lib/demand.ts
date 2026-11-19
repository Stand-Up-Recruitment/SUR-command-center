// Demand signals for the Marketing tab (brief v2): where should the ads point?
// Shared by api/marketing-demand.ts (server) and the Marketing tab. No imports, so it runs anywhere.
//
// shortcut: trades and locations are matched by keyword from free text (job titles, Airtable
// Category, ad set names, preferred-location lists). Upgrade to a trade field on JobAdder jobs
// and ad sets named Side_Trade_Location once both exist.

const TRADES: [string, RegExp][] = [
  ['Roofer', /roof/i],
  ['Electrician', /electric|sparky/i],
  ['Plumber / Drainlayer', /plumb|gasfit|drainlay/i],
  ['HVAC / Refrigeration', /hvac|refrigerat|air ?con/i],
  ['Carpenter / Builder', /carpent|builder|joiner|formwork/i],
  ['Welder / Fabricator', /weld|fabricat|boilermak|fitter/i],
  ['Diesel Mechanic', /diesel|heavy (vehicle|duty|machinery) mech/i],
  ['Mechanic', /mechanic|automotive/i],
  ['Truck Driver', /truck|driver|haul|road ?train|livestock transport/i],
  ['Machine Operator', /operator|excavator|dozer|grader|loader/i],
  ['Civil Construction', /civil|pipe ?lay|concret|steel ?fix|pit & pipe/i],
  ['Bricklayer', /brick/i],
  ['Painter', /paint/i],
  ['Scaffolder', /scaffold/i],
  ['Glazier', /glaz/i],
  ['Landscaper', /landscap/i],
  ['Tiler', /tiler|tiling/i],
  ['Plasterer', /plaster|gib|drywall/i],
  ['Rigger', /rigg/i],
];

/** The trade a job title, category or ad set name points at, or null. */
export function tradeOf(text: string | null | undefined): string | null {
  if (!text) return null;
  return TRADES.find(([, re]) => re.test(text))?.[0] ?? null;
}

const REGIONS: [string, RegExp][] = [
  ['Queensland', /qld|queensland|brisbane|gold coast|sunshine coast|cairns|townsville|mackay|toowoomba|rockhampton/i],
  ['New South Wales', /nsw|new south wales|sydney|newcastle|wollongong/i],
  ['Victoria', /\bvic\b|victoria|melbourne|geelong|ballarat|bendigo/i],
  ['Western Australia', /\bwa\b|western australia|perth|pilbara|kalgoorlie/i],
  ['South Australia', /\bsa\b|south australia|adelaide/i],
  ['Northern Territory', /\bnt\b|northern territory|darwin/i],
  ['Tasmania', /\btas\b|tasmania|hobart|launceston/i],
  ['ACT', /\bact\b|canberra/i],
  ['New Zealand', /\bnz\b|new zealand|auckland|wellington|christchurch|hamilton|tauranga|dunedin/i],
];
const AU_REGIONS = REGIONS.slice(0, 8).map(([r]) => r);
const ANY_AU = /regional australia|anywhere|\bfifo\b|^australia$/i;

/** Regions named in a location or preferred-locations list. "Anywhere" / "Regional Australia" = every Australian state. */
export function regionsOf(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = new Set(REGIONS.filter(([, re]) => re.test(text)).map(([r]) => r));
  if (text.split(/[,/]/).some(part => ANY_AU.test(part.trim()))) AU_REGIONS.forEach(r => found.add(r));
  return [...found];
}

export interface DemandJob { title: string; location: string; createdAt: string | null }
export interface DemandCandidate { trade: string | null; locations: string }

export interface DemandRules { staleDays: number; readyPerJob: number; buildUpRatio: number; minReady: number }
export const DEFAULT_DEMAND_RULES: DemandRules = { staleDays: 30, readyPerJob: 2, buildUpRatio: 2, minReady: 3 };

export interface ShortageRow { trade: string; openJobs: number; stale: number; readyToGo: number }
export interface BuildUpRow { trade: string; region: string; readyToGo: number; openJobs: number }
export interface DemandSignals {
  generatedAt: string;
  shortages: ShortageRow[];
  buildUp: BuildUpRow[];
  openJobs: number; jobsMatched: number;
  readyToGo: number; readyMatched: number;
  error?: string;
}

/** Shortage: a trade with a job open staleDays+ and fewer than readyPerJob Ready-to-Go per open job.
 *  Build-up: Ready-to-Go in a trade + region more than buildUpRatio × the open jobs there. */
export function buildDemand(jobs: DemandJob[], candidates: DemandCandidate[], now: number, rules = DEFAULT_DEMAND_RULES): Omit<DemandSignals, 'generatedAt'> {
  const jobsBy = new Map<string, { open: number; stale: number; regions: Map<string, number> }>();
  let jobsMatched = 0;
  for (const j of jobs) {
    const trade = tradeOf(j.title);
    if (!trade) continue;
    jobsMatched++;
    const t = jobsBy.get(trade) ?? { open: 0, stale: 0, regions: new Map() };
    t.open++;
    if (j.createdAt && (now - new Date(j.createdAt).getTime()) / 86_400_000 >= rules.staleDays) t.stale++;
    for (const r of regionsOf(j.location)) t.regions.set(r, (t.regions.get(r) ?? 0) + 1);
    jobsBy.set(trade, t);
  }

  const readyBy = new Map<string, { total: number; regions: Map<string, number> }>();
  let readyMatched = 0;
  for (const c of candidates) {
    if (!c.trade) continue;
    readyMatched++;
    const t = readyBy.get(c.trade) ?? { total: 0, regions: new Map() };
    t.total++;
    for (const r of regionsOf(c.locations)) t.regions.set(r, (t.regions.get(r) ?? 0) + 1);
    readyBy.set(c.trade, t);
  }

  const shortages: ShortageRow[] = [...jobsBy]
    .map(([trade, t]) => ({ trade, openJobs: t.open, stale: t.stale, readyToGo: readyBy.get(trade)?.total ?? 0 }))
    .filter(s => s.stale > 0 && s.readyToGo < s.openJobs * rules.readyPerJob)
    .sort((a, b) => b.stale - a.stale || a.readyToGo / a.openJobs - b.readyToGo / b.openJobs);

  const buildUp: BuildUpRow[] = [];
  for (const [trade, t] of readyBy) {
    for (const [region, ready] of t.regions) {
      const open = jobsBy.get(trade)?.regions.get(region) ?? 0;
      if (ready >= rules.minReady && ready > open * rules.buildUpRatio) buildUp.push({ trade, region, readyToGo: ready, openJobs: open });
    }
  }
  buildUp.sort((a, b) => (b.readyToGo - b.openJobs * rules.buildUpRatio) - (a.readyToGo - a.openJobs * rules.buildUpRatio));

  return { shortages, buildUp, openJobs: jobs.length, jobsMatched, readyToGo: candidates.length, readyMatched };
}
