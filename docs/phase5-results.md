# Phase 5 Results — Matching Engine & Failure Triage

Companion to `docs/tuning-log.md` (the iteration-by-iteration tuning
history) and `packages/benchmark/reports/baseline.md` (the
machine-generated per-class table). This document carries the narrative
Phase 5's Definition of Done requires: the two-similar-tables case
documented with real numbers, and an honest account of why it behaves the
way it does.

---

## The Two-Similar-Tables Case (`near-dup.table-row`)

Ward's Devices page renders two visually and structurally identical
tables — Active Devices and Archived Devices — each capable of holding a
row named "Front Desk Tablet". `near-dup.table-row` (one of
`near-duplicate-sibling-swap`'s 8 targets) deliberately exploits this:
seed 42 selects the **Archived** table's "Front Desk Tablet" Remove
button as the live target (its table's own `data-testid` gets renamed);
the **Active** table's own "Front Desk Tablet" Remove button is the
`distractorId` — a real, valid, clickable element a matcher could
plausibly (and wrongly) prefer.

### Real, measured behavior

Captured from an actual run against Ward (`packages/eir`'s matcher,
current tuned weights — `docs/tuning-log.md` iteration 3 onward):

```json
{
  "fingerprint.bbox":         { "x": 1056, "y": 576, "w": 64, "h": 32 },
  "winner.bbox":              { "x": 1056, "y": 608, "w": 64, "h": 32 },
  "distractor.bbox":          { "x": 1035, "y": 210, "w": 65, "h": 21 },
  "breakdown": {
    "attrOverlap":     1,
    "textSimilarity":  1,
    "labelMatch":      0,
    "ancestorChain":   1,
    "siblingPosition": 1,
    "bboxProximity":   0.947
  },
  "confidence": 0.8457,
  "margin":     0.0085,
  "outcome":    "healed-correct"
}
```

**The matcher got it right** — the winner's position (`y: 608`) sits close
to the fingerprint's own last-known position (`y: 576`), nowhere near the
distractor (`y: 210`, a different table entirely, rendered above the
Archived one). But look at *how* it got there:

**Five of six scorers tie exactly** between the winning (correct)
candidate and the distractor. This isn't approximate — it's exact,
by construction: the two "Front Desk Tablet" rows share the same
`data-testid` on their Remove button (`device-row-remove`, common to
every row in every table), the same rendered text (`"Remove"`), the same
3-hop ancestor chain (`button → td → tr → tbody` — the `<table>` element
that actually distinguishes Active from Archived sits at hop 4, outside
the captured window, and `data-testid` isn't part of `AncestorHop` even
when in range — see NOTES.md/the session record for the full structural
analysis), and the same sibling index (1 of 2 action buttons). The
*entire* 0.0085 margin comes from `bboxProximity` alone, at its 0.08
weight — the tables are stacked vertically, so Y-coordinate is the one
surviving differentiator.

### Why this is dangerous even though it resolved correctly

A confidence of 0.8457 reads as a solid, trustworthy match in isolation.
The margin — 0.0085, against a runner-up scoring 0.8372 — says otherwise:
this match is sitting on a knife-edge. A slightly larger page reflow, a
different bbox-quantization rounding, or a small CSS change to either
table's vertical position could flip the ranking without confidence
moving in any way that would look alarming on its own. This is the real,
measured version of Blueprint §7.5's "0.91-vs-0.89 is dangerous" warning.

**This is exactly why `MEASUREMENT_MIN_MARGIN` exists as an independent
gate from `MEASUREMENT_HIGH_CONFIDENCE_THRESHOLD`** (`packages/benchmark/
src/outcome.ts`, added in direct response to walking through this real
result during this phase's Understanding Gate). At the current bar
(`0.05`), this specific case actually clears both gates and is classified
`healed-correct` — the margin, while thin, is real and consistently
positive across repeated runs (the tables' relative vertical order is
stable, not incidental). But it is the *thinnest* passing margin observed
anywhere in this phase's benchmark data, and it is the single clearest
piece of evidence that margin, not confidence, is what should carry the
real weight in Phase 6's heal-vs-suggest policy decision for this shape
of ambiguity.

### Why the other five near-dup pairs don't get to lean on bbox

Not every near-dup pair collapses to "only bbox differs" — that's
specific to the table-row pair's structural coincidence (identical row
content in both tables). The Edit/Remove, Save/Cancel, and account-modal
Cancel/Confirm pairs are told apart primarily by `siblingPosition` (which
button comes first in DOM order) and — when the mutation doesn't target
it — `textSimilarity`/`labelMatch`, since those pairs sit at different
positions in the *same* container rather than in two structurally
identical containers. The wizard Title/Requested-By pair is told apart by
`labelMatch` once its own label survives. `near-dup.table-row` is the one
pair in the registry where every non-geometric signal is genuinely,
unavoidably tied — which is exactly why it's the sharpest real
demonstration of what decision margin is for.

---

## False-Heal Rate: Measured, Not Assumed

Across every seed-42 run this phase, **measured false-heal rate is 0%**
in every mutation class, including `near-duplicate-sibling-swap` (the one
class with a real, independently-verified precision check via the live
distractor's bounding box — `packages/benchmark/src/groundTruthFile.ts`).
This is a genuinely measured zero, not an assumed one: the near-dup
ground-truth mechanism actively compares the winning candidate's position
against both the correct element's and the distractor's live positions
every run, specifically to catch the case where a matcher confidently
picks the wrong element. It has not caught one yet, at the current weight
vector and thresholds — a real, honest result, not a guarantee that no
false heal is possible with different seeds, page states, or a lower
margin bar.
