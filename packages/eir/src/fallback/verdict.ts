import { z } from "zod";
import type { Fingerprint } from "../fingerprint.js";
import type { CandidateFeatures, ScoreBreakdown } from "../matching/types.js";

/**
 * The LLM boundary (Blueprint §7.8 / approach doc Phase 8): an LLM
 * response is the least trustworthy data in the entire system — it enters
 * as `unknown` and is narrowed by a *runtime* schema, exactly as Phase 3
 * treated the browser boundary, with one upgrade: zod's itemized
 * rejection diagnostics, so a non-conforming reply is diagnosable in the
 * comparison benchmark instead of a bare `false`.
 *
 * Deliberately absent from the wire contract: a confidence number. The
 * suggestion-cap (Blueprint P4 applied to AI) means no code path may ever
 * act on how sure the model *says* it is — so we don't ask, and the
 * temptation is unrepresentable rather than resisted.
 */
export const WireVerdictSchema = z.object({
  /** Index into the shortlist as presented in the prompt; `null` = "none of these candidates is the element." */
  chosenCandidateIndex: z.number().int().min(0).nullable(),
  reasoning: z.string().min(1).max(2000),
});

export type WireVerdict = z.infer<typeof WireVerdictSchema>;

/**
 * What a provider call actually produced, as a discriminated union — the
 * same "outcomes that can't lie" move as Phase 4. `no-verdict` is a
 * first-class outcome, never an exception: a malformed reply, an HTTP
 * error, a timeout, and a missing key all degrade to it (Blueprint P1 —
 * the fallback is observability-adjacent and must never fail a test).
 */
export type ProviderVerdict =
  | { readonly kind: "chose"; readonly candidateIndex: number; readonly reasoning: string }
  | { readonly kind: "none-of-them"; readonly reasoning: string }
  | { readonly kind: "no-verdict"; readonly reason: string };

/** Measured per real API call — the comparison benchmark's latency/cost columns come from here, never from estimates. `null` tokens = the provider didn't report usage. */
export interface FallbackCallMeta {
  readonly latencyMs: number;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
}

/**
 * One shortlist entry as shown to the model: the candidate's captured
 * features plus the heuristic scorers' own reading of it. This is the
 * same shaped data the scorers see (Blueprint §7.8's hard constraint) —
 * never raw DOM, never screenshots, never page content beyond what the
 * capture pipeline already extracts.
 */
export interface FallbackCandidate {
  readonly features: CandidateFeatures;
  readonly breakdown: ScoreBreakdown;
  readonly total: number;
  /** Re-resolution ref (`page.locator(selector).nth(domIndex)`), carried for suggestion wording only — never for a retry. */
  readonly selector: string;
  readonly domIndex: number;
}

/** Everything a provider is given. `candidates` is sorted highest heuristic score first, so index 0 is always the heuristic winner. */
export interface FallbackContext {
  readonly fingerprint: Fingerprint;
  readonly candidates: readonly FallbackCandidate[];
  readonly confidence: number;
  readonly margin: number;
}

/**
 * The report/reporter-facing outcome (Gate 3's ReportRow extension), at
 * suggestion strength by construction — there is no verdict value that
 * expresses "heal", the same way `HealAction` has no `"llm-healed"`.
 *
 * - `endorsed` — the model chose the heuristic winner.
 * - `contradicted` — the model chose a different candidate on a row that
 *   already carried a heuristic suggestion.
 * - `alternative` — the model chose a candidate on a row heuristics
 *   considered too weak to suggest at all (below the suggest floor).
 * - `none-of-them` — the model says no candidate is the element.
 * - `no-verdict` — no usable reply (error, timeout, schema-invalid).
 */
export type FallbackRowVerdict =
  | "endorsed"
  | "contradicted"
  | "alternative"
  | "none-of-them"
  | "no-verdict";

export const FALLBACK_ROW_VERDICTS: readonly FallbackRowVerdict[] = [
  "endorsed",
  "contradicted",
  "alternative",
  "none-of-them",
  "no-verdict",
];

export interface FallbackOutcome {
  readonly provider: string;
  readonly verdict: FallbackRowVerdict;
  /** Human-readable: chosen-candidate summary and the model's reasoning, or the no-verdict reason. Wording only — nothing parses this. */
  readonly detail: string | null;
  readonly meta: FallbackCallMeta | null;
}
