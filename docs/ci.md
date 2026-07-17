# CI Integration (Phase 7)

How `playwright-eir/reporter`'s output (Phase 6) turns into a single,
auto-updated PR comment — the demo-reel moment Blueprint §7.7 describes.

## What it does

`packages/ci-action` reads `eir-report.json` after your Playwright run and
posts or updates one PR comment listing every selector Eir suggested a fix
for, with a before/after diff and a confidence score. Screenshots of each
matched element aren't inlined into the comment — GitHub strips `data:`
URI image sources from comment bodies, and Blueprint §6 rules out hosting
them anywhere else — so the comment links to the workflow run instead,
where the uploaded `eir-report` artifact holds them. On the next push to
the same PR, the comment edits in place — it never posts a second one
(see "Why upsert, not append" below).

## Prerequisites

1. `playwright-eir/reporter` is wired into your `playwright.config.ts`:
   ```ts
   export default defineConfig({
     reporter: [["list"], ["playwright-eir/reporter"]],
     // ...
   });
   ```
2. Your suite sets `use.actionTimeout` to something bounded (Eir's triage
   can't tell a genuinely broken selector apart from one that simply
   never resolves without it — see NOTES.md RISK-011 for the full story;
   `packages/demo-app`'s own config sets `5_000`).
3. A committed `.eir/routes/` baseline exists (the calibration run —
   Blueprint §5.1) so there's something for a broken selector to be
   matched against.

## The workflow snippet

```yaml
permissions:
  pull-requests: write # the only grant this action needs
  contents: read

steps:
  # ...your normal checkout/install/build steps...

  - run: pnpm --filter ci-action build # produces dist/main.js — see note below

  - run: pnpm --filter demo-app e2e # or whatever runs your suite

  - name: Upload Eir report artifact
    if: always() # holds the screenshots the comment links to but never inlines
    uses: actions/upload-artifact@v4
    with:
      name: eir-report
      path: packages/demo-app/eir-report
      if-no-files-found: ignore

  - name: Post Eir report comment
    if: always() # still comment even if the run above failed
    uses: ./packages/ci-action
    with:
      github-token: ${{ github.token }}
      report-path: packages/demo-app/eir-report/eir-report.json # wherever your reporter writes it
      mode: suggest-only # or "heal" — matches your eir.config.ts; omit for no mode claim
```

This repo's own `.github/workflows/ci.yml` is the working copy of this
snippet — read it directly if anything here drifts from what's actually
running.

**Not published to the GitHub Marketplace.** `uses: ./packages/ci-action`
is a local path reference — it only resolves inside this repo's own
checkout. Using it elsewhere currently means copying the
`packages/ci-action` directory into your own repo and building it there;
Marketplace publication is explicitly parked (see NOTES.md), not an
oversight.

## Inputs

| Input          | Default                       | Notes                                                                                                                                                       |
| -------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `github-token` | _(required)_                  | Needs `pull-requests: write`. `${{ github.token }}` is almost always the right value — see "Why this token, this scope" below.                              |
| `report-path`  | `eir-report/eir-report.json`  | Wherever your `playwright.config.ts`'s reporter `outputDir` points.                                                                                         |
| `mode`         | `unknown`                     | `suggest-only`, `heal`, or `unknown`. The report artifact alone can't prove which mode produced a run — see "What this comment can't honestly claim" below. |
| `docs-url`     | this file                     | Footer link text.                                                                                                                                           |
| `pr-number`    | _(from the triggering event)_ | Override only if you're calling this action outside a normal `pull_request` trigger.                                                                        |

## Why upsert, not append

Every comment this action posts carries an invisible marker
(`<!-- eir-report:v1 -->`). Before posting, it lists the PR's existing
comments and searches for one already carrying that marker — found means
edit in place, not found means this is the first Eir comment on this PR.
Without this, every push to a long-lived PR adds another comment, and
reviewers learn to scroll past all of them — the exact failure mode that
kills adoption of any PR bot.

## Duplicate rows from retried tests

If your suite (or CI itself) retries a failing test, Eir's whole
triage→match→policy pipeline re-runs on each attempt and `eir-report.json`
ends up with one row per attempt — 3 genuinely distinct broken selectors
across 2 retried attempts becomes 6 raw rows. The comment renderer
collapses rows that share the same route, original selector, and
suggested selector into one table entry before rendering, so the
headline counts and the table both reflect unique selectors, not raw
attempts. When duplicates disagree on confidence, the highest is shown,
annotated `(seen Nx)` so the retry isn't hidden — it's mild evidence the
break reproduces, not a fluke. This dedup is renderer-only: the
`eir-report.json`/`.md` artifact itself keeps every real attempt
untouched, since that file is the raw evidence trail a benchmark or a
debugging session might read later.

## Why this token, this scope

The example above declares `permissions: pull-requests: write` explicitly
in the workflow file rather than relying on the repository's default
token permissions. This isn't paranoia for its own sake: this exact
workflow snippet is what someone adopting Eir copies into their own
repo's CI. A narrowly-scoped, explicitly-declared permission block means
the action can't do anything beyond commenting even if it's buggy or
compromised, and it models the practice worth copying, not just the
feature.

## What this comment can't honestly claim

Two limits are baked into the wording rather than hidden:

- **It only reports what Eir intercepted.** The summary line never claims
  "all selector drift on this PR" — some drift is invisible to Eir's own
  engine (unwrapped pass-through methods, selectors with no prior
  baseline; see NOTES.md RISK-009). The comment says "N suggestions from
  what Eir observed," not "N problems found."
- **A `HEALED` row is never marked "verified."** `ReportRow` — the
  artifact this action consumes — has no field distinguishing a heal
  whose retry was checked against a recorded post-condition from one
  accepted because no baseline existed to check against (NOTES.md
  NOTE-004). Rather than invent that distinction, the comment carries a
  standing caveat instead of a per-row claim the data can't back.
- **Screenshots are linked, not shown.** An earlier version of this
  action inlined them as `data:` URI `<img>` tags; a real PR comment
  confirmed GitHub's sanitizer silently strips the `src` attribute,
  rendering nothing. The comment now says "N screenshots in this run's
  artifact" and links the workflow run, not a broken image.

## The dogfood demo

`.github/workflows/ci.yml` includes one step scoped to any branch under
the `eir-dogfood/` prefix (generalized in the 1.0.0 closure session from
Phase 7's original one-time exact branch name, `phase-7-dogfood-
demo-2026-07-12`, which could never fire again once merged) that applies
a real, seeded `id-rename` mutation to Ward via `packages/benchmark`'s
own `buildMutationRun` before the suite runs — the same reproducible
mutation the benchmark's baseline table reports, just applied against the
reference suite instead of the harness's probes. Every other branch and
PR is unaffected; `VITE_EIR_MUTATIONS` stays unset for everyone outside
the prefix, exactly as Phase 4 established.

To run the demo yourself (on this repo, or on your own fork): create a
branch named `eir-dogfood/<anything>`, push it with no changes at all —
the branch name alone triggers the mutation — and open a PR. CI will run
red on the mutated selectors and the Eir comment will show the
suggestions. This produced the original demo on [PR #15](
https://github.com/Someone-anon-coder/Eir/pull/15) (Phase 7,
`phase-7-dogfood-demo-2026-07-12`) and is re-verified under the new
prefix as part of the 1.0.0 closure session (NOTE-011's live
clean-state exercise, and NOTE-010's external-fork verification).
