import { Skeleton } from '../shared/Skeleton';
import { useXeroFinanceData, useScheduledInvoices, useCacKPIs } from '../../hooks/queries';

// ─── Palette ──────────────────────────────────────────────────────────────────
const NZ   = '#1D9E75';
const AUS  = '#378ADD';
const PU   = '#534AB7';
const AM   = '#BA7517';
const RD   = '#D85A30';

const BG     = '#111111';
const BG2    = '#1a1a1a';
const BORDER = 'rgba(255,255,255,0.10)';
const TEXT   = '#f5f5f5';
const MUTED  = '#a3a3a3';

const fmtNZD = (n: number) => {
  const abs = Math.abs(n).toLocaleString('en-NZ', { maximumFractionDigits: 0 });
  return n < 0 ? `-$${abs}` : `$${abs}`;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });

// ─── Layout helpers ───────────────────────────────────────────────────────────

function SH({ color, label, sub }: { color: string; label: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '1.4rem 0 .75rem' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase' as const, color }}>{label}</span>
      <div style={{ flex: 1, height: .5, background: BORDER }} />
      {sub && <span style={{ fontSize: 11, color: MUTED }}>{sub}</span>}
    </div>
  );
}

function KP({ label, value, sub, accent, valueColor }: {
  label: string; value: string; sub?: string; accent?: string; valueColor?: string;
}) {
  return (
    <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, borderTop: accent ? `3px solid ${accent}` : undefined, padding: '.875rem 1rem' }}>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 500, color: valueColor ?? TEXT, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// KP card with an optional static sub-line and an optional delta sub-line (added this month)
function KPDelta({ label, value, valueColor, accent, sub, delta, invert }: {
  label: string; value: string; valueColor?: string; accent?: string; sub?: string;
  delta?: { value: number; label: string } | null; invert?: boolean;
}) {
  const isGood = delta ? (invert ? delta.value <= 0 : delta.value >= 0) : true;
  const deltaColor = delta ? (isGood ? NZ : RD) : MUTED;
  const deltaSign  = delta ? (delta.value >= 0 ? '↑ +' : '↓ ') : '';
  return (
    <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, borderTop: accent ? `3px solid ${accent}` : undefined, padding: '.875rem 1rem' }}>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 500, color: valueColor ?? TEXT, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>{sub}</div>}
      {delta != null ? (
        <div style={{ fontSize: 11, color: deltaColor, marginTop: 3 }}>
          {deltaSign}{fmtNZD(Math.abs(delta.value))} {delta.label}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>added this month —</div>
      )}
    </div>
  );
}

function G5({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10, marginBottom: '.875rem' }}>
      {children}
    </div>
  );
}

function G2({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10, marginBottom: '.875rem' }}>
      {children}
    </div>
  );
}

function Card({ children, accent, accentSide }: { children: React.ReactNode; accent?: string; accentSide?: 'top' | 'left' }) {
  const borderTop  = accent && accentSide !== 'left' ? `3px solid ${accent}` : undefined;
  const borderLeft = accent && accentSide === 'left' ? `3px solid ${accent}` : undefined;
  return (
    <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, borderTop, borderLeft, padding: '1.25rem', marginBottom: '.875rem' }}>
      {children}
    </div>
  );
}

