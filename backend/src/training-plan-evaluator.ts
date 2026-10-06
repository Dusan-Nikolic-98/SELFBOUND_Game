import {
  FocusMetric,
  PreviousPlanEvaluationResult,
  TrainingPlanFocus,
  TrainingPlanMetricId,
  TrainingPlanRunEntry,
  TrainingPlanBaseline,
  PreviousTrainingPlanState,
  PRIMARY_FOCUS_METRIC,
} from "./training-plan-contract.js";

export const MIN_FOCUS_OPPORTUNITIES: Record<TrainingPlanFocus, number> = {
  threat_management: 2,
  bounce_strategy: 3,
  aim_timing: 2,
  positioning: 3,
  range_management: 3,
};

type MetricAggregate = { opportunities: number; undesirable: number; available: boolean };

function safeBigIntSum(values: number[]): number | null {
  const total = values.reduce((sum, value) => sum + BigInt(value), 0n);
  return total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : null;
}

export function metricForRun(entry: TrainingPlanRunEntry, id: TrainingPlanMetricId): MetricAggregate {
  const run = entry.summary;
  switch (id) {
    case "threat_offensive_rate": return { opportunities: run.shotsWhileThreatActive, undesirable: run.offensiveShotsWhileThreatActive, available: true };
    case "blocked_direct_rate": {
      if (run.targetStats.length === 0) return { opportunities: 0, undesirable: 0, available: false };
      const opportunities = safeBigIntSum(run.targetStats.map((target) => target.attempts));
      const undesirable = safeBigIntSum(run.targetStats.map((target) => target.blockedDirectAttempts));
      if (opportunities === null || undesirable === null || undesirable !== run.blockedDirectAttempts || undesirable > opportunities) {
        return { opportunities: 0, undesirable: 0, available: false };
      }
      return { opportunities, undesirable, available: true };
    }
    case "rushed_bounce_failure_rate": return { opportunities: run.bouncedAttempts, undesirable: run.rushedBouncedFailures, available: true };
    case "repeated_same_position_rate": return { opportunities: run.failedShots, undesirable: run.repeatedSamePositionFailures, available: true };
    case "range_expiry_rate": return { opportunities: run.shotsFired, undesirable: run.rangeExpiredShots, available: true };
  }
}

export function aggregateFocusMetric(runs: TrainingPlanRunEntry[], id: TrainingPlanMetricId): MetricAggregate {
  const facts = runs.map((entry) => metricForRun(entry, id));
  if (facts.some((fact) => !fact.available)) return { opportunities: 0, undesirable: 0, available: false };
  const opportunities = safeBigIntSum(facts.map((fact) => fact.opportunities));
  const undesirable = safeBigIntSum(facts.map((fact) => fact.undesirable));
  if (opportunities === null || undesirable === null || undesirable > opportunities) return { opportunities: 0, undesirable: 0, available: false };
  return { opportunities, undesirable, available: true };
}

export function normalizedMetricsForRun(entry: TrainingPlanRunEntry): FocusMetric[] {
  const ids: TrainingPlanMetricId[] = ["threat_offensive_rate", "blocked_direct_rate", "rushed_bounce_failure_rate", "repeated_same_position_rate", "range_expiry_rate"];
  return ids.map((id) => {
    const metric = metricForRun(entry, id);
    return { id, opportunities: metric.opportunities, undesirable: metric.undesirable };
  });
}

export function computeTrainingPlanBaseline(runs: TrainingPlanRunEntry[], focus: TrainingPlanFocus): TrainingPlanBaseline {
  const metric = aggregateFocusMetric(runs, PRIMARY_FOCUS_METRIC[focus]);
  return {
    runSequences: runs.map((entry) => entry.sequence),
    maxSequence: runs[runs.length - 1]?.sequence ?? 0,
    primaryFocusMetric: { opportunities: metric.opportunities, undesirable: metric.undesirable },
  };
}

export function evaluatePreviousPlan(state: PreviousTrainingPlanState, runs: TrainingPlanRunEntry[]): PreviousPlanEvaluationResult | null {
  const newerRuns = runs.filter((entry) => entry.sequence > state.baseline.maxSequence);
  if (newerRuns.length === 0) return null;
  const focus = state.plan.primaryFocus;
  const metricId = PRIMARY_FOCUS_METRIC[focus];
  const baseline: MetricAggregate = { ...state.baseline.primaryFocusMetric, available: true };
  const newer = aggregateFocusMetric(newerRuns, metricId);
  const minimum = MIN_FOCUS_OPPORTUNITIES[focus];
  let assessment: PreviousPlanEvaluationResult["assessment"];
  if (!newer.available || baseline.opportunities < minimum || newer.opportunities < minimum) {
    assessment = "insufficient_evidence";
  } else {
    const left = BigInt(newer.undesirable) * BigInt(baseline.opportunities);
    const right = BigInt(baseline.undesirable) * BigInt(newer.opportunities);
    assessment = left < right ? "improved" : "not_improved";
  }
  return {
    kind: "previous_plan_evaluation",
    assessment,
    focus,
    metricId,
    baseline: { opportunities: baseline.opportunities, undesirable: baseline.undesirable },
    newer: {
      runSequences: newerRuns.map((entry) => entry.sequence),
      opportunities: newer.opportunities,
      undesirable: newer.undesirable,
    },
  };
}

