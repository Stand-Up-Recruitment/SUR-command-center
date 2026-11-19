// Self-check for the Marketing tab rules (ad set spike rule, trade/location matching, demand signals).
// Run: npm run check:marketing   (Node 23.6+ runs the .ts sources directly)
import { register } from 'node:module';
import assert from 'node:assert';

// Source imports use .js extensions for the Vercel build; map them to the .ts files here.
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) { if (spec.endsWith('.js')) return next(spec.slice(0, -3) + '.ts', ctx); throw e; }
}`));

const root = new URL('../', import.meta.url).pathname;
const { adSetChecks } = await import(root + 'src/components/departments/marketingMetrics.ts');
const { tradeOf, regionsOf, buildDemand } = await import(root + 'src/lib/demand.ts');
const day = (d, adsetId, adset, spend, results, group = 'client') => ({ adsetId, adset, campaign: 'x', group, date: d, spend, results });
const rows = [];
for (let i = 3; i <= 16; i++) { const d = `2026-11-${String(20 - i).padStart(2, '0')}`; rows.push(day(d, 'a', 'CLIENT_Carpenter_Brisbane', 30, 1), day(d, 'b', 'Talking Head - Electricians', 30, 1), day(d, 'c', 'quiet', 5, 0)); }
for (const d of ['2026-11-18', '2026-11-19', '2026-11-20']) rows.push(day(d, 'a', 'CLIENT_Carpenter_Brisbane', 200, 1), day(d, 'b', 'Talking Head - Electricians', 20, 2), day(d, 'c', 'quiet', 5, 0));
const c = Object.fromEntries(adSetChecks(rows, '2026-11-20').map(x => [x.id, x]));
assert.equal(c.a.status, 'SPIKE'); assert.equal(c.a.normal, 30); assert.equal(c.a.cost3, 200); assert.equal(c.a.named, true); assert.equal(c.a.trade, 'Carpenter / Builder');
assert.equal(c.b.status, 'STRONG'); assert.equal(c.b.named, false); assert.equal(c.b.trade, 'Electrician');
assert.equal(c.c.status, 'LOW DATA');
// Editable thresholds: with a 1000% spike line the +567% carpenter set drops to WATCH; minSpend 0 lets the $15 set through.
const strict = Object.fromEntries(adSetChecks(rows, '2026-11-20', { spikePct: 1000, watchPct: 20, minSpend: 20 }).map(x => [x.id, x]));
assert.equal(strict.a.status, 'WATCH'); assert.equal(strict.c.status, 'LOW DATA');
const loose = Object.fromEntries(adSetChecks(rows, '2026-11-20', { spikePct: 50, watchPct: 20, minSpend: 0 }).map(x => [x.id, x]));
assert.equal(loose.c.status, 'NO NORMAL');
assert.equal(tradeOf('Roof Plumber'), 'Roofer'); assert.equal(tradeOf('Livestock Transport Operator'), 'Truck Driver'); assert.equal(tradeOf('HR Intern'), null);
assert.deepEqual(regionsOf('QLD Other'), ['Queensland']); assert.ok(regionsOf('Perth, Regional Australia').length === 8);
const d = buildDemand([{ title: 'Electrician', location: 'Brisbane', createdAt: '2026-10-01' }, { title: 'Electrician', location: 'Perth', createdAt: '2026-11-15' }],
  [{ trade: 'Electrician', locations: 'Brisbane' }, { trade: 'Carpenter / Builder', locations: 'Brisbane' }, { trade: 'Carpenter / Builder', locations: 'Brisbane' }, { trade: 'Carpenter / Builder', locations: 'Gold Coast' }], Date.parse('2026-11-20'));
assert.deepEqual(d.shortages, [{ trade: 'Electrician', openJobs: 2, stale: 1, readyToGo: 1 }]);
assert.deepEqual(d.buildUp, [{ trade: 'Carpenter / Builder', region: 'Queensland', readyToGo: 3, openJobs: 0 }]);
console.log('all checks pass');
