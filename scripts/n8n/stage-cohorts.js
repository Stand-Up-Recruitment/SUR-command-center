// Copy of the "Compute Cohorts" Code node in n8n workflow "Recruiter KPI - Stage Cohorts" (V22o8ycEg6WBnUSz).
// n8n is the source of truth: paste changes there, then update this copy. Checked by scripts/check-stage-cohorts.mjs.
// Recruitment tab feed from the Application Stage Events table (built by "Recruiter KPI - Application Stage Replay").
// Each application counts once per stage: its FIRST arrival there. Conversions follow the same applications
// from one stage to the next, so they can never go above 100%.
const DAY = 86400000;
const now = Date.now();
const q = $('Webhook').first().json.query || {};
const toMs = (s) => (s ? new Date(s.length === 10 ? s + 'T00:00:00Z' : s).getTime() : NaN);
const cur = [toMs(q.currentFrom), q.currentTo ? toMs(q.currentTo) : now];
const prev = [toMs(q.prevFrom), toMs(q.prevTo)];
const inRange = (t, r) => t >= r[0] && t < r[1];

const STAGE = { 'Internal Interview': 'internal', 'CV Submitted to Client': 'cv', 'Candidate-Client Interview': 'client' };
const STEPS = [['internal', 'cv'], ['cv', 'client'], ['client', 'placed']];
const COHORT_FROM = now - 28 * DAY;

const pageItems = (name) => $(name).all().flatMap((p) => p.json.items || []);

// First arrival per application per stage, plus the last CV sent per job.
const apps = {};
const lastCvByJob = {};
for (const it of $('Get Stage Events').all()) {
  const r = it.json;
  const a = apps[r.applicationId] || (apps[r.applicationId] = { owner: r.appOwner || r.jobOwner || '', key: r.candidateId + ':' + r.jobId });
  const st = STAGE[r.toStatus];
  if (!st) continue;
  const t = new Date(r.changedAt).getTime();
  if (!(a[st] <= t)) a[st] = t;
  if (st === 'cv' && !(lastCvByJob[r.jobId] >= t)) lastCvByJob[r.jobId] = t;
}

// A placement for the same candidate on the same job = the application was placed.
const placedAt = {};
for (const p of pageItems('Get Placements')) {
  const key = (p.candidate && p.candidate.candidateId) + ':' + (p.job && p.job.jobId);
  const t = new Date(p.createdAt).getTime();
  if (!(placedAt[key] <= t)) placedAt[key] = t;
}
for (const a of Object.values(apps)) if (placedAt[a.key]) a.placed = placedAt[a.key];

const blank = () => ({
  internal: 0, cv: 0, client: 0, prevInternal: 0, prevCv: 0, prevClient: 0,
  cohorts: { internalToCv: { n: 0, converted: 0 }, cvToClient: { n: 0, converted: 0 }, clientToPlaced: { n: 0, converted: 0 } },
});
const STEP_KEYS = ['internalToCv', 'cvToClient', 'clientToPlaced'];
const team = blank();
const byName = {};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

for (const a of Object.values(apps)) {
  const name = cap(a.owner || '');
  const targets = name ? [team, byName[name] || (byName[name] = blank())] : [team];
  for (const t of targets) {
    for (const st of ['internal', 'cv', 'client']) {
      if (inRange(a[st], cur)) t[st]++;
      else if (inRange(a[st], prev)) t['prev' + cap(st)]++;
    }
    STEPS.forEach(([from, to], i) => {
      if (!(a[from] >= COHORT_FROM)) return;
      const c = t.cohorts[STEP_KEYS[i]];
      c.n++;
      if (a[to] != null) c.converted++;
    });
  }
}

// Dead jobs: open 7+ days with no CV sent in the last 7 days.
const deadJobs = [];
for (const j of pageItems('Get Open Jobs')) {
  const opened = new Date(j.createdAt).getTime();
  if (opened > now - 7 * DAY) continue;
  const lastCv = lastCvByJob[j.jobId];
  if (lastCv >= now - 7 * DAY) continue;
  deadJobs.push({
    jobId: j.jobId, jobTitle: j.jobTitle, owner: (j.owner && j.owner.firstName) || '',
    daysOpen: Math.floor((now - opened) / DAY),
    daysSinceCv: lastCv ? Math.floor((now - lastCv) / DAY) : null,
  });
}

return [{ json: {
  generatedAt: new Date(now).toISOString(),
  cohortWindowDays: 28,
  team,
  byRecruiter: Object.entries(byName).map(([name, v]) => ({ name, ...v })),
  deadJobs,
} }];
