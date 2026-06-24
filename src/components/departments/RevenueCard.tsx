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
import type { DepartmentStatus, TimeFrame, XeroAgedReceivable } from '../../types';

function fmtNZD(n: number) {
  return `$${n.toLocaleString('en-NZ', { maximumFractionDigits: 0 })}`;
}

function fmtAUD(n: number) {
  return `$${n.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
}

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
      {/* Xero hero skeleton */}
      <div style={{ ...CARD_STYLE, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton height={11} width={180} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '18px 20px' }}>
              <Skeleton height={10} width={80} style={{ marginBottom: 12 }} />
              <Skeleton height={36} width={120} style={{ marginBottom: 8 }} />
              <Skeleton height={10} width={60} />
            </div>
          ))}
        </div>
      </div>
      {/* Operations skeleton */}
      <div style={{ ...CARD_STYLE, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton height={11} width={160} />
        <Skeleton height={44} width={120} radius={4} />
        <Skeleton height={11} width={200} />
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

function HeroTile({ label, amount, count, countLabel, currency = 'NZD' }: {
  label: string;
  amount: number;
  count: number;
  countLabel: string;
  currency?: string;
}) {
  return (
    <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '18px 20px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontSize: 36, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-1.5px', lineHeight: 1, marginBottom: 6 }}>
        {fmtNZD(amount)}
      </div>
      <div style={{ fontSize: 12, color: COLORS.textMuted }}>
        {count} {countLabel} · {currency}
      </div>
    </div>
  );
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

function StatCard({ label, value, badge, sub }: {
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
      {sub && <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ReceivablesRow({ row }: { row: XeroAgedReceivable }) {
  const isRed    = row.overdue60 > 0 || row.overdue90 > 0;
  const isAmber  = !isRed && row.overdue30 > 0;
  const rowColor = isRed ? '#dc2626' : isAmber ? '#f59e0b' : COLORS.textPrimary;
  const cell = (val: number) => (
    <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 12, color: val > 0 ? rowColor : COLORS.textMuted }}>
      {val > 0 ? fmtNZD(val) : '—'}
    </td>
  );
  return (
    <tr>
      <td style={{ padding: '7px 10px', fontSize: 12, color: COLORS.textPrimary, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {row.contact}
      </td>
      {cell(row.current)}
      {cell(row.overdue30)}
      {cell(row.overdue60)}
      {cell(row.overdue90)}
      <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: rowColor }}>
        {fmtNZD(row.outstanding)}
      </td>
    </tr>
  );
}

export function RevenueCard() {
  const [frame, setFrame] = useState<TimeFrame>('month');
  const { data, error, isLoading, isFetching } = useRevenueKPIs(frame);
  const { data: xero, isLoading: xeroLoading } = useXeroFinanceData();

  if (isLoading) return <RevenueCardSkeleton />;
  if (!data) return null;

  const rev = xero?.revenue;

  const status: DepartmentStatus =
    rev
      ? (rev.paymentsReceived.amount >= 16000 ? 'on-track' : rev.paymentsReceived.amount >= 8000 ? 'at-risk' : 'off-track')
      : (data.totalRevenue >= 16000 ? 'on-track' : data.totalRevenue >= 8000 ? 'at-risk' : 'off-track');

  const subtitleText =
    frame === 'day'   ? 'Today vs yesterday' :
    frame === 'week'  ? 'This week vs last week' :
    frame === 'month' ? 'Month to date vs prior period' :
                        'Year to date vs prior period';

  const thStyle: React.CSSProperties = {
    padding: '6px 10px',
    textAlign: 'right',
    fontSize: 10,
    fontWeight: 600,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    whiteSpace: 'nowrap',
  };

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
          {(isFetching || xeroLoading) && (
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

      {/* SECTION 1: Xero Revenue Hero */}
      <div style={{ ...CARD_STYLE, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Xero Revenue — Accounting · Month to Date
          </div>
          {rev?.asOf && (
            <div style={{ fontSize: 10, color: COLORS.textMuted }}>
              as of {new Date(rev.asOf).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}
            </div>
          )}
        </div>

        {xeroLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[0, 1].map(i => (
              <div key={i} style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '18px 20px' }}>
                <Skeleton height={10} width={80} style={{ marginBottom: 12 }} />
                <Skeleton height={36} width={120} style={{ marginBottom: 8 }} />
                <Skeleton height={10} width={60} />
              </div>
            ))}
          </div>
        )}

        {rev && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <HeroTile
              label="Invoiced (MTD)"
              amount={rev.invoicesRaised.amount}
              count={rev.invoicesRaised.count}
              countLabel="invoices raised"
            />
            <HeroTile
              label="Collected (MTD)"
              amount={rev.paymentsReceived.amount}
              count={rev.paymentsReceived.count}
              countLabel="invoices paid"
            />
          </div>
        )}

        {!xeroLoading && !rev && (
          <p style={{ fontSize: 12, color: COLORS.textMuted, margin: 0 }}>
            Xero revenue data unavailable — webhook not configured or still loading
          </p>
        )}
      </div>

      {/* SECTION 2: Xero FY Revenue cross-check */}
      <div style={{ ...CARD_STYLE, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Xero Revenue — FY to Date
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
              <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>{fmtNZD(xero.nzRevenue)}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>New Zealand division</div>
            </div>
            <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                AUS Revenue
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>{fmtNZD(xero.ausRevenue)}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>Australia division</div>
            </div>
            <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Total (Xero)
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>{fmtNZD(xero.nzRevenue + xero.ausRevenue)}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>Combined · NZD</div>
            </div>
          </div>
        )}

        {!xeroLoading && !xero && (
          <p style={{ fontSize: 12, color: COLORS.textMuted, margin: 0 }}>Xero data unavailable</p>
        )}
      </div>

      {/* SECTION 3: Placement Operations (Airtable) */}
      <div style={{ ...CARD_STYLE, padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>
          Placement Operations — Airtable Tracking
        </div>

        {/* Total collected (Airtable) */}
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
          Total Collected (Airtable)
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontSize: 36, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-1.5px', lineHeight: 1 }}>
            {fmtAUD(data.totalRevenue)}
          </span>
          <WoWBadge current={data.totalRevenue} prev={data.prevTotalRevenue} />
        </div>
        <p style={{ fontSize: 12, color: COLORS.textMuted, margin: '0 0 20px' }}>
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

        {/* Stat grid */}
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
              { name: 'Placements',    current: data.placements,     prev: data.prevPlacements },
              { name: '1st Invoiced',  current: data.firstInvoiced,  prev: data.prevFirstInvoiced },
              { name: '1st Collected', current: data.firstCollected,  prev: data.prevFirstCollected },
              { name: '2nd Collected', current: data.secondCollected, prev: data.prevSecondCollected },
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

      {/* SECTION 4: Outstanding Receivables */}
      <div style={{ ...CARD_STYLE, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Outstanding Receivables — Xero
          </div>
          {rev?.asOf && (
            <div style={{ fontSize: 10, color: COLORS.textMuted }}>
              as of {new Date(rev.asOf).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}
            </div>
          )}
        </div>

        {xeroLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton height={11} width={120} style={{ marginBottom: 6 }} />
            {[0, 1, 2].map(i => <Skeleton key={i} height={32} width="100%" />)}
          </div>
        )}

        {rev && rev.agedReceivables.length > 0 && (
          <>
            {/* Hero outstanding */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 32, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-1px' }}>
                {fmtNZD(rev.outstandingTotal)}
              </span>
              <span style={{ fontSize: 13, color: COLORS.textMuted }}>
                across {rev.outstandingCount} client{rev.outstandingCount !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Aged table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Contact</th>
                    <th style={thStyle}>Current</th>
                    <th style={thStyle}>1–30d</th>
                    <th style={thStyle}>31–60d</th>
                    <th style={thStyle}>61d+</th>
                    <th style={thStyle}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rev.agedReceivables.slice(0, 5).map((row, i) => (
                    <ReceivablesRow key={i} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
            {rev.agedReceivables.length > 5 && (
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 8 }}>
                +{rev.agedReceivables.length - 5} more contacts not shown
              </div>
            )}
          </>
        )}

        {rev && rev.agedReceivables.length === 0 && (
          <p style={{ fontSize: 13, color: '#22c55e', margin: 0, fontWeight: 600 }}>
            No outstanding receivables — all invoices cleared ✓
          </p>
        )}

        {!xeroLoading && !rev && (
          <p style={{ fontSize: 12, color: COLORS.textMuted, margin: 0 }}>
            Xero data unavailable
          </p>
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
