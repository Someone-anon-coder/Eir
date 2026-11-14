---
name: eir-development
description: Work inside the playwright-eir (Eir) monorepo itself. Use when changing code, tests, docs, or CI in a checkout of github.com/Someone-anon-coder/Eir, when running its lint, typecheck, unit, acceptance, or e2e suites, when preparing a branch, commit, or pull request there, when recording something in NOTES.md, or when a release or npm publish of playwright-eir is being discussed.
license: MIT
---

# Working in the Eir repository

This is the source repository of `playwright-eir`. It has binding rules that
are stricter than most projects, and its committed generated files are easy to
dirty by accident. Read this before the first command.

For using the published package in someone else's project, use the
`playwright-eir` skill. For the mutation benchmark, the demo, and the dogfood
PR, use the `eir-benchmark` skill.

## Rules that override your defaults

`CLAUDE.md` at the repo root is the working agreement. Read it at session
start; it wins over this skill wherever they differ. The rules most often
broken by an agent acting on habit:

- **Never push to `main`.** Every change, including docs and config, goes on a
  feature branch and through a pull request.
- **Never merge, tag, publish, or force-push without the owner saying so** for
  that specific action. An earlier go-ahead does not carry over.
- **Never delete a branch**, including with `gh pr merge --delete-branch`.
  Branches are kept as history. Ask every time.
- **Never state a number that the harness did not produce.** Heal rates,
  latencies, test counts: run it or quote a committed report, and label
  estimates as estimates. Report a regression as plainly as a win.
- **Explain before building.** For any non-trivial change, brief the owner on
  what and why, and wait for them to restate it, before writing implementation
  code. If they say to skip, say that the gate was skipped and give a
  three-line summary. Code the owner cannot explain counts as a defect.
- **Do not act on parked ideas.** Out-of-scope improvements get a `NOTES.md`
  entry, not a commit.
- **No `any`, no `Proxy`, no CDP, no new runtime dependency** in
  `packages/eir` without stating its cost and the alternative considered.

The document order when two disagree: `BLUEPRINT.md`, then
`EIR_BLUEPRINT_APPROACH.md`, then `CLAUDE.md`, then `NOTES.md`. If a request
conflicts with a Blueprint principle or non-goal, name the conflict and get an
explicit override before doing it.

## Layout

```
packages/eir/         the published package (npm: playwright-eir)
packages/demo-app/    "Ward", a React+Vite app, plus the reference Playwright suite
packages/benchmark/   mutation engine, harness, committed results
packages/ci-action/   the PR-comment GitHub Action
docs/                 schema, thresholds, tuning log, CI, security review
skills/               agent skills (this file)
NOTES.md              ledger: parked items, questions, risks, daily log
```

Inside `packages/eir/src`: `fixture.ts` (the `test` override), `eirPage.ts` and
`eirLocator.ts` (wrappers), `capture/`, `store/`, `triage/`, `matching/`
(scorers), `policy/` (thresholds, state machine), `reporter/`, `fallback/`
(Gemini), `acceptance/` (real-browser proving tests).

## Setup

Node >= 22.13 and pnpm.

```bash
pnpm i
pnpm --filter playwright-eir build   # required before anything else
pnpm --filter ci-action build        # required before ci-action is used
pnpm --filter demo-app exec playwright install chromium   # once per machine
```

The other packages import `playwright-eir` through its built `dist/`. After
editing anything in `packages/eir/src`, rebuild before running e2e, the
benchmark, or another package's typecheck, or you will be testing stale code.

## Running tests

| What                | Command                                                                      | Notes                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Lint                | `pnpm lint`                                                                  | ESLint over the repo.                                                                                                                 |
| Types               | `pnpm typecheck`                                                             | All packages.                                                                                                                         |
| All unit tests      | `pnpm test`                                                                  | Vitest in every package. Includes real-Chromium acceptance tests in `packages/eir/src/acceptance/`, so the browser must be installed. |
| One package         | `pnpm --filter playwright-eir test`                                          | Also `demo-app`, `ci-action`, `benchmark`.                                                                                            |
| One test file       | `pnpm --filter playwright-eir exec vitest run routeNormalize`                | Name filter. `pnpm ... test -- <name>` does not filter; use `exec vitest run`.                                                        |
| Reference e2e suite | `pnpm --filter demo-app e2e`                                                 | Starts Ward on port 5173 itself.                                                                                                      |
| One e2e spec        | `pnpm --filter demo-app exec playwright test tests/pom-suite/wizard.spec.ts` |                                                                                                                                       |
| Format check        | `pnpm format:check`                                                          | `pnpm format` to fix.                                                                                                                 |

Before proposing a PR, run what CI runs, in this order:

```bash
pnpm --filter playwright-eir build && pnpm --filter ci-action build
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter demo-app e2e
pnpm bench --class id-rename --seed 42
pnpm bench --class sibling-reorder --seed 42
```

Report the real counts and any failure output. Do not write "all green"
without having run it in this session.

### Side effects of running things

Several commands rewrite committed files. Check `git status` afterwards and
restore anything you did not intend to change.

