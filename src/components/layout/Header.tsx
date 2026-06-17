import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { COLORS } from '../../styles/tokens';
import logoUrl from '../../assets/logo.svg';

const TABS = [
  { label: 'Overview',    to: '/',            end: true  },
  { label: 'Marketing',   to: '/marketing'              },
  { label: 'Sales',       to: '/sales'                  },
  { label: 'Recruitment', to: '/recruitment'            },
  { label: 'Revenue',     to: '/revenue'                },
  { label: 'Finance',     to: '/finance'                    },
  { label: 'Retention',   to: '/retention'                  },
] as const;

interface HeaderProps {
  onRefresh: () => void;
  isDemo: boolean;
}

export function Header({ onRefresh, isDemo }: HeaderProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const timeStr = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <header
      style={{
        background:    COLORS.bgCard,
        borderBottom:  `1px solid ${COLORS.border}`,
        boxShadow:     '0 1px 3px rgba(0,0,0,0.06)',
        height:        56,
        display:       'flex',
        alignItems:    'stretch',
        padding:       '0 28px',
        position:      'sticky',
        top:           0,
        zIndex:        10,
        flexShrink:    0,
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', marginRight: 32 }}>
        <img
          src={logoUrl}
          alt="Stand Up Recruitment"
          style={{ height: 28, width: 'auto', filter: 'brightness(0) invert(1)' }}
        />
      </div>

      {/* Tabs */}
      <nav style={{ display: 'flex', alignItems: 'stretch', flex: 1, gap: 2 }}>
        {TABS.map((tab) =>
          'comingSoon' in tab && tab.comingSoon ? (
            <span
              key={tab.to}
              style={{
                display: 'flex', alignItems: 'center',
                padding: '0 16px',
                fontSize: 13, fontWeight: 500,
                color: COLORS.textMuted,
                whiteSpace: 'nowrap',
                borderBottom: '2px solid transparent',
              }}
            >
              {tab.label}
            </span>
          ) : (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={'end' in tab ? tab.end : undefined}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center',
                padding: '0 16px',
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? COLORS.accent : COLORS.textSecondary,
                borderBottom: `2px solid ${isActive ? COLORS.accent : 'transparent'}`,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s',
              })}
            >
              {tab.label}
            </NavLink>
          )
        )}
      </nav>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
        {isDemo && (
          <span
            style={{
              background: COLORS.warningBg,
              border: '1px solid #fcd34d',
              color: COLORS.warning,
              fontSize: 11, fontWeight: 600,
              padding: '4px 10px', borderRadius: 20,
            }}
          >
            Demo Mode
          </span>
        )}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, lineHeight: 1 }}>
            {timeStr}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
            {dateStr}
          </div>
        </div>
        <button
          onClick={onRefresh}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: COLORS.accentBg,
            border: `1px solid ${COLORS.accentBorder}`,
            color: COLORS.accent,
            fontSize: 12, fontWeight: 600,
            padding: '6px 12px', borderRadius: 7,
            cursor: 'pointer',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Refresh
        </button>
      </div>
    </header>
  );
}
