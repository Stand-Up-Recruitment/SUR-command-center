import { useState } from 'react';
import { useLTGPKPIs } from '../../hooks/queries';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import { Skeleton } from '../shared/Skeleton';
import type { LTGPFrame, LTGPKPIs } from '../../types';

const FRAMES: { label: string; value: LTGPFrame }[] = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: '12m', value: '12m' },
  { label: 'All', value: 'all' },
];

const AVG_PLACEMENT_CYCLE_DAYS = 45;

function fmtAud(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

function fmtAudFull(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function ratioColor(ratio: number): string {
  if (ratio >= 9) return COLORS.success;
  if (ratio >= 6) return COLORS.warning;
  return COLORS.danger;
}

function ratioBg(ratio: number): string {
  if (ratio >= 9) return COLORS.successBg;
  if (ratio >= 6) return COLORS.warningBg;
  return COLORS.dangerBg;
}

function ratioBorder(ratio: number): string {
  if (ratio >= 9) return '#166534';
  if (ratio >= 6) return '#78350f';
  return COLORS.accentBorder;
}

function ratioLabel(ratio: number): string {
  if (ratio >= 9) return '✓ Above Hormozi 9:1 minimum';
  if (ratio >= 6) return '⚠ Below 9:1 — at risk';
  return '✗ Below 6:1 — critical';
}

function LTGPSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton height={22} width={120} />
          <Skeleton height={13} width={200} />
        </div>
        <Skeleton height={28} width={160} radius={8} />
      </div>
      <div style={{ ...CARD_STYLE, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Skeleton height={72} width={180} radius={8} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
              <Skeleton height={10} width={80} style={{ marginBottom: 10 }} />
              <Skeleton height={22} width={70} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
              <Skeleton height={10} width={80} style={{ marginBottom: 10 }} />
              <Skeleton height={22} width={70} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '14px 16px' }}>
              <Skeleton height={10} width={80} style={{ marginBottom: 10 }} />
              {[0, 1, 2, 3].map(j => <Skeleton key={j} height={10} width="90%" style={{ marginBottom: 6 }} />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function KpiTile({ label, value, sub, ratio, ratioColor: rc, trend }: {
  label: string; value: string; sub?: string; ratio?: string; ratioColor?: string;
  trend?: { current: number; previous: number; higherIsBetter?: boolean };
}) {
  let trendNode: JSX.Element | null = null;
  if (trend) {
    const { current, previous, higherIsBetter = false } = trend;
    const pctChange = previous > 0 ? ((current - previous) / previous) * 100 : null;
    const increased = pctChange !== null && pctChange > 0;
    const decreased = pctChange !== null && pctChange < 0;
    const improved = higherIsBetter ? increased : decreased;
    const worsened = higherIsBetter ? decreased : increased;
    const deltaColor = improved ? COLORS.success : worsened ? COLORS.danger : COLORS.textMuted;
    trendNode = (
      <div style={{ fontSize: 11, fontWeight: 700, color: deltaColor, marginTop: 6 }}>
        {pctChange !== null
          ? `${increased ? '▲' : decreased ? '▼' : '–'} ${Math.abs(pctChange).toFixed(0)}% vs prev`
          : 'vs prev —'}
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.textPrimary }}>{value}</div>
      {ratio && (
        <div style={{ fontSize: 12, fontWeight: 700, color: rc ?? COLORS.textSecondary, marginTop: 6 }}>
          {ratio}
        </div>
      )}
      {sub && <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>{sub}</div>}
      {trendNode}
    </div>
  );
}

function LTGPContent({ data, frame }: { data: LTGPKPIs; frame: LTGPFrame }) {
  const ratio = data.ltgpCacRatio;

  const periodLabel = frame === '7d' ? 'Last 7 days' : frame === '30d' ? 'Last 30 days' : frame === '90d' ? 'Last 90 days' : frame === '12m' ? 'Last 12 months' : 'All time';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Meta spend warning */}
      {data.metaSplitIsEstimated && (
        <div style={{
          background: COLORS.warningBg,
          border: `1px solid ${COLORS.warning}`,
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: 12,
          color: COLORS.warning,
        }}>
          ⚠ Campaign naming convention not configured — Meta spend split is estimated (60% candidate / 40% client). Agree naming convention with owner to get exact split.
        </div>
      )}

      {/* Hero: LTGP:CAC ratio */}
      <div style={{
        background: ratioBg(ratio),
        border: `1px solid ${ratioBorder(ratio)}`,
        borderRadius: 10,
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: ratioColor(ratio), textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            LTGP:CAC Ratio — {periodLabel}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 56, fontWeight: 900, color: ratioColor(ratio), letterSpacing: '-2px', lineHeight: 1 }}>
              {ratio > 0 ? `${ratio.toFixed(1)}×` : '—'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: ratioColor(ratio), marginTop: 6, fontWeight: 600 }}>
            {ratio > 0 ? ratioLabel(ratio) : 'Insufficient data for this period'}
          </div>
          {ratio > 0 && (
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 6, fontFamily: 'monospace' }}>
              LTGP per Client ÷ Client CAC = {fmtAudFull(data.ltgpPerClient)} ÷ {fmtAudFull(data.clientCac)} = {ratio.toFixed(1)}×
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Hormozi Benchmark</div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6 }}>
            ≥ 9:1 <span style={{ color: COLORS.success }}>●</span> On track<br />
            6–8.9:1 <span style={{ color: COLORS.warning }}>●</span> At risk<br />
            &lt; 6:1 <span style={{ color: COLORS.danger }}>●</span> Critical
          </div>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 8 }}>
            Stand Up: highest-touch category<br />(sales calls + personal delivery)
          </div>
        </div>
      </div>

      {/* Five KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        <KpiTile
          label="LTGP per Client"
          value={data.ltgpPerClient > 0 ? fmtAud(data.ltgpPerClient) : '—'}
          sub="Lifetime Gross Profit"
          trend={data.hasPrevPeriod ? { current: data.ltgpPerClient, previous: data.prevLtgpPerClient, higherIsBetter: true } : undefined}
        />
        <KpiTile
          label="Client CAC"
          value={data.clientCac > 0 ? fmtAud(data.clientCac) : '—'}
          ratio={ratio > 0 ? `${ratio.toFixed(1)}:1 LTGP ratio` : undefined}
          ratioColor={ratio > 0 ? ratioColor(ratio) : undefined}
          sub="Cost to acquire one client"
          trend={data.hasPrevPeriod ? { current: data.clientCac, previous: data.prevClientCac } : undefined}
        />
        <KpiTile
          label="Qualified Client CAC"
          value={data.qualifiedClientCac > 0 ? fmtAud(data.qualifiedClientCac) : '—'}
          sub="Meta spend per qualified lead (pre-conversion)"
          trend={data.hasPrevPeriod ? { current: data.qualifiedClientCac, previous: data.prevQualifiedClientCac } : undefined}
        />
        <KpiTile
          label="Candidate CAC"
          value={data.candidateCac > 0 ? fmtAud(data.candidateCac) : '—'}
          ratio={data.candidateCac > 0 && data.grossProfitPerPlacement > 0
            ? `${(data.grossProfitPerPlacement / data.candidateCac).toFixed(1)}:1 GP ratio`
            : undefined}
          ratioColor={(() => {
            if (!data.candidateCac || !data.grossProfitPerPlacement) return undefined;
            const r = data.grossProfitPerPlacement / data.candidateCac;
            return r >= 3 ? COLORS.success : r >= 1.5 ? COLORS.warning : COLORS.danger;
          })()}
          sub="Meta spend per placement"
          trend={data.hasPrevPeriod ? { current: data.candidateCac, previous: data.prevCandidateCac } : undefined}
        />
        <KpiTile
          label="Qualified Candidate CAC"
          value={data.qualifiedCandidateCac > 0 ? fmtAud(data.qualifiedCandidateCac) : '—'}
          sub="Meta spend per qualified lead (pre-conversion)"
          trend={data.hasPrevPeriod ? { current: data.qualifiedCandidateCac, previous: data.prevQualifiedCandidateCac } : undefined}
        />
      </div>

      {/* Payback period + client-financed check */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Payback Period
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.textPrimary }}>
            {data.paybackPeriodDays > 0 ? `${Math.round(data.paybackPeriodDays)}d` : '—'}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
            Client CAC ÷ Gross Profit/placement × {AVG_PLACEMENT_CYCLE_DAYS}d cycle
          </div>
        </div>
        <div style={{
          background: COLORS.bgSubtle,
          border: `1px solid ${data.clientCac > 0 ? (data.clientFinancedPass ? '#166534' : COLORS.accentBorder) : COLORS.border}`,
          borderRadius: 10,
          padding: '14px 16px',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Client-Financed Check
          </div>
          <div style={{
            display: 'inline-block',
            fontSize: 13,
            fontWeight: 800,
            padding: '4px 12px',
            borderRadius: 6,
            background: data.clientCac > 0
              ? (data.clientFinancedPass ? COLORS.successBg : COLORS.accentBg)
              : COLORS.bgSubtle,
            color: data.clientCac > 0
              ? (data.clientFinancedPass ? COLORS.success : COLORS.danger)
              : COLORS.textMuted,
          }}>
            {data.clientCac > 0 ? (data.clientFinancedPass ? 'PASS' : 'FAIL') : '—'}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 8 }}>
            $8,000 first payment {data.clientCac > 0 ? (data.clientFinancedPass ? '>' : '<') : 'vs'} 2 × Client CAC ({data.clientCac > 0 ? fmtAudFull(2 * data.clientCac) : '?'})
          </div>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4 }}>
            Hormozi 2026: first 30d GP must exceed 2× CAC
          </div>
        </div>
      </div>

      {/* Compact inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.borderSubtle}`, borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            CAC Inputs
          </div>
          {([
            ['Cand. Meta Spend', fmtAudFull(data.candidateMetaSpend)],
            ['Client Meta Spend', fmtAudFull(data.clientMetaSpend)],
            ['Owner Calls', String(data.ownerCallsCompleted)],
            ['Owner Acq. Cost', fmtAudFull(data.ownerAcquisitionCost)],
            ['Candidates Placed', String(data.candidatesPlaced)],
            ['Clients Won', String(data.clientsWon)],
          ] as [string, string][]).map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: `1px solid ${COLORS.borderSubtle}` }}>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, fontFamily: 'monospace' }}>{val}</span>
            </div>
          ))}
        </div>

        <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.borderSubtle}`, borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            LTGP Inputs
          </div>
          {([
            ['Avg Placement Value', fmtAudFull(data.avgPlacementValueAud)],
            ['Monthly Recruiter Cost', fmtAudFull(data.monthlyRecruiterCostAud)],
            ['GP / Placement', data.grossProfitPerPlacement > 0 ? fmtAudFull(data.grossProfitPerPlacement) : '—'],
            ['Placements / Client', data.avgPlacementsPerClient.toFixed(2)],
          ] as [string, string][]).map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: `1px solid ${COLORS.borderSubtle}` }}>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, fontFamily: 'monospace' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

export function LTGPCard() {
  const [frame, setFrame] = useState<LTGPFrame>('30d');
  const { data, error, isLoading, isFetching } = useLTGPKPIs(frame);

  const periodLabel =
    frame === '7d' ? 'Last 7 days' :
    frame === '30d' ? 'Last 30 days' :
    frame === '90d' ? 'Last 90 days' :
    frame === '12m' ? 'Last 12 months' : 'All time';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>
            LTGP:CAC
          </h2>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>
            {periodLabel} · Hormozi framework · All figures in AUD
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
          <div style={{ display: 'flex', background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: 'hidden' }}>
            {FRAMES.map(f => (
              <button
                key={f.value}
                onClick={() => setFrame(f.value)}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: frame === f.value ? 700 : 500,
                  color: frame === f.value ? COLORS.textPrimary : COLORS.textMuted,
                  background: frame === f.value ? COLORS.bgCard : 'transparent',
                  border: 'none',
                  borderRight: `1px solid ${COLORS.border}`,
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {isLoading && <LTGPSkeleton />}

      {!isLoading && data && (
        <div style={{ ...CARD_STYLE, padding: 24 }}>
          <LTGPContent data={data} frame={frame} />
        </div>
      )}

      {error && (
        <p style={{ color: COLORS.warning, fontSize: 12, margin: 0 }}>
          ⚠ Connection error — {(error as Error)?.message}
        </p>
      )}
    </div>
  );
}
