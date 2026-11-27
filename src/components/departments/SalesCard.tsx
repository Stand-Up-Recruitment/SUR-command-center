import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ComposedChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, ReferenceLine } from 'recharts';
import { Skeleton } from '../shared/Skeleton';
import { money0, int } from '../shared/monthTheme';
import { C, PACE_COLOR, NUM_FONT, CARD, LABEL, TODO } from '../shared/v2Theme';
import { Chip, Section, Tag, Big, Tile, Line as TextLine } from '../shared/v2Layout';
import { useSalesMonth, useSalesSettings, useSaveSalesSettings } from '../../hooks/queries';
import { useAuthRole } from '../auth/AuthContext';
import { monthWindow, recentMonthKeys, currentMonthKey } from '../../lib/nzTime';
import { rate, pctChange, type RagContext } from '../../lib/rag';
import { PACE_LABEL, type Pace } from '../../lib/workingDays';
import { DEFAULT_TARGET_PER_SALESPERSON, targetsFor } from './salesMetrics';
import {
  CALL_DAYS, pctOf, qualified, closeRate, funnelRates, neededBy, vsTarget, openStatus, salesActions, biggestBreak,
  type SalesLevel, type OpenStatus, type Owner,
} from '../../lib/sales';
import type { SalesSettings } from '../../types';

const DEFAULT_CLOSE_RATE = 30;

// ─── Settings panel ───────────────────────────────────────────────────────────
function SettingsPanel({ settings, onClose }: { settings: SalesSettings; onClose: () => void }) {
  const save = useSaveSalesSettings();
  const [target, setTarget] = useState(String(settings.targetPerSalesperson));
  const [close, setClose] = useState(String(settings.closeRateTarget));
  const [password, setPassword] = useState('');
  const input = { background: C.inset, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
  const label = { fontSize: 11, color: C.muted };

  const submit = () => {
    save.mutate({ settings: { targetPerSalesperson: Number(target), closeRateTarget: Number(close) }, adminPassword: password }, { onSuccess: onClose });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ ...CARD, padding: '1.25rem', width: 340 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 14 }}>Sales targets</div>
        <label style={label}>Signed ToBs per month (per salesperson)</label>
        <input style={{ ...input, margin: '4px 0 12px' }} type="number" min={1} step={1} value={target} onChange={e => setTarget(e.target.value)} />
        <label style={label}>Close rate target (% of qualified meetings)</label>
        <input style={{ ...input, margin: '4px 0 12px' }} type="number" min={1} max={100} step={1} value={close} onChange={e => setClose(e.target.value)} />
        <label style={label}>Admin password</label>
        <input style={{ ...input, margin: '4px 0 12px' }} type="password" value={password} onChange={e => setPassword(e.target.value)} />
        {save.error && <div style={{ fontSize: 11, color: C.red, marginBottom: 10 }}>{save.error.message}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={save.isPending} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: 'none', background: C.red, color: C.ink, fontWeight: 600, cursor: 'pointer' }}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Small pieces ─────────────────────────────────────────────────────────────
