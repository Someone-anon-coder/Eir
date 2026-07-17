# playwright-eir

Self-healing locator engine for Playwright.

## What it is, and why

Playwright suites break not because the app broke, but because the DOM
reshaped underneath a selector — an `id` gets renamed, a `<button>` becomes
an `<a>`, a class gets reshuffled by a redesign — while a human tester would
still recognize "that's the same button." `playwright-eir` is a drop-in
fixture override that fingerprints every element your suite touches while
it's green, and when a selector later fails, matches the element's new
identity against that stored fingerprint using six deterministic scorers.
Depending on config, it either retries the action against the match
(`heal` mode) or just reports it as a suggestion (`suggest-only`, the
shipped default) — either way, it never silently patches your test files,
never heals a query method (`isVisible`, `count`, …), and a selector it
never fingerprinted fails exactly like vanilla Playwright. Interception is
explicit typed wrapper classes around `Page`/`Locator` — no `Proxy`, no
monkey-patching, no CDP. Everything below is measured against an 8-class,
seeded mutation benchmark; this table states the real numbers, including
where the tool doesn't work, not just where it does.

## Install + the one-line swap

```bash
npm i -D playwright-eir
```

```ts
// before
import { test, expect } from "@playwright/test";

// after
import { test, expect } from "playwright-eir";
```

That's the entire integration. `EirPage`/`EirLocator` structurally
implement Playwright's real `Page`/`Locator` types, so every existing Page
Object, helper function, and `expect(...)` assertion keeps compiling and
behaving identically — measured proof in
[`packages/eir/docs/invisibility.md`](packages/eir/docs/invisibility.md):
15 specs run 3× in each of two conditions (vanilla vs. wrapped), identical
pass/fail every time, ~0.7% timing delta (inside natural run-to-run
jitter), and the one spec that depends on Playwright's real auto-wait
retry loop passes wrapped.

## Prerequisites — read before enabling anything

1. **Set `use.actionTimeout` to a bounded value** (e.g. `5_000`) in your
   `playwright.config.ts`. Without it, a vanished selector runs out your
   suite's full *test-level* timeout (often 30s+) instead of a bounded
   *action* timeout before Eir's triage even gets a chance to look at the
   failure. Eir's triage now recognizes both message shapes (a Phase 9
   fix — see "Known limitations" below), so this is no longer a silent
   dead-engine trap, but it's still the difference between a 5-second
   diagnosis and a 30-second one on every broken selector. Not a footnote.
2. **Wire the reporter**, so healed/suggested outcomes have somewhere to
   land:
   ```ts
   export default defineConfig({
     reporter: [["list"], ["playwright-eir/reporter"]],
   });
   ```
3. **Commit a calibration baseline.** Run your suite green once so
   `.eir/routes/*.json` exists — there is nothing to match a broken
   selector against on the very first run of that selector. Review these
   files in PRs the same way you'd review a snapshot-test update; they're
   small, diffable JSON (see "Fingerprint store" below).
4. **CI wiring is optional but where the real payoff is** — a single
   auto-updating PR comment instead of a local file. See
   [`docs/ci.md`](docs/ci.md) for the exact workflow snippet.

## Results — measured, seed 42, `pnpm bench:all`

| Mutation class | Heal rate | False-heal rate | Suggestion rate | Miss rate |
|---|---:|---:|---:|---:|
| id-rename | 75.0% | 0.0% | 25.0% | 0.0% |
| text-change | 87.5% | 0.0% | 12.5% | 0.0% |
| tag-swap | 100.0% | 0.0% | 0.0% | 0.0% |
| class-shuffle | 25.0% | 0.0% | 75.0% | 0.0% |
| sibling-reorder | 0.0% | 0.0% | 0.0% | 100.0% |
| wrapper-inject | 100.0% | 0.0% | 0.0% | 0.0% |
| near-duplicate-sibling-swap | 25.0% | 0.0% | 75.0% | 0.0% |
| compound-release | 50.0% | 0.0% | 25.0% | 25.0% |

