import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  ComposedChart, Bar, Line, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Legend,
} from 'recharts';
import { Skeleton } from '../shared/Skeleton';
import { AM, RD, BG, BG2, BORDER, TEXT, MUTED, NZ, money0, money2, int, kShort } from '../shared/monthTheme';
import { Grid } from '../shared/monthLayout';
import { C, PACE_COLOR, NUM_FONT, CARD, LABEL, TODO } from '../shared/v2Theme';
import { Chip, Section, Tag, Big, Tile, Line as TextLine } from '../shared/v2Layout';
import { useMarketingMonth, useOrganicMonth, useMarketingSettings, useSaveMarketingSettings, useMetaBreakdown, useVoiceCallKPIs, useMetaAdSets, useMarketingDemand } from '../../hooks/queries';
import { useAuthRole } from '../auth/AuthContext';
import { monthWindow, recentMonthKeys, currentMonthKey, type MonthWindow } from '../../lib/nzTime';
import { rate, type RagContext } from '../../lib/rag';
import { pace, PACE_LABEL, type Pace } from '../../lib/workingDays';
import {
  postsTarget, marketingActions, biggestMarketingBreak, countCheck, costCheck, budgetCheck,
  adSetChecks, type CountCheck, type CostCheck, type MktLevel, type AdSetStatus,
} from './marketingMetrics';
import type { MarketingMonth, MarketingSettings, MarketingTargets, MetaAdRow } from '../../types';

// ─── Settings panel ───────────────────────────────────────────────────────────
const TARGET_FIELDS: { key: keyof MarketingTargets; label: string }[] = [
  { key: 'callsBooked', label: 'Calls booked per month' },
  { key: 'qualifiedCandidates', label: 'Qualified candidates per month' },
  { key: 'costPerBookedCall', label: 'Cost per booked call (NZD)' },
  { key: 'costPerQualifiedCandidate', label: 'Cost per qualified candidate (NZD)' },
];