function BR({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
      <div style={{ fontSize: 11, color: MUTED, width: 175, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{label}</div>
      <div style={{ flex: 1, background: BORDER, borderRadius: 2, height: 5 }}>
        <div style={{ width: `${Math.max(pct, 0.06)}%`, height: 5, borderRadius: 2, background: color }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 500, color: TEXT, width: 62, textAlign: 'right' as const, flexShrink: 0 }}>{value}</div>
    </div>
  );
}

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.5, padding: '6px 8px', background: BG, borderRadius: 8, marginTop: 6 }}>
      {children}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FinanceSkeleton() {
  const kpCard = (i: number) => (
    <div key={i} style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, padding: '.875rem 1rem' }}>
      <Skeleton height={10} width={90} style={{ marginBottom: 8 }} />
      <Skeleton height={22} width={70} style={{ marginBottom: 6 }} />
      <Skeleton height={10} width={60} />
    </div>
  );
  return (
    <div>
      <SH color={TEXT} label="P&L Summary" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10, marginBottom: '.875rem' }}>{[0,1,2,3,4].map(kpCard)}</div>
      <SH color={MUTED} label="Cash Position" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: '.875rem' }}>{[0,1,2].map(kpCard)}</div>
      <SH color={AM} label="Variance Commentary" />
      <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, padding: '1.25rem', marginBottom: '.875rem' }}>
        <Skeleton height={13} width={400} style={{ marginBottom: 8 }} />
        <Skeleton height={13} width={320} />
      </div>
      <SH color={AUS} label="13-Week Cash Outlook" />
      <div style={{ background: BG2, border: `.5px solid ${BORDER}`, borderRadius: 12, padding: '1.25rem', marginBottom: '.875rem' }}>
        <Skeleton height={220} />
      </div>
    </div>
  );
}

// ─── Section components ───────────────────────────────────────────────────────

function PLSummarySection({ totalRevenue, totalGrossProfit, totalOpex, totalCogs, netProfit, lm, cac }: {
  totalRevenue: number; totalGrossProfit: number; totalOpex: number; totalCogs: number; netProfit: number;
  lm: { revenue: number; grossProfit: number; netProfit: number; opex?: number } | undefined;
  cac: {
    clientCac: number; prevClientCac: number;
    qualifiedCandidateCac: number; prevQualifiedCandidateCac: number;
    placementCac: number; prevPlacementCac: number;
    hasPrevPeriod: boolean;
  } | undefined;
}) {
  const cogsPct = totalRevenue > 0 ? (totalCogs / totalRevenue) * 100 : 0;
  const grossMarginPct = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
  const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return (
    <>
      <SH color={TEXT} label="P&L Summary" sub="revenue · gross profit · opex · net profit · client CAC · qualified candidate CAC · placement CAC" />

      <G5>
        <KPDelta
          accent={NZ}
          label="Total revenue"
          value={fmtNZD(totalRevenue)}
          valueColor={NZ}
          sub={`${cogsPct.toFixed(0)}% COGS`}
          delta={lm ? { value: totalRevenue - lm.revenue, label: 'added this month' } : null}
        />
        <KPDelta
          accent={NZ}
          label="Gross profit"
          value={fmtNZD(totalGrossProfit)}
          valueColor={totalGrossProfit >= 0 ? NZ : RD}
          sub={`${grossMarginPct.toFixed(0)}% gross margin`}
          delta={lm ? { value: totalGrossProfit - lm.grossProfit, label: 'added this month' } : null}
        />
        <KPDelta
          accent={AM}
          label="Total operating expenses"
          value={fmtNZD(totalOpex)}
          valueColor={AM}
          invert
          delta={lm?.opex != null ? { value: totalOpex - lm.opex, label: 'added this month' } : null}
        />
        <KPDelta
          accent={PU}
          label="Net profit (FY to date)"
          value={fmtNZD(netProfit)}
          valueColor={netProfit >= 0 ? NZ : RD}
          sub={`${netMarginPct.toFixed(0)}% net margin`}
          delta={lm ? { value: netProfit - lm.netProfit, label: 'added this month' } : null}
        />
        <KPDelta
          accent={RD}
          label="Client CAC"
          value={cac ? fmtNZD(cac.clientCac) : '—'}
          valueColor={RD}
          invert
          delta={cac?.hasPrevPeriod ? { value: cac.clientCac - cac.prevClientCac, label: 'vs prior 30 days' } : null}
        />
      </G5>

      <G2>
        <KPDelta
          accent={RD}
          label="Qualified candidate CAC"
          value={cac ? fmtNZD(cac.qualifiedCandidateCac) : '—'}
          valueColor={RD}
          invert
          delta={cac?.hasPrevPeriod ? { value: cac.qualifiedCandidateCac - cac.prevQualifiedCandidateCac, label: 'vs prior 30 days' } : null}
        />
        <KPDelta
          accent={RD}
          label="Placement CAC"
          value={cac ? fmtNZD(cac.placementCac) : '—'}
          valueColor={RD}
          invert
          delta={cac?.hasPrevPeriod ? { value: cac.placementCac - cac.prevPlacementCac, label: 'vs prior 30 days' } : null}
        />
      </G2>
    </>
  );
}

