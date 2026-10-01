// Layout pieces shared by the month-view tabs (Marketing, Sales).
import type { ReactNode } from 'react';
import { pctChange, type Rag, type RagContext } from '../../lib/rag';
import { BG, BG2, BORDER, TEXT, MUTED, RAG_COLOR, cmpRag, type Cmp } from './monthTheme';

// ─── Layout helpers ───────────────────────────────────────────────────────────
export function Section({ n, title, sub, children }: { n: number; title: string; sub?: string; children: ReactNode }) {
  return (
    <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, padding: '1.25rem', marginBottom: '.875rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '.875rem' }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#2a2a2a', color: MUTED, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</div>
        <span style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>{title}</span>
        <div style={{ flex: 1 }} />
        {sub && <span style={{ fontSize: 11, color: MUTED, textAlign: 'right' }}>{sub}</span>}
      </div>
      {children}
    </div>
  );
}

export function SubHead({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, margin: '.75rem 0 .5rem' }}>{children}</div>;
}

export function Grid({ cols, children }: { cols: number | string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: typeof cols === 'number' ? `repeat(${cols}, minmax(0,1fr))` : cols, gap: 10, marginBottom: 10 }}>
      {children}
    </div>
  );
}

export function Metric({ label, value, rag, children, muted }: { label: string; value?: string; rag: Rag; children?: ReactNode; muted?: boolean }) {
  return (
    <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderLeft: `3px solid ${RAG_COLOR[rag]}`, borderRadius: 8, padding: '.875rem 1rem', minHeight: 78 }}>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>{label}</div>
      {value != null && <div style={{ fontSize: 24, fontWeight: 600, color: muted ? MUTED : TEXT, lineHeight: 1.1, marginBottom: 6 }}>{value}</div>}
      <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

/** "Aug $5,522 ▼ 14.5%" — the arrow/percent takes the card's colour (muted when grey). */
export function Delta({ prefix, prevText, cur, prev, rag, pts }: { prefix: string; prevText: string; cur: number; prev: number; rag: Rag; pts?: boolean }) {
  const color = rag === 'grey' ? MUTED : RAG_COLOR[rag];
  if (pts) {
    const d = cur - prev;
    return <>{prefix} {prevText} <span style={{ color }}>{d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)} pts</span></>;
  }
  const pct = pctChange(cur, prev);
  return <>{prefix} {prevText}{pct != null && <span style={{ color }}> {pct >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%</span>}</>;
}

// ─── Comparison card ──────────────────────────────────────────────────────────
export function CmpCard({ c, ctx }: { c: Cmp; ctx: RagContext }) {
  const rag = cmpRag(c, ctx);
  if (c.target) {
    // Target decides the colour; last month stays as a grey reference line.
    const color = rag === 'grey' ? MUTED : RAG_COLOR[rag];
    const proRata = c.target.value !== c.target.full ? ` (pro-rata ${c.fmt(c.target.value)})` : '';
    return (
      <Metric label={c.label} value={c.fmt(c.cur)} rag={rag}>
        Target {c.fmt(c.target.full)}{proRata}{' '}
        <span style={{ color }}>{c.target.value > 0 ? `${Math.round((c.cur / c.target.value) * 100)}% of target` : ''}</span>
        <div><Delta prefix={c.prevWord} prevText={c.fmt(c.prev)} cur={c.cur} prev={c.prev} rag="grey" pts={c.pts} /></div>
      </Metric>
    );
  }
  return (
    <Metric label={c.label} value={c.fmt(c.cur)} rag={rag}>
      <Delta prefix={c.prevWord} prevText={c.fmt(c.prev)} cur={c.cur} prev={c.prev} rag={rag} pts={c.pts} />
    </Metric>
  );
}
