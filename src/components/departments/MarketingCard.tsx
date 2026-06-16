import { useCallback, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { StatusBadge } from '../shared/StatusBadge';
import { WoWBadge } from '../shared/WoWBadge';
import { TimeFramePicker } from '../shared/TimeFramePicker';
import { Skeleton } from '../shared/Skeleton';
import { useAirtable } from '../../hooks/useAirtable';
import { fetchMarketingKPIs } from '../../services/airtable';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import type { DepartmentStatus, TimeFrame } from '../../types';

function fmtCurrency(n: number) {
  return `$${n.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
}

const hasMarketingCredentials =
  Boolean(import.meta.env.VITE_AIRTABLE_API_KEY) &&
  Boolean(import.meta.env.VITE_AIRTABLE_CLIENTS_BASE_ID) &&
  Boolean(import.meta.env.VITE_AIRTABLE_CANDIDATES_BASE_ID) &&
  Boolean(import.meta.env.VITE_META_TOKEN);

function MarketingSkeleton() {
  const miniCard = (i: number) => (
    <div key={i} style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
      <Skeleton height={10} width={70} style={{ marginBottom: 10 }} />
      <Skeleton height={22} width={60} style={{ marginBottom: 8 }} />
      <Skeleton height={10} width={50} />
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton height={22} width={100} />
          <Skeleton height={13} width={160} />
        </div>
        <Skeleton height={28} width={140} radius={8} />
      </div>
      <div style={{ ...CARD_STYLE, padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 24 }}>
          {[0, 1].map(col => col === 1
            ? <div key="div" style={{ background: COLORS.borderSubtle }} />
            : (
              <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Skeleton height={11} width={120} />
                <Skeleton height={44} width={80} radius={4} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[0, 1].map(miniCard)}
                </div>
              </div>
            )
          )}
        </div>
      </div>
      <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${COLORS.border}` }}>
          <Skeleton height={10} width={120} />
        </div>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '12px 14px', borderTop: i > 0 ? `1px solid ${COLORS.borderSubtle}` : undefined, gap: 12 }}>
            <Skeleton height={13} width={100} />
            <Skeleton height={13} width={30} style={{ justifySelf: 'end' }} />
            <Skeleton height={13} width={36} style={{ justifySelf: 'end' }} />
            <Skeleton height={13} width={50} style={{ justifySelf: 'end' }} />
          </div>
        ))}
      </div>
      <div style={{ ...CARD_STYLE, padding: 20 }}>
        <Skeleton height={10} width={80} style={{ marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton height={10} width={70} />
            <Skeleton height={26} width={100} radius={4} />
          </div>
          <div style={{ width: 1, background: COLORS.border }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton height={10} width={90} />
            <Skeleton height={26} width={100} radius={4} />
            <Skeleton height={5} radius={3} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MarketingCard() {
  const [frame, setFrame] = useState<TimeFrame>('month');
  const fetcher = useCallback(() => fetchMarketingKPIs(frame), [frame]);
  const { data, error } = useAirtable(fetcher, hasMarketingCredentials);

  if (!data) return <MarketingSkeleton />;

  const qualCandidates = data.candidates.qualified;
  const qualClients    = data.clients.qualified;

  const status: DepartmentStatus =
    qualCandidates >= 20 && qualClients >= 5 ? 'on-track' :
    qualCandidates >= 10 || qualClients >= 3 ? 'at-risk'  : 'off-track';

  const spend = data.spend.thisWeek;

  const subtitleText =
    frame === 'day'   ? 'Today vs yesterday' :
    frame === 'week'  ? 'This week vs last week' :
    frame === 'month' ? 'Month to date vs prior period' :
                        'Year to date vs prior period';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>
            Marketing
          </h2>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>
            {subtitleText} · Updates daily
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TimeFramePicker value={frame} onChange={setFrame} />
          <StatusBadge status={error ? 'no-data' : status} />
        </div>
      </div>

      {/* HERO CARD: Candidate + Client leads */}
          <div style={{ ...CARD_STYLE, padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 24 }}>
              {/* Candidate leads */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                  Candidate Leads
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 16 }}>
                  <span style={{ fontSize: 44, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-2px', lineHeight: 1 }}>
                    {data.candidates.qualified}
                  </span>
                  <WoWBadge current={data.candidates.qualified} prev={data.candidates.prevQualified} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Qual Rate</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: data.candidates.qualRate >= 50 ? COLORS.accent : COLORS.warning }}>
                      {data.candidates.qualRate}%
                    </div>
                    <WoWBadge current={data.candidates.qualRate} prev={data.candidates.prevQualRate} />
                  </div>
                  <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Cost per Lead</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>
                      {spend > 0 && data.candidates.qualified > 0 ? fmtCurrency(data.candidates.cpl) : '—'}
                    </div>
                    {data.candidates.prevCpl > 0 && data.candidates.cpl > 0 && (
                      <WoWBadge current={data.candidates.cpl} prev={data.candidates.prevCpl} invertDirection />
                    )}
                  </div>
                </div>
              </div>

              {/* Column divider */}
              <div style={{ background: COLORS.borderSubtle }} />

              {/* Client leads */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                  Client Leads
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 16 }}>
                  <span style={{ fontSize: 32, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-1.5px', lineHeight: 1 }}>
                    {data.clients.qualified}
                  </span>
                  <WoWBadge current={data.clients.qualified} prev={data.clients.prevQualified} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Qual Rate</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: data.clients.qualRate >= 50 ? COLORS.accent : COLORS.warning }}>
                      {data.clients.qualRate}%
                    </div>
                    <WoWBadge current={data.clients.qualRate} prev={data.clients.prevQualRate} />
                  </div>
                  <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Cost per Lead</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>
                      {spend > 0 && data.clients.qualified > 0 ? fmtCurrency(data.clients.cpl) : '—'}
                    </div>
                    {data.clients.prevCpl > 0 && data.clients.cpl > 0 && (
                      <WoWBadge current={data.clients.cpl} prev={data.clients.prevCpl} invertDirection />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CHANNEL BREAKDOWN CARD */}
          <div style={CARD_STYLE}>
            <div style={{ padding: '16px 20px 0' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Channel Breakdown
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Channel', 'Leads', 'Qual %', 'Cost per Qual. Lead'].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        fontSize: 10, fontWeight: 700, color: COLORS.textMuted,
                        textTransform: 'uppercase', letterSpacing: '0.07em',
                        padding: '10px 14px',
                        textAlign: i === 0 ? 'left' : 'right',
                        background: COLORS.bgSubtle,
                        borderBottom: `1px solid ${COLORS.border}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.channels.map((row, i) => (
                  <tr key={row.channel}>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: COLORS.textPrimary, borderBottom: i < data.channels.length - 1 ? `1px solid ${COLORS.borderSubtle}` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.cpl !== null ? COLORS.accent : COLORS.textMuted }} />
                        {row.channel}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: COLORS.textPrimary, textAlign: 'right', borderBottom: i < data.channels.length - 1 ? `1px solid ${COLORS.borderSubtle}` : 'none' }}>
                      {row.leads}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: row.qualRate >= 50 ? COLORS.accent : COLORS.warning, textAlign: 'right', borderBottom: i < data.channels.length - 1 ? `1px solid ${COLORS.borderSubtle}` : 'none' }}>
                      {row.leads > 0 ? `${row.qualRate}%` : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: row.cpl !== null ? COLORS.textPrimary : COLORS.textMuted, textAlign: 'right', borderBottom: i < data.channels.length - 1 ? `1px solid ${COLORS.borderSubtle}` : 'none' }}>
                      {row.cpl !== null && row.cpl > 0 ? fmtCurrency(row.cpl) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CHANNEL CHART */}
          {data.channels.some(c => c.leads > 0) && (
            <div style={{ ...CARD_STYLE, padding: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
                Channel Performance
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <ComposedChart
                  data={data.channels.map(c => ({ name: c.channel, Leads: c.leads, 'Qual %': c.qualRate }))}
                  margin={{ top: 4, right: 20, left: -20, bottom: 0 }}
                >
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} domain={[0, 100]} tick={{ fontSize: 11, fill: COLORS.accent }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip
                    formatter={(value, name) => name === 'Qual %' ? [`${Number(value)}%`, String(name)] : [value, name]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#1a1a1a' }}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, color: COLORS.textMuted, paddingTop: 8 }} />
                  <Bar yAxisId="left" dataKey="Leads" fill={COLORS.accent} radius={[3,3,0,0]} maxBarSize={48} opacity={0.85} />
                  <Line yAxisId="right" type="monotone" dataKey="Qual %" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, fill: '#f59e0b' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* AD SPEND CARD */}
          <div style={{ ...CARD_STYLE, padding: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
              Ad Spend
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              {/* This week */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>This Week</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 26, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-1px' }}>
                    {fmtCurrency(Math.round(spend))}
                  </span>
                  <WoWBadge current={data.spend.thisWeek} prev={data.spend.prevWeek} neutral />
                </div>
                <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 3 }}>
                  vs {fmtCurrency(Math.round(data.spend.prevWeek))} last week
                </div>
              </div>

              <div style={{ width: 1, background: COLORS.border, alignSelf: 'stretch' }} />

              {/* Weekly budget */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Weekly Budget</div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 26, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-1px' }}>
                    {data.weeklyBudget > 0 ? fmtCurrency(data.weeklyBudget) : '—'}
                  </span>
                  {data.weeklyBudget > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.accent }}>
                      {Math.round((spend / data.weeklyBudget) * 100)}% used
                    </span>
                  )}
                </div>
                {data.weeklyBudget > 0 && (
                  <>
                    <div style={{ background: COLORS.border, borderRadius: 3, height: 5, marginTop: 8, overflow: 'hidden' }}>
                      <div
                        style={{
                          background: COLORS.accent,
                          height: '100%',
                          borderRadius: 3,
                          width: `${Math.min(Math.round((spend / data.weeklyBudget) * 100), 100)}%`,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 6 }}>
                      {fmtCurrency(Math.max(0, Math.round(data.weeklyBudget - spend)))} remaining
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
      {error && (
        <p style={{ color: COLORS.warning, fontSize: 12, margin: 0 }}>
          ⚠ Using demo data — {error}
        </p>
      )}
    </div>
  );
}
