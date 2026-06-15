import { COLORS, CARD_STYLE } from '../../styles/tokens';

interface PlaceholderCardProps {
  department: string;
  description?: string;
}

export function PlaceholderCard({
  department,
  description = 'Data integration coming soon.',
}: PlaceholderCardProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>
            {department}
          </h2>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>
            Coming soon
          </p>
        </div>
        <span
          style={{
            background: COLORS.bgSubtle,
            border: `1px dashed ${COLORS.border}`,
            color: COLORS.textMuted,
            fontSize: 12, fontWeight: 600,
            padding: '5px 12px', borderRadius: 20,
          }}
        >
          Coming Soon
        </span>
      </div>

      {/* Placeholder card */}
      <div style={{ ...CARD_STYLE, padding: 24, opacity: 0.6 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[80, 60, 70].map((w, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ background: COLORS.border, borderRadius: 4, height: 12, width: `${w}%` }} />
              <div style={{ background: COLORS.borderSubtle, borderRadius: 4, height: 8, width: '40%' }} />
            </div>
          ))}
        </div>
        <p style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 16 }}>
          {description}
        </p>
      </div>
    </div>
  );
}
