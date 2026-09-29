import { AiCoachAdvice, AiCoachRequest } from "./ai-coach-contract.js";

export interface AiCoachProvider {
  getAdvice(request: AiCoachRequest, signal?: AbortSignal): Promise<unknown>;
}

/** Stable local implementation used until a separately approved live-provider phase. */
export class FakeAiCoachProvider implements AiCoachProvider {
  async getAdvice(request: AiCoachRequest): Promise<AiCoachAdvice> {
    const totals = request.runs.reduce((summary, run) => ({
      threat: summary.threat + run.offensiveShotsWhileThreatActive,
      blocked: summary.blocked + run.blockedDirectAttempts,
      rushed: summary.rushed + run.rushedBouncedFailures,
      position: summary.position + run.repeatedSamePositionFailures,
      range: summary.range + run.rangeExpiredShots,
    }), { threat: 0, blocked: 0, rushed: 0, position: 0, range: 0 });

    const candidates: Array<{ category: AiCoachAdvice["primaryCategory"]; count: number; summary: string; advice: string; goal: string }> = [
      { category: "threat_management", count: totals.threat, summary: "Review how you respond to active green threats.", advice: "When a green threat is active, prioritize aiming at it before returning to the current target.", goal: "On your next run, destroy each active green threat before taking another target shot." },
      { category: "bounce_strategy", count: totals.blocked, summary: "Review your direct shots against blocked target paths.", advice: "When telemetry marks a direct path as blocked, consider repositioning to explore a bounce route; the signal does not prove one is available.", goal: "Before firing at a blocked target, pause to consider a different position or route." },
      { category: "aim_timing", count: totals.rushed, summary: "Some failed bounced shots followed a short aim-settle interval.", advice: "Give your aim a little more time to settle before attempting a precise bounced shot.", goal: "On your next run, wait at least a moment after changing aim before a bounced attempt." },
      { category: "positioning", count: totals.position, summary: "Telemetry found repeated failures from nearly the same position.", advice: "After repeated misses from one position, move before trying that target again.", goal: "Reposition after two failed attempts from nearly the same spot." },
      { category: "range_management", count: totals.range, summary: "Some shots ended when their travel budget ran out.", advice: "Check whether the shot can reach the target within its available travel budget, including any actual bounce bonuses.", goal: "Before firing, consider the target distance and the route your shot will travel." },
    ];
    const selected = candidates.reduce((best, candidate) => candidate.count > best.count ? candidate : best);
    if (selected.count === 0) {
      return {
        summary: "There is not enough repeated telemetry to identify a clear pattern yet.",
        primaryCategory: "general",
        primaryAdvice: "Keep playing and request another review after a few completed runs.",
        practiceGoal: "Focus on one run at a time and build more completed-run history.",
      };
    }
    return { summary: selected.summary, primaryCategory: selected.category, primaryAdvice: selected.advice, practiceGoal: selected.goal };
  }
}
