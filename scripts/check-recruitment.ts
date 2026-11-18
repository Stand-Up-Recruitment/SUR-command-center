// Self-check for the Recruitment v2 rules. Run: node scripts/check-recruitment.ts
import assert from 'node:assert/strict';
import { workingDays, neededByToday, pace } from '../src/lib/workingDays.ts';
import { biggestBreak, todaysActions, shouldWeHire, type BoardRow } from '../src/lib/recruitment.ts';

// Brief example: 19 Nov 2026 (Thu, NZ) is working day 14 of 21; 14 placements → need 9 by today.
const nov19 = Date.parse('2026-11-19T09:00:00+13:00');
assert.deepEqual(workingDays('month', nov19), { elapsed: 14, total: 21 });
assert.equal(neededByToday(14, workingDays('month', nov19)), 9);
assert.equal(neededByToday(480, workingDays('month', nov19)), 320);
assert.deepEqual(workingDays('week', nov19), { elapsed: 4, total: 5 });
// Labour Day (26 Oct 2026) is a holiday: October has 21 working days.
assert.equal(workingDays('month', Date.parse('2026-10-31T12:00:00+13:00')).total, 21);

assert.equal(pace(9, 9), 'green');
assert.equal(pace(7, 9), 'amber');
assert.equal(pace(4, 9), 'red');
assert.equal(pace(0, 9), 'red');
assert.equal(pace(0, 0), 'grey');     // nothing needed yet: never green for zero
assert.equal(pace(null, 9), 'grey');

const team = { intToClient: 0.3, clientToContract: 0.4, monthsOfData: 4 };
const row = (name: string, o: Partial<BoardRow>): BoardRow => ({
  name, kind: 'placer', jobs: 5,
  internal: { done: 50, needed: 50 }, client: { done: 10, needed: 10 }, placements: { done: 3, needed: 3 },
  rolling: team, ...o,
});
assert.equal(biggestBreak(row('Kade', { jobs: 0 }), team)?.stage, 'No jobs');
assert.equal(biggestBreak(row('Ian', { internal: { done: 10, needed: 50 } }), team)?.stage, 'Internal interviews');
assert.equal(biggestBreak(row('Lionel', { rolling: { ...team, clientToContract: 0.1 } }), team)?.stage, 'Closing');
assert.equal(biggestBreak(row('Ayn', { client: { done: 1, needed: 17 } }), team)?.stage, 'Client interviews');
assert.equal(biggestBreak(row('Ok', {}), team), null);
assert.equal(biggestBreak(row('Bad', { rolling: { ...team, intToClient: 3 } }), team), null); // 300% ignored

const actions = todaysActions({
  rows: [
    row('Ayn', { jobs: 8 }),
    row('Kade', { jobs: 0, placements: { done: 0, needed: 1 } }), // FIX NOW only, no extra 1:1
    row('Ian', { placements: { done: 1, needed: 3 }, internal: { done: 10, needed: 50 } }),
    row('Amir', { internal: { done: 5, needed: 50 } }),
    row('Ty', { kind: 'sourcer', jobs: 0 }),
  ],
  team, cap: 7, jobs: { stale: 45, open: 66 }, showUpPct: 80, bot: { dials: 14, expected: 1000, prev: 1651 }, period: 'month',
});
assert.deepEqual(actions.map(a => `${a.level} ${a.who}`), [
  'FIX NOW Bot', 'FIX NOW Manager', 'THIS WEEK All Placers', '1:1 Ian', 'WATCH Amir',
]);
assert.equal(actions[1].detail, 'Kade has 0 jobs. Ayn 8 against a cap of 7.');

const desk = (jobs: number) => ({ jobs, people: 5, empty: 0 });
assert.equal(shouldWeHire(desk(33), { stale: 10, open: 50 }, 1).hire, true);
assert.equal(shouldWeHire(desk(59), { stale: 45, open: 66 }, 1).hire, false);
assert.equal(shouldWeHire(desk(33), { stale: 10, open: 50 }, null).hire, false); // missing data never says HIRE

console.log('recruitment v2 checks passed');