type MonthCashRow = { weekLabel: string; isForecast: boolean; inflow?: number; outflow?: number; scheduled: number };

function MonthCashCard({ title, monthLabel, rows, cashFlowHasDetail, hasScheduledInvoices }: {
  title: string; monthLabel: string; rows: MonthCashRow[];
  cashFlowHasDetail: boolean; hasScheduledInvoices: boolean;
}) {
  return (
    <Card>
      <div style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{title}</div>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: '.75rem' }}>{monthLabel}</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 11, color: MUTED, fontStyle: 'italic' }}>No weeks in range</div>
      ) : (
        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ fontSize: 10, fontWeight: 700, color: MUTED, textAlign: 'left', padding: '4px 6px', borderBottom: `.5px solid ${BORDER}` }}>Week</th>
              {cashFlowHasDetail && (
                <th style={{ fontSize: 10, fontWeight: 700, color: MUTED, textAlign: 'right', padding: '4px 6px', borderBottom: `.5px solid ${BORDER}` }}>Inflow</th>
              )}
              {cashFlowHasDetail && (
                <th style={{ fontSize: 10, fontWeight: 700, color: MUTED, textAlign: 'right', padding: '4px 6px', borderBottom: `.5px solid ${BORDER}` }}>Outflow</th>
              )}
              {hasScheduledInvoices && (
                <th style={{ fontSize: 10, fontWeight: 700, color: MUTED, textAlign: 'right', padding: '4px 6px', borderBottom: `.5px solid ${BORDER}` }}>Scheduled*</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => (
              <tr key={i}>
                <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, color: MUTED }}>
                  {d.weekLabel}
                  {d.isForecast && <span style={{ color: 'rgba(163,163,163,0.5)', marginLeft: 4 }}>(est.)</span>}
                </td>
                {cashFlowHasDetail && (
                  <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, textAlign: 'right', color: NZ }}>
                    {fmtNZD(d.inflow ?? 0)}
                  </td>
                )}
                {cashFlowHasDetail && (
                  <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, textAlign: 'right', color: RD, whiteSpace: 'nowrap' }}>
                    {`−${fmtNZD(d.outflow ?? 0)}`}
                  </td>
                )}
                {hasScheduledInvoices && (
                  <td style={{ padding: '5px 6px', borderBottom: `.5px solid ${BORDER}`, textAlign: 'right', color: d.scheduled > 0 ? AUS : MUTED }}>
                    {d.scheduled > 0 ? `+${fmtNZD(d.scheduled)}` : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length > 0 && (() => {
        const netProfit = rows.reduce((sum, r) => sum + (r.inflow ?? 0) - (r.outflow ?? 0) + r.scheduled, 0);
        return (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: `.5px solid ${BORDER}` }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>Net profit</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: netProfit >= 0 ? NZ : RD, whiteSpace: 'nowrap' }}>
              {netProfit >= 0 ? '+' : '−'}{fmtNZD(Math.abs(netProfit))}
            </span>
          </div>
        );
      })()}
    </Card>
  );
}

