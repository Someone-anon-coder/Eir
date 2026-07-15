import type { UncertainMatch } from "./trigger.js";
import { GeminiProvider, DEFAULT_GEMINI_MODEL } from "./geminiProvider.js";
import type { FallbackProvider } from "./provider.js";
import type {
  FallbackCallMeta,
  FallbackContext,
  FallbackOutcome,
  FallbackRowVerdict,
  ProviderVerdict,
} from "./verdict.js";

/**
 * The action kinds a fallback may accompany — the type-level half of the
 * suggestion-cap (Blueprint P4 applied to AI): `"heal-and-continue"` is
 * not a member, so a call site inside the heal branch does not compile.
 * The other half is sequencing: `EirLocator` only consults the runner
 * *after* `decidePolicyAction` has already returned a non-heal action.
 */
export type FallbackEligibleAction = "fail-with-suggestion" | "fail-normally";

export interface FallbackRunner {
  run(attempt: UncertainMatch, action: FallbackEligibleAction): Promise<FallbackOutcome>;
}

export function contextFromAttempt(attempt: UncertainMatch): FallbackContext {
  return {
    fingerprint: attempt.fingerprint,
    candidates: attempt.shortlist,
    confidence: attempt.confidence,
    margin: attempt.margin,
  };
}

function describeCandidate(ctx: FallbackContext, index: number): string {
  const candidate = ctx.candidates[index];
  if (candidate === undefined) return `candidate ${index}`;
  const attrs = Object.entries(candidate.features.attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
  const summary = attrs.length > 0 ? `<${candidate.features.tag} ${attrs}>` : `<${candidate.features.tag}>`;
  return `${summary} — ${candidate.selector} >> nth=${candidate.domIndex}`;
}

const REASONING_LIMIT = 300;

function clip(text: string): string {
  return text.length > REASONING_LIMIT ? `${text.slice(0, REASONING_LIMIT)}…` : text;
}

/**
 * Pure mapping from a provider's verdict to the report-facing outcome.
 * Candidate index 0 is always the heuristic winner (`contextFromAttempt`
 * hands the shortlist over sorted, winner first), so `chose(0)` is an
 * endorsement. A `chose` of a different candidate reads as `contradicted`
 * when heuristics offered a suggestion of their own (`fail-with-
 * suggestion`) and `alternative` when they offered nothing worth showing
 * (`fail-normally`). An out-of-range index — the model inventing a
 * candidate — is a `no-verdict`, not a guess (Blueprint §7.8: an invalid
 * response never becomes an answer).
 */
export function mapVerdict(
  providerName: string,
  ctx: FallbackContext,
  verdict: ProviderVerdict,
  meta: FallbackCallMeta | null,
  action: FallbackEligibleAction,
): FallbackOutcome {
  if (verdict.kind === "no-verdict") {
    return { provider: providerName, verdict: "no-verdict", detail: verdict.reason, meta };
  }
  if (verdict.kind === "none-of-them") {
    return { provider: providerName, verdict: "none-of-them", detail: clip(verdict.reasoning), meta };
  }
  if (verdict.candidateIndex >= ctx.candidates.length) {
    return {
      provider: providerName,
      verdict: "no-verdict",
      detail: `candidate-index-out-of-range:${verdict.candidateIndex}`,
      meta,
    };
  }
  const rowVerdict: FallbackRowVerdict =
    verdict.candidateIndex === 0
      ? "endorsed"
      : action === "fail-with-suggestion"
        ? "contradicted"
        : "alternative";
  return {
    provider: providerName,
    verdict: rowVerdict,
    detail: `${describeCandidate(ctx, verdict.candidateIndex)}: ${clip(verdict.reasoning)}`,
    meta,
  };
}

export class ProviderFallbackRunner implements FallbackRunner {
  readonly #provider: FallbackProvider;

  constructor(provider: FallbackProvider) {
    this.#provider = provider;
  }

  async run(attempt: UncertainMatch, action: FallbackEligibleAction): Promise<FallbackOutcome> {
    const ctx = contextFromAttempt(attempt);
    const { verdict, meta } = await this.#provider.judge(ctx);
    return mapVerdict(this.#provider.name, ctx, verdict, meta, action);
  }
}

export const DEFAULT_FALLBACK_API_KEY_ENV = "GEMINI_API_KEY";

const warnedMissingKey = new Set<string>();

/**
 * Config + environment → a runner, or `null` — and `null` is the *shipped
 * default* (approach doc Phase 8 work item 3): no `fallback` config, or
 * `enabled: false`, or a missing/empty key all yield `null`, which means
 * the provider class is never even constructed. The default CI path —
 * including this repo's own — therefore makes zero API calls not because
 * a call site checks a flag, but because there is nothing to call. A
 * missing key with `enabled: true` is a clear, once-per-worker warning
 * (a skip, not a crash).
 */
export function buildFallbackRunner(
  fallback: { readonly enabled: boolean; readonly apiKeyEnv?: string; readonly model?: string } | undefined,
  env: Readonly<Record<string, string | undefined>> = process.env,
): FallbackRunner | null {
  if (fallback === undefined || !fallback.enabled) return null;

  const keyEnv = fallback.apiKeyEnv ?? DEFAULT_FALLBACK_API_KEY_ENV;
  const apiKey = env[keyEnv];
  if (apiKey === undefined || apiKey.length === 0) {
    if (!warnedMissingKey.has(keyEnv)) {
      warnedMissingKey.add(keyEnv);
      console.warn(
        `[eir] fallback is enabled but ${keyEnv} is not set — skipping LLM fallback for this run (heuristics-only)`,
      );
    }
    return null;
  }

  return new ProviderFallbackRunner(
    new GeminiProvider({ apiKey, model: fallback.model ?? DEFAULT_GEMINI_MODEL }),
  );
}
