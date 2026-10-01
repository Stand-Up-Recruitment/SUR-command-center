import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { TimeFramePicker } from '../shared/TimeFramePicker';
import { Skeleton } from '../shared/Skeleton';
import {
  useRecruiterKPIs, useJobAging, useVoiceCallKPIs, useJobAdderStageKPIs, useRecruitmentSettings, useSaveRecruitmentSettings,
} from '../../hooks/queries';
import { timeBoundaries } from '../../services/airtable';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import { PlacementsTrendChart } from '../shared/PlacementsTrendChart';
import { useAuthRole } from '../auth/AuthContext';
import { DEFAULT_RECRUITMENT_SETTINGS, hiringTrigger, type HiringState } from '../../lib/recruitment';
import type { DepartmentStatus, RecruiterStat, RecruitmentSettings, RollingRates, TimeFrame } from '../../types';

// Breakeven cost model — update these when Les's costs change (same pattern as
// RECRUITER_COUNT in services/airtable.ts's LTGP calc).
const TOTAL_WEEKLY_OVERHEAD = 14000;   // NZD/week, manual input owned by Les
const RECRUITER_WEEKLY_SALARY = 1442;  // NZD/week, ~$75k/year baseline
const AVG_FEE_PER_PLACEMENT = 20000;   // NZD, blended flat-fee/% average
const WEEKS_PER_MONTH = 4.33;

// Monthly placement targets per recruiter (by first name); anyone not listed gets the default.
const PLACEMENT_TARGETS_MONTHLY: Record<string, number> = { ayn: 4, ian: 4, kade: 2, lionel: 2 };
const DEFAULT_PLACEMENT_TARGET_MONTHLY = 2;
// 4 internal interviews a day per recruiter → 20/week, 80/month.
const INTERNAL_TARGET_WEEKLY = 20;
const INTERNAL_TARGET_MONTHLY = 80;

// "What it takes" line colours (blue info band, per the mockup).
const WIT_BG = 'rgba(55,138,221,0.14)';
const WIT_BORDER = 'rgba(55,138,221,0.45)';
const WIT_TEXT = '#6aa9ec';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const DAY_MS = 86_400_000;

const pct = (numerator: number, denominator: number) =>
  denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

const fmtTarget = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// Green at/above target · orange below target but above breakeven (or activity 75–99%)
// · red below breakeven (or activity under 75%).
const rag = (value: number, target: number, breakeven = target * 0.75) =>
  value >= target ? COLORS.success : value >= breakeven ? COLORS.warning : COLORS.danger;

// Client interviews needed = placement target ÷ 4-month client → contract rate; internal
// needed = client needed ÷ 4-month int → client rate; both rounded up. A rate of 0 (no data
// in the window) falls back to the team's rate for that step.
function whatItTakes(placementTarget: number, own: RollingRates, team: RollingRates) {
  const c2c = own.clientToContract || team.clientToContract;
  const i2c = own.intToClient || team.intToClient;
  const ceil = (n: number) => Math.ceil(n - 1e-9); // guard float noise, e.g. 7.0000000001
  const client = c2c > 0 ? ceil(placementTarget / c2c) : 0;
  const internal = i2c > 0 ? ceil(client / i2c) : 0;
  return {
    client, internal, c2c, i2c,
    teamRateUsed: !own.clientToContract || !own.intToClient,
    limitedData: own.monthsOfData < 4,
  };
}

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

const HIRING_STYLE: Record<HiringState, { bg: string; border: string; text: string }> = {
  'hire-now':  { bg: COLORS.dangerBg, border: COLORS.danger, text: COLORS.danger },
  'hire-soon': { bg: COLORS.warningBg, border: COLORS.warning, text: COLORS.warning },
  'ok':        { bg: COLORS.successBg, border: COLORS.success, text: COLORS.success },
  'no-data':   { bg: COLORS.bgSubtle, border: COLORS.border, text: COLORS.textMuted },
};

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
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

