import { COLORS } from '../../styles/tokens';

interface WoWBadgeProps {
  current: number;
  prev: number;
  /** true = lower is better (e.g. cost). Inverts the green/red direction. */
  invertDirection?: boolean;
  /** true = amber/neutral colouring regardless of direction (e.g. spend). */
  neutral?: boolean;
}

export function WoWBadge({
  current,
  prev,
  invertDirection = false,
  neutral = false,
}: WoWBadgeProps) {
  if (prev === 0) return null;
  const pct = Math.round(((current - prev) / prev) * 100);
  const isUp = pct >= 0;
  const isGood = invertDirection ? !isUp : isUp;

  const bg    = neutral ? COLORS.warningBg : isGood ? COLORS.successBg : COLORS.dangerBg;
  const color = neutral ? COLORS.warning   : isGood ? COLORS.success   : COLORS.danger;

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        fontSize: 11, fontWeight: 700,
        padding: '3px 8px', borderRadius: 20,
        background: bg, color,
        marginLeft: 8,
      }}
    >
      {isUp ? '↑' : '↓'}{Math.abs(pct)}%
    </span>
  );
}
