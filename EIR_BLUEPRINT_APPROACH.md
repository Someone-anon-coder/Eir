# EIR_BLUEPRINT_APPROACH.md — Phased Execution Plan for `playwright-eir`

**Companion to:** `BLUEPRINT.md` (the stable what/why/end-goal — nothing here overrides it) and `CLAUDE.md` (working agreement — authored next).
**Package name (validated):** `playwright-eir` — available on npm, zero GitHub collisions, follows the `playwright-*` plugin convention. *Eir: Norse goddess of healing — completing the Forseti / Heimdall / Eir portfolio trilogy.*

---

## 0. Decision Record (locked before this plan was written)

| # | Decision | Choice |
|---|---|---|
| Q1 | Build order | **Benchmark-first spine** — demo app + mutation harness early; matcher is tuned against measurement, never vibes |
| Q2 | Roles | **Claude writes all code.** Aayush decides, prompts, corrects, reviews — and must *understand* everything before it is written (see Understanding Gates) |
| Q3 | Interception | **Explicit method wrapping** — a typed wrapper class over the finite interception surface; no Proxy |
| Q4 | Demo app | **React + Vite** — realistic SPA target, real false-heal bait |
| Q5 | LLM fallback | **In scope, Gemini API** — invoked *only* when the deterministic algorithm genuinely cannot decide; benchmarked against heuristics-only |
| Q6 | Default posture | **`suggest-only`** — heal-and-continue is opt-in |
| Q7 | Publishing | **Publish early** — name secured with a stub release; versions iterate publicly |
| Q8 | Store layout | **One JSON file per route** under `.eir/` |
| Q9 | Engine tests | **Unit-test heavy (Vitest)** — benchmark is the integration layer, not the only safety net |
| Q10 | Name | **`playwright-eir`**, decided and verified now |

## 0.1 Rules of Engagement (apply to every phase)

1. **Understanding Gate before code.** Each phase opens with a short concept briefing from Claude. Claude writes no phase code until Aayush confirms — in his own words, even two sentences — what is about to be built and why. Since Aayush is new to TypeScript, this gate is the anti-"black box" mechanism: the code is Claude's typing, but never Claude's private knowledge.
2. **No phase leakage.** Each phase has an explicit OUT list. If mid-phase work reveals something belonging to a later phase, it is written into `NOTES.md` as a parked item — never implemented early. Definition of Done (DoD) checklists are binary; a phase closes only when every box ticks.
3. **TS tips are mandatory ritual.** Every phase begins with a **Pre-Phase TS Tip** (a concept the phase's code will use, with a snippet Aayush runs himself via `npx tsx`) and closes with a **Post-Phase TS Tip** (a pattern that just appeared in the written code, located and explained in Eir's own files). Learning is anchored to the code being built, not abstract tutorials.
4. **Practices are non-negotiable from Phase 0:** strict `tsconfig` (`"strict": true`, `noUncheckedIndexedAccess`), ESLint + Prettier, Vitest for units, Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), small commits per work item, CI green before phase close. Every phase ends with a tagged commit `phase-N-done`.
5. **Blueprint supremacy.** If any implementation choice contradicts BLUEPRINT.md §4 principles or §6 non-goals, work stops and the contradiction is resolved consciously (usually: the implementation bends, not the principle).

## 0.2 Phase Map & Time Budget (10–15 working days)

| Phase | Name | Days (est.) |
|---|---|---|
| 0 | Foundation & Name Claim | 1 |
| 1 | Demo App + Reference Suite | 1.5 |
| 2 | Interception Shell | 1.5–2 |
| 3 | Fingerprint Capture & Store | 2 |
| 4 | Mutation Engine & Benchmark Harness | 2 |
| 5 | Matching Engine & Triage | 2–3 |
| 6 | Policy & Reporting | 1.5 |
| 7 | CI Integration (PR comments) | 1 |
| 8 | Gemini Fallback + Comparison | 1–1.5 |
| 9 | Hardening, Docs, Release | 1–1.5 |

Slippage rule: if cumulative slip exceeds 2 days by end of Phase 5, Phase 8 is descoped to the documented extension point (Blueprint §10.7 fallback posture) — decided then, consciously, not by silent drift.

---

# PHASE 0 — Foundation & Name Claim

**Objective:** A correctly tooled monorepo exists; `playwright-eir` is legally ours on npm; Aayush's machine runs the full toolchain; TypeScript learning loop is live.

**Why first:** Everything downstream assumes this skeleton. Publishing the stub now executes Q7 and removes the "name taken later" risk permanently.

