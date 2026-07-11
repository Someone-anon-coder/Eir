/**
 * Blueprint §7.6's global mode switch, as a discriminated union (this
 * phase's Pre-Phase TS Tip, applied for real): a `suggest-only` config
 * cannot carry thresholds it would ignore; a `heal` config cannot omit
 * them. Illegal states — `suggest-only` with a `healThreshold`, or `heal`
 * missing one — are unrepresentable, not just validated against at
 * runtime.
 *
 * `healThreshold`/`suggestThreshold` are exactly Blueprint §7.6's
 * three-band table's two boundaries (≥ high → heal; between → suggest;
 * < low → fail normally) — `healThreshold` is the high bound,
 * `suggestThreshold` is the low one. Decision-margin gating
 * (`policy/thresholds.ts`'s `DEFAULT_MIN_MARGIN`, enacted from Phase 5's
 * measured near-dup case) applies in addition to `healThreshold` but is
 * deliberately *not* a third field here — see `docs/thresholds.md` for
 * why it stays an internal constant in this phase rather than a
 * per-team config knob.
 */
export type EirMode =
  | { readonly mode: "suggest-only" }
  | { readonly mode: "heal"; readonly healThreshold: number; readonly suggestThreshold: number };
