import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { StatusBadge } from '../shared/StatusBadge';
import { WoWBadge } from '../shared/WoWBadge';
import { TimeFramePicker } from '../shared/TimeFramePicker';
import { Skeleton } from '../shared/Skeleton';
import { useSalesKPIs } from '../../hooks/queries';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import type { DepartmentStatus, TimeFrame } from '../../types';

function funnelConversion(numerator: number, denominator: number): string {
  if (denominator === 0) return '—';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function SalesSkeleton() {
  const statBlock = (i: number) => (
    <div key={i} style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
      <Skeleton height={10} width={80} style={{ marginBottom: 10 }} />
      <Skeleton height={22} width={60} style={{ marginBottom: 8 }} />
      <Skeleton height={10} width={50} />
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton height={22} width={80} />
          <Skeleton height={13} width={160} />
        </div>
        <Skeleton height={28} width={140} radius={8} />
      </div>
      <div style={{ ...CARD_STYLE, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton height={11} width={120} />
        <Skeleton height={44} width={140} radius={4} />
        <Skeleton height={12} width={220} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ flex: 1, background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <Skeleton height={9} width={50} />
              <Skeleton height={22} width={36} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {[0, 1, 2, 3, 4].map(statBlock)}
        </div>
      </div>
    </div>
  );
}

export function SalesCard() {
  const [frame, setFrame] = useState<TimeFrame>('week');
  const { data, error, isLoading, isFetching } = useSalesKPIs(frame);

  if (isLoading) return <SalesSkeleton />;
  if (!data) return null;

  const status: DepartmentStatus =
    data.callsToCloseRate >= 40 ? 'on-track' :
    data.callsToCloseRate >= 20 ? 'at-risk'  : 'off-track';

  const subtitleText =
    frame === 'day'   ? 'Today vs yesterday' :
    frame === 'week'  ? 'This week vs last week' :
    frame === 'month' ? 'Month to date vs prior period' :
                        'Year to date vs prior period';

  const statCard = (
    label: string,
    value: string | number,
    current: number,
    prev: number,
    opts?: { neutral?: boolean; invertDirection?: boolean; noWoW?: boolean }
  ) => (
    <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>{value}</div>
      {!opts?.noWoW && <WoWBadge current={current} prev={prev} neutral={opts?.neutral} invertDirection={opts?.invertDirection} />}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>Sales</h2>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>{subtitleText} · Updates daily</p>
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
          <TimeFramePicker value={frame} onChange={setFrame} />
          <StatusBadge status={error ? 'no-data' : status} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      <div style={{ ...CARD_STYLE, padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
          Calls to Close Rate
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontSize: 44, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-2px', lineHeight: 1 }}>
            {data.callsToCloseRate}%
          </span>
          <WoWBadge current={data.callsToCloseRate} prev={data.prevCallsToCloseRate} />
        </div>
        <p style={{ fontSize: 12, color: COLORS.textMuted, margin: '0 0 20px' }}>
          of calls this period converted to signed terms
        </p>

        {/* Funnel waterfall */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            Sales Funnel · This Period
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {([
              { label: 'Leads',    value: data.leadsThisWeek },
              { label: 'Booked',   value: data.bookedCalls },
              { label: 'TOB Sent', value: data.newPipelineThisWeek },
              { label: 'Signed',   value: data.closedClients },
            ] as const).map((stage, i, arr) => (
              <>
                <div key={stage.label} style={{ flex: 1, background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{stage.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.textPrimary }}>{stage.value}</div>
                </div>
                {i < arr.length - 1 && (
                  <div key={`a${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: COLORS.textMuted }}>{funnelConversion(arr[i + 1].value, stage.value)}</span>
                    <span style={{ fontSize: 14, color: COLORS.textMuted }}>→</span>
                  </div>
                )}
              </>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {statCard('Booked Calls',       data.bookedCalls,         data.bookedCalls,         data.prevBookedCalls)}
          {statCard('New Clients Closed', data.closedClients,       data.closedClients,       data.prevClosedClients)}
          {statCard('Lead to Close',      `${data.leadToCloseRate}%`, data.leadToCloseRate,   data.prevLeadToCloseRate)}
          {statCard('Open Pipeline',      data.openPipeline,        data.newPipelineThisWeek, data.newPipelinePrevWeek, { neutral: true })}
          {statCard('Hot Pipeline',       data.hotPipeline,         0,                        0,                        { noWoW: true })}
        </div>

        {/* Current vs Previous bar chart */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
            Current vs Previous Period
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={[
                { name: 'Leads',        current: data.leadsThisWeek,      prev: data.leadsPrevWeek },
                { name: 'Booked Calls', current: data.bookedCalls,        prev: data.prevBookedCalls },
                { name: 'TOB Sent',     current: data.newPipelineThisWeek,prev: data.newPipelinePrevWeek },
                { name: 'Signed',       current: data.closedClients,      prev: data.prevClosedClients },
              ]}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              barGap={3}
            >
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.textMuted }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.textMuted }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#1a1a1a' }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, color: COLORS.textMuted, paddingTop: 8 }} />
              <Bar dataKey="current" name="This period" fill={COLORS.accent} radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Bar dataKey="prev"    name="Prior period" fill={COLORS.textMuted} radius={[3, 3, 0, 0]} maxBarSize={32} opacity={0.5} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {error && (
        <p style={{ color: COLORS.warning, fontSize: 12, margin: 0 }}>⚠ Connection error — {error?.message}</p>
      )}
    </div>
  );
}
