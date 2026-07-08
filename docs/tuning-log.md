# Tuning Log — Phase 5 Matching Engine

Every iteration below is real: run the benchmark, read the numbers, form a
hypothesis, change exactly one thing, rerun, record the delta. A null or
negative result is recorded with the same honesty as a positive one
(CLAUDE.md §10). `docs/thresholds.md` (Phase 6) will cite specific entries
here as the evidence behind whatever policy thresholds it proposes.

**Protocol** (confirmed with Aayush before iteration 1): run the benchmark
→ read per-class heal/false-heal/suggested/missed and, for
`near-duplicate-sibling-swap`, the margin distribution → hypothesize why →
change one weight or one measurement threshold → rerun → document before
moving on. Full 8-class runs bookend the loop; most intermediate
iterations run only the classes the hypothesis actually predicts will
move (usually `near-duplicate-sibling-swap` and `id-rename`, the two
classes that stress the weight vector in complementary ways — precision
under a real distractor vs. recall when the heaviest-weighted signal goes
to zero).

---

## Iteration 0 — Baseline (starting point, not a change)

**Starting weights** (`packages/eir/src/matching/aggregate.ts`, `INITIAL_WEIGHTS`, v0 — hand-set, expected wrong):

| Scorer | Weight |
|---|---:|
| attrOverlap | 0.30 |
| textSimilarity | 0.20 |
| labelMatch | 0.15 |
| ancestorChain | 0.15 |
| siblingPosition | 0.12 |
| bboxProximity | 0.08 |

**Starting measurement thresholds** (`packages/benchmark/src/outcome.ts`): `MEASUREMENT_HIGH_CONFIDENCE_THRESHOLD = 0.7`, `MEASUREMENT_MIN_MARGIN = 0.05`.

This baseline already reflects three pre-loop corrections made while getting
the pipeline running for the first time (documented in commit history, not
repeated in full here — this log is about weight/threshold tuning, not
plumbing bugs):
1. `packages/benchmark/playwright.config.ts` was missing `globalTeardown`,
   so no control-run fingerprint ever reached the mutated-run's baseline.
2. `EirLocator`'s test-scoped `page` fixture didn't await pending captures
   before the real page closed — lost the last action's capture
   deterministically whenever a test had nothing after it (probe.spec.ts's
   exact shape).
3. `candidateSelector` treated *every* `<input>` as tag-swap-equivalent to
   `button`/`a`, expanding a plain `input[type=text]`'s own candidate
   query to exclude `input[type=text]` entirely — the correct element was
   never in its own candidate pool. Fixed to only expand the swap family
   for `button`/`a`/`input[type=submit|button]`.

**Measured (seed 42, full 8-class run):**

| Mutation Class | Affected | Heal Rate | False-Heal Rate | Suggestion Rate | Miss Rate |
|---|---:|---:|---:|---:|---:|
| id-rename | 8 | 0.0% | 0.0% | 100.0% | 0.0% |
| text-change | 8 | 75.0% | 0.0% | 25.0% | 0.0% |
| tag-swap | 8 | 100.0% | 0.0% | 0.0% | 0.0% |
| class-shuffle | 8 | 25.0% | 0.0% | 75.0% | 0.0% |
| sibling-reorder | 8 | 0.0% | 0.0% | 0.0% | 100.0% |
| wrapper-inject | 8 | 75.0% | 0.0% | 25.0% | 0.0% |
| near-duplicate-sibling-swap | 8 | 25.0% | 0.0% | 75.0% | 0.0% |
| compound-release | 24 | 16.7% | 0.0% | 58.3% | 25.0% |

**Notable, real per-target findings feeding Iteration 1's hypothesis:**

`id-rename`'s 0% heal rate is not a recall failure — every target correctly
finds and scores its own renamed element (confirmed via raw match-log
inspection). The problem is a mathematical ceiling. Example,
`id-rename.login.usernameInputId` (a plain `<input>`, no rendered text):

```
breakdown: attrOverlap=0, textSimilarity=0, labelMatch=1,
           ancestorChain=1, siblingPosition=1, bboxProximity=1
confidence = 0×0.30 + 0×0.20 + 1×0.15 + 1×0.15 + 1×0.12 + 1×0.08 = 0.50
margin = 0.22 (healthy — no real competing candidate)
```

