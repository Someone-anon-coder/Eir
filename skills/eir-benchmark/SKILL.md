---
name: eir-benchmark
description: Run and interpret the playwright-eir mutation benchmark, the local broken-selector demo, and the dogfood pull request, inside a checkout of github.com/Someone-anon-coder/Eir. Use when asked to run `pnpm bench`, reproduce or re-measure heal and false-heal rates, read files under packages/benchmark/results or packages/benchmark/reports, demonstrate Eir suggesting a fix for a broken selector, produce a live Eir PR comment, or check whether a matcher change moved the numbers.
license: MIT
---

# Eir benchmark, demo, and dogfood PR

The benchmark is how this project measures itself. It breaks the demo app
("Ward") in controlled, seeded ways and records what Eir's matcher did about
each break. Every heal-rate figure in the README comes from it.

Repository rules still apply here: see the `eir-development` skill. In
particular, never report a number you did not get from a run or a committed
report, and report a worse number as plainly as a better one.

## Before running

```bash
pnpm i
pnpm --filter playwright-eir build   # the benchmark tests the built dist/, not src/
```

Rebuild after any change to `packages/eir/src`, or the run measures old code.
Chromium must be installed
(`pnpm --filter demo-app exec playwright install chromium`).

Port 5173 must be free. The harness starts and stops Ward itself, twice per
class. If another Vite process holds the port, the harness may talk to that
server instead, and every target comes back `mutation-ineffective` with no
error. Check with `lsof -i :5173` before a run whose result matters.

## Commands

