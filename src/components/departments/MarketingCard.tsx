import { useCallback } from 'react';
import { StatusBadge } from '../shared/StatusBadge';
import { WoWBadge } from '../shared/WoWBadge';
import { useAirtable } from '../../hooks/useAirtable';
import { fetchMarketingKPIs, MOCK_MARKETING } from '../../services/airtable';
import { COLORS, CARD_STYLE } from '../../styles/tokens';
import type { DepartmentStatus } from '../../types';

function fmtCurrency(n: number) {
  return `$${n.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
}

const hasMarketingCredentials =
  Boolean(import.meta.env.VITE_AIRTABLE_API_KEY) &&
  Boolean(import.meta.env.VITE_AIRTABLE_CLIENTS_BASE_ID) &&
  Boolean(import.meta.env.VITE_AIRTABLE_CANDIDATES_BASE_ID) &&
  Boolean(import.meta.env.VITE_META_TOKEN);

export function MarketingCard() {
  const fetcher = useCallback(() => fetchMarketingKPIs(), []);
  const { data, loading, error } = useAirtable(fetcher, MOCK_MARKETING, hasMarketingCredentials);

  const qualCandidates = data?.candidates.qualified ?? 0;
  const qualClients    = data?.clients.qualified ?? 0;

  const status: DepartmentStatus = !data
    ? 'no-data'
    : qualCandidates >= 20 && qualClients >= 5
    ? 'on-track'
    : qualCandidates >= 10 || qualClients >= 3
    ? 'at-risk'
    : 'off-track';

  const spend = data?.spend.thisWeek ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-0.5px', margin: 0 }}>
            Marketing
          </h2>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '3px 0 0' }}>
            Week to date · Updates every 60s
          </p>
        </div>
        <StatusBadge status={error ? 'no-data' : status} />
      </div>

      {loading && !data ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div
            style={{
              width: 24, height: 24,
              border: `2px solid ${COLORS.accent}`,
              borderTopColor: 'transparent',
              borderRadius: '50%',
            }}
            className="animate-spin"
          />
        </div>
      ) : (
        <>
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
                    {data!.candidates.qualified}
                  </span>
                  <WoWBadge current={data!.candidates.qualified} prev={data!.candidates.prevQualified} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Qual Rate</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: data!.candidates.qualRate >= 50 ? COLORS.accent : COLORS.warning }}>
                      {data!.candidates.qualRate}%
                    </div>
                    <WoWBadge current={data!.candidates.qualRate} prev={data!.candidates.prevQualRate} />
                  </div>
                  <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Cost per Lead</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>
                      {spend > 0 && data!.candidates.qualified > 0 ? fmtCurrency(data!.candidates.cpl) : '—'}
                    </div>
                    {data!.candidates.prevCpl > 0 && data!.candidates.cpl > 0 && (
                      <WoWBadge current={data!.candidates.prevCpl} prev={data!.candidates.cpl} invertDirection />
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
                    {data!.clients.qualified}
                  </span>
                  <WoWBadge current={data!.clients.qualified} prev={data!.clients.prevQualified} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Qual Rate</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: data!.clients.qualRate >= 50 ? COLORS.accent : COLORS.warning }}>
                      {data!.clients.qualRate}%
                    </div>
                    <WoWBadge current={data!.clients.qualRate} prev={data!.clients.prevQualRate} />
                  </div>
                  <div style={{ background: COLORS.bgSubtle, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Cost per Lead</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>
                      {spend > 0 && data!.clients.qualified > 0 ? fmtCurrency(data!.clients.cpl) : '—'}
                    </div>
                    {data!.clients.prevCpl > 0 && data!.clients.cpl > 0 && (
                      <WoWBadge current={data!.clients.prevCpl} prev={data!.clients.cpl} invertDirection />
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
                {(data?.channels ?? []).map((row, i) => (
                  <tr key={row.channel}>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: COLORS.textPrimary, borderBottom: i < (data?.channels.length ?? 0) - 1 ? `1px solid ${COLORS.borderSubtle}` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.cpl !== null ? COLORS.accent : COLORS.textMuted }} />
                        {row.channel}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: COLORS.textPrimary, textAlign: 'right', borderBottom: i < (data?.channels.length ?? 0) - 1 ? `1px solid ${COLORS.borderSubtle}` : 'none' }}>
                      {row.leads}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: row.qualRate >= 50 ? COLORS.accent : COLORS.warning, textAlign: 'right', borderBottom: i < (data?.channels.length ?? 0) - 1 ? `1px solid ${COLORS.borderSubtle}` : 'none' }}>
                      {row.leads > 0 ? `${row.qualRate}%` : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: row.cpl !== null ? COLORS.textPrimary : COLORS.textMuted, textAlign: 'right', borderBottom: i < (data?.channels.length ?? 0) - 1 ? `1px solid ${COLORS.borderSubtle}` : 'none' }}>
                      {row.cpl !== null && row.cpl > 0 ? fmtCurrency(row.cpl) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
                  {data && <WoWBadge current={data.spend.thisWeek} prev={data.spend.prevWeek} neutral />}
                </div>
                <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 3 }}>
                  vs {fmtCurrency(Math.round(data?.spend.prevWeek ?? 0))} last week
                </div>
              </div>

              <div style={{ width: 1, background: COLORS.border, alignSelf: 'stretch' }} />

              {/* Weekly budget */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Weekly Budget</div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 26, fontWeight: 900, color: COLORS.textPrimary, letterSpacing: '-1px' }}>
                    {data && data.weeklyBudget > 0 ? fmtCurrency(data.weeklyBudget) : '—'}
                  </span>
                  {data && data.weeklyBudget > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.accent }}>
                      {Math.round((spend / data.weeklyBudget) * 100)}% used
                    </span>
                  )}
                </div>
                {data && data.weeklyBudget > 0 && (
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
        </>
      )}

      {error && (
        <p style={{ color: COLORS.warning, fontSize: 12, margin: 0 }}>
          ⚠ Using demo data — {error}
        </p>
      )}
    </div>
  );
}