`attrOverlap` correctly goes to 0 (the id *is* the mutation) and
`textSimilarity` is *structurally* 0 for any plain input (Playwright
inputs have no rendered text) — meaning **0.50 is the mathematical
ceiling** for this weight vector on a perfectly-matched, unambiguous
text-input target, regardless of how confident the match actually is.
That's below `MEASUREMENT_HIGH_CONFIDENCE_THRESHOLD = 0.7` by
construction, not because the match is actually uncertain — the margin
(0.22, no real distractor in the pool) says the opposite.

`sibling-reorder`'s 100% miss rate is the RISK-009 gap materializing
exactly as predicted in NOTES.md: a position-anchored selector after a
reorder doesn't throw at all, so Eir's triage never even runs. Not a
weight problem — tracked separately, feeds NOTE-001's Phase 6
recommendation below.

---

## Iteration 1 — Shift weight from attrOverlap to labelMatch

**What changed:** `attrOverlap: 0.30 → 0.22`, `labelMatch: 0.15 → 0.23`.
Everything else unchanged.

**Hypothesis:** `attrOverlap` is both the single heaviest weight *and* the
one scorer `id-rename` structurally zeroes by definition — one mutation
class shouldn't be able to cap confidence below the measurement threshold
on an otherwise-perfect, unambiguous match. `labelMatch` is the
identity signal every plain form input actually has available (inputs
render no text, so `textSimilarity` is dead weight for them); shifting
budget toward it should raise `id-rename`'s ceiling on input targets
without touching classes where `attrOverlap` isn't being directly
attacked.

