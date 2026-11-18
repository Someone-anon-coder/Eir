# Healer Comparison — playwright-eir vs Playwright's healer agent

Every number below traces to
[`packages/benchmark/reports/healer-comparison.json`](../packages/benchmark/reports/healer-comparison.json)
(rendered as [`healer-comparison.md`](../packages/benchmark/reports/healer-comparison.md)),
generated from the per-run records by `pnpm --filter benchmark bench:healer-report`.
Cost is the Claude Code CLI's own `total_cost_usd`, never computed from tokens.
Where a figure is my reading of a transcript or diff rather than a harness
output, it says so.

**Run:** 2026-11-18, Playwright 1.65.1, Claude Code CLI 2.1.318, model
`claude-sonnet-5-5` (the agent file says `model: sonnet`; the CLI resolved it,
and the harness recorded the actual ID on every run), seed 42, healer agent
file SHA-256 `7ace70bc…ccdf8` (unedited output of `npx playwright init-agents
--loop=claude`). 92 targets, 3 healer runs each (276), 1 Eir run each plus an
Eir repeat on 16 targets.

## What was compared, and why

Playwright 1.56 added an LLM **healer**: it runs failing tests, inspects the
live page through an MCP server, and **edits the test file** until the test
passes, or marks it `test.fixme()` if it decides the app is wrong. Its shipped
instructions let it change assertions and expected values, and tell it to "do
the most reasonable thing possible to pass the test." Eir is built the other
way round: deterministic, fingerprints while green, never edits user source,
never heals a query method, first priority a 0% false-heal rate.

Four questions, answered with numbers from runs:

1. **Recovery:** how often does each tool get a broken test working against the
   _right_ element?
2. **Safety:** how often does each produce a green test that is wrong (wrong
   element, or a weakened assertion)?
3. **Honesty under real regressions:** when the app is actually broken, does
   the test stay red?
4. **Cost and stability:** what does the healer cost, and does it fix things
   the same way twice?

## Methodology

**Same breakages.** Both tools face the identical mutated Ward, built from the
seeded payload (seed 42) on dedicated ports. Each target has one standalone
vanilla `@playwright/test` spec with a frozen selector, an interaction, and a
post-condition assertion that passes on unmutated Ward. Every one of the 92
specs passed on a control run and failed on its mutated build (0
mutation-ineffective), so no target is excluded.

**Healer, as an adopter runs it.** Playwright's own heal prompt ("Run all my
tests and fix the failing ones.", read from the installed package) addressed to
`playwright-test-healer` through `claude -p`, edits auto-accepted, MCP config
from the generated `.mcp.json` only, tools limited to what the agent file
declares, `--setting-sources project`. Each run gets a fresh temp workspace
**outside the repo** holding one spec, a config, the agent files and
`node_modules` symlinks. No Ward source, benchmark source, ground truth or
payload. The healer always runs against the **blind** build.

**Eir, as an adopter runs it.** The same specs with the one-line import swap,
`heal` mode, default thresholds (0.7 / 0.3), fallback off, fingerprints
captured on a green control run into a gitignored store (never
`packages/demo-app/.eir/`). Each run starts from a pristine copy of that store.

**Judge.** After each healer run the final spec is re-run against the blind
build and against a **marked** build of the same mutation (`VITE_EIR_GT_MARKERS=1`
adds `data-eir-gt` element keys; a local collector records which marked element
each click/input/change landed on), and the spec is statically diffed against
its original with the TypeScript compiler API. The existing
`groundTruth.ts` / near-duplicate bounding-box method only identifies elements
for `near-duplicate-sibling-swap`; elsewhere "healed-correct" in the standing
baseline means "cleared the heal bars", not "acted on the right element", so
the marker is used for every class. A near-duplicate twin needs no separate
decoy attribute: it carries its own element key. Eir cannot see the marker (it
is outside the fingerprint allow-list), and the proof is empirical: the 8-class
seed-42 baseline is byte-identical on a marked build.

**Isolation choice and its implication.** The healer sees a test repo
separate from the app repo, as in a team where QA owns the tests and cannot
read the frontend source. A healer working in the same repo as the app could
read component code and may do better; this comparison does not measure that.

**Shared suite config.** Both tools run under the benchmark's own bounds (8 s
test timeout, 5 s action timeout), uniformly.

