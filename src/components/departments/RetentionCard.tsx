import { StatusBadge } from '../shared/StatusBadge';
import { WoWBadge } from '../shared/WoWBadge';
import { Skeleton } from '../shared/Skeleton';
import { useRetentionKPIs } from '../../hooks/queries';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import type { DepartmentStatus } from '../../types';

function RetentionSkeleton() {
  const tile = (i: number) => (
    <div
      key={i}
      style={{
        background: COLORS.bgSubtle,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: '14px 16px',
      }}
    >
      <Skeleton height={10} width={80} style={{ marginBottom: 10 }} />
      <Skeleton height={22} width={60} style={{ marginBottom: 8 }} />
      <Skeleton height={10} width={50} />
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton height={22} width={120} />
          <Skeleton height={13} width={160} />
        </div>
        <Skeleton height={28} width={80} radius={8} />
      </div>
      <div style={{ ...CARD_STYLE, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton height={11} width={140} />
        <Skeleton height={44} width={80} radius={4} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[0, 1, 2, 3].map(tile)}
        </div>
      </div>
    </div>
  );
}

export function RetentionCard() {
  const { data, error } = useRetentionKPIs();

  if (!data) return <RetentionSkeleton />;

  const status: DepartmentStatus =
    data.replacementRate < 5  ? 'on-track' :
    data.replacementRate < 10 ? 'at-risk'  : 'off-track';

  const statTile = (
    label: string,
    value: string | number,
    wowCurrent: number,
    wowPrev: number,
    invertDirection = false,
  ) => (
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
          fontSize: 10,
          fontWeight: 600,
          color: COLORS.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>{value}</div>
      <WoWBadge current={wowCurrent} prev={wowPrev} invertDirection={invertDirection} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: COLORS.textPrimary,
              letterSpacing: '-0.5px',
              margin: 0,
            }}
          >
            Retention
          </h2>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>
            Current state · Updates daily
          </p>
        </div>
        <StatusBadge status={error ? 'no-data' : status} />
      </div>

      <div style={{ ...CARD_STYLE, padding: 24 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: COLORS.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            marginBottom: 10,
          }}
        >
          Replacement Rate
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 20 }}>
          <span
            style={{
              fontSize: 44,
              fontWeight: 900,
              color: COLORS.textPrimary,
              letterSpacing: '-2px',
              lineHeight: 1,
            }}
          >
            {data.replacementRate}%
          </span>
          <WoWBadge
            current={data.replacementRate}
            prev={data.prevReplacementRate}
            invertDirection
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {statTile(
            'Active in Window',
            data.activeInWindow,
            data.activeInWindow,
            data.prevActiveInWindow,
          )}
          {statTile(
            'Past Guarantee',
            data.pastWindow,
            data.pastWindow,
            data.prevPastWindow,
          )}
          {statTile(
            'Triggered (mo.)',
            data.replacementsThisMonth,
            data.replacementsThisWeek,
            data.replacementsPrevWeek,
            true,
          )}
          {statTile(
            'In Progress',
            data.inProgress,
            data.inProgressThisWeek,
            data.inProgressPrevWeek,
          )}
        </div>
      </div>

      {error && (
        <p style={{ color: COLORS.warning, fontSize: 12, margin: 0 }}>
          ⚠ Connection error — {error?.message}
        </p>
      )}
    </div>
  );
}
