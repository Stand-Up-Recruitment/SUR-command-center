import type { CSSProperties } from 'react';

export const COLORS = {
  bgPage:        '#0d0d0d',
  bgCard:        '#1a1a1a',
  bgSubtle:      '#111111',
  border:        '#2d2d2d',
  borderSubtle:  '#1f1f1f',
  textPrimary:   '#f5f5f5',
  textSecondary: '#a3a3a3',
  textMuted:     '#6b6b6b',
  accent:        '#dc2626',
  accentBg:      '#1f0a0a',
  accentBorder:  '#7f1d1d',
  success:       '#22c55e',
  successBg:     '#052e16',
  warning:       '#f59e0b',
  warningBg:     '#451a03',
  danger:        '#dc2626',
  dangerBg:      '#1f0a0a',
} as const;

export const CARD_STYLE: CSSProperties = {
  background:   COLORS.bgCard,
  border:       `1px solid ${COLORS.border}`,
  borderRadius: 12,
  boxShadow:    '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
};