## Results

Per run; `infra-error` runs would be excluded (there were **0**, and 0 retries).
Counts sit beside every percentage in the generated report; this table is the
same data.

| Class                       | Healer runs |  Healer correct | Healer wrong element | Healer tamper-flagged | Healer `fixme` | Healer needs review | Eir (targets) correct | Eir wrong |
| --------------------------- | ----------: | --------------: | -------------------: | --------------------: | -------------: | ------------------: | --------------------: | --------: |
| id-rename                   |          24 |              24 |                    0 |                     0 |              0 |                   0 |                6 of 8 |         0 |
| text-change                 |          24 |              24 |                    0 |                     0 |              0 |                   0 |                7 of 8 |         0 |
| tag-swap                    |          24 |              21 |                    0 |                     0 |              3 |                   0 |                7 of 8 |         0 |
| class-shuffle               |          24 |              19 |                    0 |                     0 |              0 |                   5 |                2 of 8 |         0 |
| sibling-reorder             |          24 |              17 |                **7** |                     0 |              0 |                   0 |                0 of 8 |         0 |
| wrapper-inject              |          24 |              24 |                    0 |                     0 |              0 |                   0 |                8 of 8 |         0 |
| near-duplicate-sibling-swap |          24 |              24 |                    0 |                     0 |              0 |                   0 |                2 of 8 |         0 |
| compound-release            |          72 |              64 |                **7** |                     1 |              0 |                   0 |              10 of 24 |         0 |
| real-regression             |          21 |               0 |                    0 |                     0 |             21 |                   0 |                0 of 7 |         0 |
| flow-change                 |          15 |              15 |                    0 |                     0 |              0 |                   0 |                0 of 5 |         0 |
| **All**                     |     **276** | **232 (84.1%)** |        **14 (5.1%)** |          **1 (0.4%)** |  **24 (8.7%)** |        **5 (1.8%)** |          **42 of 92** |     **0** |

Eir is deterministic, so it is reported per target (its repeat run matched run
1 on 16 of 16 targets). Eir cannot tamper by construction (it never edits a
spec): its tamper, `fixme` and out-of-bounds counts are **0**, not N/A. Its
non-heals are all `still-failing`, with these sub-reasons over the 92 targets'
first runs: 24 `suggest-only`, 21 `no-attempt`, 4 `drift-suspected`, 1
`heal-rejected`.

### 1. Recovery

On this benchmark the healer recovers more than Eir everywhere Eir is limited
by design, and Eir recovers nothing the healer misses:

- **Complementarity matrix, per target** (Eir result x healer majority of 3
  runs, 92 targets): Eir correct and healer correct on **42**; Eir not healed
  and healer correct on **36**; Eir not healed and healer `fixme` on **8**
  (7 real regressions plus one tag-swap, below); Eir not healed and healer
  wrong-element on **5**; Eir not healed and healer needs-review on **1**.
  There is no target where Eir healed and the healer's majority failed.
- **Eir's known weak spots, tested directly:**
  `class-shuffle` healer 19 of 24 correct (Eir 2 of 8; the other 5 runs are
  review cases, see below); `near-duplicate-sibling-swap` healer 24 of 24
  (Eir 2 of 8); `sibling-reorder` healer 17 of 24 correct but 7 wrong-element
  (Eir 0 of 8, all misses); `compound-release` healer 64 of 72 (Eir 10 of 24).
  The healer recovers most of them. The `sibling-reorder` recovery is the one
  with a safety cost, below.
