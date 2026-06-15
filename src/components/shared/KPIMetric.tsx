import { COLORS } from '../../styles/tokens';

interface KPIMetricProps {
  label: string;
  value: string | number;
  valueColor?: string;
  trendText?: string;
  trendColor?: string;
}

export function KPIMetric({
  label,
  value,
  valueColor = COLORS.textPrimary,
  trendText,
  trendColor = COLORS.textMuted,
}: KPIMetricProps) {
  return (
    <div
      style={{
        background: COLORS.bgSubtle,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: '14px 16px',
      }}
    >
      <div
        style={{
          fontSize: 10, fontWeight: 600,
          color: COLORS.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: valueColor }}>
        {value}
      </div>
      {trendText && (
        <div style={{ fontSize: 10, fontWeight: 600, color: trendColor, marginTop: 4 }}>
          {trendText}
        </div>
      )}
    </div>
  );
}
