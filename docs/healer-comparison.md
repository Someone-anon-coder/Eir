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

After this analysis was first written, a verification pass re-checked the
questionable outcomes (reruns, an identity-anchored spec variant, a trace-based
cross-check of the judge, a spec-intent audit, and the destructive-debugging
hypothesis). It is reported in the Verification pass section below and in
[`healer-verification.md`](../packages/benchmark/reports/healer-verification.md).
The original dataset is the primary result and is not replaced.

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

| Class                       | Healer runs | Healer correct, **strict** (primary) | Healer correct, lenient | Healer wrong element | Healer tamper-flagged | Healer `fixme` | Healer needs review | Eir (targets) correct, strict = lenient | Eir wrong |
| --------------------------- | ----------: | -----------------------------------: | ----------------------: | -------------------: | --------------------: | -------------: | ------------------: | --------------------------------------: | --------: |
| id-rename                   |          24 |                                   24 |                      24 |                    0 |                     0 |              0 |                   0 |                                  6 of 8 |         0 |
| text-change                 |          24 |                                   24 |                      24 |                    0 |                     0 |              0 |                   0 |                                  7 of 8 |         0 |
| tag-swap                    |          24 |                                   21 |                      21 |                    0 |                     0 |              3 |                   0 |                                  7 of 8 |         0 |
| class-shuffle               |          24 |                                **6** |                      19 |                    0 |                     5 |              0 |                   0 |                                  2 of 8 |         0 |
| sibling-reorder             |          24 |                                   17 |                      17 |                **7** |                     0 |              0 |                   0 |                                  0 of 8 |         0 |
| wrapper-inject              |          24 |                                   24 |                      24 |                    0 |                     0 |              0 |                   0 |                                  8 of 8 |         0 |
| near-duplicate-sibling-swap |          24 |                                   24 |                      24 |                    0 |                     0 |              0 |                   0 |                                  2 of 8 |         0 |
| compound-release            |          72 |                                   64 |                      64 |                **7** |                     1 |              0 |                   0 |                                10 of 24 |         0 |
| real-regression             |          21 |                                    0 |                       0 |                    0 |                     0 |             21 |                   0 |                                  0 of 7 |         0 |
| flow-change                 |          15 |                                   15 |                      15 |                    0 |                     0 |              0 |                   0 |                                  0 of 5 |         0 |
| **All**                     |     **276** |                      **219 (79.3%)** |             232 (84.1%) |        **14 (5.1%)** |          **6 (2.2%)** |  **24 (8.7%)** |               **0** |                            **42 of 92** |     **0** |

**`class-shuffle` is on the strict reading, which is the primary figure for both
tools.** The judge's first rule credited a click whose marked-ancestor path
contained the target container (lenient). The strict rule asks what the
Playwright trace shows was resolved, and counts a run correct only if that was
the target container itself. The healer's overall figure is **219 of 276 (79.3%)
strict** and 232 of 276 (84.1%) lenient: the 13 runs between them (all
`class-shuffle`) resolved a card's `<h2>` or the outer `<main>`. Eir's
`class-shuffle` figure is the same on both readings (its two heals were
trace-checked: the retry resolved the target container). This is a reporting
rule; the per-run records keep the judge's original outcomes.

`Healer tamper-flagged` is `tampered-green`: 5 of the 6 are the `class-shuffle`
runs where the healer deleted the failing click (rule `action-removed`,
adjudicated by Aayush); the sixth is the benign equivalent rewrite described
below. These counts include the re-judge described in the Verification pass;
the first judge counted 1 here and left those 5 as `needs-human-review`.

Eir is deterministic, so it is reported per target (its repeat run matched run
1 on 16 of 16 targets). Eir cannot tamper by construction (it never edits a
spec): its tamper, `fixme` and out-of-bounds counts are **0**, not N/A. Its
non-heals are all `still-failing`, with these sub-reasons over the 92 targets'
first runs: 24 `suggest-only`, 21 `no-attempt`, 4 `drift-suspected`, 1
`heal-rejected`.

### 1. Recovery

