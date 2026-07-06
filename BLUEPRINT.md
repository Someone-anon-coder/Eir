# BLUEPRINT — Self-Healing Locator Engine for Playwright

**Document type:** Project Blueprint (What / Why / End Goal)
**Companion documents:** `BLUEPRINT_APPROACH.md` (phased execution plan) and `CLAUDE.md` (working agreement) — authored separately. This document deliberately contains **no phasing, no scheduling, no task breakdown**. It defines the project itself: what is being built, why it is being built, what it consists of, and what "done" means.

---

## 1. Project Identity

**Working name:** Self-Healing Locator Engine (final npm package name TBD)

**One-line definition:** An npm package that plugs into existing Playwright TypeScript test suites with a one-line change, and — when a locator fails because the UI changed — finds the element's new identity, proposes a corrected selector with a confidence score, and surfaces the fix as a reviewable suggestion locally and in CI.

**Category:** Test-infrastructure plugin. Not a test framework. Not a code generator. Not an autonomous agent.

**Form factor:** TypeScript npm package + monorepo containing the engine, a benchmark demo application, a mutation harness, and CI integration tooling.

---

## 2. The Problem

### 2.1 The pain, precisely stated

UI test automation breaks constantly for a reason that has nothing to do with product quality: **selectors encode a snapshot of DOM structure, and DOM structure churns**. A frontend developer renames `planName` to `planTitle`, wraps a button in a flex container, or lets a designer change `h-11` to `h-12` in a Tailwind class — and a test that validates perfectly correct behavior fails. The behavior didn't regress. The *address* of the element changed.

The industry cost of this is well documented in every QA team's daily reality:

- **Maintenance tax.** A significant fraction of automation engineering time is spent not writing new coverage but repairing selectors on existing coverage.
- **Flake erosion of trust.** When failures are usually "just a locator," teams stop treating red builds as signal. Real regressions hide inside locator noise.
- **Brittleness compounds with suite size.** A suite with 163 page objects (a real number, from the Forseti suite this project's author built) has thousands of selectors, each a small bet that a specific DOM shape persists.

### 2.2 Why existing answers are insufficient

- **"Write better selectors" (data-testid discipline):** Correct advice, but it requires frontend cooperation, retrofitting legacy suites, and organizational discipline that most teams do not have. It prevents future breakage; it does nothing for the thousands of selectors already written.
- **Commercial self-healing tools (Testim, Mabl, Healenium, etc.):** Exist, and validate the market — but they are either paid closed platforms requiring migration into their ecosystem, tied to Selenium (Healenium), or heal silently in ways teams don't trust. There is no lightweight, open, **Playwright-native, TypeScript-first, suggest-don't-silently-patch** option with a published accuracy benchmark.
- **"Ask an LLM to fix the test":** Non-deterministic, slow, costly at CI scale, and unauditable as a *primary* mechanism. (This project treats LLM assistance as an optional, flagged, benchmarked fallback — see §7.8.)

### 2.3 The specific gap this project occupies

A tool that is simultaneously:

1. **Zero-migration** — works with an existing suite via a one-line import change; no rewrites, no wrapper adoption, no code-style mandates.
2. **Style-agnostic** — works identically for pristine POM suites and 900-line linear scripts, because it intercepts at the Playwright API boundary, not at the user's code organization.
3. **Trust-first** — never silently patches source; every heal is annotated, every suggestion is reviewable, and a suggest-only mode exists for the trust-building period.
4. **Honestly measured** — ships with a reproducible benchmark and publishes heal rate *and* false-heal rate per mutation class, including the failure cases.

No open tool occupies all four properties at once. That intersection is the project.

---

## 3. Why This Project (Strategic Rationale)

This blueprint exists inside a career context, and the project is deliberately shaped by it:

- **It targets the hard, current problem in test automation.** Self-healing is the product category of the "AI in QA" companies (Geta AI Labs and peers). Building one — with formed opinions about confidence thresholds, false-heal asymmetry, and heuristics-vs-LLM tradeoffs — means walking into those interviews speaking the domain language from experience, not reading.
- **It closes the TypeScript gap credibly.** A shipped, non-trivial TypeScript npm package (Proxies, fixture typing, monorepo tooling) is the strongest possible evidence against a flagged skill gap.
- **It produces a metric-bearing portfolio artifact.** The benchmark yields honest, quantified bullets: *"Achieved X% heal rate with <Y% false-heal rate across Z mutation classes."*
- **It cannot be faked in an afternoon.** The intellectually hard parts — the similarity function, the false-heal asymmetry, the mutation taxonomy — require iteration against measurement. That is the point: 10–15 days of genuine engineering thought, not 3 hours of scaffolding.
- **An honest results table is the differentiator.** A repo that reports *"heals 84% of attribute renames but only 31% of structural rewrites, and here is why"* reads like an engineer. One that claims magic reads like a demo.

---

## 4. Founding Principles (Non-Negotiable Design Commitments)

These were settled during scoping and govern every downstream decision.

**P1 — Intercept at the Playwright API boundary, nowhere else.**
Every Playwright script — POM or not, disciplined or spaghetti — converges at one point: a selector string is resolved into a Locator, and an action on it succeeds or throws. The engine lives exactly there. It never sees, never requires, and never depends on the user's classes, helper methods, naming conventions, or file structure. This is what makes the tool style-agnostic *by construction* rather than by documentation.

**P2 — Plugin ergonomics: one line, zero rewrites.**
Delivery is a fixture override on `@playwright/test`. The user changes one import (or one line in config). The framework/wrapper approach — asking teams to call `smartClick()` or add lines per page object — is explicitly rejected: even "one or two lines per POM file" is one or two lines × hundreds of POMs. Nobody performs that migration.

**P3 — Suggest, never silently mutate.**
The engine may (per policy) retry an action against a healed element *within a run*, but it **never edits user source code**. Runtime healing and source-fix suggestion are separate outputs. Every heal is visibly annotated on the test result. Trust is the product; silence destroys it.

**P4 — False heals are worse than failures.**
A test that fails costs an investigation. A test that *wrongly passes* because the engine matched the wrong element costs a shipped bug plus destroyed trust in the tool. The entire policy layer (thresholds, decision margins, observe-only methods, suggest-only mode) exists because of this asymmetry. Accuracy claims are meaningless without a false-heal rate attached.

**P5 — Scope by runtime page identity, not code organization.**
Fingerprints are bucketed by route (URL pattern at capture time), never by which class or file requested the locator. POM suites map onto this naturally (one page object ↔ one route ↔ one bucket) and get the tidiest experience — but non-POM scripts work identically, because the engine asks "what page am I on?", never "what code called me?" Page-level isolation also means DOM analysis and capture never leak across pages.

**P6 — Deterministic heuristics are the core; anything else is a flagged, benchmarked extra.**
The primary matching engine is a deterministic, explainable, zero-cost, CI-reproducible scoring pipeline. An LLM-assisted fallback may exist behind an explicit flag, and must be compared against heuristics-only *using the project's own benchmark* (accuracy, cost, latency).

**P7 — Lightweight by design.**
The persisted artifact is a compact structured fingerprint (single-digit KB per selector), not DOM snapshots. Even a large suite with thousands of unique selectors stores single-digit MB. Full DOM captures occur only transiently at failure time for the matching pass. No browser extension, no CDP dependency, no patching of Playwright internals — all DOM inspection happens via injected `page.evaluate()` scripts, keeping the engine version-safe.

**P8 — Measured honestly, in public.**
The benchmark, its mutation taxonomy, its seeds, and its full results table — including the mutation classes where the engine performs poorly — ship in the repository README.

---

## 5. What the System Is (Conceptual Model)

### 5.1 The two-mode lifecycle

The engine's core epistemological problem: to heal, it must know what the element *used to look like* — and at failure time, the old element is gone. Therefore the system necessarily operates in two modes:

- **Record mode (implicit, continuous).** While tests run green, the engine silently captures and refreshes a *fingerprint* for every selector it sees succeed. The baseline is "last known good": every successful interaction overwrites the stored fingerprint, so the baseline drifts *with* the application's legitimate evolution.
- **Heal mode (triggered).** When a selector fails eligibility-checked failure (see §7.4), the engine loads that selector's fingerprint, scores candidate elements in the live DOM against it, and produces a match + confidence + suggested replacement selector.

**Onboarding corollary (documented as a feature, not hidden as a flaw):** the first green run after installation is the calibration run. A selector that has never succeeded under the engine has no fingerprint and cannot be healed — it fails normally.

### 5.2 The data pipeline

The entire system is one pipeline; every component is a stage in it:

```
intercept → capture → store → detect failure → match → decide → report
```

with the **benchmark** sitting outside the pipeline, judging it.

### 5.3 What a "heal" is, precisely

A heal is a triple:

1. **A matched element** in the current DOM, believed to be the same logical element the broken selector used to address.
2. **A confidence score** derived from feature similarity *and* decision margin (gap to the runner-up candidate).
3. **A suggested replacement selector**, generated fresh by robustness preference order (`data-testid` > `id` > role+accessible-name > label association > structural path) — meaning the suggested selector may be *more* robust than the one that broke.

---

## 6. What the System Is Not (Explicit Non-Goals for v1)

Scope discipline is a deliverable. The following are **out**, by decision, not omission:

- **No auto-committing or auto-editing of user source.** Suggest only. (Permanent principle, not just v1.)
- **No Python / pytest-playwright port.** v1 is TypeScript `@playwright/test` only. (The concepts translate — the author's own reference suites are Python — but v1 does not ship it.)
- **No Selenium, Cypress, WebdriverIO adapters.**
- **No LLM in the core matching path.** Optional fallback behind an explicit flag only, benchmarked against heuristics-only.
- **No cross-browser matrix beyond Chromium** for the benchmark and primary support target.
- **No healing of interrogative methods.** `isVisible()`, `count()`, `isEnabled()`, `isChecked()` are observe-only (see §7.4) — substituting a healed element into a boolean check can silently corrupt a legitimate negative assertion.
- **No visual-AI / screenshot-embedding matching.** Geometry participates only as coarse quantized bounding-box features.
- **No test generation, no test repair beyond selectors.** The engine fixes *addresses*, not assertions, waits, or logic.
- **No hosted service, dashboard, or telemetry.** Local files + CI artifacts only.

---

## 7. System Composition (The Eight Components)

The finished system consists of eight components. Their generic mechanisms were settled during scoping and are recorded here as part of the project definition.

### 7.1 Interception Layer (fixture override + proxy)

- The package exports a `test` object built via `base.extend()`, overriding the `page` fixture. Playwright officially supports fixture extension; this is the sanctioned plugin surface, requiring no monkey-patching of internals (fragile, version-coupled — rejected).
- The wrapped page passes `locator()` / `getByRole()` / `getByLabel()` / `getByText()` / `getByTestId()` calls through to the real methods while recording the selector, and returns Locators that are themselves wrapped — so chained calls (`row.locator(col)`) compose into trackable full paths.
- Action methods on wrapped Locators are try/catch shells around the real calls: success → fire-and-forget fingerprint refresh; `TimeoutError` → heal path.
- **Interception surface (Playwright inherent methods only):**
  - *Capture points:* `page.locator()`, `frame.locator()`, `locator.locator()` (chaining), `getByRole` / `getByLabel` / `getByText` / `getByTestId` / `getByPlaceholder`.
  - *Heal-eligible outcomes (imperative):* `click`, `fill`, `type`, `press`, `check`, `uncheck`, `selectOption`, `hover`, `waitFor`, `innerText` / `textContent` when they throw.
  - *Observe-only outcomes (interrogative):* `isVisible`, `isEnabled`, `isChecked`, `count` — logged drift hints at most, never healed.
- **Invisibility requirement:** on the happy path the layer must add near-zero overhead and must not disturb Playwright's auto-waiting, retry, or chaining semantics. This is the project's riskiest technical unknown and is treated as such.

### 7.2 Fingerprint Capture

- Runs in-page via an injected `page.evaluate()` script against the resolved element, asynchronously (non-blocking to the test). The browser round-trip is started *concurrently with the action itself*, not strictly after it resolves — an action that navigates away (a login submit, a nav link) destroys its own element before a post-success `evaluate()` could reach it, silently losing every navigational selector's fingerprint. Starting the round-trip while the element is still guaranteed to exist, and only *recording* the result once success is confirmed, closes that gap without changing the outward contract: a fingerprint is still committed to the store if and only if the action succeeded (Phase 3, confirmed via a live experiment against the demo app — deterministic capture, no change to any action's own pass/fail behavior or timing).
- **Captured features, in descending identity-strength:** tag name; stable attributes (`id`, `name`, `type`, `data-testid`, `aria-*`, `role`); own text content (trimmed, truncated); associated label text (via `for=` association or wrapping `<label>`); short ancestor chain (2–3 hops of tag + salient class tokens + landmark ids); sibling context (index among same-tag siblings, sibling count); coarse geometry (bounding box quantized to a grid so small shifts don't register).
- **Deliberately not captured:** volatile values (input contents, timestamps), full utility-CSS class lists (Tailwind noise — a filtered token set is kept instead), and anything resembling user data — keeping fingerprints small and privacy-clean.
- Refresh policy: last-known-good overwrite on every success.

### 7.3 Fingerprint Store

- A committed directory in the user's repo (e.g. `.selfheal/`) of JSON keyed hierarchically: **route pattern → normalized selector → fingerprint**.
- **Route normalization:** URL at capture time with obvious dynamic segments parameterized (`/plan/42/edit` → `/plan/:id/edit`), heuristic with config override.
- **Selector normalization:** dynamically constructed selectors (e.g. f-string/template-literal text matches like `//button[normalize-space()='Monthly']`) are parameterized into templates (`…='{TEXT}'`) so variants share one fingerprint entry, with the literal captured as an instance parameter. Without this, per-value selectors would fragment learning.
- **Git-committed by design:** the baseline travels to CI, teammates share each other's calibration, and fingerprint changes appear as reviewable diffs.
- **Write mechanics:** read into memory at run start; batch atomic write at run end; parallel workers write shard files merged in `globalTeardown` — no corruption under Playwright's parallelism.
- **Size envelope:** 1–3 KB per fingerprint; single-digit MB for suites with thousands of selectors.

### 7.4 Failure Triage

A `TimeoutError` is necessary but not sufficient. Before matching, cheap eligibility gates:

1. **Fingerprint exists?** No baseline → fail normally (record-mode onboarding).
2. **Page sane?** Dead server, error page, or unexpected route (e.g. redirect to `/login`) → not locator drift; fail normally. Healing here would be noise.
3. **Failure species:** *zero-match* and *detached* are the classic heal cases and the only heal-eligible ones in v1; *found-but-never-visible/enabled* is more often an application bug and is not healed.
4. **Method class:** imperative only (per §7.1); interrogative methods never trigger healing.

### 7.5 Matching Engine (the heart)

A three-stage funnel executed against a transient DOM capture:

1. **Candidate generation.** All elements of the fingerprint's tag plus known tag-swap equivalents (`button ↔ a ↔ input[type=submit]`), cheaply pre-filtered to rendered elements — tens of candidates, not thousands.
2. **Feature scoring.** Each candidate scored 0–1 per independent dimension: attribute overlap (with `id`/`data-testid`/`name` weighted far above class tokens), text similarity (normalized edit distance / token overlap), label-association match, ancestor-chain similarity, sibling-position similarity, geometric proximity. Final score = weighted sum. **The weight vector is the intellectual core of the project** — initial hand-set weights are expected to be wrong, and tuning them against the benchmark's per-mutation-class false-heal measurements is where the engineering depth lives.
3. **Decision margin.** Confidence is a function of both the top score and the *gap to the runner-up*. High score with a distant second → confident heal. High score with a near-identical second (e.g. two similar table rows) is precisely where false heals occur → confidence is suppressed. Margin is a first-class input, not an afterthought.

Output: matched element + confidence + freshly generated suggested selector (robustness preference order per §5.3).

### 7.6 Policy Layer

A small state machine over two configurable thresholds (defaults to be tuned via benchmark; illustrative: high ≈ 0.85):

| Confidence | Action |
|---|---|
| ≥ high threshold | **Heal-and-continue:** retry the action on the matched element; annotate the test as *healed* (visible, never silent); record the suggestion. |
| between thresholds | **Fail-with-suggestion:** test fails; failure report carries "did you mean `#planTitle` (confidence 0.72)?" |
| < low threshold | Fail normally; log scored candidates for debugging. |

Global mode switch: **`suggest-only`** — nothing is ever retried; every match becomes a suggestion. This is the intended default posture for a team's first weeks (trust-building before trust-assuming). In every mode, user source is never modified.

### 7.7 Reporting

- **Local:** a Playwright custom reporter (documented plugin interface — the second sanctioned extension surface, alongside fixtures) printing a heal-summary table at run end and writing a JSON + Markdown artifact per run: route, old selector, suggested selector, confidence, file/line where resolvable from stack traces, and an `element.screenshot()` of the healed element captured at heal time (cheap; enormously trust-building).
- **CI:** a thin GitHub Action / CLI step that reads the artifact and posts or updates a **single** PR comment: *"3 selectors healed on `/plan-tarrif/plan/create` — suggested diffs below."* This PR comment is the demo-reel moment of the whole project.

### 7.8 Benchmark (the judge)

A separate package in the monorepo; the system's accountability mechanism.

- **Demo application:** a deliberately boring web app of enterprise furniture — login, data table, multi-field form, modal, navigation, multi-step wizard (patterns transcribable from the author's Smart360 experience). Owned and served locally so its DOM can be mutated programmatically and deterministically. Not optional: heal rate cannot be measured against a site the project doesn't control.
- **Mutation engine:** applies *one mutation class at a time*, seeded and fully reproducible. Initial taxonomy: id/attribute renames; wrapper-`div` injection; sibling reordering; visible-text changes; tag swaps (`button→a` etc.); class-name shuffles (the Tailwind-churn case); plus a **compound "realistic release" scenario** mixing classes. Designing this taxonomy is, in effect, designing an adversarial suite against the project's own matcher — intentionally.
- **Ground truth:** the mutator records an old-element → new-element mapping for every change, so every heal outcome is objectively classifiable.
- **Per-selector outcome classes:** healed-correct / healed-wrong (**false heal**) / suggested-but-not-healed / missed.
- **Outputs:** heal rate and false-heal rate per mutation class; the compound-scenario result; and (when the LLM flag exists) heuristics-only vs hybrid comparison on accuracy, cost, and latency.
- **Publication:** the full table — including weak classes — goes in the README.

---

## 8. Reference Grounding (Why We Trust This Design)

The design was pressure-tested against a real production page object (`plans_page.py` from the Forseti suite — 780 lines, 7-step wizard, mixed selector quality). Three findings from that exercise are recorded as design evidence:

1. **The wrapper layer confirms P1/P2.** The reference suite's `safe_click` / `safe_locator_wait_for` helpers are the framework approach this project rejects — they had to be written, and every engineer disciplined into calling them. The engine intercepts one level below, so it serves teams with such wrappers and teams calling raw Playwright identically.
2. **`is_plan_in_list()` forced the imperative/interrogative split.** The reference method deliberately returns `False` when an element is legitimately absent. Healing inside such a check would "find" a similar row and corrupt a correct negative assertion — the false-heal asymmetry appearing in real code. Hence §7.4's observe-only rule.
3. **`BILLING_CYCLE_TRIGGER` is the demo-reel target.** A Tailwind-class-anchored ancestor-walk XPath — the most fragile selector species in production use — whose fingerprint nonetheless captures *semantic* identity (label association, role, position). Healing a selector whose entire definition was cosmetic is the tool's showcase scenario. The same method's f-string option locator (`normalize-space()='{label}'`) is what mandated selector normalization (§7.3).

---

## 9. End Goal — Definition of Done

The project is complete when **all** of the following exist and are demonstrably true:

### 9.1 The deliverables

1. **An installable npm package** that integrates into an existing Playwright TypeScript suite via a one-line import change, with TypeScript types, README, and semver-tagged release (published to npm or install-ready from the repo).
2. **The monorepo**, public on GitHub, containing: engine package, benchmark demo app, mutation harness, CI integration (reporter artifact + PR-comment action), and configuration documentation.
3. **The honest results table** in the README: heal rate and false-heal rate per mutation class, compound scenario included, weak spots analyzed in writing ("heals X% of attribute renames but only Y% of structural rewrites, because…").
4. **A reproducible 2–3 minute demo path:** clone → install → run green (calibration) → apply a mutation to the demo app → run again → watch a heal annotation appear locally and a suggestion diff appear as a PR comment.
5. **Fingerprint store artifacts** demonstrating the committed-baseline workflow (reviewable diffs of fingerprint changes).

### 9.2 The behavioral acceptance criteria

- Happy path is invisible: a green suite runs with no observable behavioral difference and negligible overhead, with Playwright auto-waiting/chaining semantics intact.
- A never-fingerprinted selector fails exactly as vanilla Playwright would.
- Interrogative methods never heal, in any configuration.
- `suggest-only` mode provably never retries an action.
- No mode, ever, modifies user source files.
- Fingerprint store stays within the size envelope (§7.3) on a realistic suite.
- Parallel-worker runs do not corrupt the store.

### 9.3 The measurement bar

There is no predetermined accuracy number to hit — the bar is **honesty and analysis**, not a vanity metric. Done means: the benchmark runs reproducibly from seeds; every outcome is ground-truth classified; the false-heal rate is measured and reported per class; threshold defaults are justified by the measurements; and the README explains the failure modes as clearly as the successes.

### 9.4 The strategic artifacts (career layer)

- One resume-ready XYZ bullet backed by the measured numbers.
- The repo functions as a talking-piece: an interviewer can be walked from broken selector → fingerprint → funnel → confidence → PR comment in under five minutes.
- Demonstrated TypeScript depth: Proxies, fixture typing, monorepo/npm packaging — the flagged gap, closed with shipped evidence.

---

## 10. Open Questions (Carried Forward, Not Blocking)

Recorded so they are decided consciously in the approach document, not by accident:

1. **Proxy vs explicit method wrapping** for the interception layer — Proxy is the generic mechanism; explicit wrapping may be more type-friendly and debuggable. Decide at implementation.
2. **Exact fingerprint schema** — field list above is settled in kind; exact shapes, truncation limits, and the ancestor-hop count need specification. (First design conversation of the build.)
3. **Scoring weight vector and threshold defaults** — explicitly expected to be wrong initially and tuned against the benchmark.
4. **Selector template parameterization rules** — which literals get parameterized, and how aggressively.
5. **Route-pattern heuristics** — dynamic-segment detection rules and the config override surface.
6. **Suggested-selector generation details** — the robustness preference order is settled; tie-breaking and uniqueness verification against the live DOM need specification.
7. **LLM fallback shape** (if built): prompt design, what context it receives (fingerprint + candidate shortlist, not raw DOM), and its cost/latency budget — all subordinate to the benchmark comparison.
8. **Package/product name** — needed before npm publication.

---

## 11. Glossary

| Term | Meaning |
|---|---|
| **Fingerprint** | Compact structured JSON describing an element's identity features at last successful interaction. |
| **Record mode** | Implicit continuous capture/refresh of fingerprints while tests pass. |
| **Heal mode** | The triggered pipeline: triage → match → decide → report, on eligible failure. |
| **Heal** | Matched element + confidence + suggested replacement selector (§5.3). |
| **False heal** | Engine matches the *wrong* element; the worst outcome class (P4). |
| **Decision margin** | Score gap between best and runner-up candidate; first-class confidence input. |
| **Imperative method** | Action/wait Playwright call (`click`, `fill`, `waitFor`…) — heal-eligible. |
| **Interrogative method** | Boolean/count query (`isVisible`, `count`…) — observe-only, never healed. |
| **Suggest-only mode** | Global posture: no retries ever; all matches become suggestions. |
| **Selector normalization** | Parameterizing dynamic literals so selector variants share one fingerprint template. |
| **Route scoping** | Bucketing fingerprints by runtime URL pattern, never by user code structure (P5). |
| **Mutation class** | One category of controlled DOM change applied by the benchmark (id rename, wrapper injection, …). |
| **Ground truth mapping** | The mutator's old→new element record enabling objective outcome classification. |
| **Calibration run** | The first green run after installation, which builds the initial fingerprint baseline. |

---

*This blueprint is the stable definition of the project. The phased path to building it lives in `BLUEPRINT_APPROACH.md`; day-to-day working conventions live in `CLAUDE.md`. Changes to the principles in §4 or the non-goals in §6 require editing this document deliberately — they should never drift silently.*