function CashPositionSection({
  cashKpis, closingBalance, bankAccounts, cashFlowHasDetail, hasScheduledInvoices,
  monthBuckets, hasCombined,
}: {
  cashKpis: { closingDate: string; avgWeeklyOutflow: number };
  closingBalance: number;
  bankAccounts: Array<{ name: string; balance: number }> | undefined;
  cashFlowHasDetail: boolean;
  hasScheduledInvoices: boolean;
  monthBuckets: { previous: { label: string; rows: MonthCashRow[] }; current: { label: string; rows: MonthCashRow[] }; next: { label: string; rows: MonthCashRow[] } };
  hasCombined: boolean;
}) {
  return (
    <>
      <SH color={MUTED} label="Cash Position"
        sub={hasCombined
          ? `Actuals · forecast · as at ${fmtDate(cashKpis.closingDate)}`
          : 'Actuals · forecast'} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10, marginBottom: '.875rem' }}>
        <KP accent={closingBalance >= 0 ? NZ : RD}
            label="Current bank balance"
            value={fmtNZD(closingBalance)}
            sub={`Xero reconciled · ${fmtDate(cashKpis.closingDate)}`}
            valueColor={closingBalance >= 0 ? NZ : RD} />
        <KP accent={RD}
            label="Avg weekly outflow"
            value={`−${fmtNZD(cashKpis.avgWeeklyOutflow)}`}
            sub="Negative-flow weeks avg" valueColor={RD} />
      </div>

      {/* Bank accounts (Profit First) */}
      {bankAccounts && bankAccounts.length > 0 ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: '.875rem' }}>
          {bankAccounts.map(acct => (
            <div key={acct.name} style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, padding: '.625rem .875rem', flex: '1 1 auto', minWidth: 120 }}>
              <div style={{ fontSize: 10, color: MUTED, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acct.name}</div>
              <div style={{ fontSize: 17, fontWeight: 500, color: acct.balance >= 0 ? TEXT : RD }}>{fmtNZD(acct.balance)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: BG, border: `.5px solid ${BORDER}`, borderRadius: 8, padding: '.625rem 1rem', marginBottom: '.875rem', fontSize: 12, color: MUTED, fontStyle: 'italic' }}>
          Bank account breakdown not yet available
        </div>
      )}

      {/* Previous / current / next month cash outlook, side by side */}
      {hasCombined && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
            <MonthCashCard title="Previous month" monthLabel={monthBuckets.previous.label} rows={monthBuckets.previous.rows} cashFlowHasDetail={cashFlowHasDetail} hasScheduledInvoices={hasScheduledInvoices} />
            <MonthCashCard title="Current month" monthLabel={monthBuckets.current.label} rows={monthBuckets.current.rows} cashFlowHasDetail={cashFlowHasDetail} hasScheduledInvoices={hasScheduledInvoices} />
            <MonthCashCard title="Next month" monthLabel={monthBuckets.next.label} rows={monthBuckets.next.rows} cashFlowHasDetail={cashFlowHasDetail} hasScheduledInvoices={hasScheduledInvoices} />
          </div>
          {hasScheduledInvoices && (
            <NoteBox>*Scheduled invoices raised in Airtable but not yet issued in Xero (Status = Scheduled, no InvoiceID), bucketed by Due Date.</NoteBox>
          )}
        </>
      )}
    </>
  );
}

