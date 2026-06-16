import { Link } from 'react-router-dom';
import { COLORS, CARD_STYLE } from '../styles/tokens';

const departments = [
  { name: 'Marketing',   path: '/marketing',   description: 'Leads, ad spend & channel performance', placeholder: false },
  { name: 'Sales',       path: '/sales',        description: 'Revenue, pipeline & win rate',           placeholder: false },
  { name: 'Recruitment', path: '/recruitment',  description: 'Placements, fill rate & recruiter KPIs', placeholder: false },
  { name: 'Revenue',     path: '/revenue',      description: 'Invoices, collections & payment flow',   placeholder: false },
  { name: 'Finance',     path: '/finance',      description: 'P&L, cash flow & invoices',              placeholder: false },
  { name: 'Retention',   path: '/retention',    description: 'Candidate & client retention',           placeholder: FontFaceSetLoadEvent },
] as const;

export function OverviewPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>
          Command Center
        </h2>
        <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>
          Select a department to view its metrics.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {departments.map((dept) => (
          <Link
            key={dept.path}
            to={dept.path}
            style={{
              ...CARD_STYLE,
              borderTop: `3px solid ${dept.placeholder ? COLORS.border : COLORS.accent}`,
              padding: 20,
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              opacity: dept.placeholder ? 0.6 : 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: dept.placeholder ? COLORS.textMuted : COLORS.accent, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
                {dept.name}
              </p>
              {dept.placeholder && (
                <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, padding: '2px 8px', borderRadius: 12 }}>
                  Coming Soon
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: COLORS.textPrimary, margin: 0 }}>
              {dept.description}
            </p>
            {!dept.placeholder && (
              <p style={{ fontSize: 12, fontWeight: 600, color: COLORS.accent, margin: 0, marginTop: 4 }}>
                View →
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
