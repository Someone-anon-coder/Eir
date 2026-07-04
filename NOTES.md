# NOTES.md — Parking Lot, Decision Log & Daily Record

This file catches everything that isn't the current phase's work: parked ideas, open questions, risks, and the daily progress trail. It exists so nothing gets implemented early (approach doc §0.1.2) and nothing gets forgotten either. Update it in the same session the thought occurs — not from memory later.

**Hierarchy reminder:** `BLUEPRINT.md` (supreme) → `EIR_BLUEPRINT_APPROACH.md` (phasing) → `CLAUDE.md` (working rules) → this file (working memory). An item graduating out of this file means editing one of the three deliberately — never silent drift.

---

## How to use this file (read once, apply forever)

- **Never implement a parked item early.** If you're mid-phase and a thought belongs later, write it here and return to the current phase in the same breath.
- **Every entry gets an ID.** Format `NOTE-###`, incrementing, never reused — even if an entry is later rejected. IDs are permanent references (a commit or PR can say "addresses NOTE-014").
- **Every entry gets a status**, kept current:
  - `PARKED` — captured, not yet due for a decision.
  - `DUE` — its target phase has arrived; decide before that phase's Understanding Gate closes.
  - `RESOLVED` — decided and actioned; note *where* (which doc/phase/commit).
  - `REJECTED` — considered and consciously declined; note why (rejection is a decision too, and worth keeping so it isn't re-litigated from scratch).
- **Target phase is a claim, not a promise.** Assign your best guess; revisit at that phase's Understanding Gate.
- **Sections below are templates, not walls.** Add a new section if a category doesn't fit (e.g., "Naming Backlog," "Perf Watch List") — this file is expected to grow structure as the project does.
- **At each phase close**, sweep this file: anything `DUE` for the closing phase must be resolved or explicitly re-targeted before the `phase-N-done` tag.

---

## 1. Parked Items — Future Phase Candidates

Ideas, design additions, or scope expansions surfaced during work on an earlier phase, deliberately deferred.

### Entry Template
```
### NOTE-### — [short title]
**Status:** PARKED | DUE | RESOLVED | REJECTED
**Raised:** [date] during [phase/context]
**Target phase:** [N — name]
**Blueprint touchpoint:** [section(s) this would edit if adopted]

**The idea:**
[what, in full]

**Why it matters:**
[the concrete failure/gap it addresses]

**Why not now:**
[why it's correctly out of the current phase]

**Resolution:** [filled in when status changes]
```

---

### NOTE-001 — Post-condition verification for heal-and-continue
**Status:** DUE
**Raised:** 2026-07-04, during pre-Phase-0 design discussion (the login/signup button scenario)
**Target phase:** Phase 3 (capture) + Phase 6 (verify) — decide formally at Phase 5's tuning-loop start, once real benchmark data exists
**Blueprint touchpoint:** §7.2 (fingerprint schema — add optional post-condition field), §7.6 (policy — add verification step before accepting a heal)

**The idea:**
Feature-scoring alone cannot distinguish two *genuinely valid, genuinely clickable* near-duplicate elements — classic case: a Login button and a Signup button, same container, same structural position, near-identical attributes, differing mainly in text/label/href. If a mutation removes or alters the distinguishing text/label, the matcher can score both candidates near-equally, and worse, can land on the *wrong* one with a healthy-looking margin (a true false heal, not a low-confidence miss).

Proposed fix: during record mode, capture a lightweight **expected post-condition** alongside the fingerprint for state-changing actions — e.g., route changed to X, a specific modal became visible, a specific element appeared within N ms after the action. During heal-and-continue, after retrying the action on the matched candidate, verify the post-condition actually occurred before accepting the heal as genuine. Mismatch → downgrade retroactively to fail-with-suggestion, even though pre-action confidence was high.

**Why it matters:**
This is the sharpest edge case found so far against P4 (false heals are worse than failures). Without it, a wrong heal on a navigational element doesn't fail where it happened — it fails one or more lines later, on an unrelated-looking assertion, with a "successful" healed step sitting misleadingly clean in the report. That's actively worse for debugging than no healing at all.

**Why not now:**
Requires the fingerprint schema (Phase 3) and the policy layer (Phase 6) to exist first, and its real necessity/design should be argued from measured benchmark false-heal data (Phase 5), not speculation. Also implies a **new benchmark mutation class** (see NOTE-002) that doesn't exist yet.

**Resolution:** *(pending)*

---

### NOTE-002 — New benchmark mutation class: "near-duplicate-sibling swap"
**Status:** DUE
**Raised:** 2026-07-04, same discussion as NOTE-001
**Target phase:** Phase 4 (taxonomy design) — formal add alongside the original six classes
**Blueprint touchpoint:** §7.8 (mutation taxonomy)

**The idea:**
A distinct adversarial mutation class from the existing six (which each mutate *one* element's identity). This class instead sets up **two real, valid, similar elements competing** for a match — e.g., adjacent Login/Signup buttons, two similar table rows, two near-identical form fields — and measures whether the matcher correctly resolves to the *originally intended* one, especially when the distinguishing signal (text/label) is itself altered or weakened.

**Why it matters:**
This is a fundamentally different failure shape than "one element changed shape" — it's "which of two shapes is the right one," and it's the class most likely to produce genuine false heals rather than misses. The existing six classes mostly stress recall (can it find the element at all); this class stresses precision (does it find the *right* one when a plausible wrong answer exists).

**Why not now:**
Phase 4 builds the taxonomy; Ward's demo app (Phase 1) needs to already contain qualifying near-duplicate pairs (the two-similar-tables page is one instance — check it also covers a nav/button pair and a form-field pair before treating this class as fully seeded).

**Resolution:** *(pending — cross-check Ward's Phase 1 surfaces have enough near-duplicate pairs before Phase 4 begins; add more if not)*

---

## 2. Open Questions Awaiting a Decision

Things that must be decided before a specific point, but aren't proposals to build — thresholds, naming, config shape, etc. Lighter-weight than a Parked Item.

### Entry Template
```
### Q-### — [question]
**Status:** OPEN | ANSWERED
**Raised:** [date]
**Needed by:** [phase / milestone]
**Options considered:** [brief]
**Answer:** [filled in when resolved, with reasoning]
```

*(none yet — populate as they arise)*

---

## 3. Risk Register

Things that could derail a phase or the schedule, tracked so they're managed instead of discovered.

### Entry Template
```
### RISK-### — [short title]
**Status:** WATCHING | MITIGATED | MATERIALIZED
**Raised:** [date]
**Phase affected:** [N]
**Risk:** [what could go wrong]
**Mitigation:** [what we're doing about it, or plan if it fires]
```

### RISK-001 — Wrapper layer breaks Playwright auto-wait/chaining semantics
**Status:** WATCHING
**Raised:** 2026-07-04 (per Blueprint §7.1, called out as the riskiest unknown)
**Phase affected:** Phase 2
**Risk:** Explicit method wrapping (Q3-B) around Locators could subtly interfere with Playwright's built-in retry/auto-wait behavior, producing flaky or silently-different test behavior.
**Mitigation:** Phase 2's Definition of Done requires an explicit "invisibility proof" — the full Phase 1 reference suite run twice (vanilla vs wrapped) with asserted-identical results and an auto-wait-dependent spec passing wrapped. Do not proceed to Phase 3 until this proof is documented.

### RISK-002 — Schedule slippage crowding out Phase 8 (Gemini fallback)
**Status:** WATCHING
**Raised:** 2026-07-04 (approach doc §0.2 slippage rule)
**Phase affected:** Phase 8
**Risk:** Earlier phases (especially 5 — matching/tuning) are the most open-ended; overrun could force a rushed or cut fallback phase.
**Mitigation:** Slippage rule already defined — if cumulative slip exceeds 2 days by end of Phase 5, Phase 8 consciously descopes to a documented extension point rather than being rushed. Tracked at every phase close (`CLAUDE.md` §5).

---

## 4. Decisions Already Made (index, not detail)

Quick-reference index into decisions already recorded elsewhere, so this file doesn't duplicate them — just points to them.

| Decision | Where it lives |
|---|---|
| Q1–Q10 build decisions (roles, interception mechanism, demo app tech, LLM scope, etc.) | `EIR_BLUEPRINT_APPROACH.md` §0 |
| Package name (`playwright-eir`) | `EIR_BLUEPRINT_APPROACH.md` header + npm registry |
| Founding principles P1–P8, non-goals | `BLUEPRINT.md` §4, §6 |
| Coding/testing/commit standards | `CLAUDE.md` §7–8 |

---

## 5. Daily Progress Log

One entry per working session. Short. This is a trail, not a report — future-you (or an interviewer) should be able to reconstruct the project's actual path from this section alone.

### Entry Template
```
### [date] — Phase [N], [work item]
- Did: [1–3 lines]
- Blocked/open: [if any — link to NOTE-### or Q-### if it became one]
- CI: green | red ([why])
- Next: [where the next session picks up]
```

*(log starts at Phase 0 kickoff)*

---

## 6. Changelog to Governing Documents

Because `BLUEPRINT.md`, `EIR_BLUEPRINT_APPROACH.md`, and `CLAUDE.md` are meant to be edited deliberately, not silently (each says so explicitly), every such edit gets a line here for traceability — what changed, why, and which NOTE/Q/RISK item (if any) triggered it.

### Entry Template
```
### [date] — [file changed] — [one-line summary]
**Triggered by:** [NOTE-###/Q-###/RISK-### or "direct decision"]
**Change:** [what section, what changed]
```

### 2026-07-04 — CLAUDE.md — no direct pushes to main; PR-only workflow
**Triggered by:** direct decision (Aayush, during Phase 0 tooling work, before the first push of the session)
**Change:** §8 Git & Commits gains two rules: (1) Claude never pushes directly to `main` — every change lands on a feature branch and goes through a pull request via `gh pr create`, even Phase-0 scaffolding; (2) branch naming convention fixed as `<scope>-<purpose>-<YYYY-MM-DD>`.

---

*This file has no end state — it grows for the life of the project. If it gets unwieldy, split by section into `notes/parked.md`, `notes/log.md`, `notes/risks.md` and leave a pointer here; don't let size become a reason to stop maintaining it.*