function AUSBusinessSection({ data, ausCostsMax }: {
  data: {
    ausRevenue: number; ausTotalCogs: number; ausGrossProfit: number; ausNetProfit?: number;
    ausTotalCosts: number; ausCosts: Array<{ label: string; value: number }>;
    ausRecruiterBonuses?: number;
  };
  ausCostsMax: number;
}) {
  return (
    <>
      <SH color={AUS} label="Australia Business" sub="International placements & operations" />

      <G5>
        <KP accent={AUS} label="Revenue" value={fmtNZD(data.ausRevenue)}      sub="Sales - International" />
        <KP accent={AUS} label="COGS"    value={fmtNZD(data.ausTotalCogs)}   sub={`100% of Cost of Sales${data.ausRecruiterBonuses ? ` + ${fmtNZD(data.ausRecruiterBonuses)} bonuses` : ''}`} valueColor={RD} />
        <KP accent={AUS} label="Gross"   value={fmtNZD(data.ausGrossProfit)} sub={`${Math.round(data.ausGrossProfit / data.ausRevenue * 100)}% margin`} valueColor={data.ausGrossProfit >= 0 ? NZ : RD} />
        <KP accent={AUS} label="Opex"    value={fmtNZD(data.ausTotalCosts)}  sub="90% of shared Opex" valueColor={RD} />
        <KP accent={AUS} label="Net"     value={fmtNZD(data.ausNetProfit ?? data.ausGrossProfit)} sub="Net contribution" valueColor={(data.ausNetProfit ?? data.ausGrossProfit) >= 0 ? NZ : RD} />
      </G5>

      <Card accent={AUS}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: TEXT, marginBottom: '.75rem' }}>AUS operating expenses breakdown — {fmtNZD(data.ausTotalCosts)}</div>
            {data.ausCosts.map((row, i) => (
              <BR
                key={row.label}
                label={row.label}
                value={fmtNZD(row.value)}
                pct={Math.round((row.value / ausCostsMax) * 100)}
                color={i === 0 ? AUS : AM}
              />
            ))}
            <NoteBox>AUS now carries 100% of Cost of Sales{data.ausRecruiterBonuses ? `, plus ${fmtNZD(data.ausRecruiterBonuses)} in recruiter/staff commissions (Xero "Salaries - Commissions")` : ''} reclassified as a direct cost rather than overhead.</NoteBox>
          </div>
      </Card>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FinanceCard() {
  const { data, error } = useXeroFinanceData();
  const { data: scheduledInvoices } = useScheduledInvoices();
  const { data: cac } = useCacKPIs();

  if (!data) return <FinanceSkeleton />;

  // ── Computed values ─────────────────────────────────────────────────────────
  // AUS COGS excludes Safety equipment, Salaries - Labour Hire Staff, and Staff Training
  // upstream (n8n "Finance — Xero P&L Webhook"), with the excluded amount already added
  // back into gross/net profit, so the webhook's figures can be used directly here.
  const ausCosts = data.ausCosts;
  const ausTotalCogs = data.ausTotalCogs;
  const ausGrossProfit = data.ausGrossProfit;
  const ausNetProfit = data.ausNetProfit ?? data.ausGrossProfit;
  const netProfit = data.netProfit;

  const totalRevenue    = data.nzRevenue + data.ausRevenue;
  const totalGrossProfit = data.nzGrossProfit + ausGrossProfit;
  const totalOpex = (data.nzTotalOpex ?? 0) + data.ausTotalCosts;
  const totalCogs = data.nzTotalCogs + ausTotalCogs;
  const lm = data.plLastMonth;

  const cashKpis    = data.cashKpis ?? { openingBalance: 0, closingBalance: 0, closingBalanceActual: 0, avgWeeklyOutflow: 0, openingDate: data.asOf, closingDate: data.asOf };
  const cashFlow    = data.cashFlow ?? [];
  const cashOutlook = data.cashOutlook ?? [];
  const closingBalance = cashKpis.closingBalanceActual ?? cashKpis.closingBalance;
  const actualWeeks = cashFlow;
  const forecastWeeks = cashOutlook;
  const combined = [
    ...actualWeeks.map(r => ({ ...r, isForecast: false })),
    ...forecastWeeks.map(r => ({ ...r, isForecast: true })),
  ];

  const currentIdx = combined.reduce((last, r, i) => (r.isForecast ? last : i), -1);

  // Scheduled-but-unbilled Airtable invoices (Status = Scheduled, InvoiceID blank), bucketed into
  // forecast weeks using each week's real weekStart/weekEnd from the API, falling back to
  // anchoring on cashKpis.closingDate and stepping 7 days per week if a row lacks real dates.
  const AUD_TO_NZD = 1 / 0.90; // mirrors NZD_TO_AUD in hooks/queries.ts
  const closing = new Date(cashKpis.closingDate).getTime();
  const scheduledByWeek = combined.map((r, i) => {
    if (i < currentIdx) return 0;
    if (i === currentIdx) {
      // Current week: capture invoices due this week plus anything overdue (due before now).
      return (scheduledInvoices ?? [])
        .filter(s => new Date(s.dueDate).getTime() < closing)
        .reduce((sum, s) => sum + s.amount * AUD_TO_NZD, 0);
    }
    const [weekStart, weekEnd] = r.weekStart && r.weekEnd
      ? [new Date(r.weekStart).getTime(), new Date(r.weekEnd).getTime()]
      : [closing + (i - currentIdx - 1) * 7 * 86_400_000, closing + (i - currentIdx) * 7 * 86_400_000];
    return (scheduledInvoices ?? [])
      .filter(s => {
        const t = new Date(s.dueDate).getTime();
        return t >= weekStart && t < weekEnd;
      })
      .reduce((sum, s) => sum + s.amount * AUD_TO_NZD, 0);
  });

  const cashFlowHasDetail = actualWeeks.some(d => d.inflow != null || d.outflow != null);
  const hasScheduledInvoices = scheduledByWeek.some(v => v > 0);

  // Bucket each week into previous/current/next calendar month, anchored on today's real date
  // so "current month" always matches the calendar rather than the (often lagging) Xero closing date.
  // Uses each week's real weekStart from the API when available, falling back to the
  // closing-date + 7-days-per-week approximation used for scheduledByWeek above.
  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const today = new Date();
  const prevMonthDate = new Date(today); prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const nextMonthDate = new Date(today); nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
  const monthName = (d: Date) => d.toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' });

  const monthBuckets = {
    previous: { label: monthName(prevMonthDate), rows: [] as MonthCashRow[] },
    current:  { label: monthName(today), rows: [] as MonthCashRow[] },
    next:     { label: monthName(nextMonthDate), rows: [] as MonthCashRow[] },
  };
  combined.forEach((d, i) => {
    const weekDate = d.weekStart ? new Date(d.weekStart) : new Date(closing + (i - currentIdx) * 7 * 86_400_000);
    // Current week isn't finished yet, so its actuals are partial — use next week's forecast as a fuller estimate.
    const source = (i === currentIdx && combined[i + 1]) ? combined[i + 1] : d;
    const row: MonthCashRow = { weekLabel: d.weekLabel, isForecast: d.isForecast, inflow: source.inflow, outflow: source.outflow, scheduled: scheduledByWeek[i] };
    const key = monthKey(weekDate);
    if (key === monthKey(prevMonthDate)) monthBuckets.previous.rows.push(row);
    else if (key === monthKey(today)) monthBuckets.current.rows.push(row);
    else if (key === monthKey(nextMonthDate)) monthBuckets.next.rows.push(row);
  });
  const ausCostsMax = Math.max(...ausCosts.map(r => r.value), 1);

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <PLSummarySection totalRevenue={totalRevenue} totalGrossProfit={totalGrossProfit} totalOpex={totalOpex} totalCogs={totalCogs} netProfit={netProfit} lm={lm} cac={cac} />

      <CashPositionSection
        cashKpis={cashKpis}
        closingBalance={closingBalance}
        bankAccounts={data.bankAccounts}
        cashFlowHasDetail={cashFlowHasDetail}
        hasScheduledInvoices={hasScheduledInvoices}
        monthBuckets={monthBuckets}
        hasCombined={combined.length > 0}
      />

      <AUSBusinessSection
        data={{ ...data, ausCosts, ausTotalCogs, ausGrossProfit, ausNetProfit }}
        ausCostsMax={ausCostsMax}
      />

      {error && (
        <p style={{ color: RD, fontSize: 12, margin: '8px 0 0' }}>⚠ Xero connection error — {error?.message}</p>
      )}
    </div>
  );
}
