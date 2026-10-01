import { useState } from 'react';
import {
  BarChart, Bar, ComposedChart, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Legend,
} from 'recharts';
import { Skeleton } from '../shared/Skeleton';
import { NZ, AM, RD, BG, BG2, BORDER, TEXT, MUTED, RAG_COLOR, money0, money2, int, kShort, shortDate } from '../shared/monthTheme';
import { Section, SubHead, Grid, Metric, Delta, CmpCard } from '../shared/monthLayout';
import { useMarketingMonth, useOrganicMonth, useMarketingSettings, useSaveMarketingSettings, useMetaBreakdown } from '../../hooks/queries';
import { useAuthRole } from '../auth/AuthContext';
import { monthWindow, recentMonthKeys, currentMonthKey, type MonthWindow } from '../../lib/nzTime';
import { rate, isTooEarly, type Rag, type RagContext } from '../../lib/rag';
import { paidClientCards, paidCandidateCards, handoffCards, cacCards, postsTarget, marketingDiagnosis } from './marketingMetrics';
import type { MarketingMonth, OrganicChannel, OrganicMonth, MarketingSettings, MarketingTargets, MetaAdRow } from '../../types';

const CLIENT_BAR = '#8a8a8a';

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

// ─── Sections ─────────────────────────────────────────────────────────────────
function PaidSection({ m, w, ctx, budget, month }: { m: MarketingMonth; w: MonthWindow; ctx: RagContext; budget: number | null; month: string }) {
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

      <CampaignsAndAds month={month} prevWord={pw} />
    </Section>
  );
}

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
  const [open, setOpen] = useState(false);
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

function HandoffSection({ m, w, ctx, targets }: { m: MarketingMonth; w: MonthWindow; ctx: RagContext; targets: MarketingTargets | undefined }) {
  return (
    <Section n={4} title="Handoff: what marketing delivered" sub="Marketing's job ends here. Everything after sits on the Sales and Recruitment tabs.">
      <Grid cols={5}>
        {handoffCards(m, w, targets).map(c => <CmpCard key={c.label} c={c} ctx={ctx} />)}
      </Grid>
      <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, padding: '.875rem 1rem' }}>
        <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>Calls booked and qualified candidates, last 12 months</div>
        <ResponsiveContainer width="100%" height={170}>
          <LineChart data={m.handoffSeries} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
            {/* Separate scales: calls are tens a month, qualified candidates hundreds. */}
            <YAxis yAxisId="calls" tick={{ fontSize: 10, fill: TEXT }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
            <YAxis yAxisId="qual" orientation="right" tick={{ fontSize: 10, fill: RD }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${BORDER}`, background: BG2 }} labelStyle={{ color: TEXT }} />
            <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 10, color: MUTED }} />
            <Line yAxisId="calls" dataKey="callsBooked" name="Calls booked (left scale)" stroke={TEXT} strokeWidth={2} dot={false} />
            <Line yAxisId="qual" dataKey="qualifiedCandidates" name="Qualified candidates (right scale)" stroke={RD} strokeWidth={2} dot={false} />
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
      {[2, 4, 5].map((n, i) => (
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

  // ── Diagnosis (shared with the Overview) ──
  const targets = settings?.targets;
  const diagnosis = marketingDiagnosis(m, organic, settings, w);
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

      <PaidSection m={m} w={w} ctx={ctx} budget={budget} month={month} />
      <OrganicSection o={organic} w={w} ctx={ctx} postsPerWeek={postsPerWeek} error={organicError?.message} />
      <HandoffSection m={m} w={w} ctx={ctx} targets={targets} />

      <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
        Colour rule for every card: green = same or better than last month; amber = up to 20% worse; red = more than 20% worse. "Worse" follows the direction of the number (a cost going up is worse). Colours stay grey for days 1–7 of the month.<br />
        Where a target is set (⚙), the card is coloured against the target instead (pro-rata for monthly counts), and last month is shown in grey for reference. Ad spend is red above the monthly budget; posts compare against the pro-rata target of {postsPerWeek} a week per channel.<br />
        Paid figures are Meta-reported. Facebook views are organic only (Meta's organic/paid split). Handoff figures come from Airtable: calls booked = client leads with a booked meeting, by booking date (lead-created date where the booking time is unknown); qualified candidate = NZ citizen whose category is a skilled trade.
      </div>

      {error && <p style={{ color: AM, fontSize: 12 }}>⚠ Showing last loaded data — {error.message}</p>}
      {showSettings && settings && <SettingsPanel settings={settings} suggested={suggestedTargets(m)} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
