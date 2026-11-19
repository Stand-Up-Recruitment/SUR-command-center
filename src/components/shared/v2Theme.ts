// v2 tab colours and styles (Recruitment and Marketing v2 mockups, Claude Design, Nov 2026).
import type { CSSProperties } from 'react';
import type { Pace } from '../../lib/workingDays';

export const C = {
  card: '#1A1B1E', inset: '#222327', border: '#2E3036', rowBorder: '#26282D', track: '#2A2C31',
  text: '#F2F2F3', soft: '#C9CBD1', muted: '#A1A3AA', faint: '#8A8D95', ink: '#141414',
  green: '#4FCB7C', amber: '#F2A93B', red: '#F0504A', blue: '#8DBBF7', greyFill: '#3A3C42',
};
export const PACE_COLOR: Record<Pace, string> = { green: C.green, amber: C.amber, red: C.red, grey: C.faint };
// Filled status chips: [background, text]
export const FILL: Record<Pace | 'blue', [string, string]> = {
  green: ['#3FBF6E', C.ink], amber: [C.amber, C.ink], red: [C.red, C.ink], blue: [C.blue, C.ink], grey: [C.greyFill, '#E6E7EA'],
};

export const NUM_FONT = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
export const CARD: CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14 };
export const LABEL: CSSProperties = { fontSize: 13, fontWeight: 600, color: C.muted, letterSpacing: '0.4px' };
export const TODO: CSSProperties = { fontSize: 13, fontWeight: 600, color: C.text, background: C.inset, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 11px' };