| Command                                                                 | What it does                                                                                                                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm bench --class <class> --seed 42`                                  | One class. About half a minute.                                                                                                                                    |
| `pnpm bench:all`                                                        | All eight classes, seed 42 by default. Several minutes.                                                                                                            |
| `pnpm --filter benchmark bench:heal-evidence --class <class> --seed 42` | Same class with Eir in real `heal` mode: actual retries and post-condition checks.                                                                                 |
| `pnpm --filter benchmark bench:score-distribution --seed 42`            | Confidence and margin of every matched attempt, all classes.                                                                                                       |
| `pnpm --filter benchmark bench:hybrid --seed 42`                        | Heuristics vs. the Gemini fallback. Needs `GEMINI_API_KEY` in the environment, makes real API calls, and is subject to free-tier rate limits. Run only when asked. |
| `pnpm --filter benchmark mutation-payload --class <class> --seed 42`    | Prints the mutation as JSON without running anything.                                                                                                              |
| `pnpm --filter benchmark bench:healer --class <class> --seed 42`        | Healer comparison: Playwright 1.65.1's healer agent (real Claude Code runs) vs Eir, same breakages. **Spends Claude quota**; see below. Resumable.                 |
| `pnpm --filter benchmark bench:healer-verification`                     | Writes `reports/healer-verification.{json,md}` (reruns, trace cross-check, spec audit, `fixme` comments) from the separate verification dataset. Same guard.       |
| `pnpm --filter benchmark bench:healer-rejudge`                          | Re-judges saved healer runs with the current rules. No API calls. Backs up the originals once to `.healer/runs-original-v1/`.                                      |
| `pnpm --filter benchmark bench:healer-compile`                          | Compiles the analysis and every per-target result into one document, `docs/healer-comparison-full-report.md`. Same overwrite guard.                                |
| `pnpm --filter benchmark bench:healer-report`                           | Builds `reports/healer-comparison.{json,md}` from the per-run records. Refuses to overwrite without `--force`.                                                     |

Classes: `id-rename`, `text-change`, `tag-swap`, `class-shuffle`,
`sibling-reorder`, `wrapper-inject`, `near-duplicate-sibling-swap`,
`compound-release`.

The seed fixes which targets are mutated and how. Seed 42 is the published
baseline. The same seed on the same code gives the same outcomes.

### What each command overwrites

These output files are committed. Know what you are about to change.

| Command                    | Writes                                                                                                                                              | Guard                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `pnpm bench`, `bench:all`  | `packages/benchmark/results/<class>-seed<n>.json`, then regenerates `reports/baseline.json` and `reports/baseline.md` from every file in `results/` | None. Overwrites silently; `generatedAt` always changes. |
| `bench:heal-evidence`      | `reports/note001-heal-evidence-<class>.{json,md}`                                                                                                   | Refuses if the file exists, unless `--force`.            |
| `bench:score-distribution` | `reports/suggest-threshold-evidence-seed<n>.{json,md}`                                                                                              | Same.                                                    |
| `bench:hybrid`             | `reports/hybrid-comparison.{json,md}`                                                                                                               | Same.                                                    |

For a check or a smoke run, restore afterwards:

```bash
git checkout -- packages/benchmark/results packages/benchmark/reports
```

Only keep the rewritten files when the task is to re-baseline, and never pass
`--force` over an evidence report without the owner agreeing: an earlier run of
`bench:hybrid` destroyed the richest dataset the project had.

A non-default seed adds new `results/<class>-seed<n>.json` files, and
`baseline.*` is rebuilt from everything in `results/`, mixing seeds. Remove the
extra files before regenerating the baseline.

## How a class is measured

For each class the harness:

1. Picks targets with the seeded generator and records the ground truth (which
   element each mutation touched).
2. **Control run**: Ward unmutated. Every probe must pass. This proves the
   selectors and ground truth are valid.
3. **Mutated run**: Ward started with the mutation payload in
   `VITE_EIR_MUTATIONS`. Probes use frozen selector strings, so they break the
   way a real suite would.
4. Classifies each target from what Eir's matcher actually logged.

The standing baseline runs Eir in `suggest-only` mode and classifies each
match against the default heal bars (confidence at least 0.7, lead over the
runner-up at least 0.05). So "heal rate" there means "correct match that would
qualify for healing", not "retry executed". `bench:heal-evidence` is the
variant that executes real retries.

## Reading `results/<class>-seed<n>.json`

```json
{
  "mutationClass": "id-rename",
  "seed": 42,
  "generatedAt": "...",
  "outcomes": [
    {
      "targetId": "id-rename.login.passwordInputId",
      "mutationClass": "id-rename",
      "sourceClass": "id-rename",
      "route": "/login",
      "frozenSelectorKey": "locator(\"#login-password-input\")",
      "controlPassed": true,
      "probeOutcome": {
        "status": "mutation-effective",
        "outcome": { "kind": "healed-correct", "confidence": 0.839 },
        "error": "TimeoutError: locator.fill: Timeout 5000ms exceeded. ..."
      }
    }
  ]
}
```

| Field                 | Meaning                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `targetId`            | `<class>.<area>.<element>`. Stable name for one mutated element.                                                                                                                                  |
| `sourceClass`         | For `compound-release`, the underlying class of this particular mutation. Otherwise equal to `mutationClass`.                                                                                     |
| `frozenSelectorKey`   | The selector the probe used.                                                                                                                                                                      |
| `controlPassed`       | Must be `true`. `false` means the probe is broken, not Eir.                                                                                                                                       |
| `probeOutcome.status` | `mutation-effective`: the probe failed under mutation, as intended. `mutation-ineffective`: the probe still passed, so the mutation did not break that selector and there is nothing to classify. |
| `probeOutcome.error`  | The error the probe threw.                                                                                                                                                                        |

`outcome.kind`:

| Kind             | Meaning                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| `healed-correct` | Matched the right element and cleared both heal bars.                                                  |
| `healed-wrong`   | Cleared both bars on the wrong element. This is a false heal. `matchedWrong` describes what it picked. |
| `suggested`      | Matched, but under the confidence bar or too close to the runner-up.                                   |
| `missed`         | No match: nothing was attempted, triage rejected it, or no candidate was found.                        |

A false heal can only be detected directly in `near-duplicate-sibling-swap`,
the one class with a real decoy element in the ground truth. In the other
classes a 0% false-heal rate means no wrong match was observed; there was no
decoy to pick.

## Reading `reports/baseline.md`

| Column          | Meaning                                                                            |
| --------------- | ---------------------------------------------------------------------------------- |
| Affected        | Targets in the class (the denominator, including any `mutation-ineffective` ones). |
| Heal Rate       | `healed-correct` / Affected                                                        |
| False-Heal Rate | `healed-wrong` / Affected                                                          |
| Suggestion Rate | `suggested` / Affected                                                             |
| Miss Rate       | `missed` / Affected                                                                |

`baseline.json` has the same data as counts (`healedCorrect`, `healedWrong`,
`suggested`, `missed`, `mutationIneffective`) plus the rates as fractions.

If the four rates in a row do not add up to 100%, some targets were
`mutation-ineffective`. For the standing baseline that count is 0 in every
class; if it is not, suspect a stale server on port 5173 before anything else.

Published baseline, seed 42:

| Class                       | Affected |   Heal | False-heal | Suggest |   Miss |
| --------------------------- | -------: | -----: | ---------: | ------: | -----: |
| id-rename                   |        8 |  75.0% |       0.0% |   25.0% |   0.0% |
| text-change                 |        8 |  87.5% |       0.0% |   12.5% |   0.0% |
| tag-swap                    |        8 | 100.0% |       0.0% |    0.0% |   0.0% |
| class-shuffle               |        8 |  25.0% |       0.0% |   75.0% |   0.0% |
| sibling-reorder             |        8 |   0.0% |       0.0% |    0.0% | 100.0% |
| wrapper-inject              |        8 | 100.0% |       0.0% |    0.0% |   0.0% |
| near-duplicate-sibling-swap |        8 |  25.0% |       0.0% |   75.0% |   0.0% |
| compound-release            |       24 |  50.0% |       0.0% |   25.0% |  25.0% |

Two rows are known limits, not regressions:

- `class-shuffle` 25%: an element's own class names are not fingerprinted, so
  class-anchored selectors leave little to match on (NOTE-003).
- `sibling-reorder` 100% miss: reordering makes a positional selector hit a
  different element successfully. Nothing throws, so healing never starts
  (RISK-009). In real heal mode some of these are flagged `drift-suspected`.

Why each number is what it is: root `README.md`, "Failure-mode analysis", and
`docs/tuning-log.md`.

## Reading the evidence reports

- `note001-heal-evidence-<class>.md`: per target, whether the test passed in
  real heal mode and the policy outcome (`healed`, `heal-rejected`,
  `drift-suspected (self-similarity x)`, or `failed (no policy event
recorded)` when Eir never got involved).
- `suggest-threshold-evidence-seed42.md`: a probe census, then the confidence
  distribution of all matched attempts in buckets, then every attempt with
  its confidence and margin. Use it to see how close matches sit to the 0.7
  and 0.3 thresholds.
- `hybrid-comparison.md`: per class, how often the LLM was invoked and whether
  it `endorsed`, `contradicted`, offered an `alternative`, said `none-of-them`,
  or gave `no-verdict` (rate-limited or invalid), with latency, tokens, and
  estimated cost. The committed file is from a later, more rate-limited run
  than the one analyzed in `docs/hybrid-comparison.md`; quote the doc for
  conclusions. The claim it supports is narrow: no measured benefit on the
  cases the fallback was consulted about. Cases the matcher missed outright
  were never shown to the model.

## Checking whether a change moved the numbers

1. Rebuild: `pnpm --filter playwright-eir build`.
2. `pnpm bench:all`.
3. `git diff packages/benchmark/reports/baseline.md`. No diff in the table
   means no measured change. For a per-target view, diff the `results/` files
   and ignore `generatedAt`.
4. Any `healed-wrong` anywhere is a stop-and-report finding. The project's
   first priority is a 0% false-heal rate; a higher heal rate does not offset
   one.
5. Report per class: before, after, and which targets changed outcome.
6. If the change is not being adopted, restore the committed files. If it is,
   the new baseline must be updated everywhere the numbers are quoted (both
   READMEs, `docs/`, `skills/`) in the same pull request, and matcher tuning is
   logged as an iteration in `docs/tuning-log.md`.

## The local demo: a broken selector to a suggestion

Shows Eir working end to end in under a minute on a warm machine. Full script
with commentary: `demo/README.md`.

```bash
pnpm --filter playwright-eir build

