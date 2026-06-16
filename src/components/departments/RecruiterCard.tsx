import { useCallback, useState } from 'react';
import { StatusBadge } from '../shared/StatusBadge';
import { WoWBadge } from '../shared/WoWBadge';
import { TimeFramePicker } from '../shared/TimeFramePicker';
import { Skeleton } from '../shared/Skeleton';
import { useAirtable } from '../../hooks/useAirtable';
import { fetchRecruiterKPIs } from '../../services/airtable';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import type { DepartmentStatus, TimeFrame } from '../../types';

const hasRecruitCredentials =
  Boolean(import.meta.env.VITE_AIRTABLE_API_KEY) &&
  Boolean(import.meta.env.VITE_AIRTABLE_CANDIDATES_BASE_ID) &&
  Boolean(import.meta.env.VITE_AIRTABLE_CLIENTS_BASE_ID);

function RecruiterSkeleton() {
  const statBlock = (i: number) => (
    <div key={i} style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
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
        <Skeleton height={28} width={140} radius={8} />
      </div>
      <div style={{ ...CARD_STYLE, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton height={11} width={80} />
        <Skeleton height={44} width={80} radius={4} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {[0, 1, 2, 3, 4].map(statBlock)}
        </div>
      </div>
      <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${COLORS.border}` }}>
          <Skeleton height={11} width={140} />
        </div>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '12px 16px', borderTop: i > 0 ? `1px solid ${COLORS.border}` : undefined }}>
            <Skeleton height={13} width={80} />
            {[0, 1, 2, 3].map(j => <Skeleton key={j} height={13} width={24} style={{ justifySelf: 'center' }} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecruiterCard() {
  const [frame, setFrame] = useState<TimeFrame>('7d');
  const fetcher = useCallback(() => fetchRecruiterKPIs(frame), [frame]);
  const { data, error } = useAirtable(fetcher, undefined, hasRecruitCredentials);

  if (!data) return <RecruiterSkeleton />;

  const status: DepartmentStatus =
    data.placements >= 2 ? 'on-track' :
    data.placements >= 1 ? 'at-risk'  : 'off-track';

  const subtitleText =
    frame === 'month' ? 'Month to date' :
    frame === '7d'    ? 'Last 7 days'   :
    frame === '14d'   ? 'Last 14 days'  : 'Last 30 days';

  const statCard = (label: string, value: string | number, current: number, prev: number, noWoW?: boolean) => (
    <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>{value}</div>
      {!noWoW && <WoWBadge current={current} prev={prev} />}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>Recruitment</h2>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>{subtitleText} · Updates daily</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TimeFramePicker value={frame} onChange={setFrame} />
          <StatusBadge status={error ? 'no-data' : status} />
        </div>
      </div>

      <div style={{ ...CARD_STYLE, padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Placements</div>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 20 }}>
          <span style={{ fontSize: 44, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-2px', lineHeight: 1 }}>{data.placements}</span>
          <WoWBadge current={data.placements} prev={data.prevPlacements} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {statCard('Phone Interviews',   data.phoneInterviews,   data.phoneInterviews,   data.prevPhoneInterviews)}
          {statCard('Internal Interviews',data.internalInterviews,data.internalInterviews,data.prevInternalInterviews)}
          {statCard('Client Interviews',  data.clientInterviews,  data.clientInterviews,  data.prevClientInterviews)}
          {statCard('Conversion Rate',    `${data.conversionRate}%`, data.conversionRate, data.prevConversionRate)}
          {statCard('Active Pipeline',    data.activePipeline,    0,                      0,                       true)}
        </div>
      </div>

      {data.byRecruiter.length > 0 && (
        <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${COLORS.border}` }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              By Recruiter · This Period
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: COLORS.bgSubtle }}>
                {['Recruiter', 'Phone', 'Internal', 'Client', 'Placements'].map(h => (
                  <th key={h} style={{ padding: '8px 16px', fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: h === 'Recruiter' ? 'left' : 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.byRecruiter.map((r, i) => (
                <tr key={r.name} style={{ borderTop: `1px solid ${COLORS.border}`, background: i % 2 === 1 ? COLORS.bgSubtle : 'transparent' }}>
                  <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>{r.name}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: COLORS.textPrimary, textAlign: 'center' }}>{r.phoneInterviews}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: COLORS.textPrimary, textAlign: 'center' }}>{r.internalInterviews}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: COLORS.textPrimary, textAlign: 'center' }}>{r.clientInterviews}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, color: r.placements > 0 ? COLORS.accent : COLORS.textPrimary, textAlign: 'center' }}>{r.placements}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <p style={{ color: COLORS.warning, fontSize: 12, margin: 0 }}>⚠ Connection error — {error}</p>
      )}
    </div>
  );
}
