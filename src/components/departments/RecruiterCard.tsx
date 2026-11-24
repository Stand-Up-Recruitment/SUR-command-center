import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { TimeFramePicker } from '../shared/TimeFramePicker';
import { Skeleton } from '../shared/Skeleton';
import { C, PACE_COLOR, NUM_FONT, CARD, LABEL, TODO } from '../shared/v2Theme';
import { Chip, Section, Tag, Big, Tile, Line } from '../shared/v2Layout';
import {
  useRecruiterKPIs, useJobAging, useVoiceCallKPIs, useJobAdderStageKPIs, useStageCohorts, useRecruitmentSettings, useSaveRecruitmentSettings, usePlacementPlan,
} from '../../hooks/queries';
import { COLORS } from '../../styles/tokens';
import { useAuthRole } from '../auth/AuthContext';
import {
  DEFAULT_RECRUITMENT_SETTINGS, hiringTrigger, teamRecruiters, placementTargetFor, tierFor, teamBreakeven as breakevenFor,
  biggestBreak, todaysActions, recruitmentBoard, firstName, shouldWeHire, botLooksOff, SHOW_UP_TARGET, STALE_LIMIT,
  type ActionLevel,
} from '../../lib/recruitment';
import { workingDays, neededByToday, pace, PACE_LABEL, type Pace } from '../../lib/workingDays';
import type { Cohort, RecruitmentSettings, TimeFrame } from '../../types';

// Layout and colours follow the "Recruitment tab v2" mockup (Claude Design, 19 Nov 2026).

const fmt1 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const LEVEL_TONE: Record<ActionLevel, Pace | 'blue'> = { 'FIX NOW': 'red', 'THIS WEEK': 'amber', '1:1': 'blue', 'WATCH': 'grey' };

function RecruiterSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Skeleton height={40} width={260} />
      <Skeleton height={160} radius={12} />
      <div style={{ display: 'flex', gap: 12 }}>
        {[0, 1, 2, 3].map(i => <Skeleton key={i} height={110} radius={12} style={{ flex: 1 }} />)}
      </div>
      <Skeleton height={120} radius={12} />
      <Skeleton height={320} radius={12} />
    </div>
  );
}

const SIX_MONTHS_MS = 182 * 86_400_000;

