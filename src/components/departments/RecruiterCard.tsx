import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { TimeFramePicker } from '../shared/TimeFramePicker';
import { Skeleton } from '../shared/Skeleton';
import { useRecruiterKPIs, useJobAging, useAutoCallKPIs, useJobAdderStageKPIs } from '../../hooks/queries';
import { timeBoundaries } from '../../services/airtable';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import type { DepartmentStatus, RecruiterStat, TimeFrame } from '../../types';

// Breakeven cost model — update these when Les's costs change (same pattern as
// RECRUITER_COUNT in services/airtable.ts's LTGP calc).
const TOTAL_WEEKLY_OVERHEAD = 14000;   // NZD/week, manual input owned by Les
const RECRUITER_WEEKLY_SALARY = 1442;  // NZD/week, ~$75k/year baseline
const AVG_FEE_PER_PLACEMENT = 20000;   // NZD, blended flat-fee/% average
const WEEKS_PER_MONTH = 4.33;

// Draft placement target from Les's "Recruiter KPI Standards" doc — applied equally to
// every recruiter until level-based targets are confirmed.
const DRAFT_TARGET_CONTRACTS_MONTHLY = 2;    // ~2/month
// Client interview targets are backed out of the placement target at this assumed
// client → contract conversion until real conversion data is in.
const ASSUMED_CLIENT_TO_CONTRACT = 0.8;

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const DAY_MS = 86_400_000;

const pct = (numerator: number, denominator: number) =>
  denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

const fmtTarget = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// Green at/above target · orange below target but above breakeven (or activity 75–99%)
// · red below breakeven (or activity under 75%).
const rag = (value: number, target: number, breakeven = target * 0.75) =>
  value >= target ? COLORS.success : value >= breakeven ? COLORS.warning : COLORS.danger;

const ragLabel = (color: string) =>
  color === COLORS.success ? 'On track' : color === COLORS.warning ? 'Below target' : 'Behind';

// Same color language as StatusBadge (src/components/shared/StatusBadge.tsx), reused here
// as a full-width block instead of a pill.
const STATUS_STYLE: Record<DepartmentStatus, { bg: string; border: string; text: string; subtext: string }> = {
  'on-track': { bg: COLORS.accentBg, border: COLORS.accentBorder, text: COLORS.success, subtext: COLORS.success },
  'at-risk':  { bg: COLORS.warningBg, border: COLORS.warning, text: COLORS.warning, subtext: COLORS.warning },
  'off-track': { bg: COLORS.dangerBg, border: COLORS.danger, text: COLORS.danger, subtext: COLORS.danger },
  'no-data':  { bg: COLORS.bgSubtle, border: COLORS.border, text: COLORS.textMuted, subtext: COLORS.textMuted },
};

const SECTION_LABEL: CSSProperties = {
  fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em',
};

function RecruiterSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton height={22} width={120} />
          <Skeleton height={13} width={200} />
        </div>
        <Skeleton height={28} width={140} radius={8} />
      </div>
      <Skeleton height={64} radius={12} />
      <div style={{ display: 'flex', gap: 12 }}>
        {[0, 1, 2, 3].map(i => <Skeleton key={i} height={130} radius={12} style={{ flex: 1 }} />)}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {[0, 1].map(i => <Skeleton key={i} height={48} radius={12} style={{ flex: 1 }} />)}
      </div>
      <Skeleton height={320} radius={12} />
      <Skeleton height={140} radius={12} />
    </div>
  );
}

