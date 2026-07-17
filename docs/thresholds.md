# Threshold Justification (Phase 6)

Closes `BLUEPRINT.md` §7.6's open threshold question with real numbers,
enacted as runtime policy (`packages/eir/src/policy/thresholds.ts`).
Signed off by Aayush before being wired into `EirLocator`'s retry-once
path (Phase 6 Understanding Gate).

## Enacted defaults

| Constant | Value | Status |
|---|---:|---|
| `DEFAULT_HEAL_THRESHOLD` | `0.7` | **Measured** — Phase 5's `MEASUREMENT_HIGH_CONFIDENCE_THRESHOLD` |
| `DEFAULT_MIN_MARGIN` | `0.05` | **Measured** — Phase 5's `MEASUREMENT_MIN_MARGIN` |
| `DEFAULT_SUGGEST_THRESHOLD` | `0.3` | **Estimated** — a real anchoring attempt (1.0.0 closure, B1) found no evidence either way (see below) |
| `DEFAULT_DRIFT_SELF_SIMILARITY_THRESHOLD` | `0.7` | Reuses `DEFAULT_HEAL_THRESHOLD` — a deliberate reuse, not an independent measurement |

## `healThreshold` (0.7) and the margin bar (0.05) — measured, adopted as-is

Five tuning iterations (`docs/tuning-log.md`) moved weights and
scoring architecture but never found evidence to move either number.
Two facts anchor the adoption:

- **id-rename's remaining gap sits below both bars regardless of where
  they're set** — it's a capture-coverage ceiling (some selectors were
  never fingerprinted with enough signal to begin with), not a
  calibration question. Loosening the thresholds wouldn't heal more of
  it; it would just heal *other* things less safely.
- **near-dup.table-row is the sharpest real evidence for the margin bar
  specifically**: a real run measured confidence 0.8457 with a margin
  against its live distractor thin enough that five of six scorers tied
  *exactly* between the correct element and the wrong one. Confidence
  alone would have called that a confident heal. The margin bar is what
  keeps it honest.

False-heal rate is 0% across every class at these values (Phase 5's
baseline, reconfirmed by this phase's own near-dup heal-mode evidence
run — see below). There is no measured cost yet to loosening them, and
no measured benefit to tightening them beyond converting existing
correct heals into suggestions. Adopted as-is.

## `suggestThreshold` (0.3) — an honest, unmeasured estimate

Blueprint §7.6's original three-band table calls for a *low* bound below
which not even a suggestion is worth showing — but Phase 5's benchmark
never needed to exercise this boundary: every `"matched"` result it ever
produced, however low-scoring, was still shown as a suggestion. There is
no measured distribution to anchor a number to.

`0.3` is a first-principles guess: below it, a match's own top score is
weak enough on a 0–1 weighted-feature scale that showing it as "did you
mean...?" is more likely to be noise than a lead worth reviewing. This is
**labeled as an estimate, not a measurement**, per this project's honesty
rules — logged as NOTES.md Q-001 for revisit once real low-confidence
match data exists to tune against.

**1.0.0 closure attempt (B1, 2026-07-17):** ran the full 8-class benchmark
(seed 42) with match-logging on, collecting the raw confidence of every
`matched` attempt across all 80 probes —
`packages/benchmark/reports/suggest-threshold-evidence-seed42.md`. Result:
66 matched attempts, confidence range **0.5849–1.0000**, mean 0.8211,
median 0.8393. **Zero attempts fell anywhere near the 0.3 floor** — the
lowest score measured is nearly double the threshold, and there is no
data in the [0, 0.58) range at all. This confirms rather than resolves
Q-001's original finding: this benchmark's mutation taxonomy structurally
never produces a genuinely low-confidence match (every mutation either
destroys enough signal to produce `missed`, or preserves enough to score
well above any plausible suggestion floor). The honest conclusion is that
this measurement attempt **did not anchor the number** — `0.3` stays an
estimate, not because the attempt was skipped, but because the data
gathered doesn't bear on the range that matters. Revisit criterion
unchanged: real low-confidence match data (a future mutation class
stress-testing recall specifically, or real adoption data).

## `DEFAULT_DRIFT_SELF_SIMILARITY_THRESHOLD` (0.7) — Mechanism B, reusing the heal bar

Mechanism B (NOTE-001 resolution / RISK-009 closure — see
`packages/eir/src/policy/driftCheck.ts`) asks a different question than
matching does: not "which live candidate looks most like the
fingerprint," but "does the element I just successfully acted on still
look like the one I fingerprinted last time." Rather than invent an
independent number with no data behind it either, this reuses
`DEFAULT_HEAL_THRESHOLD`'s value — the same trust bar that already says
"confident enough to retry a healed candidate" is repurposed to say
"confident enough that this was still the same element." This phase's
real sibling-reorder evidence run measured self-similarity **0.6471** on
the four row-order targets whose action Eir actually wraps — comfortably
below the 0.7 bar, correctly flagged `drift-suspected`. That single data
point is the only evidence behind this number so far; it is not a tuned
value the way `0.7`/`0.05` are for matching, and should be revisited if a
legitimate app change ever gets misflagged as drift in practice.

## NOTE-001 heal-mode evidence run — what it did and didn't prove about these numbers

A real `bench:heal-evidence` run (seed 42, `packages/benchmark/reports/
note001-heal-evidence-*.md`) exercised these thresholds against real
mutations in heal mode:

- **near-duplicate-sibling-swap**: 6/8 targets stayed margin-gated to
  suggestion (0.0000–0.0268 margin — the margin bar doing exactly the
  job it's measured to do); 2/8 cleared both bars and healed. Zero false
  heals. Neither heal's retry had a pre-existing baseline post-condition
  to verify against, so Mechanism A's verification path itself wasn't
  exercised this run — an honest gap, not evidence the thresholds are
  wrong.
- **sibling-reorder**: confirms `DEFAULT_DRIFT_SELF_SIMILARITY_THRESHOLD`
  catches the RISK-009 shape for every target whose action Eir actually
  wraps (4/8); the other 4 never reach Eir's tracked surface at all
  (a plain-pass-through `getAttribute` call, and two selectors with no
  captured baseline), a capture-coverage gap `DEFAULT_MIN_MARGIN`-style
  numbers don't touch.

**Conclusion: no adjustment from Phase 5's proposal.** Nothing in this
run's evidence argues for moving `0.7`/`0.05`; the estimated
`suggestThreshold`/drift threshold stay unmeasured/single-data-point as
labeled above, not upgraded to "measured" on the strength of one run.

## Not a per-mode config field: the margin bar

`EirMode`'s `heal` variant exposes exactly two fields —
`healThreshold`/`suggestThreshold` — matching the approach doc's
Pre-Phase TS Tip literally. `DEFAULT_MIN_MARGIN` is a real, enacted
policy gate (Phase 6 wires it into `decidePolicyAction`) but stays an
internal constant, not a third config field, this phase: Phase 5's
tuning loop found no evidence it needs per-team tuning, and adding a
config knob nobody has a measured reason to turn is exactly the kind of
premature surface CLAUDE.md §7 warns against. Revisit if real adoption
ever produces evidence otherwise.
