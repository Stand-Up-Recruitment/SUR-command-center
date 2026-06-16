import { useCallback } from 'react';
import { StatusBadge } from '../shared/StatusBadge';
import { WoWBadge } from '../shared/WoWBadge';
import { useAirtable } from '../../hooks/useAirtable';
import { fetchRecruiterKPIs, MOCK_RECRUITER } from '../../services/airtable';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import type { DepartmentStatus } from '../../types';

const hasRecruitCredentials =
  Boolean(import.meta.env.VITE_AIRTABLE_API_KEY) &&
  Boolean(import.meta.env.VITE_AIRTABLE_CANDIDATES_BASE_ID) &&
  Boolean(import.meta.env.VITE_AIRTABLE_CLIENTS_BASE_ID);

export function RecruiterCard() {
  const fetcher = useCallback(() => fetchRecruiterKPIs(), []);
  const { data, loading, error } = useAirtable(fetcher, MOCK_RECRUITER, hasRecruitCredentials);

  const status: DepartmentStatus = !data
    ? 'no-data'
    : data.placements >= 2
    ? 'on-track'
    : data.placements >= 1
    ? 'at-risk'
    : 'off-track';

  const statCard = (label: string, current: number, prev: number) => (
    <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>
        {current}
      </div>
      <WoWBadge current={current} prev={prev} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>
            Recruitment
          </h2>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>
            Week to date · Updates daily
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
          {/* HERO CARD: Placements + interview funnel */}
          <div style={{ ...CARD_STYLE, padding: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Placements
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 20 }}>
              <span style={{ fontSize: 44, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-2px', lineHeight: 1 }}>
                {data!.placements}
              </span>
              <WoWBadge current={data!.placements} prev={data!.prevPlacements} />
            </div>

            {/* Interview funnel grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {statCard('Phone Interviews', data!.phoneInterviews, data!.prevPhoneInterviews)}
              {statCard('Internal Interviews', data!.internalInterviews, data!.prevInternalInterviews)}
              {statCard('Client Interviews', data!.clientInterviews, data!.prevClientInterviews)}
            </div>
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