On this benchmark the healer recovers more than Eir everywhere Eir is limited
by design except `class-shuffle`, where the two are level on the strict reading
(25% each), and Eir recovers nothing the healer's majority misses:

- **Complementarity matrix, per target** (Eir result x healer majority of 3
  runs, 92 targets, strict reading): Eir correct and healer correct on **42**;
  Eir not healed and healer correct on **31**; Eir not healed and healer
  `correct-path-only` on **5** (`class-shuffle`: the healer's majority resolved
  a different element than the target container); Eir not healed and healer
  `fixme` on **8** (7 real regressions plus one tag-swap, below); Eir not healed
  and healer wrong-element on **5**; Eir not healed and healer `tampered-green`
  on **1** (`class-shuffle.nav.layoutClassName`, deleted click).
  There is no target where Eir healed and the healer's majority failed.
- **Eir's known weak spots, tested directly:**
  `class-shuffle` healer **6 of 24 correct on the strict reading** (19 lenient;
  13 further runs resolved a different element, and 5 deleted the failing
  click), Eir **2 of 8 on both readings**. On this class the tools are level.
  `near-duplicate-sibling-swap` healer 24 of 24
  (Eir 2 of 8); `sibling-reorder` healer 17 of 24 correct but 7 wrong-element
  (Eir 0 of 8, all misses); `compound-release` healer 64 of 72 (Eir 10 of 24).
  The healer recovers most of those, but not `class-shuffle`. The
  `sibling-reorder` recovery is the one with a safety cost, below.
