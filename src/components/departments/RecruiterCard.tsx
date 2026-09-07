import { useState } from 'react';
import { StatusBadge } from '../shared/StatusBadge';
import { WoWBadge } from '../shared/WoWBadge';
import { TimeFramePicker } from '../shared/TimeFramePicker';
import { Skeleton } from '../shared/Skeleton';
import { useRecruiterKPIs, useJobAging } from '../../hooks/queries';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import type { DepartmentStatus, TimeFrame } from '../../types';

// Breakeven cost model — update these when Les's costs change (same pattern as
// RECRUITER_COUNT in services/airtable.ts's LTGP calc).
const TOTAL_WEEKLY_OVERHEAD = 14000;   // NZD/week, manual input owned by Les
const RECRUITER_WEEKLY_SALARY = 1442;  // NZD/week, ~$75k/year baseline
const AVG_FEE_PER_PLACEMENT = 20000;   // NZD, blended flat-fee/% average
const WEEKS_PER_MONTH = 4.33;

const pct = (numerator: number, denominator: number) =>
  denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[0, 1, 2, 3].map(statBlock)}
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

const TIMEFRAME_OPTIONS: { value: TimeFrame; label: string }[] = [
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

export function RecruiterCard() {
  const [frame, setFrame] = useState<TimeFrame>('month');
  const { data, error, isLoading, isFetching } = useRecruiterKPIs(frame);
  const { data: jobAgingData } = useJobAging();

  if (isLoading) return <RecruiterSkeleton />;
  if (!data) return null;

  const status: DepartmentStatus =
    data.placements >= 2 ? 'on-track' :
    data.placements >= 1 ? 'at-risk'  : 'off-track';

  const subtitleText =
    frame === 'week' ? 'This week vs last week' : 'Month to date vs prior period';

  // Job aging is a live snapshot, not tied to the selected period — include recruiters
  // who have open jobs even if they had no interviews/placements this period.
  // Match by first name since Airtable stores first-name-only while Open Roles stores full names.
  const firstName = (n: string) => n.trim().split(' ')[0].toLowerCase();
  const displayRecruiters = [...data.byRecruiter];
  for (const stat of jobAgingData?.byRecruiter ?? []) {
    if (!displayRecruiters.some(r => firstName(r.name) === firstName(stat.name))) {
      displayRecruiters.push({
        name: stat.name, phoneInterviews: 0, internalInterviews: 0, prevInternalInterviews: 0,
        clientInterviews: 0, prevClientInterviews: 0, placements: 0, prevPlacements: 0,
        fallThroughRate: 0, prevFallThroughRate: 0,
      });
    }
  }
  displayRecruiters.sort((a, b) => a.name.localeCompare(b.name));

  const jobAgingFor = (name: string) => {
    const stat = jobAgingData?.byRecruiter.find(r => firstName(r.name) === firstName(name));
    return stat ?? { totalOpenJobs: 0, fresh: 0, ageing: 0, stale: 0 };
  };

  const totalOpenJobs = jobAgingData?.totalOpenJobs ?? 0;
  const jobsFresh = jobAgingData?.fresh ?? 0;
  const jobsAgeing = jobAgingData?.ageing ?? 0;
  const jobsStale = jobAgingData?.stale ?? 0;

  const internalToClientPct = pct(data.clientInterviews, data.internalInterviews);
  const prevInternalToClientPct = pct(data.prevClientInterviews, data.prevInternalInterviews);
  const clientToContractPct = pct(data.placements, data.clientInterviews);
  const prevClientToContractPct = pct(data.prevPlacements, data.prevClientInterviews);

  const liveHeadcount = displayRecruiters.length;
  const overheadPerRecruiter = liveHeadcount > 0 ? TOTAL_WEEKLY_OVERHEAD / liveHeadcount : 0;
  const totalCostPerRecruiter = overheadPerRecruiter + RECRUITER_WEEKLY_SALARY;
  const breakevenWeekly = totalCostPerRecruiter / AVG_FEE_PER_PLACEMENT;
  const breakevenMonthly = breakevenWeekly * WEEKS_PER_MONTH;

  const statCard = (label: string, value: string | number, current: number, prev: number, opts?: { noWoW?: boolean; invertDirection?: boolean }) => (
    <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>{value}</div>
      {!opts?.noWoW && <WoWBadge current={current} prev={prev} invertDirection={opts?.invertDirection} />}
    </div>
  );

  const jobBand = (count: number, color: string, label: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color }} title={label}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {count}
    </span>
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
            options={TIMEFRAME_OPTIONS}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
          {statCard('Internal Interviews', data.internalInterviews, data.internalInterviews, data.prevInternalInterviews)}
          {statCard('Client Interviews', data.clientInterviews, data.clientInterviews, data.prevClientInterviews)}
          <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Total Open Jobs</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary, marginBottom: 6 }}>{totalOpenJobs}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {jobBand(jobsFresh, COLORS.success, '≤21 days')}
              {jobBand(jobsAgeing, COLORS.warning, '22–35 days')}
              {jobBand(jobsStale, COLORS.danger, '36+ days')}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {statCard('Internal→Client %', `${internalToClientPct}%`, internalToClientPct, prevInternalToClientPct)}
          {statCard('Client→Contract %', `${clientToContractPct}%`, clientToContractPct, prevClientToContractPct)}
          <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Breakeven / Recruiter</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>{breakevenWeekly.toFixed(1)}<span style={{ fontSize: 12, fontWeight: 600, color: COLORS.textMuted }}> /wk</span></div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>{breakevenMonthly.toFixed(1)} /month · headcount {liveHeadcount}</div>
          </div>
          {statCard('Fall-through Rate', `${data.fallThroughRate}%`, data.fallThroughRate, data.prevFallThroughRate, { invertDirection: true })}
        </div>
      </div>

      {displayRecruiters.length > 0 && (
          <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${COLORS.border}` }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                By Recruiter · This Period
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: COLORS.bgSubtle }}>
                  <th rowSpan={2} style={{ padding: '8px 16px', fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', verticalAlign: 'bottom' }}>Recruiter</th>
                  {['Internal Interview', 'Client Interview', 'Contract Signed'].map(h => (
                    <th key={h} colSpan={2} style={{ padding: '8px 16px', fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', borderLeft: `1px solid ${COLORS.border}` }}>{h}</th>
                  ))}
                  {['Int→Client %', 'Client→Contract %', 'Open Jobs', 'Fall-through %'].map(h => (
                    <th key={h} rowSpan={2} style={{ padding: '8px 16px', fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', verticalAlign: 'bottom', borderLeft: `1px solid ${COLORS.border}` }}>{h}</th>
                  ))}
                </tr>
                <tr style={{ background: COLORS.bgSubtle }}>
                  {['Internal Interview', 'Client Interview', 'Contract Signed'].flatMap(h => ([
                    <th key={`${h}-current`} style={{ padding: '4px 12px 8px', fontSize: 9, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', borderLeft: `1px solid ${COLORS.border}` }}>Current</th>,
                    <th key={`${h}-prev`} style={{ padding: '4px 12px 8px', fontSize: 9, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Prev</th>,
                  ]))}
                </tr>
              </thead>
              <tbody>
                {displayRecruiters.map((r, i) => {
                  const rInternalToClient = pct(r.clientInterviews, r.internalInterviews);
                  const rPrevInternalToClient = pct(r.prevClientInterviews, r.prevInternalInterviews);
                  const rClientToContract = pct(r.placements, r.clientInterviews);
                  const rPrevClientToContract = pct(r.prevPlacements, r.prevClientInterviews);
                  const aging = jobAgingFor(r.name);
                  return (
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
                    <td style={{ padding: '10px 12px', textAlign: 'center', borderLeft: `1px solid ${COLORS.border}` }}>
                      <span style={{ fontSize: 13, color: COLORS.textPrimary }}>{rInternalToClient}%</span>
                      <WoWBadge current={rInternalToClient} prev={rPrevInternalToClient} />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', borderLeft: `1px solid ${COLORS.border}` }}>
                      <span style={{ fontSize: 13, color: COLORS.textPrimary }}>{rClientToContract}%</span>
                      <WoWBadge current={rClientToContract} prev={rPrevClientToContract} />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', borderLeft: `1px solid ${COLORS.border}` }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        {jobBand(aging.fresh, COLORS.success, '≤21 days')}
                        {jobBand(aging.ageing, COLORS.warning, '22–35 days')}
                        {jobBand(aging.stale, COLORS.danger, '36+ days')}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', borderLeft: `1px solid ${COLORS.border}` }}>
                      <span style={{ fontSize: 13, color: COLORS.textPrimary }}>{r.fallThroughRate}%</span>
                      <WoWBadge current={r.fallThroughRate} prev={r.prevFallThroughRate} invertDirection />
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
      )}

      {error && (
        <p style={{ color: COLORS.warning, fontSize: 12, margin: 0 }}>⚠ Connection error — {error?.message}</p>
      )}
    </div>
  );
}
