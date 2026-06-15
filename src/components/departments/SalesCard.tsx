import { useCallback } from 'react';
import { KPIMetric } from '../shared/KPIMetric';
import { MiniSparkline } from '../shared/MiniSparkline';
import { StatusBadge } from '../shared/StatusBadge';
import { useAirtable } from '../../hooks/useAirtable';
import { fetchSalesKPIs, MOCK_SALES } from '../../services/airtable';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import type { DepartmentStatus } from '../../types';

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

export function SalesCard() {
  const fetcher = useCallback(() => fetchSalesKPIs(), []);
  const { data, loading, error } = useAirtable(fetcher, MOCK_SALES);

  const status: DepartmentStatus = !data
    ? 'no-data'
    : data.revenueThisMonth >= data.target
    ? 'on-track'
    : data.revenueThisMonth >= data.target * 0.8
    ? 'at-risk'
    : 'off-track';

  const progressPct = data
    ? Math.min(Math.round((data.revenueThisMonth / (data.target || 1)) * 100), 100)
    : 0;

  const sparkData = (data?.trend ?? []).map((t) => ({ label: t.month, value: t.revenue }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>
            Sales
          </h2>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>
            {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} · Updates every 60s
          </p>
        </div>
        <StatusBadge status={error ? 'no-data' : status} />
      </div>

      {loading && !data ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div
            style={{ width: 24, height: 24, border: `2px solid ${COLORS.accent}`, borderTopColor: 'transparent', borderRadius: '50%' }}
            className="animate-spin"
          />
        </div>
      ) : (
        <>
          {/* HERO CARD: Revenue this month */}
          <div style={{ ...CARD_STYLE, padding: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Revenue This Month
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 20 }}>
              <span style={{ fontSize: 44, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-2px', lineHeight: 1 }}>
                {fmt(data?.revenueThisMonth ?? 0)}
              </span>
            </div>

            {/* Stat grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
              <KPIMetric
                label="Monthly Target"
                value={fmt(data?.target ?? 0)}
                valueColor={COLORS.textSecondary}
              />
              <KPIMetric
                label="Pipeline Value"
                value={fmt(data?.pipelineValue ?? 0)}
                valueColor={COLORS.textPrimary}
              />
              <KPIMetric
                label="Active Deals"
                value={data?.activeDeals ?? 0}
                valueColor={COLORS.textPrimary}
              />
              <KPIMetric
                label="Win Rate"
                value={`${data?.winRate ?? 0}%`}
                valueColor={data?.winRate && data.winRate >= 60 ? COLORS.accent : COLORS.warning}
              />
            </div>

            {/* Progress bar toward target */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Target Progress
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: progressPct >= 100 ? COLORS.accent : COLORS.textSecondary }}>
                  {progressPct}%
                </span>
              </div>
              <div style={{ background: COLORS.border, borderRadius: 3, height: 5, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${progressPct}%`,
                    background: progressPct >= 80 ? COLORS.accent : COLORS.warning,
                    height: '100%',
                    borderRadius: 3,
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
            </div>
          </div>

          {/* SPARKLINE CARD */}
          {sparkData.length > 0 && (
            <div style={{ ...CARD_STYLE, padding: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                6-Month Revenue Trend
              </div>
              <MiniSparkline data={sparkData} color={COLORS.accent} valuePrefix="$" />
            </div>
          )}
        </>
      )}

      {error && (
        <p style={{ color: COLORS.warning, fontSize: 12, margin: 0 }}>
          ⚠ Using demo data — {error}
        </p>
      )}
    </div>
  );
}
