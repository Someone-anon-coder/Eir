---
name: playwright-eir
description: Set up and operate playwright-eir, a self-healing locator engine for Playwright (TypeScript/JavaScript, @playwright/test). Use when adding self-healing or selector-drift detection to a Playwright suite, when a Playwright test fails because a selector or locator stopped matching after a UI change, when an eir-report.json / eir-report.md / .eir/ directory is present and needs interpreting, or when wiring Eir's PR-comment GitHub Action.
license: MIT
---

# playwright-eir

`playwright-eir` is an npm plugin for `@playwright/test`. While a suite passes
it stores a small fingerprint of every element the tests touch. When a selector
later stops matching, it finds the element's new identity and reports a
replacement selector with a confidence score.

Three guarantees shape everything below:

- It **never edits source files**. It only reports. Applying a suggested
  selector to the test code is your job (see "Acting on a report").
- It **never heals query methods** (`isVisible`, `isEnabled`, `isChecked`,
  `count`). Those tolerate absence on purpose, so they are observed only.
- A selector it has **never fingerprinted fails exactly like vanilla
  Playwright**. No baseline means no suggestion.

Requirements: Node >= 22.13, `@playwright/test` >= 1.60, ESM-compatible
project. Benchmarked on Chromium only.

## Set it up in a project

Do all five steps. Steps 2 to 4 are the ones that get skipped, and each one
makes Eir silently useless when it is missing.

1. Install, then swap the import in every spec and fixture file. Nothing else
   in the tests changes; page objects and helpers keep working.

   ```bash
   npm i -D playwright-eir
   ```

   ```ts
   // before
   import { test, expect } from "@playwright/test";
   // after
   import { test, expect } from "playwright-eir";
   ```

   If the project already extends `test` with its own fixtures, change the
   base it extends from: `import { test as base } from "playwright-eir"`.

2. Edit `playwright.config.ts`:

   ```ts
   import { defineConfig } from "@playwright/test";

   export default defineConfig({
     // Merges per-worker fingerprint shards into .eir/routes/*.json.
     // Without it the baseline is never written.
     globalTeardown: "playwright-eir/globalTeardown",
     // Keep the project's existing reporters and add Eir's.
     reporter: [["list"], ["playwright-eir/reporter"]],
     use: {
       // Bounded, so a broken selector is diagnosed in seconds
       // instead of running out the whole test timeout.
       actionTimeout: 5_000,
     },
   });
   ```

   If the project already has a `globalTeardown`, keep it and call Eir's from
   inside it: `import eirTeardown from "playwright-eir/globalTeardown"` and
   `await eirTeardown(config)`.

3. Run the suite once while it is green. This is the calibration run. It
   creates `.eir/routes/*.json` (fingerprints) and
   `.eir/routes/*.postconditions.json` in the directory Playwright runs from.

4. Commit `.eir/routes/`. It is the baseline CI matches against. Add the
   scratch and output paths to `.gitignore`:

   ```
   .eir/.shards/
   .eir/.shards-postconditions/
   eir-report/
   ```

5. Confirm it worked: `.eir/routes/` contains one JSON file per visited route,
   and the suite's pass/fail results are unchanged.

Every later green run refreshes the baseline, so `.eir/routes/` diffs appear
in PRs whenever the UI changes. Treat them like snapshot updates: review and
commit them.

## Modes

The default is `suggest-only`: a broken selector still fails the test, and the
fix is reported. Nothing is retried. Leave it there unless the user asks for
healing.

`heal` mode retries the action once against the matched element when
confidence is high enough, then checks a recorded post-condition (did the
route change, did the DOM grow or shrink as it did when the baseline was
recorded). A mismatch rejects the heal and the original error is thrown.

```ts
// eir.config.ts
import { defineEirConfig } from "playwright-eir";

export default defineEirConfig({
  mode: { mode: "heal", healThreshold: 0.7, suggestThreshold: 0.3 },
});
```

```ts
// in a spec file, or a shared fixture file
import { test } from "playwright-eir";
import eirConfig from "./eir.config";

test.use({ eirConfig });
```

`eirConfig` is an ordinary Playwright fixture option, so it can also go in the
`use` block of `playwright.config.ts`.

| Field              | Default | Meaning                                                                                                                                   |
| ------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `healThreshold`    | `0.7`   | At or above: retry (heal mode only). Measured value; do not lower it without a reason.                                                    |
| `suggestThreshold` | `0.3`   | Between this and `healThreshold`: suggest only. Below: plain failure. This one is an estimate.                                            |
| `routeOverrides`   | none    | `{ pattern: RegExp, token: string }[]` for dynamic URL segments. Numeric and UUID segments already collapse to `:id`.                     |
| `fallback`         | off     | Optional Gemini assist. Leave it off: the project's own benchmark measured no accuracy benefit, and it can only ever suggest, never heal. |

A heal also needs a clear winner: a candidate that scores high but barely
beats the runner-up is downgraded to a suggestion.

## Acting on a report

