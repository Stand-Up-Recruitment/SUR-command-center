// Marketing-tab colour rule, shared by every card and by the diagnosis tile.
// green = same or better than the comparison; amber = up to 20% worse;
// red = more than 20% worse. "Worse" follows the direction of the number.
export type Rag = 'green' | 'amber' | 'red' | 'grey';
export type Better = 'up' | 'down';

export interface RagContext { isCurrent: boolean; dayOfMonth: number }

/** Colours stay grey for days 1–7 of the current month. */
export function isTooEarly(ctx: RagContext) {
  return ctx.isCurrent && ctx.dayOfMonth <= 7;
}

export function pctChange(cur: number, prev: number): number | null {
  return prev > 0 ? ((cur - prev) / prev) * 100 : null;
}

export function rate(cur: number | null, prev: number | null, better: Better, ctx: RagContext): Rag {
  if (cur == null || prev == null || isTooEarly(ctx)) return 'grey';
  const pct = pctChange(cur, prev);
  if (pct == null) return 'grey';
  const worsePct = better === 'up' ? -pct : pct;
  if (worsePct <= 0) return 'green';
  return worsePct <= 20 ? 'amber' : 'red';
}
