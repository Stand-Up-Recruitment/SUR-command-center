import { useState, type ReactNode } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Legend, ReferenceLine,
} from 'recharts';
import { Skeleton } from '../shared/Skeleton';
import { NZ, AM, RD, BG, BG2, BORDER, TEXT, MUTED, RAG_COLOR, money0, int, cmpRag, type Cmp } from '../shared/monthTheme';
import { Section, Grid, Metric, Delta, CmpCard } from '../shared/monthLayout';
import { useSalesMonth, useSalesSettings, useSaveSalesSettings } from '../../hooks/queries';
import { useAuthRole } from '../auth/AuthContext';
import { monthWindow, recentMonthKeys, currentMonthKey, type MonthWindow } from '../../lib/nzTime';
import { rate, pctChange, isTooEarly, type Rag, type RagContext } from '../../lib/rag';
import { diagnoseSales, type SalesDiagMetric } from '../../lib/diagnosis';
import type { SalesFunnel, SalesMonth, SalesSettings } from '../../types';

const STALE_DAYS = 14;
const pct0 = (n: number) => `${Math.round(n)}%`;
const ratio = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);
const signRate = (f: SalesFunnel) => ratio(f.signed, f.tobsSent);
const showRate = (f: SalesFunnel) => (f.noShow == null ? null : ratio(f.callsBooked - f.noShow, f.callsBooked));
const share = (n: number | null, f: SalesFunnel) => (n == null ? null : ratio(n, f.callsBooked));
const staleRag = (n: number): Rag => (n === 0 ? 'green' : n <= 5 ? 'amber' : 'red');
const ragText = (rag: Rag) => (rag === 'grey' ? TEXT : RAG_COLOR[rag]);

// ─── Settings panel ───────────────────────────────────────────────────────────
function SettingsPanel({ settings, onClose }: { settings: SalesSettings; onClose: () => void }) {
  const save = useSaveSalesSettings();
  const [target, setTarget] = useState(String(settings.targetPerSalesperson));
  const [password, setPassword] = useState('');
  const input = { background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };

  const submit = () => {
    save.mutate({ settings: { targetPerSalesperson: Number(target) }, adminPassword: password }, { onSuccess: onClose });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '1.25rem', width: 340 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 14 }}>Sales settings</div>
        <label style={{ fontSize: 11, color: MUTED }}>ToBs signed target (per salesperson, per month)</label>
        <input style={{ ...input, margin: '4px 0 12px' }} type="number" min={1} step={1} value={target} onChange={e => setTarget(e.target.value)} />
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

// ─── Small pieces ─────────────────────────────────────────────────────────────
/** Conversion rate between two funnel stages. */
function Step({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 10, color: MUTED, minWidth: 64 }}>
      <div>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, margin: '2px 0' }}>{value}</div>
      {sub && <div>{sub}</div>}
    </div>
  );
}

function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, padding: '.875rem 1rem' }}>
      {title && <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>{title}</div>}
      {children}
    </div>
  );
}

function Table({ head, rows, align }: { head: string[]; rows: ReactNode[][]; align: ('left' | 'right')[] }) {
  const cell = (i: number) => ({ textAlign: align[i], padding: '8px', borderBottom: `.5px solid ${BORDER}` });
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr>{head.map((h, i) => <th key={h} style={{ ...cell(i), color: MUTED, fontWeight: 500, padding: '6px 8px' }}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, j) => <tr key={j}>{r.map((c, i) => <td key={i} style={{ ...cell(i), color: TEXT }}>{c}</td>)}</tr>)}
      </tbody>
    </table>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────
interface Targets { perPerson: number; full: number; proRata: number; perPersonProRata: number }

function targetsFor(m: SalesMonth, w: MonthWindow, perPerson: number): Targets {
  const elapsed = w.isCurrent ? w.dayOfMonth / w.daysInMonth : 1;
  const full = perPerson * m.salespeople.length;
  return { perPerson, full, proRata: full * elapsed, perPersonProRata: perPerson * elapsed };
}

