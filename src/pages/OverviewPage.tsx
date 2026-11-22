// Overview v2 (Les's brief, Nov 2026): the CEO view. It calculates nothing a tab doesn't —
// every number, target and action comes from the same function its own tab uses.
import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { C, PACE_COLOR, NUM_FONT, CARD, LABEL } from '../components/shared/v2Theme';
import { Chip, Section } from '../components/shared/v2Layout';
import { Skeleton } from '../components/shared/Skeleton';
import { useAuthRole } from '../components/auth/AuthContext';
import {
  useMarketingMonth, useOrganicMonth, useMarketingSettings, useMetaAdSets, useMarketingDemand, useSalesMonth, useSalesSettings,
  useRecruiterKPIs, useJobAging, useJobAdderStageKPIs, useVoiceCallKPIs, useRecruitmentSettings, useRetentionPlacements, useRetentionSettings,
  useXeroFinanceData, useScheduledInvoices, useClientInvoices, useOverviewSettings, useSaveOverviewSettings, usePlacementPlan,
} from '../hooks/queries';
import { AUD_TO_NZD_APPROX } from '../services/airtable';
import { monthWindow, currentMonthKey, recentMonthKeys, nzDate, addDays } from '../lib/nzTime';
import { workingDays, neededByToday, pace, type Pace } from '../lib/workingDays';
import { marketingActions, countCheck, costCheck, adSetChecks, DEFAULT_SPIKE_RULE } from '../components/departments/marketingMetrics';
import { salesDiagnosis, DEFAULT_TARGET_PER_SALESPERSON } from '../components/departments/salesMetrics';
import { DEFAULT_RECRUITMENT_SETTINGS, recruitmentBoard, todaysActions, STALE_LIMIT, type TodayAction } from '../lib/recruitment';
import { diagnoseRetention } from '../lib/diagnosis';
import { financeSummary, availableCash, forecastWeeklyOutflow, expectedReceipts, NO_HISTORY_DAYS } from '../lib/finance';
import { DEFAULT_PLAN_SETTINGS } from '../lib/placementPlan';
import { summariseRetention, placementFacts, DEFAULT_RETENTION_SETTINGS } from '../lib/retention';
import { avgDaysLateByClient } from '../lib/clientScorecard';
import { companyKey } from '../lib/companyKey';
import { money0, money2 } from '../components/shared/monthTheme';
import type { OverviewSettings } from '../types';

const k = (n: number) => `${n < 0 ? '-' : ''}$${Math.round(Math.abs(n) / 1000)}k`;
const f1 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const day = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
const toneOf = (ratio: number | null): Pace => (ratio == null ? 'grey' : ratio >= 1 ? 'green' : ratio >= 0.75 ? 'amber' : 'red');

// ─── Settings panel ───────────────────────────────────────────────────────────
function SettingsPanel({ settings, onClose }: { settings: OverviewSettings; onClose: () => void }) {
  const save = useSaveOverviewSettings();
  const plan = { ...DEFAULT_PLAN_SETTINGS, ...(settings.planAnnualPlacements ? settings : {}) };
  const [f, setF] = useState({
    annual: String(plan.planAnnualPlacements), fallOver: String(plan.planFallOverPct), year: String(plan.planYear),
    headline: settings.constraintHeadline, detail: settings.constraintDetail, owner: settings.constraintOwner ?? '',
    fixedWhen: settings.constraintFixedWhen ?? '', confirmedBy: settings.confirmedBy, runway: String(settings.runwayWeeksMin ?? 8), password: '',
  });
  const set = (key: keyof typeof f) => (e: { target: { value: string } }) => setF(x => ({ ...x, [key]: e.target.value }));
  const input: CSSProperties = { background: C.inset, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' };
  const field = (label: string, key: keyof typeof f, extra: Record<string, unknown> = {}) => (
    <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 12 }}>
      {label}
      <input style={{ ...input, marginTop: 4 }} value={f[key]} onChange={set(key)} {...extra} />
    </label>
  );
  const submit = () => save.mutate({
    settings: {
      planAnnualPlacements: Number(f.annual), planFallOverPct: Number(f.fallOver), planYear: Number(f.year),
      constraintHeadline: f.headline, constraintDetail: f.detail, constraintOwner: f.owner, constraintFixedWhen: f.fixedWhen,
      confirmedBy: f.confirmedBy, runwayWeeksMin: Number(f.runway),
    },
    adminPassword: f.password,
  }, { onSuccess: onClose });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ ...CARD, padding: '1.25rem', width: 400, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 14 }}>Edit targets</div>
        {field('Annual placement plan (placements made)', 'annual', { type: 'number', min: 1, step: 1 })}
        {field('Planned fall-over (%)', 'fallOver', { type: 'number', min: 0, max: 99, step: 1 })}
        {field('Plan year (1 Jan – 31 Dec)', 'year', { type: 'number', min: 2026, step: 1 })}
        <div style={{ fontSize: 11, color: C.muted, margin: '-4px 0 12px' }}>Every tab's placement targets, breakeven and projected net profit come from this plan.</div>
        {field('Current constraint', 'headline', { placeholder: 'e.g. Internal interviews' })}
        {field('Detail', 'detail', { placeholder: 'e.g. Not enough candidates in front of recruiters' })}
        {field('Fixed when', 'fixedWhen', { placeholder: 'e.g. 80 internal interviews a month' })}
        {field('Owner', 'owner', { placeholder: 'e.g. Sourcers' })}
        {field('Confirmed by', 'confirmedBy', { placeholder: 'e.g. Les' })}
        {field('Cash runway line (weeks)', 'runway', { type: 'number', min: 0, max: 104, step: 1 })}
        <div style={{ fontSize: 11, color: C.muted, margin: '-4px 0 12px' }}>"Can we afford the plan?" turns Tight when runway drops below this in any of the next 3 months.</div>
        {field('Admin password', 'password', { type: 'password' })}
        {save.error && <div style={{ fontSize: 11, color: C.red, marginBottom: 10 }}>{save.error.message}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={save.isPending} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: 'none', background: C.red, color: C.ink, fontWeight: 700, cursor: 'pointer' }}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────
