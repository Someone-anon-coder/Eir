# Eir report formats

Everything Eir tells you about a run, and how to read each piece. All of it is
produced by the reporter (`playwright-eir/reporter`); none of it exists if the
reporter is not wired.

## Where the output goes

| Output            | Location                                   | Use                                       |
| ----------------- | ------------------------------------------ | ----------------------------------------- |
| Console summary   | stdout, after the run                      | Quick glance                              |
| `eir-report.json` | `<outputDir>/eir-report.json`              | The one to parse                          |
| `eir-report.md`   | `<outputDir>/eir-report.md`                | Same rows as a Markdown table             |
| Screenshots       | `<outputDir>/screenshots/*.png`            | The matched element, one per heal attempt |
| Test annotations  | Playwright's own HTML/JSON report          | Per-test markers                          |
| PR comment        | The pull request (needs the GitHub Action) | Deduplicated summary                      |

`outputDir` defaults to `eir-report`, relative to the directory Playwright runs
from. Change it with `["playwright-eir/reporter", { outputDir: "some/dir" }]`.
The whole directory is rewritten on every run, so it holds the last run only.

## `eir-report.json`

```json
{ "rows": [ { ...row }, { ...row } ] }
```

A run where nothing broke writes `{ "rows": [] }`, and `eir-report.md` then
says "No heal-eligible activity this run."

One row is one attempt, not one selector. If Playwright retries a failing test
(`retries: 1` in CI is common), the same selector produces a row per attempt.
Group by `route` + `selectorKey` + `suggestion` before counting.

| Field                       | Type           | Meaning                                                                                                                                                                                                                                                                          |
| --------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `testTitle`                 | string         | Title of the test the action ran in.                                                                                                                                                                                                                                             |
| `method`                    | string         | The action that failed: `click`, `fill`, `type`, `press`, `check`, `uncheck`, `selectOption`, `hover`, `waitFor`, `innerText`, `textContent`.                                                                                                                                    |
| `route`                     | string         | Normalized page path at the time, e.g. `/dashboard/account` or `/plan/:id/edit`. This is the store bucket the fingerprint came from.                                                                                                                                             |
| `selectorKey`               | string         | The selector as the test wrote it, rendered by Playwright, e.g. `getByTestId("save")` or `locator("#save")`. Chained locators are joined with `>`, e.g. `getByTestId("table") > getByRole("button", {"name":"Edit"})`. A hand-built XPath text literal is templated to `{TEXT}`. |
| `action`                    | string         | What Eir did. See the table below.                                                                                                                                                                                                                                               |
| `confidence`                | number or null | 0 to 1, how closely the best candidate matches the stored fingerprint. `null` on `missed` rows with no candidate.                                                                                                                                                                |
| `suggestion`                | string or null | Replacement selector, in the same notation as `selectorKey`. `null` when there is no match to offer. Eir checks that this selector resolves to the matched element before reporting it.                                                                                          |
| `screenshotFile`            | string or null | Path relative to `outputDir`.                                                                                                                                                                                                                                                    |
| `fallback`                  | object or null | `null` unless the optional LLM assist ran for this row. See below.                                                                                                                                                                                                               |
| `postConditionVerification` | string or null | Only set on `healed` rows. See below.                                                                                                                                                                                                                                            |

### `action` values

| Value                 | Test result | Meaning                                                                                                                                                                              |
| --------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `suggested`           | fails       | A match was found. Either the mode is `suggest-only`, or confidence was under `healThreshold`, or the winner did not beat the runner-up by enough.                                   |
| `healed`              | continues   | Heal mode retried the action on the match and it passed the post-condition check.                                                                                                    |
| `heal-rejected`       | fails       | The retry ran, but the page reacted differently from the recorded post-condition. Likely the wrong element. The original error is thrown.                                            |
| `heal-attempt-failed` | fails       | The retry itself threw. The original error is thrown.                                                                                                                                |
| `missed`              | fails       | No candidate cleared `suggestThreshold`, or nothing plausible was on the page.                                                                                                       |
| `drift-suspected`     | passes      | The action succeeded without any healing, but the element it hit scores poorly against its own stored fingerprint. A warning that the selector may now point at a different element. |

### Reading `confidence`

- `0.7` and above: eligible for healing in heal mode (default `healThreshold`).
- `0.3` to `0.7`: suggestion only.
- Below `0.3`: not reported as a match.