function ConvertingSection({ m, w, ctx, t, signedRag }: { m: SalesMonth; w: MonthWindow; ctx: RagContext; t: Targets; signedRag: Rag }) {
  const { cur, prev } = m;
  const pw = w.prevShortLabel;
  const sr = signRate(cur), psr = signRate(prev);
  const srRag = rate(sr, psr, 'up', ctx);
  const proRata = Math.round(t.proRata);
  return (
    <Section n={1} title="Is sales converting?" sub={`Real figures, Airtable CRM, ${w.label}`}>
      <Grid cols={3}>
        <Metric label="ToBs signed" value={int(cur.signed)} rag={signedRag}>
          Target {proRata}{w.isCurrent ? ' so far' : ''}{' '}
          <span style={{ color: ragText(signedRag) }}>{proRata > 0 ? `${Math.round((cur.signed / t.proRata) * 100)}% of target` : ''}</span> · {pw} {prev.signed}
        </Metric>
        <Metric label="Sign rate (signed ÷ ToBs sent)" value={sr == null ? '—' : pct0(sr)} rag={srRag}>
          {sr != null && psr != null && <Delta prefix={pw} prevText={pct0(psr)} cur={Math.round(sr)} prev={Math.round(psr)} rag={srRag} pts />}
        </Metric>
        {m.cac
          ? <CmpCard ctx={ctx} c={{ label: 'CAC per signed client', cur: m.cac.cur, prev: m.cac.prev, better: 'down', fmt: money0, prevWord: pw }} />
          : <Metric label="CAC per signed client" rag="grey">Not available</Metric>}
      </Grid>
      {m.cac && <div style={{ fontSize: 11, color: MUTED }}>CAC is trailing 90 days, from the central CAC calculation (same as Finance and Marketing).</div>}
    </Section>
  );
}

function FunnelSection({ m, w, ctx, signedRag, callsCmp, sentCmp }: { m: SalesMonth; w: MonthWindow; ctx: RagContext; signedRag: Rag; callsCmp: Cmp; sentCmp: Cmp }) {
  const { cur, prev } = m;
  const show = showRate(cur);
  const held = cur.callsHeld ?? cur.callsBooked;
  const fit = ratio(cur.paidTobs, held);
  const sr = signRate(cur);
  const outcomeCard = (label: string, n: number | null, p: number | null) => {
    if (n == null) return <Metric label={label} rag="grey">Starts once recorded</Metric>;
    const s = share(n, cur)!, ps = share(p, prev);
    const rag = rate(s, ps, 'down', ctx);
    return <Metric label={label} value={int(n)} rag={rag}>{pct0(s)} of calls{ps != null && <> · {w.prevShortLabel} {pct0(ps)}</>}</Metric>;
  };
  return (
    <Section n={2} title="The funnel" sub="Handoff from Marketing on the left. Sales' job ends at signed.">
      <Grid cols="1fr auto 1fr auto 1fr auto 1fr">
        <CmpCard ctx={ctx} c={callsCmp} />
        <Step label="Show rate" value={show == null ? '—' : pct0(show)} sub={show == null ? 'needs No Show' : undefined} />
        {cur.callsHeld == null
          ? <Metric label="Calls held" rag="grey">Starts once No Show is recorded</Metric>
          : <Metric label="Calls held" value={int(cur.callsHeld)} rag={rate(show, showRate(prev), 'up', ctx)}>{int(cur.noShow!)} no-shows</Metric>}
        <Step label="Fit rate" value={fit == null ? '—' : pct0(fit)} sub={`${cur.paidTobs} of ${held}`} />
        <CmpCard ctx={ctx} c={sentCmp} />
        <Step label="Sign rate" value={sr == null ? '—' : pct0(sr)} />
        <Metric label="ToBs signed" value={int(cur.signed)} rag={signedRag}>All sources</Metric>
      </Grid>
      <Grid cols={4}>
        <Metric label="Calls with no ToB" value={int(cur.closedNoToB)} rag="grey">
          {cur.noShow == null && cur.notFit == null && cur.waitlist == null
            ? 'Today all marked "Closed". Splits into No Show / Not a Fit / Waitlist once they are recorded.'
            : `${w.prevShortLabel} ${int(prev.closedNoToB)}`}
        </Metric>
        {outcomeCard('No show', cur.noShow, prev.noShow)}
        {outcomeCard('Not a fit', cur.notFit, prev.notFit)}
        {outcomeCard('Waitlist', cur.waitlist, prev.waitlist)}
      </Grid>
      <div style={{ fontSize: 11, color: MUTED }}>
        Calls are paid-ad clients only (Client Paid Ads), by call date. ToBs sent and signed are all sources, including referrals.
      </div>
    </Section>
  );
}