const TIMEFRAME_OPTIONS: { value: TimeFrame; label: string }[] = [
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

export function RecruiterCard() {
  const [frame, setFrame] = useState<TimeFrame>('month');
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, error, isLoading, isFetching } = useRecruiterKPIs(frame);
  const { data: jobAgingData } = useJobAging();
  const { data: autoCallData } = useAutoCallKPIs(frame);
  const { data: jobAdderStageData } = useJobAdderStageKPIs(frame);

  if (isLoading) return <RecruiterSkeleton />;
  if (!data) return null;

  const periodLabel = frame === 'week' ? 'week' : 'month';

  // Subtitle date range, e.g. "1–28 Sep" or "29 Sep–5 Oct".
  const { start, now } = timeBoundaries(frame);
  const startDate = new Date(start);
  const nowDate = new Date(now);
  const fmtDay = (d: Date) => d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
  const rangeLabel = startDate.getMonth() === nowDate.getMonth()
    ? `${startDate.getDate()}–${fmtDay(nowDate)}`
    : `${fmtDay(startDate)}–${fmtDay(nowDate)}`;

  // Job aging is a live snapshot, not tied to the selected period — include recruiters
  // who have open jobs even if they had no interviews/placements this period.
  // Match by first name since both sources key recruiters by first name only.
  const firstName = (n: string) => n.trim().split(' ')[0].toLowerCase();
  // Nihanga is HR & Business Operations, not a recruiter — JobAdder lists her as the
  // owner on some open jobs, but she shouldn't appear as a "By Recruiter" card.
  const NON_RECRUITERS = ['nihanga'];
  const baseRecruiters: RecruiterStat[] = [...data.byRecruiter];
  for (const stat of jobAgingData?.byRecruiter ?? []) {
    if (NON_RECRUITERS.includes(firstName(stat.name))) continue;
    if (!baseRecruiters.some(r => firstName(r.name) === firstName(stat.name))) {
      baseRecruiters.push({
        name: stat.name, phoneInterviews: 0, prevPhoneInterviews: 0, internalInterviews: 0, prevInternalInterviews: 0,
        clientInterviews: 0, prevClientInterviews: 0, placements: 0, prevPlacements: 0,
        fallThroughRate: 0, prevFallThroughRate: 0,
      });
    }
  }
  baseRecruiters.sort((a, b) => a.name.localeCompare(b.name));

  // Merge in Autocalls + JobAdder pipeline-stage KPIs (separate webhooks) by first name —
  // left as undefined (rendered as "—") when a hook hasn't loaded or has no match.
  // Copies each row so the React Query cache isn't mutated.
  const displayRecruiters: RecruiterStat[] = baseRecruiters.map(r => {
    const ac = autoCallData?.byRecruiter.find(s => firstName(s.name) === firstName(r.name));
    const js = jobAdderStageData?.byRecruiter.find(s => firstName(s.name) === firstName(r.name));
    return {
      ...r,
      ...(ac && {
        leadsContactedByBot: ac.leadsContactedByBot,
        prevLeadsContactedByBot: ac.prevLeadsContactedByBot,
      }),
      ...(js && {
        referenceChecks: js.referenceChecks,
        prevReferenceChecks: js.prevReferenceChecks,
        candidatesPitched: js.candidatesPitched,
        prevCandidatesPitched: js.prevCandidatesPitched,
        internalInterviewsBotBooked: js.internalInterviewsBotBooked,
        prevInternalInterviewsBotBooked: js.prevInternalInterviewsBotBooked,
      }),
    };
  });

  const jobAgingFor = (name: string) => {
    const stat = jobAgingData?.byRecruiter?.find(r => firstName(r.name) === firstName(name));
    return stat ?? { totalOpenJobs: 0, fresh: 0, ageing: 0, stale: 0 };
  };

  const totalOpenJobs = jobAgingData?.totalOpenJobs ?? 0;
  const jobsFresh = jobAgingData?.fresh ?? 0;
  const jobsAgeing = jobAgingData?.ageing ?? 0;
  const jobsStale = jobAgingData?.stale ?? 0;
  const stalePct = pct(jobsStale, totalOpenJobs);

  const internalToClientPct = pct(data.clientInterviews, data.internalInterviews);
  const clientToContractPct = pct(data.placements, data.clientInterviews);

  const liveHeadcount = displayRecruiters.length;
  const overheadPerRecruiter = liveHeadcount > 0 ? TOTAL_WEEKLY_OVERHEAD / liveHeadcount : 0;
  const totalCostPerRecruiter = overheadPerRecruiter + RECRUITER_WEEKLY_SALARY;
  const breakevenWeekly = totalCostPerRecruiter / AVG_FEE_PER_PLACEMENT;
  const breakevenPerRecruiter = frame === 'week' ? breakevenWeekly : breakevenWeekly * WEEKS_PER_MONTH;
  const teamBreakeven = breakevenPerRecruiter * liveHeadcount;

  const placementTarget = frame === 'week'
    ? DRAFT_TARGET_CONTRACTS_MONTHLY / WEEKS_PER_MONTH
    : DRAFT_TARGET_CONTRACTS_MONTHLY;
  const clientTarget = Math.ceil(placementTarget / ASSUMED_CLIENT_TO_CONTRACT);
  const teamPlacementTarget = placementTarget * liveHeadcount;
  const teamClientTarget = clientTarget * liveHeadcount;

  // Straight-line projection to period end from days elapsed so far (today counts).
  const periodDays = frame === 'week'
    ? 7
    : new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0).getDate();
  const daysElapsed = Math.max(1, Math.ceil((now - start) / DAY_MS));
  const projected = Math.round((data.placements / daysElapsed) * periodDays);

  const status: DepartmentStatus =
    projected >= teamPlacementTarget ? 'on-track' :
    projected >= teamBreakeven ? 'at-risk' : 'off-track';
  const statusStyle = STATUS_STYLE[error ? 'no-data' : status];
  const statusTitle = status === 'on-track' ? 'On track' : status === 'at-risk' ? 'Below target' : 'Behind target';

  const placementColor = rag(data.placements, teamPlacementTarget, teamBreakeven);
  const clientColor = rag(data.clientInterviews, teamClientTarget);

  // Recruitment bot — team totals summed from the per-recruiter webhooks.
  const sumDefined = (vals: (number | undefined)[]) =>
    vals.some(v => v !== undefined) ? vals.reduce<number>((s, v) => s + (v ?? 0), 0) : undefined;
  const botLeads = sumDefined(displayRecruiters.map(r => r.leadsContactedByBot));
  const prevBotLeads = sumDefined(displayRecruiters.map(r => r.prevLeadsContactedByBot));
  const botBooked = sumDefined(displayRecruiters.map(r => r.internalInterviewsBotBooked));
  const prevBotBooked = sumDefined(displayRecruiters.map(r => r.prevInternalInterviewsBotBooked));
  // Attended isn't tracked directly — an Airtable internal interview only exists once it
  // happened, so it caps how many of a recruiter's bot bookings could have been attended.
  const botAttended = sumDefined(displayRecruiters.map(r =>
    r.internalInterviewsBotBooked !== undefined ? Math.min(r.internalInterviews, r.internalInterviewsBotBooked) : undefined));
  const showUpPct = botBooked !== undefined && botAttended !== undefined && botBooked > 0
    ? pct(botAttended, botBooked) : undefined;
  const botDataMismatch = botLeads !== undefined && botBooked !== undefined && botBooked > botLeads;

  const pill = (label: string, bg: string, color = '#0d0d0d') => (
    <span style={{
      fontSize: 11, fontWeight: 700, color, background: bg, borderRadius: 999,
      padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0,
    }}>{label}</span>
  );

  const bigValue = (value: ReactNode, target: ReactNode, color: string, size = 44) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
      <span style={{ fontSize: size, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: size * 0.45, color: COLORS.textMuted }}>/ {target}</span>
    </div>
  );

  const kpiTile = (label: string, badge: ReactNode, value: ReactNode, sub: string, foot: string) => (
    <div style={{ ...CARD_STYLE, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={SECTION_LABEL}>{label}</span>
        {badge}
      </div>
      {value}
      <div>
        <div style={{ fontSize: 13, color: COLORS.textSecondary }}>{sub}</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 6 }}>{foot}</div>
      </div>
    </div>
  );

  const connector = (value: number) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary, fontFamily: MONO }}>{value}%</span>
      <span style={{ fontSize: 16, color: COLORS.textMuted }}>→</span>
      <span style={{ fontSize: 10, color: COLORS.textMuted }}>convert</span>
    </div>
  );

  const strip = (label: string, sub: string, value: ReactNode) => (
    <div style={{ ...CARD_STYLE, padding: '14px 18px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <div style={SECTION_LABEL}>{label}</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>{sub}</div>
      </div>
      {value}
    </div>
  );

  const stackedBar = (fresh: number, ageing: number, stale: number) => {
    const total = fresh + ageing + stale;
    return (
      <div style={{ display: 'flex', gap: 2, height: 8, borderRadius: 4, overflow: 'hidden', background: COLORS.border }}>
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

  const cellValue = (value: ReactNode, target: ReactNode, color: string = COLORS.textPrimary) => (
    <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 18, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 12, color: COLORS.textMuted }}> / {target}</span>
    </span>
  );

  const miniStat = (value: ReactNode, label: string, sub?: string, color: string = COLORS.textPrimary, size = 16) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: size, fontWeight: 700, color, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: COLORS.textMuted }}>{sub}</div>}
    </div>
  );

  const th: CSSProperties = { ...SECTION_LABEL, fontSize: 10, textAlign: 'left', padding: '12px 10px', verticalAlign: 'top' };
  const td: CSSProperties = { padding: '14px 10px', fontSize: 13, color: COLORS.textPrimary, verticalAlign: 'middle' };
  const pctCell: CSSProperties = { ...td, fontFamily: MONO, fontWeight: 700 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>Recruitment</h2>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>
            {frame === 'week' ? 'Week' : 'Month'} to date · {rangeLabel} · updates daily
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

      {/* Status banner */}
      <div style={{
        borderRadius: 12, padding: '18px 22px', background: statusStyle.bg, border: `1px solid ${statusStyle.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: statusStyle.text }}>
            {statusTitle}: {data.placements} of {fmtTarget(teamPlacementTarget)} placements this {periodLabel}
          </div>
          <div style={{ fontSize: 13, color: statusStyle.subtext, opacity: 0.85, marginTop: 4 }}>
            Projected {periodLabel}-end: {projected} · Team breakeven: {teamBreakeven.toFixed(1)} · Last {periodLabel}: {data.prevPlacements}
          </div>
        </div>
        <div style={{ fontSize: 36, fontWeight: 800, color: statusStyle.text, fontFamily: MONO }}>
          {pct(data.placements, teamPlacementTarget)}%
        </div>
      </div>

      {/* Funnel KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr 1fr', gap: 12 }}>
        {kpiTile('Internal Interviews', pill('No target yet', COLORS.textSecondary),
          bigValue(data.internalInterviews, 'TBC', COLORS.textSecondary),
          'Target from conversion data', `Last ${periodLabel}: ${data.prevInternalInterviews}`)}
        {connector(internalToClientPct)}
        {kpiTile('Client Interviews', pill(ragLabel(clientColor), clientColor),
          bigValue(data.clientInterviews, teamClientTarget, clientColor),
          `Target est. at ${ASSUMED_CLIENT_TO_CONTRACT * 100}% conversion`, `Last ${periodLabel}: ${data.prevClientInterviews}`)}
        {connector(clientToContractPct)}
        {kpiTile('Placements', pill(ragLabel(placementColor), placementColor),
          bigValue(data.placements, fmtTarget(teamPlacementTarget), placementColor),
          `Breakeven ${teamBreakeven.toFixed(1)} · projected ${projected}`, `Last ${periodLabel}: ${data.prevPlacements}`)}
        {kpiTile('Stale Jobs (36+ days)', pill(`${stalePct}% stale`, jobsStale > 0 ? COLORS.danger : COLORS.success),
          bigValue(jobsStale, totalOpenJobs, jobsStale > 0 ? COLORS.danger : COLORS.success),
          `${jobsFresh} fresh · ${jobsAgeing} ageing`, 'Clear or re-brief')}
      </div>

      {/* Fall-through + candidate stock */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {strip('Fall-through', `Contracts that didn't stick · this ${periodLabel}`,
          <span style={{ fontSize: 22, fontWeight: 800, fontFamily: MONO, color: data.fallThroughRate === 0 ? COLORS.success : COLORS.danger }}>
            {data.fallThroughRate}%
          </span>)}
        {strip('Candidate Stock', 'Per trade division vs low-stock trigger · awaiting JobAdder ratio',
          <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.textSecondary }}>[Divisions]</span>)}
      </div>

      {/* Recruiters table */}
      {displayRecruiters.length > 0 && (
        <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', borderBottom: `1px solid ${COLORS.border}` }}>
            <span style={SECTION_LABEL}>Recruiters · vs their target</span>
            <span style={{ fontSize: 12, color: COLORS.textMuted }}>Tap a recruiter for activity detail</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <th style={{ ...th, paddingLeft: 18 }}>Recruiter</th>
                  <th style={th}>Internal int.</th>
                  <th style={th}>Int → client</th>
                  <th style={th}>Client int.</th>
                  <th style={th}>Client → contract</th>
                  <th style={th}>Placements</th>
                  <th style={{ ...th, width: '26%' }}>Open jobs by age</th>
                  <th style={{ ...th, paddingRight: 18 }}>Last {periodLabel}</th>
                </tr>
              </thead>
              <tbody>
                {displayRecruiters.map(r => {
                  const aging = jobAgingFor(r.name);
                  const isOpen = expanded === r.name;
                  // Manually-booked isn't tracked directly — derived as the remainder of total
                  // internal interviews (Airtable) after subtracting bot bookings (Calendly).
                  const rManualBooked = r.internalInterviewsBotBooked !== undefined
                    ? Math.max(0, r.internalInterviews - r.internalInterviewsBotBooked) : undefined;
                  const rClientColor = rag(r.clientInterviews, clientTarget);
                  const rPlacementColor = rag(r.placements, placementTarget, breakevenPerRecruiter);

                  return [
                    <tr
                      key={r.name}
                      onClick={() => setExpanded(isOpen ? null : r.name)}
                      style={{ borderBottom: `1px solid ${COLORS.border}`, cursor: 'pointer', background: isOpen ? COLORS.bgSubtle : undefined }}
                    >
                      <td style={{ ...td, paddingLeft: 18, fontSize: 16, fontWeight: 800 }}>
                        {r.name} <span style={{ fontSize: 10, color: COLORS.textMuted }}>{isOpen ? '▾' : '▸'}</span>
                      </td>
                      <td style={td}>{cellValue(r.internalInterviews, 'TBC')}</td>
                      <td style={pctCell}>{pct(r.clientInterviews, r.internalInterviews)}%</td>
                      <td style={td}>{cellValue(r.clientInterviews, clientTarget, rClientColor)}</td>
                      <td style={pctCell}>{pct(r.placements, r.clientInterviews)}%</td>
                      <td style={td}>{cellValue(r.placements, fmtTarget(placementTarget), rPlacementColor)}</td>
                      <td style={td}>
                        {stackedBar(aging.fresh, aging.ageing, aging.stale)}
                        <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 6 }}>
                          {aging.totalOpenJobs} jobs · {aging.fresh} fresh · {aging.ageing} ageing ·{' '}
                          <strong style={{ color: aging.stale > 0 ? COLORS.danger : COLORS.textPrimary }}>{aging.stale} stale</strong>
                        </div>
                      </td>
                      <td style={{ ...td, paddingRight: 18, fontFamily: MONO, color: COLORS.textSecondary }}>{r.prevPlacements}</td>
                    </tr>,
                    isOpen && (
                      <tr key={`${r.name}-detail`} style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bgSubtle }}>
                        <td colSpan={8} style={{ padding: '16px 18px' }}>
                          <div style={{ display: 'flex', gap: 16 }}>
                            {miniStat(r.phoneInterviews, 'Manual calls')}
                            {miniStat(rManualBooked ?? '—', 'Internals manually booked')}
                            {miniStat(r.referenceChecks ?? '—', 'Reference checks')}
                            {miniStat(r.candidatesPitched ?? '—', 'Pitched to client')}
                            {miniStat(`${r.fallThroughRate}%`, 'Fall-through')}
                          </div>
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 18px', fontSize: 12, color: COLORS.textSecondary }}>
            <strong style={{ color: COLORS.success }}>Green</strong> at or above target ·{' '}
            <strong style={{ color: COLORS.warning }}>Orange</strong> below target, above breakeven (activity 75–99%) ·{' '}
            <strong style={{ color: COLORS.danger }}>Red</strong> below breakeven (activity under 75%)
          </div>
        </div>
      )}

      <p style={{ fontSize: 12, color: COLORS.textMuted, margin: 0 }}>
        Client interview targets estimated at {ASSUMED_CLIENT_TO_CONTRACT * 100}% client → contract until conversion data is in. Internal interview targets TBC.
      </p>

      {/* Recruitment bot — team */}
      <div style={{ ...CARD_STYLE, padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={SECTION_LABEL}>Recruitment Bot · Team</span>
          {botDataMismatch && pill('Check data', COLORS.danger)}
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {miniStat(botLeads ?? '—', 'Leads contacted', `Last ${periodLabel}: ${prevBotLeads ?? '—'}`, COLORS.textPrimary, 30)}
          {miniStat(botBooked ?? '—', 'Internal interviews booked', `Last ${periodLabel}: ${prevBotBooked ?? '—'}`, COLORS.textPrimary, 30)}
          {miniStat(botAttended ?? '—', 'Booked interviews attended', 'Implied from recruiter totals', COLORS.textPrimary, 30)}
          {miniStat(showUpPct !== undefined ? `${showUpPct}%` : '—', 'Show-up rate', 'Attended ÷ booked',
            showUpPct !== undefined ? rag(showUpPct, 80) : COLORS.textPrimary, 30)}
        </div>
        {botDataMismatch && (
          <div style={{ background: COLORS.warningBg, color: COLORS.warning, borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
            More bookings ({botBooked}) than leads contacted ({botLeads}): the counts don't reconcile. Confirm the show-up rate before acting on it.
          </div>
        )}
      </div>

      {error && (
        <p style={{ color: COLORS.warning, fontSize: 12, margin: 0 }}>⚠ Connection error — {error?.message}</p>
      )}
    </div>
  );
}
