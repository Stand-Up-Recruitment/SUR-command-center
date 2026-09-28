import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { COLORS, CARD_STYLE } from '../../styles/tokens';

// Fixed categorical order, validated for the dark card surface (dataviz validate_palette).
const SERIES_COLORS = ['#378ADD', '#BA7517', '#1D9E75', '#9B6FE0'];

interface Props {
  months: string[];                                                   // oldest-first; last is the current (partial) month
  recruiters: { name: string; monthlyPlacements: (number | null)[]; target: number }[];  // target: monthly
  breakevenPerRecruiter: number;                                      // monthly
}

const ALL = 'All';

// Monthly placements, last 12 months — one line per recruiter plus the team total.
// Months before a recruiter's first activity are null, so their line starts later.
// Filter buttons show one recruiter against their own target and breakeven.
export function PlacementsTrendChart({ months, recruiters, breakevenPerRecruiter }: Props) {
  const [selected, setSelected] = useState(ALL);
  const focus = recruiters.find(r => r.name === selected);
  const target = focus ? focus.target : recruiters.reduce((s, r) => s + r.target, 0);
  const breakeven = focus ? breakevenPerRecruiter : breakevenPerRecruiter * recruiters.length;
  const refLabel = (what: string, n: string) => focus ? `${what} ${n}` : `Team ${what.toLowerCase()} ${n}`;

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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Placements · last 12 months
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
            Contracts signed per month, excluding fall-throughs · current month to date (hollow) · blank before a recruiter started
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[ALL, ...recruiters.map(r => r.name)].map(name => (
            <button
              key={name}
              type="button"
              onClick={() => setSelected(name)}
              aria-pressed={selected === name}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 6,
                border: `1px solid ${COLORS.border}`,
                background: selected === name ? COLORS.accent : 'transparent',
                color: selected === name ? COLORS.textPrimary : COLORS.textSecondary,
                cursor: 'pointer',
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.textSecondary }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.textSecondary }} axisLine={false} tickLine={false}
            domain={[0, (max: number) => Math.ceil(Math.max(max, target) + 1)]} />
          <ReferenceLine y={target} stroke={COLORS.success} strokeDasharray="4 4"
            label={{ value: refLabel('Target', String(target)), position: 'insideTopLeft', fill: COLORS.textSecondary, fontSize: 11 }} />
          <ReferenceLine y={breakeven} stroke={COLORS.warning} strokeDasharray="4 4"
            label={{ value: refLabel('Breakeven', breakeven.toFixed(1)), position: 'insideBottomLeft', fill: COLORS.textSecondary, fontSize: 11 }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.bgCard }}
            labelStyle={{ color: COLORS.textPrimary }}
            itemStyle={{ color: COLORS.textPrimary }}
            formatter={(value, name) => [value === null ? '—' : String(value), String(name)]}
          />
          {!focus && <Legend wrapperStyle={{ fontSize: 12, color: COLORS.textSecondary }} />}
          {recruiters.map((r, i) => {
            // Colour comes from the recruiter's place in the full list, so it doesn't change when filtered.
            const color = SERIES_COLORS[i % SERIES_COLORS.length];
            if (focus && focus.name !== r.name) return null;
            return (
              <Line key={r.name} dataKey={r.name} stroke={color} strokeWidth={2}
                connectNulls={false} dot={dot(color)} isAnimationActive={false} />
            );
          })}
          {!focus && (
            <Line dataKey="Team" stroke={COLORS.textPrimary} strokeWidth={3}
              connectNulls={false} dot={dot(COLORS.textPrimary)} isAnimationActive={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
