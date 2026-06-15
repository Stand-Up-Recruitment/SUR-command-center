import type { CSSProperties } from 'react';

export const COLORS = {
  bgPage:        '#f1f5f9',
  bgCard:        '#ffffff',
  bgSubtle:      '#f8fafc',
  border:        '#e2e8f0',
  borderSubtle:  '#f1f5f9',
  textPrimary:   '#0f172a',
  textSecondary: '#64748b',
  textMuted:     '#94a3b8',
  accent:        '#059669',
  accentBg:      '#f0fdf4',
  accentBorder:  '#bbf7d0',
  success:       '#16a34a',
  successBg:     '#dcfce7',
  warning:       '#d97706',
  warningBg:     '#fef3c7',
  danger:        '#dc2626',
  dangerBg:      '#fee2e2',
} as const;

export const CARD_STYLE: CSSProperties = {
  background:   COLORS.bgCard,
  border:       `1px solid ${COLORS.border}`,
  borderRadius: 12,
  boxShadow:    '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
};
