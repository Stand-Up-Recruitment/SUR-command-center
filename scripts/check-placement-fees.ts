// Self-check for Xero-based placement fees. Run: node scripts/check-placement-fees.ts
import assert from 'node:assert/strict';
import { actualFeeAud, type FeeLine } from '../src/lib/placementFees.ts';

const line = (candidate: string, feeNo: number, amount: number, kept: number, contact = 'Tropical Homes'): FeeLine =>
  ({ candidate, contact, feeNo, amount, kept, date: '2026-08-03' });
const p = (candidate: string, status: string, agreedFee = 16000, company = 'Tropical Homes') => ({ candidate, company, status, agreedFee });

// Six duplicate Fee #1 invoices credited in full, one paid, Fee #2 credited: only 8,000 kept (Live).
const alaivaa = [...Array(6)].map(() => line('Alaivaa Alaivaa', 1, 8000, 0))
  .concat(line('Alaivaa Alaivaa', 1, 8000, 8000), line('Alaivaa Alaivaa', 2, 8000, 0));
assert.equal(actualFeeAud(p('Alaivaa Alaivaa', 'Live'), alaivaa), 8000);

// Live with only Fee #1 invoiced so far (even with credited duplicates): Fee #2 still to come.
const astin = [line('Astin Caldwell', 1, 8000, 0, 'Hunter Consolidated'), line('Astin Caldwell', 1, 8000, 8000, 'Hunter Consolidated')];
assert.equal(actualFeeAud(p('Astin Caldwell', 'Live', 16000, 'Hunter Consolidated Group Pty Ltd'), astin), 16000);

// Drop-off: Fee #2 credited back, nothing added for the rest.
const clinton = [line('Clinton Jordan', 1, 7516.46, 7516.46, 'Elevate Ceilings'), line('Clinton Jordan', 2, 7516.46, 0, 'Elevate Ceilings')];
assert.equal(actualFeeAud(p('Clinton Jordan', 'End', 15032.91, 'Elevate Ceilings and Plastering Co.'), clinton), 7516.46);

// Completed with only Fee #1 ever invoiced: 8,000.
assert.equal(actualFeeAud(p('Oliver Bray', 'Completed'), [line('Oliver Bray', 1, 8000, 8000)]), 8000);

// No Xero line, or a namesake at another client: null, so the agreed fee is used.
assert.equal(actualFeeAud(p('Te Mangu Te Wehi', 'Live'), alaivaa), null);
assert.equal(actualFeeAud(p('Oliver Bray', 'Completed', 16000, 'Other Builders'), [line('Oliver Bray', 1, 8000, 8000)]), null);

console.log('placement fee checks passed');
