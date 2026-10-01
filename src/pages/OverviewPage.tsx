// Overview: the whole business on one page. It calculates nothing itself — every number,
// status and reason comes from the same function its own tab uses.
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Skeleton } from '../components/shared/Skeleton';
import { NZ, AM, RD, GREY, BG, BG2, BORDER, TEXT, MUTED, RAG_COLOR, int, money0 } from '../components/shared/monthTheme';
import { useAuthRole } from '../components/auth/AuthContext';
import {
  useMarketingMonth, useOrganicMonth, useMarketingSettings, useSalesMonth, useSalesSettings,
  useRecruiterKPIs, useJobAging, useRecruitmentSettings, useRetentionKPIs, useXeroFinanceData,
  useOverviewSettings, useSaveOverviewSettings,
} from '../hooks/queries';
import { timeBoundaries } from '../services/airtable';
import { monthWindow, recentMonthKeys, currentMonthKey } from '../lib/nzTime';
import { marketingDiagnosis } from '../components/departments/marketingMetrics';
import { salesDiagnosis, targetsFor, DEFAULT_TARGET_PER_SALESPERSON } from '../components/departments/salesMetrics';
import { DEFAULT_RECRUITMENT_SETTINGS, hiringTrigger, teamRecruiters, recruitmentPace } from '../lib/recruitment';
import { diagnoseRecruitment, diagnoseRetention, type AttentionItem, type Diagnosis } from '../lib/diagnosis';
import { financeSummary, DEFAULT_NET_PROFIT_TARGET } from '../lib/finance';
import type { Rag } from '../lib/rag';
import type { OverviewSettings } from '../types';

const BADGE: Record<Rag, string> = { green: 'OK', amber: 'Watch', red: 'Off', grey: 'Too early' };
const k = (n: number) => `${n < 0 ? '-' : ''}$${Math.round(Math.abs(n) / 1000)}k`;
const fmtTarget = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

interface Num { label: string; value: string; suffix?: string }
interface Dept {
  name: string;
  path: string;
  loading: boolean;
  diagnosis: Diagnosis | null;   // null = data unavailable
  numbers: [Num, Num];
  currentOnly?: boolean;         // live month only, whatever month is picked
}

// ─── Settings panel ───────────────────────────────────────────────────────────
function SettingsPanel({ settings, onClose }: { settings: OverviewSettings; onClose: () => void }) {
  const save = useSaveOverviewSettings();
  const [target, setTarget] = useState(String(settings.netProfitTarget));
  const [headline, setHeadline] = useState(settings.constraintHeadline);
  const [detail, setDetail] = useState(settings.constraintDetail);
  const [confirmedBy, setConfirmedBy] = useState(settings.confirmedBy);
  const [password, setPassword] = useState('');
  const input = { background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
  const field = (label: string, el: ReactNode) => (
    <>
      <label style={{ fontSize: 11, color: MUTED }}>{label}</label>
      <div style={{ margin: '4px 0 12px' }}>{el}</div>
    </>
  );

  const submit = () => {
    save.mutate(
      { settings: { netProfitTarget: Number(target), constraintHeadline: headline, constraintDetail: detail, confirmedBy }, adminPassword: password },
      { onSuccess: onClose },
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '1.25rem', width: 380 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 14 }}>Overview settings</div>
        {field('Net profit target (NZD per month)', <input style={input} type="number" min={1} step={1000} value={target} onChange={e => setTarget(e.target.value)} />)}
        {field('Current constraint (headline)', <input style={input} placeholder="e.g. Candidate supply" value={headline} onChange={e => setHeadline(e.target.value)} />)}
        {field('Detail', <input style={input} placeholder="e.g. Short on: electricians, carpenters" value={detail} onChange={e => setDetail(e.target.value)} />)}
        {field('Confirmed by', <input style={input} placeholder="e.g. Les" value={confirmedBy} onChange={e => setConfirmedBy(e.target.value)} />)}
        <div style={{ fontSize: 11, color: MUTED, margin: '-4px 0 12px' }}>The confirmed date is set to today whenever the constraint or name changes.</div>
        {field('Admin password', <input style={input} type="password" value={password} onChange={e => setPassword(e.target.value)} />)}
        {save.error && <div style={{ fontSize: 11, color: RD, marginBottom: 10 }}>{save.error.message}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={save.isPending} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: 'none', background: NZ, color: TEXT, cursor: 'pointer' }}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────
function Panel({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, padding: '1.25rem', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: '1rem' }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: TEXT }}>{title}</span>
        {sub && <span style={{ fontSize: 12, color: MUTED }}>{sub}</span>}
      </div>
      {children}
    </div>
  );
}

