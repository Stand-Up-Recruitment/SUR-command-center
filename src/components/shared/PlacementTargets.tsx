// Placement targets: the annual plan (set on the Overview ⚙) as monthly targets, this month's pace and the year to date.
// Lives on the Recruitment tab (moved from Finance).
import { usePlacementPlan, useRecruiterKPIs, useJobAging, useRecruitmentSettings } from '../../hooks/queries';
import { timeBoundaries } from '../../services/airtable';
import { recruitmentPace, teamRecruiters, DEFAULT_RECRUITMENT_SETTINGS } from '../../lib/recruitment';
import { C, CARD, LABEL } from './v2Theme';
import { Section, Tile, Big, Line } from './v2Layout';

const PU = '#A99CF5'; // the plan's violet, as on the Finance chart
const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-NZ', { maximumFractionDigits: 0 })}`;

export function PlacementTargets() {
  const { plan, ytd } = usePlacementPlan();
  const { data: rec } = useRecruiterKPIs('month');
  const { data: jobs } = useJobAging();
  const { data: settings } = useRecruitmentSettings();
  // This month's pace: same count and projection as the Overview and the Finance diagnosis.
  const { start, now } = timeBoundaries('month');
  const recruiters = settings?.recruiters ? settings.recruiters : DEFAULT_RECRUITMENT_SETTINGS.recruiters;
  const pace = rec ? recruitmentPace(rec, teamRecruiters(rec, jobs, recruiters), 'month', start, now, { mustMake: plan.mustMake, breakeven: plan.breakeven }) : null;

  const st = plan.settings;
  const paceColor = !pace ? C.text : pace.projected >= plan.mustMake ? C.green : plan.breakeven != null && pace.projected >= plan.breakeven ? C.amber : C.red;
  const np = plan.projectedNetProfit;
  const bars = [
    ['Placements made', ytd?.made, ytd?.madeTarget ?? st.planAnnualPlacements, C.green, 'Signed since 1 Jan'],
    ['Placements stuck', ytd?.stuck, ytd?.stuckTarget ?? Math.round(st.planAnnualPlacements * (1 - st.planFallOverPct / 100)), PU, 'Made minus those that have fallen over so far'],
  ] as const;

  return (
    <Section title="Placement targets" aside={`Plan ${st.planYear}: ${st.planAnnualPlacements} placements made, ${st.planFallOverPct}% planned fall-over · set on the Overview (⚙) · used by every tab`}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        <Tile label="MUST MAKE PER MONTH" chip={null}>
          <Big value={plan.mustMake} color={paceColor} unit="placements" />
          <Line muted>{pace ? `This month: ${pace.placements} made, on pace for ${pace.projected}` : 'Placements made this month: —'}</Line>
        </Tile>
        <Tile label="MUST STICK PER MONTH" chip={null}>
          <Big value={plan.mustStick.toFixed(1)} color={C.text} unit="placements" />
          <Line muted>{Math.round(plan.mustStick * 12)} a year</Line>
        </Tile>
        <Tile label="BREAKEVEN PER MONTH" chip={null}>
          <Big value={plan.breakeven ?? '—'} color={C.text} unit="placements" />
          <Line muted>Placements made that cover costs</Line>
        </Tile>
        <Tile label="PROJECTED NET PROFIT" chip={null}>
          <Big value={np != null ? money(np) : '—'} color={np != null && np >= 0 ? C.green : C.red} size={40} unit={np != null ? 'per month' : undefined} />
          <Line muted>The result if the plan is hit, at current costs</Line>
        </Tile>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        {bars.map(([label, done, target, color, note]) => {
          const started = ytd?.started ?? false;
          return (
            <div key={label} style={{ ...CARD, padding: 20 }}>
              <div style={{ ...LABEL, marginBottom: 10 }}>{label.toUpperCase()} · {st.planYear} YEAR TO DATE</div>
              <Big value={started && done != null ? done : '—'} color={C.text} size={40} unit={`of ${target}`} />
              <div style={{ height: 8, background: C.track, borderRadius: 4, marginTop: 12, overflow: 'hidden' }}>
                <div style={{ width: `${started && done != null ? Math.min(100, (done / target) * 100) : 0}%`, height: '100%', background: color }} />
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>{started ? note : `Starts 1 Jan ${st.planYear}`}</div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