const LEVEL_TONE: Record<SalesLevel, Pace | 'blue'> = { 'CALL NOW': 'red', 'THIS WEEK': 'amber', PUSH: 'blue', 'SET UP': 'grey' };
const STATUS_TONE: Record<OpenStatus, Pace> = { CALL: 'red', WATCH: 'amber', 'IN SEQUENCE': 'grey' };
const ragColor = (r: Pace) => (r === 'grey' ? C.text : PACE_COLOR[r]);
const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n)}%`);
const TH: CSSProperties = { ...LABEL, fontSize: 12, textAlign: 'left', padding: '12px 16px', borderBottom: `1px solid ${C.rowBorder}`, whiteSpace: 'nowrap' };
const TD: CSSProperties = { padding: '14px 16px', borderBottom: `1px solid ${C.rowBorder}`, fontSize: 14, color: C.text, verticalAlign: 'top' };
const Sub = ({ children }: { children: ReactNode }) => <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{children}</div>;

const OWNER_COLOR: Record<Owner, string> = { MARKETING: C.purple, SALES: C.blue, RECRUITMENT: C.teal };

/** A funnel box with its owner's colour band. value null = grey "Not logged yet", never zero. */
function Step({ owner, label, value, children }: { owner: Owner; label: string; value: number | null; children: ReactNode }) {
  return (
    <div style={{ background: C.inset, border: `1px solid ${C.border}`, borderTop: `3px solid ${OWNER_COLOR[owner]}`, borderRadius: 10, padding: 12, flex: '1 1 110px', minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.4px', color: OWNER_COLOR[owner] }}>{owner}{owner === 'RECRUITMENT' && ' · NOT SCORED'}</div>
      <div style={{ ...LABEL, fontSize: 11, marginTop: 2 }}>{label}</div>
      <div style={{ fontFamily: NUM_FONT, fontSize: 30, fontWeight: 700, color: value == null ? C.faint : C.text, margin: '4px 0' }}>{value == null ? '—' : int(value)}</div>
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{value == null ? <><div style={{ color: C.soft }}>Not logged yet</div>{children}</> : children}</div>
    </div>
  );
}
/** Arrow between boxes: this month's rate on top, last month's underneath. Red when it fell. */
const Arrow = ({ name, cur, prev, pw }: { name: string; cur: number | null; prev: number | null; pw: string }) => (
  <div style={{ alignSelf: 'center', textAlign: 'center', fontSize: 13, fontWeight: 600, minWidth: 44, color: cur != null && prev != null ? (Math.round(cur) < Math.round(prev) ? C.red : C.green) : C.muted }}>
    {pct(cur)}<div style={{ fontSize: 18, color: C.muted }}>→</div>
    <div style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>{cur == null ? name : `${pw} ${pct(prev)}`}</div>
  </div>
);

function SalesSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Skeleton height={160} radius={12} />
      <div style={{ display: 'flex', gap: 12 }}>{[0, 1, 2].map(i => <Skeleton key={i} height={140} radius={12} style={{ flex: 1 }} />)}</div>
      <Skeleton height={200} radius={12} />
    </div>
  );
}

// ─── Page (Sales tab v2 brief + mockup, 26 Nov 2026) ──────────────────────────
export function SalesCard() {
  const role = useAuthRole();
  const [month, setMonth] = useState(currentMonthKey);
  const [showSettings, setShowSettings] = useState(false);
  const w = monthWindow(month);
  const ctx: RagContext = { isCurrent: w.isCurrent, dayOfMonth: w.dayOfMonth };
  const pw = w.prevShortLabel;
  const same = w.isCurrent ? `Same day ${pw}` : pw;

  const { data: m, error, isLoading, isFetching } = useSalesMonth(month);
  const { data: settings } = useSalesSettings();
  const perPerson = settings?.targetPerSalesperson ?? DEFAULT_TARGET_PER_SALESPERSON;
  const closeTarget = settings?.closeRateTarget ?? DEFAULT_CLOSE_RATE;

  const header = (
    <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 style={{ margin: 0, fontFamily: NUM_FONT, fontSize: 34, fontWeight: 700, letterSpacing: '-0.5px', color: C.text }}>Sales</h1>
        <p style={{ margin: 0, fontSize: 14, color: C.muted }}>
          {w.isCurrent
            ? `${new Date().toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Pacific/Auckland' }).replace(',', '')} · Day ${w.dayOfMonth} of ${w.daysInMonth}`
            : `${w.label} · full month`}
          {' · '}Sales’ job ends at a signed ToB
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

  if (isLoading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>{header}<SalesSkeleton /></div>;
  if (!m) {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>{header}<p style={{ color: C.amber, fontSize: 12 }}>⚠ Sales data unavailable{error ? ` — ${error.message}` : ''}</p></div>;
  }

  const { cur, prev } = m;
  const target = targetsFor(m, w, perPerson).full;
  const needed = neededBy(target, w.dayOfMonth, w.daysInMonth);
  const signedRag = vsTarget(cur.signed, needed);
  const cr = closeRate(cur), pcr = closeRate(prev);
  const crRag = cr == null ? 'grey' : vsTarget(cr, closeTarget);
  const outcomesLogged = qualified(cur) != null;
  const rates = funnelRates(m);
  const cacRag = m.cac ? rate(m.cac.cur, m.cac.prev, 'down', ctx) : 'grey';
  const cacPct = m.cac ? pctChange(m.cac.cur, m.cac.prev) : null;
  const actions = salesActions(m, target, w.dayOfMonth, w.daysInMonth);
  const brk = biggestBreak(m);
  const sameShort = w.isCurrent ? `${pw} same day` : pw;
  const tts = m.timeToSign;
  const st = m.open.stages;
  const trend = m.series.map(s => {
    const partial = w.isCurrent && s.key === month;
    return { ...s, partial, label: partial ? `${s.label} so far` : s.label };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, color: C.text }}>
      {header}
      {error && <p style={{ color: C.amber, fontSize: 12, margin: 0 }}>⚠ Showing last loaded data — {error.message}</p>}

      {/* 1. Today's actions */}
      <Section title="Today’s actions" aside={w.isCurrent ? 'Who to call today · auto-built from the sections below · worst first' : `For ${w.label} · today’s actions show on the current month`}>
        {w.isCurrent && (
          <div style={{ ...CARD, overflow: 'hidden' }}>
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
      <Section title="Are we on track?" aside={<Tag bg={C.soft}>WHAT SALES DELIVERED · {w.isCurrent ? 'THIS MONTH' : w.label.toUpperCase()}</Tag>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <Tile label="SIGNED TOBS" chip={<Chip tone={signedRag}>{PACE_LABEL[signedRag]}</Chip>}>
            <Big value={int(cur.signed)} color={ragColor(signedRag)} unit="signed" />
            <TextLine>Need <strong>{needed}</strong> by today · <strong>{target}</strong> by month end</TextLine>
            <TextLine muted>{same}: {int(prev.signed)}</TextLine>
          </Tile>
          <Tile label="CLOSE RATE" chip={<Chip tone={crRag}>{PACE_LABEL[crRag]}</Chip>}>
            <Big value={pct(cr)} color={ragColor(crRag)} unit="signed ÷ qualified meetings" />
            <TextLine>Target {closeTarget}%{!outcomesLogged && ' · uses booked until outcomes are logged'}</TextLine>
            <TextLine muted>{same}: {pct(pcr)}{cr != null && pcr != null && ` · ${cr >= pcr ? '+' : '−'}${Math.abs(Math.round(cr - pcr))} pts`}</TextLine>
          </Tile>
          <Tile label="CLIENT CAC" chip={cacPct == null ? <Chip tone="grey">NO DATA</Chip> : <Chip tone={cacRag}>{Math.abs(Math.round(cacPct))}% {cacPct > 0 ? 'WORSE' : 'BETTER'}</Chip>}>
            <Big value={m.cac ? money0(m.cac.cur) : '—'} color={ragColor(cacRag)} unit="per signed ToB" />
            <TextLine>Client ads + sales time · trailing 90 days</TextLine>
            <TextLine muted>{same}: {m.cac ? money0(m.cac.prev) : '—'}</TextLine>
          </Tile>
        </div>
      </Section>

      {/* 3. Where is it breaking? */}
      <Section title="Where is it breaking?" aside={`Upstream (Marketing) · Sales · Downstream (Recruitment) · ${same} underneath`}>
        <div style={{ background: brk ? 'rgba(240,80,74,.12)' : C.inset, border: `1px solid ${brk ? C.red : C.border}`, borderLeft: `3px solid ${brk ? C.red : C.green}`, borderRadius: 10, padding: '12px 14px', fontSize: 15, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
          {brk ? <><Chip tone="red">BIGGEST BREAK · {brk.owner}</Chip><span>{brk.text}. This one is in {brk.owner === 'MARKETING' ? 'Marketing’s' : 'Sales’'} section.</span></>
            : <span><strong>Biggest break:</strong> no step dropped vs last month.</span>}
        </div>
        <div style={{ ...CARD, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ ...LABEL, fontSize: 12 }}>CLIENT FUNNEL · colour band shows who owns each step</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Step owner="MARKETING" label="BOOKED" value={cur.callsBooked}>{sameShort}: {int(prev.callsBooked)}<Sub>Paid-ad meetings booked</Sub></Step>
            <Arrow {...rates[0]} pw={pw} />
            <Step owner="MARKETING" label="SHOWED" value={cur.callsHeld}>{prev.callsHeld != null && `${sameShort}: ${int(prev.callsHeld)}`}<Sub>Booked minus no-shows</Sub></Step>
            <Arrow {...rates[1]} pw={pw} />
            <Step owner="MARKETING" label="QUALIFIED" value={qualified(cur)}>{qualified(prev) != null && `${sameShort}: ${int(qualified(prev)!)}`}<Sub>Showed minus not a fit (no ToB)</Sub></Step>
            <Arrow {...rates[2]} pw={pw} />
            <Step owner="SALES" label="TOBS SENT" value={cur.tobsSent}>{sameShort}: {int(prev.tobsSent)}{!outcomesLogged && <Sub>Offer rate uses booked for now</Sub>}</Step>
            <Arrow {...rates[3]} pw={pw} />
            <Step owner="SALES" label="SIGNED" value={cur.signed}>{sameShort}: {int(prev.signed)}<Sub>Need {needed} by today · {target} by month end</Sub></Step>
            <Arrow {...rates[4]} pw={pw} />
            <Step owner="RECRUITMENT" label="JOB LOADED" value={null}><Sub>Signed ToB with a job within 30 days</Sub></Step>
          </div>
        </div>
        <div style={{ border: `1px dashed ${C.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 14, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <Chip tone="grey">WHY THEY DIDN’T SIGN</Chip>
          <span style={{ color: m.lostReasons.length ? C.text : C.muted }}>
            {m.lostReasons.length
              ? m.lostReasons.map(r => `${r.reason} ${r.count}`).join(' · ')
              : 'Not logged yet. Will read like: Fee 5 · No roles right now 4 · Went quiet 3'}
          </span>
        </div>
        <div style={{ border: `1px dashed ${C.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 14, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <Chip tone="grey">SPEED CHECK</Chip>
          <span style={{ color: C.muted }}>
            Median time to sign ({tts.label}): {tts.total > 0
              ? `${tts.median} day${tts.median === 1 ? '' : 's'} · ${tts.within7} of ${tts.total} signed inside 7 days`
              : 'no signings yet'}. Unsigned after {CALL_DAYS} days = call it personally.
          </span>
        </div>
      </Section>

      {/* 4. Open ToBs */}
      <Section title="Open ToBs · unsigned" aside={`${m.open.total} open now · oldest first`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {[['SENT', st.sent], ['WAITING', st.waiting], ['FOLLOW UP #1', st.fu1], ['FOLLOW UP #2–3', st.fu23], [`OVER ${CALL_DAYS} DAYS`, st.over14]].map(([l, n]) => (
            <div key={l} style={{ ...CARD, padding: 14 }}>
              <div style={{ ...LABEL, fontSize: 11 }}>{l}</div>
              <div style={{ fontFamily: NUM_FONT, fontSize: 28, fontWeight: 700, color: l === `OVER ${CALL_DAYS} DAYS` && Number(n) > 0 ? C.red : C.text }}>{n}</div>
            </div>
          ))}
        </div>
        <div style={{ ...CARD, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['CLIENT', 'SEQUENCE STAGE', 'DAYS UNSIGNED', 'STATUS', 'ACTION'].map(x => <th key={x} style={TH}>{x}</th>)}</tr></thead>
            <tbody>
              {m.open.list.length === 0 && <tr><td colSpan={5} style={{ ...TD, color: C.muted }}>No open ToBs.</td></tr>}
              {m.open.list.map((t, i) => {
                const s = openStatus(t);
                return (
                  <tr key={i}>
                    <td style={{ ...TD, fontWeight: 600 }}>{t.company}</td>
                    <td style={TD}>{t.stage}</td>
                    <td style={{ ...TD, color: s === 'CALL' ? C.red : s === 'WATCH' ? C.amber : C.text, fontWeight: 600 }}>{t.days}</td>
                    <td style={TD}><Chip tone={STATUS_TONE[s]}>{s}</Chip></td>
                    <td style={TD}>{s === 'CALL' ? 'Personal call today' : s === 'WATCH' ? `Call before day ${CALL_DAYS}` : t.stage === 'Waiting' ? 'Waiting on client' : 'Sequence running'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 5. Per salesperson */}
      <Section title="Per salesperson" aside={`${same} underneath`}>
        <div style={{ ...CARD, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['SALESPERSON', 'MEETINGS', 'TOBS SENT', 'SIGNED', 'CLOSE RATE', `STALE (OVER ${CALL_DAYS} DAYS)`].map(x => <th key={x} style={TH}>{x}</th>)}</tr></thead>
            <tbody>
              {m.salespeople.map(p => {
                const had = p.noShow == null ? p.calls : p.calls - p.noShow;
                const phad = p.prev.noShow == null ? p.prev.calls : p.prev.calls - p.prev.noShow;
                // Close rate matches the tile: signed ÷ qualified, meetings had until outcomes are logged.
                const q = p.noShow == null || p.notFit == null ? had : had - p.notFit;
                const pq = p.prev.noShow == null || p.prev.notFit == null ? phad : phad - p.prev.notFit;
                return (
                  <tr key={p.name}>
                    <td style={{ ...TD, fontWeight: 600 }}>{p.name}</td>
                    <td style={TD}>{int(had)}<Sub>{int(phad)}</Sub></td>
                    <td style={TD}>{int(p.sent)}<Sub>{int(p.prev.sent)}</Sub></td>
                    <td style={TD}>{int(p.signed)}<Sub>{int(p.prev.signed)}</Sub></td>
                    <td style={TD}>{pct(pctOf(p.signed, q))}<Sub>{pct(pctOf(p.prev.signed, pq))}</Sub></td>
                    <td style={{ ...TD, color: p.stale > 0 ? C.red : C.text, fontWeight: 600 }}>{p.stale}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 6. Trend */}
      <Section title="Trend" aside={`Signed ToBs per month · dashed line = target ${target}`}>
        <div style={{ ...CARD, padding: 16 }}>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={trend} margin={{ top: 18, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
              <YAxis hide domain={[0, (max: number) => Math.max(max, target) * 1.15]} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card }} labelStyle={{ color: C.text }} cursor={{ fill: C.inset }} />
              <ReferenceLine y={target} stroke={C.muted} strokeDasharray="4 4" />
              <Bar dataKey="signed" name="Signed ToBs" maxBarSize={44} radius={[3, 3, 0, 0]}>
                {trend.map(s => {
                  const partial = s.partial;
                  const fill = s.signed >= target ? C.green : C.greyFill;
                  return <Cell key={s.key} fill={partial ? 'transparent' : fill} stroke={partial ? C.muted : undefined} strokeDasharray={partial ? '4 3' : undefined} />;
                })}
                <LabelList dataKey="signed" position="top" style={{ fontSize: 10, fill: C.muted }} />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 12, color: C.muted }}>
            Green = hit target · grey = missed{w.isCurrent && ' · dashed outline = this month so far'}. Close rate gets added as a line once meetings are stored by month.
          </div>
        </div>
      </Section>

      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
        Colours: green at or ahead of target by today, amber 75–99%, red under 75%, grey for no data or no target. Never green for zero.
        Funnel bands: <span style={{ color: C.purple }}>Marketing</span> · <span style={{ color: C.blue }}>Sales</span> · <span style={{ color: C.teal }}>Recruitment</span>.
        Meetings are paid-ad calls (Client Paid Ads, by call date); not a fit = showed but closed with no ToB. ToBs sent and signed are all sources. Duplicate CRM companies count once. Open ToBs are as of today.
      </div>

      {showSettings && settings && <SettingsPanel settings={settings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
