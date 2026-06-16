import type { DepartmentStatus } from '../../types';
import { COLORS } from '../../styles/tokens';

const STATUS_CONFIG: Record<
  DepartmentStatus,
  { label: string; bg: string; border: string; text: string; dot: string }
> = {
  'on-track': {
    label: 'On Track',
    bg:     COLORS.accentBg,
    border: COLORS.accentBorder,
    text:   COLORS.success,
    dot:    COLORS.success,
  },
  'at-risk': {
    label: 'At Risk',
    bg:     COLORS.warningBg,
    border: COLORS.warning,
    text:   COLORS.warning,
    dot:    COLORS.warning,
  },
  'off-track': {
    label: 'Off Track',
    bg:     COLORS.dangerBg,
    border: COLORS.danger,
    text:   COLORS.danger,
    dot:    COLORS.danger,
  },
  'no-data': {
    label: 'No Data',
    bg:     COLORS.bgSubtle,
    border: COLORS.border,
    text:   COLORS.textMuted,
    dot:    COLORS.textMuted,
  },
};

interface StatusBadgeProps {
  status: DepartmentStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.text,
        fontSize: 12, fontWeight: 600,
        padding: '5px 12px', borderRadius: 20,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6, height: 6,
          background: cfg.dot,
          borderRadius: '50%',
          display: 'inline-block',
        }}
      />
      {cfg.label}
    </span>
  );
}
