import { COLORS } from '../../styles/tokens';
import type { RecruiterStat } from '../../types';

interface RecruiterTableProps {
  recruiters: RecruiterStat[];
}

function FillBar({ pct }: { pct: number }) {
  const color = pct >= 70 ? COLORS.accent : pct >= 50 ? COLORS.warning : COLORS.danger;
  return (
    <div style={{ background: COLORS.border, borderRadius: 3, height: 5, width: '100%', overflow: 'hidden' }}>
      <div
        style={{ width: `${Math.min(pct, 100)}%`, background: color, height: '100%', borderRadius: 3, transition: 'width 0.5s' }}
      />
    </div>
  );
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

const AVATAR_COLORS = [COLORS.accent, '#3b82f6', COLORS.warning, '#8b5cf6'];

export function RecruiterTable({ recruiters }: RecruiterTableProps) {
  if (recruiters.length === 0) {
    return (
      <p style={{ color: COLORS.textMuted, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
        No recruiter data this month.
      </p>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Table header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto auto auto',
          gap: '0 12px',
          fontSize: 10, fontWeight: 700, color: COLORS.textMuted,
          textTransform: 'uppercase', letterSpacing: '0.07em',
          padding: '10px 0',
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.bgSubtle,
        }}
      >
        <span style={{ paddingLeft: 14 }}>Recruiter</span>
        <span style={{ textAlign: 'right', width: 48, paddingRight: 14 }}>Jobs</span>
        <span style={{ textAlign: 'right', width: 56, paddingRight: 14 }}>Placed</span>
        <span style={{ textAlign: 'right', width: 72, paddingRight: 14 }}>Fill Rate</span>
        <span style={{ textAlign: 'right', width: 64, paddingRight: 14 }}>Avg Days</span>
      </div>

      {/* Rows */}
      {recruiters.map((r, i) => (
        <div
          key={r.name}
          style={{
            borderBottom: i < recruiters.length - 1 ? `1px solid ${COLORS.borderSubtle}` : 'none',
            padding: '10px 0',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '0 12px', alignItems: 'center' }}>
            {/* Name + avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 14 }}>
              <div
                style={{
                  width: 28, height: 28,
                  borderRadius: '50%',
                  background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: 'white',
                  flexShrink: 0,
                }}
              >
                {initials(r.name)}
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.textPrimary }}>
                {r.name.split(' ')[0]}
              </span>
            </div>
            <span style={{ fontSize: 13, color: COLORS.textPrimary, textAlign: 'right', width: 48, paddingRight: 14 }}>{r.activeJobs}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.accent, textAlign: 'right', width: 56, paddingRight: 14 }}>{r.placements}</span>
            <span
              style={{
                fontSize: 13, fontWeight: 600, textAlign: 'right', width: 72, paddingRight: 14,
                color: r.fillRate >= 70 ? COLORS.accent : r.fillRate >= 50 ? COLORS.warning : COLORS.danger,
              }}
            >
              {r.fillRate}%
            </span>
            <span style={{ fontSize: 13, color: COLORS.textMuted, textAlign: 'right', width: 64, paddingRight: 14 }}>{r.avgDaysToFill}d</span>
          </div>
          {/* Fill bar */}
          <div style={{ paddingLeft: 52, paddingRight: 14, paddingTop: 6 }}>
            <FillBar pct={r.fillRate} />
          </div>
        </div>
      ))}
    </div>
  );
}
