import type { CSSProperties } from 'react';
import { COLORS } from '../../styles/tokens';

export function Skeleton({
  height = 16,
  width = '100%',
  radius = 6,
  style,
}: {
  height?: number | string;
  width?: number | string;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className="animate-pulse"
      style={{
        height,
        width,
        borderRadius: radius,
        background: COLORS.border,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
