// Diagnosis banner, same look as the Marketing and Sales tabs' tile.
import { BG, BG2, BORDER, TEXT, RAG_COLOR } from './monthTheme';
import type { Diagnosis } from '../../lib/diagnosis';

export function DiagnosisTile({ diagnosis }: { diagnosis: Diagnosis }) {
  const tone = RAG_COLOR[diagnosis.tone];
  return (
    <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderLeft: `3px solid ${tone}`, borderRadius: 10, padding: '.875rem 1rem', display: 'flex', alignItems: 'center', gap: 14, marginBottom: '.875rem' }}>
      <span style={{ background: tone, color: diagnosis.tone === 'grey' ? TEXT : BG, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>{diagnosis.badge}</span>
      <span style={{ fontSize: 13, color: TEXT }}>{diagnosis.text}</span>
    </div>
  );
}
