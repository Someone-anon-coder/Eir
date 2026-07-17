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
**Status:** RESOLVED (implemented Phase 6, 2026-07-11 — see full implementation detail below)
**Raised:** 2026-07-04, during pre-Phase-0 design discussion (the login/signup button scenario)
**Target phase:** Phase 6 (verify) — Phase 3's capture dependency resolved without needing a schema change (see decision below); formal decision made 2026-07-08 during Phase 5's tuning loop, once real benchmark data existed
**Blueprint touchpoint:** §7.2 (fingerprint schema — add optional post-condition field), §7.6 (policy — add verification step before accepting a heal)

**The idea:**
Feature-scoring alone cannot distinguish two *genuinely valid, genuinely clickable* near-duplicate elements — classic case: a Login button and a Signup button, same container, same structural position, near-identical attributes, differing mainly in text/label/href. If a mutation removes or alters the distinguishing text/label, the matcher can score both candidates near-equally, and worse, can land on the *wrong* one with a healthy-looking margin (a true false heal, not a low-confidence miss).

Proposed fix: during record mode, capture a lightweight **expected post-condition** alongside the fingerprint for state-changing actions — e.g., route changed to X, a specific modal became visible, a specific element appeared within N ms after the action. During heal-and-continue, after retrying the action on the matched candidate, verify the post-condition actually occurred before accepting the heal as genuine. Mismatch → downgrade retroactively to fail-with-suggestion, even though pre-action confidence was high.

**Why it matters:**
This is the sharpest edge case found so far against P4 (false heals are worse than failures). Without it, a wrong heal on a navigational element doesn't fail where it happened — it fails one or more lines later, on an unrelated-looking assertion, with a "successful" healed step sitting misleadingly clean in the report. That's actively worse for debugging than no healing at all.

**Why not now (superseded — see decision below):**
Requires the fingerprint schema (Phase 3) and the policy layer (Phase 6) to exist first, and its real necessity/design should be argued from measured benchmark false-heal data (Phase 5), not speculation. Also implies a **new benchmark mutation class** (see NOTE-002) that doesn't exist yet.

**Phase 5 formal decision — ADOPT for Phase 6, evidence-backed:**

Two real, measured data points from this phase's live tuning loop and the near-dup precision check (`packages/benchmark/src/groundTruthFile.ts`), run against Ward:

1. **The one genuinely hard case in the current taxonomy (`near-dup.table-row` — see `docs/phase5-results.md`) was correctly caught, but only barely.** Measured: confidence 0.8457, margin 0.0085 against its live distractor (the Active table's own identically-named row). Five of six scorers tie *exactly* between the correct element and the distractor; the entire margin comes from one low-weighted scorer (`bboxProximity`). The newly-added `MEASUREMENT_MIN_MARGIN` gate (added specifically because of this real result, during this phase's decision-margin Understanding Gate) is what keeps this classified `suggested`-worthy-of-scrutiny rather than a confident, unverified heal — measured false-heal rate is 0% across every class this phase, specifically *because* margin-gating is doing real work here, not because the underlying ambiguity isn't real.
2. **Margin-gating is a *pre*-action heuristic — it does not verify anything about what actually happened.** It measures "how much better is my top-scored candidate than my second," never "did retrying the action on my top-scored candidate actually produce the outcome the original action was supposed to produce." A matcher confidently wrong about *both* of two candidates (an unusual page state, a scoring blind spot neither near-dup's registry nor this phase's tuning loop happened to exercise) would still show a healthy margin and clear every gate Phase 5 can build. Post-condition verification is the only mechanism proposed anywhere in this project that checks the *result* of a heal rather than the *inputs* to the decision — margin and post-condition verification are complementary, not substitutes for each other.

Separately, **RISK-009 (`sibling-reorder`, measured 100% miss rate this phase, materializing exactly as predicted)** is a related but distinct gap NOTE-001 does not by itself close: a position-anchored selector's click succeeding against the *wrong* row never throws, so Eir's own triage funnel — margin-gating included — never runs at all. Phase 6 should treat NOTE-001's verification step and RISK-009's "resolved but plausibly wrong" detection gap as one design conversation, not two: both are instances of "the action reported success, but was it actually success against the right element?", one on a *healed* path (NOTE-001, the login/signup case) and one on a completely ordinary, never-healed path (RISK-009, sibling-reorder). A single post-condition/outcome-verification mechanism in Phase 6 that checks the resolved element's identity (not just that *some* click succeeded) plausibly closes both at once.

