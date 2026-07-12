# ci-action

A GitHub Action that reads `eir-report.json` (produced by `playwright-eir/reporter`,
Phase 6) and posts or updates a single PR comment summarizing what Eir healed or
suggested this run. See `docs/ci.md` for the copy-paste workflow snippet.

Not published to npm or the GitHub Marketplace — used only via a local path
reference (`uses: ./packages/ci-action`) inside this monorepo's own workflows.

## Local development

```bash
pnpm --filter ci-action typecheck
pnpm --filter ci-action test
pnpm --filter ci-action build   # writes dist/main.js — the action's actual entrypoint
```

`dist/` is gitignored like every other package's build output in this repo; a
workflow using this action must build it first (see `docs/ci.md`).

## Design notes

- **Zero runtime dependencies.** Talks to GitHub's REST API via plain `fetch`
  (global since Node 18) instead of `@actions/github`/Octokit — three endpoints
  (list/create/update an issue comment) don't need a full API client, and this
  keeps the action's own supply-chain surface at zero. The only dependency is a
  type-only import of `ReportRow`/`HealAction` from `playwright-eir/reporter`
  (the published reporter's own public types — erased at build, no runtime cost),
  so the report shape has exactly one source of truth.
- **Upsert by marker, not by title-matching or "the last comment I made."** Every
  comment this action posts carries an invisible `<!-- eir-report:v1 -->` marker
  (`src/marker.ts`). Before posting, it lists the PR's comments and does an exact
  substring match for that marker — found means edit in place, not found means
  first comment on this PR.
- **The report artifact's shape is honestly incomplete in two ways this renderer
  respects rather than papers over:**
  - `ReportRow` has no field for which policy mode (`suggest-only` / `heal`)
    produced a run — an all-`suggested` run is indistinguishable from a `heal`
    mode run that never crossed its threshold. The `mode` action input is stated
    explicitly by the workflow (which knows its own `eir.config.ts`) rather than
    guessed from row content; `"unknown"` (the default) renders no mode claim.
  - `ReportRow` has no field distinguishing a `healed` row that was verified
    against a recorded post-condition from one accepted because no baseline
    existed to check against (NOTE-004). The comment never invents that
    distinction — a standing caveat explains the limitation instead of a
    per-row claim the data can't back.
