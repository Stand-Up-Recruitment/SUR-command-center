import { useState, type ReactNode } from 'react';
import {
  BarChart, Bar, ComposedChart, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Legend,
} from 'recharts';
import { Skeleton } from '../shared/Skeleton';
import { useMarketingMonth, useOrganicMonth, useMarketingSettings, useSaveMarketingSettings } from '../../hooks/queries';
import { useAuthRole } from '../auth/AuthContext';
import { monthWindow, recentMonthKeys, currentMonthKey, type MonthWindow } from '../../lib/nzTime';
import { rate, pctChange, isTooEarly, type Rag, type Better, type RagContext } from '../../lib/rag';
import { diagnose, type DiagMetric } from '../../lib/diagnosis';
import type { MarketingMonth, OrganicChannel, OrganicMonth, MarketingSettings } from '../../types';

// ─── Palette (shared with the Finance tab) ────────────────────────────────────
const NZ     = '#1D9E75';
const AM     = '#BA7517';
const RD     = '#D85A30';
const GREY   = '#5a5a5a';
const BG     = '#111111';
const BG2    = '#1a1a1a';
const BORDER = 'rgba(255,255,255,0.10)';
const TEXT   = '#f5f5f5';
const MUTED  = '#a3a3a3';
const CLIENT_BAR = '#8a8a8a';

const RAG_COLOR: Record<Rag, string> = { green: NZ, amber: AM, red: RD, grey: GREY };

// ─── Formatters ───────────────────────────────────────────────────────────────
const money0 = (n: number) => `$${Math.round(n).toLocaleString('en-NZ')}`;
const money2 = (n: number) => `$${n.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const int = (n: number) => Math.round(n).toLocaleString('en-NZ');
const kShort = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`);
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', timeZone: 'Pacific/Auckland' });

// ─── Layout helpers ───────────────────────────────────────────────────────────
function Section({ n, title, sub, children }: { n: number; title: string; sub?: string; children: ReactNode }) {
  return (
    <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, padding: '1.25rem', marginBottom: '.875rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '.875rem' }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#2a2a2a', color: MUTED, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</div>
        <span style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>{title}</span>
        <div style={{ flex: 1 }} />
        {sub && <span style={{ fontSize: 11, color: MUTED, textAlign: 'right' }}>{sub}</span>}
      </div>
      {children}
    </div>
  );
}

function SubHead({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, margin: '.75rem 0 .5rem' }}>{children}</div>;
}