| Command                                         | Rewrites                                                                                          | What to do                                                                                                                                                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter demo-app e2e` (whole or partial) | `packages/demo-app/.eir/routes/*.json`                                                            | Normally byte-identical. A `*.postconditions.json` entry flipping between `dom-count-change` and `none` is a known timing flake (RISK-010): restore it with `git checkout -- packages/demo-app/.eir`. Commit a store diff only when the app or a selector really changed. |
| `pnpm bench ...`                                | `packages/benchmark/results/<class>-seed<n>.json`, `reports/baseline.json`, `reports/baseline.md` | At minimum the `generatedAt` timestamp changes. Restore unless the task is to re-baseline. See the `eir-benchmark` skill.                                                                                                                                                 |
| e2e, bench                                      | `eir-report/`, `test-results/`                                                                    | Gitignored.                                                                                                                                                                                                                                                               |

Port 5173 must be free for e2e and the benchmark. A leftover Vite process on
that port makes results silently wrong, not just slow.

`VITE_EIR_MUTATIONS` switches Ward into a mutated DOM. Leave it unset unless
you are deliberately reproducing breakage.

`GEMINI_API_KEY` is read from the environment only. Never put it in a file,
a commit, or a log. Nothing in the default test or CI path calls the API.

## Code conventions

- TypeScript strict with `noUncheckedIndexedAccess`. Outside data (browser
  `evaluate` results, JSON, env, LLM responses) enters as `unknown` and is
  narrowed by a type predicate or a zod schema.
- A cast needs a one-line reason. A double cast needs the owner's sign-off.
- Discriminated unions over boolean flags; `assertNever` in every switch on
  one. Derive types from Playwright's own (`Parameters<>`, `ReturnType<>`)
  instead of copying signatures.
- Functions passed to `page.evaluate` must be self-contained: no imports, no
  references to module scope.
- Capture and reporting never fail a user's test. Their errors are logged.
- Query methods (`isVisible`, `isEnabled`, `isChecked`, `count`) have no heal
  path, under any configuration. Engine code never writes to user source
  files; `acceptance/noSourceWrites.test.ts` enforces an allow-list of write
  sites, so a new file write has to be added there deliberately.
- Public API is exactly the `exports` map of `packages/eir/package.json`
  (`.`, `./globalTeardown`, `./reporter`). That surface, the `EirConfig` /
  `EirMode` shape, and the `.eir/` file formats are a semver contract since
  1.0.0. Changing any of them is a major version and an owner decision.
- Pure functions get table-driven Vitest tests written with or before the
  code. "The benchmark will catch it" is not a reason to skip one.
- Comments say why, not what. No dead code, no TODO without a `NOTES.md`
  entry.
- Prettier does not touch `.eir/` or the governing docs (`BLUEPRINT.md`,
  `CLAUDE.md`, `EIR_BLUEPRINT_APPROACH.md`, `NOTES.md`, root `README.md`).
  Keep it that way.

## When Playwright ships a new version

The wrappers are explicit classes (no `Proxy`), so every `Page`/`Locator`
member Playwright adds needs a matching forward, or it throws
`... is not a function` through Eir while still type-checking for adopters
(NOTES.md RISK-013). The weekly `latest` job in
`.github/workflows/playwright-compat.yml` fails when this happens.

1. `pnpm -r update "@playwright/test@<new>"`, then
   `pnpm --filter playwright-eir build`. Each "incorrectly implements
   interface" error on `EirPage` or `EirLocator` names the missing members.
2. Read each new member's declaration in
   `node_modules/.pnpm/playwright-core@<new>/node_modules/playwright-core/types/types.d.ts`
   and classify it:
   - takes a `Locator` argument (or an options field holding one): forward
     through `unwrapLocator()` / `unwrapHasOptions()` (RISK-005)
   - generic or overloaded: a `forwardOverloaded` property, not
     `Parameters<>`
   - returns a `Locator`: a plain pass-through stays untracked (RISK-004).
     Making it a capture point is a design decision for the owner.
   - property: a getter
3. Diff the old and new `types.d.ts` with doc comments stripped. New option
   fields that carry a `Locator` don't cause compile errors but do need
   unwrapping.
4. Add a feature-detected case to
   `packages/demo-app/tests/eir-proof/playwright-1.63-plus-surface.spec.ts`
   (detect on `page.mainFrame()...`, the real object, so older runtimes in
   the matrix skip instead of failing). Check it fails against the old
   wrappers.
5. Run `pnpm test`, e2e, and `pnpm bench:all`. The benchmark must be
   identical to the committed baseline apart from `generatedAt`, and the
   rewritten `results/`/`baseline.*` files must be restored, not committed.
6. Add the version to the `supported` matrix in `playwright-compat.yml`, then
   propose a patch release.

## Keeping documents in step

A change is not finished until the places that describe it agree:

| If you change                                               | Also update                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| A command's shape                                           | `CLAUDE.md` section 9 and root `README.md`, same commit              |
| Config, exports, report fields, store format                | Root `README.md`, `packages/eir/README.md`, `skills/playwright-eir/` |
| A benchmark number                                          | Every place it is quoted: both READMEs, `docs/`, `skills/`           |
| A governing doc (`BLUEPRINT.md`, approach doc, `CLAUDE.md`) | An entry under "Changelog to Governing Documents" in `NOTES.md`      |
| Anything user-visible in `packages/eir`                     | `packages/eir/CHANGELOG.md`                                          |

## Pull requests, the ledger, releases

- Branch, commit, PR, and merge procedure: `references/pr-process.md`
- How to record notes, questions, and risks in `NOTES.md`:
  `references/notes-ledger.md`
- Version, publish, and tag procedure: `references/release.md`
