import { COLORS } from '../../styles/tokens';
import type { RecruiterStat } from '../../types';

interface RecruiterTableProps {
  recruiters: RecruiterStat[];
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

const AVATAR_COLORS = [COLORS.accent, '#7f1d1d', COLORS.warning, '#6b21a8'];

export function RecruiterTable({ recruiters }: RecruiterTableProps) {
  if (recruiters.length === 0) {
    return (
      <p style={{ color: COLORS.textMuted, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
        No recruiter data this period.
      </p>
    );
  }

  const col = { textAlign: 'right' as const, width: 56, paddingRight: 14 };

  return (
    <div style={{ width: '100%' }}>
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
        <span style={col}>Phone</span>
        <span style={col}>Internal</span>
        <span style={col}>Client</span>
        <span style={col}>Placed</span>
      </div>

      {recruiters.map((r, i) => (
        <div
          key={r.name}
          style={{
            borderBottom: i < recruiters.length - 1 ? `1px solid ${COLORS.borderSubtle}` : 'none',
            padding: '10px 0',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '0 12px', alignItems: 'center' }}>
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
            <span style={{ fontSize: 13, color: COLORS.textPrimary, ...col }}>{r.phoneInterviews}</span>
            <span style={{ fontSize: 13, color: COLORS.textPrimary, ...col }}>{r.internalInterviews}</span>
            <span style={{ fontSize: 13, color: COLORS.textPrimary, ...col }}>{r.clientInterviews}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.accent, ...col }}>{r.placements}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
