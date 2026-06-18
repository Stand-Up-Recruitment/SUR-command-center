import { useState } from 'react';
import { useLTGPKPIs } from '../../hooks/queries';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import { Skeleton } from '../shared/Skeleton';
import type { LTGPFrame, LTGPKPIs } from '../../types';

const FRAMES: { label: string; value: LTGPFrame }[] = [
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
      </div>
    </div>
  );
}

function FormulaRow({ variable, formula, value }: { variable: string; formula: string; value: string }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '200px 1fr 120px',
      gap: 12,
      padding: '8px 0',
      borderBottom: `1px solid ${COLORS.borderSubtle}`,
      alignItems: 'baseline',
    }}>
      <span style={{ fontFamily: 'monospace', fontSize: 11, color: COLORS.textSecondary }}>{variable}</span>
      <span style={{ fontSize: 11, color: COLORS.textMuted }}>{formula}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.textPrimary, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function KpiTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.textPrimary }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function LTGPContent({ data, frame }: { data: LTGPKPIs; frame: LTGPFrame }) {
  const ratio = data.ltgpCacRatio;
  const triggeredFlags = data.flags.filter(f => f.triggered);

  const periodLabel = frame === '30d' ? 'Last 30 days' : frame === '90d' ? 'Last 90 days' : frame === '12m' ? 'Last 12 months' : 'All time';

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

      {/* Three KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <KpiTile
          label="LTGP per Client"
          value={data.ltgpPerClient > 0 ? fmtAud(data.ltgpPerClient) : '—'}
          sub="Lifetime Gross Profit"
        />
        <KpiTile
          label="Client CAC"
          value={data.clientCac > 0 ? fmtAud(data.clientCac) : '—'}
          sub="Cost to acquire one client"
        />
        <KpiTile
          label="Candidate CAC"
          value={data.candidateCac > 0 ? fmtAud(data.candidateCac) : '—'}
          sub="Meta spend per placement"
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

      {/* Formula breakdown — no black boxes */}
      <div style={{ ...CARD_STYLE, padding: '20px 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>
          Formula Breakdown — All Inputs
        </div>

        <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, marginTop: 4 }}>
          CAC Inputs
        </div>
        <FormulaRow variable="candidate_meta_spend" formula={`Meta campaign spend (candidate) × 0.90 NZD→AUD${data.metaSplitIsEstimated ? ' [estimated 60%]' : ''}`} value={fmtAudFull(data.candidateMetaSpend)} />
        <FormulaRow variable="client_meta_spend" formula={`Meta campaign spend (client) × 0.90 NZD→AUD${data.metaSplitIsEstimated ? ' [estimated 40%]' : ''}`} value={fmtAudFull(data.clientMetaSpend)} />
        <FormulaRow variable="owner_calls_completed" formula={`Airtable: Status = 'Moved to CRM' in period`} value={String(data.ownerCallsCompleted)} />
        <FormulaRow variable="owner_cost_per_call" formula="NZD $2,500/mo ÷ (42.5hrs × 4.33wks) × 0.5hrs × 0.90" value={fmtAudFull(data.ownerCostPerCall)} />
        <FormulaRow variable="owner_acquisition_cost" formula="owner_calls_completed × owner_cost_per_call" value={fmtAudFull(data.ownerAcquisitionCost)} />
        <FormulaRow variable="candidates_placed" formula="Airtable Placements by Created Date in period" value={String(data.candidatesPlaced)} />
        <FormulaRow variable="clients_won" formula="Airtable Main Clients by Signed Date in period" value={String(data.clientsWon)} />
        <FormulaRow variable="candidate_cac" formula="candidate_meta_spend ÷ candidates_placed" value={data.candidateCac > 0 ? fmtAudFull(data.candidateCac) : '—'} />
        <FormulaRow variable="client_cac" formula="(client_meta_spend + owner_acquisition_cost) ÷ clients_won" value={data.clientCac > 0 ? fmtAudFull(data.clientCac) : '—'} />

        <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, marginTop: 20 }}>
          LTGP Inputs
        </div>
        <FormulaRow variable="avg_placement_value" formula="Total Airtable invoice amounts ÷ unique placements (all-time)" value={fmtAudFull(data.avgPlacementValueAud)} />
        <FormulaRow variable="monthly_recruiter_cost" formula="NZD $30/hr × 42.5hrs × 2 recruiters × 4.33wks × 0.90" value={fmtAudFull(data.monthlyRecruiterCostAud)} />
        <FormulaRow variable="recruiter_cost_per_placement" formula="monthly_recruiter_cost ÷ candidates_placed" value={data.recruiterCostPerPlacement > 0 ? fmtAudFull(data.recruiterCostPerPlacement) : '—'} />
        <FormulaRow variable="gross_profit_per_placement" formula="avg_placement_value − recruiter_cost_per_placement" value={data.grossProfitPerPlacement > 0 ? fmtAudFull(data.grossProfitPerPlacement) : '—'} />
        <FormulaRow variable="avg_placements_per_client" formula="All-time placements ÷ unique companies (Airtable, lifetime)" value={data.avgPlacementsPerClient.toFixed(2)} />
        <FormulaRow variable="ltgp_per_client" formula="gross_profit_per_placement × avg_placements_per_client" value={data.ltgpPerClient > 0 ? fmtAudFull(data.ltgpPerClient) : '—'} />

        <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, marginTop: 20 }}>
          Output
        </div>
        <FormulaRow variable="ltgp_cac_ratio" formula="ltgp_per_client ÷ client_cac" value={ratio > 0 ? `${ratio.toFixed(2)}:1` : '—'} />
        <FormulaRow variable="payback_period" formula={`client_cac ÷ gross_profit_per_placement × ${AVG_PLACEMENT_CYCLE_DAYS}d`} value={data.paybackPeriodDays > 0 ? `${Math.round(data.paybackPeriodDays)} days` : '—'} />
        <FormulaRow variable="client_financed_check" formula="$8,000 > 2 × client_cac" value={data.clientCac > 0 ? (data.clientFinancedPass ? 'PASS' : 'FAIL') : '—'} />
      </div>

      {/* Automated flags */}
      {triggeredFlags.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Automated Flags
          </div>
          {triggeredFlags.map((flag) => (
            <div
              key={flag.label}
              style={{
                background: flag.severity === 'red' ? COLORS.accentBg : COLORS.warningBg,
                border: `1px solid ${flag.severity === 'red' ? COLORS.accentBorder : COLORS.warning}`,
                borderRadius: 8,
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: flag.severity === 'red' ? COLORS.danger : COLORS.warning,
                  color: '#000',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {flag.severity}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>{flag.label}</span>
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: 'monospace', marginBottom: 4 }}>
                {flag.formula} → {flag.actual}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{flag.suggestion}</div>
            </div>
          ))}
        </div>
      )}

      {triggeredFlags.length === 0 && ratio > 0 && (
        <div style={{ fontSize: 12, color: COLORS.success, padding: '10px 14px', background: COLORS.successBg, borderRadius: 8, border: `1px solid #166534` }}>
          ✓ No flags triggered — all metrics within Hormozi benchmarks for this period.
        </div>
      )}
    </div>
  );
}

export function LTGPCard() {
  const [frame, setFrame] = useState<LTGPFrame>('30d');
  const { data, error, isLoading, isFetching } = useLTGPKPIs(frame);

  const periodLabel =
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
