import { useCallback } from 'react';
import { KPIMetric } from '../shared/KPIMetric';
import { StatusBadge } from '../shared/StatusBadge';
import { RecruiterTable } from '../shared/RecruiterTable';
import { useAirtable } from '../../hooks/useAirtable';
import { fetchRecruiterKPIs, MOCK_RECRUITER } from '../../services/airtable';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import type { DepartmentStatus } from '../../types';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>
            Recruitment
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
          {/* HERO CARD: Placements */}
          <div style={{ ...CARD_STYLE, padding: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Total Placements
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 20 }}>
              <span style={{ fontSize: 44, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-2px', lineHeight: 1 }}>
                {data?.totalPlacements ?? 0}
              </span>
              <span style={{ fontSize: 13, color: COLORS.textMuted, marginLeft: 12 }}>this month</span>
            </div>

            {/* Stat grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <KPIMetric
                label="Active Jobs"
                value={data?.totalActiveJobs ?? 0}
                valueColor={COLORS.accent}
              />
              <KPIMetric
                label="Team Fill Rate"
                value={`${data?.fillRate ?? 0}%`}
                valueColor={
                  (data?.fillRate ?? 0) >= 70 ? COLORS.accent
                  : (data?.fillRate ?? 0) >= 50 ? COLORS.warning
                  : COLORS.danger
                }
              />
              <KPIMetric
                label="Avg Days to Fill"
                value={`${data?.avgDaysToFill ?? 0}d`}
                valueColor={COLORS.textPrimary}
              />
              <KPIMetric
                label="Recruiters"
                value={data?.byRecruiter.length ?? 0}
                valueColor={COLORS.textSecondary}
              />
            </div>
          </div>

          {/* PER-RECRUITER TABLE CARD */}
          <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
            <div style={{ padding: '16px 14px 0' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                By Recruiter — {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
              </div>
            </div>
            <RecruiterTable recruiters={data?.byRecruiter ?? []} />
          </div>
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