function RecruitmentSettingsPanel({ settings, onClose }: { settings: RecruitmentSettings; onClose: () => void }) {
  const save = useSaveRecruitmentSettings();
  const [maxJobs, setMaxJobs] = useState(String(settings.maxActiveJobs));
  const [ramp, setRamp] = useState(String(settings.rampWeeks));
  const [buffer, setBuffer] = useState(String(settings.bufferWeeks));
  const [recruiters, setRecruiters] = useState(settings.recruiters.map(r => ({ name: r.name, startDate: r.startDate ?? '' })));
  const [password, setPassword] = useState('');
  const input: CSSProperties = { background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.textPrimary, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box', colorScheme: 'dark' };
  const label: CSSProperties = { fontSize: 11, color: COLORS.textMuted };
  const smallButton: CSSProperties = { fontSize: 12, padding: '6px 12px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.textSecondary, cursor: 'pointer' };
  const setRecruiter = (i: number, patch: Partial<{ name: string; startDate: string }>) =>
    setRecruiters(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = () => {
    save.mutate(
      {
        settings: {
          maxActiveJobs: Number(maxJobs),
          rampWeeks: Number(ramp),
          bufferWeeks: Number(buffer),
          recruiters: recruiters
            .filter(r => r.name.trim())
            .map(r => ({ name: r.name.trim(), startDate: r.startDate || null })),
        },
        adminPassword: password,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '1.25rem', width: 440, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 14 }}>Recruitment settings</div>
        <label style={label}>Max active jobs per recruiter</label>
        <input style={{ ...input, margin: '4px 0 12px' }} type="number" min={1} step={1} value={maxJobs} onChange={e => setMaxJobs(e.target.value)} />
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Ramp (weeks)</label>
            <input style={{ ...input, margin: '4px 0 12px' }} type="number" min={0} step={1} value={ramp} onChange={e => setRamp(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>Buffer (weeks)</label>
            <input style={{ ...input, margin: '4px 0 12px' }} type="number" min={0} step={1} value={buffer} onChange={e => setBuffer(e.target.value)} />
          </div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, margin: '6px 0 4px' }}>Recruiters</div>
        <div style={{ ...label, marginBottom: 8 }}>
          Sets headcount for job slots. Name must match their JobAdder first name. Start date shows for their first 6 months.
        </div>
        {recruiters.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input style={{ ...input, flex: 1 }} value={r.name} placeholder="Name" onChange={e => setRecruiter(i, { name: e.target.value })} />
            <input style={{ ...input, width: 150 }} type="date" value={r.startDate} onChange={e => setRecruiter(i, { startDate: e.target.value })} />
            <button title="Remove" onClick={() => setRecruiters(rs => rs.filter((_, j) => j !== i))} style={smallButton}>✕</button>
          </div>
        ))}
        <button onClick={() => setRecruiters(rs => [...rs, { name: '', startDate: '' }])} style={{ ...smallButton, marginBottom: 14 }}>+ Add recruiter</button>

        <div><label style={label}>Admin password</label></div>
        <input style={{ ...input, margin: '4px 0 12px' }} type="password" value={password} onChange={e => setPassword(e.target.value)} />
        {save.error && <div style={{ fontSize: 11, color: COLORS.danger, marginBottom: 10 }}>{save.error.message}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={smallButton}>Cancel</button>
          <button onClick={submit} disabled={save.isPending} style={{ ...smallButton, border: 'none', background: COLORS.accent, color: COLORS.textPrimary }}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

const TIMEFRAME_OPTIONS: { value: TimeFrame; label: string }[] = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
];

const BOARD_COLS = '190px 110px 120px 120px 120px 110px minmax(0, 1fr) 210px';
const SOURCER_COLS = '190px 110px 150px 1fr 1fr 210px';
const SOURCER_DAILY_CALLS = 40;

export function RecruiterCard() {
  const [frame, setFrame] = useState<TimeFrame>('month');
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, error, isLoading, isFetching } = useRecruiterKPIs(frame);
  const { data: jobAgingData } = useJobAging();
  const { data: voiceCallData } = useVoiceCallKPIs(frame);
  const { data: jobAdderStageData } = useJobAdderStageKPIs(frame);
  const { data: cohortData } = useStageCohorts(frame);
  const { data: settingsData, error: settingsError, isLoading: settingsLoading } = useRecruitmentSettings();
  const role = useAuthRole();
  const [showSettings, setShowSettings] = useState(false);
  const [now] = useState(Date.now); // page load time; the tab is reloaded daily
  const { plan } = usePlacementPlan();
  const targets = { mustMake: plan.mustMake, breakeven: plan.breakeven };

  if (isLoading || settingsLoading) return <RecruiterSkeleton />;
  if (!data) return null;

  const wd = workingDays(frame, now);
  const period = frame === 'week' ? 'week' : 'month';
  const need = (target: number) => neededByToday(target, wd);

  // Defaults when the settings API is down or answers without settings (e.g. vite dev serves no /api).
  const recruitment: RecruitmentSettings = settingsData?.recruiters ? settingsData : DEFAULT_RECRUITMENT_SETTINGS;
  const settingsWarning = settingsError?.message ?? settingsData?.error;
  const { recruiters, rows, internalTarget } = recruitmentBoard(data, jobAgingData, jobAdderStageData, recruitment, targets, frame, wd);
  const cap = recruitment.maxActiveJobs;

  const placers = rows.filter(r => r.board.kind === 'placer');
  const sourcers = rows.filter(r => r.board.kind === 'sourcer');

  // ── Are we on track? ──
  const teamTarget = recruiters.reduce((s, r) => s + placementTargetFor(r.name, frame, recruiters, targets), 0);
  const teamBreakeven = breakevenFor(frame, targets);
  const placementsNeeded = need(teamTarget);
  const placementsPace = pace(data.placements, placementsNeeded);
  // Run-rate on working days; swap for placements + offers × offer→contract rate once offers are fed.
  const projected = wd.elapsed > 0 ? Math.round((data.placements / wd.elapsed) * wd.total) : null;
  const projectedTone: Pace = projected === null ? 'grey' : projected >= teamTarget ? 'green' : projected >= teamBreakeven ? 'amber' : 'red';
  const fallThroughs = Math.round((data.fallThroughRate / 100) * data.placements);

  // ── Where is it breaking? ──
  const teamInternalTarget = internalTarget * recruiters.length;
  const teamClientTarget = rows.reduce((s, r) => s + r.wit.client, 0);
  // First arrival per application at "CV Submitted to Client" in JobAdder (stage cohorts webhook).
  const cvsSent = cohortData ? cohortData.team.cv : null;
  const cohortFor = (name: string) => cohortData?.byRecruiter.find(c => firstName(c.name) === firstName(name));
  const noShows = recruiters.reduce((s, r) => s + r.noShows, 0);
  const showUpPct = data.internalInterviews + noShows > 0 ? Math.round((data.internalInterviews / (data.internalInterviews + noShows)) * 100) : null;
  const bot = voiceCallData
    ? { dials: voiceCallData.teamLeads, prev: voiceCallData.prevTeamLeads, expected: (voiceCallData.prevTeamLeads * wd.elapsed) / Math.max(1, wd.total) }
    : null;
  const botOff = botLooksOff(bot);

  // conv = 28-day cohort from this stage to the next one (same applications followed through).
  type Stage = { label: string; value: number | null; needed?: number; need: string; sub: string; tone: Pace; conv?: Cohort };
  const counted = (label: string, value: number, target: number, sub: string): Stage => {
    const needed = need(target);
    return { label, value, needed, need: `Need ${needed} by today`, sub, tone: pace(value, needed) };
  };
  const engine: Stage[] = [
    {
      label: 'BOT · LEADS DIALLED', value: bot?.dials ?? null, tone: bot === null ? 'grey' : botOff ? 'red' : 'green',
      need: bot === null ? 'No bot data' : botOff ? 'Bot looks OFF' : 'Bot is ON',
      sub: voiceCallData ? `Last ${period} ${voiceCallData.prevTeamLeads.toLocaleString()} · ${voiceCallData.teamAnswered} answered · ${voiceCallData.teamBooked} booked` : 'Bot stats unavailable',
    },
    { ...counted('INTERNAL INTERVIEWS HELD', data.internalInterviews, teamInternalTarget,
      showUpPct === null ? 'Show-up: no data' : `Show-up ${showUpPct}% (target ${SHOW_UP_TARGET}%)`), conv: cohortData?.team.cohorts.internalToCv },
    { label: 'CVS SENT TO CLIENTS', value: cvsSent, tone: 'grey', need: cvsSent === null ? 'No data' : 'No target yet', sub: 'Applications reaching CV Submitted in JobAdder · target after 4 weeks', conv: cohortData?.team.cohorts.cvToClient },
    { ...counted('CLIENT INTERVIEWS', data.clientInterviews, teamClientTarget, `${period === 'week' ? 'Week' : 'Month'} target ${teamClientTarget}`), conv: cohortData?.team.cohorts.clientToPlaced },
    counted('PLACEMENTS', data.placements, teamTarget, `${period === 'week' ? 'Week' : 'Month'} target ${Math.round(teamTarget)}`),
  ];
  const breakStage = engine
    .filter(s => s.needed && s.value !== null && s.value / s.needed < 1)
    .sort((a, b) => a.value! / a.needed! - b.value! / b.needed!)[0];
  const stageName: Record<string, string> = { 'INTERNAL INTERVIEWS HELD': 'Internal interviews', 'CLIENT INTERVIEWS': 'Client interviews', 'PLACEMENTS': 'Placements' };
  const breakText = !breakStage ? null
    : breakStage.label === 'INTERNAL INTERVIEWS HELD'
      ? `Top of the funnel. ${botOff ? 'Bot looks off, so internal' : 'Internal'} interviews are ${breakStage.value} done vs ${breakStage.needed} needed by today.`
      : `${stageName[breakStage.label]}: ${breakStage.value} done vs ${breakStage.needed} needed by today.`;

  // ── Job desk ──
  const jobsKnown = jobAgingData ? { stale: jobAgingData.stale, open: jobAgingData.totalOpenJobs } : null;
  const stalePct = jobsKnown && jobsKnown.open ? Math.round((jobsKnown.stale / jobsKnown.open) * 100) : null;
  const staleLimit = jobsKnown ? Math.floor((jobsKnown.open * STALE_LIMIT) / 100) : null;
  const jobsOnBoard = rows.reduce((s, r) => s + r.jobs.totalOpenJobs, 0);
  const offBoardJobs = jobsKnown ? jobsKnown.open - jobsOnBoard : 0;
  const netNewPerWeek = jobAgingData ? hiringTrigger(jobAgingData, recruitment).growthPerWeek : null;
  const emptyDesks = placers.filter(r => r.jobs.totalOpenJobs === 0);
  const hire = shouldWeHire(
    jobAgingData ? { jobs: placers.reduce((s, r) => s + r.jobs.totalOpenJobs, 0), people: placers.length, empty: emptyDesks.length } : null,
    jobsKnown, netNewPerWeek,
  );
  const hireAdvice = hire.hire ? 'All three tests pass.'
    : [
      emptyDesks.length && `Give ${emptyDesks.map(r => r.stat.name).join(' and ')} jobs`,
      hire.tests[1].pass === false && 'clean the stale desk',
    ].filter(Boolean).join(' and ').replace(/^./, c => c.toUpperCase()) + (emptyDesks.length || hire.tests[1].pass === false ? ' first. ' : '') + 'Hire only when all three pass.';
  const loadScale = Math.max(cap * 3, ...rows.map(r => r.jobs.totalOpenJobs));
  const loadColor = (n: number) => (n === 0 ? C.greyFill : n >= cap ? C.red : n >= cap - 2 ? C.amber : C.green);

  // ── Today's actions ──
  const actions = todaysActions({ rows: rows.map(r => r.board), team: data.rolling, cap, jobs: jobsKnown, showUpPct, bot, period });

  const roleLabel = (name: string) => {
    const startDate = recruitment.recruiters.find(r => firstName(r.name) === firstName(name))?.startDate;
    const started = startDate && now - new Date(`${startDate}T00:00:00`).getTime() <= SIX_MONTHS_MS
      ? `started ${new Date(`${startDate}T00:00:00`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}` : null;
    return [tierFor(name)?.tier ?? 'Placer', started].filter(Boolean).join(' · ');
  };

  // ── Trend: team placements per month, months with data only ──
  const everyone = teamRecruiters(data, jobAgingData); // includes people who have left, so history stays whole
  const trend = data.months
    .map((month, i) => ({ month, value: everyone.some(r => r.monthlyPlacements[i] != null) ? everyone.reduce((s, r) => s + (r.monthlyPlacements[i] ?? 0), 0) : null }))
    .filter((t): t is { month: string; value: number } => t.value !== null)
    .filter((_, i, all) => all.slice(0, i + 1).some(x => x.value > 0)); // drop leading empty months
  const monthlyTarget = recruiters.reduce((s, r) => s + placementTargetFor(r.name, 'month', recruiters, targets), 0);
  const monthlyBreakeven = breakevenFor('month', targets);
  const trendMax = Math.max(monthlyTarget, ...trend.map(t => t.value), 1);
  const barH = (v: number) => Math.round((v / trendMax) * 210);

  const doneNeed = (s: { done: number; needed: number }, size = 20) => (
    <span style={{ fontFamily: NUM_FONT, fontSize: size, fontWeight: 700, color: PACE_COLOR[pace(s.done, s.needed)] }}>{s.done} / {s.needed}</span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, color: C.text }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ margin: 0, fontFamily: NUM_FONT, fontSize: 34, fontWeight: 700, letterSpacing: '-0.5px' }}>Recruitment</h1>
          <p style={{ margin: 0, fontSize: 14, color: C.muted }}>
            {new Date(now).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Pacific/Auckland' }).replace(',', '')}
            {' · '}Working day {wd.elapsed} of {wd.total} · Targets below are what we should have done by today
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isFetching && (
            <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${C.border}`, borderTopColor: COLORS.accent, animation: 'spin 0.7s linear infinite' }} />
          )}
          {role === 'admin' && (
            <button onClick={() => setShowSettings(true)} title="Recruitment settings" aria-label="Recruitment settings" style={{ height: 44, background: C.card, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, padding: '0 14px', fontSize: 15, cursor: 'pointer' }}>⚙</button>
          )}
          <TimeFramePicker value={frame} onChange={setFrame} options={TIMEFRAME_OPTIONS} />
        </div>
      </header>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {settingsWarning && <p style={{ color: C.amber, fontSize: 12, margin: 0 }}>⚠ Recruitment settings — {settingsWarning} (using defaults)</p>}
      {error && <p style={{ color: C.amber, fontSize: 12, margin: 0 }}>⚠ Connection error — {error.message}</p>}

      {/* Today's actions */}
      <Section title="Today’s actions" aside="Who to talk to and what about · auto-built from the numbers below">
        <div style={{ ...CARD, overflow: 'hidden' }}>
          {actions.length === 0 && <div style={{ padding: '16px 20px', fontSize: 14, color: C.muted }}>Nothing flagged today.</div>}
          {actions.map((a, i) => (
            <div key={i} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, padding: '16px 20px', borderBottom: i < actions.length - 1 ? `1px solid ${C.rowBorder}` : undefined }}>
              <Chip tone={LEVEL_TONE[a.level]} width={84}>{a.level}</Chip>
              <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{a.who}<span style={{ color: C.faint }}> · </span>{a.title}</div>
                <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.45 }}>{a.detail}</div>
              </div>
              <div style={{ ...TODO, flex: '0 1 260px', fontSize: 14, padding: '10px 12px' }}>{a.action}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Are we on track? */}
      <Section title="Are we on track?" aside={<Tag bg={C.soft}>RESULT · THIS {period.toUpperCase()}</Tag>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <Tile label="PLACEMENTS" chip={<Chip tone={placementsPace}>{PACE_LABEL[placementsPace]}</Chip>}>
            <Big value={data.placements} color={PACE_COLOR[placementsPace]} unit="placed" />
            <Line>Need <strong>{placementsNeeded}</strong> by today · <strong>{Math.round(teamTarget)}</strong> by {period} end</Line>
            <Line muted>{data.placements >= placementsNeeded ? `${data.placements - placementsNeeded} ahead of where we should be` : `${placementsNeeded - data.placements} behind where we should be`}</Line>
          </Tile>
          <Tile label={`PROJECTED ${period.toUpperCase()} END`} chip={<Chip tone={projectedTone}>{projectedTone === 'grey' ? 'NO DATA' : projectedTone === 'green' ? 'ON TARGET' : projectedTone === 'amber' ? 'MAKING MONEY' : 'LOSING MONEY'}</Chip>}>
            <Big value={projected ?? '—'} color={PACE_COLOR[projectedTone]} unit="placements" />
            <Line>Breakeven <strong>{fmt1(teamBreakeven)}</strong> · Target <strong>{Math.round(teamTarget)}</strong></Line>
            <Line muted>{projected === null ? 'No working days yet' : projected >= teamTarget ? 'On course for target' : projected >= teamBreakeven ? `Above breakeven, ${Math.round(teamTarget) - projected} short of target` : 'Below breakeven at today’s rate'}</Line>
          </Tile>
          <Tile label="IN FLIGHT" chip={<Chip tone="grey">NO DATA YET</Chip>}>
            <Big value="[ ]" color={C.faint} unit="at offer stage" />
            <Line>What can still land this {period}</Line>
            <Line muted>Needs offer stage feed from JobAdder</Line>
          </Tile>
          <Tile label="FALL-THROUGHS" chip={data.placements === 0 ? <Chip tone="grey">NO DATA</Chip> : <Chip tone={fallThroughs ? 'red' : 'green'}>{fallThroughs ? 'REVIEW' : 'ON TRACK'}</Chip>}>
            <Big value={data.placements === 0 ? '—' : fallThroughs} color={data.placements === 0 ? C.faint : fallThroughs ? C.red : C.green} unit={`of ${data.placements} placed`} />
            <Line>Contracts that didn’t stick</Line>
            <Line muted>Grey when there are no placements</Line>
          </Tile>
        </div>
      </Section>

      {/* Where is it breaking? */}
      <Section title="Where is it breaking?" aside={<Tag bg={C.blue}>THE ENGINE · DRIVES NEXT {period.toUpperCase()}</Tag>}>
        {breakText && (
          <div style={{ background: '#2A1414', border: '1px solid #6B2522', borderRadius: 14, padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'center' }}>
            <Chip tone="red">BIGGEST BREAK</Chip>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{breakText}</span>
          </div>
        )}
        <div style={{ ...CARD, padding: 20, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'stretch' }}>
          {engine.map((s, i) => {
            const next = engine[i + 1];
            const conv = s.conv && s.conv.n > 0 ? Math.round((s.conv.converted / s.conv.n) * 100) : null;
            return (
              <div key={s.label} style={{ flex: '1 1 170px', minWidth: 0, display: 'flex', gap: 10, alignItems: 'stretch' }}>
                <div style={{ flex: '1 1 auto', minWidth: 0, background: C.inset, border: `1px solid ${s.tone === 'red' ? '#6B2522' : C.border}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.muted, letterSpacing: '0.4px' }}>{s.label}</span>
                  <span style={{ fontFamily: NUM_FONT, fontSize: 38, fontWeight: 700, lineHeight: 1, color: s.value === null ? C.faint : PACE_COLOR[s.tone] }}>{s.value === null ? '[ ]' : s.value.toLocaleString()}</span>
                  <span style={{ fontSize: 14 }}>{s.need}</span>
                  <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.4 }}>{s.sub}</span>
                </div>
                {next && (
                  <div title={conv !== null ? `${s.conv!.converted} of ${s.conv!.n} applications that reached this stage in the last 28 days reached the next` : 'Not tracked stage to stage yet'} style={{ flex: '0 0 56px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: conv !== null ? C.soft : C.faint }}>{conv !== null ? `${conv}%` : '[ ]'}</span>
                    <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true"><path d="M1 6h24M20 1l5 5-5 5" fill="none" stroke={C.faint} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span style={{ fontSize: 11, color: C.faint }}>{conv !== null ? `${s.conv!.converted} of ${s.conv!.n}` : 'convert'}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
          Conversions follow the same applications from one JobAdder status to the next, for those that reached the first one in the last 28 days,
          so they can never go above 100%. They only see stages the team sets in JobAdder. The weakest stage against today’s number is flagged as the biggest break.
        </p>
      </Section>

      {/* Job desk */}
      <Section title="Job desk" aside="Are jobs with the right people, and are they alive?">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          <div style={{ ...CARD, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={LABEL}>JOB LOAD · CAP {cap} EACH</span>
              <span style={{ fontSize: 12, color: C.muted }}>jobs · stale</span>
            </div>
            {[...rows].sort((a, b) => b.jobs.totalOpenJobs - a.jobs.totalOpenJobs).map(r => {
              const n = r.jobs.totalOpenJobs;
              return (
                <div key={r.stat.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ flex: '0 0 64px', fontSize: 14, fontWeight: 600 }}>{r.stat.name}</span>
                  <div style={{ flex: '1 1 auto', height: 12, background: C.track, borderRadius: 6, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${n === 0 ? 3 : Math.min(1, n / loadScale) * 100}%`, background: loadColor(n), borderRadius: 6 }} />
                    <div style={{ position: 'absolute', left: `${(cap / loadScale) * 100}%`, top: 0, bottom: 0, width: 2, background: C.text }} />
                  </div>
                  <span style={{ flex: '0 0 72px', textAlign: 'right', fontSize: 14, fontWeight: 600, color: n === 0 ? C.muted : n >= cap ? C.red : C.text }}>{n} · {r.jobs.stale}</span>
                </div>
              );
            })}
            <p style={{ margin: 0, fontSize: 12, color: C.muted }}>White line = cap of {cap}. Grey = empty desk.</p>
            {offBoardJobs > 0 && <p style={{ margin: 0, fontSize: 12, color: C.amber }}>⚠ {offBoardJobs} open jobs aren’t on a recruiter (unassigned or owned by non-recruiters).</p>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ ...CARD, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={LABEL}>STALE JOBS (36+ DAYS)</span>
                {stalePct === null ? <Chip tone="grey">NO DATA</Chip> : <Chip tone={stalePct < STALE_LIMIT ? 'green' : 'red'}>{stalePct < STALE_LIMIT ? 'ON TRACK' : 'OFF TRACK'}</Chip>}
              </div>
              <Big value={jobsKnown?.stale ?? '—'} color={stalePct === null ? C.faint : stalePct < STALE_LIMIT ? C.green : C.red} unit={jobsKnown ? `of ${jobsKnown.open} open jobs` : undefined} size={44} />
              <div style={{ fontSize: 14 }}>{staleLimit === null ? 'No job data' : `Target: under ${staleLimit} (${STALE_LIMIT}%)`}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
              <div style={{ ...CARD, padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>NET NEW JOBS / WEEK</span>
                <span style={{ fontFamily: NUM_FONT, fontSize: 28, fontWeight: 700, color: netNewPerWeek === null ? C.faint : C.text }}>
                  {netNewPerWeek === null ? '[ ]' : `${netNewPerWeek > 0 ? '+' : ''}${netNewPerWeek.toFixed(1)}`}
                </span>
                <span style={{ fontSize: 12, color: C.muted }}>Opened minus closed{netNewPerWeek === null ? ' · needs feed' : ' · 4-week average'}</span>
              </div>
              <div style={{ ...CARD, padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>DEAD JOBS</span>
                <span style={{ fontFamily: NUM_FONT, fontSize: 28, fontWeight: 700, color: !cohortData ? C.faint : cohortData.deadJobs.length ? C.red : C.green }}>
                  {cohortData ? cohortData.deadJobs.length : '[ ]'}
                </span>
                <span style={{ fontSize: 12, color: C.muted }}>No CV sent in 7 days (open 7+ days){cohortData ? ' · re-brief or close' : ' · no data'}</span>
              </div>
            </div>
          </div>

          <div style={{ ...CARD, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span style={LABEL}>SHOULD WE HIRE?</span>
            {hire.tests.map(t => (
              <div key={t.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Chip tone={t.pass === null ? 'grey' : t.pass ? 'green' : 'red'} width={52}>{t.pass === null ? 'N/A' : t.pass ? 'PASS' : 'FAIL'}</Chip>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{t.label}</span>
                  <span style={{ fontSize: 13, color: C.muted }}>{t.now}</span>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 4, background: C.inset, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: hire.hire ? C.green : C.amber }}>{hire.hire ? 'Hire' : 'Don’t hire yet'}</span>
              <span style={{ fontSize: 13, color: C.soft, lineHeight: 1.45 }}>{hireAdvice}</span>
            </div>
          </div>
        </div>
      </Section>

      {/* Who do I talk to? */}
      <Section title="Who do I talk to?" aside="Each number shows done / needed by today · tap a name for detail">
        <div style={{ ...CARD, overflowX: 'auto' }}>
          <div style={{ minWidth: 1180 }}>
            <div style={{ display: 'grid', gridTemplateColumns: BOARD_COLS, gap: 12, padding: '14px 20px', borderBottom: `1px solid ${C.border}`, ...LABEL, fontSize: 12 }}>
              <span>PLACER</span><span>STATUS</span><span>PLACED</span><span>CLIENT INT.</span><span>INTERNAL INT.</span><span>JOBS · STALE</span><span>BIGGEST BREAK</span><span>ACTION</span>
            </div>
            {placers.map(r => {
              const b = biggestBreak(r.board, data.rolling);
              const p = pace(r.board.placements.done, r.board.placements.needed);
              const isOpen = expanded === r.stat.name;
              const n = r.jobs.totalOpenJobs;
              const showUp = r.stat.internalInterviews + r.stat.noShows > 0
                ? `${Math.round((r.stat.internalInterviews / (r.stat.internalInterviews + r.stat.noShows)) * 100)}%` : '—';
              const detail = (value: ReactNode, label: string) => (
                <div style={{ minWidth: 110 }}>
                  <div style={{ fontFamily: NUM_FONT, fontSize: 18, fontWeight: 700 }}>{value}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{label}</div>
                </div>
              );
              return (
                <div key={r.stat.name} style={{ borderBottom: `1px solid ${C.rowBorder}`, background: isOpen ? C.inset : undefined }}>
                  <div style={{ display: 'grid', gridTemplateColumns: BOARD_COLS, gap: 12, padding: '16px 20px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <button onClick={() => setExpanded(isOpen ? null : r.stat.name)} aria-expanded={isOpen}
                        style={{ all: 'unset', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: C.text }}>
                        {r.stat.name} <span style={{ fontSize: 11, color: C.faint }}>{isOpen ? '▾' : '▸'}</span>
                      </button>
                      <span style={{ fontSize: 12, color: C.muted }}>{roleLabel(r.stat.name)}</span>
                    </div>
                    <Chip tone={p}>{PACE_LABEL[p]}</Chip>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {doneNeed(r.board.placements, 22)}
                      <span style={{ fontSize: 12, color: C.muted }}>{Math.round(r.placementTarget * 10) / 10} for {period}</span>
                    </div>
                    {doneNeed(r.board.client)}
                    {doneNeed(r.board.internal)}
                    <span style={{ fontFamily: NUM_FONT, fontSize: 20, fontWeight: 700, color: n === 0 || n >= cap ? C.red : C.green }}>{n} · {r.jobs.stale}</span>
                    <span style={{ fontSize: 14, lineHeight: 1.4, color: b ? C.text : C.muted }}>{b?.detail ?? 'Nothing below par.'}</span>
                    <span style={TODO}>{b?.action ?? 'Keep going'}</span>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '0 20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.blue }}>
                        ◎ What it takes: {r.wit.internal} internal · {r.wit.client} client interviews for {Math.round(r.placementTarget * 10) / 10} placements
                        <span style={{ fontWeight: 400, color: C.muted }}> · 4-month rates {Math.round(r.wit.i2c * 100)}% int → client · {Math.round(r.wit.c2c * 100)}% client → contract</span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        {detail(r.stat.phoneInterviews, 'Manual calls')}
                        {detail(r.stat.internalInterviewsBotBooked ?? '—', 'Internals bot-booked')}
                        {detail(cohortFor(r.stat.name)?.cv ?? '—', 'CVs sent')}
                        {detail(r.stat.referenceChecks ?? '—', 'Reference checks')}
                        {detail(showUp, `Show-up · ${r.stat.noShows} no-shows`)}
                        {detail(r.stat.placements === 0 ? '—' : `${r.stat.fallThroughRate}%`, 'Fall-through')}
                        {detail(r.stat.placements3m, 'Placed, last 3 months')}
                        {detail(r.stat.prevPlacements, `Placed last ${period}`)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {sourcers.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: SOURCER_COLS, gap: 12, padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: '#17181B', ...LABEL, fontSize: 12 }}>
                <span>SOURCER</span><span>STATUS</span><span>CALLS</span><span>INTERVIEWS BOOKED FOR PLACERS</span><span>SOURCED CVS SENT</span><span>ACTION</span>
              </div>
            )}
            {sourcers.map(r => {
              const tier = tierFor(r.stat.name);
              const subsTarget = tier?.next?.submissions;
              const subs = subsTarget ? { done: r.stat.sourcedSubmissions, needed: need(subsTarget) } : null;
              const p = subs ? pace(subs.done, subs.needed) : 'grey';
              const callsNeeded = SOURCER_DAILY_CALLS * wd.elapsed;
              const callsPace = pace(r.stat.phoneInterviews, callsNeeded);
              return (
                <div key={r.stat.name} style={{ display: 'grid', gridTemplateColumns: SOURCER_COLS, gap: 12, padding: '16px 20px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{r.stat.name}</span>
                    <span style={{ fontSize: 12, color: C.muted }}>{tier?.tier ?? 'Sourcer'}</span>
                  </div>
                  <Chip tone={p}>{PACE_LABEL[p]}</Chip>
                  <span style={{ fontFamily: NUM_FONT, fontSize: 20, fontWeight: 700, color: PACE_COLOR[callsPace] }}>
                    {r.stat.phoneInterviews} / {callsNeeded}
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.muted }}> · {SOURCER_DAILY_CALLS}/day</span>
                  </span>
                  <span style={{ fontFamily: NUM_FONT, fontSize: 20, fontWeight: 700, color: C.faint }}>
                    [target] <span style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>needs a number</span>
                  </span>
                  <span style={{ fontFamily: NUM_FONT, fontSize: 20, fontWeight: 700, color: subs ? PACE_COLOR[p] : C.faint }}>
                    {subs ? `${subs.done} / ${subs.needed}` : r.stat.sourcedSubmissions}
                    {subsTarget && <span style={{ fontSize: 13, fontWeight: 500, color: C.muted }}> · {subsTarget} for {tier?.next?.tier}</span>}
                  </span>
                  <span style={TODO}>Set daily sourcing target</span>
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Trend */}
      <Section title="Trend" aside="Team placements per month · weekly once the feed allows">
        <div style={{ ...CARD, padding: '24px 20px 20px' }}>
          <div style={{ position: 'relative', height: 220, display: 'flex', alignItems: 'flex-end', gap: 16, padding: '0 104px 0 8px', borderBottom: `1px solid ${C.greyFill}` }}>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: barH(monthlyTarget), borderTop: `2px dashed ${C.green}` }} />
            <span style={{ position: 'absolute', right: 0, bottom: barH(monthlyTarget) + 4, fontSize: 12, color: C.green, fontWeight: 600 }}>Target {Math.round(monthlyTarget)}</span>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: barH(monthlyBreakeven), borderTop: `2px dashed ${C.amber}` }} />
            <span style={{ position: 'absolute', right: 0, bottom: barH(monthlyBreakeven) + 4, fontSize: 12, color: C.amber, fontWeight: 600 }}>Breakeven {fmt1(monthlyBreakeven)}</span>
            {trend.map((t, i) => {
              const current = i === trend.length - 1;
              const color = t.value >= monthlyTarget ? C.green : t.value >= monthlyBreakeven ? C.soft : C.red;
              return (
                <div key={t.month} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 6, height: '100%' }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{current ? `${t.value} so far` : t.value}</span>
                  <div style={{ width: '60%', maxWidth: 64, height: barH(t.value), background: current ? 'transparent' : color, border: current ? `2px dashed ${C.soft}` : 'none', borderRadius: '6px 6px 0 0', boxSizing: 'border-box' }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, padding: '8px 104px 0 8px' }}>
            {trend.map(t => <span key={t.month} style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center', fontSize: 12, color: C.muted }}>{t.month}</span>)}
          </div>
        </div>
      </Section>

      <footer style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px', fontSize: 13, color: C.muted, borderTop: `1px solid ${C.border}`, paddingTop: 18 }}>
        <span><strong style={{ color: C.green }}>Green</strong> at or ahead of today’s number</span>
        <span><strong style={{ color: C.amber }}>Amber</strong> 75–99% of today’s number</span>
        <span><strong style={{ color: C.red }}>Red</strong> under 75%</span>
        <span><strong style={{ color: C.soft }}>Grey</strong> no activity or no data</span>
      </footer>

      {showSettings && <RecruitmentSettingsPanel settings={recruitment} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
