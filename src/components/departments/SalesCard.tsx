import { useCallback } from 'react';
import { StatusBadge } from '../shared/StatusBadge';
import { WoWBadge } from '../shared/WoWBadge';
import { useAirtable } from '../../hooks/useAirtable';
import { fetchSalesKPIs, MOCK_SALES } from '../../services/airtable';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import type { DepartmentStatus } from '../../types';

const hasSalesCredentials =
  Boolean(import.meta.env.VITE_AIRTABLE_API_KEY) &&
  Boolean(import.meta.env.VITE_AIRTABLE_CLIENTS_BASE_ID);

export function SalesCard() {
  const fetcher = useCallback(() => fetchSalesKPIs(), []);
  const { data, loading, error } = useAirtable(fetcher, MOCK_SALES, hasSalesCredentials);

  const status: DepartmentStatus = !data
    ? 'no-data'
    : data.callsToCloseRate >= 40
    ? 'on-track'
    : data.callsToCloseRate >= 20
    ? 'at-risk'
    : 'off-track';

  const statCard = (
    label: string,
    value: string | number,
    current: number,
    prev: number,
    opts?: { neutral?: boolean; invertDirection?: boolean }
  ) => (
    <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>
        {value}
      </div>
      <WoWBadge current={current} prev={prev} neutral={opts?.neutral} invertDirection={opts?.invertDirection} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>
            Sales
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
          {/* HERO CARD: Calls to close rate */}
          <div style={{ ...CARD_STYLE, padding: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Calls to Close Rate
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 44, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-2px', lineHeight: 1 }}>
                {data!.callsToCloseRate}%
              </span>
              <WoWBadge current={data!.callsToCloseRate} prev={data!.prevCallsToCloseRate} />
            </div>
            <p style={{ fontSize: 12, color: COLORS.textMuted, margin: '0 0 20px' }}>
              of calls this week converted to signed terms
            </p>

            {/* Stat grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {statCard('Booked Calls', data!.bookedCalls, data!.bookedCalls, data!.prevBookedCalls)}
              {statCard('New Clients Closed', data!.closedClients, data!.closedClients, data!.prevClosedClients)}
              {statCard('Lead to Close', `${data!.leadToCloseRate}%`, data!.leadToCloseRate, data!.prevLeadToCloseRate)}
              {statCard('Open Pipeline', data!.openPipeline, data!.newPipelineThisWeek, data!.newPipelinePrevWeek, { neutral: true })}
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
