// Self-check for the Sales v2 rules. Run: node scripts/check-sales.ts
import assert from 'node:assert/strict';
import { neededBy, vsTarget, openStatus, salesActions, biggestBreak, closeRate, qualified, funnelRates } from '../src/lib/sales.ts';
import type { SalesFunnel, SalesMonth } from '../src/types/index.ts';

// Brief: 26 Nov, target 10 → need 9 by today (10 × 26 ÷ 30 = 8.67, rounded up).
assert.equal(neededBy(10, 26, 30), 9);
assert.equal(neededBy(10, 30, 30), 10);
assert.equal(vsTarget(5, 9), 'red');
assert.equal(vsTarget(7, 9), 'amber');
assert.equal(vsTarget(9, 9), 'green');
assert.equal(vsTarget(0, 0), 'grey');

assert.equal(openStatus({ stage: 'Follow Up #2', days: 15 }), 'CALL');
assert.equal(openStatus({ stage: 'Follow Up #1', days: 14 }), 'WATCH');
assert.equal(openStatus({ stage: 'Sent', days: 8 }), 'WATCH');
assert.equal(openStatus({ stage: 'Sent', days: 7 }), 'IN SEQUENCE');
assert.equal(openStatus({ stage: 'Waiting', days: 40 }), 'IN SEQUENCE');

const f = (callsBooked: number, tobsSent: number, signed: number): SalesFunnel => ({
  callsBooked, noShow: null, notFit: null, waitlist: null, callsHeld: null, closedNoToB: 0, paidTobs: 0, tobsSent, signed,
});
assert.equal(closeRate(f(20, 10, 5)), 25);   // booked until outcomes are logged
// Brief v2: close rate = signed ÷ qualified (showed minus not a fit).
const logged: SalesFunnel = { ...f(20, 10, 5), noShow: 4, callsHeld: 16, notFit: 6 };
assert.equal(qualified(logged), 10);
assert.equal(closeRate(logged), 50);
assert.equal(qualified({ ...logged, notFit: null }), null);

// Brief example: ToB sent → signed 22% vs 65% is the biggest break.
const m = {
  cur: f(30, 23, 5), prev: f(30, 20, 13), lostReasons: [],
  open: { total: 3, stale: 1, stages: { sent: 0, waiting: 0, fu1: 0, fu23: 0, over14: 1 }, list: [
    { company: 'Acme', stage: 'Follow Up #3', days: 20, who: 'Les' },
    { company: 'Beta', stage: 'Follow Up #1', days: 10, who: 'Les' },
    { company: 'Gamma', stage: 'Sent', days: 2, who: 'Les' },
  ] },
} as unknown as SalesMonth;
assert.deepEqual(biggestBreak(m), { owner: 'SALES', text: 'ToB sent → signed: 22% vs 65% last month' });
// Show / fit stay blank until logged; job rate is never scored.
assert.deepEqual(funnelRates(m).map(r => r.cur == null), [true, true, false, false, true]);
// A bigger Marketing drop wins and is owned by Marketing.
const mk = { ...m, cur: { ...logged, callsBooked: 30, callsHeld: 10, noShow: 20 }, prev: { ...logged, callsBooked: 30, callsHeld: 27, noShow: 3 } } as SalesMonth;
assert.equal(biggestBreak(mk)!.owner, 'MARKETING');

const acts = salesActions(m, 10, 26, 30);
assert.deepEqual(acts.map(a => a.level), ['CALL NOW', 'THIS WEEK', 'PUSH', 'SET UP', 'SET UP']);
assert.equal(acts[2].detail, 'Need 5 signings in 4 days to hit 10');
assert.equal(acts[3].title, 'Call outcomes and lost reasons not logged');
assert.equal(acts[3].detail, 'Showed, qualified, why-not-signed, job loaded are blank until Airtable and JobAdder capture them');

console.log('sales rules OK');
