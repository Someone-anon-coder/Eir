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

**Resolution:** *(pending Phase 4 decision — but the Phase 1 prerequisite cross-check is done: Ward already contains all three named pair shapes.)* Cross-checked 2026-07-05 during Phase 1 close: (1) **table-row pair** — the Active/Archived Devices tables share a row with identical name ("Front Desk Tablet"), same tag/structure, differing mainly in status/date; (2) **nav/button pair** — `DeviceTable`'s row actions render adjacent same-tag, same-container `Edit`/`Remove` buttons (and `Save`/`Cancel` once a row enters edit mode), and the account-deletion modal renders adjacent `Cancel`/`Confirm Delete` buttons; (3) **form-field pair** — the access-request wizard's Step 1 renders two adjacent plain-text `<input>`s ("Request Title", "Requested By") distinguished only by label. No additional surfaces were added for this; Phase 4 can build the near-duplicate-sibling-swap class against what already exists.

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

### RISK-003 — `EirLocator` forwards undocumented Playwright internals (`_apiName`, `_expect`)
**Status:** WATCHING
**Raised:** 2026-07-06, during Phase 2 wrapper-class design
**Phase affected:** Phase 2 (introduced), all downstream phases (inherited)
**Risk:** Playwright's `expect(locator).toBeVisible()` and similar matchers duck-type a private `_apiName` field and call a private `_expect()` method — neither is part of the public `Locator` TypeScript type, so there's no compile-time contract protecting this. A future Playwright version could rename or restructure these without a type error warning us, silently breaking every assertion in a wrapped suite. `EirPage` has the same exposure for `_apiName` alone: `expect(page).toHaveURL()`/`.toHaveTitle()` route their actual polling through `page.mainFrame()._expect(...)` (a plain pass-through returning the real `Frame`), so `EirPage` only needs `_apiName` forwarded, not `_expect` — confirmed by a second spike. **Known gap, not yet covered:** `expect(page).toHaveScreenshot()` calls a third private method, `page._expectScreenshot(...)`, not forwarded by `EirPage` and not spiked — untested, since the reference suite doesn't use visual-regression assertions.
**Mitigation:** Confirmed working via throwaway spikes (Locator success path + failure-path error-message parity; Page `toHaveURL`/`toHaveTitle`) before committing to the design. Each cast is narrow, isolated to one spot, and commented. The invisibility proof (this phase's own gate) and CI on every future Playwright version bump are the ongoing detection mechanism — not a one-time check. Add `_expectScreenshot` forwarding to `EirPage` if/when a suite using `toHaveScreenshot` needs to pass through Eir.

### RISK-004 — Capture-point coverage stops at Blueprint §7.1's named 6 methods
**Status:** WATCHING
**Raised:** 2026-07-06, during Phase 2 wrapper-class design
**Phase affected:** Phase 2 (introduced), Phase 3 (fingerprint coverage inherited)
**Risk:** `EirLocator`/`EirPage` only extend `chainPath`/wrap the return value for the exact 6 methods Blueprint §7.1 names (`locator`, `getByRole`, `getByLabel`, `getByText`, `getByTestId`, `getByPlaceholder`). Chaining through any other Locator-returning method (`filter`, `first`, `last`, `and`, `or`, `normalize`, `contentFrame`, `getByAltText`, `getByTitle`) returns the real, unwrapped `Locator` — that branch silently stops being tracked (no capture log, no future fingerprinting) even though it still behaves correctly as vanilla Playwright.
**Mitigation:** Not currently exercised — the reference suite uses none of these methods. Revisit and widen the capture-point list if a future suite (benchmark or real-world adoption) relies on one of them.

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

---

*This file has no end state — it grows for the life of the project. If it gets unwieldy, split by section into `notes/parked.md`, `notes/log.md`, `notes/risks.md` and leave a pointer here; don't let size become a reason to stop maintaining it.*
