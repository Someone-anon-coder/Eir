/**
 * Enacted runtime policy defaults (Blueprint §7.6), justified in full in
 * `docs/thresholds.md` — this file is the single source of truth the
 * config surface (`defineEirConfig`) falls back to when a user doesn't
 * override a value.
 */

/** Matches Phase 5's measured `MEASUREMENT_HIGH_CONFIDENCE_THRESHOLD` (`packages/benchmark/src/outcome.ts`) — five tuning iterations found no evidence to move it. */
export const DEFAULT_HEAL_THRESHOLD = 0.7;

/**
 * The low bound below which not even a suggestion is offered (Blueprint
 * §7.6's third band). Unlike `DEFAULT_HEAL_THRESHOLD`/`DEFAULT_MIN_MARGIN`,
 * Phase 5's benchmark never exercised this boundary — every "matched"
 * result it ever produced was shown as a suggestion regardless of how low
 * its confidence was. This is an honest, unmeasured v0 estimate, not a
 * tuned number — see `docs/thresholds.md` and NOTES.md Q-001.
 */
export const DEFAULT_SUGGEST_THRESHOLD = 0.3;

/** Matches Phase 5's measured `MEASUREMENT_MIN_MARGIN` — the near-dup.table-row case this bar exists to catch. Internal policy constant, not a per-mode config field; see `eirMode.ts`'s docstring. */
export const DEFAULT_MIN_MARGIN = 0.05;

/**
 * Mechanism B (RISK-009 closure): the bar a freshly-captured fingerprint's
 * self-similarity score against its own last-known-good baseline must
 * clear on an *ordinary* (non-throwing) success, or the success gets
 * flagged `drift-suspected` in the report. Deliberately reuses
 * `DEFAULT_HEAL_THRESHOLD`'s value rather than inventing a new number:
 * the same trust bar that says "confident enough to retry a healed
 * candidate" is repurposed to ask "confident enough that this was still
 * the same element" — see `docs/thresholds.md`.
 */
export const DEFAULT_DRIFT_SELF_SIMILARITY_THRESHOLD = DEFAULT_HEAL_THRESHOLD;
