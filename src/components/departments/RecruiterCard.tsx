import { useState } from 'react';
import { StatusBadge } from '../shared/StatusBadge';
import { WoWBadge } from '../shared/WoWBadge';
import { TimeFramePicker } from '../shared/TimeFramePicker';
import { Skeleton } from '../shared/Skeleton';
import { useRecruiterKPIs, useOpenJobs } from '../../hooks/queries';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import type { DepartmentStatus, TimeFrame } from '../../types';

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
  const [frame, setFrame] = useState<TimeFrame>('month');
  const { data, error, isLoading, isFetching } = useRecruiterKPIs(frame);
  const { data: openJobsData } = useOpenJobs();

  if (isLoading) return <RecruiterSkeleton />;
  if (!data) return null;

  const status: DepartmentStatus =
    data.placements >= 2 ? 'on-track' :
    data.placements >= 1 ? 'at-risk'  : 'off-track';

  const subtitleText =
    frame === 'week' ? 'This week vs last week' : 'Month to date vs prior period';

  // Open jobs is a live snapshot, not tied to the selected period — include recruiters
  // who have open jobs even if they had no interviews/placements this period.
  // Match by first name since Airtable stores first-name-only while JobAdder returns full names.
  const firstName = (n: string) => n.trim().split(' ')[0].toLowerCase();
  const displayRecruiters = [...data.byRecruiter];
  for (const name of Object.keys(openJobsData ?? {})) {
    if (!displayRecruiters.some(r => firstName(r.name) === firstName(name))) {
      displayRecruiters.push({ name, phoneInterviews: 0, internalInterviews: 0, prevInternalInterviews: 0, clientInterviews: 0, prevClientInterviews: 0, placements: 0, prevPlacements: 0 });
    }
  }
  displayRecruiters.sort((a, b) => a.name.localeCompare(b.name));

  const openJobsFor = (name: string) => {
    if (!openJobsData) return 0;
    const key = Object.keys(openJobsData).find(k => firstName(k) === firstName(name));
    return key ? openJobsData[key] : 0;
  };

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
          {isFetching && (
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              border: `2px solid ${COLORS.border}`,
              borderTopColor: COLORS.accent,
              animation: 'spin 0.7s linear infinite',
            }} />
          )}
          <TimeFramePicker
            value={frame}
            onChange={setFrame}
            options={[{ value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }]}
          />
          <StatusBadge status={error ? 'no-data' : status} />
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ ...CARD_STYLE, padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Contract Signed</div>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 20 }}>
          <span style={{ fontSize: 44, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-2px', lineHeight: 1 }}>{data.placements}</span>
          <WoWBadge current={data.placements} prev={data.prevPlacements} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {statCard('Internal Interviews',data.internalInterviews,data.internalInterviews,data.prevInternalInterviews)}
          {statCard('Client Interviews',  data.clientInterviews,  data.clientInterviews,  data.prevClientInterviews)}
          {statCard('Conversion Rate',    `${data.conversionRate}%`, data.conversionRate, data.prevConversionRate)}
          {statCard('Active Pipeline',    data.activePipeline,    0,                      0,                       true)}
        </div>
      </div>

      {displayRecruiters.length > 0 && (
          <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${COLORS.border}` }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                By Recruiter · This Period
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: COLORS.bgSubtle }}>
                  <th rowSpan={2} style={{ padding: '8px 16px', fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', verticalAlign: 'bottom' }}>Recruiter</th>
                  {['Internal', 'Client', 'Contract Signed'].map(h => (
                    <th key={h} colSpan={2} style={{ padding: '8px 16px', fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', borderLeft: `1px solid ${COLORS.border}` }}>{h}</th>
                  ))}
                  <th rowSpan={2} style={{ padding: '8px 16px', fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', verticalAlign: 'bottom', borderLeft: `1px solid ${COLORS.border}` }}>Open Jobs</th>
                </tr>
                <tr style={{ background: COLORS.bgSubtle }}>
                  {['Internal Interview', 'Client Interview', 'Contract Signed'].flatMap(h => ([
                    <th key={`${h}-current`} style={{ padding: '4px 12px 8px', fontSize: 9, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', borderLeft: `1px solid ${COLORS.border}` }}>Current</th>,
                    <th key={`${h}-prev`} style={{ padding: '4px 12px 8px', fontSize: 9, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Prev</th>,
                  ]))}
                </tr>
              </thead>
              <tbody>
                {displayRecruiters.map((r, i) => (
                  <tr key={r.name} style={{ borderTop: `1px solid ${COLORS.border}`, background: i % 2 === 1 ? COLORS.bgSubtle : 'transparent' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>{r.name}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, textAlign: 'center', borderLeft: `1px solid ${COLORS.border}` }}>{r.internalInterviews}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: COLORS.textMuted, textAlign: 'center' }}>{r.prevInternalInterviews}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, textAlign: 'center', borderLeft: `1px solid ${COLORS.border}` }}>{r.clientInterviews}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: COLORS.textMuted, textAlign: 'center' }}>{r.prevClientInterviews}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: r.placements > 0 ? COLORS.accent : COLORS.textPrimary, textAlign: 'center', borderLeft: `1px solid ${COLORS.border}` }}>{r.placements}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ fontSize: 13, color: COLORS.textMuted }}>{r.prevPlacements}</span>
                      <WoWBadge current={r.placements} prev={r.prevPlacements} />
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: COLORS.textPrimary, textAlign: 'center', borderLeft: `1px solid ${COLORS.border}` }}>{openJobsFor(r.name)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      )}

      {error && (
        <p style={{ color: COLORS.warning, fontSize: 12, margin: 0 }}>⚠ Connection error — {error?.message}</p>
      )}
    </div>
  );
}