### Pre-Phase TS Tip (basic) — *TypeScript is JavaScript with a compile-time contract*
Run this yourself before anything else:
```bash
mkdir ts-scratch && cd ts-scratch && npm init -y && npm i -D tsx typescript
echo 'const port: number = "8080";' > oops.ts && npx tsc --noEmit oops.ts
```
Read the error. Nothing "ran" — the *type checker* rejected a contract violation before runtime. That is the entire value proposition: the `: number` annotation is a promise, and `tsc` is the promise-enforcer. `tsx` (which we'll use throughout) runs TS directly; `tsc --noEmit` only checks. Keep `ts-scratch/` — every tip in this document runs there.

### Work Items
1. GitHub repo `playwright-eir` (public), MIT license, `.gitignore`, `NOTES.md` (the parking file).
2. **pnpm workspace monorepo**: `packages/eir` (the engine — the published artifact), `packages/demo-app` (Phase 1), `packages/benchmark` (Phase 4), `packages/ci-action` (Phase 7). Rationale briefing: why a monorepo (shared tooling, atomic cross-package commits) and why pnpm (workspace protocol, strictness).
3. Root tooling: strict `tsconfig.base.json`, ESLint (typescript-eslint), Prettier, Vitest wired into `packages/eir` with one placeholder test.
4. GitHub Actions CI skeleton: install → lint → typecheck → unit tests, on every push.
5. `packages/eir` package.json with proper metadata, `peerDependencies: { "@playwright/test": ">=1.40" }` (briefing: why peer, not regular dependency — the user's Playwright must be *the* Playwright), and a minimal `exports` map.
6. **Publish `playwright-eir@0.0.1`** — a stub exporting one honest function (`eirVersion()`) and a README line: "Self-healing locator engine for Playwright. Under active development." Name secured.

### Understanding Gate (confirm before code)
- Why a peer dependency for `@playwright/test`.
- What the `exports` map in package.json controls.
- What `pnpm -r` / workspace filtering does.

### OUT (parked if touched)
Any engine logic. Any demo-app code. Any fingerprint types "while we're at it."

### Definition of Done
- [ ] Repo public; monorepo installs from clean clone with one command (`pnpm i`)
- [ ] `pnpm lint && pnpm typecheck && pnpm test` all green locally **and** in CI
- [ ] `npm view playwright-eir` shows 0.0.1 owned by Aayush
- [ ] `npm i playwright-eir` in a scratch folder works and `eirVersion()` returns the version
- [ ] Tag `phase-0-done`

### Post-Phase TS Tip (basic) — *`interface` vs `type`, seen in our own repo*
Open `packages/eir/src/index.ts`. You'll find both keywords in the codebase eventually; the working rule Eir follows: **`interface` for object shapes that describe things** (a Fingerprint, a Config), **`type` for compositions** (unions, function signatures). Try in scratch:
```ts
interface Fingerprint { tag: string; id?: string }        // a thing
type HealOutcome = "healed" | "suggested" | "missed";     // a choice
```
The `?` marks optional; the union type makes illegal states unrepresentable — a value of `HealOutcome` *cannot* be `"helaed"`. The compiler is now a spellchecker for your domain logic.

---

# PHASE 1 — Demo App + Reference Suite

**Objective:** A React+Vite "enterprise furniture" app (working name: **Ward** — the thing Eir heals) serving locally, plus a vanilla-Playwright reference test suite running green against it. This is the benchmark spine's foundation (Q1).

**Why now:** Everything measurable in this project is measured against this app. It must exist before the engine so that from Phase 2 onward, every engine capability is exercised against realistic DOM immediately.

### Pre-Phase TS Tip (basic) — *TS in React: props are just typed function arguments*
```ts
type RowProps = { name: string; status: "active" | "inactive" };
function StatusBadge({ status }: RowProps) { /* ... */ }
```
Run nothing yet — just internalize: a React component in TS is a function whose props object has a declared shape. When Phase 1's code appears, every component will read like this. If you can read `RowProps`, you can read the whole demo app.

### Work Items
1. **App surface (deliberately boring, Smart360-shaped):** login page → dashboard nav → a **data table** page (sortable, row actions — and critically, *two visually similar tables* on one route: the false-heal bait, by design) → a **multi-field form** (text, date, textarea, custom select with `label for=` association — the `billingCycle` pattern transplanted) → a **modal/dialog** → a **3-step wizard** (hash-routed steps, Stepper — miniature of the Plans wizard).
2. **Mutation-readiness by construction:** components take their ids/classes from a single `domProfile.ts` config module. Phase 4's mutation engine will work by swapping this profile — deterministic, seedable, no DOM patching hacks. (This is the *only* forward-looking concession allowed; it's structural, not engine logic.)
3. **Reference suite** (`packages/demo-app/tests/`): 12–18 specs in plain `@playwright/test` — POM-style for half, deliberately linear-script style for the other half (Blueprint P1: the tool must serve both). Mixed selector quality *on purpose*: some `data-testid`, some ids, some brittle class-anchored XPath, some text-based.
4. Playwright config: Chromium only (Blueprint §6), webServer auto-start of Vite.

### Understanding Gate
- Why the two-similar-tables page exists (decision-margin stress case, §7.5.3).
- Why `domProfile.ts` centralization is mutation-readiness, not over-engineering.
- Why the reference suite intentionally contains bad selectors.

### OUT
Any `playwright-eir` import in these tests (they stay vanilla until Phase 2's swap-test). Mutation logic itself. More than 3 wizard steps, visual polish, backend — the app is scaffolding.

### Definition of Done
- [ ] `pnpm --filter demo-app dev` serves the app; all 5 surfaces navigable
- [ ] Reference suite: 12–18 specs, 100% green, both POM and linear styles present
- [ ] All ids/classes flow from `domProfile.ts`; grep proves no hardcoded ids in components
- [ ] CI runs the reference suite headless, green
- [ ] Tag `phase-1-done`

### Post-Phase TS Tip (basic→intermediate) — *`as const` and `keyof typeof`, live in `domProfile.ts`*
Open the profile file just written. It ends with `as const`. In scratch:
```ts
const profile = { planName: "planName", table: "data-table" } as const;
type ProfileKey = keyof typeof profile;   // "planName" | "table"
```
`as const` freezes values into literal types; `keyof typeof` derives a union from data. Consequence in our repo: a test referencing a profile key that doesn't exist is a *compile error*, not a runtime surprise. Data-driven types — you'll see this trick again in the mutation engine.

---

# PHASE 2 — Interception Shell

**Objective:** `playwright-eir` exports an extended `test`; swapping one import line in the reference suite changes **nothing observable**. The wrapper records selectors and outcomes to a debug log, and that's all. Invisibility is the deliverable. Publish `0.1.0`.

**Why now:** Blueprint names this the riskiest unknown (§7.1) — if wrapping breaks Playwright's auto-waiting/chaining semantics, everything downstream is void. Risk is retired here, against the real suite from Phase 1, before any intelligence exists.

### Pre-Phase TS Tip (intermediate) — *Classes, `implements`, and why explicit wrapping (Q3) is a typing gift*
```ts
interface Clock { now(): number }
class TestClock implements Clock {
  private t = 0;
  now() { return this.t; }
  advance(ms: number) { this.t += ms; }
}
```
Run it (`npx tsx`). `implements` forces the class to honor the interface — remove `now()` and compilation fails. Eir's wrapper does exactly this against the ~15-method interception surface: an `EirLocator` class holding the real `Locator`, implementing each intercepted method as a typed try/catch shell, passing everything else through explicitly. This is why we chose Q3-B: every intercepted method is visible, typed, and unit-testable — no Proxy trap mysteries.

### Work Items
1. **Fixture override:** `export const test = base.extend({ page: ... })` wrapping the real page in `EirPage`. Briefing first: how Playwright fixtures compose, why this is the sanctioned plugin surface.
2. **`EirPage` / `EirLocator` wrapper classes** covering the Blueprint §7.1 surface: capture points (`locator`, `getByRole/Label/Text/TestId/Placeholder`, chained `locator.locator`) and outcome shells (imperative methods try/catch → log; interrogative methods pass through untouched, tagged observe-only). Chained calls compose the full selector path.
3. **Selector identity plumbing:** each wrapped locator carries `{ rawSelector, chainPath, routeAtCreation }` — the key material Phase 3 will store under. No storage yet; structure only.
4. **Debug log:** `EIR_DEBUG=1` prints `[eir] captured: <selector> on <route>` / `[eir] outcome: click OK`. Proof of interception without behavior change.
5. **The invisibility proof (the phase's real test):** run the full Phase 1 suite twice — vanilla import vs eir import. Assert: identical pass/fail, timing delta within noise (<5%), auto-waiting still works (a spec that *depends* on auto-wait, e.g. clicking a button that appears after delay, passes wrapped).
6. Unit tests (Vitest): wrapper delegation, chain composition, imperative/interrogative classification table.
7. Publish `playwright-eir@0.1.0`.

### Understanding Gate
- How `base.extend` fixture override works (Aayush explains it back).
- Why interrogatives are pass-through even at the *logging* level design (they'll never heal — §7.4).
- What "invisibility" means operationally (the twice-run proof).

### OUT
Fingerprinting, `page.evaluate` of any kind, storage, any reaction to failure beyond logging it. If a failure-handling idea appears — `NOTES.md`.

### Definition of Done
- [ ] One-line import swap on the reference suite: all specs green, unchanged results
- [ ] Invisibility proof documented in `packages/eir/docs/invisibility.md` with timings
- [ ] Auto-wait-dependent spec passes wrapped
- [ ] `EIR_DEBUG=1` shows capture + outcome lines for every selector in one spec run
- [ ] Unit tests cover the full method surface classification; CI green
- [ ] `0.1.0` on npm; tag `phase-2-done`

### Post-Phase TS Tip (intermediate) — *Method signatures stolen honestly: `Parameters<>` and `ReturnType<>`*
Open `EirLocator`. Wrapped methods declare their arguments as:
```ts
click(...args: Parameters<Locator["click"]>): ReturnType<Locator["click"]>
```
In scratch, extract any function's parameter tuple with `Parameters<typeof fn>`. Eir never hand-copies Playwright's option types — it *derives* them, so a Playwright upgrade that changes `click` options flows through automatically. Utility types = types computed from other types.

---

# PHASE 3 — Fingerprint Capture & Store

**Objective:** Successful imperative actions produce fingerprints; fingerprints persist to `.eir/` as one JSON file per route (Q8); parallel workers don't corrupt anything. After a green run, the baseline exists on disk and its diffs are human-readable.

**Why now:** Record mode must exist before heal mode can (Blueprint §5.1) — and before Phase 4, because the benchmark's calibration run *is* a record-mode run.

### Pre-Phase TS Tip (intermediate) — *`unknown` at the browser boundary*
```ts
const data: unknown = JSON.parse('{"tag":"input"}');
// data.tag ❌ — compiler refuses until you prove the shape
function isFingerprint(x: unknown): x is { tag: string } {
  return typeof x === "object" && x !== null && "tag" in x;
}
if (isFingerprint(data)) console.log(data.tag); // ✅ narrowed
```
Run it. `page.evaluate()` returns data from a *different JavaScript world* (the browser); Eir treats every such return as `unknown` and narrows via type-guard functions. This single discipline is why the engine won't crash on malformed captures. `x is T` is a **type predicate** — a function the compiler trusts as evidence.

### Work Items
1. **Fingerprint schema** — the first Blueprint §10.2 open question, closed here. Briefing + decision session on exact fields (per §7.2 kinds): tag; stable attrs; text (trim/truncate limits decided); label association; ancestor chain (settle hop count, default 3); sibling context; quantized bbox (settle grid, default 32px). Schema versioned (`v: 1`). Documented in `docs/fingerprint-schema.md` *before* code.
2. **In-page capture script:** a single self-contained function passed to `page.evaluate` against the resolved element handle; returns plain JSON; Tailwind-noise class filtering; nothing user-data-ish (P7). Runs **post-success, fire-and-forget** — a capture failure logs and never fails a test.
3. **Normalizers** (pure functions, unit-test goldmine): route normalization (`/plan/42/edit` → `/plan/:id/edit`, numeric + uuid segment heuristics, config override) and selector normalization (dynamic literal → `{TEXT}` template + instance param — the f-string lesson).
4. **Store:** in-memory map during run; per-route JSON files (`.eir/routes/plan-tarrif__create.json`); pretty-printed, key-sorted (diff-stability); atomic write via temp-file rename; worker shard files merged in `globalTeardown` (last-write-wins per selector).
5. Wire capture into Phase 2's success shells. `EIR_DEBUG` now also prints `fingerprinted: <selector>`.
6. Unit tests: normalizers (table-driven), schema guards, shard merge; integration: full reference run → assert `.eir/` contents match expected routes/selector counts, size within envelope.

### Understanding Gate
- The schema, field by field — Aayush signs off on `docs/fingerprint-schema.md` explicitly.
- Why capture is fire-and-forget (an observability layer must never cause the failure it observes).
- Why files are key-sorted (git-diff reviewability is a *feature* — P5/§7.3).

### OUT
Any reading of fingerprints for matching. Failure-time DOM capture. Confidence anything. The mutation engine.

### Definition of Done
- [ ] Green reference run produces `.eir/routes/*.json`; one file per route; all specs' selectors present
- [ ] Second identical run produces **zero diff** (determinism check)
- [ ] A deliberate app-text tweak produces a minimal, human-readable one-field diff
- [ ] 4-worker parallel run: no corruption, merge correct
- [ ] Store size for the reference suite < 500 KB
- [ ] Normalizer unit tests table-driven and green; CI green; tag `phase-3-done`

### Post-Phase TS Tip (intermediate) — *`satisfies`, spotted in the store code*
```ts
const defaults = { ancestorHops: 3, bboxGrid: 32 } satisfies EirConfig;
```
Versus `: EirConfig`, `satisfies` checks conformance **without widening** — `defaults.bboxGrid` stays literal `32`, not `number`. Find it in `config.ts`; change `32` to `"32"` and watch the compiler object while the inferred literal types remain intact elsewhere.

---

# PHASE 4 — Mutation Engine & Benchmark Harness

**Objective:** The judge exists before the defendant (Q1). Seeded, reproducible mutations of the demo app; a harness that runs calibration → mutated runs and classifies outcomes against ground truth; a baseline report showing how badly the *unhealed* suite breaks per mutation class.

**Why now:** From Phase 5 onward, every matcher decision gets a number instead of an opinion. Building the harness against a not-yet-healing engine also proves outcome classification independently (everything should classify as `missed` now).

### Pre-Phase TS Tip (intermediate) — *Discriminated unions: outcomes that can't lie*
```ts
type Outcome =
  | { kind: "healed-correct"; confidence: number }
  | { kind: "healed-wrong";  confidence: number; matchedWrong: string }
  | { kind: "suggested";     confidence: number }
  | { kind: "missed" };

function score(o: Outcome) {
  switch (o.kind) {
    case "healed-wrong": return o.matchedWrong; // ✅ only legal here
    case "missed": return null;                 // o.confidence ❌ doesn't exist
  }
}
```
Run it; try accessing `o.matchedWrong` under `"missed"`. The `kind` field *discriminates* — the compiler narrows per branch. Phase 4's entire results pipeline is built on this union; a `missed` outcome carrying a confidence is unrepresentable, which is exactly what "honest results" means at the type level.

### Work Items
1. **Mutation taxonomy implementation** (Blueprint §7.8), each a pure transform on `domProfile.ts` + component templates: `id-rename`, `wrapper-inject`, `sibling-reorder`, `text-change`, `tag-swap`, `class-shuffle`, plus `compound-release` (seeded mix). Seeded PRNG; same seed → identical mutation, always.
2. **Ground truth:** every mutation emits `{ oldElementKey → newElementKey }` mapping (the profile-driven design from Phase 1 makes this nearly free — this is that concession paying off).
3. **Harness runner:** for each (mutation-class × seed): reset app → calibration run (record mode, green) → apply mutation → run suite → collect per-selector outcomes via the eir debug/artifact channel → classify against ground truth into the §7.8 outcome classes.
4. **Report generator:** markdown + JSON table — per mutation class: total selectors affected, heal rate, false-heal rate, suggestion rate, miss rate. Renders the README table format from day one.
5. **Baseline run committed:** current engine (no matcher) → near-100% `missed`. This number is the "before" picture the final README contrasts against.
6. Unit tests: mutation determinism (same seed twice → identical output), ground-truth mapping integrity, classifier logic.

### Understanding Gate
- Why ground truth must come from the mutator, not from human judgment (§7.8).
- The outcome-class definitions — especially why `healed-wrong` is tracked separately and prominently (P4).
- Why baseline-without-healing is worth committing.

### OUT
Any matching logic "just to see a heal happen." Threshold tuning. Gemini anything.

### Definition of Done
- [ ] `pnpm bench --class id-rename --seed 42` runs end-to-end and re-runs byte-identically
- [ ] All 6 classes + compound implemented, each with ≥ 8 distinct affected selectors in the app
- [ ] Ground-truth mapping emitted and validated for every class
- [ ] Baseline report committed: all-miss confirmed, table renders correctly
- [ ] Classifier + determinism unit tests green; CI runs one fast bench class; tag `phase-4-done`

### Post-Phase TS Tip (intermediate) — *Generics, met naturally in the harness*
The report aggregator signature reads something like:
```ts
function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Record<K, T[]>
```
In scratch, write your own `firstOrNull<T>(arr: T[]): T | null` and call it with numbers, then Outcomes. Generics are type *parameters* — the harness groups outcomes, the store could group fingerprints, one function serves both without `any`. If you can read `<T, K extends string>`, you can now read most library source.

---

# PHASE 5 — Matching Engine & Failure Triage

**Objective:** The heart. Eligible failures trigger the three-stage funnel (candidates → weighted feature scores → decision margin), producing match + confidence + suggested selector. Tuned against Phase 4 until the results table is respectable *and honestly understood*. This phase is where the 10–15 days earn their name.

**Why now:** Everything it needs exists: fingerprints (P3), failures to triage (P2's shells), and a judge (P4). Matching built earlier would have been tuned by vibes — the exact failure mode Q1-B was chosen to prevent.

### Pre-Phase TS Tip (intermediate) — *Pure functions + `readonly`: why the scorer is a testing dream*
```ts
type Weights = Readonly<Record<FeatureName, number>>;
function scoreCandidate(fp: Readonly<Fingerprint>, cand: Readonly<CandidateFeatures>, w: Weights): number
```
`Readonly<>` makes mutation a compile error — the scorer *cannot* corrupt its inputs, so identical inputs give identical outputs, forever. Run a scratch demo mutating a `readonly` field. Every scoring function in this phase is pure; that's what makes Vitest table-tests and weight-tuning sane.

### Work Items
1. **Failure triage gates** (§7.4), in order, each a small pure predicate: fingerprint exists → page sane (route matches bucket, document loaded, not an error page) → failure species is zero-match/detached → method imperative. Every gate rejection logged with reason.
2. **Transient DOM capture at failure:** one `page.evaluate` pulling candidate features for same-tag + tag-swap-equivalent elements (§7.5.1) — tens of candidates, features aligned with the fingerprint schema. Never persisted (P7).
3. **Feature scorers** — one pure function per dimension, each 0–1: attribute overlap (id/testid/name ≫ class tokens), text similarity (normalized Levenshtein + token overlap), label match, ancestor-chain similarity, sibling position, bbox proximity. Table-driven unit tests per scorer *before* integration.
4. **Weighted aggregate + decision margin:** confidence = f(topScore, gap-to-runner-up). Initial hand weights committed with a comment: *"v0 — expected wrong; see tuning log."*
5. **Suggested-selector generator:** robustness preference order (§5.3), with uniqueness verification against the live DOM (closes Blueprint §10.6).
6. **The tuning loop (the phase's soul):** run benchmark → read per-class heal/false-heal → adjust weights/margins → rerun. Each iteration logged in `docs/tuning-log.md`: what changed, hypothesis, measured delta. Minimum 5 documented iterations. *The tuning log is a portfolio artifact* — it's the visible proof of thinking.
7. Wire into the shells: for now the pipeline's output is **recorded, not acted on** (no retry yet — that's policy, Phase 6). Outcome classification in the harness flips from all-`missed` to real numbers.

### Understanding Gate
- Each feature scorer's intuition, explained back by Aayush ("what does ancestor similarity protect against that attributes don't?").
- Decision margin: why 0.91-vs-0.89 is dangerous and 0.91-vs-0.55 is not (the two-tables page will demonstrate it live).
- The tuning-loop protocol before iteration 1 begins.

### OUT
Retry/heal-and-continue behavior (Phase 6). Thresholds as *policy* (measured here, enacted there). Reporter UX. Gemini — even when a class scores badly and the temptation appears; park it.

### Definition of Done
- [ ] All triage gates implemented, unit-tested, rejection-logged
- [ ] Six feature scorers pure + table-tested; aggregate + margin implemented
- [ ] Suggested selectors verified unique against live DOM
- [ ] ≥ 5 tuning iterations in `docs/tuning-log.md` with measured deltas
- [ ] Benchmark table shows real per-class numbers; false-heal rate measured (not assumed) per class
- [ ] The two-similar-tables case documented: current behavior + why
- [ ] CI green; tag `phase-5-done`

### Post-Phase TS Tip (intermediate+) — *Exhaustiveness with `never`, in the triage code*
```ts
function assertNever(x: never): never { throw new Error(`unhandled: ${x}`) }
switch (gate.kind) { /* ...all cases... */ default: assertNever(gate); }
```
Find this in the triage switch. Add a hypothetical new gate kind to the union in scratch and watch every switch that lacks a case turn red *at compile time*. In a policy-heavy codebase, `never`-exhaustiveness is how you add states without silently forgetting a handler.

---

# PHASE 6 — Policy & Reporting

**Objective:** Matches become behavior and become visible. Threshold state machine with **`suggest-only` default** (Q6); heal-and-continue opt-in; Playwright custom reporter with run-end heal table, JSON+markdown artifacts, and healed-element screenshots.

**Why now:** Policy without measured confidence would have been guesswork; now thresholds are set from Phase 5's measured distributions (justified in writing — Blueprint §9.3).

### Pre-Phase TS Tip (intermediate) — *Making invalid configs unrepresentable*
```ts
type EirMode =
  | { mode: "suggest-only" }
  | { mode: "heal"; healThreshold: number; suggestThreshold: number };
```
A `suggest-only` config *cannot carry* thresholds it would ignore; a `heal` config *cannot omit* them. Run a scratch check constructing the illegal combos. This is the same discriminated-union move as Phase 4, now applied to user-facing configuration — the config file's shape teaches the tool's philosophy.

### Work Items
1. **Policy state machine** (§7.6): per-confidence action; defaults derived from Phase 5 distributions with a written justification in `docs/thresholds.md`; `suggest-only` as shipped default; retry-once semantics for heal mode (healed retry failing → normal failure, both facts reported).
2. **Test annotations:** healed tests visibly marked via Playwright annotations — never silent (P3).
3. **Custom reporter:** run-end table (route | old selector | suggestion | confidence | action taken); artifacts `eir-report.json` + `eir-report.md`; `element.screenshot()` of healed/suggested element captured at match time, linked from the report.
4. **Config surface:** `eir.config.ts` — mode, thresholds, route-normalization overrides, debug. Documented with examples.
5. Harness upgrade: benchmark now runs in both modes; results table gains an "action" dimension.
6. Unit tests: state machine truth table (every confidence band × mode → expected action), config validation.

### Understanding Gate
- The threshold-justification write-up (Aayush approves the defaults knowing the distributions behind them).
- Retry-once semantics and its failure story.
- Why the screenshot is disproportionately valuable (trust artifact, §7.7).

### OUT
CI/PR-comment delivery (Phase 7). Gemini. README polish.

### Definition of Done
- [ ] `suggest-only` provably never retries (unit + integration assertion — Blueprint §9.2)
- [ ] Heal mode: high-confidence benchmark case retries and passes, visibly annotated
- [ ] State-machine truth table fully unit-tested
- [ ] Reporter artifacts generated on every run; screenshots attached; markdown renders cleanly
- [ ] `docs/thresholds.md` justifies defaults from measured data
- [ ] Tag `phase-6-done`

### Post-Phase TS Tip (intermediate) — *Module boundaries: what `exports` hides*
`playwright-eir` exposes exactly three things: `test`, `expect`, `defineEirConfig`. Everything else — scorers, store, wrappers — is internal, unreachable even if a user tries a deep import, because the package.json `exports` map doesn't list those paths. In scratch, try importing an unexported internal from the installed stub and read the resolver error. API surface is a *decision*, and the exports map is where TypeScript packaging enforces it.

---

# PHASE 7 — CI Integration

**Objective:** The demo-reel moment: a PR whose UI change breaks selectors gets a single, auto-updated comment — *"3 selectors healed on /plans/create — suggested diffs below."* Dogfooded on the Eir repo itself.

### Pre-Phase TS Tip (basic→intermediate) — *Node vs browser code in one package*
Eir contains three execution worlds: Node (store, reporter), browser via `evaluate` (capture script), and now CI (the action). In scratch, note what breaks if you `import fs` in code destined for `page.evaluate`. The capture script's isolation (one self-contained function, no imports) from Phase 3 was this constraint in disguise — now it becomes explicit as the action gets its own tsconfig target.

### Work Items
1. **`packages/ci-action`:** a composite GitHub Action / CLI that reads `eir-report.json`, renders the markdown comment (diff blocks: `- old` / `+ suggested`, confidence, screenshot links), and **upserts one comment** per PR (find-and-update by marker, never spam).
2. **Dogfood workflow in the Eir repo:** a demo workflow that applies a benchmark mutation to the demo app on a branch, runs the suite in suggest-only, and posts the comment on the PR. This doubles as Blueprint §9.1.4's reproducible demo.
3. Handle the no-heals case gracefully (comment updates to "no suggestions" or removes itself).
4. Docs: `docs/ci.md` — copy-paste workflow snippet for adopters.

### Understanding Gate
- Upsert-not-append commenting, and why comment spam kills adoption.
- Token/permission model of a PR-commenting action (minimal `pull-requests: write`).

### OUT
Gemini. Marketplace publication of the action (post-project polish, `NOTES.md`).

### Definition of Done
- [ ] A real PR on the repo shows the Eir comment with ≥ 2 suggestion diffs and screenshots
- [ ] Second push to the same PR *updates* the comment (no duplicates)
- [ ] No-heal PR handled cleanly
- [ ] `docs/ci.md` snippet works on a clean fork; tag `phase-7-done`

### Post-Phase TS Tip (intermediate) — *Template literal types, one elegant real use*
The comment marker is typed as:
```ts
type EirMarker = `<!-- eir-report:${string} -->`;
```
A function accepting `EirMarker` rejects a plain string at compile time — the "find my own comment" logic can't be handed a malformed marker. Try constructing valid/invalid markers in scratch. Small feature, disproportionate safety in string-protocol code.

---

# PHASE 8 — Gemini Fallback + Comparison Benchmark

**Objective:** The flag-gated LLM assist (Q5): invoked **only** when heuristics genuinely cannot decide (below suggestion threshold, or margin too thin to trust), receiving fingerprint + candidate shortlist — never raw DOM. Benchmarked against heuristics-only on accuracy, cost, latency. Off by default.

**Why now / conditional:** Last substantive phase by design — it needs final heuristics as its baseline, and per §0.2's slippage rule it descopes to a documented extension point if the schedule demands. "Only when genuinely not possible by the algorithm" (your words) is implemented literally: the trigger condition *is* the heuristic engine's formal admission of uncertainty.

### Pre-Phase TS Tip (intermediate) — *Typed async boundaries and schema validation*
```ts
const res: unknown = await callGemini(prompt);
const parsed = GeminiVerdict.safeParse(res);   // zod schema
if (!parsed.success) return { kind: "fallback-invalid" };
```
An LLM response is the least trustworthy data in the entire system — `unknown` + runtime schema validation (zod) + a discriminated failure outcome. Run a scratch zod example with a deliberately malformed object. Phase 3's browser-boundary discipline, now applied to an AI boundary.

### Work Items
1. **Trigger contract:** fallback fires only on `suggested-but-uncertain` / `missed-with-candidates` outcomes; documented predicate; heal-and-continue can *never* be driven by a fallback verdict alone in v1 (LLM output caps at suggestion strength — P4 applied to AI).
2. **Prompt design:** fingerprint + top-N candidate feature summaries + task ("which candidate, or none, and why") → strict JSON verdict; zod-validated; invalid → treated as no-verdict.
3. **Config:** `fallback: { provider: "gemini", apiKeyEnv: "GEMINI_API_KEY", enabled: false }` — off by default; graceful no-key behavior; never runs in the default CI path.
4. **Comparison benchmark:** harness runs heuristics-only vs hybrid across all mutation classes; table adds columns: accuracy delta, added latency per invocation, token cost per run. Committed as `docs/hybrid-comparison.md`.
5. **The honest verdict written down:** wherever the LLM doesn't beat heuristics, say so plainly — that finding is *more* interview-valuable than a win.

### Understanding Gate
- The trigger predicate (when the algorithm formally "gives up").
- Why LLM verdicts are suggestion-capped in v1.
- Cost model: expected invocations per benchmark run × token estimate, agreed before the first API call.

### OUT
LLM in the primary path (permanent non-goal). Provider abstraction beyond a thin interface. Prompt-tuning ratholes — two prompt iterations max, then ship the numbers.

### Definition of Done
- [ ] Fallback provably never fires above the uncertainty predicate (unit-tested)
- [ ] Disabled/no-key modes clean; default CI path makes zero API calls
- [ ] Comparison table complete across all classes: accuracy, latency, cost
- [ ] `docs/hybrid-comparison.md` states the honest verdict; tag `phase-8-done`

### Post-Phase TS Tip (intermediate) — *Interface as seam: the provider boundary*
```ts
interface FallbackProvider { judge(ctx: FallbackContext): Promise<FallbackVerdict> }
```
Gemini implements it; so does the `NullProvider` used in tests (instant, deterministic verdicts — no network in unit tests). Find both in the code. One interface, two implementations, and the entire fallback system became testable offline. This is dependency inversion in four lines, and it's the pattern interviewers ask juniors to explain.

---

# PHASE 9 — Hardening, Docs, Release

**Objective:** Blueprint §9 executed line by line. The README with the honest results table, the 2–3 minute demo path, npm release, and the career artifacts.

### Pre-Phase TS Tip (basic, deliberately) — *Read your own `.d.ts`*
Run the build and open `dist/index.d.ts`. That generated file *is* your public API as consumers' editors see it. If anything in it surprises you, the exports map or a type leak needs fixing — the declaration file is the final code review. (You now read TS declaration files, which three weeks ago was the intimidating part of every node_modules dive.)

### Work Items
1. **Blueprint §9.2 acceptance sweep:** every behavioral criterion executed as a real test where not already covered (never-fingerprinted fails vanilla; interrogatives never heal in any config; no source modification ever; size envelope; 4-worker integrity) — checklist committed with links to the proving tests.
2. **README (the product page):** what/why in 10 lines → one-line install + import swap → the honest results table (per-class heal + false-heal, compound scenario, hybrid comparison) → **failure-mode analysis in prose** ("heals X% of attribute renames but only Y% of structural rewrites, because…") → demo path → config reference → architecture sketch.
3. **Demo path rehearsed:** clone → install → calibrate → mutate → heal suggestion appears locally and on a PR — timed under 3 minutes, scripted in `demo/README.md`.
4. **Release:** version bump (0.x, semver-honest), changelog from conventional commits, npm publish, GitHub release with the results table.
5. **Career artifacts:** the XYZ bullet drafted from measured numbers; a 5-minute interview walkthrough script (broken selector → fingerprint → funnel → confidence → PR comment); `docs/tuning-log.md` and `docs/hybrid-comparison.md` linked prominently as "how I thought" evidence.
6. Final pass on all docs by Aayush — anything he can't explain gets a session before release, not a footnote after.

### Definition of Done — **Project Done**
- [ ] Every Blueprint §9.1 deliverable exists; every §9.2 criterion has a passing proof; §9.3's honesty bar met in the README
- [ ] `npm i playwright-eir` + import swap works on a clean external Playwright project (tested on a throwaway repo, not just the monorepo)
- [ ] Demo path executes under 3 minutes from clean clone by following the script exactly
- [ ] Results table published with failure analysis; tuning log public
- [ ] Resume bullet + interview script drafted; tag `v0.x.0`, `project-done`

### Post-Phase TS Tip (closing) — *The inventory of what you now know*
Grep the codebase for each of these and explain one usage of each out loud: `interface` vs `type`, `as const`, `keyof typeof`, `Parameters<>`, `unknown` + type predicates, `satisfies`, discriminated unions, generics, `Readonly<>`, `never`-exhaustiveness, exports-map API design, template literal types, zod at async boundaries, interface-as-seam. That list *is* a working TypeScript engineer's toolkit — and every item now has a concrete home in a project you can defend line by line. The gap you flagged is closed with shipped evidence, which was the point all along.

---

## Appendix A — Standing Cadence (every working day)
1. Open with: current phase, current work item, any parked `NOTES.md` items to triage.
2. Claude briefs before writing; Aayush gates; Claude writes; Aayush reviews the diff and asks "explain X" freely — unexplained code is a defect.
3. Close with: commit(s) pushed, CI state, one-line progress note in `NOTES.md`.

## Appendix B — Anti-Leakage Quick Reference
| If you're tempted to… | It belongs to |
|---|---|
| React to a failure in Phase 2 | Phase 5 |
| Read a fingerprint in Phase 3 | Phase 5 |
| "Just try one heal" in Phase 4 | Phase 5 |
| Retry an action in Phase 5 | Phase 6 |
| Post to a PR in Phase 6 | Phase 7 |
| Call Gemini when a class scores badly in Phase 5 | Phase 8 |
| Polish the README mid-build | Phase 9 |

*Next document: `CLAUDE.md` — the working agreement encoding §0.1's rules, the gate protocol, and the coding conventions Claude follows while writing Eir.*