- **`flow-change`** (structural changes beyond Eir's design scope): healer 15
  of 15, Eir 0 of 5. This class existed to test complementarity honestly, and
  the healer handles it.

### 2. Safety

This is where the tools differ most, and it is unfavourable to the healer:

- **14 of 276 healer runs (5.1%) were false heals**: green, on the wrong
  element. All 14 are in `sibling-reorder` (7 of 24 runs) and the
  `sibling-reorder` targets inside `compound-release` (7 of 72). Eir produced
  **0 wrong heals** in all 108 runs. Eir paid for that with misses.
- **The mechanism, from the diffs and comments (my reading, not a harness
  output):** the original spec edits row N or the first action of a row; after
  the reorder the healer concludes the data "lives" somewhere else (for
  example, the comment says K. Nguyen's device is in the archived table),
  re-points the action at that other row, and rewrites the post-condition's
  locator to match. The assertion's matcher and arguments are unchanged, so an
  assertion diff cannot see it. Only the ground-truth marker caught these. A
  plausible cause I did not verify: the failing test's own first click had
  already acted on the live app during debugging. [Exemplar](healer-comparison/02-false-heal.md).
- **Tampering:** 1 run flagged, and on inspection it is a **false positive of
  the detector**. The healer fixed the action correctly and restated the
  assertion in an equivalent form (`toHaveValue` to `option:checked` +
  `toHaveText`). Counted as flagged because the rules were fixed beforehand;
  genuine assertion weakening observed: **0 of 276**. [Exemplar](healer-comparison/04-tampered-green.md).
  This is a result in the healer's favour that I had not expected: its
  instructions permit changing assertions, and in this run it essentially
  never did.
- **5 `needs-human-review` runs (class-shuffle)**: the healer **deleted the
  failing click** and left only visibility assertions, so the spec passes
  without acting on any element. The assertion diff is clean (no assertion
  changed) and the judge saw no marked element acted on. Removing the failing
  action is not one of the tamper rules, so the harness does not classify it.
  **These need your verdict** (below). [Exemplar](healer-comparison/05-step-removed.md).

### 3. Honesty under real regressions

Both tools kept the test from going falsely green on all 7 `real-regression`
targets.

- **Healer: `fixme` on 21 of 21 runs.** Every run left the assertion alone and
  marked the test `fixme`; I read one run's comment per target and each names
  the actual symptom (for example "clicking Confirm Delete does nothing: the
  dialog stays open"). I did not read all 21. One run's comment also names the
  neighbouring regression, because all 7 regressions are live in one build.
  [Exemplar](healer-comparison/03-fixme.md).
- **Eir: `still-failing` on 7 of 7**, no heal attempt: the selectors still
  resolve, so Eir has nothing to heal. Red stays red.
- **A tag-swap target behaved like a regression.** `tag-swap.provisioning.submitButton`
  turns the submit button into an `<a href="#submit-request">` that has no
  submit handler, so it breaks behaviour as well as the selector. The healer
  marked it `fixme` on 3 of 3 runs, and Eir matched the link but its own
  post-condition verification rejected the heal (`heal-rejected`). Both tools
  declined to call it green. The original benchmark counts this target as a
  correct heal (it measures the match, not the effect).

### 4. Cost and stability

- **Healer cost, CLI-reported:** **$8.78 total** for 276 runs; median $0.0283,
  p90 $0.0443 per run. Mean by class ranges from $0.0239 (id-rename) to
  $0.0396 (sibling-reorder). Turns: median 6, p90 8, max 15. Wall time: median
  20.9 s, p90 33.4 s, 107 minutes of agent time in total. Tokens summed from
  the CLI's usage (input is reported in three parts, so there is no single
  total): 2,550 uncached input, 10,904,660 cache-read, 1,309,756
  cache-creation, 241,459 output. The CLI folds one small `claude-haiku-5-5`
  call into each run's cost; the agent's own model was always
  `claude-sonnet-5-5`. All 276 runs printed a cost; none were cut off by the
  turn cap. On a subscription, the cost that matters is usage allowance; the
  rate-limit status never went past `allowed_warning`.
- **Eir cost:** zero API calls on the default path, a few seconds per run.
- **Stability:** across the 3 runs of each target, the **outcome kind differed
  on 8 of 92 targets**, and the **final locator differed on 26 of 92**
  (normalized text). Most locator differences are equivalent fixes written
  differently (`getByLabel` vs `getByRole("textbox", { name })`). Eir repeated
  16 of 16 targets identically, by construction.

## What these results do not show

These are the threats to validity, and they cut both ways.

- **Bias.** The original 8 classes, the matcher they measure, and Eir were all
  designed by the same person. `real-regression` and `flow-change` were added
  as the counterweight; they are not part of the committed baseline. I (Claude)
  wrote the harness, the specs and the judge, and the healer is the same model
  family; the specs were written to avoid favouring either tool, but they were
  not reviewed by anyone neutral.
- **One app, one model, one seed, one Playwright version.** Ward is small
  (roughly 1,000 lines of source). A healer on a large app has far more page to read.
  Different seeds change which near-duplicate direction is live. Behaviour on
  other Playwright versions is untested.
- **The healer was isolated from the app source** (see Methodology). A same-repo
  healer may do better.
- **Spec design favours measuring matching.** Post-conditions verify through an
  independent route to the element. A spec that asserts through the same stale
  locator it acted through stays **red under Eir even after a correct heal**
  (heal-and-continue retries the action, not later assertions; NOTES.md
  NOTE-015), while the healer rewrites every occurrence. The first version of
  these specs showed exactly that and I changed the specs; real suites that
  assert on the acting locator would score Eir lower than this table.
- **`class-shuffle` is weaker evidence.** The original probes click a container,
  which does nothing observable, so post-conditions only check the page is
  intact, and a click on a container lands on whichever descendant sits at its
  centre. These targets are attributed by marked-ancestor _path_, so a fix that
  selects a descendant of the right container would still count as correct.
- **`sibling-reorder` select targets** are judged on the chosen value: the
  marker can only say the select changed. The unchanged assertion carries the
  correctness there.
- **The assertion diff ignores the receiver.** A healer that edits intent inside
  a locator (for example the row text in a post-condition) is invisible to the
  diff; the marker catches it only when it changes which element was acted on.
- **Two compound targets differ from the standing baseline by design.** The
  baseline labels `compound-release/sibling-reorder.wizard.{resourceSelect,durationSelect}`
  healed-correct; here Eir does not heal them. My specs act with
  `selectOption({ index: 0 })`, which throws nothing, so Eir never gets a failure
  to heal. That is a different probe, not a regression.
- **Real regressions share one build.** All 7 are live together, so two touch
  the wizard and two touch the devices page, and a healer's comment can name
  a neighbouring bug.
- **No `needs-human-review` verdicts have been recorded.** The 5 runs above are
  reported as the harness classified them, unadjudicated.

## The honest verdict

**The tools are complementary, and the data supports that framing, with a
sharper edge than expected.** The healer recovers far more than Eir (84% of
runs correct vs Eir's 46% of targets), including every class Eir is weak at
and all of `flow-change`. It did not weaken a single assertion (0 genuine
of 276), and it marked real regressions `fixme` instead of forcing them green.
That is better behaviour than its instructions suggest. One qualification: in 5
`class-shuffle` runs it deleted the failing step, which my rules do not
classify and which needs your verdict.

But it is not safe to let it merge unreviewed: **it produced 14 false heals in
276 runs (5.1%), all where position carries meaning (`sibling-reorder`)**, and
the failure is a green test pointing at the wrong row. Eir produced none in 108
runs and says so by not healing. On `sibling-reorder` the healer's 71% correct
comes with 29% false heals; Eir's 0% comes with 100% misses. Which trade is
better depends on whether a wrong green or a red test costs more, which is a
team decision this benchmark cannot make.

The healer is not strictly "better everywhere" or "worse on safety
everywhere": it wins on recovery, ties on staying red under real regressions,
and loses on false heals in one class.

Eir's strongest claim stands: **0 wrong heals**, and a deterministic, zero-cost,
suggest-first path. Its limits are as published (class-shuffle,
sibling-reorder, near-duplicate), now with a measured alternative.

### Recommendation

- Use Eir where a wrong heal is unacceptable and the breakage is attribute
  drift it can match; treat its suggestions as the review step.
- Use the healer to clear a backlog of drift and flow changes, **in a branch,
  with its diff reviewed, and with extra scrutiny on any test whose selector is
  positional or that mentions row/order** (the 14 false heals).
- They compose: Eir suggests deterministically and for free; the healer
  handles the structural changes Eir was never built for.
- Review a healer's `fixme` as a bug report. The 24 `fixme` runs cover 8
  targets (7 real regressions and the behaviour-breaking tag swap); I read one
  comment per target and each named a real symptom, but I did not read all 24.

## Reproducing

```bash
pnpm --filter playwright-eir build
pnpm --filter benchmark bench:healer --all --seed 42      # ~280 real Claude runs; see the skill's cost warning
pnpm --filter benchmark bench:healer-report               # refuses to overwrite without --force
```

Raw run records, full transcripts, final specs and the Eir stores live in
gitignored `packages/benchmark/.healer/`. Exemplar diffs:
[`docs/healer-comparison/`](healer-comparison/).