**False-heal rate: 0.0% in every class, every measured run.** This is the
number the project is actually optimized for (Blueprint P4: a false heal —
silently succeeding against the wrong element — is worse than an honest
failure). Heal rate is secondary to that, and two classes below are held to
a **structural** ceiling deliberately, not tuned away.

Full iteration-by-iteration tuning history — including two dead ends
that were kept and reported, not hidden — is in
[`docs/tuning-log.md`](docs/tuning-log.md).

## Failure-mode analysis — why each number is what it is

- **id-rename (75%)** — the 2 unhealed targets are plain `<input>`
  elements with no rendered text; when the `id` mutates, `attrOverlap` and
  `textSimilarity` are both structurally zero, leaving only three lighter
  scorers to reach the confidence bar. Five tuning iterations moved this
  from 0% → 75% by fixing a real architectural bug (scorers un-applicable
  to an element were still eating weight budget as a hard zero — see
  tuning-log Iteration 3); the remaining 25% is a genuine information
  ceiling on a mutation that destroys the one strongest signal a plain
  input ever had.
- **text-change (87.5%)** — the strongest-performing class other than the
  two 100%s; text is a rich, mostly-unique signal and its mutation rarely
  collides with another live element.
- **tag-swap (100%) / wrapper-inject (100%)** — both mutations preserve
  every attribute the fingerprint captures; only structure around the
  element changes, which the scorers were built to shrug off.
- **class-shuffle (25%) — a structural ceiling, not a tuning gap.** Six of
  eight targets are bare container `<div>`/`<section>` elements whose
  *only* identifying feature was ever their own class name — and the
  fingerprint schema deliberately never captures an element's own class
  tokens (only allow-listed attributes plus *ancestor* class tokens; see
  [`docs/fingerprint-schema.md`](docs/fingerprint-schema.md)). No
  combination of the six existing scorers' weights can recover a signal
  that was never captured (tuning-log Iteration 4, a documented negative
  result). Tracked as the schema-v2 candidate in NOTES.md's NOTE-003 —
  not fixed this release, since it means recapturing every baseline.
- **sibling-reorder (0%) — a structural ceiling, different shape.** A
  position-anchored selector (`tbody tr:nth-child(1)`) after a reorder
  doesn't throw — it resolves to *some* row, the click succeeds, and
  Eir's failure-triage funnel (which only runs on a thrown error) never
  starts. A separate mechanism (drift detection on ordinary successes,
  "Mechanism B" below) *detects* this shape on the 4 of 8 targets whose
  action Eir's wrapper actually reaches, flagging `drift-suspected` — but
  detection isn't recovery; the heal rate on this class is honestly 0%.
- **near-duplicate-sibling-swap (25% heal / 75% suggestion)** — this is
  the class built specifically to contain a real, valid, structurally
  similar distractor (e.g. an Edit/Remove button pair, two near-identical
  table rows). 6 of 8 targets stay correctly margin-gated to a suggestion
  (measured margins as thin as 0.0000–0.0268) rather than healing
  confidently and possibly wrong; 2 of 8 clear both the confidence and
  margin bars and heal. Zero false heals. This is precision over recall,
  by design — see "Mechanism A" below for the case where a distractor
  *does* fool the matcher.
- **compound-release (50% / 0% / 25% / 25%)** — several base mutations
  applied at once. The entire 25% miss rate traces to its
  `sibling-reorder` subset (same root cause as above); a real, unplanned
  benefit of running mixed mutations together also showed up here: one
  `text-change` target scored 0.995 confidence — near-perfect — but
  correctly stayed `suggested` because the margin bar caught an emergent
  distractor that compound mutation created and no single-class run would
  have produced (tuning-log Iteration 5).

## Mechanism A — post-condition verification, proven against a real false heal

