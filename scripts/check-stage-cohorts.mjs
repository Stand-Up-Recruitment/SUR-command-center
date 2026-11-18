// Runs the n8n "Compute Cohorts" code against fake inputs. Run: node scripts/check-stage-cohorts.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const code = readFileSync(new URL('./n8n/stage-cohorts.js', import.meta.url), 'utf8');
const D = 86400000, now = Date.now(), iso = (msAgo) => new Date(now - msAgo).toISOString();
const ev = (app, to, daysAgo, owner = 'ayn', job = 1, cand = app) =>
  ({ json: { applicationId: app, candidateId: cand, jobId: job, toStatus: to, changedAt: iso(daysAgo * D), appOwner: owner } });
const nodes = {
  Webhook: [{ json: { query: { currentFrom: iso(10 * D), currentTo: iso(0), prevFrom: iso(40 * D), prevTo: iso(10 * D) } } }],
  'Get Stage Events': [
    ev(1, 'Internal Interview', 5), ev(1, 'Checking References', 4.9), ev(1, 'Internal Interview', 4.8), // flip-flop counts once
    ev(1, 'CV Submitted to Client', 4), ev(1, 'Candidate-Client Interview', 3),
    ev(2, 'Internal Interview', 6), // no CV yet
    ev(3, 'Internal Interview', 20, 'lionel', 2), ev(3, 'CV Submitted to Client', 19, 'lionel', 2), // prev period, job 2 CV 19d ago
  ],
  'Get Placements': [{ json: { items: [{ candidate: { candidateId: 1 }, job: { jobId: 1 }, createdAt: iso(1 * D) }] } }],
  'Get Open Jobs': [{ json: { items: [
    { jobId: 1, jobTitle: 'A', owner: { firstName: 'Ayn' }, createdAt: iso(30 * D) },   // CV 4 days ago: alive
    { jobId: 2, jobTitle: 'B', owner: { firstName: 'Lionel' }, createdAt: iso(30 * D) }, // CV 19 days ago: dead
    { jobId: 3, jobTitle: 'C', owner: { firstName: 'Ian' }, createdAt: iso(3 * D) },     // too new
  ] } }],
};
const $ = (n) => ({ first: () => nodes[n][0], all: () => nodes[n] });
const [{ json: out }] = new Function('$', code)($);
const t = out.team;
assert.equal(t.internal, 2); assert.equal(t.cv, 1); assert.equal(t.client, 1);
assert.equal(t.prevInternal, 1); assert.equal(t.prevCv, 1);
assert.deepEqual(t.cohorts.internalToCv, { n: 3, converted: 2 });
assert.deepEqual(t.cohorts.cvToClient, { n: 2, converted: 1 });
assert.deepEqual(t.cohorts.clientToPlaced, { n: 1, converted: 1 });
assert.deepEqual(out.deadJobs.map(j => j.jobId), [2]);
assert.equal(out.deadJobs[0].daysSinceCv, 19);
assert.deepEqual(out.byRecruiter.map(r => r.name).sort(), ['Ayn', 'Lionel']);
console.log('cohort checks passed');
