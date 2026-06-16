import type { TimeFrame } from '../../types';
import { COLORS } from '../../styles/tokens';

const OPTIONS: { value: TimeFrame; label: string }[] = [
  { value: '7d',    label: '7D' },
  { value: '14d',   label: '14D' },
  { value: '30d',   label: '30D' },
  { value: 'month', label: 'MTD' },
];

export function TimeFramePicker({
  value,
  onChange,
}: {
  value: TimeFrame;
  onChange: (f: TimeFrame) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 2, background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 3 }}>
      {OPTIONS.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            background: value === o.value ? COLORS.accent : 'transparent',
            color: value === o.value ? '#fff' : COLORS.textMuted,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