export function RecruiterCard() {
  const [frame, setFrame] = useState<TimeFrame>('month');
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, error, isLoading, isFetching } = useRecruiterKPIs(frame);
  const { data: jobAgingData } = useJobAging();
  const { data: voiceCallData } = useVoiceCallKPIs(frame);
  const { data: jobAdderStageData } = useJobAdderStageKPIs(frame);
  const { data: settingsData, error: settingsError, isLoading: settingsLoading } = useRecruitmentSettings();
  const role = useAuthRole();
  const [showSettings, setShowSettings] = useState(false);

  if (isLoading || settingsLoading) return <RecruiterSkeleton />;
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
        clientInterviews: 0, prevClientInterviews: 0, noShows: 0, prevNoShows: 0, placements: 0, prevPlacements: 0,
        fallThroughRate: 0, prevFallThroughRate: 0,
        rolling: { intToClient: 0, clientToContract: 0, monthsOfData: 0 },
        monthlyPlacements: data.months.map(() => null),
      });
    }
  }
  baseRecruiters.sort((a, b) => a.name.localeCompare(b.name));

  // Merge in Voice Call Log + JobAdder pipeline-stage KPIs (separate webhooks) by first name —
  // left as undefined (rendered as "—") when a hook hasn't loaded. A recruiter with no
  // calls in the Voice Call Log dialled 0.
  // Copies each row so the React Query cache isn't mutated.
  const displayRecruiters: RecruiterStat[] = baseRecruiters.map(r => {
    const vc = voiceCallData?.byRecruiter.find(s => firstName(s.name) === firstName(r.name));
    const js = jobAdderStageData?.byRecruiter.find(s => firstName(s.name) === firstName(r.name));
    return {
      ...r,
      ...(voiceCallData && { leadsContactedByBot: vc?.leadsContactedByBot ?? 0 }),
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

  const monthlyPlacementTarget = (name: string) =>
    PLACEMENT_TARGETS_MONTHLY[firstName(name)] ?? DEFAULT_PLACEMENT_TARGET_MONTHLY;
  const placementTargetFor = (name: string) => frame === 'week'
    ? monthlyPlacementTarget(name) / WEEKS_PER_MONTH
    : monthlyPlacementTarget(name);
  const internalTarget = frame === 'week' ? INTERNAL_TARGET_WEEKLY : INTERNAL_TARGET_MONTHLY;

  const targets = new Map(displayRecruiters.map(r => {
    const placement = placementTargetFor(r.name);
    return [r.name, { placement, ...whatItTakes(placement, r.rolling, data.rolling) }];
  }));
  const targetsFor = (name: string) => targets.get(name)!;
  // Team line = sum of the recruiters' lines.
  const teamPlacementTarget = displayRecruiters.reduce((s, r) => s + targetsFor(r.name).placement, 0);
  const teamClientTarget = displayRecruiters.reduce((s, r) => s + targetsFor(r.name).client, 0);
  const teamInternalNeeded = displayRecruiters.reduce((s, r) => s + targetsFor(r.name).internal, 0);
  const teamInternalTarget = internalTarget * liveHeadcount;
  const unassignedJobs = jobAgingData?.unassigned;

  // Hiring trigger + per-recruiter job cap. Falls back to the default settings if the API is down.
  const recruitment = settingsData ?? DEFAULT_RECRUITMENT_SETTINGS;
  const settingsWarning = settingsError?.message ?? settingsData?.error;
  const maxJobs = recruitment.maxActiveJobs;
  const hiring = jobAgingData ? hiringTrigger(jobAgingData, recruitment) : null;
  // Green under max − 2 · amber max − 2 to max − 1 · red at max (full).
  const loadColor = (jobs: number) =>
    jobs >= maxJobs ? COLORS.danger : jobs >= maxJobs - 2 ? COLORS.warning : COLORS.success;
  const startedLabel = (name: string) => {
    const startDate = recruitment.recruiters.find(r => firstName(r.name) === firstName(name))?.startDate;
    if (!startDate) return null;
    const started = new Date(`${startDate}T00:00:00`);
    if (now - started.getTime() > SIX_MONTHS_MS) return null;
    return `started ${started.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

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
  const internalColor = rag(data.internalInterviews, teamInternalTarget);

  // Recruitment bot — team totals summed from the per-recruiter webhooks.
  const sumDefined = (vals: (number | undefined)[]) =>
    vals.some(v => v !== undefined) ? vals.reduce<number>((s, v) => s + (v ?? 0), 0) : undefined;
  const botLeads = sumDefined(displayRecruiters.map(r => r.leadsContactedByBot));
  const prevBotLeads = voiceCallData?.prevTeamLeads;
  // Leads contacted = bot calls dialled (Voice Call Log) + recruiters' own phone interviews
  // (KPI's Recruiter Status = Phone Interview, unique candidates). Bot part counts as 0 until loaded.
  const leadsContacted = (botLeads ?? 0) + data.phoneInterviews;
  const prevLeadsContacted = (prevBotLeads ?? 0) + data.prevPhoneInterviews;
  // Booked = internal interviews that are over (KPI's Recruiter rows): showed + no-shows,
  // unique candidates, bot and manual bookings alike.
  const internalBooked = data.internalInterviews + data.noShows;
  const prevInternalBooked = data.prevInternalInterviews + data.prevNoShows;
  // Show-up rate = showed ÷ (showed + no-shows), per candidate, across all internal
  // interviews (bot and manual). An Internal Interview row is only logged once the candidate
  // leaves that JobAdder status, i.e. after the interview; a miss logs a No Show-up row instead.
  const showUpRate = (showed: number, noShows: number) =>
    showed + noShows > 0 ? pct(showed, showed + noShows) : undefined;
  const showUpPct = showUpRate(data.internalInterviews, data.noShows);

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
          {role === 'admin' && (
            <button onClick={() => setShowSettings(true)} title="Recruitment settings" style={{ background: COLORS.bgCard, color: COLORS.textMuted, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 14, cursor: 'pointer' }}>⚙</button>
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

      {/* Hiring trigger */}
      {hiring && (() => {
        const s = HIRING_STYLE[hiring.state];
        const full = hiring.activeJobs >= hiring.slots;
        const title =
          full ? 'Hire now · team full'
          : hiring.state === 'no-data' ? 'Hiring trigger · growth data unavailable'
          : hiring.weeksUntilFull === null ? 'Capacity OK'
          : `${hiring.state === 'hire-now' ? 'Hire now' : hiring.state === 'hire-soon' ? 'Hire soon' : 'Capacity OK'} · ${hiring.weeksUntilFull.toFixed(1)} weeks until full`;
        const g = hiring.growthPerWeek;
        const growthText =
          g === null ? 'Jobs opened/closed not available yet.'
          : g > 0 ? `Jobs growing by ${g.toFixed(1)} a week.`
          : g < 0 ? `Jobs falling by ${Math.abs(g).toFixed(1)} a week.`
          : 'Jobs flat.';
        const over = hiring.activeJobs - hiring.slots;
        return (
          <div style={{
            borderRadius: 12, padding: '16px 22px', background: s.bg, border: `1px solid ${s.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.text }}>{title}</div>
              <div style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 4 }}>
                {hiring.activeJobs} of {hiring.slots} job slots used{over > 0 && ` (${over} over)`}. {growthText}
              </div>
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, textAlign: 'right' }}>
              Hire now at ≤ {hiring.hireNowAt} wks ({recruitment.rampWeeks} ramp + {recruitment.bufferWeeks} buffer)<br />
              {recruitment.recruiters.length} recruiters × {maxJobs} jobs · growth = avg net jobs/week, last 4 weeks
            </div>
          </div>
        );
      })()}
      {settingsWarning && (
        <p style={{ color: COLORS.warning, fontSize: 12, margin: 0 }}>⚠ Recruitment settings — {settingsWarning} (using defaults)</p>
      )}

      {/* Funnel KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr 1fr', gap: 12 }}>
        {kpiTile('Internal Interviews', pill(ragLabel(internalColor), internalColor),
          bigValue(data.internalInterviews, teamInternalTarget, internalColor),
          `Target ${internalTarget} per recruiter · 4/day`, `Last ${periodLabel}: ${data.prevInternalInterviews}`)}
        {connector(internalToClientPct)}
        {kpiTile('Client Interviews', pill(ragLabel(clientColor), clientColor),
          bigValue(data.clientInterviews, teamClientTarget, clientColor),
          'Target from "What it takes"', `Last ${periodLabel}: ${data.prevClientInterviews}`)}
        {connector(clientToContractPct)}
        {kpiTile('Placements', pill(ragLabel(placementColor), placementColor),
          bigValue(data.placements, fmtTarget(teamPlacementTarget), placementColor),
          `Breakeven ${teamBreakeven.toFixed(1)} · projected ${projected}`, `Last ${periodLabel}: ${data.prevPlacements}`)}
        {kpiTile('Stale Jobs (36+ days)', pill(`${stalePct}% stale`, jobsStale > 0 ? COLORS.danger : COLORS.success),
          bigValue(jobsStale, totalOpenJobs, jobsStale > 0 ? COLORS.danger : COLORS.success),
          `${jobsFresh} fresh · ${jobsAgeing} ageing`, 'Clear or re-brief')}
      </div>

      <PlacementsTrendChart
        months={data.months}
        recruiters={displayRecruiters.map(r => ({ ...r, target: monthlyPlacementTarget(r.name) }))}
        breakevenPerRecruiter={breakevenWeekly * WEEKS_PER_MONTH}
      />

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
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1040 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <th style={{ ...th, paddingLeft: 18 }}>Recruiter</th>
                  <th style={th}>Internal int.</th>
                  <th style={th}>Int → client</th>
                  <th style={th}>Client int.</th>
                  <th style={th}>Client → contract</th>
                  <th style={th}>Placements</th>
                  <th style={th}>Fall-through</th>
                  <th style={th}>Active jobs / {maxJobs}</th>
                  <th style={{ ...th, width: '22%' }}>Open jobs</th>
                  <th style={{ ...th, paddingRight: 18 }}>Last {periodLabel}</th>
                </tr>
              </thead>
              <tbody>
                {displayRecruiters.map(r => {
                  const aging = jobAgingFor(r.name);
                  const isOpen = expanded === r.name;
                  const t = targetsFor(r.name);
                  // Manually-booked isn't tracked directly — derived as the remainder of total
                  // internal interviews (Airtable) after subtracting bot bookings (Calendly).
                  const rManualBooked = r.internalInterviewsBotBooked !== undefined
                    ? Math.max(0, r.internalInterviews - r.internalInterviewsBotBooked) : undefined;
                  const rShowUp = showUpRate(r.internalInterviews, r.noShows);
                  const rInternalColor = rag(r.internalInterviews, internalTarget);
                  const rClientColor = rag(r.clientInterviews, t.client);
                  const rPlacementColor = rag(r.placements, t.placement, breakevenPerRecruiter);
                  const rateNote = [
                    t.limitedData && 'limited data',
                    t.teamRateUsed && 'team rate used',
                  ].filter(Boolean).join(', ');

                  return [
                    <tr
                      key={r.name}
                      onClick={() => setExpanded(isOpen ? null : r.name)}
                      style={{ cursor: 'pointer', background: isOpen ? COLORS.bgSubtle : undefined }}
                    >
                      <td style={{ ...td, paddingLeft: 18, fontSize: 16, fontWeight: 800 }}>
                        {r.name} <span style={{ fontSize: 10, color: COLORS.textMuted }}>{isOpen ? '▾' : '▸'}</span>
                        {startedLabel(r.name) && (
                          <div style={{ fontSize: 11, fontWeight: 400, color: COLORS.textMuted, marginTop: 2 }}>{startedLabel(r.name)}</div>
                        )}
                      </td>
                      <td style={td}>{cellValue(r.internalInterviews, internalTarget, rInternalColor)}</td>
                      <td style={pctCell}>{pct(r.clientInterviews, r.internalInterviews)}%</td>
                      <td style={td}>{cellValue(r.clientInterviews, t.client, rClientColor)}</td>
                      <td style={pctCell}>{pct(r.placements, r.clientInterviews)}%</td>
                      <td style={td}>{cellValue(r.placements, fmtTarget(t.placement), rPlacementColor)}</td>
                      <td style={{ ...pctCell, color: r.fallThroughRate === 0 ? COLORS.success : COLORS.danger }}>{r.fallThroughRate}%</td>
                      <td style={td}>{cellValue(aging.totalOpenJobs, maxJobs, loadColor(aging.totalOpenJobs))}</td>
                      <td style={td}>
                        {stackedBar(aging.fresh, aging.ageing, aging.stale)}
                        <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 6 }}>
                          {aging.totalOpenJobs} jobs ·{' '}
                          <strong style={{ color: aging.stale > 0 ? COLORS.danger : COLORS.textPrimary }}>{aging.stale} stale</strong>
                        </div>
                      </td>
                      <td style={{ ...td, paddingRight: 18, fontFamily: MONO, color: COLORS.textSecondary }}>{r.prevPlacements}</td>
                    </tr>,
                    <tr key={`${r.name}-wit`} style={{ borderBottom: isOpen ? undefined : `1px solid ${COLORS.border}` }}>
                      <td colSpan={10} style={{ padding: '0 18px 14px' }}>
                        <div style={{
                          background: WIT_BG, borderRadius: 8, padding: '10px 14px',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: WIT_TEXT }}>
                            ◎ What it takes: {t.internal} internal · {t.client} client interviews for {fmtTarget(t.placement)} placements
                          </span>
                          <span style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: MONO }}>
                            4-mo rates: {Math.round(t.i2c * 100)}% · {Math.round(t.c2c * 100)}%{rateNote && ` (${rateNote})`}
                          </span>
                        </div>
                      </td>
                    </tr>,
                    isOpen && (
                      <tr key={`${r.name}-detail`} style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bgSubtle }}>
                        <td colSpan={10} style={{ padding: '16px 18px' }}>
                          <div style={{ display: 'flex', gap: 16 }}>
                            {miniStat(r.phoneInterviews, 'Manual calls')}
                            {miniStat(rManualBooked ?? '—', 'Internals manually booked')}
                            {miniStat(r.referenceChecks ?? '—', 'Reference checks')}
                            {miniStat(r.candidatesPitched ?? '—', 'Pitched to client')}
                            {miniStat(rShowUp !== undefined ? `${rShowUp}%` : '—', 'Show-up rate',
                              `${r.noShows} no-show${r.noShows === 1 ? '' : 's'}`, rShowUp !== undefined ? rag(rShowUp, 80) : COLORS.textPrimary)}
                          </div>
                        </td>
                      </tr>
                    ),
                  ];
                })}
                {unassignedJobs && unassignedJobs.totalOpenJobs > 0 && (
                  <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ ...td, paddingLeft: 18, fontSize: 16, fontWeight: 800, color: COLORS.textSecondary }}>
                      Unassigned
                      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.danger, marginTop: 2 }}>⚠ Gap: no owner in JobAdder</div>
                    </td>
                    {[0, 1, 2, 3, 4, 5].map(i => <td key={i} style={{ ...td, color: COLORS.textMuted }}>—</td>)}
                    <td style={td}>{cellValue(unassignedJobs.totalOpenJobs, '—', COLORS.danger)}</td>
                    <td style={td}>
                      {stackedBar(unassignedJobs.fresh, unassignedJobs.ageing, unassignedJobs.stale)}
                      <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 6 }}>
                        {unassignedJobs.totalOpenJobs} jobs ·{' '}
                        <strong style={{ color: unassignedJobs.stale > 0 ? COLORS.danger : COLORS.textPrimary }}>{unassignedJobs.stale} stale</strong>
                      </div>
                    </td>
                    <td style={{ ...td, paddingRight: 18, color: COLORS.textMuted }}>—</td>
                  </tr>
                )}
                {hiring && (
                  <tr style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bgSubtle }}>
                    <td style={{ ...td, paddingLeft: 18, fontSize: 16, fontWeight: 800 }}>
                      Team
                      <div style={{ fontSize: 11, fontWeight: 400, color: COLORS.textMuted, marginTop: 2 }}>
                        {recruitment.recruiters.length} recruiters{unassignedJobs?.totalOpenJobs ? ' + unassigned' : ''}
                      </div>
                    </td>
                    {[0, 1, 2, 3, 4, 5].map(i => <td key={i} style={{ ...td, color: COLORS.textMuted }}>—</td>)}
                    <td style={td}>{cellValue(hiring.activeJobs, hiring.slots, hiring.state === 'no-data' ? COLORS.textPrimary : HIRING_STYLE[hiring.state].text)}</td>
                    <td style={{ ...td, color: COLORS.textMuted }}>—</td>
                    <td style={{ ...td, paddingRight: 18, color: COLORS.textMuted }}>—</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={10} style={{ padding: '14px 18px 4px' }}>
                    <div style={{ background: WIT_BG, border: `1px solid ${WIT_BORDER}`, borderRadius: 8, padding: '12px 14px' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: WIT_TEXT }}>
                        ◎ TEAM – What it takes: {teamInternalNeeded} internal · {teamClientTarget} client interviews for {fmtTarget(teamPlacementTarget)} placements
                      </span>
                      <span style={{ fontSize: 11, color: COLORS.textSecondary }}> (sum of recruiters)</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 18px', fontSize: 12, color: COLORS.textSecondary }}>
            <strong style={{ color: COLORS.success }}>Green</strong> at or above target ·{' '}
            <strong style={{ color: COLORS.warning }}>Orange</strong> below target, above breakeven (activity 75–99%) ·{' '}
            <strong style={{ color: COLORS.danger }}>Red</strong> below breakeven (activity under 75%)
            <br />
            Active jobs: <strong style={{ color: COLORS.success }}>green</strong> under {maxJobs - 2} ·{' '}
            <strong style={{ color: COLORS.warning }}>amber</strong> {maxJobs - 2}–{maxJobs - 1} ·{' '}
            <strong style={{ color: COLORS.danger }}>red</strong> at {maxJobs} (full)
          </div>
        </div>
      )}

      <p style={{ fontSize: 12, color: COLORS.textMuted, margin: 0, lineHeight: 1.6 }}>
        Calculation: Client interviews needed = placement target ÷ 4-month client → contract rate (round up). Internal needed = client
        needed ÷ 4-month int → client rate (round up). 4-month rates use the last 4 full months; where a recruiter has no rate yet, the
        team rate is used. Client int. target in the row = client interviews needed. Internal int. target stays at {INTERNAL_TARGET_MONTHLY}/month
        ({INTERNAL_TARGET_WEEKLY}/week).
      </p>

      {/* Recruitment bot — team */}
      <div style={{ ...CARD_STYLE, padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={SECTION_LABEL}>Recruitment Bot · Team</span>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {miniStat(leadsContacted, 'Leads contacted', `Bot ${botLeads ?? '—'} · phone interviews ${data.phoneInterviews} · last ${periodLabel}: ${prevLeadsContacted}`, COLORS.textPrimary, 30)}
          {miniStat(internalBooked, 'Internal interviews booked', `Showed + no-shows · last ${periodLabel}: ${prevInternalBooked}`, COLORS.textPrimary, 30)}
          {miniStat(data.noShows, 'No-shows', `Internal interviews missed · last ${periodLabel}: ${data.prevNoShows}`, COLORS.textPrimary, 30)}
          {miniStat(showUpPct !== undefined ? `${showUpPct}%` : '—', 'Show-up rate', 'Showed ÷ booked',
            showUpPct !== undefined ? rag(showUpPct, 80) : COLORS.textPrimary, 30)}
        </div>
      </div>

      {error && (
        <p style={{ color: COLORS.warning, fontSize: 12, margin: 0 }}>⚠ Connection error — {error?.message}</p>
      )}
      {showSettings && <RecruitmentSettingsPanel settings={recruitment} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
