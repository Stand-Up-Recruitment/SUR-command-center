// v2 tab layout pieces (Recruitment and Marketing v2 mockups).
import type { ReactNode } from 'react';
import type { Pace } from '../../lib/workingDays';
import { C, FILL, NUM_FONT, CARD, LABEL } from './v2Theme';

export const Chip = ({ tone, children, width }: { tone: Pace | 'blue'; children: ReactNode; width?: number }) => (
  <span style={{
    fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', padding: '4px 8px', borderRadius: 5, whiteSpace: 'nowrap',
    background: FILL[tone][0], color: FILL[tone][1], width, textAlign: width ? 'center' : undefined, boxSizing: 'border-box',
    display: 'inline-block', justifySelf: 'start',
  }}>{children}</span>
);

export const Section = ({ title, aside, children }: { title: string; aside: ReactNode; children: ReactNode }) => (
  <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12 }}>
      <h2 style={{ margin: 0, fontFamily: NUM_FONT, fontSize: 22, fontWeight: 700, color: C.text }}>{title}</h2>
      {typeof aside === 'string' ? <span style={{ fontSize: 14, color: C.muted }}>{aside}</span> : aside}
    </div>
    {children}
  </section>
);

export const Tag = ({ bg, children }: { bg: string; children: ReactNode }) => (
  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.8px', color: C.ink, background: bg, padding: '4px 8px', borderRadius: 5 }}>{children}</span>
);

export const Big = ({ value, color, unit, size = 52 }: { value: ReactNode; color: string; unit?: string; size?: number }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
    <span style={{ fontFamily: NUM_FONT, fontSize: size, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
    {unit && <span style={{ fontSize: 16, color: C.soft }}>{unit}</span>}
  </div>
);

export const Tile = ({ label, chip, children }: { label: string; chip: ReactNode; children: ReactNode }) => (
  <div style={{ ...CARD, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={LABEL}>{label}</span>{chip}
    </div>
    {children}
  </div>
);

export const Line = ({ children, muted }: { children: ReactNode; muted?: boolean }) => (
  <div style={{ fontSize: muted ? 13 : 15, color: muted ? C.muted : C.text }}>{children}</div>
);