Confidence and margin are both *pre-action* heuristics — they never check
what retrying the action actually produced. Mechanism A closes that gap:
during calibration, Eir also captures a lightweight, auto-derived
post-condition per action (route changed / DOM element count went up or
down / nothing observable), and after a heal-and-continue retry, compares
the real outcome against what was recorded. A mismatch downgrades the heal
to a rejected failure — the *original* error is what the test fails with,
never the retry's.

This shipped in Phase 6 unit-tested against a mocked matcher, but had never
caught a real, live false heal produced by the actual (unmocked) matching
engine — see NOTES.md's NOTE-005. Phase 9 built exactly that:
[`packages/eir/src/acceptance/note005RealFalseHeal.test.ts`](packages/eir/src/acceptance/note005RealFalseHeal.test.ts)
uses a real Chromium browser, a real HTTP-served page, and the real,
unmocked matching funnel. A near-duplicate button pair ("Delete Item" /
"Archive Item" — one removes a DOM node, the other adds one) is calibrated
on its real target, which is then removed, leaving only the distractor. With
a deliberately permissive threshold (0.2 — far below the shipped 0.7
default; this does **not** contradict the 0.0% measured false-heal rate
above, which is measured at the real default), the real matcher confidently
heals to the wrong element (confidence ≈0.56, reproducible), the retry
genuinely executes against it, and Mechanism A genuinely catches the
mismatch and downgrades to `heal-rejected-post-condition-mismatch`. The
flagship safety mechanism now has a real catch on record, not just a mock.

## The Gemini fallback — off by default, measured, not assumed

Phase 8 built an opt-in LLM second opinion (`fallback: { provider: "gemini",
enabled: true }` + `GEMINI_API_KEY`), structurally suggestion-capped —
there is no code path by which its verdict can move a row from `suggested`
to `healed`, or promote a miss to anything else; it only ever annotates a
row heuristics already decided. Five real comparison runs (74 invocation
attempts, two API keys) found:

- **No measured accuracy benefit on any of the 8 mutation classes,
  including `near-duplicate-sibling-swap`** — every one of the 17 real
  model responses agreed with the heuristic's own already-correct answer.
  **The precise scope**, stated because it matters: the fallback trigger
  only ever fires on a `"matched"` attempt that failed heal qualification.
  A true no-candidate miss, or a failure triage rejected outright, never
  reaches the model in this benchmark, in either mode — so the honest
  claim is "no measured benefit on the cases the fallback was consulted
  about," not "an LLM can't help with misses" (never tested).
- **Free-tier reliability is a real adoption cost**, separate from
  accuracy: 77% of invocation attempts (57 of 74) degraded cleanly to
  `no-verdict` on real rate-limiting — the graceful-degradation contract
  worked exactly as designed, but a free-tier key cannot reliably service
  even this benchmark's small ~21-call run in one sitting.

Full methodology, per-run tables, and the complete honest verdict:
[`docs/hybrid-comparison.md`](docs/hybrid-comparison.md). **Recommendation,
and the shipped default: leave it disabled.**

## Demo path

Scripted, copy-pasteable, in [`demo/README.md`](demo/README.md): clone →
install → run green against the committed calibration baseline → apply a
real seeded mutation → run again → read the suggestion diffs (confidence,
old/new selector, screenshot) straight out of `eir-report.md`.

**Real measured time, this session, clone through suggestion:**

| Stage | Time |
|---|---:|
| clone | <1s |
| `pnpm i` | <1s |
| `pnpm --filter playwright-eir build` | ~2s |
| green calibration run (16 specs) | ~6s |
| generate mutation payload | <1s |
| mutated run → 3 suggestions in `eir-report.md` | ~10s |
| **Total** | **~20s** |

Measured by actually running the script above end-to-end against a real
clone this session — not an estimate. Comfortably under the 3-minute bar.
**Honest caveat:** this machine's pnpm store and Playwright's Chromium
cache were already warm from other work this session, and the clone was
local rather than over a network. A genuinely first-ever run on a cold
machine adds unmeasured, network-dependent time — pnpm resolving the
registry, and (if Chromium has truly never been installed before) a
one-time ~300 MB browser download. That cost is standard for any
Playwright project and isn't something this measurement isolates or
controls for.