function Grid({ cols, children }: { cols: number | string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: typeof cols === 'number' ? `repeat(${cols}, minmax(0,1fr))` : cols, gap: 10, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function Metric({ label, value, rag, children, muted }: { label: string; value?: string; rag: Rag; children?: ReactNode; muted?: boolean }) {
  return (
    <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderLeft: `3px solid ${RAG_COLOR[rag]}`, borderRadius: 8, padding: '.875rem 1rem', minHeight: 78 }}>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>{label}</div>
      {value != null && <div style={{ fontSize: 24, fontWeight: 600, color: muted ? MUTED : TEXT, lineHeight: 1.1, marginBottom: 6 }}>{value}</div>}
      <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

/** "Aug $5,522 ▼ 14.5%" — the arrow/percent takes the card's colour (muted when grey). */
function Delta({ prefix, prevText, cur, prev, rag, pts }: { prefix: string; prevText: string; cur: number; prev: number; rag: Rag; pts?: boolean }) {
  const color = rag === 'grey' ? MUTED : RAG_COLOR[rag];
  if (pts) {
    const d = cur - prev;
    return <>{prefix} {prevText} <span style={{ color }}>{d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)} pts</span></>;
  }
  const pct = pctChange(cur, prev);
  return <>{prefix} {prevText}{pct != null && <span style={{ color }}> {pct >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%</span>}</>;
}

// ─── Card builders ────────────────────────────────────────────────────────────
interface Cmp { label: string; cur: number; prev: number; better: Better; fmt: (n: number) => string; neutral?: boolean; prevWord: string; pts?: boolean }

function cmpRag(c: Cmp, ctx: RagContext): Rag {
  return c.neutral ? 'grey' : rate(c.cur, c.prev, c.better, ctx);
}

function CmpCard({ c, ctx }: { c: Cmp; ctx: RagContext }) {
  return (
    <Metric label={c.label} value={c.fmt(c.cur)} rag={cmpRag(c, ctx)}>
      <Delta prefix={c.prevWord} prevText={c.fmt(c.prev)} cur={c.cur} prev={c.prev} rag={cmpRag(c, ctx)} pts={c.pts} />
    </Metric>
  );
}

// ─── Settings panel ───────────────────────────────────────────────────────────
function SettingsPanel({ settings, onClose }: { settings: MarketingSettings; onClose: () => void }) {
  const save = useSaveMarketingSettings();
  const [budget, setBudget] = useState(settings.monthlyBudget != null ? String(settings.monthlyBudget) : '');
  const [posts, setPosts] = useState(String(settings.postsPerWeek));
  const [password, setPassword] = useState('');
  const input = { background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };

  const submit = () => {
    save.mutate(
      { settings: { monthlyBudget: budget.trim() === '' ? null : Number(budget), postsPerWeek: Number(posts) }, adminPassword: password },
      { onSuccess: onClose },
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '1.25rem', width: 340 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 14 }}>Marketing settings</div>
        <label style={{ fontSize: 11, color: MUTED }}>Monthly ad budget (NZD)</label>
        <input style={{ ...input, margin: '4px 0 12px' }} type="number" min={0} value={budget} placeholder="Not set" onChange={e => setBudget(e.target.value)} />
        <label style={{ fontSize: 11, color: MUTED }}>Posting target (posts per week, per channel)</label>
        <input style={{ ...input, margin: '4px 0 12px' }} type="number" min={1} step={1} value={posts} onChange={e => setPosts(e.target.value)} />
        <label style={{ fontSize: 11, color: MUTED }}>Admin password</label>
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

// ─── Sections ─────────────────────────────────────────────────────────────────
function PaidSection({ m, w, ctx, budget }: { m: MarketingMonth; w: MonthWindow; ctx: RagContext; budget: number | null }) {
  const { cur, prev } = m.paid;
  const pw = w.prevShortLabel;
  const spend = cur.totalSpend;
  const over = budget != null && spend > budget;
  const spendRag: Rag = budget == null ? 'grey' : over ? 'red' : isTooEarly(ctx) ? 'grey' : 'green';
  const used = budget ? (spend / budget) * 100 : null;

  return (
    <Section n={2} title="Paid: Meta ads" sub={`Meta-reported, ${w.cur.since.slice(8).replace(/^0/, '')}–${w.cur.until.slice(8).replace(/^0/, '')} ${w.shortLabel} vs ${w.prev.since.slice(8).replace(/^0/, '')}–${w.prev.until.slice(8).replace(/^0/, '')} ${pw}`}>
      <Grid cols={4}>
        <Metric label="Ad spend vs monthly budget" value={money0(spend)} rag={spendRag}>
          {budget == null
            ? 'Budget not set'
            : <>Budget {money0(budget)} <span style={{ color: over ? RD : MUTED }}>{used!.toFixed(0)}% used</span></>}
          {used != null && (
            <div style={{ background: '#2a2a2a', borderRadius: 3, height: 5, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(used, 100)}%`, height: '100%', background: over ? RD : NZ }} />
            </div>
          )}
        </Metric>
        <CmpCard ctx={ctx} c={{ label: 'Client ads spend', cur: cur.client.spend, prev: prev.client.spend, better: 'down', fmt: money0, neutral: true, prevWord: pw }} />
        <CmpCard ctx={ctx} c={{ label: 'Candidate ads spend', cur: cur.candidate.spend, prev: prev.candidate.spend, better: 'down', fmt: money0, neutral: true, prevWord: pw }} />
        <CmpCard ctx={ctx} c={{ label: 'Total impressions', cur: cur.impressions, prev: prev.impressions, better: 'up', fmt: int, neutral: true, prevWord: pw }} />
      </Grid>

      <SubHead>Client ads</SubHead>
      <Grid cols={4}>
        {paidClientCards(m, pw).map(c => <CmpCard key={c.label} c={c} ctx={ctx} />)}
      </Grid>
      <SubHead>Candidate ads</SubHead>
      <Grid cols={4}>
        {paidCandidateCards(m, pw).map(c => <CmpCard key={c.label} c={c} ctx={ctx} />)}
      </Grid>

      <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, padding: '.875rem 1rem' }}>
        <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>Spend by month, last 12 months</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={m.spendSeries.map(s => ({ ...s, total: s.client + s.candidate }))} margin={{ top: 18, right: 8, left: 8, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${BORDER}`, background: BG2 }} labelStyle={{ color: TEXT }} formatter={(v, n) => [money0(Number(v)), String(n)]} />
            <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 10, color: MUTED }} />
            <Bar dataKey="candidate" name="Candidate ads" stackId="s" fill={RD} maxBarSize={44} />
            <Bar dataKey="client" name="Client ads" stackId="s" fill={CLIENT_BAR} maxBarSize={44} radius={[3, 3, 0, 0]}>
              <LabelList dataKey="total" position="top" formatter={(v) => kShort(Number(v))} style={{ fontSize: 9, fill: MUTED }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

const div0 = (a: number, b: number) => (b > 0 ? a / b : 0);

function paidClientCards(m: MarketingMonth, pw: string): Cmp[] {
  const c = m.paid.cur.client, p = m.paid.prev.client;
  return [
    { label: 'Link clicks', cur: c.linkClicks, prev: p.linkClicks, better: 'up', fmt: int, prevWord: pw },
    { label: 'Cost per click', cur: div0(c.spend, c.linkClicks), prev: div0(p.spend, p.linkClicks), better: 'down', fmt: money2, prevWord: pw },
    { label: 'Leads (Meta-reported)', cur: c.leads, prev: p.leads, better: 'up', fmt: int, prevWord: pw },
    { label: 'Cost per lead', cur: div0(c.spend, c.leads), prev: div0(p.spend, p.leads), better: 'down', fmt: money2, prevWord: pw },
  ];
}

function paidCandidateCards(m: MarketingMonth, pw: string): Cmp[] {
  const c = m.paid.cur.candidate, p = m.paid.prev.candidate;
  return [
    { label: 'Link clicks', cur: c.linkClicks, prev: p.linkClicks, better: 'up', fmt: int, prevWord: pw },
    { label: 'Cost per click', cur: div0(c.spend, c.linkClicks), prev: div0(p.spend, p.linkClicks), better: 'down', fmt: money2, prevWord: pw },
    { label: 'Applications (Meta-reported)', cur: c.applications, prev: p.applications, better: 'up', fmt: int, prevWord: pw },
    { label: 'Cost per application', cur: div0(c.spend, c.applications), prev: div0(p.spend, p.applications), better: 'down', fmt: money2, prevWord: pw },
  ];
}

function handoffCards(m: MarketingMonth, pw: string): Cmp[] {
  const c = m.handoff.cur, p = m.handoff.prev;
  const same = `Same day ${pw}`;
  return [
    { label: 'Calls booked (to sales)', cur: c.callsBooked, prev: p.callsBooked, better: 'up', fmt: int, prevWord: same },
    { label: 'Cost per booked call (month)', cur: c.costPerBookedCall, prev: p.costPerBookedCall, better: 'down', fmt: money0, prevWord: same },
    { label: 'Qualified candidates (to recruiters)', cur: c.qualifiedCandidates, prev: p.qualifiedCandidates, better: 'up', fmt: int, prevWord: same },
    { label: 'Qual rate', cur: c.qualRate, prev: p.qualRate, better: 'up', fmt: n => `${n.toFixed(1)}%`, prevWord: same, pts: true },
  ];
}

function cacCards(m: MarketingMonth): Cmp[] {
  return [
    { label: 'CAC per booked call', cur: m.cac.cur.cacPerBookedCall, prev: m.cac.prev.cacPerBookedCall, better: 'down', fmt: money0, prevWord: 'Last month' },
    { label: 'CAC per qualified candidate', cur: m.cac.cur.cacPerQualifiedCandidate, prev: m.cac.prev.cacPerQualifiedCandidate, better: 'down', fmt: money0, prevWord: 'Last month' },
  ];
}

function postsTarget(postsPerWeek: number, w: MonthWindow) {
  return Math.round((postsPerWeek * w.dayOfMonth) / 7);
}

function nextMonthEndLabel(w: MonthWindow) {
  const [y, mo] = w.month.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo + 1, 0));
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function ChannelRow({ name, handle, ch, target, ctx, w, fbInsights }: {
  name: string; handle: string; ch: OrganicChannel; target: number; ctx: RagContext; w: MonthWindow; fbInsights?: boolean;
}) {
  const labelCard = (
    <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, padding: '.875rem 1rem' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{name}</div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{handle}</div>
    </div>
  );
  if (!ch.connected) {
    return (
      <Grid cols="0.8fr 1fr 1fr 1fr 1fr">
        {labelCard}
        {['Posts', 'Views', 'Engagement', 'Followers'].map(l => <Metric key={l} label={l} rag="grey">Not connected yet</Metric>)}
      </Grid>
    );
  }
  const pw = w.prevShortLabel;
  const postsRag = rate(ch.posts, target, 'up', ctx);
  const waiting = fbInsights ? 'Waiting on Page insights access' : 'Not available';
  const viewsRag = rate(ch.views, ch.prevViews, 'up', ctx);
  const engRag = rate(ch.engagement, ch.prevEngagement, 'up', ctx);
  const net = ch.followers != null && ch.prevMonthFollowers != null ? ch.followers - ch.prevMonthFollowers : null;
  return (
    <Grid cols="0.8fr 1fr 1fr 1fr 1fr">
      {labelCard}
      <Metric label="Posts" value={int(ch.posts ?? 0)} rag={postsRag}>
        Target {target} <span style={{ color: postsRag === 'grey' ? MUTED : RAG_COLOR[postsRag] }}>{target > 0 ? `${Math.round(((ch.posts ?? 0) / target) * 100)}% of target` : ''}</span>
      </Metric>
      {ch.views == null
        ? <Metric label="Views" rag="grey">{waiting}</Metric>
        : <Metric label="Views" value={int(ch.views)} rag={viewsRag}>
            {ch.prevViews != null && ch.prevViews > 0
              ? <Delta prefix={pw} prevText={int(ch.prevViews)} cur={ch.views} prev={ch.prevViews} rag={viewsRag} />
              : `No ${pw} figure yet`}
          </Metric>}
      <Metric label="Engagement" value={int(ch.engagement ?? 0)} rag={engRag}>
        {ch.prevEngagement ? <Delta prefix={pw} prevText={int(ch.prevEngagement)} cur={ch.engagement ?? 0} prev={ch.prevEngagement} rag={engRag} /> : null}
        <div>{fbInsights ? 'Likes, comments, shares' : 'Likes, comments, shares, saves'}</div>
      </Metric>
      {ch.followers == null
        ? <Metric label="Followers" rag="grey">{waiting}</Metric>
        : <Metric label="Followers" value={int(ch.followers)} rag="grey">
            {net != null ? `Net change ${net >= 0 ? '+' : ''}${int(net)} since ${pw}` : `Net change starts ${nextMonthEndLabel(w)}`}
          </Metric>}
    </Grid>
  );
}

function OrganicSection({ o, w, ctx, postsPerWeek, error }: { o: OrganicMonth | undefined; w: MonthWindow; ctx: RagContext; postsPerWeek: number; error?: string }) {
  const target = postsTarget(postsPerWeek, w);
  const empty: OrganicChannel = { connected: false, posts: null, prevPosts: null, views: null, prevViews: null, engagement: null, prevEngagement: null, followers: null, prevMonthFollowers: null };
  const series = (o?.series ?? []).map(s => ({ ...s, label: monthWindow(s.key).shortLabel }));
  return (
    <Section n={3} title="Organic: content and audience" sub={`Target ${postsPerWeek} posts a week per channel (${target} in ${w.shortLabel}${w.isCurrent ? ' so far' : ''})`}>
      <ChannelRow name="Stand Up Instagram" handle="@standuprecruitment" ch={o?.instagram ?? empty} target={target} ctx={ctx} w={w} />
      <ChannelRow name="Stand Up Facebook" handle="Stand Up Recruitment page" ch={o?.facebook ?? empty} target={target} ctx={ctx} w={w} fbInsights />
      <ChannelRow name="Les, Instagram" handle="Personal account" ch={o?.les ?? empty} target={target} ctx={ctx} w={w} />
      {(error || o?.error) && <div style={{ fontSize: 11, color: AM, margin: '0 0 10px' }}>⚠ {error ?? o?.error}</div>}

      <Grid cols="1.2fr 1fr">
        <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, padding: '.875rem 1rem' }}>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>Top 5 posts this month, by engagement</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Post', 'Channel', 'Date', 'Views', 'Engagement'].map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 3 ? 'right' : 'left', color: MUTED, fontWeight: 500, padding: '6px 8px', borderBottom: `.5px solid ${BORDER}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(o?.topPosts ?? []).length === 0 && (
                <tr><td colSpan={5} style={{ padding: '10px 8px', color: MUTED }}>No posts yet</td></tr>
              )}
              {(o?.topPosts ?? []).map(p => (
                <tr key={p.id}>
                  <td style={{ padding: '8px', color: TEXT, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: `.5px solid ${BORDER}` }}>
                    {p.permalink ? <a href={p.permalink} target="_blank" rel="noreferrer" style={{ color: TEXT, textDecoration: 'none' }}>{p.caption || '(no caption)'}</a> : (p.caption || '(no caption)')}
                  </td>
                  <td style={{ padding: '8px', color: TEXT, borderBottom: `.5px solid ${BORDER}` }}>{p.channel}</td>
                  <td style={{ padding: '8px', color: TEXT, borderBottom: `.5px solid ${BORDER}` }}>{shortDate(p.date)}</td>
                  <td style={{ padding: '8px', color: TEXT, textAlign: 'right', borderBottom: `.5px solid ${BORDER}` }}>{p.views != null ? int(p.views) : '—'}</td>
                  <td style={{ padding: '8px', color: TEXT, textAlign: 'right', borderBottom: `.5px solid ${BORDER}` }}>{int(p.engagement)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, padding: '.875rem 1rem' }}>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>Views and followers, last 12 months</div>
          <ResponsiveContainer width="100%" height={190}>
            <ComposedChart data={series} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="v" hide />
              <YAxis yAxisId="f" hide orientation="right" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${BORDER}`, background: BG2 }} labelStyle={{ color: TEXT }} formatter={(v, n) => [v == null ? '—' : int(Number(v)), String(n)]} />
              <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 10, color: MUTED }} />
              <Bar yAxisId="v" dataKey="views" name="Views (bars)" fill={RD} maxBarSize={28} />
              <Line yAxisId="f" dataKey="followers" name="Followers (line)" stroke={TEXT} strokeWidth={2} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Grid>
    </Section>
  );
}

function HandoffSection({ m, w, ctx }: { m: MarketingMonth; w: MonthWindow; ctx: RagContext }) {
  return (
    <Section n={4} title="Handoff: what marketing delivered" sub="Marketing's job ends here. Everything after sits on the Sales and Recruitment tabs.">
      <Grid cols={4}>
        {handoffCards(m, w.prevShortLabel).map(c => <CmpCard key={c.label} c={c} ctx={ctx} />)}
      </Grid>
      <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, padding: '.875rem 1rem' }}>
        <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>Calls booked and qualified candidates, last 12 months</div>
        <ResponsiveContainer width="100%" height={170}>
          <LineChart data={m.handoffSeries} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${BORDER}`, background: BG2 }} labelStyle={{ color: TEXT }} />
            <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 10, color: MUTED }} />
            <Line dataKey="callsBooked" name="Calls booked" stroke={TEXT} strokeWidth={2} dot={false} />
            <Line dataKey="qualifiedCandidates" name="Qualified candidates" stroke={RD} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function MarketingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Skeleton height={48} radius={10} />
      {[2, 4, 4].map((n, i) => (
        <div key={i} style={{ background: BG2, borderRadius: 12, padding: '1.25rem' }}>
          <Skeleton height={14} width={200} style={{ marginBottom: 14 }} />
          <Grid cols={n}>{Array.from({ length: n }, (_, k) => <Skeleton key={k} height={78} radius={8} />)}</Grid>
        </div>
      ))}
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

  const { data: m, error, isLoading, isFetching } = useMarketingMonth(month);
  const { data: organic, error: organicError } = useOrganicMonth(month);
  const { data: settings } = useMarketingSettings();
  const budget = settings?.monthlyBudget ?? null;
  const postsPerWeek = settings?.postsPerWeek ?? 7;

  const header = (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: TEXT, margin: 0 }}>Marketing</h2>
        <p style={{ fontSize: 13, color: MUTED, margin: '4px 0 0' }}>
          {w.isCurrent ? 'Month to date, compared with the same day last month.' : 'Full month, compared with the full previous month.'} Top row is trailing 90 days.
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isFetching && <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${BORDER}`, borderTopColor: NZ, animation: 'spin 0.7s linear infinite' }} />}
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          style={{ background: BG2, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px', fontSize: 13 }}
        >
          {recentMonthKeys(12).map(k => <option key={k} value={k}>{monthWindow(k).label}</option>)}
        </select>
        {role === 'admin' && settings && (
          <button onClick={() => setShowSettings(true)} title="Marketing settings" style={{ background: BG2, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 10px', fontSize: 14, cursor: 'pointer' }}>⚙</button>
        )}
      </div>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );

  if (isLoading) return <>{header}<MarketingSkeleton /></>;
  if (!m) {
    return <>{header}<p style={{ color: AM, fontSize: 12 }}>⚠ Marketing data unavailable{error ? ` — ${error.message}` : ''}</p></>;
  }

  // ── Diagnosis inputs (same colour rule as the cards) ──
  const pw = w.prevShortLabel;
  const [cacCall, cacCand] = cacCards(m);
  const [calls, costPerCall, qualified, qualRate] = handoffCards(m, pw);
  const asDiag = (name: string, c: Cmp): DiagMetric => ({ name, rag: cmpRag(c, ctx), pct: pctChange(c.cur, c.prev) });
  const target = postsTarget(postsPerWeek, w);
  const postsDiag = (name: string, ch: OrganicChannel | undefined): DiagMetric[] =>
    ch?.connected && ch.posts != null && target > 0
      ? [{ name, rag: rate(ch.posts, target, 'up', ctx), pct: (ch.posts / target - 1) * 100 }]
      : [];
  const [cClicks, cCpc, cLeads, cCpl] = paidClientCards(m, pw);
  const [kClicks, kCpc, kApps, kCpa] = paidCandidateCards(m, pw);
  const diagnosis = diagnose({
    tooEarly: isTooEarly(ctx),
    marketingMetrics: [
      asDiag('Calls booked', calls),
      asDiag('Qualified candidates', qualified),
      asDiag('CAC per booked call', cacCall),
      asDiag('CAC per qualified candidate', cacCand),
    ],
    callsBooked: cmpRag(calls, ctx),
    cacPerSignedClient: rate(m.cac.cur.cacPerSignedClient, m.cac.prev.cacPerSignedClient, 'down', ctx),
    otherMetrics: [
      asDiag('Client link clicks', cClicks), asDiag('Client cost per click', cCpc),
      asDiag('Client leads from Meta', cLeads), asDiag('Client cost per lead', cCpl),
      asDiag('Candidate link clicks', kClicks), asDiag('Candidate cost per click', kCpc),
      asDiag('Candidate applications from Meta', kApps), asDiag('Cost per application', kCpa),
      asDiag('Cost per booked call', costPerCall), asDiag('Qual rate', qualRate),
      ...postsDiag('Instagram posts', organic?.instagram),
      ...postsDiag('Facebook posts', organic?.facebook),
    ],
  });
  const tone = RAG_COLOR[diagnosis.tone];

  return (
    <div>
      {header}

      <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderLeft: `3px solid ${tone}`, borderRadius: 10, padding: '.875rem 1rem', display: 'flex', alignItems: 'center', gap: 14, marginBottom: '.875rem' }}>
        <span style={{ background: tone, color: diagnosis.tone === 'grey' ? TEXT : BG, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>{diagnosis.badge}</span>
        <span style={{ fontSize: 13, color: TEXT }}>{diagnosis.text}</span>
      </div>

      <Section n={1} title="Is marketing paying for itself?" sub="Trailing 90 days. Calculated once, in the same place as the Finance and Sales CACs.">
        <Grid cols={2}>
          {cacCards(m).map(c => <CmpCard key={c.label} c={c} ctx={ctx} />)}
        </Grid>
      </Section>

      <PaidSection m={m} w={w} ctx={ctx} budget={budget} />
      <OrganicSection o={organic} w={w} ctx={ctx} postsPerWeek={postsPerWeek} error={organicError?.message} />
      <HandoffSection m={m} w={w} ctx={ctx} />

      <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
        Colour rule for every card: green = same or better than last month; amber = up to 20% worse; red = more than 20% worse. "Worse" follows the direction of the number (a cost going up is worse). Colours stay grey for days 1–7 of the month.<br />
        Overrides: ad spend is red above the monthly budget; posts compare against the pro-rata target of {postsPerWeek} a week per channel.<br />
        Paid figures are Meta-reported. Handoff figures come from Airtable: calls booked = client leads with a booked meeting, by the date the lead was created; qualified candidate = NZ citizen with a trade.
      </div>

      {error && <p style={{ color: AM, fontSize: 12 }}>⚠ Showing last loaded data — {error.message}</p>}
      {showSettings && settings && <SettingsPanel settings={settings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
