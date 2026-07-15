import type { FallbackCallMeta, FallbackContext, ProviderVerdict } from "./verdict.js";

export interface FallbackJudgement {
  readonly verdict: ProviderVerdict;
  readonly meta: FallbackCallMeta | null;
}

/**
 * The provider seam (approach doc Phase 8's Post-Phase TS Tip, built
 * first): one interface, two implementations — `GeminiProvider` does the
 * real network call; `NullProvider` gives the unit suite instant,
 * deterministic verdicts with zero network. Everything downstream of this
 * interface (mapping, wiring, reporting) is therefore testable offline.
 *
 * Contract: `judge` never throws. Every failure mode — network, HTTP,
 * timeout, malformed reply — is a `no-verdict` judgement, because the
 * fallback sits on the observability side of Blueprint P1's line: it may
 * never cause the failure it exists to explain.
 */
export interface FallbackProvider {
  readonly name: string;
  judge(ctx: FallbackContext): Promise<FallbackJudgement>;
}