## Config reference

```ts
import { defineEirConfig, type EirConfig } from "playwright-eir";

export default defineEirConfig({
  mode: { mode: "suggest-only" }, // shipped default: never retries, ever
  // or:
  // mode: { mode: "heal", healThreshold: 0.7, suggestThreshold: 0.3 },
  fallback: {
    // omit entirely for the shipped default (fallback fully off, zero API calls)
    provider: "gemini",
    enabled: true,
    apiKeyEnv: "GEMINI_API_KEY", // default; the key itself never lives in config
    model: "gemini-2.5-flash-lite", // default
  },
});
```

`EirMode` is a discriminated union — `suggest-only` cannot carry thresholds
it would never use, and `heal` cannot omit them, so illegal states aren't
representable, not just runtime-checked.

| Field | Default | Measured or estimated |
|---|---:|---|
| `healThreshold` | `0.7` | **Measured** — Phase 5's tuning loop, 5 iterations, never found evidence to move it |
| decision margin (internal, not configurable) | `0.05` | **Measured** — the exact bar that catches near-dup's 0.8457-confidence/0.0085-margin knife-edge case |
| `suggestThreshold` | `0.3` | **Estimated** — no benchmark run ever produced a genuinely low-confidence match to calibrate against; labeled honestly as a guess, not a measurement (see `docs/thresholds.md`) |

Full reasoning for every number, including what evidence did and didn't
move it: [`docs/thresholds.md`](docs/thresholds.md).

## Architecture sketch

```
 your test file
      │  import { test, expect } from "playwright-eir"
      ▼
 EirPage / EirLocator            explicit typed wrapper classes around
 (fixture override)              Playwright's real Page/Locator — no
      │                          Proxy, no monkey-patching, no CDP
      ├─ imperative call (click/fill/…) succeeds
      │      │
      │      ▼
      │  fingerprint capture (fire-and-forget, in-page evaluate)
      │      │
      │      ▼
      │  .eir/routes/*.json  ◄── committed, reviewable, ~30 KB on this repo's own suite
      │
      └─ imperative call throws
             │
             ▼
        failure triage (zero-match / detached / interrogative-excluded)
             │
             ▼
        matching funnel — 6 pure scorers against live DOM candidates
        (attrOverlap, textSimilarity, labelMatch, ancestorChain,
         siblingPosition, bboxProximity) → confidence + decision margin
             │
             ├─ below suggestThreshold ──────────────► fail normally
             ├─ between bars ─────────────────────────► suggested
             └─ clears both bars
                    │
                    ├─ suggest-only mode ─────────────► suggested (never retried)
                    └─ heal mode
                           │
                           ▼
                     retry action against the match
                           │
                           ▼
                     Mechanism A: post-condition verify
                           │
                     ┌─────┴─────┐
                  matches      mismatches
                     │             │
                     ▼             ▼
              healed-correct   heal-rejected
                     │             │
                     └──────┬──────┘
                            ▼
                  eir-report.json/.md + screenshots
                            │
                            ▼
                  packages/ci-action → single upserted PR comment
```

## Known limitations

Every item below was triaged deliberately this release, not discovered
after shipping — full detail and evidence in NOTES.md.

- **Capture-point coverage stops at 6 methods.** `.locator()`,
  `.getByRole()`, `.getByLabel()`, `.getByText()`, `.getByTestId()`,
  `.getByPlaceholder()` are tracked and fingerprinted. Chaining through
  `.filter()`, `.first()`, `.last()`, `.and()`, `.or()`,
  `.getByAltText()`, `.getByTitle()`, or `.contentFrame()` returns a real,
  unwrapped Playwright `Locator` — it still works exactly like vanilla
  Playwright, it's just not tracked or fingerprinted. `page.frame()`/
  `page.mainFrame()` are the same story one level up: Playwright's `Frame`
  was never part of Eir's wrapped surface at all, so anything reached
  through a raw `Frame` (including its own `.locator(sel, { has })`) is
  outside this boundary too. This is a permanent, accepted 1.0 boundary,
  not a bug queue — widening it would mean wrapping `Frame` itself, real
  design work with its own Understanding Gate, not a same-release patch.
  (NOTES.md RISK-004)
