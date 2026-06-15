import { useCallback } from 'react';
import { KPIMetric } from '../shared/KPIMetric';
import { COLORS } from '../../styles/tokens';
import { MiniSparkline } from '../shared/MiniSparkline';
import { StatusBadge } from '../shared/StatusBadge';
import { useAirtable } from '../../hooks/useAirtable';
import { fetchSalesKPIs, MOCK_SALES } from '../../services/airtable';
import type { DepartmentStatus } from '../../types';

const COLOR = '#3b82f6';

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

  const sparkData = (data?.trend ?? []).map((t) => ({
    label: t.month,
    value: t.revenue,
  }));

  return (
    <div
      style={{
        background: '#1a1d27',
        border: '1px solid #2a2d3e',
        borderTop: `3px solid ${COLOR}`,
      }}
      className="rounded-xl p-5 flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p style={{ color: COLOR }} className="text-xs font-semibold uppercase tracking-widest mb-0.5">
            Sales
          </p>
          <h3 style={{ color: '#e2e8f0' }} className="text-lg font-bold leading-none">
            Revenue &amp; Pipeline
          </h3>
        </div>
        <StatusBadge status={error ? 'no-data' : status} />
      </div>

      {loading && !data ? (
        <div className="flex-1 flex items-center justify-center h-32">
          <div
            style={{ borderColor: COLOR, borderTopColor: 'transparent' }}
            className="w-6 h-6 rounded-full border-2 animate-spin"
          />
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-4">
            <KPIMetric
              label="Revenue"
              value={fmt(data?.revenueThisMonth ?? 0)}
              valueColor={COLOR}
            />
            <KPIMetric
              label="Pipeline"
              value={fmt(data?.pipelineValue ?? 0)}
              valueColor={COLORS.textPrimary}
            />
            <KPIMetric
              label="Win Rate"
              value={`${data?.winRate ?? 0}%`}
              valueColor={data?.winRate && data.winRate >= 60 ? '#10b981' : '#f59e0b'}
            />
            <KPIMetric
              label="Active Deals"
              value={data?.activeDeals ?? 0}
              valueColor={COLORS.textPrimary}
            />
          </div>

          {/* Target progress */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span style={{ color: '#8892a4' }} className="text-xs">
                Monthly Target
              </span>
              <span style={{ color: '#8892a4' }} className="text-xs">
                {fmt(data?.revenueThisMonth ?? 0)} / {fmt(data?.target ?? 0)} ({progressPct}%)
              </span>
            </div>
            <div
              style={{ background: 'rgba(255,255,255,0.06)' }}
              className="w-full h-2 rounded-full overflow-hidden"
            >
              <div
                style={{
                  width: `${progressPct}%`,
                  background:
                    progressPct >= 100
                      ? '#10b981'
                      : progressPct >= 80
                      ? COLOR
                      : '#f59e0b',
                  transition: 'width 0.6s ease',
                }}
                className="h-full rounded-full"
              />
            </div>
          </div>

          {/* Sparkline */}
          {sparkData.length > 0 && (
            <div>
              <p style={{ color: '#8892a4' }} className="text-xs mb-1">
                6-Month Revenue Trend
              </p>
              <MiniSparkline data={sparkData} color={COLOR} valuePrefix="$" />
            </div>
          )}
        </>
      )}

      {error && (
        <p style={{ color: '#f59e0b' }} className="text-xs mt-1">
          ⚠ Using demo data — {error}
        </p>
      )}
    </div>
  );
}
