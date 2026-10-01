// Palette, formatters and the card colour rule shared by the month-view tabs (Marketing, Sales).
import { rate, type Rag, type Better, type RagContext } from '../../lib/rag';

// ─── Palette (shared with the Finance tab) ────────────────────────────────────
export const NZ     = '#1D9E75';
export const AM     = '#BA7517';
export const RD     = '#D85A30';
export const GREY   = '#5a5a5a';
export const BG     = '#111111';
export const BG2    = '#1a1a1a';
export const BORDER = 'rgba(255,255,255,0.10)';
export const TEXT   = '#f5f5f5';
export const MUTED  = '#a3a3a3';

export const RAG_COLOR: Record<Rag, string> = { green: NZ, amber: AM, red: RD, grey: GREY };

// ─── Formatters ───────────────────────────────────────────────────────────────
export const money0 = (n: number) => `$${Math.round(n).toLocaleString('en-NZ')}`;
export const money2 = (n: number) => `$${n.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const int = (n: number) => Math.round(n).toLocaleString('en-NZ');
export const kShort = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`);
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', timeZone: 'Pacific/Auckland' });

// ─── Comparison cards ─────────────────────────────────────────────────────────
export interface Cmp { label: string; cur: number; prev: number; better: Better; fmt: (n: number) => string; neutral?: boolean; prevWord: string; pts?: boolean }

export function cmpRag(c: Cmp, ctx: RagContext): Rag {
  return c.neutral ? 'grey' : rate(c.cur, c.prev, c.better, ctx);
}