function SalespersonSection({ m, ctx, t }: { m: SalesMonth; ctx: RagContext; t: Targets }) {
  const teamPrevSr = signRate(m.prev);
  const rows = m.salespeople.map(p => {
    const sr = ratio(p.signed, p.sent);
    const signedRag = rate(p.signed, t.perPersonProRata, 'up', ctx);
    const srRag = rate(sr, teamPrevSr, 'up', ctx);
    const show = p.noShow == null ? null : ratio(p.calls - p.noShow, p.calls);
    return [
      <strong key="n">{p.name}</strong>,
      int(p.calls),
      show == null ? '—' : pct0(show),
      int(p.sent),
      <span key="s" style={{ color: ragText(signedRag) }}>{p.signed} / {Math.round(t.perPersonProRata)}</span>,
      <span key="r" style={{ color: ragText(srRag) }}>{sr == null ? '—' : pct0(sr)}</span>,
      int(p.open),
      <span key="st" style={{ color: ragText(staleRag(p.stale)) }}>{p.stale}</span>,
    ];
  });
  return (
    <Section n={3} title="By salesperson" sub={`Signings target ${t.perPerson} a month each, pro-rata month to date`}>
      <Panel>
        <Table
          head={['Salesperson', 'Calls', 'Show rate', 'ToBs sent', 'Signed / target', 'Sign rate', 'Open ToBs', 'Stale']}
          align={['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right']}
          rows={rows}
        />
        <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>
          Until a Salesperson field is added to Client Paid Ads and the CRM, everything is counted under Les.
        </div>
      </Panel>
    </Section>
  );
}