const Owner = ({ name }: { name: string }) => <span style={{ fontSize: 12, color: C.faint }}>Owner · <b style={{ color: C.soft }}>{name}</b></span>;

function Num({ value, tone, size = 34 }: { value: ReactNode; tone: Pace; size?: number }) {
  return <span style={{ fontFamily: NUM_FONT, fontSize: size, fontWeight: 700, color: PACE_COLOR[tone], lineHeight: 1 }}>{value}</span>;
}

function PlanTile({ label, owner, loading, children }: { label: string; owner: string; loading: boolean; children: ReactNode }) {
  return (
    <div style={{ ...CARD, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <span style={LABEL}>{label}</span>
      {loading ? <><Skeleton height={34} width={110} /><Skeleton height={12} width="80%" /></> : children}
      <div style={{ marginTop: 'auto' }}><Owner name={owner} /></div>
    </div>
  );
}

function Bar({ ratio, tone }: { ratio: number | null; tone: Pace }) {
  return (
    <div style={{ height: 6, background: C.track, borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${Math.round(Math.min(1, Math.max(0, ratio ?? 0)) * 100)}%`, height: '100%', background: PACE_COLOR[tone] }} />
    </div>
  );
}

const th: CSSProperties = { textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.muted, padding: '10px 14px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' };
const td: CSSProperties = { fontSize: 14, color: C.text, padding: '10px 14px', borderBottom: `1px solid ${C.rowBorder}`, whiteSpace: 'nowrap' };

// "Who to speak to" card
type Tag = 'Constraint' | 'Activity' | 'Money' | 'Coaching' | 'Retention' | 'Sales';
interface Talk { who: string; tag: Tag; text: string; tab: string; path: string; when: 'Today' | 'This week'; stage?: string }
const TAG_TONE: Record<Tag, Pace | 'blue'> = { Constraint: 'red', Activity: 'amber', Money: 'amber', Coaching: 'blue', Retention: 'grey', Sales: 'grey' };

// ─── Page ─────────────────────────────────────────────────────────────────────
export function OverviewPage() {
  const role = useAuthRole();
  const [showSettings, setShowSettings] = useState(false);
  const [showLocked, setShowLocked] = useState(false);
  const [now] = useState(Date.now); // page load time; the dashboard is reloaded daily
  const today = nzDate(now);
  const month = currentMonthKey(now);
  const w = monthWindow(month, now);
  const wd = workingDays('month', now);

  const rec = useRecruiterKPIs('month');
  const jobsQ = useJobAging();
  const { data: stages } = useJobAdderStageKPIs('month');
  const voiceQ = useVoiceCallKPIs('month');
  const recSettings = useRecruitmentSettings();
  const mkt = useMarketingMonth(month);
  const { data: organic } = useOrganicMonth(month);
  const { data: mktSettings } = useMarketingSettings();
  const adSetQ = useMetaAdSets();
  const { data: demand } = useMarketingDemand();
  const sal = useSalesMonth(month);
  const { data: salSettings } = useSalesSettings();
  const ret = useRetentionPlacements();
  const { data: retSettings } = useRetentionSettings();
  const fin = useXeroFinanceData();
  const schedQ = useScheduledInvoices();
  const { data: clientInvoices } = useClientInvoices();
  const { data: settings } = useOverviewSettings();
  const { plan, ytd } = usePlacementPlan();
  const targets = { mustMake: plan.mustMake, breakeven: plan.breakeven };

  const r = rec.data;
  const jobs = jobsQ.data;
  const voice = voiceQ.data;
  const m = mkt.data;
  const s = sal.data;
  const x = fin.data;

  // ── Recruitment board (same function as the Recruitment tab) ──
  const recruitment = recSettings.data?.recruiters ? recSettings.data : DEFAULT_RECRUITMENT_SETTINGS;
  const board = r ? recruitmentBoard(r, jobs, stages, recruitment, targets, 'month', wd) : null;
  const need = (n: number) => neededByToday(n, wd);
  const teamTarget = board ? board.rows.reduce((t, row) => t + row.placementTarget, 0) : plan.mustMake;
  const projected = r && wd.elapsed > 0 ? Math.round((r.placements / wd.elapsed) * wd.total) : null;
  const keep = 1 - plan.fallOver.rate;

  // ── 1. Are we on plan? ──
  const madeNeeded = need(plan.mustMake);
  const madeTone = r ? pace(r.placements, madeNeeded) : 'grey';
  const stickProjected = projected != null ? projected * keep : null;
  const stickTone: Pace = stickProjected == null ? 'grey' : toneOf(stickProjected / plan.mustStick);
  const plannedFall = plan.settings.planFallOverPct;
  const fallPct = Math.round(plan.fallOver.rate * 100);
  const yearDay = Math.round((Date.parse(`${today}T00:00:00`) - Date.parse(`${plan.settings.planYear}-01-01T00:00:00`)) / 86_400_000) + 1;
  const ytdTone: Pace = !ytd?.started ? 'grey' : toneOf(ytd.made / Math.max(1, (ytd.madeTarget * yearDay) / 365));
  const f = x ? financeSummary(x, w, r && projected != null ? { placements: r.placements, projected, ...targets } : null) : null;
  const profitTone: Pace = f?.projectedNetProfit == null ? 'grey'
    : plan.projectedNetProfit != null && f.projectedNetProfit >= plan.projectedNetProfit ? 'green' : f.projectedNetProfit >= 0 ? 'amber' : 'red';

  // ── 2. Cascade: pace vs needed by today, weakest stage = constraint ──
  const h = m?.handoff;
  const qual = h ? countCheck(h.cur.qualifiedCandidates, h.prev.qualifiedCandidates, mktSettings?.targets?.qualifiedCandidates, w) : null;
  const internalNeeded = board ? need(board.internalTarget * board.recruiters.length) : 0;
  const clientNeeded = board ? need(board.rows.reduce((t, row) => t + row.wit.client, 0)) : 0;
  const placementsNeeded = need(teamTarget);
  const stickPlan = 100 - plannedFall;
  const stickNow = 100 - fallPct;
  const stalePct = jobs && jobs.totalOpenJobs ? Math.round((jobs.stale / jobs.totalOpenJobs) * 100) : null;
  type Stage = { key: string; label: string; owner: string; value: string; sub: string; ratio: number | null; path: string };
  const cascade: Stage[] = [
    { key: 'marketing', label: 'Marketing · candidates in', owner: 'Brinda', path: '/marketing',
      value: qual ? `${qual.cur}${qual.needed != null ? ` / ${qual.needed}` : ''}` : '—',
      sub: !qual ? 'No data' : qual.needed == null ? 'Qualified this month · no target set' : 'Qualified vs needed by today',
      ratio: qual?.needed ? qual.cur / qual.needed : null },
    { key: 'internal', label: 'Internal interviews', owner: 'Sourcers', path: '/recruitment',
      value: r ? `${r.internalInterviews} / ${internalNeeded}` : '—', sub: 'Done vs needed by today', ratio: r && internalNeeded ? r.internalInterviews / internalNeeded : null },
    { key: 'client', label: 'Client interviews', owner: 'Recruiters', path: '/recruitment',
      value: r ? `${r.clientInterviews} / ${clientNeeded}` : '—', sub: 'Done vs needed by today', ratio: r && clientNeeded ? r.clientInterviews / clientNeeded : null },
    { key: 'placements', label: 'Placements made', owner: 'Recruiters', path: '/recruitment',
      value: r ? `${r.placements} / ${placementsNeeded}` : '—', sub: 'Made vs needed by today', ratio: r && placementsNeeded ? r.placements / placementsNeeded : null },
    { key: 'retention', label: 'Retention · stick rate', owner: 'Recruiters', path: '/retention',
      value: plan.fallOver.live ? `${stickNow}%` : '—', sub: `Actual vs plan ${stickPlan}%`, ratio: plan.fallOver.live && stickPlan > 0 ? stickNow / stickPlan : null },
    { key: 'jobs', label: 'Sales · jobs to fill', owner: 'Les', path: '/sales',
      value: jobs ? `${jobs.totalOpenJobs}` : '—', sub: jobs ? `${jobs.fresh} fresh · ${jobs.stale} stale (${stalePct ?? 0}%)` : 'No data',
      // Stale share against the Recruitment tab's 25% limit: at or under it scores 1.
      ratio: stalePct == null ? null : (100 - stalePct) / (100 - STALE_LIMIT) },
  ];
  const weakest = cascade.filter(c => c.ratio != null && c.ratio < 1).sort((a, b) => a.ratio! - b.ratio!)[0];

  // ── 3. Who to speak to today: each tab's own actions, constraint first ──
  const showUpPct = r && stages ? (() => {
    const noShows = board!.recruiters.reduce((t, x) => t + x.noShows, 0);
    return r.internalInterviews + noShows > 0 ? Math.round((r.internalInterviews / (r.internalInterviews + noShows)) * 100) : null;
  })() : null;
  const bot = voice ? { dials: voice.teamLeads, prev: voice.prevTeamLeads, expected: (voice.prevTeamLeads * wd.elapsed) / Math.max(1, wd.total) } : null;
  const recActions: TodayAction[] = board
    ? todaysActions({ rows: board.rows.map(x => x.board), team: r!.rolling, cap: recruitment.maxActiveJobs, jobs: jobs ? { stale: jobs.stale, open: jobs.totalOpenJobs } : null, showUpPct, bot, period: 'month' })
    : [];
  const stageOf = (text: string): string | undefined =>
    /internal interview|bot|show-up/i.test(text) ? 'internal' : /client interview|CVs/i.test(text) ? 'client'
      : /placed|placement/i.test(text) ? 'placements' : /qualified|candidate/i.test(text) ? 'marketing' : /stale|jobs/i.test(text) ? 'jobs' : undefined;
  const talks: Talk[] = [
    ...recActions.filter(a => a.level !== 'WATCH').map((a): Talk => {
      const text = `${a.title}. ${a.detail}`;
      return { who: a.who, tag: a.level === '1:1' ? 'Coaching' : 'Activity', text, tab: 'Recruitment', path: '/recruitment', when: a.level === 'FIX NOW' ? 'Today' : 'This week', stage: stageOf(text) };
    }),
    ...(m ? marketingActions(m, organic, mktSettings, w, {
      adSets: adSetQ.data ? adSetChecks(adSetQ.data.rows, adSetQ.data.today, mktSettings?.spikeRule ?? DEFAULT_SPIKE_RULE) : undefined,
      demand: demand?.error ? undefined : demand,
    }) : []).filter(a => a.level !== 'WATCH').map((a): Talk => {
      const text = `${a.title}. ${a.detail}`;
      return { who: a.who, tag: /budget|spend|cost/i.test(text) ? 'Money' : 'Activity', text, tab: 'Marketing', path: '/marketing', when: a.level === 'FIX NOW' ? 'Today' : 'This week', stage: stageOf(text) };
    }),
    ...(ret.data ? diagnoseRetention(summariseRetention(ret.data, { ...DEFAULT_RETENTION_SETTINGS, ...retSettings }, today), { ...DEFAULT_RETENTION_SETTINGS, ...retSettings }).items : [])
      .map((i): Talk => ({ who: 'Recruiters', tag: 'Retention', text: i.text, tab: 'Retention', path: '/retention', when: i.rag === 'red' ? 'Today' : 'This week', stage: 'retention' })),
    ...(s ? salesDiagnosis(s, w, salSettings?.targetPerSalesperson ?? DEFAULT_TARGET_PER_SALESPERSON).items : [])
      .map((i): Talk => ({ who: 'Les', tag: 'Sales', text: i.text, tab: 'Sales', path: '/sales', when: i.rag === 'red' ? 'Today' : 'This week' })),
  ].map(t => (weakest && t.stage === weakest.key ? { ...t, tag: 'Constraint' as Tag } : t));
  const ranked = [...talks.filter(t => t.tag === 'Constraint'), ...talks.filter(t => t.tag !== 'Constraint')];
  const shown = ranked.slice(0, 6);
  const moreTabs = [...new Map(ranked.slice(6).map(t => [t.path, t.tab])).entries()];

  // ── 4. Early warnings ──
  const runRate = (n: number) => (wd.elapsed > 0 ? Math.round((n / wd.elapsed) * wd.total) : n);
  const prevToDate = (n: number) => (n * wd.elapsed) / Math.max(1, wd.total);
  const signRate = (f: { signed: number; tobsSent: number }) => (f.tobsSent ? (f.signed / f.tobsSent) * 100 : null);
  const curSign = s ? signRate(s.cur) : null;
  const prevSign = s ? signRate(s.prev) : null;
  const callCost = h ? costCheck(h.cur.costPerBookedCall, h.prev.costPerBookedCall, mktSettings?.targets?.costPerBookedCall, { isCurrent: true, dayOfMonth: w.dayOfMonth }, w.prevShortLabel, money0) : null;
  const warnings: { metric: string; now: string; vs: string; next: string; tone: Pace }[] = [
    { metric: 'Voice bot bookings', now: voice ? String(voice.teamBooked) : '—', vs: voice ? `${voice.prevTeamBooked} last month` : '—',
      next: voice ? `${runRate(voice.teamBooked)} by month end` : '—', tone: voice ? toneOf(voice.prevTeamBooked ? voice.teamBooked / prevToDate(voice.prevTeamBooked) : null) : 'grey' },
    { metric: 'Internal interviews', now: r ? String(r.internalInterviews) : '—', vs: board ? `${board.internalTarget * board.recruiters.length} plan` : '—',
      next: r ? `${runRate(r.internalInterviews)} by month end` : '—', tone: r ? pace(r.internalInterviews, internalNeeded) : 'grey' },
    { metric: 'Stale jobs', now: jobs ? `${jobs.stale} (${stalePct ?? 0}%)` : '—', vs: `under ${STALE_LIMIT}% plan`,
      next: stalePct == null ? '—' : stalePct > STALE_LIMIT ? 'Hire check fails until cleared' : 'Within limit',
      tone: stalePct == null ? 'grey' : stalePct <= STALE_LIMIT ? 'green' : stalePct <= STALE_LIMIT + 10 ? 'amber' : 'red' },
    { metric: 'Sales sign rate', now: curSign != null ? `${Math.round(curSign)}%` : '—', vs: prevSign != null ? `${Math.round(prevSign)}% last month` : '—',
      next: s ? `${runRate(s.cur.signed)} ToBs signed by month end` : '—', tone: curSign == null || prevSign == null ? 'grey' : toneOf(prevSign ? curSign / prevSign : null) },
    { metric: 'Cost per booked call', now: callCost && h!.cur.costPerBookedCall ? money0(callCost.cur) : '—', vs: callCost ? callCost.vs : '—',
      next: callCost?.worsePct != null ? `${callCost.worsePct > 0 ? '+' : ''}${Math.round(callCost.worsePct)}% vs that` : '—',
      tone: callCost && h!.cur.costPerBookedCall ? callCost.rag : 'grey' },
    { metric: 'Fall-over rate', now: plan.fallOver.live ? `${fallPct}%` : '—', vs: `${plannedFall}% plan`,
      next: plan.fallOver.live ? `Need ${plan.mustMake} made a month to stick ${f1(Math.round(plan.mustStick * 10) / 10)}` : '—',
      tone: !plan.fallOver.live ? 'grey' : fallPct <= plannedFall ? 'green' : fallPct <= plannedFall + 5 ? 'amber' : 'red' },
  ];

  // ── What's going well (only genuinely above target or improving) ──
  const wins: { title: string; text: string }[] = [];
  const best = board?.rows.filter(x => x.board.kind === 'placer' && x.board.placements.needed > 0 && x.board.placements.done >= x.board.placements.needed)
    .sort((a, b) => b.board.placements.done - a.board.placements.done)[0];
  if (best) wins.push({ title: `${best.stat.name} on placements`, text: `${best.board.placements.done} placed vs ${best.board.placements.needed} needed by today.` });
  if (h) {
    const qc = costCheck(h.cur.costPerQualifiedCandidate, h.prev.costPerQualifiedCandidate, mktSettings?.targets?.costPerQualifiedCandidate, { isCurrent: true, dayOfMonth: w.dayOfMonth }, w.prevShortLabel, money2);
    if (h.cur.costPerQualifiedCandidate > 0 && qc.rag === 'green') wins.push({ title: 'Cost per qualified candidate', text: `${money2(qc.cur)} vs ${qc.vs}.` });
  }
  const runwayMin = settings?.runwayWeeksMin ?? 8;
  if (f?.runwayWeeks != null && f.cash != null && f.runwayWeeks >= runwayMin) wins.push({ title: 'Cash and runway', text: `${money0(f.cash)} available · ${Math.round(f.runwayWeeks)} weeks runway (line ${runwayMin}).` });

  // ── 5A. Last 6 months (full months for Direction: last 3 vs the 3 before) ──
  const keys = recentMonthKeys(7, now).reverse(); // oldest first, current last
  const labelOf = (key: string) => monthWindow(key, now).shortLabel;
  // Made = every placement signed (created) that month in JobAdder, fall-overs included; stuck = made minus fallen over.
  const madeIn = (key: string) => (ret.data ? ret.data.filter(p => p.createdAt.slice(0, 7) === key).length : null);
  const stuckIn = (key: string) => (ret.data ? ret.data.filter(p => p.createdAt.slice(0, 7) === key && !placementFacts(p, today).dropped).length : null);
  const profitIn = (key: string) => {
    const lbl = labelOf(key).slice(0, 3);
    const e = x?.monthlyTrend?.find(t => (key === month ? t.isCurrentMonth : !t.isCurrentMonth && t.month.startsWith(lbl)));
    return e?.netProfit ?? null;
  };
  const histRows: { label: string; get: (key: string) => number | null; fmt: (n: number) => string; note?: string }[] = [
    { label: 'Placements made', get: madeIn, fmt: String },
    { label: 'Placements stuck', get: stuckIn, fmt: String },
    { label: 'Internal interviews', get: () => null, fmt: String, note: 'Needs monthly history' },
    { label: 'Net profit', get: profitIn, fmt: k },
  ];
  const shownKeys = keys.slice(-6);
  const direction = (get: (key: string) => number | null) => {
    const full = keys.slice(0, -1).map(get); // 6 finished months
    if (full.some(v => v == null)) return null;
    const a = (full as number[]).slice(0, 3).reduce((t, v) => t + v, 0);
    const b = (full as number[]).slice(3).reduce((t, v) => t + v, 0);
    const base = Math.max(Math.abs(a), 1);
    return (b - a) / base > 0.05 ? 'up' : (b - a) / base < -0.05 ? 'down' : 'flat';
  };

  // ── 5B. Locked in, next 30 days (signed placements only) ──
  const in30 = addDays(today, 30);
  const starting = (ret.data ?? [])
    .filter(p => p.startDate && p.startDate > today && p.startDate <= in30 && !placementFacts(p, today).dropped)
    .sort((a, b) => a.startDate!.localeCompare(b.startDate!));
  const lateBy = clientInvoices ? avgDaysLateByClient(clientInvoices, today) : null;
  const lateDays = (client: string) => { const d = lateBy?.get(companyKey(client, client)); return d == null ? NO_HISTORY_DAYS : Math.max(0, Math.round(d)); };
  const receipts = x ? expectedReceipts(x, schedQ.data, lateDays, AUD_TO_NZD_APPROX) : [];
  const due30 = receipts.filter(rc => rc.expected >= today && rc.expected <= in30);
  const due30Total = due30.reduce((t, rc) => t + rc.amount, 0);

  // ── 5C. Can we afford the plan? Next 3 months ──
  // shortcut: cash out = Finance's weekly outflow (last 4 weeks + buffer) × weeks; planned hires, ad budget
  // and labour hire income aren't entered anywhere yet — add them to Edit targets once Les confirms (brief Q2).
  const weekly = x ? forecastWeeklyOutflow(x.cashFlow) : null;
  const opening = x ? availableCash(x.bankAccounts) : null;
  const forecast = (() => {
    if (opening == null || weekly == null) return null;
    let cash = opening;
    return [0, 1, 2].map(i => addMonths(month, i)).map((key, i) => {
      const [y, mo] = key.split('-').map(Number);
      const last = `${key}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, '0')}`;
      const first = i === 0 ? today : `${key}-01`;
      const cashIn = receipts.filter(rc => (i === 0 ? rc.expected <= last : rc.expected >= first && rc.expected <= last)).reduce((t, rc) => t + rc.amount, 0);
      const days = Math.round((Date.parse(`${last}T00:00:00`) - Date.parse(`${first}T00:00:00`)) / 86_400_000) + 1;
      const cashOut = (weekly * days) / 7;
      const open = cash;
      cash = open + cashIn - cashOut;
      return { label: new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('en-NZ', { month: 'short', year: 'numeric', timeZone: 'UTC' }), open, cashIn, cashOut, end: cash, runway: f?.weeklyCosts ? cash / f.weeklyCosts : null };
    });
  })();
  const status: { label: 'Yes' | 'Tight' | 'No'; tone: Pace } | null = !forecast ? null
    : forecast.some(fm => fm.end < 0) ? { label: 'No', tone: 'red' }
    : forecast.some(fm => fm.runway != null && fm.runway < runwayMin) ? { label: 'Tight', tone: 'amber' } : { label: 'Yes', tone: 'green' };

  // ── Data health ──
  const bookedOnRec = board ? board.recruiters.reduce((t, x) => t + (x.internalInterviewsBotBooked ?? 0), 0) : null;
  const botMismatch = voice && bookedOnRec != null && Math.abs(voice.teamBooked - bookedOnRec) > Math.max(5, bookedOnRec * 0.2);
  const health: { name: string; tone: Pace; note: string }[] = [
    { name: 'JobAdder', ...(rec.error || jobsQ.error || ret.error ? { tone: 'amber' as Pace, note: (rec.error ?? jobsQ.error ?? ret.error)!.message }
      : rec.isLoading || ret.isLoading ? { tone: 'grey' as Pace, note: 'loading' } : { tone: 'green' as Pace, note: 'loaded today' }) },
    { name: 'Airtable', ...(sal.error || mkt.error ? { tone: 'amber' as Pace, note: (sal.error ?? mkt.error)!.message }
      : !s || !m ? { tone: 'grey' as Pace, note: sal.isLoading || mkt.isLoading ? 'loading' : 'no data' } : { tone: 'green' as Pace, note: 'loaded today' }) },
    { name: 'Xero', ...(fin.error ? { tone: 'amber' as Pace, note: fin.error.message } : !x ? { tone: 'grey' as Pace, note: fin.isLoading ? 'loading' : 'no data' }
      : x.asOf?.slice(0, 10) === today ? { tone: 'green' as Pace, note: 'synced today' } : { tone: 'amber' as Pace, note: `last synced ${x.asOf ? day(x.asOf) : 'unknown'}` }) },
    { name: 'Meta Ads', ...(adSetQ.error ? { tone: 'amber' as Pace, note: adSetQ.error.message } : !adSetQ.data ? { tone: 'grey' as Pace, note: adSetQ.isLoading ? 'loading' : 'not connected' }
      : { tone: 'green' as Pace, note: 'loaded today' }) },
    { name: 'Voice bot', ...(voiceQ.error ? { tone: 'amber' as Pace, note: voiceQ.error.message } : !voice ? { tone: 'grey' as Pace, note: 'no data' }
      : botMismatch ? { tone: 'amber' as Pace, note: `${voice.teamBooked} bookings vs ${bookedOnRec} bot-booked interviews on Recruitment` } : { tone: 'green' as Pace, note: 'loaded today' }) },
  ];

  const recLoading = rec.isLoading || recSettings.isLoading;

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 30, color: C.text }}>
      {/* Data health line */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 22px', fontSize: 12, color: C.muted, borderBottom: `1px solid ${C.rowBorder}`, paddingBottom: 10 }}>
        {health.map(hs => (
          <span key={hs.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: PACE_COLOR[hs.tone] }} />
            <b style={{ color: C.soft }}>{hs.name}</b> {hs.note}
          </span>
        ))}
      </div>

      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ margin: 0, fontFamily: NUM_FONT, fontSize: 34, fontWeight: 700, letterSpacing: '-0.5px' }}>Overview</h1>
          <p style={{ margin: 0, fontSize: 14, color: C.muted }}>
            {new Date(now).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Pacific/Auckland' }).replace(',', '')}
            {' · '}Working day {wd.elapsed} of {wd.total} · Every number comes from its own tab
          </p>
        </div>
        {role === 'admin' && settings && (
          <button onClick={() => setShowSettings(true)} style={{ height: 44, background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '0 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Edit targets</button>
        )}
      </header>

      {/* 1. Are we on plan? */}
      <Section title="Are we on plan?" aside={`Plan: ${plan.settings.planAnnualPlacements} made a year · ${plannedFall}% fall-over · ${f1(Math.round(plan.mustStick * 10) / 10)} stick a month`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          <PlanTile label="PLACEMENTS MADE THIS MONTH" owner="Recruiters" loading={recLoading}>
            <div><Num value={r ? r.placements : '—'} tone={madeTone} /> <span style={{ color: C.soft }}>made · {madeNeeded} needed by today · {plan.mustMake} this month</span></div>
            <div style={{ fontSize: 13, color: C.muted }}>
              {projected == null ? 'No data' : <>On pace for <b style={{ color: C.text }}>{projected}</b>{projected < plan.mustMake ? <> · short by <b style={{ color: C.red }}>{plan.mustMake - projected}</b></> : ' · on plan'}</>}
            </div>
          </PlanTile>
          <PlanTile label="PROJECTED TO STICK" owner="Recruiters" loading={recLoading}>
            <div><Num value={stickProjected != null ? f1(Math.round(stickProjected * 10) / 10) : '—'} tone={stickTone} /> <span style={{ color: C.soft }}>vs {f1(Math.round(plan.mustStick * 10) / 10)} needed</span></div>
            <div style={{ fontSize: 13, color: C.muted }}>Fall-over <b style={{ color: plan.fallOver.live ? PACE_COLOR[fallPct <= plannedFall ? 'green' : 'red'] : C.muted }}>{plan.fallOver.live ? `${fallPct}%` : '—'}</b> vs plan {plannedFall}%</div>
          </PlanTile>
          <PlanTile label={`${plan.settings.planYear} PLAN · YEAR TO DATE`} owner="Les" loading={ret.isLoading}>
            <div><Num value={ytd?.started ? ytd.made : 0} tone={ytdTone} /> <span style={{ color: C.soft }}>/ {plan.settings.planAnnualPlacements} made</span></div>
            <div style={{ fontSize: 13, color: C.muted }}>
              {ytd?.started ? <>Stuck <b style={{ color: C.text }}>{ytd.stuck}</b> / {ytd.stuckTarget}</> : `Stuck 0 / ${ytd?.stuckTarget ?? '—'} · starts 1 Jan`}
            </div>
          </PlanTile>
          <PlanTile label="NET PROFIT THIS MONTH" owner="Les" loading={fin.isLoading}>
            <div><Num value={f?.netProfitMtd != null ? k(f.netProfitMtd) : '—'} tone={profitTone} /> <span style={{ color: C.soft }}>so far</span></div>
            <div style={{ fontSize: 13, color: C.muted }}>
              Projected <b style={{ color: C.text }}>{f?.projectedNetProfit != null ? k(f.projectedNetProfit) : '—'}</b> · breakeven {plan.breakeven ?? '—'} placements
            </div>
          </PlanTile>
        </div>
      </Section>

      {/* 2. What's holding us back? */}
      <Section title="What’s holding us back?" aside="Weakest stage vs what the plan needs by today">
        <div style={{ ...CARD, borderLeft: `5px solid ${C.red}`, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: C.muted }}>
            Constraint{settings?.confirmedBy && <> · set by <b style={{ color: C.soft }}>{settings.confirmedBy}</b></>}
            {settings?.confirmedAt && <>, {day(settings.confirmedAt)}</>}
          </span>
          <span style={{ fontFamily: NUM_FONT, fontSize: 24, fontWeight: 700, color: settings?.constraintHeadline ? C.text : C.muted }}>{settings?.constraintHeadline || 'Not set yet'}</span>
          {settings?.constraintDetail && <span style={{ fontSize: 14, color: C.soft }}>{settings.constraintDetail}</span>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px', fontSize: 13, color: C.muted }}>
            <span>Fixed when: <b style={{ color: C.text }}>{settings?.constraintFixedWhen || '—'}</b></span>
            <span>Owner: <b style={{ color: C.text }}>{settings?.constraintOwner || '—'}</b></span>
          </div>
          <div style={{ borderTop: `1px solid ${C.rowBorder}`, marginTop: 6, paddingTop: 8, fontSize: 13, color: C.muted }}>
            Dashboard suggests: {weakest
              ? <><b style={{ color: C.red }}>{weakest.label}</b> ({weakest.value}, owner {weakest.owner})</>
              : <b style={{ color: C.text }}>nothing below what the plan needs</b>}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          {cascade.map(st => {
            const tone = st === weakest ? 'red' : toneOf(st.ratio);
            return (
              <Link key={st.key} to={st.path} style={{ ...CARD, textDecoration: 'none', color: C.text, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, ...(st === weakest && { border: `2px solid ${C.red}` }) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
                  <span style={{ ...LABEL, fontSize: 12 }}>{st.label}</span>
                  {st === weakest && <Chip tone="red">CONSTRAINT</Chip>}
                </div>
                <Num value={st.value} tone={tone} size={26} />
                <Bar ratio={st.ratio} tone={tone} />
                <span style={{ fontSize: 12, color: C.muted }}>{st.sub}</span>
                <Owner name={st.owner} />
              </Link>
            );
          })}
        </div>
      </Section>

      {/* 3. Who to speak to today */}
      <Section title="Who to speak to today" aside="From each tab’s Today’s actions · tick them off in the tab">
        {shown.length === 0
          ? <div style={{ ...CARD, padding: '16px 20px', fontSize: 14, color: C.muted }}>{recLoading || mkt.isLoading ? 'Loading…' : 'Nothing flagged today.'}</div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
              {shown.map((t, i) => (
                <Link key={i} to={t.path} style={{ ...CARD, textDecoration: 'none', color: C.text, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{t.who}</span>
                    <Chip tone={TAG_TONE[t.tag]}>{t.tag.toUpperCase()}</Chip>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: t.when === 'Today' ? C.red : C.muted, fontWeight: 600 }}>{t.when}</span>
                  </div>
                  <span style={{ fontSize: 14, color: C.soft, lineHeight: 1.45 }}>{t.text}</span>
                  <span style={{ fontSize: 12, color: C.faint }}>{t.tab} tab →</span>
                </Link>
              ))}
            </div>}
        {moreTabs.length > 0 && (
          <div style={{ fontSize: 13, color: C.muted }}>
            +{ranked.length - 6} more in {moreTabs.map(([path, tab], i) => <span key={path}>{i > 0 && ', '}<Link to={path} style={{ color: C.blue }}>{tab}</Link></span>)}
          </div>
        )}
      </Section>

      {/* 4. What's about to go wrong + what's going well */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 24, alignItems: 'start' }}>
        <Section title="What’s about to go wrong" aside="Early warnings">
          <div style={{ ...CARD, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Metric</th><th style={th}>This month</th><th style={th}>Last month / plan</th><th style={th}>Heading for</th></tr></thead>
              <tbody>
                {warnings.map(wn => (
                  <tr key={wn.metric}>
                    <td style={td}>{wn.metric}</td>
                    <td style={{ ...td, fontWeight: 700, color: wn.tone === 'red' || wn.tone === 'amber' ? PACE_COLOR[wn.tone] : wn.tone === 'grey' ? C.faint : C.text }}>{wn.now}</td>
                    <td style={{ ...td, color: C.muted }}>{wn.vs}</td>
                    <td style={{ ...td, color: C.muted }}>{wn.next}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
        <Section title="What’s going well" aside="Only above target or improving">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {wins.length === 0 && <div style={{ ...CARD, padding: '14px 18px', fontSize: 14, color: C.muted }}>Nothing above target yet this month.</div>}
            {wins.slice(0, 4).map(wi => (
              <div key={wi.title} style={{ ...CARD, borderLeft: `4px solid ${C.green}`, padding: '12px 16px' }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{wi.title}</div>
                <div style={{ fontSize: 13, color: C.soft, marginTop: 3 }}>{wi.text}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* 5. Where we're heading */}
      <Section title="Where we’re heading" aside="Last 6 months · locked in · can we afford the plan">
        <div style={{ ...CARD, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th} />
                {shownKeys.map(key => <th key={key} style={{ ...th, textAlign: 'right' }}>{labelOf(key)}{key === month && ' (MTD)'}</th>)}
                <th style={{ ...th, textAlign: 'right' }}>Direction</th>
              </tr>
            </thead>
            <tbody>
              {histRows.map(row => {
                const dir = direction(row.get);
                return (
                  <tr key={row.label}>
                    <td style={td}>{row.label}{row.note && <span style={{ fontSize: 11, color: C.faint }}> · {row.note}</span>}</td>
                    {shownKeys.map(key => { const v = row.get(key); return <td key={key} style={{ ...td, textAlign: 'right', color: v == null ? C.faint : C.text }}>{v == null ? '—' : row.fmt(v)}</td>; })}
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: dir === 'up' ? C.green : dir === 'down' ? C.red : C.muted }}>
                      {dir === 'up' ? '↑ up' : dir === 'down' ? '↓ down' : dir === 'flat' ? '→ flat' : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 12, alignItems: 'start' }}>
          {/* B. Locked in */}
          <div style={{ ...CARD, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={LABEL}>LOCKED IN · NEXT 30 DAYS</span>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              <div><Num value={ret.data ? starting.length : '—'} tone={ret.data ? (starting.length ? 'green' : 'grey') : 'grey'} /><div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>signed placements starting</div></div>
              <div><Num value={x ? k(due30Total) : '—'} tone={x && due30Total > 0 ? 'green' : 'grey'} /><div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>fees due ({due30.length} payments)</div></div>
            </div>
            <span style={{ fontSize: 12, color: C.faint }}>Signed placements only, no pipeline guesses. Payments by expected date (due date + the client's average days late).</span>
            <button onClick={() => setShowLocked(v => !v)} style={{ alignSelf: 'flex-start', fontSize: 13, color: C.blue, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
              {showLocked ? 'Hide list' : 'Show list →'}
            </button>
            {showLocked && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Candidate</th><th style={th}>Client</th><th style={th}>Starts</th></tr></thead>
                  <tbody>
                    {starting.length === 0 && <tr><td style={{ ...td, color: C.muted }} colSpan={3}>None</td></tr>}
                    {starting.map(p => <tr key={p.placementId}><td style={td}>{p.candidate}</td><td style={td}>{p.company.name}</td><td style={td}>{day(p.startDate!)}</td></tr>)}
                  </tbody>
                </table>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Client</th><th style={{ ...th, textAlign: 'right' }}>Fee (NZD ex GST)</th><th style={th}>Expected</th><th style={th}>From</th></tr></thead>
                  <tbody>
                    {due30.length === 0 && <tr><td style={{ ...td, color: C.muted }} colSpan={4}>None</td></tr>}
                    {due30.map((rc, i) => <tr key={i}><td style={td}>{rc.client}</td><td style={{ ...td, textAlign: 'right' }}>{money0(rc.amount)}</td><td style={td}>{day(rc.expected)}</td><td style={{ ...td, color: C.muted }}>{rc.source === 'Xero' ? 'Xero invoice' : 'Scheduled instalment'}</td></tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* C. Can we afford the plan? */}
          <div style={{ ...CARD, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={LABEL}>CAN WE AFFORD THE PLAN? · NEXT 3 MONTHS</span>
              {status ? <Chip tone={status.tone}>{status.label.toUpperCase()}</Chip> : <Chip tone="grey">NO DATA</Chip>}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th} />{(forecast ?? []).map(fm => <th key={fm.label} style={{ ...th, textAlign: 'right' }}>{fm.label}</th>)}</tr></thead>
                <tbody>
                  {forecast && ([['Cash in', 'cashIn'], ['Cash out', 'cashOut'], ['Cash at end', 'end']] as const).map(([lbl, key]) => (
                    <tr key={key}>
                      <td style={{ ...td, fontWeight: key === 'end' ? 700 : 400 }}>{lbl}</td>
                      {forecast.map(fm => (
                        <td key={fm.label} style={{ ...td, textAlign: 'right', fontWeight: key === 'end' ? 700 : 400, color: key === 'end' && fm.end < 0 ? C.red : key === 'end' && fm.runway != null && fm.runway < runwayMin ? C.amber : C.text }}>
                          {k(fm[key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!forecast && <tr><td style={{ ...td, color: C.muted }}>{fin.isLoading ? 'Loading…' : 'Needs Xero cash and 4 weeks of cash flow'}</td></tr>}
                </tbody>
              </table>
            </div>
            <span style={{ fontSize: 12, color: C.faint }}>
              Cash in: unpaid Xero invoices and scheduled instalments (overdue counted this month). Cash out: last 4 weeks' average + buffer.
              Not yet included: planned hires, ad budget, labour hire income. Tight = runway under {runwayMin} weeks.
            </span>
            <div style={{ borderTop: `1px solid ${C.rowBorder}`, paddingTop: 10, display: 'flex', flexWrap: 'wrap', gap: '4px 20px', fontSize: 13, color: C.muted }}>
              <span>Runway <b style={{ color: C.text }}>{f?.runwayWeeks != null ? `${Math.round(f.runwayWeeks)} weeks` : '—'}</b></span>
              <span>Available cash <b style={{ color: C.text }}>{f?.cash != null ? money0(f.cash) : '—'}</b></span>
              <span>Overdue <b style={{ color: x?.ausReceivables?.overdueTotal ? C.red : C.text }}>{x?.ausReceivables ? money0(x.ausReceivables.overdueTotal) : '—'}</b></span>
              <Link to="/finance" style={{ color: C.blue, marginLeft: 'auto' }}>Finance →</Link>
            </div>
          </div>
        </div>
      </Section>

      {showSettings && settings && <SettingsPanel settings={settings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

/** "2026-11" + 2 → "2027-01". */
function addMonths(key: string, n: number): string {
  const [y, mo] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
