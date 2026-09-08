import { useState } from 'react';
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

// Same color language as StatusBadge (src/components/shared/StatusBadge.tsx), reused here
// as a full-width block instead of a pill.
const STATUS_STYLE: Record<DepartmentStatus, { bg: string; border: string; text: string; subtext: string }> = {
  'on-track': { bg: COLORS.accentBg, border: COLORS.accentBorder, text: COLORS.success, subtext: COLORS.success },
  'at-risk':  { bg: COLORS.warningBg, border: COLORS.warning, text: COLORS.warning, subtext: COLORS.warning },
  'off-track': { bg: COLORS.dangerBg, border: COLORS.danger, text: COLORS.danger, subtext: COLORS.danger },
  'no-data':  { bg: COLORS.bgSubtle, border: COLORS.border, text: COLORS.textMuted, subtext: COLORS.textMuted },
};

function RecruiterSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton height={22} width={120} />
          <Skeleton height={13} width={160} />
        </div>
        <Skeleton height={28} width={140} radius={8} />
      </div>
      <Skeleton height={54} radius={10} />
      <div style={{ display: 'flex', gap: 10 }}>
        {[0, 1, 2].map(i => <Skeleton key={i} height={64} radius={8} style={{ flex: 1 }} />)}
      </div>
      <Skeleton height={40} radius={10} />
      {[0, 1].map(i => <Skeleton key={i} height={180} radius={12} />)}
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

  const periodLabel = frame === 'week' ? 'week' : 'month';

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
  const clientToContractPct = pct(data.placements, data.clientInterviews);

  const liveHeadcount = displayRecruiters.length;
  const overheadPerRecruiter = liveHeadcount > 0 ? TOTAL_WEEKLY_OVERHEAD / liveHeadcount : 0;
  const totalCostPerRecruiter = overheadPerRecruiter + RECRUITER_WEEKLY_SALARY;
  const breakevenWeekly = totalCostPerRecruiter / AVG_FEE_PER_PLACEMENT;
  const breakevenMonthly = breakevenWeekly * WEEKS_PER_MONTH;
  const targetPerRecruiter = frame === 'week' ? breakevenWeekly : breakevenMonthly;
  const teamTarget = Math.ceil(targetPerRecruiter * liveHeadcount);

  const status: DepartmentStatus =
    data.placements >= teamTarget ? 'on-track' :
    data.placements >= teamTarget / 2 ? 'at-risk' : 'off-track';
  const statusStyle = STATUS_STYLE[error ? 'no-data' : status];

  const stackedBar = (fresh: number, ageing: number, stale: number) => {
    const total = fresh + ageing + stale;
    return (
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: COLORS.border }}>
        {total > 0 ? (
          <>
            {fresh  > 0 && <div style={{ flexGrow: fresh,  background: COLORS.success }} />}
            {ageing > 0 && <div style={{ flexGrow: ageing, background: COLORS.warning }} />}
            {stale  > 0 && <div style={{ flexGrow: stale,  background: COLORS.danger }} />}
          </>
        ) : null}
      </div>
    );
  };

  const funnelStage = (label: string, value: number, prev: number, highlight?: boolean) => (
    <div style={{
      flex: 1, textAlign: 'center', borderRadius: 8, padding: '10px 8px',
      background: highlight ? statusStyle.bg : COLORS.bgSubtle,
      border: `1px solid ${highlight ? statusStyle.border : COLORS.border}`,
    }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: highlight ? statusStyle.text : COLORS.textPrimary, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4 }}>last {periodLabel}: {prev}</div>
    </div>
  );

  const funnelConnector = (label: number) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0, padding: '0 4px' }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted }}>{label}%</span>
      <span style={{ fontSize: 13, color: COLORS.textMuted }}>→</span>
    </div>
  );

  const detailRow = (label: string, value: string | number, prev: string | number, target?: string, bold = false) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '4px 0' }}>
      <span style={{ flex: 1, fontSize: 12, color: COLORS.textSecondary }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 800 : 600, color: COLORS.textPrimary, minWidth: 24, textAlign: 'right' }}>{value}</span>
      <span style={{ fontSize: 11, color: COLORS.textMuted, minWidth: 100, textAlign: 'right' }}>last {periodLabel}: {prev}</span>
      <span style={{ fontSize: 11, color: COLORS.textMuted, minWidth: 70, textAlign: 'right' }}>{target ?? ''}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>Recruitment</h2>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>
            {frame === 'week' ? 'This week vs last week' : 'Month to date vs prior period'} · Updates daily
          </p>
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
          <TimeFramePicker value={frame} onChange={setFrame} options={TIMEFRAME_OPTIONS} />
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Hiring funnel */}
      <div style={{ ...CARD_STYLE, padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Hiring Funnel</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {funnelStage('Internal Interviews', data.internalInterviews, data.prevInternalInterviews)}
          {funnelConnector(internalToClientPct)}
          {funnelStage('Client Interviews', data.clientInterviews, data.prevClientInterviews)}
          {funnelConnector(clientToContractPct)}
          {funnelStage('Contracts Signed', data.placements, data.prevPlacements, true)}
        </div>
      </div>

      {/* Open jobs — team overview */}
      <div style={{ ...CARD_STYLE, padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
          All Open Jobs — {totalOpenJobs} total
        </div>
        {stackedBar(jobsFresh, jobsAgeing, jobsStale)}
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 8 }}>
          {jobsFresh} fresh · {jobsAgeing} ageing · {jobsStale} stale — see per-recruiter breakdown below
        </div>
      </div>

      {/* By recruiter — card stack */}
      {displayRecruiters.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            By Recruiter · This {periodLabel === 'week' ? 'Week' : 'Month'} vs Last {periodLabel === 'week' ? 'Week' : 'Month'}
          </div>
          {displayRecruiters.map(r => {
            const rInternalToClient = pct(r.clientInterviews, r.internalInterviews);
            const rPrevInternalToClient = pct(r.prevClientInterviews, r.prevInternalInterviews);
            const rClientToContract = pct(r.placements, r.clientInterviews);
            const rPrevClientToContract = pct(r.prevPlacements, r.prevClientInterviews);
            const aging = jobAgingFor(r.name);

            return (
              <div key={r.name} style={{ ...CARD_STYLE, padding: 16 }}>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: COLORS.textPrimary }}>{r.name}</span>
                </div>

                {detailRow('Contracts signed', r.placements, r.prevPlacements, undefined, true)}
                {detailRow('Internal interviews', r.internalInterviews, r.prevInternalInterviews)}
                {detailRow('Client interviews', r.clientInterviews, r.prevClientInterviews)}
                {detailRow('Internal → client %', `${rInternalToClient}%`, `${rPrevInternalToClient}%`)}
                {detailRow('Client → contract %', `${rClientToContract}%`, `${rPrevClientToContract}%`)}

                <div style={{ marginTop: 10, marginBottom: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    Open jobs by age — {aging.totalOpenJobs} total
                  </div>
                  {stackedBar(aging.fresh, aging.ageing, aging.stale)}
                  <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4 }}>
                    {aging.fresh} fresh · {aging.ageing} ageing · {aging.stale} stale
                  </div>
                </div>

                <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: 8, paddingTop: 4 }}>
                  {detailRow('Post-signing fall-through', `${r.fallThroughRate}%`, `${r.prevFallThroughRate}%`)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <p style={{ color: COLORS.warning, fontSize: 12, margin: 0 }}>⚠ Connection error — {error?.message}</p>
      )}
    </div>
  );
}