function WaitingSection({ m }: { m: SalesMonth }) {
  const { open, timeToSign: tts } = m;
  const segs = [
    { label: 'Sent', n: open.stages.sent, bg: '#8a8a8a', fg: BG },
    { label: 'Waiting', n: open.stages.waiting, bg: '#d4d4d4', fg: BG },
    { label: 'Follow-up #1', n: open.stages.fu1, bg: AM, fg: BG },
    { label: '#2', n: open.stages.fu2, bg: RD, fg: BG },
    { label: '#3+', n: open.stages.fu3, bg: '#8b2f1c', fg: TEXT },
  ];
  const rag = staleRag(open.stale);
  return (
    <Section n={4} title="ToBs waiting for a signature" sub={`${open.total} open now. Flag = unsigned more than ${STALE_DAYS} days (not counting Waiting).`}>
      <div style={{ display: 'flex', height: 30, borderRadius: 6, overflow: 'hidden', marginBottom: 10, fontSize: 11, fontWeight: 600 }}>
        {segs.map(s => (
          <div key={s.label} style={{ flex: s.n > 0 ? s.n : undefined, minWidth: 34, background: s.n > 0 ? s.bg : '#2a2a2a', color: s.n > 0 ? s.fg : MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', overflow: 'hidden', padding: '0 4px' }}>
            {s.label} {s.n}
          </div>
        ))}
      </div>
      <Grid cols="1fr 1.6fr">
        <Metric label={`Stale ToBs (over ${STALE_DAYS} days)`} value={int(open.stale)} rag={rag}>
          {open.stale > 0 ? 'Chase or close.' : 'Nothing stale.'}
          {tts.total > 0 && (
            <div style={{ marginTop: 8 }}>
              Time to sign ({tts.label} signings): median {tts.median} day{tts.median === 1 ? '' : 's'}, {tts.within7} of {tts.total} within a week, longest {tts.max} days.
            </div>
          )}
        </Metric>
        <Panel title="Oldest unsigned ToBs">
          {open.oldest.length === 0
            ? <div style={{ fontSize: 12, color: MUTED }}>No open ToBs</div>
            : <Table
                head={['Client', 'Stage', 'Days waiting']}
                align={['left', 'left', 'right']}
                rows={open.oldest.map(o => [o.company, o.stage, <span key="d" style={{ color: o.days > STALE_DAYS ? RD : TEXT }}>{o.days}</span>])}
              />}
        </Panel>
      </Grid>
    </Section>
  );
}

function WaitlistSection({ m }: { m: SalesMonth }) {
  const wl = m.waitlist;
  return (
    <Section n={5} title="Waitlist: clients waiting for candidates" sub="Tells Brinda which towns and trades need candidate ads">
      <Grid cols="1fr 1.6fr">
        {wl
          ? <Metric label="Clients on waitlist" value={int(wl.count)} rag="grey">Right now</Metric>
          : <Metric label="Clients on waitlist" rag="grey">Starts once Waitlist is recorded on calls</Metric>}
        <Panel title="Waitlist by trade and town">
          {wl
            ? <Table head={['Trade', 'Town', 'Clients waiting']} align={['left', 'left', 'right']} rows={wl.rows.map(r => [r.trade, r.town, int(r.count)])} />
            : <div style={{ fontSize: 12, color: MUTED }}>Starts once recorded</div>}
        </Panel>
      </Grid>
    </Section>
  );
}

function TrendSection({ m, t }: { m: SalesMonth; t: Targets }) {
  return (
    <Section n={6} title="Last 12 months">
      <Panel title="ToBs signed (bars) and sign rate (line)">
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={m.series} margin={{ top: 18, right: 8, left: 8, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="n" hide domain={[0, (max: number) => Math.max(max, t.full) * 1.15]} />
            <YAxis yAxisId="r" hide orientation="right" domain={[0, 100]} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${BORDER}`, background: BG2 }}
              labelStyle={{ color: TEXT }}
              formatter={(v, n) => [n === 'Sign rate' ? (v == null ? '—' : pct0(Number(v))) : int(Number(v)), String(n)]}
            />
            <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 10, color: MUTED }} />
            <ReferenceLine yAxisId="n" y={t.full} stroke={MUTED} strokeDasharray="4 4" label={{ value: `Target ${t.full}`, position: 'insideTopLeft', fill: MUTED, fontSize: 10 }} />
            <Bar yAxisId="n" dataKey="signed" name="ToBs signed" fill={RD} maxBarSize={44} radius={[3, 3, 0, 0]}>
              <LabelList dataKey="signed" position="top" style={{ fontSize: 9, fill: MUTED }} />
            </Bar>
            <Line yAxisId="r" dataKey="signRate" name="Sign rate" stroke={TEXT} strokeWidth={2} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>
    </Section>
  );
}

function SalesSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Skeleton height={48} radius={10} />
      {[3, 4, 1].map((n, i) => (
        <div key={i} style={{ background: BG2, borderRadius: 12, padding: '1.25rem' }}>
          <Skeleton height={14} width={200} style={{ marginBottom: 14 }} />
          <Grid cols={n}>{Array.from({ length: n }, (_, k) => <Skeleton key={k} height={78} radius={8} />)}</Grid>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function SalesCard() {
  const role = useAuthRole();
  const [month, setMonth] = useState(currentMonthKey);
  const [showSettings, setShowSettings] = useState(false);
  const w = monthWindow(month);
  const ctx: RagContext = { isCurrent: w.isCurrent, dayOfMonth: w.dayOfMonth };

  const { data: m, error, isLoading, isFetching } = useSalesMonth(month);
  const { data: settings } = useSalesSettings();
  const perPerson = settings?.targetPerSalesperson ?? 10;

  const header = (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: TEXT, margin: 0 }}>Sales</h2>
        <p style={{ fontSize: 13, color: MUTED, margin: '4px 0 0' }}>
          From booked call to signed ToB. {w.isCurrent ? 'Month to date vs same day last month.' : 'Full month vs the full previous month.'} CAC is trailing 90 days.
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
          <button onClick={() => setShowSettings(true)} title="Sales settings" style={{ background: BG2, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 10px', fontSize: 14, cursor: 'pointer' }}>⚙</button>
        )}
      </div>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );

  if (isLoading) return <>{header}<SalesSkeleton /></>;
  if (!m) {
    return <>{header}<p style={{ color: AM, fontSize: 12 }}>⚠ Sales data unavailable{error ? ` — ${error.message}` : ''}</p></>;
  }

  const t = targetsFor(m, w, perPerson);
  const { cur, prev } = m;
  const pw = w.prevShortLabel;
  const same = w.isCurrent ? `Same day ${pw}` : pw;
  // ToBs signed is coloured against the pro-rata target, not last month.
  const signedRag = rate(cur.signed, t.proRata, 'up', ctx);
  const callsCmp: Cmp = { label: 'Calls booked', cur: cur.callsBooked, prev: prev.callsBooked, better: 'up', fmt: int, prevWord: same };
  const sentCmp: Cmp = { label: 'ToBs sent', cur: cur.tobsSent, prev: prev.tobsSent, better: 'up', fmt: int, prevWord: same };

  // ── Diagnosis inputs (same colour rule as the cards) ──
  const metric = (name: string, c: number | null, p: number | null, better: 'up' | 'down', group: SalesDiagMetric['group'], section: number): SalesDiagMetric[] =>
    c == null ? [] : [{ name, rag: rate(c, p, better, ctx), pct: p == null ? null : pctChange(c, p), group, section }];
  const tts = m.timeToSign;
  const diagnosis = diagnoseSales({
    tooEarly: isTooEarly(ctx),
    lead: `Signings ${cur.signed >= t.proRata ? 'on target' : 'behind target'} (${cur.signed} of ${Math.round(t.proRata)}).`,
    metrics: [
      ...metric('Show rate', showRate(cur), showRate(prev), 'up', 'sales', 2),
      ...metric('Sign rate', signRate(cur), signRate(prev), 'up', 'sales', 1),
      { name: 'Stale ToBs', rag: staleRag(m.open.stale), pct: null, group: 'sales', section: 4,
        phrase: `${m.open.stale} ToB${m.open.stale === 1 ? ' has' : 's have'} sat unsigned for over ${STALE_DAYS} days` },
      { name: 'Calls booked', rag: cmpRag(callsCmp, ctx), pct: pctChange(cur.callsBooked, prev.callsBooked), group: 'upstream', section: 2 },
      ...metric('Not a Fit share', share(cur.notFit, cur), share(prev.notFit, prev), 'down', 'upstream', 2),
      ...metric('Waitlist share', share(cur.waitlist, cur), share(prev.waitlist, prev), 'down', 'supply', 5),
    ],
    note: m.open.stale > 0 && tts.total > 0
      ? tts.max <= STALE_DAYS
        ? `No client in ${tts.label} took longer than ${STALE_DAYS} days to sign.`
        : `Median time to sign in ${tts.label} was ${tts.median} days.`
      : undefined,
  });
  const tone = RAG_COLOR[diagnosis.tone];

  return (
    <div>
      {header}

      <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderLeft: `3px solid ${tone}`, borderRadius: 10, padding: '.875rem 1rem', display: 'flex', alignItems: 'center', gap: 14, marginBottom: '.875rem' }}>
        <span style={{ background: tone, color: diagnosis.tone === 'grey' ? TEXT : BG, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>{diagnosis.badge}</span>
        <span style={{ fontSize: 13, color: TEXT }}>{diagnosis.text}</span>
      </div>

      <ConvertingSection m={m} w={w} ctx={ctx} t={t} signedRag={signedRag} />
      <FunnelSection m={m} w={w} ctx={ctx} signedRag={signedRag} callsCmp={callsCmp} sentCmp={sentCmp} />
      <SalespersonSection m={m} ctx={ctx} t={t} />
      <WaitingSection m={m} />
      <WaitlistSection m={m} />
      <TrendSection m={m} t={t} />

      <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
        Colour rule: green = same or better than last month; amber = up to 20% worse; red = more than 20% worse. ToBs signed is coloured against the pro-rata target of {perPerson} per salesperson instead. Stale ToBs: 0 green, 1–5 amber, more than 5 red. Grey for days 1–7.<br />
        Figures come from the Airtable CRM and Client Paid Ads tables, in NZ time. Duplicate CRM companies count once. Open ToBs and the waitlist are as of today.
      </div>

      {error && <p style={{ color: AM, fontSize: 12 }}>⚠ Showing last loaded data — {error.message}</p>}
      {showSettings && settings && <SettingsPanel settings={settings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