After a run with failures, read `eir-report/eir-report.json` (a readable copy
is `eir-report/eir-report.md`; the directory is configurable through the
reporter's `outputDir` option). Each row:

```json
{
  "testTitle": "opens and cancels the delete-account dialog",
  "method": "click",
  "route": "/dashboard/account",
  "selectorKey": "getByTestId(\"open-delete-account\")",
  "action": "suggested",
  "confidence": 0.735,
  "suggestion": "getByTestId(\"open-delete-account-mut\")",
  "screenshotFile": "screenshots/opens-and-cancels-0.png",
  "fallback": null,
  "postConditionVerification": null
}
```

`selectorKey` is the selector as written in the test; `suggestion` is the
replacement. What to do per `action`:

| `action`              | What happened                                                           | What to do                                                                                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `suggested`           | Match found; test failed as normal.                                     | Verify (below), then replace `selectorKey` with `suggestion` in the source.                                                                                                                                                |
| `healed`              | Heal mode retried and the step passed.                                  | The test is green but the source selector is still stale. Apply the suggestion anyway. Check `postConditionVerification`: `verified` is strong; `skipped-no-baseline` means nothing confirmed the heal, so verify by hand. |
| `heal-rejected`       | Retry ran but the page reacted differently than recorded.               | The match is probably the wrong element. Do not apply the suggestion; find the element yourself.                                                                                                                           |
| `heal-attempt-failed` | Retry against the match also threw.                                     | Treat as a real failure and debug normally.                                                                                                                                                                                |
| `missed`              | Nothing matched confidently.                                            | The element may be gone or changed beyond recognition. Debug normally.                                                                                                                                                     |
| `drift-suspected`     | The action passed, but the element no longer resembles its fingerprint. | The selector may now be hitting a different element (typical after a reorder with `nth-child` selectors). Inspect it; this never fails the test by itself.                                                                 |

Before applying a suggestion:

1. Look at `screenshotFile` (relative to the report directory) or the page
   itself and confirm the matched element is the intended one. A confidence
   score is evidence, not proof, and a row can repeat when tests are retried.
2. Find the selector in the source. `selectorKey` is Playwright's rendering of
   the locator, so a test that writes `page.locator("#save")` appears as
   `locator("#save")`, and a selector built from a variable or template will
   not appear literally. Search for the distinctive part.
3. Prefer the suggestion as given, but if the project has a selector
   convention (test ids, roles), rewrite it to match that convention against
   the same element.
4. Re-run the affected tests. A green run refreshes the fingerprint for the
   new selector; commit the `.eir/routes/` change with the fix.

Tell the user what was changed and why, with the confidence value. Do not
describe a suggestion as verified unless it was actually checked.

## When there is no row for a broken selector

Check these in order:

- **No baseline.** The selector was never part of a green run with Eir
  installed, or `.eir/routes/` is not committed or not present in CI, or
  `globalTeardown` is not wired.
- **Untracked locator.** Only `locator`, `getByRole`, `getByLabel`,
  `getByText`, `getByTestId`, and `getByPlaceholder` (and chains of them) are
  fingerprinted. Anything reached through `.filter()`, `.first()`, `.last()`,
  `.nth()`, `.and()`, `.or()`, `getByAltText`, `getByTitle`, `frameLocator`
  content, or a raw `Frame` is a plain Playwright locator: it works, but Eir
  does not see it.
- **Query method.** The failing call was `isVisible`, `count`, or similar, or
  an `expect(...)` assertion. Only these actions are heal-eligible: `click`,
  `fill`, `type`, `press`, `check`, `uncheck`, `selectOption`, `hover`,
  `waitFor`, `innerText`, `textContent`.
- **The action did not throw.** A reordered list can make a positional
  selector hit the wrong element successfully. Eir can only flag that as
  `drift-suspected`.
- **Reporter not wired**, so the result had nowhere to go.

Set `EIR_DEBUG=1` to log each interception when it is unclear whether Eir is
active at all.

## What to expect from it

Measured on the project's own seeded mutation benchmark. "Healed" means the
match was correct and cleared the default heal bars (confidence 0.7, lead over
the runner-up 0.05); the rest were suggested or missed:

| UI change                         |               Healed | Wrongly healed |
| --------------------------------- | -------------------: | -------------: |
| id / test-id renamed              |                  75% |             0% |
| visible text changed              |                87.5% |             0% |
| tag swapped (button to link)      |                 100% |             0% |
| wrapper element inserted          |                 100% |             0% |
| class names shuffled              | 25% (rest suggested) |             0% |
| near-identical sibling swapped in | 25% (rest suggested) |             0% |
| siblings reordered                |                   0% |             0% |
| several changes at once           |                  50% |             0% |

It is tuned to never heal to the wrong element, at the cost of sometimes only
suggesting. Selectors anchored on CSS classes or on position are its weak
spots. Do not quote other numbers to the user.

## PR comments in CI

The repository ships a GitHub Action that turns `eir-report.json` into one
auto-updating PR comment. It is not on the Marketplace: copy
`packages/ci-action` from `github.com/Someone-anon-coder/Eir` into the target
repo, build it, and reference it by local path. The workflow needs only
`pull-requests: write` and `contents: read`, on a plain `pull_request`
trigger. Inputs: `github-token` (required), `report-path`, `mode`
(`suggest-only` | `heal` | `unknown`), `pr-number`. Step-by-step:
`references/ci.md`.

## Running the suite with Eir

Eir adds no commands. Run Playwright as usual:

```bash
npx playwright test                      # whole suite; refreshes .eir/routes when green
npx playwright test tests/login.spec.ts  # subset; refreshes only what it touches
EIR_DEBUG=1 npx playwright test          # log every interception
```

After a run: failures plus rows in `eir-report/eir-report.json` mean selector
drift Eir could match; failures with no rows mean something Eir did not see or
could not match (next section but one); a changed `.eir/routes/` after a green
run means the UI changed and the new baseline should be reviewed and committed.

## Reference

Read these when the task needs the detail:

- `references/reports.md`: every field of `eir-report.json`, the console
  summary, test annotations, LLM verdicts, and how to read the PR comment.
- `references/store.md`: the `.eir/` directory, fingerprint and post-condition
  file formats, reviewing store diffs, merge conflicts, recalibrating.
- `references/ci.md`: vendoring the PR-comment action, the full workflow,
  inputs, fork behavior.

Upstream: `https://github.com/Someone-anon-coder/Eir` (full README, known
limitations, `docs/thresholds.md` for threshold reasoning).
