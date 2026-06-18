import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { StatusBadge } from '../shared/StatusBadge';
import { WoWBadge } from '../shared/WoWBadge';
import { TimeFramePicker } from '../shared/TimeFramePicker';
import { Skeleton } from '../shared/Skeleton';
import { useRevenueKPIs, useXeroFinanceData } from '../../hooks/queries';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import type { DepartmentStatus, TimeFrame } from '../../types';

function RevenueCardSkeleton() {
  const statBlock = (i: number) => (
    <div key={i} style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
      <Skeleton height={10} width={90} style={{ marginBottom: 10 }} />
      <Skeleton height={22} width={50} style={{ marginBottom: 8 }} />
      <Skeleton height={10} width={70} />
    </div>
  );
  const flowStage = (i: number) => (
    <div key={i} style={{ flex: 1, background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px', textAlign: 'center' as const }}>
      <Skeleton height={9} width={70} style={{ margin: '0 auto 10px' }} />
      <Skeleton height={28} width={40} style={{ margin: '0 auto' }} radius={4} />
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
        <Skeleton height={11} width={160} />
        <Skeleton height={44} width={120} radius={4} />
        <Skeleton height={11} width={200} />
        <Skeleton height={11} width={110} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ display: 'contents' }}>
              {flowStage(i)}
              {i < 2 && <span style={{ color: COLORS.textMuted }}>→</span>}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[0, 1, 2, 3].map(statBlock)}
        </div>
      </div>
    </div>
  );
}

function fmtAUD(n: number) {
  return `$${n.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
}

function FlowStage({ label, count, amount }: { label: string; count: number; amount?: number }) {
  return (
    <div style={{
      flex: 1, background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`,
      borderRadius: 10, padding: '14px 16px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-1px', lineHeight: 1 }}>
        {count}
      </div>
      {amount !== undefined && amount > 0 && (
        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.accent, marginTop: 4 }}>
          {fmtAUD(amount)}
        </div>
      )}
    </div>
  );
}

function FlowArrow() {
  return (
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', paddingTop: 6 }}>
      <span style={{ fontSize: 18, color: COLORS.textMuted }}>→</span>
    </div>
  );
}

function StatCard({
  label, value, badge, sub,
}: {
  label: string;
  value: string | number;
  badge?: React.ReactNode;
  sub?: string;
}) {
  return (
    <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>
        {value}
      </div>
      {badge}
      {sub && (
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function RevenueCard() {
  const [frame, setFrame] = useState<TimeFrame>('month');
  const { data, error, isLoading, isFetching } = useRevenueKPIs(frame);
  const { data: xero, isLoading: xeroLoading } = useXeroFinanceData();

  if (isLoading) return <RevenueCardSkeleton />;
  if (!data) return null;

  const status: DepartmentStatus =
    data.totalRevenue >= 16000 ? 'on-track' :
    data.totalRevenue >= 8000  ? 'at-risk'  : 'off-track';

  const subtitleText =
    frame === 'day'   ? 'Today vs yesterday' :
    frame === 'week'  ? 'This week vs last week' :
    frame === 'month' ? 'Month to date vs prior period' :
                        'Year to date vs prior period';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>
            Revenue
          </h2>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>
            {subtitleText} · Updates daily
          </p>
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
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* HERO: Total Revenue */}
      <div style={{ ...CARD_STYLE, padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
          Total Revenue Collected
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontSize: 44, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-2px', lineHeight: 1 }}>
            {fmtAUD(data.totalRevenue)}
          </span>
          <WoWBadge current={data.totalRevenue} prev={data.prevTotalRevenue} />
        </div>
        <p style={{ fontSize: 12, color: COLORS.textMuted, margin: '0 0 24px' }}>
          first + second payments received this period · AUD
        </p>

        {/* Payment flow: First Payments */}
        <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
          First Payment Flow
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <FlowStage label="Placements" count={data.placements} />
          <FlowArrow />
          <FlowStage label="Invoiced ($8k)" count={data.firstInvoiced} />
          <FlowArrow />
          <FlowStage label="Collected ($8k)" count={data.firstCollected} amount={data.firstCollectedAmount} />
        </div>

        {/* Stat grid: second payments + CAC */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <StatCard
            label="Pending 2nd Payment"
            value={data.pendingSecond}
            sub="Candidate started, invoice not yet sent"
          />
          <StatCard
            label="2nd Payments Collected"
            value={data.secondCollected}
            badge={<WoWBadge current={data.secondCollected} prev={data.prevSecondCollected} />}
            sub={data.secondCollectedAmount > 0 ? fmtAUD(data.secondCollectedAmount) : undefined}
          />
          <StatCard
            label="1st Invoiced"
            value={data.firstInvoiced}
            badge={<WoWBadge current={data.firstInvoiced} prev={data.prevFirstInvoiced} />}
          />
          <StatCard
            label={`CAC · ${subtitleText}`}
            value={data.cac > 0 ? fmtAUD(data.cac) : '—'}
            badge={data.cac > 0 && data.prevCac > 0
              ? <WoWBadge current={data.cac} prev={data.prevCac} invertDirection />
              : undefined
            }
            sub={data.cac > 0
              ? `${fmtAUD(data.adSpend)} spend / ${data.clientsClosed} client${data.clientsClosed !== 1 ? 's' : ''} closed`
              : 'Connect Meta + Sales to calculate'
            }
          />
        </div>
      </div>

      {/* Revenue current vs previous bar chart */}
      <div style={{ ...CARD_STYLE, padding: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
          Current vs Previous Period
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={[
              { name: 'Placements',   current: data.placements,    prev: data.prevPlacements },
              { name: '1st Invoiced', current: data.firstInvoiced, prev: data.prevFirstInvoiced },
              { name: '1st Collected',current: data.firstCollected,prev: data.prevFirstCollected },
              { name: '2nd Collected',current: data.secondCollected,prev: data.prevSecondCollected },
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
            <Bar dataKey="current" name="This period"  fill={COLORS.accent}    radius={[3,3,0,0]} maxBarSize={32} />
            <Bar dataKey="prev"    name="Prior period" fill={COLORS.textMuted} radius={[3,3,0,0]} maxBarSize={32} opacity={0.5} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Xero Revenue cross-check */}
      <div style={{ ...CARD_STYLE, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Xero Revenue — Accounting (FY to date)
          </div>
          {xero?.asOf && (
            <div style={{ fontSize: 10, color: COLORS.textMuted }}>
              as of {new Date(xero.asOf).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
            </div>
          )}
        </div>

        {xeroLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
                <Skeleton height={10} width={60} style={{ marginBottom: 10 }} />
                <Skeleton height={22} width={80} />
              </div>
            ))}
          </div>
        )}

        {xero && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                NZ Revenue
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>{fmtAUD(xero.nzRevenue)}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>New Zealand division</div>
            </div>
            <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                AUS Revenue
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>{fmtAUD(xero.ausRevenue)}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>Australia division</div>
            </div>
            <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Total (Xero)
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>{fmtAUD(xero.nzRevenue + xero.ausRevenue)}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>Combined · AUD</div>
            </div>
          </div>
        )}

        {!xeroLoading && !xero && (
          <p style={{ fontSize: 12, color: COLORS.textMuted, margin: 0 }}>Xero data unavailable</p>
        )}
      </div>

      {error && (
        <p style={{ color: COLORS.warning, fontSize: 12, margin: 0 }}>
          ⚠ Using demo data — {error?.message}
        </p>
      )}
    </div>
  );
}