- **An element's own class tokens are never fingerprinted** — see
  "class-shuffle" in the failure-mode analysis above. NOTES.md NOTE-003 is
  the schema-v2 candidate that would address it.
- **The Gemini fallback has a real free-tier reliability ceiling** — see
  "The Gemini fallback" above. Shipped disabled by default on this
  evidence.
- **This package knowingly forwards a handful of undocumented Playwright
  internals** (`_apiName`, `_expect`, `_expectScreenshot`, `_frame`,
  `_selector`) so `expect(page)`/`expect(locator)` assertions — including
  `toHaveScreenshot()` — work through Eir's wrappers. None of these are
  part of Playwright's public API or its TypeScript types, so there is no
  compile-time contract protecting any of them; each was confirmed working
  via a real spike (success path + failure-message parity, or a genuine
  screenshot comparison), not assumed. CI running against the pinned
  `@playwright/test` peer range on every push is the ongoing tripwire —
  if a future Playwright version renames or restructures any of these, CI
  breaking on that version bump is where to look first, before assuming
  the bug is in Eir's own logic. (NOTES.md RISK-003)
- **`docs/ci.md`'s GitHub Actions snippet has been proven on this repo's
  own PRs and on a real dogfood exercise's findings→clean-state
  transition, not yet from an external fork specifically** — a fork's
  reduced default token permissions are the one class of surprise a
  same-repo test can't rule out. Tracked as NOTES.md NOTE-010.
- GitHub Marketplace publication of `packages/ci-action` (so it can be
  referenced as `uses: owner/eir-ci-action@v1` from any repo instead of a
  local path) is intentionally parked post-release (NOTES.md NOTE-006).

## Post-1.0 roadmap

- **Fingerprint schema v2** — the `class-shuffle` 25% ceiling above is the
  measured cost of a real, deliberate v1 scope decision (an element's own
  class tokens are never captured). Closing it means a schema version
  bump and a migration story for every adopter's existing `.eir/`
  baseline, not a config tweak — real v1.x-cycle design work, not a
  same-release patch. NOTES.md NOTE-003 is the tracking entry this
  roadmap item closes.

## Repository map

```
packages/eir/          the published engine (npm: playwright-eir)
packages/demo-app/     React+Vite "Ward" app + reference Playwright suite
packages/benchmark/    mutation engine, harness, report generator
packages/ci-action/    PR-comment GitHub Action
docs/                  fingerprint schema, thresholds, tuning log,
                        hybrid comparison, CI integration, invisibility proof
demo/                  the timed demo path script
packages/demo-app/.eir/  fingerprint store (committed, generated by green test runs)
```

```bash
pnpm i                        # clean-clone install, one command
pnpm lint && pnpm typecheck   # gates
pnpm test                     # all unit tests
pnpm --filter demo-app dev    # serve Ward
pnpm --filter demo-app e2e    # reference suite
pnpm bench --class <c> --seed <n>   # one benchmark class
pnpm bench:all                # full 8-class table
```

## How this was built

This project was built with an unusual, deliberate process worth pointing
to directly: every phase went through an "Understanding Gate" before code
was written, every non-obvious design call is recorded with its reasoning
in [`NOTES.md`](NOTES.md), and every tuning decision — including the ones
that didn't work — is in [`docs/tuning-log.md`](docs/tuning-log.md) and
[`docs/hybrid-comparison.md`](docs/hybrid-comparison.md). Career-facing
material (resume bullet, interview walkthrough script) is in
[`career/`](career/).

## License

MIT