const median = (xs: number[]) => {
  const v = xs.filter(x => x > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

/** Starting targets: median of the last 3 full months. */
function suggestedTargets(m: MarketingMonth): MarketingTargets {
  const full = m.handoffSeries.filter(h => h.key < currentMonthKey()).slice(-3);
  const round = (v: number | null, step = 1) => (v == null ? null : Math.round(v / step) * step);
  return {
    callsBooked: round(median(full.map(h => h.callsBooked))),
    qualifiedCandidates: round(median(full.map(h => h.qualifiedCandidates))),
    costPerBookedCall: round(median(full.map(h => h.costPerBookedCall))),
    costPerQualifiedCandidate: round(median(full.map(h => h.costPerQualifiedCandidate)), 0.5),
  };
}

function SettingsPanel({ settings, suggested, onClose }: { settings: MarketingSettings; suggested: MarketingTargets | null; onClose: () => void }) {
  const save = useSaveMarketingSettings();
  const str = (v: number | null) => (v != null ? String(v) : '');
  const [budget, setBudget] = useState(str(settings.monthlyBudget));
  const [posts, setPosts] = useState(String(settings.postsPerWeek));
  const [targets, setTargets] = useState<Record<keyof MarketingTargets, string>>({
    callsBooked: str(settings.targets.callsBooked),
    qualifiedCandidates: str(settings.targets.qualifiedCandidates),
    costPerBookedCall: str(settings.targets.costPerBookedCall),
    costPerQualifiedCandidate: str(settings.targets.costPerQualifiedCandidate),
  });
  const [nonTrade, setNonTrade] = useState(settings.nonTradeCategories.join('\n'));
  const [password, setPassword] = useState('');
  const input = { background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
  const label = { fontSize: 11, color: MUTED };
  const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

  const submit = () => {
    save.mutate(
      {
        settings: {
          monthlyBudget: numOrNull(budget),
          postsPerWeek: Number(posts),
          targets: {
            callsBooked: numOrNull(targets.callsBooked),
            qualifiedCandidates: numOrNull(targets.qualifiedCandidates),
            costPerBookedCall: numOrNull(targets.costPerBookedCall),
            costPerQualifiedCandidate: numOrNull(targets.costPerQualifiedCandidate),
          },
          nonTradeCategories: nonTrade.split('\n').map(c => c.trim()).filter(Boolean),
        },
        adminPassword: password,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '1.25rem', width: 420, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 14 }}>Marketing settings</div>
        <label style={label}>Monthly ad budget (NZD)</label>
        <input style={{ ...input, margin: '4px 0 12px' }} type="number" min={0} value={budget} placeholder="Not set" onChange={e => setBudget(e.target.value)} />
        <label style={label}>Posting target (posts per week, per channel)</label>
        <input style={{ ...input, margin: '4px 0 12px' }} type="number" min={1} step={1} value={posts} onChange={e => setPosts(e.target.value)} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '6px 0 8px' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>Monthly targets</span>
          {suggested && (
            <button
              onClick={() => setTargets(Object.fromEntries(TARGET_FIELDS.map(f => [f.key, str(suggested[f.key])])) as Record<keyof MarketingTargets, string>)}
              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, cursor: 'pointer' }}
            >Use suggestions</button>
          )}
        </div>
        {TARGET_FIELDS.map(f => (
          <div key={f.key}>
            <label style={label}>{f.label}{suggested?.[f.key] != null && <> · suggested {suggested[f.key]} (median of last 3 months)</>}</label>
            <input style={{ ...input, margin: '4px 0 10px' }} type="number" min={0} value={targets[f.key]} placeholder="Not set — compares with last month"
              onChange={e => setTargets(t => ({ ...t, [f.key]: e.target.value }))} />
          </div>
        ))}

        <label style={label}>Categories that are NOT a skilled trade (one per line). Everything else, for an NZ citizen, counts as qualified.</label>
        <textarea style={{ ...input, margin: '4px 0 12px', height: 120, fontFamily: 'inherit' }} value={nonTrade} onChange={e => setNonTrade(e.target.value)} />

        <label style={label}>Admin password</label>
        <input style={{ ...input, margin: '4px 0 12px' }} type="password" value={password} onChange={e => setPassword(e.target.value)} />
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

// ─── Campaigns and ads ────────────────────────────────────────────────────────
const th = (right?: boolean) => ({ textAlign: right ? 'right' as const : 'left' as const, color: MUTED, fontWeight: 500, padding: '6px 8px', borderBottom: `.5px solid ${BORDER}`, whiteSpace: 'nowrap' as const });
const td = (right?: boolean) => ({ padding: '7px 8px', color: TEXT, textAlign: right ? 'right' as const : 'left' as const, borderBottom: `.5px solid ${BORDER}` });

/** Ads ranked by cost per result. Ads under $20 spend are left out; spend with no results ranks worst. */
function rankAds(ads: MetaAdRow[]) {
  const eligible = ads.filter(a => a.spend >= 20);
  const cost = (a: MetaAdRow) => a.costPerResult ?? Infinity;
  const sorted = [...eligible].sort((a, b) => cost(a) - cost(b) || b.spend - a.spend);
  const best = sorted.filter(a => a.costPerResult != null).slice(0, 5);
  const worst = [...sorted].reverse().filter(a => !best.includes(a)).slice(0, 5);
  return { best, worst };
}

function AdTable({ title, rows, resultWord }: { title: string; rows: MetaAdRow[]; resultWord: string }) {
  return (
    <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, padding: '.75rem .875rem' }}>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr>
          <th style={th()}>Ad</th><th style={th(true)}>Spend</th><th style={th(true)}>{resultWord}</th>
          <th style={th(true)}>Cost each</th><th style={th(true)} title="Average times each person saw the ad">Freq.</th>
        </tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={5} style={{ ...td(), color: MUTED }}>No ads with $20+ spend</td></tr>}
          {rows.map(a => (
            <tr key={a.id}>
              <td style={{ ...td(), maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${a.ad} · ${a.campaign}`}>{a.ad}</td>
              <td style={td(true)}>{money0(a.spend)}</td>
              <td style={td(true)}>{int(a.results)}</td>
              <td style={{ ...td(true), color: a.costPerResult == null ? RD : TEXT }}>{a.costPerResult == null ? '0 results' : money2(a.costPerResult)}</td>
              <td style={{ ...td(true), color: a.frequency >= 3 ? AM : TEXT }} title={a.frequency >= 3 ? 'Wearing out: people have seen it 3+ times' : undefined}>{a.frequency.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CampaignsAndAds({ month, prevWord }: { month: string; prevWord: string }) {
  const [open, setOpen] = useState(true);
  const [group, setGroup] = useState<'client' | 'candidate'>('client');
  const { data, error, isLoading } = useMetaBreakdown(month, open);
  const ranked = data ? rankAds(data.ads.filter(a => a.group === group)) : null;
  const resultWord = group === 'client' ? 'Leads' : 'Applications';

  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', textAlign: 'left', background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, padding: '.75rem 1rem', color: TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
      >
        {open ? '▾' : '▸'} Campaigns and ads <span style={{ fontWeight: 400, color: MUTED, fontSize: 11 }}>· which campaign or ad to fix when a card turns amber or red</span>
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          {isLoading && <Skeleton height={120} radius={8} />}
          {error && <div style={{ fontSize: 11, color: AM }}>⚠ {error.message}</div>}
          {data && (
            <>
              <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, padding: '.75rem .875rem', marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>Campaigns this month (Meta-reported)</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr>
                    <th style={th()}>Campaign</th><th style={th()}>Type</th><th style={th(true)}>Spend</th><th style={th(true)}>{prevWord} same day</th>
                    <th style={th(true)}>Results</th><th style={th(true)}>Cost each</th><th style={th(true)}>Clicks</th><th style={th(true)}>Freq.</th>
                  </tr></thead>
                  <tbody>
                    {data.campaigns.map(c => {
                      const quiet = c.prevSpend > 0 && (c.spend < 50 || c.spend < c.prevSpend * 0.25);
                      return (
                        <tr key={c.campaign}>
                          <td style={td()}>
                            {c.campaign}
                            {quiet && <span style={{ marginLeft: 6, fontSize: 10, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '1px 6px' }}>Gone quiet</span>}
                          </td>
                          <td style={{ ...td(), color: MUTED }}>{c.group === 'client' ? 'Client' : 'Candidate'}</td>
                          <td style={td(true)}>{money0(c.spend)}</td>
                          <td style={{ ...td(true), color: MUTED }}>{money0(c.prevSpend)}</td>
                          <td style={td(true)}>{int(c.results)} <span style={{ color: MUTED, fontSize: 10 }}>{c.group === 'client' ? 'leads' : 'apps'}</span></td>
                          <td style={td(true)}>{c.costPerResult == null ? '—' : money2(c.costPerResult)}</td>
                          <td style={td(true)}>{int(c.linkClicks)}</td>
                          <td style={{ ...td(true), color: c.frequency >= 3 ? AM : TEXT }}>{c.frequency ? c.frequency.toFixed(1) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {(['client', 'candidate'] as const).map(g => (
                  <button key={g} onClick={() => setGroup(g)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `.5px solid ${BORDER}`, background: group === g ? '#2a2a2a' : 'transparent', color: group === g ? TEXT : MUTED, cursor: 'pointer' }}>
                    {g === 'client' ? 'Client ads (cost per lead)' : 'Candidate ads (cost per application)'}
                  </button>
                ))}
              </div>
              {ranked && (
                <Grid cols={2}>
                  <AdTable title="Best 5 ads" rows={ranked.best} resultWord={resultWord} />
                  <AdTable title="Worst 5 ads" rows={ranked.worst} resultWord={resultWord} />
                </Grid>
              )}
              <div style={{ fontSize: 10, color: MUTED }}>Ranked by cost per result; ads under $20 spend are left out. Freq. = average times each person saw the ad; 3+ (amber) suggests it is wearing out.</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function nextMonthEndLabel(w: MonthWindow) {
  const [y, mo] = w.month.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo + 1, 0));
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}


// ─── v2 page (Marketing tab v2 brief + mockup, 19 Nov 2026) ───────────────────
const LEVEL_TONE: Record<MktLevel, Pace | 'blue'> = { 'FIX NOW': 'red', PUSH: 'blue', 'THIS WEEK': 'amber', 'SET UP': 'grey', WATCH: 'grey' };
const STATUS_TONE: Record<AdSetStatus, Pace> = { SPIKE: 'red', WATCH: 'amber', STRONG: 'green', OK: 'grey', 'NO NORMAL': 'grey', 'LOW DATA': 'grey' };
const STATUS_ACTION: Record<AdSetStatus, string> = {
  SPIKE: 'Pause or refresh creative', WATCH: 'Check creative and audience', STRONG: 'Scale budget', OK: '',
  'NO NORMAL': 'No results in the 14 days before', 'LOW DATA': 'Under $50 in 3 days',
};
const ragColor = (r: Pace) => (r === 'grey' ? C.text : PACE_COLOR[r]);
const div0 = (a: number, b: number) => (b > 0 ? a / b : 0);
const pctText = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—');
const direction = (cur: number, prev: number) => (cur > prev ? 'up' : cur < prev ? 'down' : 'flat');
const TH: CSSProperties = { ...LABEL, fontSize: 12, textAlign: 'left', padding: '12px 16px', borderBottom: `1px solid ${C.rowBorder}`, whiteSpace: 'nowrap' };
const TD: CSSProperties = { padding: '14px 16px', borderBottom: `1px solid ${C.rowBorder}`, fontSize: 14, color: C.text, verticalAlign: 'top' };
const Sub = ({ children }: { children: ReactNode }) => <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{children}</div>;

function CountTile({ label, unit, c, pw }: { label: string; unit: string; c: CountCheck; pw: string }) {
  return (
    <Tile label={label} chip={<Chip tone={c.rag}>{c.target ? PACE_LABEL[c.rag] : 'SET TARGET'}</Chip>}>
      <Big value={int(c.cur)} color={ragColor(c.rag)} unit={unit} />
      <TextLine>{c.target ? <>Need <strong>{c.needed}</strong> by today · <strong>{c.target}</strong> by month end</> : 'Need [target] by today'}</TextLine>
      <TextLine muted>Same day {pw}: {int(c.prev)} · {direction(c.cur, c.prev)}</TextLine>
    </Tile>
  );
}

function CostTile({ label, unit, c, prev, target, fmt, pw }: { label: string; unit: string; c: CostCheck; prev: number; target: number | null | undefined; fmt: (n: number) => string; pw: string }) {
  const chip = c.rag === 'grey' || c.worsePct == null
    ? <Chip tone="grey">NO DATA</Chip>
    : <Chip tone={c.rag}>{Math.abs(Math.round(c.worsePct))}% {c.worsePct > 0 ? 'WORSE' : 'BETTER'}</Chip>;
  return (
    <Tile label={label} chip={chip}>
      <Big value={fmt(c.cur)} color={ragColor(c.rag)} unit={unit} />
      <TextLine>Target {target ? fmt(target) : '[max $]'}</TextLine>
      <TextLine muted>Same day {pw}: {fmt(prev)}</TextLine>
    </Tile>
  );
}

function Step({ label, value, color, children, edge }: { label: string; value: string; color: string; children: ReactNode; edge?: string }) {
  return (
    <div style={{ background: C.inset, border: `1px solid ${edge ?? C.border}`, borderRadius: 10, padding: 14, flex: '1 1 150px', minWidth: 0 }}>
      <div style={{ ...LABEL, fontSize: 11 }}>{label}</div>
      <div style={{ fontFamily: NUM_FONT, fontSize: 30, fontWeight: 700, color, margin: '4px 0' }}>{value}</div>
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}
const Arrow = ({ rate }: { rate?: string }) => (
  <div style={{ alignSelf: 'center', textAlign: 'center', color: C.muted, fontSize: 12, minWidth: 36 }}>{rate}<div style={{ fontSize: 18 }}>→</div></div>
);

function Strip({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ ...CARD, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
    </div>
  );
}

const MSG_ROW = (cols: number, text: string) => (
  <tr><td colSpan={cols} style={{ ...TD, color: C.muted }}>{text}</td></tr>
);

function MarketingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Skeleton height={200} radius={12} />
      <div style={{ display: 'flex', gap: 12 }}>{[0, 1, 2, 3].map(i => <Skeleton key={i} height={140} radius={12} style={{ flex: 1 }} />)}</div>
      <Skeleton height={200} radius={12} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function MarketingCard() {
  const role = useAuthRole();
  const [month, setMonth] = useState(currentMonthKey);
  const [showSettings, setShowSettings] = useState(false);
  const w = monthWindow(month);
  const ctx: RagContext = { isCurrent: w.isCurrent, dayOfMonth: w.dayOfMonth };
  const pw = w.prevShortLabel;

  const { data: m, error, isLoading, isFetching } = useMarketingMonth(month);
  const { data: organic, error: organicError } = useOrganicMonth(month);
  const { data: settings } = useMarketingSettings();
  const { data: voice } = useVoiceCallKPIs('month');
  const { data: adSetRows, error: adSetError } = useMetaAdSets();
  const { data: demand, error: demandError, isLoading: demandLoading } = useMarketingDemand();
  const budget = settings?.monthlyBudget ?? null;
  const postsPerWeek = settings?.postsPerWeek ?? 7;

  const header = (
    <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 style={{ margin: 0, fontFamily: NUM_FONT, fontSize: 34, fontWeight: 700, letterSpacing: '-0.5px', color: C.text }}>Marketing</h1>
        <p style={{ margin: 0, fontSize: 14, color: C.muted }}>
          {w.isCurrent
            ? `${new Date().toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Pacific/Auckland' }).replace(',', '')} · Day ${w.dayOfMonth} of ${w.daysInMonth} (ads run every day)`
            : `${w.label} · full month`}
          {' · '}Marketing’s job ends at calls booked and qualified candidates
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isFetching && <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${C.border}`, borderTopColor: C.red, animation: 'spin 0.7s linear infinite' }} />}
        {role === 'admin' && settings && (
          <button onClick={() => setShowSettings(true)} style={{ height: 44, background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '0 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Edit targets</button>
        )}
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          aria-label="Month"
          style={{ height: 44, background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '0 12px', fontSize: 14 }}
        >
          {recentMonthKeys(12).map(k => <option key={k} value={k}>{monthWindow(k).label}</option>)}
        </select>
      </div>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </header>
  );

  if (isLoading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>{header}<MarketingSkeleton /></div>;
  if (!m) {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>{header}<p style={{ color: C.amber, fontSize: 12 }}>⚠ Marketing data unavailable{error ? ` — ${error.message}` : ''}</p></div>;
  }

  const t = settings?.targets;
  const h = m.handoff;
  const { cur, prev } = m.paid;
  const adSets = adSetRows ? adSetChecks(adSetRows.rows, adSetRows.today) : undefined;
  const flagged = adSets?.filter(a => a.status === 'SPIKE' || a.status === 'WATCH').length;
  const clientSpend3 = (trade: string) => (adSets ?? []).filter(a => a.group === 'client' && a.trade === trade).reduce((t, a) => t + a.spend3, 0);
  const actions = marketingActions(m, organic, settings, w, { adSets, demand: demand?.error ? undefined : demand });
  const demandMsg = demandLoading ? 'Loading from JobAdder…' : demandError || demand?.error ? `⚠ ${demandError?.message ?? demand?.error}` : null;
  const calls = countCheck(h.cur.callsBooked, h.prev.callsBooked, t?.callsBooked, w);
  const qual = countCheck(h.cur.qualifiedCandidates, h.prev.qualifiedCandidates, t?.qualifiedCandidates, w);
  const callCost = costCheck(h.cur.costPerBookedCall, h.prev.costPerBookedCall, t?.costPerBookedCall, ctx, pw, money0);
  const qualCost = costCheck(h.cur.costPerQualifiedCandidate, h.prev.costPerQualifiedCandidate, t?.costPerQualifiedCandidate, ctx, pw, money2);
  const cpl = costCheck(div0(cur.client.spend, cur.client.leads), div0(prev.client.spend, prev.client.leads), null, ctx, pw, money2);
  const cpa = costCheck(div0(cur.candidate.spend, cur.candidate.applications), div0(prev.candidate.spend, prev.candidate.applications), null, ctx, pw, money2);
  const spend = budgetCheck(cur.totalSpend, budget, w);
  const breakText = biggestMarketingBreak(m, settings, w);

  // Organic, per channel
  const target = postsTarget(postsPerWeek, w);
  const channels = [
    { name: 'Stand Up Facebook', handle: 'Stand Up Recruitment page', ch: organic?.facebook, post: 'Facebook' },
    { name: 'Stand Up Instagram', handle: '@standuprecruitment', ch: organic?.instagram, post: 'Instagram' },
    { name: 'Les, Instagram', handle: 'Personal account', ch: organic?.les, post: 'Les Instagram' },
  ];

  // Trend: spend per month with calls booked and qualified candidates as lines
  const trend = m.spendSeries.map(s => {
    const hs = m.handoffSeries.find(x => x.key === s.key);
    return { label: s.label, spend: s.client + s.candidate, calls: hs?.callsBooked ?? null, qualified: hs?.qualifiedCandidates ?? null, partial: w.isCurrent && s.key === month };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, color: C.text }}>
      {header}
      {error && <p style={{ color: C.amber, fontSize: 12, margin: 0 }}>⚠ Showing last loaded data — {error.message}</p>}

      {/* 1. Today's actions */}
      <Section title="Today’s actions" aside={w.isCurrent ? 'Who does what today · auto-built from the sections below' : `For ${w.label} · today’s actions show on the current month`}>
        {w.isCurrent && (
          <div style={{ ...CARD, overflow: 'hidden' }}>
            {actions.length === 0 && <div style={{ padding: '16px 20px', fontSize: 14, color: C.muted }}>Nothing flagged today.</div>}
            {actions.map((a, i) => (
              <div key={i} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, padding: '16px 20px', borderBottom: i < actions.length - 1 ? `1px solid ${C.rowBorder}` : undefined }}>
                <Chip tone={LEVEL_TONE[a.level]} width={92}>{a.level}</Chip>
                <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{a.who}<span style={{ color: C.faint }}> · </span>{a.title}</div>
                  <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.45 }}>{a.detail}</div>
                </div>
                <div style={{ ...TODO, flex: '0 1 260px', fontSize: 14, padding: '10px 12px' }}>{a.action}</div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 2. Are we on track? */}
      <Section title="Are we on track?" aside={<Tag bg={C.soft}>WHAT MARKETING DELIVERED · {w.isCurrent ? 'THIS MONTH' : w.label.toUpperCase()}</Tag>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <CountTile label="CALLS BOOKED (TO SALES)" unit="calls" c={calls} pw={pw} />
          <CountTile label="QUALIFIED CANDIDATES" unit="candidates" c={qual} pw={pw} />
          <CostTile label="COST PER BOOKED CALL" unit="per call" c={callCost} prev={h.prev.costPerBookedCall} target={t?.costPerBookedCall} fmt={money0} pw={pw} />
          <CostTile label="COST PER QUALIFIED CANDIDATE" unit="each" c={qualCost} prev={h.prev.costPerQualifiedCandidate} target={t?.costPerQualifiedCandidate} fmt={money2} pw={pw} />
        </div>
      </Section>

      {/* 3. Where should the ads point? */}
      <Section title="Where should the ads point?" aside={<Tag bg={C.blue}>DEMAND SIGNALS · FROM JOBADDER</Tag>}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ ...CARD, overflowX: 'auto', flex: '1 1 640px' }}>
            <div style={{ padding: '16px 16px 4px' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Candidate shortages → push candidate ads</div>
              <Sub>A trade with jobs open 30+ days and fewer than 2 Ready-to-Go per open job</Sub>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['TRADE', 'OPEN JOBS', 'STALE', 'READY-TO-GO', 'TELL BRINDA'].map(x => <th key={x} style={TH}>{x}</th>)}</tr></thead>
              <tbody>
                {demandMsg ? MSG_ROW(5, demandMsg) : demand!.shortages.length === 0 ? MSG_ROW(5, 'No shortages: every trade with stale jobs has 2+ Ready-to-Go per job.') : demand!.shortages.map(r => (
                  <tr key={r.trade}>
                    <td style={{ ...TD, fontWeight: 600 }}>{r.trade}</td>
                    <td style={TD}>{r.openJobs}</td>
                    <td style={{ ...TD, color: C.red, fontWeight: 600 }}>{r.stale}</td>
                    <td style={{ ...TD, color: C.red, fontWeight: 600 }}>{r.readyToGo}</td>
                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>Push candidate ads</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ ...CARD, overflowX: 'auto', flex: '1 1 640px' }}>
            <div style={{ padding: '16px 16px 4px' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Candidates building up → push client ads</div>
              <Sub>Ready-to-Go in a trade + location more than 2× the open jobs there</Sub>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['TRADE → LOCATION', 'READY-TO-GO', 'OPEN JOBS', 'SPEND, 3 DAYS', 'TELL BRINDA'].map(x => <th key={x} style={TH}>{x}</th>)}</tr></thead>
              <tbody>
                {demandMsg ? MSG_ROW(5, demandMsg) : demand!.buildUp.length === 0 ? MSG_ROW(5, 'Nothing building up: Ready-to-Go is in line with open jobs everywhere.') : demand!.buildUp.slice(0, 6).map(r => (
                  <tr key={`${r.trade}|${r.region}`}>
                    <td style={{ ...TD, fontWeight: 600 }}>{r.trade} → {r.region}</td>
                    <td style={{ ...TD, color: C.green, fontWeight: 600 }}>{r.readyToGo}</td>
                    <td style={{ ...TD, color: r.openJobs ? C.text : C.red }}>{r.openJobs}</td>
                    <td style={{ ...TD, color: adSets && clientSpend3(r.trade) === 0 ? C.red : C.text }}>{adSets ? money0(clientSpend3(r.trade)) : '—'}</td>
                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>Run client ads here</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {demand && !demand.error && (
          <div style={{ fontSize: 12, color: C.muted }}>
            {demand.jobsMatched} of {demand.openJobs} open jobs and {demand.readyMatched} of {demand.readyToGo} Ready To Go candidates matched to a trade
            (job title; candidate’s Airtable category). Locations are grouped by state. {demand.buildUp.length > 6 && `Showing the top 6 of ${demand.buildUp.length}.`}
          </div>
        )}
      </Section>

      {/* 4. Paid ads, Brinda's check */}
      <Section title="Paid ads · Brinda’s morning check" aside="Every ad set against its own normal · worst first">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <Tile label="SPEND VS BUDGET" chip={null}>
            <Big size={34} value={`${money0(cur.totalSpend)} / ${budget ? money0(budget) : '[ ]'}`} color={budget ? ragColor(spend.rag) : C.faint} />
            <TextLine muted>{budget
              ? `${Math.round(spend.usedPct!)}% used · should be at ${Math.round(spend.duePct!)}% today`
              : `Budget not set · ${w.isCurrent ? `${Math.round((w.dayOfMonth / w.daysInMonth) * 100)}% of the month gone` : 'full month'}`}</TextLine>
          </Tile>
          <Tile label="CLIENT COST PER LEAD" chip={null}>
            <Big size={34} value={money2(cpl.cur)} color={ragColor(cpl.rag)} />
            <TextLine muted>{pw} same day {money2(cpl.cmp)}{cpl.worsePct != null && ` · ${Math.abs(Math.round(cpl.worsePct))}% ${cpl.worsePct > 0 ? 'worse' : 'better'}`}</TextLine>
          </Tile>
          <Tile label="CANDIDATE COST PER APPLICATION" chip={null}>
            <Big size={34} value={money2(cpa.cur)} color={ragColor(cpa.rag)} />
            <TextLine muted>{pw} same day {money2(cpa.cmp)}{cpa.worsePct != null && ` · ${Math.abs(Math.round(cpa.worsePct))}% ${cpa.worsePct > 0 ? 'worse' : 'better'}`}</TextLine>
          </Tile>
          <Tile label="AD SETS FLAGGED" chip={null}>
            <Big size={34} value={flagged ?? '—'} color={flagged ? C.red : flagged === 0 ? C.green : C.faint} />
            <TextLine muted>{adSetError ? `⚠ ${adSetError.message}` : 'Spiking or watch vs their own normal'}</TextLine>
          </Tile>
        </div>
        {adSets && (
          <div style={{ ...CARD, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['AD SET (SIDE_TRADE_LOCATION)', 'STATUS', 'COST / RESULT 3 DAYS', 'ITS NORMAL (14 DAYS)', 'CHANGE', 'ACTION'].map(x => <th key={x} style={TH}>{x}</th>)}</tr></thead>
              <tbody>
                {adSets.length === 0 && MSG_ROW(6, 'No ad set spend in the last 17 days.')}
                {adSets.map(a => (
                  <tr key={a.id}>
                    <td style={{ ...TD, fontWeight: 600 }}>
                      {a.adset}
                      <Sub>{a.group === 'client' ? 'Client' : 'Candidate'} · {money0(a.spend3)} in 3 days{!a.named && ' · not named Side_Trade_Location'}</Sub>
                    </td>
                    <td style={TD}><Chip tone={STATUS_TONE[a.status]}>{a.status}</Chip></td>
                    <td style={{ ...TD, color: a.status === 'SPIKE' ? C.red : C.text }}>{a.cost3 != null ? money2(a.cost3) : `0 ${a.group === 'client' ? 'leads' : 'apps'}`}</td>
                    <td style={TD}>{a.normal != null ? money2(a.normal) : '—'}</td>
                    <td style={{ ...TD, color: a.changePct == null ? C.muted : a.changePct >= 20 ? C.red : a.changePct <= -20 ? C.green : C.text }}>
                      {a.changePct == null ? '—' : `${a.changePct > 0 ? '+' : ''}${Math.round(a.changePct)}%`}
                    </td>
                    <td style={TD}>{STATUS_ACTION[a.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <CampaignsAndAds month={month} prevWord={pw} />
      </Section>

      {/* 5. Organic, Emma's check */}
      <Section title="Organic · Emma’s morning check" aside="Brand building · scored on reach and growth, not leads">
        {(organicError || organic?.error) && <p style={{ color: C.amber, fontSize: 12, margin: 0 }}>⚠ {organicError?.message ?? organic?.error}</p>}
        <div style={{ ...CARD, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['CHANNEL', 'POSTS', 'VIEWS', 'ENGAGEMENT', 'FOLLOWER GROWTH', 'BEST POST THIS MONTH'].map(x => <th key={x} style={TH}>{x}</th>)}</tr></thead>
            <tbody>
              {channels.map(({ name, handle, ch, post }) => {
                const on = ch?.connected;
                const postsRag = on ? pace(ch!.posts, target) : 'grey';
                const viewsRag = on ? rate(ch!.views, ch!.prevViews, 'up', ctx) : 'grey';
                const engRag = on ? rate(ch!.engagement, ch!.prevEngagement, 'up', ctx) : 'grey';
                const net = on && ch!.followers != null && ch!.prevMonthFollowers != null ? ch!.followers - ch!.prevMonthFollowers : null;
                const best = organic?.topPosts?.find(p => p.channel === post);
                return (
                  <tr key={name}>
                    <td style={TD}><div style={{ fontWeight: 600 }}>{name}</div><Sub>{handle}</Sub></td>
                    <td style={TD}>
                      <span style={{ fontFamily: NUM_FONT, fontSize: 18, fontWeight: 700, color: on ? ragColor(postsRag) : C.faint }}>{on ? int(ch!.posts ?? 0) : '[ ]'} / {target}</span>
                      <Sub>done / needed</Sub>
                    </td>
                    <td style={TD}>
                      <span style={{ fontFamily: NUM_FONT, fontSize: 18, fontWeight: 700, color: on && ch!.views != null ? ragColor(viewsRag) : C.faint }}>{on && ch!.views != null ? int(ch!.views) : '[ ]'}</span>
                      <Sub>{!on ? 'Not connected' : ch!.views == null ? 'Waiting on Page insights access' : ch!.prevViews != null ? `${pw} same day ${int(ch!.prevViews)}` : `No ${pw} figure yet`}</Sub>
                    </td>
                    <td style={TD}>
                      <span style={{ fontFamily: NUM_FONT, fontSize: 18, fontWeight: 700, color: on ? ragColor(engRag) : C.faint }}>{on ? int(ch!.engagement ?? 0) : '[ ]'}</span>
                      <Sub>{!on ? 'Not connected' : ch!.prevEngagement != null ? `${pw} same day ${int(ch!.prevEngagement)}` : 'Likes, comments, shares'}</Sub>
                    </td>
                    <td style={TD}>
                      <span style={{ fontFamily: NUM_FONT, fontSize: 18, fontWeight: 700, color: net == null ? C.faint : C.text }}>{net == null ? '[ ]' : `${net >= 0 ? '+' : ''}${int(net)}`}</span>
                      <Sub>{!on ? 'Not connected' : net != null ? `since end of ${pw}` : `Tracking starts ${nextMonthEndLabel(w)}`}</Sub>
                    </td>
                    <td style={{ ...TD, maxWidth: 280 }}>
                      {!on ? <span style={{ color: C.muted }}>Connect account</span> : best ? (
                        <>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {best.permalink ? <a href={best.permalink} target="_blank" rel="noreferrer" style={{ color: C.text, textDecoration: 'none' }}>{best.caption || '(no caption)'}</a> : (best.caption || '(no caption)')}
                          </div>
                          <Sub>{best.views != null ? `${int(best.views)} views · ` : ''}{int(best.engagement)} engagement</Sub>
                        </>
                      ) : <span style={{ color: C.muted }}>Not in this month’s top 5</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 6. Where is it breaking? */}
      <Section title="Where is it breaking?" aside="Spend through to handoff">
        {breakText && (
          <div style={{ background: '#2A2114', border: '1px solid #6B5022', borderRadius: 14, padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'center' }}>
            <Chip tone="amber">BIGGEST BREAK</Chip>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{breakText}</span>
          </div>
        )}
        <Strip title="CLIENT SIDE · finding employers">
          <Step label="AD SPEND" value={money0(cur.client.spend)} color={C.text}>Same day {pw} {money0(prev.client.spend)}</Step>
          <Arrow />
          <Step label="LINK CLICKS" value={int(cur.client.linkClicks)} color={C.text}>{money2(div0(cur.client.spend, cur.client.linkClicks))} per click<br />{pw} {money2(div0(prev.client.spend, prev.client.linkClicks))}</Step>
          <Arrow rate={pctText(cur.client.leads, cur.client.linkClicks)} />
          <Step label="LEADS (META)" value={int(cur.client.leads)} color={ragColor(cpl.rag)} edge={cpl.rag === 'grey' ? undefined : PACE_COLOR[cpl.rag]}>{money2(cpl.cur)} per lead<br />{pw} {money2(cpl.cmp)}</Step>
          <Arrow rate={pctText(h.cur.callsBooked, cur.client.leads)} />
          <Step label="CALLS BOOKED" value={int(h.cur.callsBooked)} color={ragColor(callCost.rag)} edge={callCost.rag === 'grey' ? undefined : PACE_COLOR[callCost.rag]}>{money0(callCost.cur)} per call · vs {callCost.vs}<br />handoff to Sales</Step>
        </Strip>
        <Strip title="CANDIDATE SIDE · finding tradies">
          <Step label="AD SPEND" value={money0(cur.candidate.spend)} color={C.text}>Same day {pw} {money0(prev.candidate.spend)}</Step>
          <Arrow />
          <Step label="LINK CLICKS" value={int(cur.candidate.linkClicks)} color={C.text}>{money2(div0(cur.candidate.spend, cur.candidate.linkClicks))} per click<br />{pw} {money2(div0(prev.candidate.spend, prev.candidate.linkClicks))}</Step>
          <Arrow rate={pctText(cur.candidate.applications, cur.candidate.linkClicks)} />
          <Step label="APPLICATIONS (META)" value={int(cur.candidate.applications)} color={ragColor(cpa.rag)} edge={cpa.rag === 'grey' ? undefined : PACE_COLOR[cpa.rag]}>{money2(cpa.cur)} each<br />{pw} {money2(cpa.cmp)}</Step>
          <Arrow rate={pctText(h.cur.qualifiedCandidates, cur.candidate.applications)} />
          <Step label="QUALIFIED" value={int(h.cur.qualifiedCandidates)} color={ragColor(qualCost.rag)} edge={qualCost.rag === 'grey' ? undefined : PACE_COLOR[qualCost.rag]}>{money2(qualCost.cur)} each · vs {qualCost.vs}<br />{m.qualifiedByTrade.length ? m.qualifiedByTrade.slice(0, 3).map(q => `${q.trade} ${q.count}`).join(' · ') : 'No trades yet'} · handoff to Recruitment</Step>
        </Strip>
        <div style={{ fontSize: 12, color: C.muted }}>
          Arrows show the share that moved to the next step. Applications → qualified is {pctText(h.cur.qualifiedCandidates, cur.candidate.applications)} of Meta applications (qualified ÷ Meta applications).
        </div>
        <div style={{ ...CARD, padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'center' }}>
          <Chip tone="grey">HANDOFF WATCH</Chip>
          <span style={{ fontSize: 14, color: C.soft }}>
            After the handoff, Recruitment and Sales own it. {w.isCurrent
              ? <>This month: {int(h.cur.qualifiedCandidates)} qualified candidates delivered, bot dialled {voice ? int(voice.teamLeads) : '[ ]'} (Recruitment tab).</>
              : <>{w.label}: {int(h.cur.qualifiedCandidates)} qualified candidates delivered.</>}
          </span>
        </div>
      </Section>

      {/* 7. Trend */}
      <Section title="Trend" aside="Ad spend per month · calls booked and qualified candidates as lines">
        <div style={{ ...CARD, padding: '16px 16px 8px' }}>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={trend} margin={{ top: 22, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="s" hide />
              <YAxis yAxisId="c" hide />
              <YAxis yAxisId="q" hide />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card }} labelStyle={{ color: C.text }}
                formatter={(v, n) => [n === 'Ad spend' ? money0(Number(v)) : v == null ? '—' : int(Number(v)), String(n)]}
              />
              <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, color: C.muted }} />
              <Bar yAxisId="s" dataKey="spend" name="Ad spend" fill={C.soft} maxBarSize={56} radius={[4, 4, 0, 0]}>
                {trend.map((d, i) => <Cell key={i} fill={d.partial ? 'transparent' : C.soft} stroke={d.partial ? C.soft : undefined} strokeDasharray={d.partial ? '4 3' : undefined} />)}
                <LabelList dataKey="spend" position="top" formatter={(v) => kShort(Number(v))} style={{ fontSize: 11, fill: C.text }} />
              </Bar>
              <Line yAxisId="c" dataKey="calls" name="Calls booked" stroke={C.blue} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line yAxisId="q" dataKey="qualified" name="Qualified candidates" stroke={C.green} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
          {w.isCurrent && <div style={{ fontSize: 11, color: C.muted, textAlign: 'right' }}>Dashed bar = {w.shortLabel} so far</div>}
        </div>
      </Section>

      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
        <span style={{ color: C.green, fontWeight: 600 }}>Green</span> at or ahead of target by today ·{' '}
        <span style={{ color: C.amber, fontWeight: 600 }}>Amber</span> counts 75–99% of needed, costs up to 20% over ·{' '}
        <span style={{ color: C.red, fontWeight: 600 }}>Red</span> counts under 75%, costs 20%+ over ·{' '}
        <span style={{ fontWeight: 600 }}>Grey</span> no target or no data. Until targets are set, costs compare to same day last month.<br />
        Needed by today = monthly target × days elapsed ÷ days in month (calendar days, ads run every day). Paid figures are Meta-reported.
        Calls booked = client leads with a booked meeting, by booking date (Airtable). Qualified = NZ citizen whose category is a skilled trade (Airtable).
      </div>

      {showSettings && settings && <SettingsPanel settings={settings} suggested={suggestedTargets(m)} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