There is a second, hidden gate: the winner must lead the runner-up by at least
`0.05`. A row with confidence `0.85` and `action: "suggested"` in heal mode
means two candidates were nearly tied. Treat that as "one of two similar
elements" and check which one by hand.

Confidence is a similarity score, not a probability of being right.

### `postConditionVerification`

| Value                 | Meaning                                                                                       | Trust                                        |
| --------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `verified`            | A post-condition was recorded for this selector and the retry reproduced it.                  | Strong                                       |
| `skipped-none`        | The recorded action has no observable effect to compare (or it was not observable this time). | Medium; nothing contradicted the heal        |
| `skipped-no-baseline` | No post-condition was ever recorded for this selector.                                        | Weak; accepted on score alone, check by hand |

### `fallback`

Present only when the Gemini assist is enabled, keyed, and the match was
uncertain. It never appears on a `healed` row, because it cannot cause a heal.

```json
{ "provider": "gemini", "verdict": "endorsed", "detail": "..." }
```

| `verdict`      | Meaning                                                                              |
| -------------- | ------------------------------------------------------------------------------------ |
| `endorsed`     | The model picked the same candidate as the heuristics.                               |
| `contradicted` | The model rejected the heuristic winner.                                             |
| `alternative`  | The model preferred a different candidate from the shortlist.                        |
| `none-of-them` | The model thinks no shortlisted candidate is the element.                            |
| `no-verdict`   | No usable answer (rate limit, timeout, invalid response). `detail` gives the reason. |

Weigh an LLM verdict below a heuristic score.

## Console summary

```
[eir] heal summary:
  suggested            /dashboard/account :: getByTestId("open-delete-account") (confidence 0.7303)
  healed               /dashboard/account :: getByTestId("open-delete-account") (confidence 0.7353) [post-condition: verified]
```

Format: `action  route :: selectorKey (confidence) [post-condition] [llm provider: verdict]`.
Nothing is printed when there are no rows.

## Test annotations

Each affected test also carries Playwright annotations, visible in the HTML
report and in `--reporter=json` output:

| Annotation type           | Matches action        |
| ------------------------- | --------------------- |
| `eir-suggested`           | `suggested`           |
| `eir-healed`              | `healed`              |
| `eir-heal-rejected`       | `heal-rejected`       |
| `eir-heal-attempt-failed` | `heal-attempt-failed` |

The raw events are attached to the test result as `eir-policy-event:<n>`
(JSON) and `eir-heal-screenshot:<n>` (PNG). The reporter builds its rows from
these, so prefer `eir-report.json` over parsing attachments.

## The PR comment

```
## Eir report

**3 routes flagged** · 3 suggested, 0 healed this run.

> This reflects only what Eir intercepted and had a stored baseline for ...

| Status | Route | Suggested diff | Confidence |
|---|---|---|---|
| SUGGESTED | `/dashboard/account` | `- getByTestId("open-delete-account")`
                                     `+ getByTestId("open-delete-account-mut")` | 0.7303 (seen 2x) |
```

How it differs from `eir-report.json`:

- Rows are deduplicated by route + original selector + suggestion. `(seen Nx)`
  shows how many attempts collapsed into the row; the highest confidence wins.
- Only rows with a suggestion get a table line. `missed` and `drift-suspected`
  are counted in a single sentence under the table, so open the artifact's
  `eir-report.md` for those.
- `⚠ LLM` after the status marks a row the fallback commented on.
- If there are `HEALED` rows, a sentence states how many were verified, had
  nothing to check, or were accepted with no baseline.
- Screenshots are not shown. The comment links the workflow run; download its
  `eir-report` artifact.
- The mode line appears only when the workflow passes `mode`. It is a
  statement by the workflow author, not something inferred from the data.
- A run with no rows updates the comment to "No heal-eligible activity this
  run". If the PR has no Eir comment yet, one is created only when the run has
  at least one `suggested`, `healed`, `heal-rejected`, or
  `heal-attempt-failed` row; a clean run stays silent.

The comment is found and updated by the hidden marker `<!-- eir-report:v1 -->`,
so a PR only ever has one. To read it from a terminal:

```bash
gh pr view <number> --json comments \
  --jq '.comments[] | select(.body | contains("eir-report:v1")) | .body'
```

The comment covers only what Eir intercepted and had a baseline for. Its
silence about a selector is not evidence that the selector is fine.
