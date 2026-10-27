export const MAX_ACTIVE_AI_EXECUTIONS = 2;
export const MAX_AI_STARTS_PER_WINDOW = 5;
export const AI_START_WINDOW_MS = 60_000;

export type LimitRejection = "server_busy" | "rate_limited";

/** Process-local W04/W05 budget. It is intentionally not a distributed quota. */
export class AiRequestLimits {
  private active = 0;
  private readonly acceptedStarts: number[] = [];

  constructor(private readonly now: () => number = Date.now) {}

  tryAcquire(): { release: () => void } | { rejection: LimitRejection } {
    const current = this.now();
    while (this.acceptedStarts.length && current - this.acceptedStarts[0]! >= AI_START_WINDOW_MS) this.acceptedStarts.shift();
    if (this.acceptedStarts.length >= MAX_AI_STARTS_PER_WINDOW) return { rejection: "rate_limited" };
    if (this.active >= MAX_ACTIVE_AI_EXECUTIONS) return { rejection: "server_busy" };
    this.acceptedStarts.push(current);
    this.active += 1;
    let released = false;
    return { release: () => {
      if (released) return;
      released = true;
      this.active = Math.max(0, this.active - 1);
    } };
  }

  get activeCount(): number { return this.active; }
  get acceptedCount(): number { return this.acceptedStarts.length; }
}