# 1. Green run against the committed baseline
pnpm --filter demo-app e2e

# 2. Break Ward with a seeded id rename, run again
PAYLOAD=$(pnpm --filter benchmark mutation-payload --class id-rename --seed 42 --exclude-prefix login.)
VITE_EIR_MUTATIONS="$PAYLOAD" pnpm --filter demo-app e2e

# 3. Read what Eir suggests
cat packages/demo-app/eir-report/eir-report.md
```

Step 2 is expected to fail tests: the suite runs in `suggest-only` mode, so a
broken selector fails as normal and the suggestion appears beside it.
`--exclude-prefix login.` leaves the login fields alone, because breaking them
makes every test fail at login and hides the point.

Afterwards run `git status`. If the mutated run changed anything under
`packages/demo-app/.eir/`, restore it
(`git checkout -- packages/demo-app/.eir`): a mutated app must not become the
baseline.

Report formats are described in the `playwright-eir` skill,
`references/reports.md`.

## The dogfood pull request: a live PR comment

CI applies the same seeded `id-rename` mutation on any pull request whose head
branch starts with `eir-dogfood/`. Nothing in the branch needs to change.

```bash
git switch -c eir-dogfood/<short-name> main
git push -u origin eir-dogfood/<short-name>
gh pr create --base main --title "demo: Eir dogfood run" \
  --body "Intentional red CI. Demonstrates the Eir report comment. Do not merge."
