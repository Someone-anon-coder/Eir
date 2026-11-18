/**
 * Cost and turn limits. The CLI has `--max-budget-usd` (used per run as a
 * backstop) but no `--max-turns` (2.1.318), so the turn cap is the
 * harness's: it counts assistant events on the stream and stops the run.
 */

export class BudgetGuard {
  private spent = 0;

  constructor(private readonly maxUsd: number | undefined) {}

  /** Adds a CLI-reported cost. Runs that reported none (crashes) add nothing. */
  record(costUsd: number | undefined): void {
    if (costUsd !== undefined && Number.isFinite(costUsd) && costUsd > 0) this.spent += costUsd;
  }

  get totalUsd(): number {
    return this.spent;
  }

  /** True once recorded spend reaches the limit; with no limit it never trips. */
  get exceeded(): boolean {
    return this.maxUsd !== undefined && this.spent >= this.maxUsd;
  }
}

export function turnCapReached(assistantEvents: number, maxTurns: number): boolean {
  return assistantEvents >= maxTurns;
}
