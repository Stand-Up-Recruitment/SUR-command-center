import { useCallback } from 'react';
import { KPIMetric } from '../shared/KPIMetric';
import { COLORS } from '../../styles/tokens';
import { StatusBadge } from '../shared/StatusBadge';
import { RecruiterTable } from '../shared/RecruiterTable';
import { useAirtable } from '../../hooks/useAirtable';
import { fetchRecruiterKPIs, MOCK_RECRUITER } from '../../services/airtable';
import type { DepartmentStatus } from '../../types';

const COLOR = '#10b981';

export function RecruiterCard() {
  const fetcher = useCallback(() => fetchRecruiterKPIs(), []);
  const { data, loading, error } = useAirtable(fetcher, MOCK_RECRUITER);

  const status: DepartmentStatus = !data
    ? 'no-data'
    : data.fillRate >= 70
    ? 'on-track'
    : data.fillRate >= 50
    ? 'at-risk'
    : 'off-track';

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
            Recruiter
          </p>
          <h3 style={{ color: '#e2e8f0' }} className="text-lg font-bold leading-none">
            Placements &amp; Pipeline
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
          {/* Team KPI row */}
          <div className="grid grid-cols-2 gap-4">
            <KPIMetric
              label="Active Jobs"
              value={data?.totalActiveJobs ?? 0}
              valueColor={COLOR}
            />
            <KPIMetric
              label="Placements"
              value={data?.totalPlacements ?? 0}
              valueColor={COLORS.textPrimary}
              trendText="this month"
            />
            <KPIMetric
              label="Team Fill Rate"
              value={`${data?.fillRate ?? 0}%`}
              valueColor={
                (data?.fillRate ?? 0) >= 70
                  ? '#10b981'
                  : (data?.fillRate ?? 0) >= 50
                  ? '#f59e0b'
                  : '#ef4444'
              }
            />
            <KPIMetric
              label="Avg Days to Fill"
              value={`${data?.avgDaysToFill ?? 0}d`}
              valueColor={COLORS.textPrimary}
            />
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #2a2d3e' }} />

          {/* Per-recruiter breakdown */}
          <div>
            <p style={{ color: '#8892a4' }} className="text-xs uppercase tracking-wider mb-3">
              By Recruiter — {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
            </p>
            <RecruiterTable recruiters={data?.byRecruiter ?? []} />
          </div>
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