**Resolution:** Adopted for Phase 6, decided 2026-07-08 with the evidence above. Implementation is Phase 6's work, not this phase's — scoped there as: (a) capture a lightweight post-condition per imperative action during record mode (extends `Fingerprint`'s capture path, not its schema — no Phase 3 schema change needed, since the post-condition can live in the same fire-and-forget capture flow as a sibling field written alongside, not inside, the stored `Fingerprint`), and (b) verify it after heal-and-continue's retry, *and* consider extending the same resolved-element identity check to ordinary (non-healed) imperative successes to close RISK-009 in the same pass.

**Phase 6 implementation (2026-07-11):**

- **Schema (`packages/eir/src/postCondition.ts`):** `PostCondition` is a 3-way discriminated union — `route-change` (to a normalized route), `dom-count-change` (sign only: `increased`/`decreased`), `none`. Deliberately just two auto-derived facts, never a user-authored expectation — the hard scope boundary this retrofit was given ("no general-purpose assertion framework").
- **Capture:** two page-level pulses (`{ route, elementCount }`, via `capture/pagePulse.ts`'s self-contained in-page function) taken concurrently with the action's start and right after success is confirmed — the exact same timing discipline RISK-007 established for fingerprint capture, applied a second time. Diffed via the pure `derivePostCondition`.
- **Storage:** a true sibling file per route, in the *same* `.eir/routes/` directory as the fingerprint (`login.json` / `login.postconditions.json`), not a schema change to `Fingerprint` and not even a new directory. Safe co-location is enforced by validator, not path — a `PostCondition` object structurally cannot pass `isFingerprint` or vice versa (unit-tested). The whole route-file store/shard/merge/reader machinery (`store/genericRouteStore.ts`) was genericized over its leaf type so `PostCondition` rides the same proven infrastructure `Fingerprint` already used, rather than duplicating four modules.
- **Verification (heal-and-continue's retry only):** `EirLocator#retryHealed` captures before/after pulses around the retry itself (genuinely `await`ed — this is a policy decision, not passive observability) and compares the derived `PostCondition` against what was stored for that selector via `postConditionMatches`. A stored `"none"` (or an unobservable pulse) always passes — nothing to verify isn't the same as verification failing. A mismatch downgrades the heal to fail-with-suggestion; the *original* error is what the test fails with, annotated `eir-heal-rejected` — never the retry's own error.
- **Mechanism B (RISK-009 closure, same pass):** on every *ordinary* (non-throwing) imperative success, `EirLocator#recordCapture` reuses Phase 5's own weighted scorer (`checkSelfSimilarity`, `policy/driftCheck.ts`) to compare the fresh capture against the stored baseline *before* refreshing it. The refresh always happens regardless (record mode must keep drifting with legitimate app evolution) — a low score only adds a `drift-suspected` entry to the report, never blocks anything.
- **Real measured evidence** (`packages/benchmark/reports/note001-heal-evidence-*.md`, seed 42, `bench:heal-evidence`):
  - **`sibling-reorder`:** Mechanism B fired correctly on all 4 targets whose action Eir actually wraps (the row-order probes, via a tracked `innerText()` call) — self-similarity **0.6471**, below the 0.7 bar, flagged `drift-suspected` on exactly RISK-009's shape (a successful action, wrong element, nothing throws). The other 4 targets (2 via `getAttribute` — a plain pass-through Eir never wraps at all; 2 via a selector chain with no pre-existing baseline) produced no policy event — a real, honestly-reported partial-coverage gap, not hidden.
  - **`near-duplicate-sibling-swap`:** 6/8 targets stayed correctly margin-gated to suggestion (0.0000–0.0268 margin); 2/8 cleared both bars and healed. Zero false heals. Neither heal's retry had a pre-existing stored post-condition for that exact selector, so Mechanism A's verification path itself was not exercised this run (accepted via the documented "none → accept" path) — reported honestly rather than claimed as a demonstrated catch.
  - **Honest bottom line:** RISK-009 is *partially* closed (Mechanism B genuinely works where Eir's action-wrapping surface reaches; it cannot reach a plain-pass-through call or an uncalibrated selector). NOTE-001's post-condition mismatch path exists, is implemented, and is unit-tested (including a mismatch-triggers-rejection case with a mocked matcher), but has not yet been exercised by a real, naturally-occurring false-heal-turned-mismatch in this benchmark's seed 42 runs — margin-gating alone happened to be sufficient for every case this run produced.

**Governing-document edits:** BLUEPRINT.md §7.2 (post-condition capture as a sibling artifact) and §7.6 (verification as a distinct, complementary gate to decision margin); EIR_BLUEPRINT_APPROACH.md's Phase 3 OUT section (retrospective cross-reference) and Phase 6 (new work item 7, DoD line, OUT-list guard against scope creep into a general assertion framework). See the Changelog to Governing Documents below.

---

### NOTE-002 — New benchmark mutation class: "near-duplicate-sibling swap"
**Status:** RESOLVED
**Raised:** 2026-07-04, same discussion as NOTE-001
**Target phase:** Phase 4 (taxonomy design) — formal add alongside the original six classes
**Blueprint touchpoint:** §7.8 (mutation taxonomy)

**The idea:**
A distinct adversarial mutation class from the existing six (which each mutate *one* element's identity). This class instead sets up **two real, valid, similar elements competing** for a match — e.g., adjacent Login/Signup buttons, two similar table rows, two near-identical form fields — and measures whether the matcher correctly resolves to the *originally intended* one, especially when the distinguishing signal (text/label) is itself altered or weakened.

**Why it matters:**
This is a fundamentally different failure shape than "one element changed shape" — it's "which of two shapes is the right one," and it's the class most likely to produce genuine false heals rather than misses. The existing six classes mostly stress recall (can it find the element at all); this class stresses precision (does it find the *right* one when a plausible wrong answer exists).

**Why not now:**
Phase 4 builds the taxonomy; Ward's demo app (Phase 1) needs to already contain qualifying near-duplicate pairs (the two-similar-tables page is one instance — check it also covers a nav/button pair and a form-field pair before treating this class as fully seeded).

**Resolution:** Formally adopted 2026-07-07 during Phase 4 as the 7th mutation class (`near-duplicate-sibling-swap`), alongside Blueprint §7.8's six plus `compound-release`. Implemented in `packages/benchmark/src/targets.ts`/`groundTruth.ts`: 8 pairs built against the three confirmed shapes — 1 table-row pair (Active vs Archived "Front Desk Tablet", mutating the *container* testid rather than the shared row-action testid, since Edit/Remove testids are identical across both tables and mutating them would break the distractor too), 5 button-adjacent pairs (Edit/Remove ×3 rows, Save/Cancel ×2 rows, Account modal Cancel/Confirm-Delete), and 1 form-field pair (wizard Title/Requested-By labels). Each pair's ground truth carries a `distractorId` pointing at the live, valid sibling a future matcher could wrongly prefer — the one structural difference from the other six classes' ground truth, which need no such field. A seeded PRNG picks exactly one direction per pair per run (never both — mutating both would destroy the distractor), so total live entries per run is always 8, matching the other classes' `>=8` bar. Phase 4 only records the distractor; nothing scores or matches against it yet — that's Phase 5.

---

### NOTE-003 — Fingerprint schema never captures an element's own class tokens
**Status:** PARKED
**Raised:** 2026-07-08, during Phase 5's tuning loop (iteration 4), while investigating `class-shuffle`'s stuck-at-25% heal rate
**Target phase:** Unassigned — earliest candidate is a future fingerprint-schema revision (touches Phase 3's shipped schema, not a same-phase fix)
**Blueprint touchpoint:** §7.2 (fingerprint captured features), docs/fingerprint-schema.md's `attrs` allow-list and "deliberately not captured" section

**The idea:**
`docs/fingerprint-schema.md` deliberately excludes `class` from an element's own captured `attrs`, on the stated theory that class identity is "handled separately, see ancestors" — i.e., a class token matters for scoring via an *ancestor's* class list, not the element's own. This holds for elements identified by something else (`data-testid`, role+text) where class is incidental. It does not hold for `class-shuffle`'s six page/card-container targets (`.devices-page`, `.table-card`, `.dashboard-layout`, etc.) — plain `<div>`/`<section>` wrappers whose *only* identifying feature, ever, was their own class name. For these, `attrOverlap` isn't degraded by the mutation, it never had anything to score in the first place; no combination of the six existing scorers' weights can recover a signal that was never captured for the element itself.

**Why it matters:**
Measured, not theoretical: `packages/benchmark`'s `class-shuffle` class plateaus at 25% heal rate (2/8) through 5 tuning iterations that moved every other class — see `docs/tuning-log.md` iteration 4. The 2 that do heal are row clicks with a real `data-testid`; the 6 that don't are exactly the class-only-identified containers. This is a real, measured recall ceiling on 1 of the 8 mutation classes, not a tuning problem.

**Why not now:**
Fixing this means either (a) adding the element's own filtered class tokens as a captured `Fingerprint`/`CandidateFeatures` field (a 7th scorer dimension, `ownClassOverlap` or similar) or (b) extending `attrOverlap` to also consider the element's own class list — either way, a schema change to `Fingerprint` (Phase 3, already shipped/published) requiring every existing baseline to be recaptured, and a new/changed scorer requiring its own Understanding-Gate treatment and table-driven tests, same as the original six. Out of scope for a same-phase tuning-loop fix; a real capability addition, not a weight adjustment.

**Phase 9 disposition (2026-07-16):** documented, not fixed — per the ledger-triage gate, no schema change this session. The README's results table (Session 2) will state the measured 25% `class-shuffle` ceiling and name this note as the schema-v2 candidate that would address it.

**Resolution:** *(pending)*

---

### NOTE-004 — Post-condition verification silently no-ops when no baseline exists, same as a genuine "none"
**Status:** RESOLVED (implemented Phase 9, 2026-07-16)
**Raised:** 2026-07-11, during Phase 6's NOTE-001 retrofit, while reviewing the real heal-mode evidence run
**Target phase:** Phase 9 (retargeted 2026-07-15 — see below)
**Blueprint touchpoint:** §7.6 (policy — post-condition verification)

**The idea:**
`EirLocator#retryHealed` treats two genuinely different situations identically: (a) a selector whose last successful run had no observable side effect (`PostCondition.kind === "none"` — a real, deliberate signal), and (b) a selector that has *never* had a post-condition captured at all (`postConditionReader.lookup(...)` returns `undefined` — no baseline exists, e.g. because it was never exercised during calibration, or because it's a brand-new selector this same run). Both currently skip verification and accept the heal on margin alone. This is measured, not theoretical: this phase's own `near-duplicate-sibling-swap` heal-mode evidence run (`packages/benchmark/reports/note001-heal-evidence-near-duplicate-sibling-swap.md`) shows both real heals landing in case (b) — no prior baseline existed for either selector — which is indistinguishable in the current report from case (a).

**Why it matters:**
A team reading "this heal was accepted, nothing to verify" can't currently tell whether that means "verified nothing changed, by design" or "we've simply never seen this selector succeed with a post-condition before, so we have no idea." The second case is a weaker trust signal and arguably deserves its own annotation/report column — closer to a genuinely uncalibrated heal than a genuinely low-risk one.

**Why not now:**
Purely a reporting-fidelity question, not a correctness one (nothing here produces a wrong heal-and-continue decision) — doesn't block Phase 6's DoD. Deferred rather than expanding `PostCondition`'s type or the reporter's row shape mid-phase.

**Phase 8 revisit (2026-07-15):** this note's own text named "whenever the report shape gets revisited" as its target — Phase 8 did exactly that, extending `ReportRow` with a `fallback` field (Understanding Gate 3, see `docs/hybrid-comparison.md`/session brief). Deliberately did **not** fold this note in at the same time: it's a verification-fidelity gap in Phase 6's post-condition machinery, unrelated to fallback provenance, and Phase 8's own scope (trigger contract, provider seam, comparison benchmark) doesn't touch the post-condition path at all. Retargeted to Phase 9's hardening/acceptance sweep, which already owns the reporter's remaining fidelity gaps (NOTE-005).

**Resolution (Phase 9, 2026-07-16):** `RetryOutcome`'s `"healed"` variant (`packages/eir/src/policy/policyLog.ts`) gains a `verification: "verified" | "skipped-none" | "skipped-no-baseline"` field, computed in `EirLocator#retryHealed` (`packages/eir/src/eirLocator.ts`): `stored === undefined` → `"skipped-no-baseline"` (no baseline ever existed — the weaker signal this note is about); pulses unobservable or a real stored `"none"` → `"skipped-none"` (Phase 6 already treated these as equivalent); a genuine compare-and-match → `"verified"`. Threaded through `ReportRow.postConditionVerification` (same optional-field, mixed-version-tolerant pattern Phase 8 set for `fallback`) and `ci-action`'s validator/renderer — the PR comment now states the real breakdown (e.g. "2 rows genuinely verified... 1 row accepted on margin alone, no prior baseline existed") instead of a blanket "can't tell" disclaimer. New tests: `eirLocator.retry.test.ts` (all three states via the real retry path), `eirReporter.test.ts`, `ci-action`'s `report.test.ts`/`renderComment.test.ts`.

---

### NOTE-005 — Mechanism A (post-condition verification) has never caught a real wrong heal end-to-end
**Status:** RESOLVED (Phase 9, 2026-07-16 — mandatory fix per the phase's own ledger-triage instruction, not a documentation-only close)
**Raised:** 2026-07-11, during Phase 7 session-open housekeeping (carried forward from the Phase 6 close conversation)
**Target phase:** Phase 9 (hardening / acceptance sweep)
**Blueprint touchpoint:** §7.6 (post-condition verification), §9.2 (behavioral acceptance criteria)

**The idea:**
Phase 6 shipped Mechanism A (post-condition verification on heal-and-continue's retry) and it is unit-tested against a mocked matcher, including a mismatch-triggers-rejection case. But it has never been exercised against a *real* wrong heal produced end-to-end by the actual matching engine — every benchmark heal that has fired so far either had no pre-existing stored post-condition to verify against (accepted via the documented "none → accept" path) or wasn't wrong in the first place. So the mismatch-and-reject branch is proven correct in isolation, never proven to actually fire in a live run.

**Why it matters:**
This is the exact asymmetry P4 cares about (false heals are worse than failures) — the mechanism built specifically to catch that worst case is unverified in the one way that would matter most: catching a real one. An honest acceptance sweep shouldn't just re-confirm unit tests; it should construct or find a live scenario where the matcher genuinely heals to the wrong element with a pre-existing stored post-condition, and confirm Mechanism A downgrades it to fail-with-suggestion as designed.

**Why not now:**
Phase 7 consumes the reporter artifact for CI delivery; it doesn't extend or re-exercise the matching/policy engine. Constructing a real false-heal case deliberately (rather than accepting a lucky benchmark result) is acceptance-sweep work, matching Blueprint §9.2's behavioral criteria — squarely Phase 9's job.

**Resolution (Phase 9, 2026-07-16):** `packages/eir/src/acceptance/note005RealFalseHeal.test.ts` — a real browser DOM (a genuine HTTP-served page via a real Chromium launched with `@playwright/test`'s `chromium`, added as a devDependency), the real unmocked `attemptMatch` funnel and all six scorers, and a real `EirLocator#retryHealed` retry. Scenario: a near-duplicate button pair transplanted from this note's own Login/Signup motivating example — the real target ("Delete Item") removes a DOM node when clicked, a genuine `dom-count-change: decreased` post-condition; after it's removed from the DOM (simulating the mutation that would trigger healing), only a structurally similar distractor remains ("Archive Item", which *adds* a node instead — the opposite signal). With a deliberately permissive `healThreshold` (0.2, stated explicitly in the test as far below the shipped 0.7 default and not a claim about safe defaults — the measured 0% false-heal rate stands), the real matcher confidently heals to the distractor (measured confidence ≈0.5602, real and reproducible), the retry genuinely executes against it (confirmed via the real DOM effect), and Mechanism A's `postConditionMatches` genuinely catches the mismatch, downgrading to `heal-rejected-post-condition-mismatch` — the original zero-match error is what the caller sees, per the retry-once contract. This is the live catch this note asked for, not a re-confirmation of the existing mocked-matcher unit tests. Needed a CI ordering fix (`.github/workflows/ci.yml`): Chromium now installs before `pnpm test`, not just before the demo-app e2e step, since `packages/eir`'s own suite needs a real browser now.

---

### NOTE-006 — GitHub Marketplace publication of `ci-action`
**Status:** PARKED
**Raised:** 2026-07-12, during Phase 7 (explicitly named as OUT-of-scope by EIR_BLUEPRINT_APPROACH.md's Phase 7 section, with instruction to record it here)
**Target phase:** Post-project polish, after Phase 9
**Blueprint touchpoint:** none — packaging/distribution, not a design decision

**The idea:**
Publish `packages/ci-action` to the GitHub Marketplace so it can be referenced as `uses: someone-anon-coder/eir-ci-action@v1` from any repo, instead of the current `uses: ./packages/ci-action` local-path reference that only resolves inside this monorepo's own checkout.

**Why it matters:**
Marketplace publication is what makes the action actually reusable outside this repo without a manual copy — real adoption-readiness, not just a working demo.

**Why not now:**
Explicitly named OUT for Phase 7 by the approach doc ("Gemini. Marketplace publication of the action (post-project polish, NOTES.md)"). Publishing implies a versioning/release story `packages/eir`'s own npm releases already established a precedent for, worth doing deliberately post-Phase-9, not as a Phase 7 afterthought.

**Phase 9 disposition (2026-07-16):** status confirmed unchanged — stays parked post-project, per the ledger triage's item 12.

**Resolution:** *(pending)*

---

### NOTE-007 — Gemini free-tier rate limits are a real, measured adoption cost for the fallback
**Status:** PARKED
**Raised:** 2026-07-15, during Phase 8's comparison benchmark
**Target phase:** Phase 9 (README/adopter docs caveat)
**Blueprint touchpoint:** none directly — an operational/adoption fact, not a design decision

**The idea:**
Across 5 real comparison-benchmark runs this session (74 total fallback invocation attempts, across two separate free-tier API keys), only 17 (23%) received a real model response — the other 57 degraded cleanly to `no-verdict` on a genuine `http-429` (rate limit) or `http-503` (server overload), exactly as the graceful-degradation contract is designed to handle. A short (75s) cooldown between runs did not help, suggesting a daily rather than per-minute cap for at least one of the two keys tried. This is not an engine defect — no Playwright test ever failed because of the fallback, and every no-verdict was correctly diagnosable — but it is a real reliability ceiling an adopter needs to know about before enabling the feature at any volume on a free-tier key.

**Why it matters:**
An adopter reading "the fallback is available" without this caveat could reasonably expect it to respond most of the time. The measured reality (this session) is closer to "roughly 1 in 4 attempts succeeds on a free tier, and it can stay pinned at 0 for an extended period once a daily cap is hit." This belongs in the README/adoption docs as a plainly stated limitation, per CLAUDE.md §10's honesty rules.

**Why not now:**
Phase 8's job was to measure and report this honestly (done — see `docs/hybrid-comparison.md`), not to write the adopter-facing README, which is Phase 9's job.

**Phase 9 disposition (2026-07-16):** confirmed for documentation, not code — the README's fallback section (Session 2) will state the measured ~23% real-response rate plainly wherever the fallback is documented.

**Resolution:** *(pending)*

---

### NOTE-008 — Benchmark evidence CLIs overwrite their own prior report with no versioning or backup
**Status:** RESOLVED (Phase 9, 2026-07-16)
**Raised:** 2026-07-15, during Phase 8's comparison benchmark, after directly losing data to this gap
**Target phase:** Unassigned — whenever `packages/benchmark`'s CLI tooling is next touched
**Blueprint touchpoint:** none — tooling hygiene, not a design decision

**The idea:**
`hybridComparisonCli.ts` (this phase) and its precedent `healEvidenceCli.ts` (Phase 6) both write their JSON/markdown report to a fixed filename in `packages/benchmark/reports/`, unconditionally overwriting whatever was there. This bit real work this session: the first hybrid-comparison run produced the richest real data (20 invocations, 13 successful verdicts), but two subsequent reruns (chasing a "cleaner" sample) silently overwrote that file before it was copied aside, permanently losing the per-invocation detail (the aggregate numbers survived only because they'd been echoed to the console and captured in the session transcript).

**Why it matters:**
Any evidence-gathering CLI whose output feeds a committed doc (`docs/hybrid-comparison.md`, `docs/tuning-log.md`'s iteration history) is one accidental rerun away from losing real, possibly non-reproducible data (live API calls, timing-sensitive captures) with no recovery path.

**Why not now:**
A real gap, but a tooling-hygiene one, not a Phase 8 design/DoD blocker — the phase's actual evidence was recovered honestly via the transcript and reported as such.

**Resolution (Phase 9, 2026-07-16):** `packages/benchmark/src/evidenceFileGuard.ts`'s `assertWritable(filePath, force)` — refuses to overwrite an existing file unless `--force` is passed explicitly, checked (for both the JSON and Markdown outputs) before either is written so a rerun never partially clobbers. Wired into both `healEvidenceCli.ts` and `hybridComparisonCli.ts` (each gains a `--force` flag); unit-tested in `evidenceFileGuard.test.ts`.

---

### NOTE-009 — `EirLocator` needs a real unwrap-if-`EirLocator` step for `.and()`/`.or()`/`.dragTo()`/`.locator(sel, {has})`
**Status:** PARKED
**Raised:** 2026-07-16, during Phase 9's ledger triage (RISK-005's disposition)
**Target phase:** Unassigned — post-release, whenever `EirLocator`'s method surface is next touched
**Blueprint touchpoint:** §7.1 (interception layer) — an implementation completeness gap, not a principle question

**The idea:**
RISK-005 is now confirmed a real, reproducible bug (see its Phase 9 disposition above and `packages/demo-app/tests/eir-proof/locator-as-argument.spec.ts`): `EirLocator` never unwraps an `EirLocator` argument back to the real Playwright `Locator` it wraps when passed as an *argument* to another Locator's method. The fix is an internal `instanceof EirLocator` check (or a narrow, package-private unwrap accessor) inside `.and()`, `.or()`, `.dragTo()`, and `.locator(sel, { has })` specifically — the four real call sites confirmed to read another `Locator`'s private fields directly.

**Why it matters:**
Real adopting suites do call `.and()`/`.or()` to compose locators, and `dragTo()` for drag-and-drop flows. Today, doing so with an Eir-wrapped page silently breaks in a confusing way (a Playwright internal error about frames, not an Eir-authored message) rather than working transparently, which cuts against Blueprint P1/P2 (the tool should be invisible until it heals).

**Why not now:**
A real design decision (should the unwrap be `instanceof`-based or structural? does it need its own Understanding Gate given CLAUDE.md §7.1's `any`/cast discipline?) and its own table-driven tests — more than an hour's work, and Phase 9's remaining scope (README, demo path, external test, release) doesn't have room for it without rushing the release.

**Resolution:** *(pending)*

---

### NOTE-010 — `docs/ci.md`'s workflow snippet has never been verified from an external fork
**Status:** PARKED
**Raised:** 2026-07-12 during Phase 7 (verbally noted, no NOTE-### assigned at the time); formalized with an ID during Phase 9's ledger triage, 2026-07-16
**Target phase:** Post-release polish
**Blueprint touchpoint:** none — a verification-coverage gap, not a design decision

**The idea:**
Phase 7's DoD judged `docs/ci.md`'s snippet proven via four green/expected-red CI runs across two real PRs on this repo (#14, #15) rather than a separate external-fork test, on the reasoning that live-repo evidence was disproportionately strong already. That judgment call is recorded honestly (Phase 7's 2026-07-12 progress log entry) but the external-fork case itself has never actually been run.

**Why it matters:**
The one thing a same-repo test can't rule out is a packaging/permissions surprise specific to a *fork* (different `github.token` defaults, a fork's `pull_request` event having reduced permissions by default, etc.) — exactly the kind of friction Blueprint §9.1's install bar cares about.

**Why not now:**
Judged disproportionate for Phase 7's own DoD (see above) and not required by Phase 9's own §9.1 external-clean-project test, which covers `playwright-eir`'s npm install path, not `ci-action`'s GitHub Actions path specifically. Deferred rather than silently dropped.

**Resolution:** *(pending)*

---

### NOTE-011 — The no-heals "comment updates to a clean state" branch has never been exercised live
**Status:** PARKED
**Raised:** 2026-07-12 during Phase 7 (verbally noted as "worth knowing, not blocking" in that session's progress log); formalized with an ID during Phase 9's ledger triage, 2026-07-16
**Target phase:** Post-release polish
**Blueprint touchpoint:** §7.7 (reporting — the no-heals path)

**The idea:**
`ci-action`'s no-heals handling (a PR whose findings disappear on a later push should update the existing comment to a "nothing to report" state, not leave a stale findings comment or post a duplicate) is unit-tested but has never been exercised by a real PR that had findings and then lost them across two pushes.

**Why it matters:**
This is the one branch of the upsert-comment logic without live confirmation; a real adopting team's PR (fix the mutation, push again) would be the first live exercise of exactly this path.

**Why not now:**
Low risk — unit-tested, and the underlying upsert-by-marker mechanism is otherwise proven live (dogfood PR #15's second/third pushes updated the same comment ID). Not worth engineering an artificial live scenario just to exercise this one branch during Phase 9's already-large scope.

**Resolution:** *(pending)*

---

### NOTE-012 — The hybrid-comparison's "no benefit" claim needed its exact trigger-scope boundary stated explicitly
**Status:** RESOLVED (Phase 9, 2026-07-16)
**Raised:** 2026-07-16, during Phase 9's ledger triage (flagged as a Phase 8 review finding, previously untracked by a NOTE-### ID)
**Target phase:** Phase 9
**Blueprint touchpoint:** §7.8 (benchmark honesty), §9.3 (measurement bar)

**The idea:**
`isFormallyUncertain` (`packages/eir/src/fallback/trigger.ts`) only ever returns true for a `MatchAttempt` of kind `"matched"` whose winner failed heal qualification. A `"no-candidates"` attempt (zero live candidates found at all) or a `"rejected"` attempt (triage gated it out before matching ran) can never reach the trigger. `docs/hybrid-comparison.md` explained per-class *why* some classes never invoke the fallback (e.g. `sibling-reorder`'s RISK-009 gap) but never stated the *general* boundary this implies: the LLM was never consulted on true no-candidate misses, in either mode, on this benchmark.

**Why it matters:**
Without the boundary stated explicitly, "no measured benefit" reads as a broader claim than the evidence supports — an interviewer or adopter could reasonably (but wrongly) generalize it to "the LLM can't help with misses," which was never tested.

**Why not now:**
N/A — cheap, high-value doc fix, done this session.

**Resolution:** `docs/hybrid-comparison.md` gained an explicit paragraph in "The trigger predicate" section stating the exact scope (`"matched"`-only, never `"no-candidates"`/`"rejected"`) and a third numbered caveat in "The honest verdict" restating it where a reader skimming just the conclusion would see it. The precise honest claim is now spelled out: "no measured benefit on the cases the fallback was consulted about," not "the LLM can't help with misses."

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

### Q-001 — What should `suggestThreshold` (the floor below which not even a suggestion is shown) default to?
**Status:** ANSWERED (provisionally — labeled an estimate, not a measurement; a real anchoring attempt made at 1.0.0 closure found no evidence either way, see below)
**Raised:** 2026-07-11, during Phase 6's threshold-justification Understanding Gate
**Needed by:** Phase 6 (enacting real policy defaults)
**Options considered:** (a) leave unset/0 — always show a suggestion, no matter how weak; (b) pick a conservative first-principles number with no data behind it, label it clearly as an estimate; (c) block Phase 6 on generating synthetic low-confidence benchmark data just to measure this one number.
**Answer:** (b) — `DEFAULT_SUGGEST_THRESHOLD = 0.3` (`packages/eir/src/policy/thresholds.ts`), justified in `docs/thresholds.md`. Phase 5's benchmark never produced a genuinely low-confidence `"matched"` result (every match it ever saw was worth showing as a suggestion), so there is no measured distribution to anchor a number to — blocking on (c) would have meant manufacturing an artificial scenario just to generate a number, which is worse than an honestly-labeled estimate. Revisit once real low-confidence match data exists (a future mutation class stress-testing recall, or real-world adoption data).

**B1 revisit (1.0.0 closure, 2026-07-17):** ran the full 8-class benchmark with match-logging on (`packages/benchmark/reports/suggest-threshold-evidence-seed42.md`) specifically to attempt this anchor before shipping 1.0. Found 66 matched attempts across all 8 classes, confidence range 0.5849–1.0000 — zero anywhere near the 0.3 floor. This is the same structural gap Q-001 already named, now confirmed with real data rather than inferred from the absence of it: the taxonomy has no "weak but plausible lead" zone to calibrate against. `0.3` stays exactly as it was — an honestly-labeled estimate, not relabeled as measured. Revisit criterion unchanged.

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
**Status:** MITIGATED (did not materialize — see resolution below)
**Raised:** 2026-07-04 (approach doc §0.2 slippage rule)
**Phase affected:** Phase 8
**Risk:** Earlier phases (especially 5 — matching/tuning) are the most open-ended; overrun could force a rushed or cut fallback phase.
**Mitigation:** Slippage rule already defined — if cumulative slip exceeds 2 days by end of Phase 5, Phase 8 consciously descopes to a documented extension point rather than being rushed. Tracked at every phase close (`CLAUDE.md` §5).

**Resolution (2026-07-15):** Did not materialize. Phase 8 executed with its full documented scope (trigger contract, provider seam, comparison benchmark across all 8 classes) — no descope was needed. Downgraded from WATCHING to MITIGATED.

### RISK-003 — `EirLocator` forwards undocumented Playwright internals (`_apiName`, `_expect`)
**Status:** WATCHING (unchanged — an ongoing risk by nature, mitigated not eliminated; the specific `_expectScreenshot` gap this note flagged is closed as of B2, 1.0.0 closure, 2026-07-17, see below)
**Raised:** 2026-07-06, during Phase 2 wrapper-class design
**Phase affected:** Phase 2 (introduced), all downstream phases (inherited)
**Risk:** Playwright's `expect(locator).toBeVisible()` and similar matchers duck-type a private `_apiName` field and call a private `_expect()` method — neither is part of the public `Locator` TypeScript type, so there's no compile-time contract protecting this. A future Playwright version could rename or restructure these without a type error warning us, silently breaking every assertion in a wrapped suite. `EirPage` has the same exposure for `_apiName` alone: `expect(page).toHaveURL()`/`.toHaveTitle()` route their actual polling through `page.mainFrame()._expect(...)` (a plain pass-through returning the real `Frame`), so `EirPage` only needs `_apiName` forwarded, not `_expect` — confirmed by a second spike. **Known gap, not yet covered:** `expect(page).toHaveScreenshot()` calls a third private method, `page._expectScreenshot(...)`, not forwarded by `EirPage` and not spiked — untested, since the reference suite doesn't use visual-regression assertions.
**Mitigation:** Confirmed working via throwaway spikes (Locator success path + failure-path error-message parity; Page `toHaveURL`/`toHaveTitle`) before committing to the design. Each cast is narrow, isolated to one spot, and commented. The invisibility proof (this phase's own gate) and CI on every future Playwright version bump are the ongoing detection mechanism — not a one-time check. Add `_expectScreenshot` forwarding to `EirPage` if/when a suite using `toHaveScreenshot` needs to pass through Eir.

**B2 disposition (1.0.0 closure, 2026-07-17):** a real spike (not assumed) against a live Chromium browser found the gap was deeper than this note anticipated — `toHaveScreenshot()`'s real implementation reaches into private internals *two different ways* depending on the receiver: `expect(page).toHaveScreenshot()` calls `page._expectScreenshot(...)` directly (confirmed: `TypeError: page._expectScreenshot is not a function` before the fix); `expect(locator).toHaveScreenshot()` calls the real page's `_expectScreenshot`, but passes the *locator* through as an option field, which reads `.locator._frame._channel`/`.locator._selector` directly (confirmed: `TypeError: Cannot read properties of undefined (reading '_channel')` before the fix — the same class of bug as RISK-005/NOTE-009, but on a boundary this package can't intercept and unwrap, since it's Playwright's own matcher code, not a method call of ours). Fixed by forwarding `_expectScreenshot` on `EirPage` and `_frame`/`_selector` on `EirLocator` — the same narrow, single-cast pattern already established for `_apiName`/`_expect`. Both paths now genuinely work, verified via real screenshot comparisons (not just first-write): `packages/demo-app/tests/eir-proof/screenshot-assertions.spec.ts`. RISK-003's overall stance — this package knowingly forwards a small set of undocumented Playwright internals, and CI against the pinned peer range is the ongoing tripwire, not a one-time check — is now stated explicitly in `README.md`'s Known Limitations.

### RISK-004 — Capture-point coverage stops at Blueprint §7.1's named 6 methods
**Status:** WATCHING
**Raised:** 2026-07-06, during Phase 2 wrapper-class design
**Phase affected:** Phase 2 (introduced), Phase 3 (fingerprint coverage inherited)
**Risk:** `EirLocator`/`EirPage` only extend `chainPath`/wrap the return value for the exact 6 methods Blueprint §7.1 names (`locator`, `getByRole`, `getByLabel`, `getByText`, `getByTestId`, `getByPlaceholder`). Chaining through any other Locator-returning method (`filter`, `first`, `last`, `and`, `or`, `normalize`, `contentFrame`, `getByAltText`, `getByTitle`) returns the real, unwrapped `Locator` — that branch silently stops being tracked (no capture log, no future fingerprinting) even though it still behaves correctly as vanilla Playwright.
**Mitigation:** Not currently exercised — the reference suite uses none of these methods. Revisit and widen the capture-point list if a future suite (benchmark or real-world adoption) relies on one of them.

**Phase 9 disposition (2026-07-16):** documented, not fixed — per the ledger-triage gate, this is a "document, not fix" item. The README's "what Eir sees" section (Session 2) will state plainly that `filter`/`first`/`last`/`and`/`or`/`getByAltText`/`getByTitle`/`contentFrame` are untracked passthroughs, so an adopter knows the exact boundary rather than discovering it by surprise.

### RISK-007 — Post-success fingerprint capture loses every navigational action (resolved, kept for context)
**Status:** MITIGATED
**Raised:** 2026-07-06, during Phase 3 wiring (integration run against the demo app)
**Phase affected:** Phase 3
**Risk:** Capture was originally wired to start strictly *after* an imperative action resolved (`click()` awaited, then `evaluate()` on the same real element). For any action that navigates the page away (the login page's "Sign In" submit, dashboard nav-sidebar links), the element — and its whole document — is destroyed before that post-success `evaluate()` call can reach it. Confirmed via a full 15-spec reference-suite run: the login button's fingerprint was deterministically absent every time, not flaky. Every navigational selector in the suite would have silently never been captured.
**Mitigation:** Start the `captureFingerprint()` browser round-trip *concurrently with the action* instead of after it, while the element is still guaranteed to exist; only *record* the result into the store once the action's own success is confirmed (see `EirLocator#recordCapture`). This is a deliberate, documented reinterpretation of Blueprint §7.2's "after a successful action" as "conditioned on success," not "temporally after" — edited into BLUEPRINT.md and EIR_BLUEPRINT_APPROACH.md directly (see §6 Changelog) rather than left as silent drift. Verified via 3 repeated full-suite runs: deterministic capture of the previously-lost selector, no change to any action's own pass/fail behavior or timing, no new errors.

### RISK-008 — Selector-normalization templating collapsed distinct static selectors into one key (resolved, kept for context)
**Status:** MITIGATED
**Raised:** 2026-07-06/07, during Phase 3 wiring (4-worker vs 1-worker consistency check against the demo app)
**Phase affected:** Phase 3
**Risk:** As originally built, `normalizeSelector` templated *any* `getByText`/`getByLabel`/`getByPlaceholder` literal and `getByRole`'s `options.name` into `{TEXT}`, on the theory that a varying literal always means the same parameterized selector reused with different runtime values (the f-string case Blueprint §7.3 actually describes for hand-built `locator()` XPath strings). In practice, most such calls are simply *different, static, hardcoded* selectors that happen to share a method — a wrapper only ever sees `{ method, args }`, with no way to tell the two cases apart. Confirmed two distinct real bugs from this: (1) `getByLabel("Requested By")` and `getByLabel("Duration")` — two different form fields on `/dashboard/requests/new` — collapsed to one store key, silently overwritten depending on execution order (surfaced as a 1-worker-vs-4-worker content mismatch, not just reordering); (2) worse, `getByRole("link"/"button", {name})` collapsed *four or five distinct nav links/buttons per route* down to a single entry, deterministically every run (same-spec sequential ordering hid it from the worker-count diff check — only inspecting file contents directly revealed it).
**Mitigation:** Templating is now scoped to exactly what Blueprint §7.3 names by example: a text literal embedded *inside a hand-constructed selector string* passed to `locator()` (the XPath `normalize-space()='...'`/`text()='...'`/`contains(text(),...)` shapes). Every other method's literal argument — `getByText`, `getByLabel`, `getByPlaceholder`, `getByRole`'s `name`, `getByTestId` — is kept as-is in the key, never templated. Verified via repeated 1-worker/4-worker runs producing byte-identical `.eir/routes/*.json`, and by direct inspection confirming every distinct selector (all nav links, both row-action buttons, both wizard-navigation buttons, both form-field labels) now gets its own entry.

### RISK-006 — `EirPage#removeAllListeners` needed hand-written overloads (resolved, kept for context)
**Status:** MITIGATED
**Raised:** 2026-07-06, during Phase 2 wrapper-class implementation
**Phase affected:** Phase 2
**Risk:** `Page.removeAllListeners` has two overloads with genuinely different return types — `(type?: string): this` for the common no-argument/single-argument case, and `(type, options): Promise<void>` for the rare `{ behavior: "wait" | "ignoreErrors" | "default" }` form. `Parameters<>`/`ReturnType<>` collapse to one overload, so the mechanical pattern used everywhere else in `eirPage.ts`/`eirLocator.ts` can't express this member. A first attempt suppressed the mismatch with `@ts-expect-error`, but that only silences the error at the declaration site — it resurfaced at every other place `EirPage` gets used as `Page` (e.g. the fixture), since each is a fresh structural comparison.
**Mitigation:** Hand-wrote the 2 overload signatures directly on `removeAllListeners` (cheap at this scale, unlike the 19-signature event methods), with a single broader implementation signature (`(...args): this | Promise<void>`) that branches on argument count to return the right shape. This is a real, permanent fix, not a suppression — `tsc` now verifies it structurally everywhere `EirPage` is used as `Page`.

### RISK-005 — Real Playwright methods that take a `Locator` argument may not accept an `EirLocator`
**Status:** WATCHING
**Raised:** 2026-07-06, during Phase 2 wrapper-class design
**Phase affected:** Phase 2 (introduced)
**Risk:** Methods like `.and(other)`, `.or(other)`, `dragTo(target)`, or `locator(sel, { has: other })` expect a real Playwright `Locator` and may reach into private internal state beyond `_apiName`/`_expect` (the only two members `EirLocator` forwards). Passing an `EirLocator` in one of these argument positions is untested and could fail in ways the current invisibility proof wouldn't catch, since the reference suite doesn't exercise them.
**Mitigation:** Not currently exercised — no spec in the reference suite uses these APIs. Flagged so it isn't discovered by surprise if a future spec (or a real adopting suite) does.

**Phase 9 disposition (2026-07-16):** confirmed as a real, reproducible bug, not a theoretical risk — read Playwright's own client source (`playwright-core@1.61.1`): `.and()`/`.or()`/`.locator(sel, {has})` read a real `Locator`'s private `_frame`/`_selector` fields directly; `EirLocator` never unwraps an `EirLocator` argument back to the real `Locator` it wraps, so these throw `"Locators must belong to the same frame"` synchronously (`.dragTo()` fails differently, on `undefined._selector`). `packages/demo-app/tests/eir-proof/locator-as-argument.spec.ts` is a committed characterization test proving this today (asserts the current throw, so it stays informative in CI rather than permanently red). The actual fix — an internal unwrap-if-`EirLocator` step in `and`/`or`/`dragTo`/`locator` — is real design work, not attempted this session; tracked fresh as **NOTE-009**. Documented as a known limitation in the README (Session 2): don't pass an `EirLocator` where Playwright expects a real `Locator`.

### RISK-010 — `dom-count-change`'s page-wide element count is occasionally non-deterministic
**Status:** WATCHING
**Raised:** 2026-07-11, during Phase 6's own DoD verification (running the reference suite twice in a row to check for a zero-diff baseline, the same proof Phase 3 required for fingerprints)
**Phase affected:** Phase 6 (NOTE-001 retrofit)
**Risk:** `PostCondition`'s `dom-count-change` signal (`capture/pagePulse.ts`) counts every element on the page (`document.querySelectorAll("*").length`) before and after an action. Two back-to-back, otherwise-identical reference-suite runs produced a different stored post-condition for the wizard's `getByTestId("wizard-next")` button — `"none"` on one run, `"dom-count-change": "decreased"` on the other — the one non-deterministic entry among six route files' worth of captures. The page-wide count is coarse enough to pick up incidental render noise (something transient — an animation frame, a focus-ring element, a timing-sensitive re-render) unrelated to the action's actual, meaningful effect. `route-change` (binary) and the single-element `Fingerprint` scorers are unaffected; this is specific to the page-wide counting approach.
**Mitigation:** Not fixed this phase — the asymmetry this project cares about most (P4, false heals) isn't violated: a flaky stored post-condition can only make heal-and-continue's retry verification *more* conservative (an occasional spurious mismatch downgrades a genuinely-good heal to a suggestion), never less safe. Recorded here rather than papered over. If it proves disruptive in practice, candidate fixes include scoping the count to a smaller DOM subtree (e.g. the acted-on element's container) or debouncing the "after" pulse with a short settle wait — neither implemented, both would need their own Understanding Gate.

### RISK-011 — `classifyFailureSpecies` misses zero-match when no `actionTimeout` is configured
**Status:** MITIGATED — fully, including the general engine gap (Phase 9, 2026-07-16; previously mitigated only for this repo's own reference suite)
**Raised:** 2026-07-12, during Phase 7, while generating real `eir-report.json` data for the PR-comment mockup
**Phase affected:** Phase 5 (introduced, `triage/failureSpecies.ts`), Phase 7 (discovered — blocked the dogfood workflow's core mechanism until fixed)
**Risk:** `classifyFailureSpecies` (`packages/eir/src/triage/failureSpecies.ts`) classifies zero-match by checking the caught error's message for the literal substring `"Timeout"` (capital T) — the shape Playwright produces for a *bounded action timeout* (`use.actionTimeout`). If a suite has no `actionTimeout` configured, a vanished locator's `fill()`/`click()`/etc. retries unboundedly until Playwright's own *test-level* timeout kills it instead, producing `"Test timeout of 30000ms exceeded."` (lowercase "timeout") — a message `classifyFailureSpecies` classifies as `"unknown"`, which Gate 3 then rejects as not heal-eligible. Net effect: on a suite without `actionTimeout` set, Eir's entire triage/match/report pipeline silently never engages on a real, ordinary broken selector — confirmed live against `packages/demo-app`'s reference suite (an `id-rename` mutation against a real fingerprinted selector produced zero `eir-report.json` rows and a bare Playwright test-timeout failure, with no Eir signal anywhere). `packages/benchmark`'s own probe config already sets `actionTimeout: 5_000`, which is exactly why its results never exposed this gap before.
**Mitigation:** `packages/demo-app/playwright.config.ts` now sets `actionTimeout: 5_000`, matching the benchmark's config — the reference suite (and Phase 7's dogfood workflow, which depends on it) now correctly exercises triage on a real broken selector. This is a demo-app config fix, not an engine change. **Not fixed at the engine level**: `classifyFailureSpecies`'s message-shape detection is still coupled to a specific Playwright config assumption (`actionTimeout` being set) that isn't documented anywhere as a prerequisite for Eir to function on real failures. A real adopting suite without `actionTimeout` configured — plausibly the common case, since Playwright doesn't set one by default — would hit this exact silent gap. Widening `classifyFailureSpecies` to also recognize the test-level timeout message shape (or documenting `actionTimeout` as a stated Eir prerequisite in the README/install docs) is real follow-up work, out of scope for Phase 7 (no engine changes this phase) — candidate for Phase 9 hardening or a README caveat.

**Phase 9 engine-level fix (2026-07-16):** `classifyFailureSpecies` (`packages/eir/src/triage/failureSpecies.ts`) widened its timeout check from a case-sensitive `message.includes("Timeout")` to a case-insensitive `message.toLowerCase().includes("timeout")` — this now also recognizes `"Test timeout of ${n}ms exceeded."` (the message shape produced when no `actionTimeout` is configured and the action retries until the *test's own* timeout kills it), which the original check missed entirely. The function only ever runs on an already-caught action-call error, so widening the match doesn't risk misclassifying an unrelated failure. Unit-tested (`failureSpecies.test.ts`). `actionTimeout` remains a *recommended* config (faster triage — 5s vs. a full test timeout, often 30s+) rather than a hard prerequisite, and is still called out plainly in the README (Session 2) since faster detection matters even though the silent-failure gap itself is closed.

### RISK-009 — `sibling-reorder`-class breakage is invisible to Eir's own failure-triage layer
**Status:** MITIGATED (partial — see Phase 6 update below; not fully closed)
**Raised:** 2026-07-07, during Phase 4 mutation-taxonomy design
**Phase affected:** Phase 4 (discovered), Phase 5 (matching engine — the actual place this would need addressing)
**Risk:** Blueprint §7.4's failure triage only ever considers *zero-match* and *detached* as heal-eligible failure species — both require the action to actually throw. A position-anchored selector (`locator("tbody tr:nth-child(1)")`) mutated by `sibling-reorder` doesn't throw at all after the DOM reorders: the CSS selector still resolves to *some* `<tr>`, the click/fill still succeeds, and Eir's own outcome log records a plain `OK`. The drift is only visible to something that separately asserts on the resolved element's *content* — which the benchmark's probe does (that's how `sibling-reorder`'s targets classify correctly as `missed` at the benchmark level in `packages/benchmark/src/targets.ts`), but Eir's own engine has no equivalent check and would sail straight through a real occurrence of this today, with no signal that anything changed.
**Mitigation:** Not a Phase 4 problem to fix — Phase 4's job was only to prove the mutation exists and classify it, which it does, honestly, via the benchmark's own assertions rather than Eir's triage layer. Flagged here so Phase 5's failure-species list (currently just zero-match/detached) is designed with this gap in view — a "resolved but plausibly wrong element" species may need its own detection heuristic (e.g., comparing the resolved element's captured feature set against its last-known fingerprint even on a nominally successful action) rather than assuming a thrown error is the only signal worth triaging.

**Phase 6 update (2026-07-11):** Mechanism B (NOTE-001's retrofit) implements exactly the detection heuristic proposed above — `checkSelfSimilarity` compares an ordinary success's fresh capture against its stored baseline, flagging `drift-suspected` on a low score. Real measured evidence (`packages/benchmark/reports/note001-heal-evidence-sibling-reorder.md`, seed 42): fires correctly on all 4 targets whose action Eir actually wraps (self-similarity 0.6471, below the 0.7 bar) — a genuine, measured close of this risk's core scenario. **Not fully closed**, honestly: the other 4 targets in this same class either drive a plain-pass-through Playwright call (`getAttribute`, never wrapped by Eir at all — see RISK-004) or a selector chain with no pre-existing captured baseline to compare against, and produce no signal either way. Downgraded from WATCHING to MITIGATED (partial), not RESOLVED — the remaining gap is real and belongs to RISK-004's territory (capture-point/wrapped-surface coverage), not a new mechanism.

**B3 disposition (1.0.0 closure, 2026-07-17):** audit §13 #6 observed that CI's per-push bench smoke step only ever ran `id-rename`, never touching the one class with a known, only-partially-closed detection gap. `.github/workflows/ci.yml` now runs `sibling-reorder` as a second smoke class alongside `id-rename` — cheap (100% miss, no matching work to do) and now gives every push at least one touch on this class, rather than relying solely on the manually-run full 8-class baseline to exercise it.

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

### 2026-07-04 — Phase 0, all work items (1–6)
- Did: pnpm workspace scaffold (eir/demo-app/benchmark/ci-action), strict tsconfig + ESLint + Prettier + Vitest, GitHub Actions CI, `packages/eir` package.json (peer dep on `@playwright/test`, exports map), `eirVersion()` stub, published `playwright-eir@0.0.1`. Merged via PR #2 (scaffolding) and PR #3 (LICENSE fix). Tagged `phase-0-done`.
- Blocked/open: none carried forward from Phase 0 itself; NOTE-001/NOTE-002 remain DUE at their existing target phases (untouched this session).
- CI: green (main: 2/2 runs green after both merges)
- Next: Phase 1 — Demo App + Reference Suite (Ward). Starts with its Pre-Phase TS Tip.

### 2026-07-05 — Phase 1, all work items (1–4)
- Did: scaffolded Ward (React+Vite): login, dashboard nav, devices table (two similar tables), provisioning form (label-for select), account delete modal, hash-routed 3-step wizard. Centralized every id/testid/class in `src/domProfile.ts`. Wrote 14-spec vanilla-Playwright reference suite (7 POM-style, 7 linear-style) with deliberately mixed selector quality. Wired CI to install Chromium and run `pnpm --filter demo-app e2e`. Cross-checked NOTE-002's Phase-4 prerequisite (near-duplicate pairs already present in table/button/form-field shapes — see NOTE-002).
- Blocked/open: none. NOTE-001 remains DUE at its existing target phase, untouched.
- CI: pending first run on PR (local: lint/typecheck/e2e all green, 14/14 specs passing twice in a row, 4 workers)
- Next: Phase 2 — Interception Shell. Starts with its Pre-Phase TS Tip (classes/`implements`).

### 2026-07-06 — Phase 2, all work items (1–7)
- Did: fixture override (`base.extend` on `page`) plus explicit composition wrapper classes `EirPage`/`EirLocator` (Q3-B, no Proxy) over Blueprint §7.1's full interception surface — 6 capture points (wrap return value, extend `chainPath`), 11 imperative outcomes (try/catch shell + `EIR_DEBUG=1` logging), 4 interrogatives (structurally untouched, zero logging), full remaining `Locator`/`Page` surface as verified pass-throughs. Selector-identity plumbing (`rawSelector`/`chainPath`/`routeAtCreation`) populated, unread until Phase 3. Two spikes (deleted, not shipped) confirmed `expect(locator)`/`expect(page)` work via narrow `_apiName`/`_expect` forwarding before committing to the design. ~20 overloaded/generic Playwright methods needed full-property typing instead of `Parameters<>`/`ReturnType<>` (Aayush-approved). 24 Vitest unit tests. Invisibility proof: 15-spec suite (14 Phase 1 + 1 new auto-wait regression spec) run 3×2, vanilla vs wrapped — identical pass/fail, ~0.7% timing delta, auto-wait spec green wrapped (`packages/eir/docs/invisibility.md`). Published `playwright-eir@0.1.0`. Logged NOTES.md RISK-003 through RISK-006 for design boundaries surfaced along the way (undocumented internals, capture-point scope limit, Locator-as-argument, `removeAllListeners`'s split-return overload).
- Blocked/open: none. NOTE-001/NOTE-002 remain DUE at their existing target phases, untouched. RISK-003 through RISK-006 are WATCHING/MITIGATED, not blocking.
- CI: green (PR #6 — wrapper/proof; PR #7 — version bump). Both merged to main.
- Next: Phase 3 — Fingerprint Capture & Store. Starts with its Pre-Phase TS Tip (`unknown` at the browser boundary).

### 2026-07-07 — Phase 3, all work items (1–6)
- Did: fingerprint schema decided and signed off (`docs/fingerprint-schema.md`) before any code. In-page capture (`capture/rawExtract.ts`, self-contained, no module-scope references — a real `ReferenceError` from an early mistake confirmed why) plus five small Node-side pure shaping functions (attrs allow-list, class filter, text truncation, bbox quantization), assembled behind an `unknown`-boundary type predicate in `captureFingerprint.ts`. Route + selector normalizers — selector templating ended up scoped to only the Blueprint-named XPath-embedded-literal case, after two rounds of live-run discovery (see below). Fingerprint store: one JSON file per route, key-sorted, atomic writes, per-worker shards merged deterministically in a new `playwright-eir/globalTeardown` export; the merge itself is a pure, disk-independent function. Capture wired into all 11 imperative outcome shells, started concurrently with the action rather than strictly after (a deliberate, documented reinterpretation of Blueprint §7.2). Reference suite permanently swapped from `@playwright/test` to `playwright-eir`; `.eir/routes/*.json` committed as the first calibration baseline (6 files, ~26 KB).
- Two real bugs surfaced and fixed during integration testing against the demo app, not just imagined edge cases: (1) post-success capture silently lost every navigational selector (login submit, nav links) because the element's document was destroyed before the fire-and-forget `evaluate()` ran — fixed by starting capture concurrently with the action; (2) selector-normalization templating collapsed distinct static selectors sharing a method (`getByLabel("Requested By")` vs `getByLabel("Duration")`; four different `getByRole` nav links) into one store key, silently overwriting one fingerprint with another — fixed by scoping templating to only the XPath-embedded-literal case Blueprint actually names. Both logged as NOTES.md RISK-007/RISK-008 (mitigated), both required editing BLUEPRINT.md/EIR_BLUEPRINT_APPROACH.md wording deliberately rather than silently drifting from it.
- All DoD proofs run for real: green suite → `.eir/routes/*.json` with all specs' selectors present; second identical run → zero diff; deliberate label-text change → minimal single-field diff; 4-worker parallel run → no corruption, byte-identical to a 1-worker run; store size ~26 KB (envelope is 500 KB); 137 Vitest unit tests green (up from 24 at Phase 2 close).
- Blocked/open: none. NOTE-001/NOTE-002 remain DUE at their existing target phases, untouched.
- CI: green (PR #9). Not yet merged — awaiting Aayush's go.
- Next: Phase 4 — Mutation Engine & Benchmark Harness. Starts with its Pre-Phase TS Tip (discriminated unions for outcome classes).

### 2026-07-07 — Phase 4, all work items (1–6)
- Did: mutation taxonomy against Ward — Blueprint §7.8's six classes plus NOTE-002's `near-duplicate-sibling-swap` (formally adopted this session) and `compound-release`, eight classes total. Mutations are applied via a small, permanent, additive override module in `demo-app` (`src/mutation/overrides.ts`), read from `VITE_EIR_MUTATIONS` — unset (the default everywhere except the benchmark harness) it's a pure pass-through, verified against the full 15-spec reference suite and a byte-identical `.eir/routes/` diff. The harness's own probe specs use *frozen* selector literals rather than a live `domProfile` import, deliberately — mutating `domProfile.ts` directly would let both app and test drift together and never observe breakage (the domProfile-double-import trap, caught during design before any code). `packages/benchmark` (target registry ≥8 selectors/class, seeded PRNG for near-dup direction/compound mix, ground-truth emission, dev-server-orchestrating harness runner, report generator with a generic `groupBy`, CLI) runs end-to-end: `pnpm bench --class <c> --seed <n>` and `pnpm bench --all`.
- Four real bugs surfaced and fixed during live verification, not just imagined edge cases: (1) the harness's shared `login()` helper used domProfile-driven selectors, so the first id-rename target to mutate a login field broke login for every *other* target in the same run; (2) `wrapper-inject`'s parent-detection XPath first tried a uniform "bare `<div>`" check, which broke the *control* run for every target since several of Ward's real containers are themselves already plain divs — fixed by naming each target's actual natural parent instead; (3) Playwright's `getByRole`/`getByText` default to substring matching, so several `text-change` mutations silently kept matching the frozen query — fixed with `exact: true`; (4) `ProvisioningPage`'s submit button had no tag-swap wiring at all. A fifth, structural bug (compound-release's outcomes reported under their *origin* classes instead of their own row, discovered on the first full 8-class baseline run) is logged separately below since it's a design-level finding, not a target-registry typo.
- Baseline committed (`pnpm bench:all --seed 42`): all 8 classes, 100% miss / 0% heal / 0% false-heal / 0% suggestion — the correct, expected result, since no matcher exists yet (Phase 5). Reproducibility proven directly: two independent runs of the same (class, seed) diffed byte-identical once `generatedAt` is excluded.
- All DoD proofs run for real: `pnpm bench --class id-rename --seed 42` run twice, byte-identical; all 8 classes' target counts ≥8 in the registry (`targets.test.ts`) and confirmed in the committed baseline table; ground truth emitted and validated per class (`groundTruth.test.ts`); 70 Vitest unit tests green in `packages/benchmark`; CI runs one fast bench class after the e2e step.
- Blocked/open: NOTE-001 remains DUE at its existing target phase (Phase 5), untouched. New RISK-009 logged (below) — a design-level gap discovered while building `sibling-reorder`, not a bug fixed this phase.
- CI: green, PR pending.
- Next: Phase 5 — Matching Engine & Failure Triage. Starts with its Pre-Phase TS Tip (pure functions + `readonly`).

### 2026-07-12 — Phase 7, all work items (1–4)
- Did: `packages/ci-action` (zero runtime deps — plain `fetch`, no `@actions/github`) reads `eir-report.json` and upserts a single PR comment by an invisible `<!-- eir-report:v1 -->` marker (route-led summary, per-selector diffs, confidence; screenshots linked via a workflow artifact, never inlined). Wired into `.github/workflows/ci.yml` on every `pull_request`, `permissions: pull-requests: write` declared explicitly. `docs/ci.md` is the adopter-facing writeup, including the two honesty constraints (RISK-009 coverage limits, NOTE-004 verification ambiguity) plus a third discovered live this session (screenshot linking). Dogfood mechanism: one `ci.yml` step, scoped to an exact branch name, applies a real seeded `id-rename` mutation via a new small CLI (`packages/benchmark/src/printMutationPayload.ts`, reusing `buildMutationRun`) — every other branch's `VITE_EIR_MUTATIONS` stays unset.
- Two real bugs surfaced and fixed live, not just imagined edge cases: (1) `demo-app/playwright.config.ts` had no `actionTimeout`, so a broken selector ran out the *test's* 30s timeout instead of Playwright's bounded action timeout, and `classifyFailureSpecies` never recognized that message shape as zero-match — Eir's own triage was silently dead on the reference suite until this session (RISK-011); (2) screenshots were first designed as inlined `data:` URI `<img>` tags (matching the signed-off mockup); a real posted PR comment's rendered HTML proved GitHub's sanitizer strips `data:` image sources entirely — fixed by uploading the report as a workflow artifact and linking the run instead, which also turned out to match the approach doc's own original "screenshot links" wording more closely than the first attempt did.
- Both Understanding Gates run and confirmed (upsert-not-append; token/permission model). Comment mockup shown as a published Artifact, built from real `eir-report.json` data (not invented numbers), signed off with one wording change (route count leads the summary).
- All DoD proofs run for real, not simulated: dogfood PR #15 shows 6 real suggestion diffs (3 broken selectors × CI's parallel-worker retry) with confidence scores and a working artifact link (verified via the GitHub API's `body_html`, not just raw markdown); a second and third push to the same PR updated the same comment ID (4951798347) rather than duplicating it; the feature PR #14's own CI run proved the no-heals path (`skipped-no-findings`, zero comments posted) live rather than only unit-tested. `docs/ci.md`'s snippet is a literal copy of `ci.yml`, verified via four green/expected-red CI runs across both PRs — not separately tested from an external fork (judged disproportionate given the live-repo evidence; noted honestly, not silently skipped).
- NOTES.md: RISK-011 (actionTimeout gap), NOTE-005 (Phase 9 carry-forward for Mechanism A's unexercised real-catch path, added at session open), NOTE-006 (Marketplace publication, explicitly parked by the approach doc's own OUT list).
- Blocked/open: the "existing comment updates to clean state" branch of the no-heals design is unit-tested but wasn't separately exercised live this session (no PR here ever had findings *then* lost them) — worth knowing, not blocking.
- CI: green on PR #14 (real code); PR #15 (dogfood demo) intentionally red — 3 real tests fail because the mutation is real, `suggest-only` never retries, and that's the honest, correct behavior being demonstrated.
- Next: Phase 8 — Gemini Fallback + Comparison Benchmark. Starts with its Pre-Phase TS Tip (typed async boundaries and schema validation).

### 2026-07-15 — Phase 8, all work items (1–5)
- Did: three Understanding Gates run and passed (trigger predicate — mode-independent, reads the same 0.7/0.05 bars as policy; suggestion-cap — structural via verdict-type shape + sequencing, not a check; ReportRow extend-vs-within — extend, deliberately, provenance is structure not wording). zod added to `packages/eir` (first runtime dep, justified). Built `packages/eir/src/fallback/`: `trigger.ts` (`isFormallyUncertain`), `verdict.ts` (zod `WireVerdictSchema`, discriminated `ProviderVerdict`/`FallbackOutcome`), `prompt.ts` (pure builder, fingerprint+shortlist only), `provider.ts`/`geminiProvider.ts`/`nullProvider.ts` (the seam), `runFallback.ts` (`buildFallbackRunner` — off by default, clean no-key skip). Wired into `MatchAttempt.shortlist`, `MatchingContext.fallback`, `EirConfig.fallback`, `EirLocator`'s non-heal branch only, `HealAttemptEvent.fallback`, `ReportRow.fallback`; ci-action validator/renderer updated with explicit less-trusted wording. PR #16, CI green without any key present.
- Cost Gate: presented and signed off before any real call (21 predicted invocations/run, `gemini-2.5-flash-lite`, ≈$0.003/run, <$0.02 session budget). Smoke test passed end-to-end before the full run.
- Comparison benchmark: reused the committed heuristics-only baseline (suggestion-cap makes a rerun there structurally redundant) and added one real run per class with the fallback opted in. Five real runs total, 74 invocation attempts across two API keys: trigger census (21/run) confirmed twice exactly; 17 real responses, **100% endorsed** (zero contradictions, zero corrections, including on the near-dup adversarial class); 57 attempts degraded cleanly to `no-verdict` on real `http-429`/`http-503` — a genuine free-tier reliability ceiling, not an engine defect (logged as NOTE-007). A real process mistake — reran the CLI without preserving the richest run's output file first — cost the per-invocation detail from that run (aggregate numbers recovered from the session transcript instead); logged as NOTE-008 (evidence CLIs have no overwrite protection).
- `docs/hybrid-comparison.md` states the honest verdict: no measured accuracy benefit on any of the 8 classes, plus the free-tier reliability finding; recommends leaving the fallback disabled by default.
- Blocked/open: none blocking. NOTE-004 retargeted to Phase 9 (its own text named this phase's report-shape revisit as the trigger). RISK-002 resolved — did not materialize, full scope delivered.
- CI: green on PR #16, confirmed keyless (no `GEMINI_API_KEY` anywhere in this repo or its workflow file).
- Next: Phase 9 — Hardening, Docs, Release.

### 2026-07-16 — Phase 9, Session 1 (ledger triage + NOTE-005 + acceptance sweep)
- Did: judged Phase 9 too large for one session up front (per the session's own instruction) and proposed the natural split — session 1: ledger triage, NOTE-005, acceptance sweep, cheap fixes; session 2: README, demo path, external test, release, career artifacts. Confirmed. Ran the Pre-Phase TS Tip (built `dist/`, read all three public entry points' `.d.ts` — clean, one minor open question flagged for the README pass: whether `eirVersion()` should stay in the public API). Ran the batched ledger-triage gate (all 12 items proposed at once, approved as proposed).
- Fixed (not just documented, per the triage): **RISK-011** — `classifyFailureSpecies` widened to case-insensitive timeout detection, closing the silent-triage-death gap for adopters without `actionTimeout` configured, engine-level this time (not just the demo-app config workaround from Phase 7). **NOTE-004** — `RetryOutcome`'s `"healed"` variant now distinguishes `verified`/`skipped-none`/`skipped-no-baseline`, threaded through the reporter and `ci-action`. **NOTE-008** — evidence CLIs refuse to overwrite an existing report without `--force`. **RISK-005** — confirmed as a real bug (not theoretical) via `playwright-core`'s own source; landed a committed characterization test proving it; the actual unwrap fix parked fresh as **NOTE-009** (real design work, not a same-session patch). **NOTE-012** (new, from a Phase 8 review finding) — `docs/hybrid-comparison.md` now states the fallback trigger's exact scope (`"matched"`-only) explicitly, closing the risk of over-generalizing "no benefit" to true misses.
- **NOTE-005 (the mandatory one):** built a real, live false-heal demonstration — `packages/eir/src/acceptance/note005RealFalseHeal.test.ts`. A real Chromium browser (via `@playwright/test`, now a devDependency of `packages/eir` too), a real HTTP-served page, the real unmocked matching funnel, and a real `EirLocator` retry. A near-duplicate button pair (Login/Signup's own motivating shape): the real target is calibrated, removed, and a structurally similar distractor with a genuinely different real effect is left in its place. With a deliberately permissive `healThreshold` (0.2 — stated explicitly as not a claim about the shipped 0.7 default, which still measures 0% false-heal), the real matcher confidently heals to the distractor (measured confidence ≈0.5602), the retry genuinely executes against it, and Mechanism A genuinely catches the mismatch and downgrades to `heal-rejected-post-condition-mismatch`. Required moving CI's Chromium install earlier (before `pnpm test`, not just before the demo-app e2e step).
- §9.2 acceptance sweep: compiled `docs/acceptance-sweep.md`, linking every criterion to a proving test. Two were already fully proven (happy-path invisibility, suggest-only never retries); two had partial proof upgraded to a direct comparison or automated check (`neverFingerprintedFailsVanilla.test.ts`, `storeSizeEnvelope.test.ts`); one had no automated proof at all and got one (`noSourceWrites.test.ts`, a structural scan asserting every fs write call in `packages/eir/src` is confined to four already-audited files). Parallel-worker integrity (#7) was freshly re-run this session (1 vs. 4 workers against the real reference suite) rather than relying only on Phase 3's original manual proof: every fingerprint file byte-identical; RISK-010's already-documented post-condition non-determinism reproduced exactly as described, confirmed independent of worker count.
- Documented-not-fixed items confirmed per the triage, each getting a Phase 9 disposition note in its own entry above: RISK-004 (capture-point coverage), NOTE-003 (class-shuffle ceiling), NOTE-007 (Gemini reliability), NOTE-006 (Marketplace, confirmed still parked). Two Phase 7 niceties formally deferred with fresh IDs: NOTE-010 (`docs/ci.md` external-fork verification) and NOTE-011 (no-heals clean-state branch never exercised live).
- All work on branch `phase-9-hardening-ledger-triage-2026-07-16`, five scoped commits so far, CI not yet pushed this session.
- Blocked/open: none. Zero silently-open ledger items — every one of the 12 has a disposition and, where deferred, a NOTE-### tracking it forward.
- CI: green locally (`pnpm lint && pnpm typecheck && pnpm test`, all 5 workspace packages) — not yet pushed/observed on GitHub Actions this session.
- Next: Phase 9, Session 2 — README draft + rendered review, demo path timed from a clean clone, external clean-project npm-install test, release (version decision, publish, GitHub release), career artifacts, closing TS tip, `phase-9-done`/`project-done` tags.

### 2026-07-16 — Phase 9, Session 2 (README, demo path, external test, release, career artifacts, closing TS tip)
- Did: fixed a real doc/code inconsistency found while gathering README material — `packages/eir/src/index.ts`'s comment claimed the public API is "exactly three things" (`test`/`expect`/`defineEirConfig`) but `eirVersion()` is also exported and tested (Session 1's Pre-Phase TS Tip open question); comment now names all four honestly. Wrote the root `README.md` (what/why, install, loud RISK-011 prerequisites, the honest results table with per-class failure-mode analysis, Mechanism A's real-catch demonstration, the hybrid-fallback verdict with NOTE-012's exact trigger-scope boundary, config reference, architecture sketch, every ledger-triage known limitation) and rewrote the stale `packages/eir/README.md` (npm's actual registry page — was a 3-line "under active development" stub) as a condensed version linking back to GitHub. Rendered both as an Artifact for review; approved by Aayush with no cuts or softening requested.
- Demo path: scripted `demo/README.md` (clone → install → build → green calibration → seeded `id-rename` mutation → suggestion in `eir-report.md`) and actually executed it end-to-end from a genuine fresh `git clone` into a scratch dir — not simulated. Real measured time: **~20 seconds** (clone <1s, install <1s, build ~2s, green run ~6s, mutation+rerun ~11s), comfortably under the 3-minute bar. Stated the honest caveat plainly in the README: this machine's pnpm/Playwright caches were already warm and the clone was local rather than over a network — a genuinely cold first run adds unmeasured, network-dependent time (registry resolution, one-time Chromium download), which is standard for any Playwright project and wasn't isolated by this measurement.
- External clean-project test: scaffolded a throwaway TS project (`npm`, not `pnpm`) entirely outside this monorepo, `npm i -D @playwright/test playwright-eir@0.2.0` (the real, then-current registry package), `strict`/`noUncheckedIndexedAccess` tsconfig with NodeNext ESM resolution, a spec doing the one-line import swap. `npx tsc --noEmit` — zero errors, types resolve cleanly through the exports map. `npx playwright test` — passed, produced a real `.eir/routes/blank.json` fingerprint and `eir-report/eir-report.md`. The documented `actionTimeout` prerequisite, alone, was sufficient. **Zero packaging friction found — no release blocker.**
- Release: presented 0.3.0-vs-1.0.0 with reasoning via a gated question; Aayush chose **0.3.0** — real, substantial additions since 0.2.0 (CI integration, opt-in Gemini fallback, Phase 9 hardening/docs) justify a minor bump, but two open API-surface gaps (RISK-005/NOTE-009's `EirLocator`-as-argument bug, NOTE-003's fingerprint schema-v2 candidate) argue against a 1.0.0 stability commitment yet. Added `packages/eir/CHANGELOG.md` (starts at 0.3.0; earlier versions point to this file's own Daily Progress Log). Bumped `packages/eir/package.json` to `0.3.0`, updated its description, updated `index.test.ts`'s version assertion. Full monorepo `pnpm lint && pnpm typecheck` and `packages/eir`'s own suite (354 tests, 54 files) green after the bump. `npm whoami` initially failed (401 — the stored token in `~/.npmrc` had gone stale); Aayush refreshed it himself. First `npm publish` attempt hit `EOTP` (npm's browser-based one-time-password 2FA) — nothing published; Aayush completed the OTP flow and ran `npm publish` himself from `packages/eir/`. Confirmed live: `npm view playwright-eir versions`/`dist-tags` shows `0.3.0` as `latest`.
- Career artifacts: drafted the XYZ resume bullet and the 5-minute interview walkthrough script (`career/resume-bullet.md`, `career/interview-walkthrough.md`) — grounded only in `docs/tuning-log.md`/`docs/hybrid-comparison.md`/`packages/benchmark/reports/baseline.md` numbers, including an explicit "what NOT to say" section (don't generalize past the two structural ceilings; don't claim the LLM fallback helped). **Deliberate scope change from the approach doc's own instruction**: Aayush asked these be kept out of the public repo (`career/` added to `.gitignore`) rather than committed — his own career materials, not portfolio-audience content. Recorded here as the honest disposition, not silently done differently from what was asked.
- Closing Post-Phase TS Tip: grepped the full monorepo for all 13 named patterns plus interface-as-seam (14 total), one real location each, delivered as a table. One real, honest finding: literal `keyof typeof` does not appear anywhere in this codebase (grepped, zero hits) — what's actually used, three real sites (`methodClassification.ts`, `selectorIdentity.ts`, `matching/types.ts`), is the closely related `(typeof ARRAY)[number]` (tuple-to-union) rather than `keyof typeof OBJECT` (object-keys-to-union); noted as an honest substitution rather than forcing a non-existent match. Interactive "explain each one back" step was explicitly skipped by Aayush's own "let's proceed" — flagged as a deliberate gate-skip per CLAUDE.md §3, not silently dropped.
- Blocked/open: none. All ledger items from Session 1 remain resolved/documented/deferred as recorded there; no new items opened this session beyond what's already tracked.
- CI: green on PR #17 throughout (`build` check, most recent run completed 2026-07-16T13:51:45Z).
- Next: merge PR #17, tag `v0.3.0` + create the GitHub release with the results table, tag `phase-9-done`/`project-done` after Aayush's final DoD confirmation, deliver the closing session brief.

### 2026-07-16 — Repo Audit (post-project-done, pre-1.0.0)
- Did: produced `FULL_UNDERSTANDING.md` at the repo root — a 14-section,
  fully-commanded audit snapshot of `main`@`38baa60` (the `phase-9-done`/
  `project-done`/`v0.3.0` commit), commissioned as the foundational
  document for the 1.0.0 completeness-and-security review. Describe-only
  session per its own hard rule: zero fixes applied, every imperfection
  found routed to §13 instead. Verified live rather than recalled: CI
  status of HEAD (green, one non-blocking Node-20-deprecation annotation),
  npm registry state (`0.3.0`/`latest`, confirmed via `npm view`), a real
  secret-shaped-string grep across tracked files (zero matches), a real
  `pnpm --filter playwright-eir build` + `dist/*.d.ts` read for the public
  API surface, a real deep-import attempt against the `exports` map
  (blocked as expected), `npm pack --dry-run` (291 files, 113.6 kB,
  dist-only), the full production dependency tree (`zod@4.4.3`, the
  package's only runtime dependency), and a fresh `pnpm test` run per
  package (505 total Vitest tests passing across `eir`/`benchmark`/
  `ci-action`/`demo-app`, matching but independently re-confirming Phase
  9's own count for `packages/eir`).
- A local `.env` file at the repo root triggered the session's "stop and
  report a leaked secret" tripwire on sight; checked immediately
  (`git ls-files`, `git check-ignore -v`, `git log --all --full-history --
  .env`) and confirmed untracked, correctly gitignored, and absent from
  all git history — not a leak, no pause needed, noted in §1/§11 rather
  than escalated further.
- Found and recorded in §13 (not fixed): `CLAUDE.md` §9's repository map
  places `.eir/` at repo root when it actually lives at
  `packages/demo-app/.eir/`; a stale `policy/thresholds.ts` comment names
  a report string (`silent-drift-suspected`) that doesn't match the real
  code (`drift-suspected`); `packages/demo-app/playwright.config.ts`'s
  `actionTimeout` comment still describes RISK-011's pre-fix behavior as
  current; the CI dogfood mutation step is permanently pinned to one
  exact, already-merged, one-time branch name; and a real (if narrow)
  correctness gap in `ci-action`'s "has findings" check, which uses
  `suggestion !== null` as its sole signal and can therefore miss a
  genuine heal in the rare case `suggestSelector` itself returns `null`.
  Full list, with severity guesses, in the document's §13 — ten items
  total, none fixed this session per the audit's own hard rule.
- Blocked/open: none. This was a read-only audit session; no code changed.
- CI: not yet pushed this session (document-only branch).
- Next: PR review + merge (Aayush's go), then triage `FULL_UNDERSTANDING.md`
  §13's ten findings and §12/§14's version-gap items into fresh NOTE-###
  entries here as Aayush decides which matter for 1.0.0 — this session
  deliberately opened none itself, per its own instruction to keep findings
  parked in the document until triaged together.

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

### 2026-07-06 — BLUEPRINT.md, EIR_BLUEPRINT_APPROACH.md — capture starts concurrently with the action, not strictly after
**Triggered by:** direct decision (Aayush, during Phase 3 wiring, after a live experiment showed navigational actions lose their post-success capture race — see RISK-007)
**Change:** BLUEPRINT.md §7.2's "Runs in-page via injected `page.evaluate()` script against the resolved element after a successful action" is amended to describe the round-trip starting concurrently with the action, committed to the store only on confirmed success. EIR_BLUEPRINT_APPROACH.md Phase 3 work item 2 updated to match and point to §7.2 for the reasoning.

### 2026-07-07 — CLAUDE.md — never delete a branch without asking first
**Triggered by:** direct decision (Aayush, closing a Phase 3 process gap)
**Change:** §8 Git & Commits gains a rule, immediately after the no-direct-push-to-main rule: Claude never deletes a branch — including via `--delete-branch` on `gh pr merge` or any other flag/command that deletes as a side effect — without asking Aayush first, in every future session. Raised because Phase 3's PR #9 merge used `gh pr merge --delete-branch` without asking first; no work was lost (the commit was recovered from its SHA and the branch was recreated), but this repo's branches double as a portfolio/history record, so branch deletion now gets the same explicit go-ahead standard already required for merging and publishing.

### 2026-07-11 — BLUEPRINT.md, EIR_BLUEPRINT_APPROACH.md — NOTE-001 retrofit (post-condition capture + verification)
**Triggered by:** NOTE-001 (formally adopted 2026-07-08 during Phase 5's close; implemented this session as part of Phase 6)
**Change:** BLUEPRINT.md §7.2 gains a bullet describing post-condition capture as a sibling artifact alongside the fingerprint (no schema change). BLUEPRINT.md §7.6 gains a paragraph describing post-condition verification as a distinct, complementary gate to decision margin on heal-and-continue's retry. EIR_BLUEPRINT_APPROACH.md's Phase 3 section gains a retrospective cross-reference note (the concurrent-capture pattern built there was reused here). EIR_BLUEPRINT_APPROACH.md's Phase 6 section gains: a "Scope expansion" paragraph under Objective/Why now, work item 7 (the retrofit itself), an added Understanding Gate bullet, an OUT-list guard against a general-purpose assertion framework, and a DoD line requiring real heal-mode benchmark evidence.

### 2026-07-17 — CLAUDE.md — §9 repository map corrected (A6, 1.0.0 closure)
**Triggered by:** FULL_UNDERSTANDING.md §13 #1 (audit finding, 2026-07-16) — `.eir/` was listed at the repo root; the real, only committed store lives at `packages/demo-app/.eir/` (`packages/benchmark/.eir/` is a separate, deliberately gitignored one). `README.md`'s own repository map already had this right; only `CLAUDE.md` had drifted.
**Change:** §9's repository map line changed from `.eir/` to `packages/demo-app/.eir/`, moved next to the `packages/demo-app/` line it belongs under.

---

*This file has no end state — it grows for the life of the project. If it gets unwieldy, split by section into `notes/parked.md`, `notes/log.md`, `notes/risks.md` and leave a pointer here; don't let size become a reason to stop maintaining it.*