function DeptCard({ d, suggested, showCurrentOnly }: { d: Dept; suggested: boolean; showCurrentOnly: boolean }) {
  const tone: Rag = d.diagnosis?.tone ?? 'grey';
  const color = RAG_COLOR[tone];
  return (
    <Link
      to={d.path}
      style={{
        background: BG, borderRadius: 10, textDecoration: 'none',
        border: suggested ? `2px solid ${RD}` : `.5px solid ${BORDER}`, borderTopColor: color, borderTopWidth: 3,
        padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, flex: 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{d.name}</span>
        {d.loading
          ? <Skeleton height={20} width={48} radius={999} />
          : <span style={{ background: color, color: tone === 'grey' ? TEXT : BG, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
              {d.diagnosis ? BADGE[tone] : 'No data'}
            </span>}
      </div>
      {d.numbers.map(n => (
        <div key={n.label}>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 2 }}>{n.label}</div>
          {d.loading
            ? <Skeleton height={28} width={70} />
            : <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: TEXT, lineHeight: 1.1 }}>{n.value}</span>
                {n.suffix && <span style={{ fontSize: 13, color: MUTED }}>{n.suffix}</span>}
              </div>}
        </div>
      ))}
      <div style={{ borderTop: `.5px solid ${BORDER}`, paddingTop: 10, fontSize: 12, color: MUTED, lineHeight: 1.5, flex: 1 }}>
        {d.loading ? <Skeleton height={12} width="90%" /> : d.diagnosis?.summary ?? 'Data unavailable'}
        {showCurrentOnly && d.currentOnly && <div style={{ fontSize: 10, color: GREY, marginTop: 4 }}>Current month only</div>}
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: RD }}>View →</span>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function OverviewPage() {
  const role = useAuthRole();
  const [month, setMonth] = useState(currentMonthKey);
  const [showSettings, setShowSettings] = useState(false);
  const w = monthWindow(month);
  const now = monthWindow(currentMonthKey());

  const mkt = useMarketingMonth(month);
  const organic = useOrganicMonth(month);
  const { data: mktSettings } = useMarketingSettings();
  const sal = useSalesMonth(month);
  const { data: salSettings } = useSalesSettings();
  const rec = useRecruiterKPIs('month');
  const { data: jobs } = useJobAging();
  const recSettings = useRecruitmentSettings();
  const ret = useRetentionKPIs();
  const fin = useXeroFinanceData();
  const { data: settings } = useOverviewSettings();
  const npTarget = settings?.netProfitTarget ?? DEFAULT_NET_PROFIT_TARGET;

  // Marketing
  const m = mkt.data;
  const marketing: Dept = {
    name: 'Marketing', path: '/marketing', loading: mkt.isLoading,
    diagnosis: m ? marketingDiagnosis(m, organic.data, mktSettings, w) : null,
    numbers: [
      { label: 'Calls booked', value: m ? int(m.handoff.cur.callsBooked) : '—' },
      { label: 'Qualified candidates', value: m ? int(m.handoff.cur.qualifiedCandidates) : '—' },
    ],
  };

  // Sales
  const s = sal.data;
  const perPerson = salSettings?.targetPerSalesperson ?? DEFAULT_TARGET_PER_SALESPERSON;
  const sales: Dept = {
    name: 'Sales', path: '/sales', loading: sal.isLoading,
    diagnosis: s ? salesDiagnosis(s, w, perPerson) : null,
    numbers: [
      { label: 'ToBs signed', value: s ? int(s.cur.signed) : '—', suffix: s ? `/ ${targetsFor(s, w, perPerson).full}` : undefined },
      { label: 'Stale ToBs', value: s ? int(s.open.stale) : '—' },
    ],
  };

  // Recruitment (live month)
  const r = rec.data;
  const { start, now: nowMs } = timeBoundaries('month');
  const pace = r ? recruitmentPace(r, teamRecruiters(r, jobs), 'month', start, nowMs) : null;
  const hiring = jobs ? hiringTrigger(jobs, recSettings.data ?? DEFAULT_RECRUITMENT_SETTINGS) : null;
  const full = hiring ? hiring.activeJobs >= hiring.slots : false;
  const recruitment: Dept = {
    name: 'Recruitment', path: '/recruitment', loading: rec.isLoading || recSettings.isLoading, currentOnly: true,
    diagnosis: pace ? diagnoseRecruitment({
      ...pace, periodLabel: 'month',
      hiring: hiring && { state: hiring.state, weeksUntilFull: hiring.weeksUntilFull, full },
    }) : null,
    numbers: [
      { label: 'Placements', value: pace ? int(pace.placements) : '—', suffix: pace ? `/ ${fmtTarget(pace.target)}` : undefined },
      {
        label: 'Weeks until team is full',
        value: full ? '0' : hiring?.weeksUntilFull != null ? String(Math.round(hiring.weeksUntilFull)) : '—',
      },
    ],
  };

  // Retention (current state)
  const rt = ret.data;
  const retention: Dept = {
    name: 'Retention', path: '/retention', loading: ret.isLoading, currentOnly: true,
    diagnosis: rt ? diagnoseRetention({ replacementRate: rt.replacementRate, inProgress: rt.inProgress }) : null,
    numbers: [
      { label: 'Replacement rate', value: rt ? `${rt.replacementRate}%` : '—' },
      { label: 'Replacements in progress', value: rt ? int(rt.inProgress) : '—' },
    ],
  };

  // Finance (live month)
  const f = fin.data ? financeSummary(fin.data, npTarget, now) : null;
  const finance: Dept = {
    name: 'Finance', path: '/finance', loading: fin.isLoading, currentOnly: true,
    diagnosis: f?.diagnosis ?? null,
    numbers: [
      { label: 'Net profit', value: f?.netProfitMtd != null ? k(f.netProfitMtd) : '—', suffix: `/ ${k(npTarget)}` },
      { label: 'Cash runway', value: f?.runwayWeeks != null ? f.runwayWeeks.toFixed(0) : '—', suffix: 'weeks' },
    ],
  };

  const flow = [marketing, sales, recruitment, retention, finance];
  const suggested = flow.find(d => d.diagnosis?.tone === 'red');

  // Needs attention: red before amber, flow order within each, top 5.
  const all = flow.flatMap(d => (d.diagnosis?.items ?? []).map(i => ({ ...i, dept: d.name })));
  const byRag = (rag: AttentionItem['rag']) => all.filter(i => i.rag === rag);
  const attention = [...byRag('red'), ...byRag('amber')].slice(0, 5);

  // Last 12 months: team placements (sum of recruiters) + AUS net profit, matched by month name.
  const trend = fin.data?.monthlyTrend ?? [];
  const chart = (r?.months ?? trend.map(t => t.month.slice(0, 3))).map((label, i) => {
    const key = label.slice(0, 3).toLowerCase();
    return {
      label: label[0],
      month: label,
      placements: r ? r.byRecruiter.reduce((n, x) => n + (x.monthlyPlacements[i] ?? 0), 0) : null,
      netProfit: trend.find(t => t.month.slice(0, 3).toLowerCase() === key)?.netProfit ?? null,
    };
  });

  const showCurrentOnly = !w.isCurrent;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: 30, fontWeight: 700, color: TEXT, margin: 0 }}>Overview</h2>
          <p style={{ fontSize: 13, color: MUTED, margin: '4px 0 0' }}>
            The whole business on one page. Every number is read from its own tab. Month to date vs same day last month.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            style={{ background: BG2, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px', fontSize: 13 }}
          >
            {recentMonthKeys(12).map(key => <option key={key} value={key}>{monthWindow(key).label}</option>)}
          </select>
          {role === 'admin' && settings && (
            <button onClick={() => setShowSettings(true)} title="Overview settings" style={{ background: BG2, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 10px', fontSize: 14, cursor: 'pointer' }}>⚙</button>
          )}
        </div>
      </div>

      {/* 1. Constraint banner */}
      <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderLeft: `5px solid ${RD}`, borderRadius: 12, padding: '1.1rem 1.4rem', marginBottom: '.875rem' }}>
        <div style={{ fontSize: 12, color: MUTED }}>
          Current constraint
          {settings?.confirmedBy && <> · <b style={{ color: TEXT }}>Confirmed by {settings.confirmedBy}</b></>}
          {settings?.confirmedAt && <>, {new Date(`${settings.confirmedAt}T00:00:00`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}</>}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: settings?.constraintHeadline ? TEXT : MUTED, margin: '6px 0 4px' }}>
          {settings?.constraintHeadline || 'Not set yet'}
        </div>
        {settings?.constraintDetail && <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{settings.constraintDetail}</div>}
        <div style={{ borderTop: `.5px solid ${BORDER}`, marginTop: 12, paddingTop: 10, display: 'flex', flexWrap: 'wrap', gap: '6px 28px', fontSize: 13, color: MUTED }}>
          <span>
            Dashboard suggests:{' '}
            {suggested
              ? <><b style={{ color: RD }}>{suggested.name}</b> (first red in the chain)</>
              : <b style={{ color: TEXT }}>Nothing red</b>}
          </span>
          <span>
            On pace for:{' '}
            <b style={{ color: TEXT }}>
              {pace ? `${pace.projected} of ${fmtTarget(pace.target)} placements` : '— placements'}
              {' · '}
              {f?.projectedNetProfit != null ? `${k(f.projectedNetProfit)} of ${k(npTarget)}` : `— of ${k(npTarget)}`}
            </b>{' '}net profit
          </span>
        </div>
      </div>

      {/* 2. The flow */}
      <div style={{ marginBottom: '.875rem' }}>
        <Panel title="The business, in the order work flows" sub="Click any card to open its tab">
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, overflowX: 'auto' }}>
            {flow.map((d, i) => (
              <div key={d.path} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 170 }}>
                <DeptCard d={d} suggested={d === suggested} showCurrentOnly={showCurrentOnly} />
                {i < flow.length - 1 && <span style={{ color: MUTED, fontSize: 18 }}>→</span>}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* 3 + 4 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '.875rem' }}>
        <Panel title="Needs attention" sub="Top red and amber items from every tab">
          <div style={{ background: BG, borderRadius: 10, padding: '4px 16px' }}>
            {attention.length === 0 && <div style={{ padding: '12px 0', fontSize: 13, color: MUTED }}>Nothing red or amber</div>}
            {attention.map((a, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '14px 120px 1fr', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: i ? `.5px solid ${BORDER}` : undefined, fontSize: 13, color: TEXT }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: a.rag === 'red' ? RD : AM }} />
                <span>{a.dept}</span>
                <span>{a.text}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Last 12 months">
          <div style={{ background: BG, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>Placements (bars) and net profit (line)</div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chart} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="p" hide allowDecimals={false} />
                <YAxis yAxisId="np" hide domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(max, npTarget * 1.1)]} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${BORDER}`, background: BG2 }}
                  labelStyle={{ color: TEXT }}
                  labelFormatter={(_, p) => p?.[0]?.payload?.month ?? ''}
                  formatter={(v, n) => [v == null ? '—' : n === 'Net profit' ? money0(Number(v)) : int(Number(v)), String(n)]}
                />
                <ReferenceLine yAxisId="np" y={npTarget} stroke={MUTED} strokeDasharray="4 4" />
                <Bar yAxisId="p" dataKey="placements" name="Placements" fill={RD} maxBarSize={28} />
                <Line yAxisId="np" dataKey="netProfit" name="Net profit" stroke={TEXT} strokeWidth={2} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: MUTED, marginTop: 6 }}>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, background: RD, marginRight: 5 }} />Placements</span>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, background: TEXT, marginRight: 5 }} />Net profit</span>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, border: `1px dashed ${MUTED}`, marginRight: 5 }} />{k(npTarget)} target</span>
            </div>
          </div>
        </Panel>
      </div>

      {showSettings && settings && <SettingsPanel settings={settings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
