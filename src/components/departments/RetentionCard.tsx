// Retention tab (spec: Retention_Tab_Spec_Trung_Rachel, 6 Oct 2026). JobAdder only, via the n8n
// Retention webhook; every number comes from summariseRetention so the Overview matches.
import { useState, type CSSProperties, type ReactNode } from 'react';
import { StatusBadge } from '../shared/StatusBadge';
import { Skeleton } from '../shared/Skeleton';
import { DiagnosisTile } from '../shared/DiagnosisTile';
import { useAuthRole } from '../auth/AuthContext';
import { useRetentionPlacements, useRetentionSettings, useSaveRetentionSettings } from '../../hooks/queries';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import { NZ, AM, RD, GREY, RAG_COLOR, money0, shortDate } from '../shared/monthTheme';
import { diagnoseRetention } from '../../lib/diagnosis';
import { summariseRetention, rateRag, DEFAULT_RETENTION_SETTINGS, OWNERS, type RateRow, type ReasonOwner } from '../../lib/retention';
import type { DepartmentStatus, RetentionSettings } from '../../types';

const LABEL: CSSProperties = { fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' };
const NOTE: CSSProperties = { fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.45 };
const TH: CSSProperties = { ...LABEL, fontSize: 10, textAlign: 'left', padding: '6px 6px', borderBottom: `1px solid ${COLORS.border}` };
const TD: CSSProperties = { padding: '7px 6px', fontSize: 13, color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.borderSubtle}` };
const OWNER_COLOR: Record<ReasonOwner, string> = { Recruiter: RD, Sales: AM, Rachel: NZ, None: GREY };

function Card({ title, children, style }: { title?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ ...CARD_STYLE, padding: 18, minWidth: 0, ...style }}>
      {title && <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 12 }}>{title}</div>}
      {children}
    </div>
  );
}

function Tile({ label, value, color, note, tag, big }: { label: string; value: string; color?: string; note: ReactNode; tag?: string; big?: boolean }) {
  return (
    <Card>
      <div style={LABEL}>{label}</div>
      <div style={{ fontSize: big ? 40 : 26, fontWeight: 800, color: color ?? COLORS.textPrimary, margin: big ? '8px 0 4px' : '6px 0 2px', letterSpacing: '-1px' }}>{value}</div>
      <div style={NOTE}>{note}</div>
      {tag && <span style={{ display: 'inline-block', marginTop: 8, fontSize: 11, background: COLORS.border, borderRadius: 10, padding: '2px 9px', color: COLORS.textSecondary }}>{tag}</span>}
    </Card>
  );
}

function Row({ cols, children }: { cols: string; children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 16 }}>{children}</div>;
}

function RateTable({ head, rows, settings, recruiter }: { head: string; rows: RateRow[]; settings: RetentionSettings; recruiter?: boolean }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={TH}>{head}</th><th style={TH}>Signed</th>
          {recruiter ? <><th style={TH}>Pre</th><th style={TH}>Post</th></> : <th style={TH}>Fell</th>}
          <th style={TH}>Rate</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.name}>
            <td style={TD}>{r.name}</td><td style={TD}>{r.signed}</td>
            {recruiter ? <><td style={TD}>{r.pre}</td><td style={TD}>{r.post}</td></> : <td style={TD}>{r.fell}</td>}
            <td style={{ ...TD, color: RAG_COLOR[rateRag(r.rate, settings)] }}>{Math.round(r.rate)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RetentionSettingsPanel({ settings, onClose }: { settings: RetentionSettings; onClose: () => void }) {
  const save = useSaveRetentionSettings();
  const [green, setGreen] = useState(String(settings.greenMax));
  const [amber, setAmber] = useState(String(settings.amberMax));
  const [cutoff, setCutoff] = useState(settings.rachelCutoff);
  const [password, setPassword] = useState('');
  const input: CSSProperties = { background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.textPrimary, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box', colorScheme: 'dark' };
  const label: CSSProperties = { fontSize: 11, color: COLORS.textMuted };
  const button: CSSProperties = { fontSize: 12, padding: '6px 12px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.textSecondary, cursor: 'pointer' };
  const submit = () => save.mutate(
    { settings: { greenMax: Number(green), amberMax: Number(amber), rachelCutoff: cutoff }, adminPassword: password },
    { onSuccess: onClose },
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '1.25rem', width: 400 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>Retention settings</div>
        <div style={{ ...label, marginBottom: 12 }}>Status thresholds on the fall-over rate. Interim until Les sets targets.</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Green up to (%)</label>
            <input style={{ ...input, margin: '4px 0 12px' }} type="number" min={0} max={100} step={0.5} value={green} onChange={e => setGreen(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>Amber up to (%)</label>
            <input style={{ ...input, margin: '4px 0 12px' }} type="number" min={0} max={100} step={0.5} value={amber} onChange={e => setAmber(e.target.value)} />
          </div>
        </div>
        <label style={label}>Before/after Rachel cut-off (cohort marker)</label>
        <input style={{ ...input, margin: '4px 0 12px' }} type="date" value={cutoff} onChange={e => setCutoff(e.target.value)} />
        <div><label style={label}>Admin password</label></div>
        <input style={{ ...input, margin: '4px 0 12px' }} type="password" value={password} onChange={e => setPassword(e.target.value)} />
        {save.error && <div style={{ fontSize: 11, color: COLORS.danger, marginBottom: 10 }}>{save.error.message}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={button}>Cancel</button>
          <button onClick={submit} disabled={save.isPending} style={{ ...button, border: 'none', background: COLORS.accent, color: COLORS.textPrimary }}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RetentionSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton height={22} width={120} />
          <Skeleton height={13} width={320} />
        </div>
        <Skeleton height={28} width={80} radius={8} />
      </div>
      <Skeleton height={52} radius={10} />
      <div style={{ display: 'flex', gap: 16 }}>{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} height={130} radius={12} style={{ flex: 1 }} />)}</div>
      <div style={{ display: 'flex', gap: 16 }}>{[0, 1, 2, 3].map(i => <Skeleton key={i} height={100} radius={12} style={{ flex: 1 }} />)}</div>
      <div style={{ display: 'flex', gap: 16 }}>{[0, 1].map(i => <Skeleton key={i} height={300} radius={12} style={{ flex: 1 }} />)}</div>
      <p style={{ ...NOTE, margin: 0 }}>Reading placements and notes from JobAdder, this takes about 30 seconds…</p>
    </div>
  );
}

export function RetentionCard() {
  const { data: placements, error } = useRetentionPlacements();
  const settingsQuery = useRetentionSettings();
  const role = useAuthRole();
  const [showSettings, setShowSettings] = useState(false);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, margin: 0 }}>Retention</h2>
        <StatusBadge status="no-data" />
        <p style={{ color: COLORS.warning, fontSize: 12, margin: 0 }}>⚠ Connection error — {error.message}</p>
      </div>
    );
  }
  if (!placements || settingsQuery.isLoading) return <RetentionSkeleton />;

  const settings = { ...DEFAULT_RETENTION_SETTINGS, ...settingsQuery.data };
  const s = summariseRetention(placements, settings);
  const diagnosis = diagnoseRetention(s, settings);
  const status: DepartmentStatus =
    diagnosis.tone === 'green' ? 'on-track' : diagnosis.tone === 'amber' ? 'at-risk' : diagnosis.tone === 'red' ? 'off-track' : 'no-data';
  const rateColor = (r: number) => RAG_COLOR[rateRag(r, settings)];
  const maxReason = Math.max(1, ...s.reasons.map(r => r.count));
  const maxBand = Math.max(1, ...s.weekBands.map(b => b.count));
  const owed = s.replacementsOwed;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>Retention</h2>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>
            Current state · Updates daily · Guarantee 16 weeks · Start dates {s.periodLabel}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {role === 'admin' && (
            <button onClick={() => setShowSettings(true)} title="Retention settings" style={{ background: COLORS.bgCard, color: COLORS.textMuted, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 14, cursor: 'pointer' }}>⚙</button>
          )}
          <StatusBadge status={status} />
        </div>
      </div>

      <DiagnosisTile diagnosis={diagnosis} />

      <div style={LABEL}>Headline</div>
      <Row cols="1.3fr 1fr 1fr 1fr 1fr">
        <Tile big label="Fall-over rate" value={`${s.fallOverRate}%`} color={rateColor(s.fallOverRate)}
          note={`${s.fallOvers} of ${s.signed} signed fell over`} tag="Headline · drives status" />
        <Tile label="Pre-start pull-out" value={`${s.preRate}%`} color={rateColor(s.preRate)}
          note={`${s.pre} of ${s.signed} never reached site`} tag="Owner: Recruiters" />
        <Tile label="In-guarantee fall-over" value={`${s.inGuaranteeRate}%`} color={rateColor(s.inGuaranteeRate)}
          note={`${s.post} of ${s.startedCount} who started`} tag="Owner: Rachel + Sales" />
        <Tile label="Save rate" value={s.saveRate == null ? '—' : `${s.saveRate}%`} color={s.saveRate == null ? COLORS.textMuted : undefined}
          note={s.saveRate == null ? 'No At Risk outcomes yet. A save confirms at 16 weeks' : `${s.saves} saved, ${s.lost} lost after an At Risk flag`} tag="Lagging · Rachel" />
        <Tile label="Live rescues" value={String(s.liveRescues)}
          note="At Risk, still live and inside the guarantee" tag="Leading · Rachel" />
      </Row>

      <Row cols="repeat(4, 1fr)">
        <Tile label="Signed, not started" value={String(s.notStarted)} note={s.notStartedMonths} />
        <Tile label="Active in guarantee" value={String(s.activeInGuarantee)} note="Started, under 16 weeks" />
        <Tile label="Guarantee complete" value={String(s.guaranteeComplete)}
          note={s.nextClear ? `Next clears ${shortDate(s.nextClear.date)} (${s.nextClear.client})` : 'None in guarantee'} />
        <Tile label="Replacements owed" value={String(owed.length)} color={owed.length ? AM : undefined}
          note={owed.length ? owed.map(o => o.client).join(', ') : 'None logged as Fee Outcome "Replacement owed"'} />
      </Row>

      <Row cols="1fr 1fr">
        <Card title="Stage — where they fall over">
          {s.fallOvers > 0 ? (
            <div style={{ display: 'flex', height: 34, borderRadius: 8, overflow: 'hidden', fontSize: 13, fontWeight: 700, color: COLORS.bgPage }}>
              {s.pre > 0 && <div style={{ width: `${(s.pre / s.fallOvers) * 100}%`, background: RD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Pre-start {s.pre}</div>}
              {s.post > 0 && <div style={{ width: `${(s.post / s.fallOvers) * 100}%`, background: '#ff8a65', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Post-start {s.post}</div>}
            </div>
          ) : <div style={NOTE}>No fall-overs.</div>}
          <div style={{ ...NOTE, margin: '16px 0 10px' }}>Post-start fall-overs by week after start (to the date the problem was logged)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22, height: 150, padding: '0 10px', borderBottom: `1px solid ${COLORS.border}` }}>
            {s.weekBands.map(b => (
              <div key={b.label} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '60%', height: b.count ? (b.count / maxBand) * 130 : 4, background: b.count ? '#ff8a65' : COLORS.border, borderRadius: '6px 6px 0 0' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 22, padding: '6px 10px 0' }}>
            {s.weekBands.map(b => (
              <div key={b.label} style={{ flex: 1, textAlign: 'center', fontSize: 12, color: COLORS.textSecondary }}>{b.label}<br /><b style={{ color: COLORS.textPrimary }}>{b.count}</b></div>
            ))}
          </div>
        </Card>

        <Card title="Why — reason and owner">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={TH}>Reason</th><th style={TH}>Stage</th><th style={TH}>Owner</th><th style={TH}>#</th><th style={{ ...TH, width: '30%' }} /></tr></thead>
            <tbody>
              {[...s.reasons].sort((a, b) => b.count - a.count).map(r => (
                <tr key={r.name}>
                  <td style={TD}>{r.name}</td><td style={TD}>{r.stage}</td><td style={TD}>{r.owner}</td><td style={TD}>{r.count}</td>
                  <td style={TD}>{r.count > 0 && <div style={{ height: 10, borderRadius: 5, width: `${(r.count / maxReason) * 100}%`, background: OWNER_COLOR[r.owner] }} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ ...NOTE, marginTop: 10 }}>
            <b>By owner:</b> {OWNERS.map(o => `${o} ${s.byOwner[o]}`).join(' · ')}
            {s.familyFlag && <span style={{ color: AM }}> | Family/personal {Math.round(s.familyShare * 100)}% — over 20% flag</span>}
            {s.unlabelled > 0 && <div style={{ color: AM, marginTop: 4 }}>{s.unlabelled} of {s.fallOvers} drop-offs have no "Reason:" label yet (Dropoff Reason note)</div>}
          </div>
        </Card>
      </Row>

      <Row cols="1fr 1fr 1fr">
        <Card title="Who — by client"><RateTable head="Client" rows={s.byClient} settings={settings} /></Card>
        <Card title="Who — by trade"><RateTable head="Trade" rows={s.byTrade} settings={settings} /><div style={{ ...NOTE, marginTop: 10 }}>Grouped from the JobAdder job title</div></Card>
        <Card title="Who — by recruiter"><RateTable head="Recruiter" rows={s.byRecruiter} settings={settings} recruiter /><div style={{ ...NOTE, marginTop: 10 }}>Credited to whoever created the placement</div></Card>
      </Row>

      <Row cols="1.2fr 1fr">
        <Card title="Cohorts — % still live, by month signed">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={TH}>Signed</th><th style={TH}>Placed</th>{['4 wks', '8 wks', '16 wks'].map(h => <th key={h} style={{ ...TH, textAlign: 'center' }}>{h}</th>)}</tr></thead>
            <tbody>
              {s.cohorts.map((c, i) => {
                const marker = c.afterCutoff && !s.cohorts[i - 1]?.afterCutoff;
                const cell: CSSProperties = { ...TD, ...(marker && { borderTop: `2px solid ${RD}` }) };
                return (
                  <tr key={c.month}>
                    <td style={cell}>{c.label}</td><td style={cell}>{c.placed}</td>
                    {c.live.map((v, j) => (
                      <td key={j} style={{ ...cell, textAlign: 'center', color: v == null ? COLORS.textMuted : v >= 90 ? NZ : v >= 75 ? AM : RD }}>
                        {v == null ? 'pending' : `${Math.round(v)}%`}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ ...NOTE, marginTop: 10 }}>
            Red line = before/after Rachel ({shortDate(settings.rachelCutoff)}). Green ≥90%, amber 75–89%, red &lt;75%, counting placements that have reached that week.
            {' '}Last 2 months: {s.last2Months.signed} signed, {s.last2Months.fell} fell over.
          </div>
        </Card>

        <Card title="Saves & rework">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={TH}>Placement</th><th style={TH}>Signalled by</th><th style={TH}>Issue</th><th style={TH}>Days</th><th style={TH}>State</th></tr></thead>
            <tbody>
              {s.atRiskRows.length ? s.atRiskRows.map(r => (
                <tr key={r.placementId}>
                  <td style={TD}>{r.candidate || r.placementId}<div style={{ fontSize: 11, color: COLORS.textMuted }}>{r.client}</div></td>
                  <td style={TD}>{r.by}</td><td style={{ ...TD, fontSize: 12 }}>{r.issue}</td><td style={TD}>{r.days}</td>
                  <td style={{ ...TD, color: r.state === 'Saved' ? NZ : r.state === 'Lost' ? RD : AM }}>{r.state}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} style={TD}>
                  <div style={{ border: `1px dashed ${COLORS.border}`, borderRadius: 8, padding: 14, color: COLORS.textMuted, fontSize: 12.5, textAlign: 'center' }}>No At Risk notes logged yet.</div>
                </td></tr>
              )}
            </tbody>
          </table>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 14 }}>
            <Tile label="Confirmed" value={String(s.saves)} note="Saves" />
            <Tile label="Lost" value={String(s.lost)} note="After an At Risk flag" />
            <Tile label="Fee lost" value={s.feeOutcomesLogged ? money0(s.feeLost) : '—'} color={s.feeOutcomesLogged ? undefined : COLORS.textMuted}
              note={s.feeOutcomesLogged ? 'Reduced or refunded' : 'No Fee Outcome notes yet'} />
          </div>
          <div style={{ ...NOTE, marginTop: 10 }}>Replacements: {owed.length} owed · {s.replacementsInProgress} in progress</div>
        </Card>
      </Row>

      {showSettings && <RetentionSettingsPanel settings={settings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
