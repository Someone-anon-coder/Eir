# CI Integration (Phase 7)

How `playwright-eir/reporter`'s output (Phase 6) turns into a single,
auto-updated PR comment — the demo-reel moment Blueprint §7.7 describes.

## What it does

`packages/ci-action` reads `eir-report.json` after your Playwright run and
posts or updates one PR comment listing every selector Eir suggested a fix
for, with a before/after diff, a confidence score, and a screenshot of the
matched element. On the next push to the same PR, it edits that same
comment in place — it never posts a second one (see "Why upsert, not
append" below).

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

| Input | Default | Notes |
|---|---|---|
| `github-token` | *(required)* | Needs `pull-requests: write`. `${{ github.token }}` is almost always the right value — see "Why this token, this scope" below. |
| `report-path` | `eir-report/eir-report.json` | Wherever your `playwright.config.ts`'s reporter `outputDir` points. |
| `mode` | `unknown` | `suggest-only`, `heal`, or `unknown`. The report artifact alone can't prove which mode produced a run — see "What this comment can't honestly claim" below. |
| `docs-url` | this file | Footer link text. |
| `pr-number` | *(from the triggering event)* | Override only if you're calling this action outside a normal `pull_request` trigger. |

## Why upsert, not append

Every comment this action posts carries an invisible marker
(`<!-- eir-report:v1 -->`). Before posting, it lists the PR's existing
comments and searches for one already carrying that marker — found means
edit in place, not found means this is the first Eir comment on this PR.
Without this, every push to a long-lived PR adds another comment, and
reviewers learn to scroll past all of them — the exact failure mode that
kills adoption of any PR bot.

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

## The dogfood demo

`.github/workflows/ci.yml` includes one step scoped to an exact branch
name (`phase-7-dogfood-demo-2026-07-12`) that applies a real, seeded
`id-rename` mutation to Ward via `packages/benchmark`'s own
`buildMutationRun` before the suite runs — the same reproducible mutation
the benchmark's baseline table reports, just applied against the
reference suite instead of the harness's probes. Every other branch and
PR is unaffected; `VITE_EIR_MUTATIONS` stays unset for everyone else,
exactly as Phase 4 established. This is what produced the comment on
[the dogfood PR](#) (linked once opened — see NOTES.md's daily log for
the actual PR number).