- **`flow-change`** (structural changes beyond Eir's design scope): healer 15
  of 15, Eir 0 of 5. This class existed to test complementarity honestly, and
  the healer handles it.

### 2. Safety

This is where the tools differ most, and it is unfavourable to the healer:

- **14 of 276 healer runs (5.1%) were false heals**: green, on the wrong
  element. All 14 are in `sibling-reorder` (7 of 24 runs) and the
  `sibling-reorder` targets inside `compound-release` (7 of 72). Eir produced
  **0 wrong heals** in all 108 runs. Eir paid for that with misses. The
  Verification pass reruns these and splits the 14 by cause: 7 trace to specs
  that identify their row only by position (an identity anchor removes them,
  0 of 15), and 7 reproduce on specs with an unambiguous row.
- **The mechanism:** the healer re-points the action at a different row and
  rewrites the post-condition's locator to match. The assertion's matcher and
  arguments are unchanged, so an assertion diff cannot see it. Only the
  ground-truth marker caught these, and the Playwright trace independently
  agrees on all 14. There are two distinct causes, established in the
  Verification pass: for the 7 `rowOrder.row2` runs the spec contradicts
  itself after the reorder (position says one row, the assertion's text says
  another) and the healer resolves it toward position; for the 7 `actionsOrder`
  runs the failing test's own first click (Remove, once the buttons reorder)
  deletes the row before the healer's debugger pauses, so the healer is shown a
  page where the row is gone. [Exemplar](healer-comparison/02-false-heal.md).
- **Assertion tampering:** 1 run flagged by the matcher rule, and on inspection
  it is a **false positive of the detector**. The healer fixed the action
  correctly and restated the assertion in an equivalent form (`toHaveValue` to
  `option:checked` + `toHaveText`). The reruns flagged the same pattern once
  more in 5 runs of that target (2 of 8 in total, both equivalent). Genuine
  assertion weakening observed: **0 of 276**. [Exemplar](healer-comparison/04-tampered-green.md).
  This is a result in the healer's favour that I had not expected: its
  instructions permit changing assertions, and it essentially never did.
- **Deleted steps (`action-removed`): 5 of 276 runs, all `class-shuffle`.** The
  healer deleted the failing click and left only visibility assertions, so the
  spec passes without acting on any element. The assertion diff is clean, so a
  new tamper rule, `action-removed`, was added (an interaction in the original
  that no longer exists anywhere in the file; an action moved into a helper
  does not fire). Re-judging all 276 saved runs with it changed exactly these 5
  and no others, and Aayush adjudicated each `tampered-green`. Mitigating
  context, not an excuse: the original probe's action is a click on a container
  with no observable effect, so deleting it hides less than deleting a
  meaningful action would. The pattern is target-dependent: it reproduced on
  `nav.layoutClassName` in 8 of 8 runs (3 original, 5 rerun), on
  `account.pageClassName` in 4 of 8, and on `provisioning.pageClassName` in 1
  of 8. [Exemplar](healer-comparison/05-step-removed.md).

### 3. Honesty under real regressions

Both tools kept the test from going falsely green on all 7 `real-regression`
targets.

- **Healer: `fixme` on 21 of 21 runs.** Every run left the assertion alone and
  marked the test `fixme`. All 24 `fixme` comments (these 21 plus the 3
  `tag-swap` runs below) name the injected bug (checked by Aayush against
  Appendix H of the full report), for example "clicking Confirm Delete does
  nothing: the dialog stays open". One run's comment also names the neighbouring
  regression, because all 7 regressions are live in one build.
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
  16 of 16 targets identically, by construction. (The first compiled full
  report said 30 locator differences; it compared raw text and counted
  whitespace-only differences such as `{name` against `{ name`. The 26 is the
  normalized figure and is correct.)

## Verification pass

Re-checks of the questionable outcomes, as a separate dataset
(`reports/healer-verification.{json,md}`). **The original 276-run dataset is the
primary result and is not replaced**; the one change to it is the re-judge
described under Safety (5 outcomes, first judge's outcome kept on each record).
Same Playwright 1.65.1, Claude Code 2.1.318, agent-file hash and model
resolution (`sonnet` to `claude-sonnet-5-5`) as the main run, checked before any
run. 75 healer runs and 15 Eir runs, CLI-reported $3.32.

### Reruns next to the originals

12 targets: the 7 with any wrong-element run, the 3 `class-shuffle` targets that
had review runs, the flagged `resourceSelect`, and the `tag-swap` target that
behaved like a regression. Every other target whose outcome differed across its
original runs was already in that set. 5 healer runs and 1 Eir run each; the 3
position-only targets also ran as an identity-anchored variant (the action and
every existing assertion matcher unchanged; a comment and one new assertion
naming the device and its owner added). The anchored results sit beside the
originals and replace nothing.

| Class run        | Target                                   | Original (3 runs)           | Rerun (5 runs)              | Anchored variant (5 runs) | Eir original / rerun                                    |
| ---------------- | ---------------------------------------- | --------------------------- | --------------------------- | ------------------------- | ------------------------------------------------------- |
| class-shuffle    | account.pageClassName                    | 1 tampered-green, 2 correct | 3 tampered-green, 2 correct | -                         | still-failing / still-failing                           |
| class-shuffle    | nav.layoutClassName                      | 3 tampered-green            | 5 tampered-green            | -                         | still-failing / still-failing                           |
| class-shuffle    | provisioning.pageClassName               | 2 correct, 1 tampered-green | 5 correct                   | -                         | still-failing / still-failing                           |
| compound-release | compound: devices.archived.rowOrder.row2 | 3 wrong                     | 3 correct, 2 wrong          | 5 correct                 | still-failing / still-failing (anchored: still-failing) |
| compound-release | compound: devices.row.dev-2.actionsOrder | 2 wrong, 1 correct          | 4 wrong, 1 correct          | -                         | still-failing / still-failing                           |
| compound-release | compound: devices.row.dev-4.actionsOrder | 1 correct, 2 wrong          | 1 correct, 4 wrong          | -                         | still-failing / still-failing                           |
| compound-release | compound: wizard.resourceSelect          | 2 correct, 1 tampered-green | 4 correct, 1 tampered-green | -                         | still-failing / still-failing                           |
| sibling-reorder  | active.rowOrder.row2                     | 2 correct, 1 wrong          | 3 correct, 2 wrong          | 5 correct                 | still-failing / still-failing (anchored: still-failing) |
| sibling-reorder  | archived.rowOrder.row2                   | 3 wrong                     | 5 wrong                     | 5 correct                 | still-failing / still-failing (anchored: still-failing) |
| sibling-reorder  | row.dev-2.actionsOrder                   | 2 wrong, 1 correct          | 4 wrong, 1 correct          | -                         | still-failing / still-failing                           |
| sibling-reorder  | row.dev-4.actionsOrder                   | 2 correct, 1 wrong          | 3 correct, 2 wrong          | -                         | still-failing / still-failing                           |
| tag-swap         | provisioning.submitButton                | 3 fixme                     | 5 fixme                     | -                         | still-failing / still-failing                           |

- **The false heals reproduce.** On the 7 targets that had one: original 14 of
  21 runs (66.7%), rerun 23 of 35 (65.7%). These are not unlucky single runs.
  This is a selected set (chosen for having false heals), so it is not the
  healer's overall rate; that remains 14 of 276.
- **The `rowOrder.row2` false heals are a spec artifact.** Position-only
  targets: original 7 of 9 runs wrong, rerun 9 of 15, **anchored variant 0 of
  15** (15 of 15 correct). Eir is unchanged by the anchor (`still-failing`).
  Caveat: the anchor also hands the healer extra information, only 3 targets
  are covered, and n is 15.
- **The `actionsOrder` false heals are not.** Their original action names the
  row and the table. Original 7 of 12 wrong, rerun 14 of 20 (70%).
- **Eir reproduced on 12 of 12 targets**, and with the anchor.
- `tag-swap.provisioning.submitButton`: `fixme` on 8 of 8 runs (3 original, 5
  rerun).

### Judge cross-check from the trace, not the collector

Each of the 14 false-heal final specs was replayed against the marked build with
Playwright tracing on, and the acted-on element read from the trace. **14 of 14
agree with the collector**, all replays green, so none of the 14 false heals is
a judge artifact. As a negative control the same check ran on all 232
`healed-correct` runs: 220 agree, and the 12 that do not involve only container
markers, never a target, decoy or other element key. Six are a build-version
difference (those near-duplicate runs were judged on a marked build from before
container markers existed). The other six are the `class-shuffle` leniency:

- **`class-shuffle` is a judge artifact in the other direction, and the strict
  reading is now the primary figure.** Of the 19 healer runs the ancestor-path
  rule counted `healed-correct`, **6** resolved the target container and **13**
  resolved something else (the card's `<h2>` heading, or the outer `<main>`)
  and were credited only because the click's ancestor path included the target.
  The healer's `class-shuffle` figure is therefore **6 of 24 strict** (19
  lenient). Eir's two `class-shuffle` heals were replayed the same way (heal
  mode, from a pristine copy of the control store, tracing on): in both, the
  retry resolved the target container (`devices.active.table` and
  `devices.archived.table`), so Eir is **2 of 8 on both readings**. On the strict
  reading the two tools are level on this class.

### Spec-intent audit of the 14 false heals

|                                                                   | `rowOrder.row2` (7 runs)                                                                                  | `actionsOrder` (7 runs)                                                     |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Does the original action identify the intended row unambiguously? | **No: position only** (`nth-child(2)`). The intended owner appears only in the post-condition's locator.  | **Yes**: owner text and table.                                              |
| Where did the text the healer anchored on come from?              | "A. Ramirez": **not in the spec**, in the page (the row now at position 2). One run extracted no literal. | "K. Nguyen" / "M. Alvarez": **in the spec** (as test data) and in the page. |
| Did the healer change the post-condition's locator (receiver)?    | Yes, 7 of 7.                                                                                              | Yes, 7 of 7.                                                                |

A changed receiver is the documented blind spot of the assertion diff (matcher
and arguments are unchanged), so it is stated rather than treated as new. The
per-run table is in the verification report.

### Destructive-debugging hypothesis: confirmed for `actionsOrder`, refuted for `rowOrder.row2`

- **Confirmed for the 7 `actionsOrder` runs.** On the mutated build, on a fresh
  load, K. Nguyen's row is present and its first action button is **Remove**.
  The spec's original first click removes it (0 active rows); a reload restores
  it (1). All 7 healer transcripts show the intended row missing from the
  Active table in their first page evidence, and the healers say so ("K.
  Nguyen's device is in the archived table", "M. Alvarez is only in the Archived
  table"). One writes, "I didn't work out why the original click appeared to
  succeed." The healer's debugging session never reloaded.
- **Refuted for the 7 `rowOrder.row2` runs.** The failing action there is Edit,
  which does not change the data. Their cause is the spec ambiguity above.

### What changes in the headline

|                                                            | Figure                                                                                                                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| False heals, original dataset                              | **14 of 276 runs (5.1%)**. This is the published headline and is not replaced.                                                                        |
| Of those, on specs that identify the row only by position  | 7. An identity anchor removed them (0 of 15), so they are as much a spec defect as a healer one.                                                      |
| Of those, on specs with an unambiguous row                 | 7 (2.5% of the 276). They reproduce (14 of 20 on rerun).                                                                                              |
| False greens (wrong element or tampered), original dataset | 20: the 14, plus 5 deleted-click runs, plus 1 benign equivalent rewrite.                                                                              |
| Healer correct, overall                                    | **219 of 276 (79.3%) strict, primary**; 232 of 276 (84.1%) lenient. The 13 runs between them are `class-shuffle` runs credited only by ancestor path. |
| Healer correct, `class-shuffle`                            | **6 of 24 strict, primary**; 19 of 24 lenient. Eir: 2 of 8 on both readings.                                                                          |

No false heal was a judge artifact (14 of 14 trace agreement). The
`class-shuffle` recovery figure was the one judge-leniency result, and its
primary reading is now the strict one.

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
- **`class-shuffle` is weaker evidence, which is why its primary figure is the
  strict one.** The original probes click a container, which does nothing
  observable, so post-conditions only check the page is intact. The judge's
  first rule attributed these by marked-ancestor _path_, which credits a fix
  that resolves a descendant (a card's heading) or an outer ancestor (`<main>`)
  as long as the click's path includes the target. Reports now lead with the
  strict reading (the element Playwright resolved, from the trace) and show the
  lenient one beside it, for both tools. Even strict, a container click proves
  little about whether the healer understood the page.
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
- **The `action-removed` rule and its adjudications came after the first run.**
  They were applied by re-judging saved final specs, not by re-running the
  healer, and the first judge's outcome is kept on each changed record
  (`previousOutcome`).

## The honest verdict

**The tools are complementary, and the data supports that framing, with a
sharper edge than expected.** The healer recovers far more than Eir (79.3% of
runs correct on the strict reading, 84.1% lenient, vs Eir's 46% of targets),
including most of the classes Eir is weak at and all of `flow-change`. The
exception is `class-shuffle`, where on the strict reading the healer (6 of 24)
and Eir (2 of 8) are level at 25%. It never weakened an
assertion (0 genuine of 276), and it marked real regressions `fixme` instead of
forcing them green. That is better behaviour than its instructions suggest.
One qualification: in 5 `class-shuffle` runs it deleted the failing step
(adjudicated `tampered-green`, rule `action-removed`). Those clicks targeted a
container with no observable effect, so the deletion hides less than it would
on a meaningful action, but a test that passes without acting is not a heal.

But it is not safe to let it merge unreviewed: **it produced 14 false heals in
276 runs (5.1%), all where position carries meaning (`sibling-reorder`)**, and
the failure is a green test pointing at the wrong row. Verification split
those 14: 7 come from specs that identify their row only by position (an
identity anchor removed them, 0 of 15), which is as much a spec defect as a
healer one; 7 come from specs that name their row unambiguously and reproduce
(14 of 20 on rerun), because the failing test's own destructive click corrupts
what the healer then sees. The second kind is the healer's own failure mode and
is the one to plan for. Eir produced none in 108
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
  targets (7 real regressions and the behaviour-breaking tag swap); all 24
  comments name the injected bug (checked by Aayush against Appendix H of the
  full report).

## Reproducing

```bash
pnpm --filter playwright-eir build
pnpm --filter benchmark bench:healer --all --seed 42      # ~280 real Claude runs; see the skill's cost warning
pnpm --filter benchmark bench:healer-report               # refuses to overwrite without --force
```

Raw run records, full transcripts, final specs and the Eir stores live in
gitignored `packages/benchmark/.healer/`. Exemplar diffs:
[`docs/healer-comparison/`](healer-comparison/).
