import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { COLORS, CARD_STYLE } from '../../styles/tokens';

// Fixed categorical order, validated for the dark card surface (dataviz validate_palette).
const SERIES_COLORS = ['#378ADD', '#BA7517', '#1D9E75', '#9B6FE0'];

interface Props {
  months: string[];                                                   // oldest-first; last is the current (partial) month
  recruiters: { name: string; monthlyPlacements: (number | null)[] }[];
  teamTarget: number;                                                 // monthly
  breakeven: number;                                                  // monthly, team
}

// Monthly placements, last 12 months — one line per recruiter plus the team total.
// Months before a recruiter's first activity are null, so their line starts later.
export function PlacementsTrendChart({ months, recruiters, teamTarget, breakeven }: Props) {
  const data = months.map((month, i) => {
    const row: Record<string, string | number | null> = { month };
    let team: number | null = null;
    for (const r of recruiters) {
      const v = r.monthlyPlacements[i] ?? null;
      row[r.name] = v;
      if (v !== null) team = (team ?? 0) + v;
    }
    row.Team = team;
    return row;
  });
  const lastIndex = months.length - 1;

  const dot = (color: string) => (props: { cx?: number; cy?: number; index?: number; value?: number | null }) => {
    const { cx, cy, index, value } = props;
    if (value === null || value === undefined || cx === undefined || cy === undefined) return <g key={`dot-${index}`} />;
    // Current month is month-to-date — hollow marker, same convention as the Finance trend chart.
    return (
      <circle key={`dot-${index}`} cx={cx} cy={cy} r={4}
        fill={index === lastIndex ? COLORS.bgCard : color} stroke={color} strokeWidth={2} />
    );
  };

  return (
    <div style={{ ...CARD_STYLE, padding: 18 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Placements · last 12 months
        </div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
          Contracts signed per month, excluding fall-throughs · current month to date (hollow) · blank before a recruiter started
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.textSecondary }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.textSecondary }} axisLine={false} tickLine={false}
            domain={[0, (max: number) => Math.ceil(Math.max(max, teamTarget) + 1)]} />
          <ReferenceLine y={teamTarget} stroke={COLORS.success} strokeDasharray="4 4"
            label={{ value: `Team target ${teamTarget}`, position: 'insideTopLeft', fill: COLORS.textSecondary, fontSize: 11 }} />
          <ReferenceLine y={breakeven} stroke={COLORS.warning} strokeDasharray="4 4"
            label={{ value: `Breakeven ${breakeven.toFixed(1)}`, position: 'insideBottomLeft', fill: COLORS.textSecondary, fontSize: 11 }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.bgCard }}
            labelStyle={{ color: COLORS.textPrimary }}
            itemStyle={{ color: COLORS.textPrimary }}
            formatter={(value, name) => [value === null ? '—' : String(value), String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: COLORS.textSecondary }} />
          {recruiters.map((r, i) => {
            const color = SERIES_COLORS[i % SERIES_COLORS.length];
            return (
              <Line key={r.name} dataKey={r.name} stroke={color} strokeWidth={2}
                connectNulls={false} dot={dot(color)} isAnimationActive={false} />
            );
          })}
          <Line dataKey="Team" stroke={COLORS.textPrimary} strokeWidth={3}
            connectNulls={false} dot={dot(COLORS.textPrimary)} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