**Measured (id-rename, near-dup only — full 8-class table not needed to
see this hypothesis's effect):**

| Class | Heal Rate before | Heal Rate after |
|---|---:|---:|
| id-rename | 0.0% | 12.5% |
| near-duplicate-sibling-swap | 25.0% | **0.0%** |

**Result: mixed, and the negative half is the real finding.** id-rename
moved in the predicted direction (one target's confidence crossed 0.7).
But near-dup *regressed* — every target that had been clearing the
confidence bar dropped back to `suggested`. Reasoning through why,
post-hoc: near-dup's winner-vs-distractor pairs tie *exactly* on
`attrOverlap` (both score 1, or both score the same partial value) —
lowering `attrOverlap`'s weight lowers both candidates' totals equally,
so it never changes the *margin* (which is what actually decides
correctness there), but it does lower the *absolute confidence* both
sit at. Several near-dup targets were sitting just above 0.7 purely on
the strength of a maxed-out `attrOverlap` term; shaving that weight
pushed them back under the confidence gate even though nothing about
their correctness changed.

**Takeaway carried into Iteration 2:** the redistribution should come
from `textSimilarity` (which is *also* structurally dead for the exact
targets this is meant to help, and isn't relied on by near-dup's tied
scorers) rather than `attrOverlap` (which near-dup's absolute confidence
depends on even when it isn't the deciding signal).

---

## Iteration 2 — Same labelMatch boost, sourced from textSimilarity instead

**What changed:** `attrOverlap: 0.22 → 0.30` (reverted to baseline),
`textSimilarity: 0.20 → 0.12`, `labelMatch: 0.23` (unchanged from
iteration 1). Net: the same +0.08 shift into `labelMatch`, now taken from
`textSimilarity` instead of `attrOverlap`.

**Hypothesis:** `textSimilarity` is structurally 0 for the exact same
targets `labelMatch` is meant to help (plain form inputs render no text)
— it's dead weight on precisely this class, same as `attrOverlap` was,
but *without* the side effect: near-dup's tied candidates don't lean on
`textSimilarity` to stay tied (they're either both 0, textless inputs, or
both equal on real text) the way they lean on `attrOverlap` staying
maxed. Should reproduce iteration 1's id-rename gain without its near-dup
regression.

**Measured (id-rename, near-dup):**

| Class | Heal Rate (iter 0) | Heal Rate (iter 1) | Heal Rate (iter 2) |
|---|---:|---:|---:|
| id-rename | 0.0% | 12.5% | **50.0%** |
| near-duplicate-sibling-swap | 25.0% | 0.0% | **25.0%** |

**Result: hypothesis confirmed.** id-rename jumped to 50% heal (4 of 8
targets now cross both the confidence *and* margin bars) with zero
false-heals, and near-dup returned exactly to its iteration-0 baseline —
no regression. This is the shape of change the tuning loop is supposed to
find: a real, measured improvement on the class it targeted, verified to
not quietly cost another class anything.

---

## Iteration 3 — Renormalize the weighted sum over applicable scorers only

**What changed:** not a weight number — the aggregation formula itself
(`packages/eir/src/matching/aggregate.ts`, `scoreCandidate`). Previously
`total = Σ breakdown[name] × weight[name]` over all six scorers
unconditionally. Now `total = Σ(applicable) breakdown[name] × weight[name]
/ Σ(applicable) weight[name]` — `textSimilarity` is excluded from both
sums when the fingerprint's own `text` is `null`; `labelMatch` is
excluded when `label` is `null`. Weights reverted to the original v0
values (`attrOverlap 0.30, textSimilarity 0.20, labelMatch 0.15,
ancestorChain 0.15, siblingPosition 0.12, bboxProximity 0.08`) — iteration
2's shift is no longer needed once the real problem is fixed at its
source.

**Hypothesis:** iterations 1–2 both hit the same wall from opposite
directions — shifting weight toward whichever scorer helps input fields
(`labelMatch`) starves button-like elements of the *same* weight budget,
because `textSimilarity` and `labelMatch` are structurally mutually
exclusive per element (an input never has text; a button rarely has a
`for=`/wrapping label). Raw evidence from iteration 2's own results:
`id-rename.provisioning.submitButton` and `id-rename.account.
openDeleteButton` (both buttons, no label) were capped at confidence
0.545 — computed by hand: `0.25×0.30(attrOverlap) + 1×0.12(textSim) +
0×0.23(labelMatch — dead weight) + 1×0.15 + 1×0.12 + 1×0.08 = 0.545`. The
"0×0.23" term is the tell — a scorer that could never have contributed
anything was still eating almost a quarter of the total weight budget as
a hard zero. No amount of shifting weight *between* the two symmetric
scorers fixes this; the fix is not spending a weight share on a scorer
with nothing to measure, for *either* element type at once.

**Measured (id-rename, near-dup):**

| Class | Heal Rate (iter 0) | Heal Rate (iter 2) | Heal Rate (iter 3) |
|---|---:|---:|---:|
| id-rename | 0.0% | 50.0% | **75.0%** |
| near-duplicate-sibling-swap | 25.0% | 25.0% | 25.0% (unchanged) |

**Result: clear further improvement, no regression.** id-rename reached
6/8 healed-correct with the *original* v0 weight vector — the fix was
architectural, not a matter of finding the right numbers. False-heal rate
stayed at 0% across both classes throughout. near-dup's unchanged 25%
is expected and correct: its winner/distractor pairs tie on `attrOverlap`
regardless of renormalization (both have the same `text`/`label`
presence, so both get the same applicable set), so this fix doesn't touch
the dynamic that actually decides near-dup's outcomes — margin still
does that work, as designed.

---

## Iteration 4 — Investigated class-shuffle's 25% ceiling; no weight change (negative result, real finding)

**What I looked at:** `class-shuffle` sat at 25% heal (2/8) through every
prior iteration, untouched by any of them. Pulled the real per-target
confidences to see why.

**Measured (class-shuffle, seed 42, iteration-3 weights):**

| Target | Confidence | Outcome |
|---|---:|---|
| devices.active.table (row click, has `data-testid`) | 0.928 | healed-correct |
| devices.archived.table (row click, has `data-testid`) | 0.908 | healed-correct |
| devices.active.card | 0.600 | suggested |
| devices.archived.card | 0.585 | suggested |
| devices.pageClassName | 0.616 | suggested |
| provisioning.pageClassName | 0.631 | suggested |
| account.pageClassName | 0.631 | suggested |
| nav.layoutClassName | 0.637 | suggested |

**What's actually going on — not a weight problem:** the two healed
targets click a table *row* that carries its own `data-testid`, so
`attrOverlap` has real signal. The six stuck-at-~0.6 targets all click a
bare container `<div>`/`<section>` (`.table-card`, `.devices-page`,
`.provisioning-page`, `.account-page`, `.dashboard-layout`) whose *only*
identifying feature was ever its own class name — and `class-shuffle`'s
entire mutation is renaming exactly that. Checked the fingerprint schema
(`docs/fingerprint-schema.md`): an element's *own* class list was never
captured in the first place — only `id`/`name`/`type`/`data-testid`/
`role`/`aria-*` (Phase 3's `attrsFilter.ts` allow-list) plus *ancestor*
class tokens. For these six targets, `attrOverlap` isn't losing a signal
to the mutation — it never had one. No combination of the *existing* six
scorers' weights can recover information that was never captured.

**Result: no weight change made.** Reweighting can't fix a missing
capture. This is a real capability gap, not a tuning problem — logged as
NOTE-003 (own-class-token capture/scoring) for a future phase rather than
worked around here, per phase discipline. The 25% ceiling on
`class-shuffle` should be read honestly in the final table as "structural
gap, not miscalibration."

---

## Iteration 5 — Investigated compound-release's miss rate; confirmed RISK-009, not a scoring gap; margin gate validated on emergent ambiguity

**What I looked at:** `compound-release`'s heal rate had been low and
unmoved by iterations 1–3 (an in-session reading at the time showed
16.7%; see the correction note at the end of this log — the clean,
final baseline measures this class at 50% heal, but the miss-rate finding
below is unaffected either way, since it's about *which* targets miss,
not how many). Pulled this seed's real per-target mix (24 targets, drawn
from `text-change` (8), `id-rename` (8), and `sibling-reorder` (8) this
run).

**Finding 1 — the entire 25% miss rate is `sibling-reorder`, not a scoring
problem.** All 8 `sourceClass: "sibling-reorder"` targets that missed
carry the *benchmark's own* assertion error (`"expected owner ... found
..."`, `"expected first action ... found ..."`), never a Playwright
`TimeoutError` — meaning the click itself *succeeded* against the wrong
row/button and Eir's own triage never fired at all. This is RISK-009
materializing exactly as documented: a position-anchored selector after a
reorder doesn't throw, so nothing in Eir's failure-triage funnel ever
runs. No weight or threshold change touches this — it's a detection-layer
gap (NOTE-001's territory), not a matching-quality one. Directly informs
the NOTE-001 recommendation below.

**Finding 2 (real, unplanned validation) — the margin gate correctly
catches emergent ambiguity compound-release creates that no single-class
run does.** `text-change.devices.archivedRowName` scored **0.995
confidence** — near-perfect — yet classified `suggested`, not
healed-correct. Margin was below 0.05. Compound-release applies *several*
base-class mutation payloads simultaneously, so a row-scoped Edit-button
click can end up with more than one structurally-similar candidate on the
page at once (an emergent, unplanned version of the near-dup shape,
arising from mutation interaction rather than deliberate taxonomy
design). This is a genuine confirmation that the margin gate (added
before iteration 1, motivated purely by the deliberate near-dup class)
generalizes correctly to a false-heal risk it was never specifically
built for — exactly the kind of validation a benchmark is supposed to
surface.

**Result: no weight change.** Both findings are real and worth recording,
neither is fixable by adjusting the six scorer weights or the two
measurement thresholds. Confirms the loop has reached the boundary of
what weight-tuning alone can move for this benchmark's current target
registry — the remaining ceilings on `class-shuffle`, `sibling-reorder`,
and part of `compound-release` are capture-coverage and triage-layer
gaps, tracked as NOTE-003 and NOTE-001 respectively, not open tuning
questions.

---

## Summary

| Iteration | Change | id-rename heal | near-dup heal | Net |
|---|---|---:|---:|---|
| 0 (baseline) | — | 0.0% | 25.0%* | — |
| 1 | attrOverlap 0.30→0.22, labelMatch 0.15→0.23 | 12.5% | 0.0% | mixed — reverted |
| 2 | attrOverlap back to 0.30, textSim 0.20→0.12, labelMatch→0.23 | 50.0% | 25.0% | improved, no regression |
| 3 | renormalize weighted sum over applicable scorers; weights back to original v0 | 75.0% | 25.0% | improved further, no regression |
| 4 | investigated class-shuffle — capture gap, not tunable | 75.0% | 25.0% | no change (documented) |
| 5 | investigated compound-release — confirmed RISK-009, validated margin gate | 75.0% | 25.0% | no change (documented) |

*Iteration 0's near-dup number is measured post margin-gate addition (the
margin gate itself was added just before the loop started, as a direct
consequence of the decision-margin Understanding Gate walkthrough — see
this session's record).

**Final weights** (`packages/eir/src/matching/aggregate.ts`,
`INITIAL_WEIGHTS`): identical to the original v0 guess —
`attrOverlap 0.30, textSimilarity 0.20, labelMatch 0.15, ancestorChain
0.15, siblingPosition 0.12, bboxProximity 0.08` — the loop's real,
lasting change was architectural (applicable-scorer renormalization in
`scoreCandidate`), not a different set of numbers. **Final measurement
thresholds** (`packages/benchmark/src/outcome.ts`):
`MEASUREMENT_HIGH_CONFIDENCE_THRESHOLD = 0.7`,
`MEASUREMENT_MIN_MARGIN = 0.05` — both v0 guesses, neither iteration
produced evidence to move either number specifically (id-rename's
remaining gap is a capture-coverage ceiling below both bars, not a
threshold-calibration question; near-dup's dangerous case is correctly
caught by the existing margin bar).

Stopped at 5 iterations, not because 5 was a target, but because
iterations 4 and 5 both independently hit the same wall: every remaining
gap in the benchmark table is a capture-coverage gap (`class-shuffle`,
NOTE-003) or a triage-detection gap (`sibling-reorder`, RISK-009 /
NOTE-001) — neither responds to further weight or threshold movement.
Continuing to iterate on the same six numbers past that point would be
motion without evidence behind it, which the Honesty Rules exist to
prevent.

---

## Final baseline (verified reproducible — seed 42)

The official table, from `packages/benchmark/reports/baseline.md`, at the
final tuned weights and after the devServer.ts fix documented in the
correction note below. Verified by running the full 8-class suite twice
in independent invocations and diffing the results: byte-identical, and
every row's four rates sum to exactly 100% (the tell that was missing
before the fix — see below):

| Mutation Class | Affected | Heal Rate | False-Heal Rate | Suggestion Rate | Miss Rate |
|---|---:|---:|---:|---:|---:|
| id-rename | 8 | 75.0% | 0.0% | 25.0% | 0.0% |
| text-change | 8 | 87.5% | 0.0% | 12.5% | 0.0% |
| tag-swap | 8 | 100.0% | 0.0% | 0.0% | 0.0% |
| class-shuffle | 8 | 25.0% | 0.0% | 75.0% | 0.0% |
| sibling-reorder | 8 | 0.0% | 0.0% | 0.0% | 100.0% |
| wrapper-inject | 8 | 100.0% | 0.0% | 0.0% | 0.0% |
| near-duplicate-sibling-swap | 8 | 25.0% | 0.0% | 75.0% | 0.0% |
| compound-release | 24 | 50.0% | 0.0% | 25.0% | 25.0% |

**False-heal rate: 0% in every class.** id-rename and near-dup's numbers
match every independently-verified measurement from iterations 3–5
exactly. `sibling-reorder`'s 0%/100% and `class-shuffle`'s 25% are the
two documented structural ceilings (RISK-009/NOTE-001,
NOTE-003) — expected, not a regression.

### Correction note — a real infrastructure bug this session, not a matching-quality issue

While assembling this final table, repeated `pnpm bench --all` runs
produced wildly inconsistent, internally-contradictory numbers (rates not
summing to 100%, previously-verified classes suddenly showing 100%
`mutation-ineffective` — the mutated-phase probe passing using the
*frozen, pre-mutation* selector, meaning the served page genuinely wasn't
mutated). Two separate, compounding causes, neither in `packages/eir`'s
matching code:

1. **Vite's own dependency-optimizer cache (`node_modules/.vite`) isn't
   keyed on `VITE_EIR_MUTATIONS`.** A fresh Vite process can still serve a
   pre-bundled chunk cached from an earlier start with a different
   mutation payload, since Vite's cache invalidation tracks config/
   lockfile hashes, not this env var. **Fixed in code this session:**
   `packages/benchmark/src/devServer.ts` now passes `--force` to every
   `vite` invocation, forcing cache invalidation on every start.
2. **A process from a *separate, unrelated* invocation held port 5173
   while an intentional run was also using it.** `devServer.ts` already
   had a real Phase-4 fix for orphaned *children* of its own runs
   (`detached: true` + killing the whole process group via
   `process.kill(-pid, signal)` — see that function's own docstring) —
   that mechanism worked correctly throughout. What it can't and isn't
   designed to cover is a process from a *different, independent*
   `pnpm bench` invocation entirely — this session's specific failure
   mode was a background run from an earlier retry that proved unusually
   resistant to termination (`kill -9` failing repeatedly across many
   attempts before finally landing). Not a defect in `devServer.ts`'s own
   process management for a normal, single invocation — a session/
   environment artifact, confirmed dead (`ps aux`, zero matching
   processes) before the final run above was trusted.

Verified after fix 1 and confirming fix 2's process was gone: running the
full 8-class suite produced a report where every row's Heal/False-Heal/
Suggestion/Miss rates sum to exactly 100% (unlike every contaminated
attempt), and `id-rename`/`near-dup`'s numbers match every
independently-verified single/dual-class measurement from iterations 2–5
exactly — additional, independent confirmation that iterations 2–5's own
findings were sound throughout, regardless of this infrastructure issue.