```

Pushing a branch and opening a pull request are visible to others. Get the
owner's go-ahead first.

What to expect:

- CI goes red at the e2e step, on purpose.
- One "Eir report" comment appears with three suggested selector diffs
  (`/dashboard/account`, `/dashboard/provisioning`,
  `/dashboard/requests/new`).
- Pushing again updates that same comment rather than adding another.
- Screenshots are in the run's `eir-report` artifact.

Read the comment from a terminal:

```bash
gh pr view <number> --json comments \
  --jq '.comments[] | select(.body | contains("eir-report:v1")) | .body'
```

A dogfood PR is never merged. When it has served its purpose it is closed
unmerged and the branch is kept; ask before closing. PR #15 is the permanent
public example and stays open.

## The healer comparison (`bench:healer`)

Measures Eir against Playwright's own healer agent on the same seeded
breakages, over the eight classes plus `real-regression` and `flow-change`.
Read `docs/healer-comparison.md` for method and results.

**Cost warning.** Each healer run is a real `claude -p` session. One run is
about 5 to 15 agent turns; the harness prints CLI-reported cost (never a
computed price) and `--max-cost <usd>` stops cleanly when the sum reaches it.
On a subscription the real constraint is the weekly usage allowance, not
dollars. A full run is ~280 healer runs; check headroom first. A rate limit
shows up as repeated `infra-error`; the harness stops after 3 in a row, and
re-running resumes (infra-error records are re-run, others are skipped).

What it writes, all under gitignored `packages/benchmark/.healer/`: run
workspaces are in the OS temp dir (outside the repo), raw per-run JSON in
`.healer/runs/<class>-seed<n>/<tool>/`, full agent transcripts, final specs,
and a per-class Eir fingerprint store (never `packages/demo-app/.eir/`). The
committed outputs are `reports/healer-comparison.{json,md}` and
`docs/healer-comparison/`.

Needs ports 5301, 5302, 5303 and 5310 free (5173 stays free for the standing
benchmark). A stale server silently makes every mutation ineffective; the
harness refuses to start if a port is taken and reads each server's baked-in
env back before trusting it.

Reading outcomes: `healed-correct`, `healed-wrong` (false heal),
`tampered-green` (assertion weakened, expected value edited, force, try/catch,
inflated timeout, or any green on a real regression), `fixme`, `still-failing`,
`out-of-bounds` (edited anything but the spec; `.playwright-mcp/` tool logs
don't count), `infra-error` (excluded from rates), `needs-human-review`.
`class-shuffle` is judged by marked-ancestor path, which is weaker evidence.
