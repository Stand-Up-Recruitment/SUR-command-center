// Placement fees actually charged, from Xero's AUD "Placement Fee" invoice lines (n8n Finance webhook).
// Amounts are AUD. kept = line amount minus its share of the invoice's credits, so duplicate
// invoices credited in full and drop-off fees credited back count as 0.

export interface FeeLine { candidate: string; contact: string; feeNo: number | null; amount: number; kept: number; date: string }

const norm = (s: string | undefined) =>
  (s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Fee charged for one placement (AUD), or null when Xero has no line for it (use the agreed fee).
 * Matched on candidate name + the first 10 characters of the client name.
 * Live / Pending placements add the part of the agreed fee not invoiced yet; a fee number counts
 * as invoiced once any line for it exists, even if credited.
 */
export function actualFeeAud(
  p: { candidate: string; company: string; status: string; agreedFee: number },
  lines: FeeLine[],
): number | null {
  const name = norm(p.candidate), co = norm(p.company).slice(0, 10);
  if (!name) return null;
  const mine = lines.filter(l => norm(l.candidate) === name && norm(l.contact).slice(0, 10) === co);
  if (!mine.length) return null;
  const kept = mine.reduce((s, l) => s + l.kept, 0);
  if (!['Live', 'Pending'].includes(p.status)) return kept;
  // Each instalment once, at its largest line: duplicates of "Fee #1" don't count twice.
  const invoiced = new Map<string, number>();
  mine.forEach((l, i) => {
    const key = l.feeNo != null ? String(l.feeNo) : `line${i}`;
    invoiced.set(key, Math.max(invoiced.get(key) ?? 0, l.amount));
  });
  const notYetInvoiced = Math.max(0, p.agreedFee - [...invoiced.values()].reduce((s, a) => s + a, 0));
  return kept + notYetInvoiced;
}
