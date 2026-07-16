# FULL_UNDERSTANDING.md — Audit Snapshot of `playwright-eir` at v0.3.0

**This document describes exactly one commit.** Every claim below was produced
*this session* by running a command, reading a file, or listing a directory —
never recalled from a prior session's memory, and never assumed from what the
governing documents (`BLUEPRINT.md`, `EIR_BLUEPRINT_APPROACH.md`, `CLAUDE.md`,
`NOTES.md`) *say* should exist. Where a governing document's claim and observed
repo reality differ, both are stated and the mismatch is flagged in §13. The
moment `main` moves one commit further, this document is stale — it is an
audit snapshot, not living documentation, and is not intended to be kept in
sync going forward (a future audit would be a new document, not an edit to
this one).

This document was commissioned because the project intentionally shipped as
`0.3.0`, not `1.0.0` — a completeness-and-security review gates the jump to
1.0, and this document is the factual foundation that review will work from.

---

## §1. Snapshot Header

| Fact | Value | How verified this session |
|---|---|---|
| Date | 2026-07-16 | system clock (`currentDate` context) |
| HEAD commit | `38baa6055c206db98a52461f5540d233306dac2e` | `git log -1` |
| HEAD author/date | Someone <136891153+Someone-anon-coder@users.noreply.github.com>, 2026-07-16 19:33:50 +0530 | `git log -1 --format=...` |
| HEAD subject | "Merge pull request #17 from Someone-anon-coder/phase-9-hardening-ledger-triage-2026-07-16" | `git log -1` |
| Branch this session works on | `repo-audit-full-understanding-2026-07-16` (cut from `main` at the commit above) | `git checkout -b ...` |
| `main` status at session start | clean, up to date with `origin/main` | `git status` |
| Tags reachable from HEAD | `phase-0-done` … `phase-9-done`, `project-done`, `v0.3.0` (12 total, one per phase plus two release tags) | `git tag --merged HEAD` |
| Tags pointing exactly at HEAD | `phase-9-done`, `project-done`, `v0.3.0` | `git tag --points-at HEAD` |
| CI status of HEAD | **green** — GitHub Actions check `build` (run 29504911863), conclusion `success`, on the merge commit itself | `gh api repos/.../commits/<sha>/check-runs` |
| CI annotation on that green run | 1 warning (non-blocking): "Node.js 20 is deprecated... forced to run on Node.js 24" for `actions/checkout@v4`, `actions/setup-node@v4`, `pnpm/action-setup@v4` | `gh api .../check-runs/<id>/annotations` |
| npm published version | `0.3.0` | `npm view playwright-eir versions --json` (network call, succeeded) |
| npm dist-tag | `latest` → `0.3.0` | `npm view playwright-eir dist-tags --json` |
| npm version history | `0.0.1`, `0.1.0`, `0.2.0`, `0.3.0` | same `npm view` call |
| Local `.env` file | present at repo root, **untracked**, matched by `.gitignore:6:.env`, **zero appearances in git history** (`git log --all --full-history -- .env` returned nothing) | `git ls-files`, `git check-ignore -v`, `git log --all --full-history` |
| Secret-shaped strings in tracked files | none found (patterns: Google API keys, AWS keys, `sk-`/`ghp_`/`gho_`/`xox` tokens, PEM private key headers, generic `key/secret/token/password = "..."` assignments) | `git grep -nEI` over tracked files only |

This document does not re-verify itself against `main` after this commit —
if you are reading this after `main` has advanced, treat every fact above as
"true as of `38baa60`," not "true now."

---

## §2. Repository Tree

Full command: `find . -maxdepth 4 -not -path './.git*'` (top level), plus
targeted `find`/`git ls-files` per package. **Excluded everywhere:**
`node_modules/`, `dist/`, `.git/`, `test-results/`, `playwright-report/`,
`coverage/`, `.eir/.shards*/` (per-worker scratch, gitignored).

```
.
├── BLUEPRINT.md                  Supreme governing doc — what/why/end-goal, P1–P8, non-goals
├── EIR_BLUEPRINT_APPROACH.md     10-phase execution plan, per-phase DoD, TS-tip ritual
├── CLAUDE.md                     Working agreement — how Claude behaves while executing the above
├── NOTES.md                      Parking lot: NOTE-/RISK-/Q- ledger + daily progress log + doc changelog
├── README.md                     Public-facing product README (results table, config ref, architecture sketch)
├── LICENSE                       MIT
├── package.json                  Root workspace manifest (private, orchestrates the 4 packages)
├── pnpm-workspace.yaml            Declares packages/* as pnpm workspace members
├── pnpm-lock.yaml                 Committed lockfile
├── tsconfig.base.json             Shared strict compiler options every package's tsconfig extends
├── eslint.config.js               Flat ESLint config (typescript-eslint + eslint-config-prettier); bans `any`
├── .prettierrc.json / .prettierignore   Formatting config
├── .gitignore                     See below — notably does NOT ignore packages/demo-app/.eir/routes/
├── .env                           LOCAL ONLY — untracked, gitignored, never committed (verified this session)
├── .github/
│   └── workflows/ci.yml          The repo's ONLY workflow file — install, build, lint, typecheck, test, e2e, bench, dogfood comment
├── .claude/
│   └── settings.local.json       Local Claude Code permission allowlist; untracked (ignored via the user's *global* git ignore, not this repo's .gitignore)
├── docs/                          fingerprint-schema, thresholds, tuning-log, hybrid-comparison, ci, invisibility, acceptance-sweep, phase5-results
├── demo/
│   └── README.md                  The scripted, timed (~20s measured) demo path
├── career/                        GITIGNORED (added Phase 9) — Aayush's personal resume bullet + interview script, deliberately excluded from the public repo
├── ts-scratch/                    GITIGNORED — Aayush's TS-tip playground; 15 files present on disk, none tracked
├── packages/
│   ├── eir/                       THE PUBLISHED ENGINE — npm: playwright-eir@0.3.0 (see §4.1)
│   ├── demo-app/                  React+Vite "Ward" app + reference Playwright suite (see §4.2)
│   ├── benchmark/                 Mutation engine, harness, report generator (see §4.3)
│   └── ci-action/                 PR-comment GitHub Action (see §4.4)
└── (no root-level .eir/ — see note below)
```

**Note on `.eir/` placement (a real doc/reality drift, also flagged in
§13):** `CLAUDE.md` §9's repository map lists `.eir/` as a root-level entry
("fingerprint store; committed; generated by runs against demo app"). On
disk, there is **no root-level `.eir/`**. The real committed store lives at
`packages/demo-app/.eir/routes/*.json` (12 tracked files this session), and
a second, deliberately gitignored one exists at `packages/benchmark/.eir/`
(the benchmark's own synthetic per-run captures — 0 tracked files, confirmed
via `git ls-files packages/benchmark/.eir`). `README.md`'s own repository
map (written later, Phase 9) gets this right: it lists
`packages/demo-app/.eir/` explicitly. So the drift is specifically in
`CLAUDE.md`, not in the newer `README.md`.

### Per-package file counts (this session, `find`/`git ls-files`)

| Package | Source + test files (excl. dist/node_modules) |
|---|---:|
| `packages/eir` | 116 files under `src/` (62 implementation `.ts` + 54 `.test.ts`) |
| `packages/demo-app` | ~40 files (React app + domProfile + 2 test suites: `linear-suite`, `pom-suite`, plus `eir-proof/`) |
| `packages/benchmark` | 8 `.test.ts` + ~20 implementation files + committed `reports/`/`results/` artifacts |
| `packages/ci-action` | 4 `.test.ts` + 5 implementation files + `action.yml` |

---

## §3. The Four Governing Documents

| Document | Lines (`wc -l`) | Last substantive commit (`git log -1 -- <file>`) | Drift vs. observed reality this session |
|---|---:|---|---|
| `BLUEPRINT.md` | 303 | `eddd5c4`, 2026-07-11 21:25:55 +0530 — "docs: thresholds.md, NOTE-001 retrofit governing-doc edits" | No drift found in its principles/non-goals (P1–P8, §6) against the actual `EirLocator`/policy code read this session. §7.2/§7.6's NOTE-001 retrofit description matches `postCondition.ts`/`eirLocator.ts` exactly. |
| `EIR_BLUEPRINT_APPROACH.md` | 515 | same commit `eddd5c4` (edited together with BLUEPRINT.md for the same retrofit) | Phase DoD checklists match what was found built (see §4/§8/§9). No drift found. |
| `CLAUDE.md` | 150 | `ca15952`, 2026-07-07 12:14:34 +0530 — "never delete a branch without asking first" | **One drift found:** §9's repository map lists `.eir/` at the repo root; actual location is `packages/demo-app/.eir/` (see §2 note, §13 #1). Everything else checked (Git & Commits rules, branch naming, canonical commands) matches observed practice — e.g. every branch in `git branch -a` follows `<scope>-<purpose>-<YYYY-MM-DD>`, and no branch has ever been force-deleted (18 stale branches from every phase are still present, `git branch -a` — consistent with the never-delete-without-asking rule). |
| `NOTES.md` | 570 (at HEAD, before this session's own log entry) | `a79844c`, 2026-07-16 19:28:39 +0530 — "Phase 9 session 2 log" | Read in full this session (see §12 for the faithful ledger restatement). Internally consistent with the code: e.g. RISK-011's claimed engine-level fix (`classifyFailureSpecies` case-insensitive timeout match) was confirmed by direct source read (`packages/eir/src/triage/failureSpecies.ts`, described in §7 below). |

All four documents were read in full this session (not recalled) before any
other inspection began.

---

## §4. Package-by-Package Deep Dive

### §4.1 `packages/eir` — the published engine (`playwright-eir@0.3.0`)

**Purpose:** the npm package. Everything a consumer installs.

**`package.json` essentials** (read verbatim this session):
- `"type": "module"`, `"main": "./dist/index.js"`, `"types": "./dist/index.d.ts"`
- `exports` map — exactly 3 subpaths, each with `types`/`import`/`default`:
  - `"."` → `dist/index.js`
  - `"./globalTeardown"` → `dist/store/globalTeardown.js`
  - `"./reporter"` → `dist/reporter/eirReporter.js`
- `"files": ["dist"]` — only `dist/` ships (confirmed by `npm pack --dry-run`, §5/§11)
- `peerDependencies`: `"@playwright/test": ">=1.40"` — justification (from code comments/NOTES): the user's own Playwright install must be *the* Playwright instance wrapped, not a bundled second copy
- `dependencies`: **exactly one** — `"zod": "^4.4.3"` (added Phase 8, for validating Gemini's wire responses and boundary JSON)
- `devDependencies`: `@playwright/test` (also a devDep — needed for `packages/eir`'s own real-Chromium acceptance test, NOTE-005), `@types/node`, `typescript`
- `engines.node`: `>=22.13`

**Source-directory map** (every `src/` subdirectory, purpose + key exports):

| Directory/file | Owns | Key exports |
|---|---|---|
| `index.ts` | Public entry point | `eirVersion()`, re-exports `test`/`expect`/`defineEirConfig`/`EirConfig`/`EirMode` |
| `fixture.ts` | The `base.extend()` fixture override — the sanctioned Playwright plugin surface | `test`, `expect` |
| `eirPage.ts` / `eirLocator.ts` | Explicit typed wrapper classes implementing Playwright's `Page`/`Locator` — capture points, imperative try/catch shells, interrogative pass-throughs, the full heal decision + retry-once + fallback orchestration | `EirPage`, `EirLocator` |
| `config.ts` | User-facing config surface | `EirConfig`, `FallbackConfig`, `DEFAULT_EIR_CONFIG`, `defineEirConfig()` |
| `capture/` | In-page fingerprint extraction + Node-side shaping (attrs allow-list, class filter, text truncation, bbox quantization) + the "pulse" (route/element-count snapshot) used for post-conditions | `captureFingerprint`, `capturePulse`, `rawExtract` (in-page, self-contained), `attrsFilter`, `classFilter`, `textTruncate`, `bboxQuantize`, `pagePulse` |
| `fingerprint.ts` | The `Fingerprint` type + `isFingerprint` type predicate | `Fingerprint`, `isFingerprint` |
| `postCondition.ts` | NOTE-001's sibling artifact — `PostCondition` discriminated union, `derivePostCondition`, `postConditionMatches` | `PostCondition`, `isPostCondition`, `derivePostCondition`, `postConditionMatches` |
| `routeNormalize.ts` / `selectorIdentity.ts` / `selectorNormalize.ts` | Route pattern normalization, selector chain identity plumbing, selector template normalization (the XPath-literal-only scoping from RISK-008) | `normalizeRoute`, `SelectorIdentity`, `extendChain`, `normalizeSelector` |
| `store/` | Fingerprint + post-condition persistence: atomic writes, per-worker shard writers, deterministic merge, `globalTeardown`, readers | `FingerprintStore`, `PostConditionStore`, `genericRouteStore` (the type shared by both leaf stores), `runGlobalTeardown`/`eirGlobalTeardown` (default export of the `./globalTeardown` subpath) |
| `triage/` | Blueprint §7.4's 4 eligibility gates + failure-species classification | `runTriageGates`, `TriageDecision`, `classifyFailureSpecies` |
| `matching/` | The full funnel: candidate capture, 6 pure scorers, weighted aggregate + decision margin, suggested-selector generation | `attemptMatch`, `MatchAttempt`, `scoreCandidates`, `decideMargin`, `INITIAL_WEIGHTS`, `suggestSelector`, `scorers/*` (attrOverlap, textSimilarity, labelMatch, ancestorChain, siblingPosition, bboxProximity) |
| `policy/` | The state machine (confidence/margin → action), thresholds, drift-check (Mechanism B), event log types | `decidePolicyAction`, `PolicyAction`, `DEFAULT_HEAL_THRESHOLD`/`DEFAULT_SUGGEST_THRESHOLD`/`DEFAULT_MIN_MARGIN`/`DEFAULT_DRIFT_SELF_SIMILARITY_THRESHOLD`, `checkSelfSimilarity`, `PolicyLog` |
| `fallback/` | Phase 8's opt-in Gemini second opinion: trigger predicate, prompt builder, zod verdict schema, real + null providers, the runner that wires it all together | `isFormallyUncertain`, `buildFallbackPrompt`, `WireVerdictSchema`, `GeminiProvider`, `NullProvider`, `buildFallbackRunner` |
| `reporter/` | Blueprint §7.7's Playwright custom reporter | `EirReporter` (default export of `./reporter` subpath), `ReportRow`, `HealAction` |
| `acceptance/` | Phase 9's behavioral-acceptance-criteria proofs (real browser, not mocked) | 4 test files — see §8 |
| `methodClassification.ts` | The imperative/interrogative method-name tables | (internal constants, exhaustively table-tested) |
| `forwardOverloaded.ts` / `assertNever.ts` / `debugLog.ts` | Small shared utilities: overload-collapsing helper for `evaluate`/`evaluateAll`/`evaluateHandle`, exhaustiveness helper, `EIR_DEBUG=1` logging | — |

**Build setup:** `tsconfig.json` extends `../../tsconfig.base.json`
(`strict: true`, `noUncheckedIndexedAccess: true`, `module`/`moduleResolution:
NodeNext`, `target: ES2022`); `tsconfig.build.json` extends that and excludes
`**/*.test.ts`. `dist/` (built this session via `pnpm --filter playwright-eir
build`) contains a `.js` + `.d.ts` + both `.map` files per source module —
291 files total in the published tarball (see §5/§11).

### §4.2 `packages/demo-app` — "Ward"

**Purpose:** the React+Vite demo application every other package tests
against — login, dashboard nav, a devices data table (with two visually
similar tables — the false-heal bait), a provisioning form, an account
delete modal, a 3-step hash-routed wizard.

**`package.json` essentials:** private, `"type": "module"`. Runtime deps:
`react`/`react-dom` `^19.2.7`, `react-router-dom` `^7.18.1`. Dev deps include
`playwright-eir: workspace:*` (the reference suite runs through Eir itself,
not vanilla Playwright — confirmed by `tests/*/*.spec.ts` imports) and
`@vitejs/plugin-react`, `vite@^8.1.3`.

**Source map:** `src/domProfile.ts` centralizes every id/class/testid (the
Phase 1 "mutation-readiness by construction" concession); `src/mutation/
overrides.ts` reads `VITE_EIR_MUTATIONS` and is a pure pass-through when
unset; `src/pages/*.tsx` are the 5 app surfaces; `src/auth.ts`/
`ProtectedRoute.tsx` gate the dashboard. `tests/linear-suite/` (6 specs) and
`tests/pom-suite/` (5 specs) are the same behaviors written two different
ways (Blueprint P1: style-agnostic by construction); `tests/eir-proof/`
holds `auto-wait.spec.ts` (the invisibility proof's auto-wait regression
spec) and `locator-as-argument.spec.ts` (the committed RISK-005
characterization test — asserts the *current bug's* throw, so it stays
informative rather than red).

**Runtime artifacts on disk this session (untracked, gitignored):**
`packages/demo-app/eir-report/` (a real `eir-report.json`/`.md` plus 3
screenshot PNGs from a prior local run) — confirmed via `git ls-files
packages/demo-app/eir-report` returning **zero** tracked files, consistent
with `.gitignore`'s `eir-report/` entry.

**Relation to other packages:** consumes `playwright-eir` (workspace dep);
is itself consumed by `packages/benchmark` (workspace dep) as the target
application for mutation + healing runs.

### §4.3 `packages/benchmark`

**Purpose:** the judge — mutation engine, harness, report generator.

**`package.json` essentials:** private, deps on `demo-app`/`playwright-eir`
(both `workspace:*`), `tsx` (script runner for the CLIs), `@playwright/test`.
Scripts: `bench` (`tsx src/cli.ts`), `bench:heal-evidence`, `bench:hybrid`,
`mutation-payload`.

**Source map:** `mutationClasses.ts`/`targets.ts` (the 8-class taxonomy +
target registry, ≥8 selectors/class), `groundTruth.ts` (old→new element
mapping, the objective classifier's ground truth), `prng.ts` (seeded,
deterministic), `runner.ts`/`devServer.ts`/`probeRunner.ts` (orchestrates
calibration → mutate → rerun → classify), `outcome.ts` (the discriminated
`healed-correct`/`healed-wrong`/`suggested`/`missed` outcome union),
`report.ts`/`cli.ts` (table generation), `healModeEvidence.ts`/
`healEvidenceCli.ts` (NOTE-001's real heal-mode evidence runs),
`hybridComparison.ts`/`hybridComparisonCli.ts` (Phase 8's heuristics-vs-LLM
comparison), `evidenceFileGuard.ts` (NOTE-008's `--force`-gated overwrite
protection), `printMutationPayload.ts` (feeds the CI dogfood step).

**Committed artifacts** (read in full for §9): `reports/baseline.md`/`.json`,
`reports/hybrid-comparison.md`/`.json`, `reports/note001-heal-evidence-*.md`/
`.json` (×2), `results/*-seed42.json` (×8, one per mutation class).

**Relation to other packages:** depends on both `demo-app` and
`playwright-eir`; is the sole producer of every measured number that
appears in `README.md`/`docs/*.md`.

### §4.4 `packages/ci-action`

**Purpose:** the GitHub Action that reads `eir-report.json` and upserts a
single PR comment.

**`package.json` essentials:** private, `"engines": {"node": ">=20"}`.
**Zero runtime dependencies** — confirmed by `package.json` (only
`devDependencies`: `@types/node`, `playwright-eir: workspace:*`,
`typescript`) and by the source itself (`githubClient.ts` uses plain
`fetch`, not `@actions/github`/`@octokit`).

**Source map:** `main.ts` (entry point — reads inputs, reads the report,
renders the comment, upserts it), `githubContext.ts`/`githubClient.ts`
(env-var-driven GitHub Actions context resolution + a thin REST client over
`fetch`), `report.ts` (parses/validates `eir-report.json`), `renderComment.ts`
(markdown rendering, including fallback-provenance and post-condition
verification wording), `marker.ts` (the `<!-- eir-report:v1 -->` upsert
marker, typed as a template-literal type per Phase 7's TS tip),
`upsertComment.ts` (find-by-marker-or-create).

**`action.yml`:** `runs.using: "node24"`, `main: dist/main.js`. Inputs:
`github-token` (required), `report-path` (default
`eir-report/eir-report.json`), `mode` (default `"unknown"`), `docs-url`,
`pr-number` (override).

**Relation to other packages:** depends on `playwright-eir` only for typing
(`ReportRow`/`FallbackRowVerdict`/`PostConditionVerification`, re-exported
from the `./reporter` subpath specifically so `ci-action` never needs a
forbidden deep import); consumed by `.github/workflows/ci.yml` via a local
path reference (`uses: ./packages/ci-action`) — **not published to any
registry** (see NOTE-006, §12).

---

## §5. Public API Surface

Built this session (`pnpm --filter playwright-eir build`) and read
`dist/*.d.ts` verbatim for all three `exports` subpaths.

### `.` (main entry — `dist/index.d.ts`)
```ts
export declare function eirVersion(): string;
export { test, expect } from "./fixture.js";
export { defineEirConfig, type EirConfig } from "./config.js";
export type { EirMode } from "./policy/eirMode.js";
```
Four runtime/type exports total: `eirVersion()`, `test`, `expect`,
`defineEirConfig()`, plus the `EirConfig`/`EirMode` **types only** (no
runtime value ships for these — a user's `eir.config.ts` can be fully typed
without importing any engine internals).

### `./globalTeardown` (`dist/store/globalTeardown.d.ts`)
```ts
export declare function runGlobalTeardown(baseDir?: string): Promise<void>;
export default function eirGlobalTeardown(_config?: unknown): Promise<void>;
```
`eirGlobalTeardown` (default export) is what a user's `playwright.config.ts`
points `globalTeardown` at; `runGlobalTeardown` is the underlying merge
logic with an explicit `baseDir` param, used directly by the test suite.

### `./reporter` (`dist/reporter/eirReporter.d.ts`)
```ts
export type { FallbackRowVerdict } from "../fallback/verdict.js";
export type { PostConditionVerification } from "../policy/policyLog.js";
export interface EirReporterOptions { readonly outputDir?: string; }
export type HealAction = "healed" | "suggested" | "missed" | "heal-rejected" | "heal-attempt-failed" | "drift-suspected";
export interface ReportRowFallback { readonly provider: string; readonly verdict: FallbackRowVerdict; readonly detail: string | null; }
export interface ReportRow { /* testTitle, method, route, selectorKey, action, confidence, suggestion, screenshotFile, fallback, postConditionVerification */ }
export declare class EirReporter implements Reporter {
  constructor(options?: EirReporterOptions);
  onTestEnd(test: TestCase, result: TestResult): void;
  onEnd(): Promise<void>;
}
export default EirReporter;
```
This subpath re-exports two types (`FallbackRowVerdict`,
`PostConditionVerification`) from otherwise-internal modules
(`fallback/verdict.ts`, `policy/policyLog.ts`) **specifically** so
`ci-action` can type a report row without a deep import the `exports` map
would otherwise block — a deliberate, narrow, single-purpose re-export, not
a leak (confirmed by checking that no *value*, only the *type*, crosses this
boundary).

### Deep-import enforcement — verified live, not assumed

Two real experiments this session:
```
node -e "import('playwright-eir/matching/matcher').then(...)"
→ ERR_PACKAGE_PATH_NOT_EXPORTED: Package subpath './matching/matcher' is not
  defined by "exports" in .../playwright-eir/package.json
```
This confirms the `exports` map genuinely blocks any subpath not listed,
for anyone resolving the package **by its package name** (the only way a
real external consumer ever imports it). A raw relative `require("./dist/
matching/matcher.js")` executed from *inside* the package's own directory
does resolve — but this is unreachable from outside the package (a
consumer has no such relative path available, and TypeScript/bundler
resolution for an installed dependency always goes through the package
name), so it is not a real bypass of the boundary the `exports` map
enforces for actual consumers.

### `EirConfig`/`EirMode` full shape, defaults, measured-vs-estimated

| Field | Type | Default | Measured or estimated |
|---|---|---|---|
| `mode` | `EirMode` (discriminated: `{mode:"suggest-only"}` \| `{mode:"heal", healThreshold, suggestThreshold}`) | `{mode:"suggest-only"}` | Design decision (Q6), not a measurement |
| `mode.heal.healThreshold` | `number` | `0.7` | **Measured** — Phase 5's `MEASUREMENT_HIGH_CONFIDENCE_THRESHOLD`; 5 tuning iterations found no evidence to move it (`docs/thresholds.md`, `docs/tuning-log.md`) |
| `mode.heal.suggestThreshold` | `number` | `0.3` | **Estimated** — explicitly labeled in `docs/thresholds.md`/`policy/thresholds.ts` as an honest first-principles guess; Phase 5's benchmark never produced a genuinely low-confidence match to calibrate against (NOTES.md Q-001) |
| decision margin bar (internal, not a config field) | `number` | `0.05` | **Measured** — the exact bar that catches the `near-dup.table-row` 0.8457-confidence/0.0085-margin knife-edge case |
| drift self-similarity bar (internal) | `number` | `0.7` (reuses `DEFAULT_HEAL_THRESHOLD`) | Deliberate reuse, backed by exactly one real data point (0.6471 on the sibling-reorder evidence run) — not independently tuned |
| `routeOverrides` | `readonly RouteOverride[]` optional | none | — |
| `fallback` | `FallbackConfig` optional (`provider: "gemini"`, `enabled`, `apiKeyEnv?`, `model?`) | `undefined` (fully off, zero API calls) | Design decision (Q5/off-by-default), not itself a measured number |

---

## §6. Runtime Data & Artifacts

### `.eir/routes/*.json` (fingerprints) — real example, `packages/demo-app/.eir/routes/login.json`

Read verbatim this session. Six entries keyed by selector-identity string
(e.g. `getByTestId("login-submit")`, `locator("#login-username-input")`),
each a `Fingerprint` matching `docs/fingerprint-schema.md`'s shape exactly:
`v:1`, `tag`, `attrs` (allow-listed keys only — here `data-testid`, `type`,
`id`), `text`/`label` (nullable), `ancestors` (≤3 hops, filtered classes —
only `"login-page"` survives the Tailwind-noise filter here), `siblingIndex`/
`siblingCount`, `bbox` (32px-quantized). Keys are sorted, file is
pretty-printed — confirmed diff-stable by design (Phase 3 DoD).

### `.eir/routes/*.postconditions.json` — real example, same route

Read verbatim: six entries, one per selector, each a `PostCondition` —
`{"kind":"route-change","toRoute":"/dashboard/devices","v":1}` for the two
submit-triggering selectors, `{"kind":"none","v":1}` for the four that have
no observable side effect (typing into username/password fields). This is
the literal, real example this schema was designed to produce.

### Shard lifecycle

Per-worker shard directories (`.eir/.shards/`, `.eir/.shards-postconditions/`)
are gitignored explicitly (`.gitignore` lines quoted in §2); merged
deterministically in `globalTeardown` (last-write-wins per selector,
per Q8/§7.3). `packages/benchmark/.eir/` is entirely gitignored (0 tracked
files, confirmed via `git ls-files`) — the benchmark's own captures are
synthetic per-run, not a calibrated baseline worth preserving.

### `eir-report/` — reporter output

Confirmed present on disk at `packages/demo-app/eir-report/` (a real
`eir-report.json`, `eir-report.md`, and 3 screenshot PNGs from a prior local
run) but **zero files tracked by git** — fully consistent with
`.gitignore`'s `eir-report/` entry. Shape: `eir-report.json` is
`{"rows": ReportRow[]}`; `eir-report.md` is a Markdown table (Test | Route |
Selector | Action | Confidence | Verification | Suggestion | LLM fallback |
Screenshot) rendered by `EirReporter#renderMarkdown`.

### Debug/diagnostic channels — every one grepped this session

| Env var | Set by | Purpose |
|---|---|---|
| `EIR_DEBUG=1` | end user | `[eir] captured:`/`[eir] outcome:` console lines (Phase 2 invisibility-proof channel) |
| `EIR_MATCH_LOG_FILE` | `packages/benchmark` only | JSONL of every match attempt, for the harness's own classification |
| `EIR_POLICY_LOG_FILE` | `packages/benchmark` only | JSONL of every policy decision + retry outcome |
| `EIR_BENCH_FALLBACK` | `packages/benchmark`'s hybrid-comparison probes only | Opts generated probe tests into the real Gemini fallback |
| `VITE_EIR_MUTATIONS` | `packages/benchmark`'s dev-server orchestration, and the CI dogfood step | The seeded mutation payload consumed by `demo-app`'s `mutation/overrides.ts` |
| `GEMINI_API_KEY` (or whatever `apiKeyEnv` names) | end user's own shell only | The only secret in this system; never in config, never logged, never in this repo (confirmed by the §1 secret-grep) |

Every one of these defaults to unset/no-op — confirmed by reading each
consuming file's own "only if set" guard (`fixture.ts`, `matchLogFile.ts`,
`policyLogFile.ts`).

---

## §7. Control Flow

Traced against real file/function names read this session
(`packages/eir/src/eirLocator.ts`, `fixture.ts`, `triage/gates.ts`,
`matching/matcher.ts`, `matching/aggregate.ts`, `policy/stateMachine.ts`,
`postCondition.ts`, `fallback/trigger.ts`).

### (a) Happy path

1. A capture-point method (`page.locator()`, `getByRole()`, …) is called on
   `EirPage`/`EirLocator` → returns a new `EirLocator` wrapping the real
   `Locator`, recording `{rawSelector, chainPath, routeAtCreation}`
   (`EirLocator` constructor).
2. An imperative method (`click`, `fill`, …) calls `#runImperative`, which:
   - starts `captureFingerprint(this.#real)` **concurrently** with the
     action itself (RISK-007's fix — not after resolution, so a
     navigational action's own destroyed element is still reachable at the
     instant the round-trip starts);
   - starts a "before" `capturePulse` the same way;
   - awaits the real action.
3. On success: `logOutcome(method, "OK")`, then `#recordCapture` (fire-and-
   forget) — looks up the stored baseline via `this.#matching.reader`, runs
   `checkSelfSimilarity` against it (**Mechanism B**: a suspiciously low
   score logs `drift-suspected` but never blocks the refresh), then
   `this.#recorder.record(...)` overwrites the baseline (last-known-good).
   In parallel, `#recordPostCondition` awaits the "after" pulse and stores
   `derivePostCondition(before, after)` as the sibling postcondition file.
4. Both are registered with `trackPending()`; the worker-scoped
   `eirStore`/`eirPostConditionStore` fixtures (`fixture.ts`) await
   `waitForPending()` before writing their shard in teardown — so a
   fire-and-forget capture is never silently dropped by a worker shutting
   down mid-flight.
5. `globalTeardown` (the `./globalTeardown` export) merges every worker's
   shard into `.eir/routes/*.json`/`*.postconditions.json` deterministically.

### (b) Failure path

1. The real action throws → `logOutcome(method, "FAILED", ...)` →
   `#attemptHeal(method, error)`.
2. Inside `#attemptHeal`: `isPageSane(page)` (dead server / error page /
   unloaded document check) + `attemptMatch(...)`, which itself runs
   `runTriageGates` first (`triage/gates.ts`):
   - Gate 1 `gateFingerprintExists` — no baseline → `rejected`
     (`no-fingerprint`) — **the structural wall**: interrogative methods
     never even reach this function, because `isVisible`/`isEnabled`/
     `isChecked`/`count` have no catch-shell at all in `EirLocator` (plain
     pass-throughs) — there is no code path connecting them to
     `#attemptHeal`, in any mode.
   - Gate 2 `gatePageSane` — document not ready or route changed since
     creation → `rejected` (`page-not-sane`).
   - Gate 3 `gateFailureSpecies` (`triage/failureSpecies.ts`) — only
     `zero-match`/`detached` are heal-eligible.
   - Gate 4 `gateMethodImperative` — defense-in-depth restating the
     structural wall above.
3. If eligible: `captureCandidates` (transient, never persisted) →
   `scoreCandidates` (6 pure scorers, `matching/aggregate.ts`'s
   `isApplicable`-gated weighted sum) → `decideMargin` (top score AND gap
   to runner-up) → `MatchAttempt` of kind `matched`/`no-candidates`/
   `rejected`.
4. `decidePolicyAction(attempt, mode)` (`policy/stateMachine.ts`) — pure
   function: `rejected`/`no-candidates` → always `fail-normally`; below
   `suggestThreshold` → `fail-normally` regardless of mode; **at/above
   `healThreshold` AND the margin bar, in `heal` mode** → `heal-and-
   continue` (the only branch that ever retries — **suggestion-cap wall
   #2**); everything else that cleared the suggest floor → `fail-with-
   suggestion`.
5. If `heal-and-continue`: `#retryHealed` re-executes the same action
   against the matched candidate, capturing before/after pulses around the
   retry itself (**genuinely awaited**, unlike record mode's fire-and-
   forget). Looks up the stored post-condition:
   - no baseline ever stored → `verification: "skipped-no-baseline"` (a
     materially weaker trust signal, NOTE-004);
   - stored `"none"` or an unobservable pulse → `"skipped-none"`;
   - a real stored post-condition that **mismatches** the observed one →
     `heal-rejected-post-condition-mismatch` — **Mechanism A, the third
     structural wall**: downgrades to fail-with-suggestion even though
     pre-action confidence/margin both cleared their bars; the *original*
     error is what the caller sees, never the retry's own.
   - a match → `verification: "verified"`.
6. If **not** `heal-and-continue` (suggested or missed): only here does the
   Gemini fallback get consulted — `isFormallyUncertain(matchAttempt)`
   (`fallback/trigger.ts`) gates it further to exactly the "formal
   admission of uncertainty" shape. The fallback's verdict is
   suggestion-capped by construction: it is recorded on the policy event
   but there is no code path from a fallback verdict back into
   `#retryHealed` — `#retryHealed`'s branch has already completed by the
   time the fallback ever runs.
7. Every outcome is recorded via `policyLog.record(...)` and, for
   heal/suggestion cases, a Playwright annotation (`eir-healed`/
   `eir-heal-rejected`/`eir-heal-attempt-failed`/`eir-suggested`) — never
   silent (Blueprint P3).

---

## §8. Test Inventory

All counts below are from **actually running** each package's test command
this session, not from NOTES.md's own prior record (which they happen to
match for `packages/eir`).

| Package | Command run | Result |
|---|---|---|
| `packages/eir` | `pnpm --filter playwright-eir test` (vitest) | **354 tests passed, 54 files passed**, 0 failed |
| `packages/benchmark` | `pnpm --filter benchmark test` (vitest) | **93 tests passed, 8 files passed** |
| `packages/ci-action` | `pnpm --filter ci-action test` (vitest) | **40 tests passed, 4 files passed** |
| `packages/demo-app` | `pnpm --filter demo-app test` (vitest — unit only) | **18 tests passed, 1 file passed** (`src/mutation/overrides.test.ts`) |

**Total Vitest unit tests run and passing this session: 505, across 67
files.**

**Playwright spec files (not counted above, run via `playwright test`, not
vitest):**
- `packages/demo-app/tests/` — 13 files: 6 `linear-suite/`, 5 `pom-suite/`,
  2 `eir-proof/` (`auto-wait.spec.ts`, `locator-as-argument.spec.ts`).
- `packages/benchmark/probes/probe.spec.ts` — 1 file, deliberately excluded
  from vitest collection (`vitest.config.ts`'s own comment: it imports
  `playwright-eir`'s `test`, not vitest's, and reads harness-set env vars).

**Kinds of tests and where each lives:**
- **Unit** (table-driven, pure functions): scorers (`matching/scorers/
  *.test.ts`), normalizers (`routeNormalize`/`selectorNormalize.test.ts`),
  triage gates, policy state machine, classifiers — the large majority of
  the 354 in `packages/eir`.
- **Integration** (real Playwright, real demo app): `demo-app/tests/*`,
  `benchmark/probes/probe.spec.ts`.
- **Acceptance** (real browser, proving Blueprint §9.2 criteria
  end-to-end): `packages/eir/src/acceptance/` — 4 files:
  `neverFingerprintedFailsVanilla.test.ts`, `noSourceWrites.test.ts`
  (a structural scan asserting every `fs` write call in `packages/eir/src`
  is confined to exactly the audited files/directories), `storeSizeEnvelope
  .test.ts`, `note005RealFalseHeal.test.ts` (real Chromium, real unmocked
  matcher, a genuine false heal genuinely caught by Mechanism A).
- **Characterization** (documents a known bug, not a passing spec):
  `packages/demo-app/tests/eir-proof/locator-as-argument.spec.ts` — asserts
  RISK-005's current throw, so it stays informative in CI rather than
  permanently red if/when NOTE-009 ever fixes it.

**`docs/acceptance-sweep.md`'s 7 criteria → proving tests, links verified
this session by reading both the doc and the named test files directly:**
all 7 links hold; two (#5 `noSourceWrites.test.ts`, #6
`storeSizeEnvelope.test.ts`) were confirmed to exist and match their
described behavior by direct read this session, not just doc trust.

**Tests unit-tested but never live-exercised (per NOTES.md's own ledger,
restated faithfully, not re-litigated):** NOTE-005's mismatch-and-reject
branch had exactly this problem until Phase 9 fixed it with a real
end-to-end demonstration (see §9); NOTE-011 (the "comment updates to clean
state" ci-action branch) remains in this state today — unit-tested,
never exercised by a real PR that had findings and then lost them.

---

## §9. Benchmark & Measured Claims

### The 8 mutation classes and where each is implemented

`id-rename`, `text-change`, `tag-swap`, `class-shuffle`, `sibling-reorder`,
`wrapper-inject`, `near-duplicate-sibling-swap`, `compound-release` — all
defined in `packages/benchmark/src/mutationClasses.ts`/`targets.ts`, applied
to `demo-app` via `VITE_EIR_MUTATIONS` (read by `src/mutation/overrides.ts`,
a pure pass-through when unset).

### The committed baseline table (read verbatim, `packages/benchmark/
reports/baseline.md`) — traced against `README.md`'s own results table:
**byte-identical**, every row.

| Mutation Class | Affected | Heal Rate | False-Heal Rate | Suggestion Rate | Miss Rate |
|---|---:|---:|---:|---:|---:|
| id-rename | 8 | 75.0% | 0.0% | 25.0% | 0.0% |
| text-change | 8 | 87.5% | 0.0% | 12.5% | 0.0% |
| tag-swap | 8 | 100.0% | 0.0% | 0.0% | 0.0% |
| class-shuffle | 8 | 25.0% | 0.0% | 75.0% | 0.0% |
| sibling-reorder | 8 | 0.0% | 0.0% | 0.0% | 100.0% |
| wrapper-inject | 8 | 100.0% | 0.0% | 0.0% | 0.0% |
| near-duplicate-sibling-swap | 8 | 25.0% | 0.0% | 75.0% | 0.0% |
| compound-release | 24 | 50.0% | 0.0% | 25.0% | 25.0% |

Reproduction command (per `CLAUDE.md` §9 / `package.json`):
`pnpm bench --class <c> --seed 42`, or `pnpm bench:all --seed 42` for the
full table. Determinism claimed in NOTES.md's Phase 4 log ("two independent
runs... diffed byte-identical") — **not independently re-run this session**
(would require restarting the demo app's dev server under the harness,
outside this audit's "describe, don't execute side-effecting changes"
scope); the committed `results/*-seed42.json` files were read and are
internally consistent with `baseline.md`'s aggregates.

### Tuning log — iteration list (headers read verbatim, `docs/tuning-log.md`, 419 lines)

Iteration 0 (baseline, not a change) through Iteration 5, **6 entries
total** (5 real tuning changes/investigations after the baseline) — matches
`docs/thresholds.md`'s claim of "five tuning iterations." Iteration 3 fixed
a real architectural bug (inapplicable scorers eating weight budget as a
hard zero); Iterations 4 and 5 are documented **negative results** (no
weight change, a real finding written down anyway) — consistent with
CLAUDE.md §10's "failures reported with the same energy as successes."

### Hybrid comparison — verdict + exact trigger-scope boundary (read verbatim, `docs/hybrid-comparison.md`)

- **74 invocation attempts, 17 real responses (23%), 57 clean `no-verdict`
  degradations** (real `http-429`/`http-503`), across 5 runs and 2 API keys.
- **100% of real responses were `endorsed`** — zero `contradicted`, zero
  `alternative`, zero `none-of-them`, including on `near-duplicate-sibling-
  swap`, the one adversarial-distractor class.
- **Accuracy delta: 0.0 percentage points on every class, by construction**
  — the suggestion-cap makes this a restatement of the type system, not a
  benchmark result, and the document says so explicitly.
- **Exact trigger-scope boundary** (NOTE-012's fix, verified present):
  `isFormallyUncertain` only ever fires on a `MatchAttempt` of kind
  `"matched"` that failed heal qualification — a `"no-candidates"` or
  `"rejected"` attempt can never reach the model. The document states this
  explicitly in two places (methodology section + numbered caveat #1 in
  "the honest verdict"), closing the exact over-generalization risk
  NOTE-012 named.
- **Recommendation, stated plainly: leave the fallback disabled by
  default** (the shipped default).

### NOTE-005's real-catch demonstration — what it does and doesn't prove

Read the test file (`packages/eir/src/acceptance/note005RealFalseHeal.test.ts`)
and `docs/acceptance-sweep.md`'s description of it. It proves: a real,
unmocked matcher **can** confidently heal to a wrong element (measured
confidence ≈0.56) under a deliberately permissive `healThreshold` (0.2,
**not** the shipped 0.7 default), and Mechanism A's `postConditionMatches`
genuinely catches that specific mismatch and downgrades it. It does **not**
prove the shipped 0.7/0.05 defaults are more or less safe than measured —
the test's own stated purpose is exercising the previously-only-mocked
rejection branch with a real matcher, not benchmarking the default
thresholds (the 0% measured false-heal rate at the real defaults comes from
the baseline table above, a separate measurement).

---

## §10. CI, Workflows & Automation

**Exactly one workflow file exists in this repository:**
`.github/workflows/ci.yml` (walked step by step; verbatim read this
session).

- **Triggers:** `push` to `main`; every `pull_request`.
- **Permissions block** (declared explicitly at the job level, not
  inherited from repo defaults — deliberate, per an inline comment, since
  this file is exactly what an adopter copies): `pull-requests: write`,
  `contents: read`.
- **Steps, in order:** checkout → `pnpm/action-setup@v4` → `setup-node@v4`
  (Node 22, pnpm cache) → `pnpm install --frozen-lockfile` → build
  `playwright-eir` → build `ci-action` → `pnpm lint` → `pnpm typecheck` →
  **install Chromium** (moved before `pnpm test`, per NOTE-005's Phase 9
  fix, since `packages/eir`'s own suite now needs a real browser) →
  `pnpm test` → **conditional dogfood mutation** (only on
  `pull_request` events where `github.head_ref ==
  'phase-7-dogfood-demo-2026-07-12'` — an exact, hardcoded, one-time branch
  name) → `pnpm --filter demo-app e2e` → `pnpm bench --class id-rename
  --seed 42` (one fast smoke class, not the full 8-class table) → upload
  `eir-report` as a workflow artifact (`if: always()`) → post/update the PR
  comment via `uses: ./packages/ci-action` (also `if: always()`, so it
  still runs when the dogfood mutation makes e2e fail).
- **The dogfood mechanism** is scoped to one exact, already-merged branch
  name (`phase-7-dogfood-demo-2026-07-12`) — see §13 for why this is flagged
  as a real staleness finding, not a design description issue.
- **`ci-action`'s inputs/behavior:** see §4.4 — reads `eir-report.json`,
  renders a markdown comment (diff blocks, confidence, a link to the
  workflow-artifact screenshots — never inlined, since GitHub strips
  `data:` URI images from comment bodies, confirmed live per NOTES.md
  Phase 7), upserts by the `<!-- eir-report:v1 -->` marker.
- **What CI does NOT cover** (confirmed by absence — no other workflow
  file exists): no publish automation (the Phase 9 `npm publish` was run
  manually by Aayush, including completing the OTP 2FA flow by hand, per
  NOTES.md); no external-fork test of `docs/ci.md`'s snippet (NOTE-010,
  open); no scheduled/cron jobs; the Gemini fallback path makes zero API
  calls in this default CI run (no `GEMINI_API_KEY` anywhere in this repo
  or workflow file, confirmed by the §1 secret grep and by `fallback`
  being `undefined` unless a user's own config opts in).

---

## §11. Security-Relevant Inventory

*(Raw material for the 1.0.0 security review — inventory, not judgment.)*

### Secrets handling
- The only secret this system ever handles is a Gemini API key, read from
  an env var named by `apiKeyEnv` (default `GEMINI_API_KEY`) — **never
  accepted as a config literal**, sent only as the `x-goog-api-key` HTTP
  header (never in the URL, per an inline code comment confirmed by
  reading `geminiProvider.ts`), never logged (error/reason strings in that
  file are built only from status codes, zod issue paths, and fixed
  labels — confirmed by reading every `#noVerdict` call site).
- `.gitignore` covers `.env`/`.env.*`, `career/` (personal, added Phase 9),
  `ts-scratch/`. Verified this session: a real `.env` exists locally,
  is untracked, matches the ignore rule, and has never appeared in git
  history (`git log --all --full-history -- .env` → empty).
- **Live grep this session, tracked files only:** `git grep -nEI` for
  Google API key shape (`AIza...`), AWS key shape (`AKIA...`), `sk-`/
  `ghp_`/`gho_`/`xox[baprs]-` prefixed tokens, PEM private-key headers, and
  generic `(api[_-]?key|secret|token|password)\s*[:=]\s*"..."` assignments
  (excluding `*.md` and `pnpm-lock.yaml` for the generic pattern, to avoid
  matching prose/lockfile noise). **Zero matches**, both greps.

### Runtime dependencies of the published package
Confirmed via `pnpm list --prod --depth=Infinity` scoped to `playwright-
eir`: **exactly one — `zod@4.4.3`**, which itself has zero further
dependencies (a leaf package). Total transitive runtime dependency count
for the published `playwright-eir` package: **1**.

### Code executed in the browser context via `page.evaluate`
- `capture/rawExtract.ts` — fingerprint extraction. Self-contained (no
  closures over Node scope, no imports inside — confirmed by direct read;
  NOTES.md records a real early `ReferenceError` that enforced this).
- `capture/pagePulse.ts` — the before/after route+element-count pulse for
  post-conditions.
- `matching/captureCandidates.ts` — transient candidate feature extraction
  at failure time (never persisted).
- All three read DOM state only; none write to the DOM, none execute
  page-supplied strings as code, none accept unsanitized user input as a
  selector fragment (selectors are Playwright's own API surface, not
  string-concatenated from captured page content).

### Code that touches the filesystem, and where it writes
Confirmed by direct read of `packages/eir/src/acceptance/
noSourceWrites.test.ts` (a real, committed structural guard, not just this
audit's own claim): every `fs` write primitive in `packages/eir/src` is
confined to exactly four files, each independently scoped to one of: the
`.eir/` store (`store/atomicWrite.ts`, shard writers), an explicit opt-in
`EIR_*_LOG_FILE` env-var path (benchmark-only diagnostic channel), or a
report output directory (`reporter/eirReporter.ts`, default `eir-report/`).
**Nothing in `packages/eir/src` ever writes to a user's own source files**
— this is the structural guarantee behind Blueprint P3, now enforced by an
automated regression test (added Phase 9; previously provable only by
manual inspection).

### Code that makes network calls
Exactly one: `fallback/geminiProvider.ts`'s `fetch` call to
`generativelanguage.googleapis.com`, gated behind `fallback.enabled === true`
**and** the key env var being set — off by construction otherwise (`buildFallbackRunner`
returns a no-op unless both conditions hold, confirmed by reading `fixture.ts`'s
construction call). `packages/ci-action`'s `githubClient.ts` also uses `fetch`,
against the GitHub REST API, using the workflow's own `github-token` input —
this only ever runs inside GitHub Actions, never as part of the published
`playwright-eir` package.

### What the published tarball contains
`npm pack --dry-run` (run this session): **291 files**, package size
**113.6 kB**, unpacked **440.0 kB**. Every file is under `dist/` (`.js` +
`.d.ts` + `.js.map` + `.d.ts.map` per module) plus `LICENSE`, `README.md`,
`package.json` at the root — confirmed by `"files": ["dist"]` in
`package.json` and the dry-run's own file listing: **no `.ts` source, no
test files, no `.env`, nothing outside `dist/`.**

### Injection surfaces
- Selectors passed to `page.locator(...)` during suggestion-generation and
  candidate re-resolution are built from Playwright's own captured
  attribute/role/text values (from the same page under test), never from
  an external/network source. No shell execution anywhere in
  `packages/eir`'s runtime path (confirmed by grep: no `child_process`
  import in `packages/eir/src`).
- The Gemini prompt (`fallback/prompt.ts`) embeds fingerprint + candidate
  feature summaries as structured text into a request whose response is
  schema-validated (zod) before any field is read — a malformed or
  adversarial model response degrades to `no-verdict`, never a crash or an
  unvalidated field read (confirmed by reading `geminiProvider.ts`'s
  `WireVerdictSchema.safeParse` gate).

### `ci-action`'s permission scope
`permissions: pull-requests: write, contents: read` — the narrowest grant
that lets it read/post/update one PR comment. A malicious PR from a fork
would run under GitHub's own default fork-PR restrictions (reduced token
scope, no secrets) before this workflow's own permissions block is even
reached — this repository does not further restrict or expand that
(no `pull_request_target` usage found; confirmed by reading the trigger
list — only bare `pull_request`, which does not grant a fork's PR the
base repo's secrets or write token by GitHub's own platform default).
**Not independently verified this session against a real external fork**
(NOTE-010, already an open, tracked gap — see §12).

---

## §12. Known-Gaps Ledger, Current State

Faithful restatement of every NOTE/RISK/Q entry in `NOTES.md`, read in full
this session. **Not a re-triage** — statuses and dispositions are exactly
as recorded there.

| ID | One-line summary | Status | Disposition | Plausibly needed for 1.0? |
|---|---|---|---|---|
| NOTE-001 | Post-condition verification for heal-and-continue (Mechanism A) | RESOLVED (Phase 6) | Implemented: schema, capture, verification; real heal-mode evidence gathered | Already done |
| NOTE-002 | New mutation class: near-duplicate-sibling-swap | RESOLVED (Phase 4) | Implemented as the 7th class, 8 pairs across 3 shapes | Already done |
| NOTE-003 | Fingerprint schema never captures an element's own class tokens | PARKED (unassigned target) | Documented as `class-shuffle`'s 25% structural ceiling; would require a schema-v2 + baseline recapture | **Yes, plausibly** — an API-surface/schema-freeze question for 1.0 |
| NOTE-004 | Post-condition verification silently no-ops on no-baseline vs. genuine "none" | RESOLVED (Phase 9) | `RetryOutcome` now distinguishes `verified`/`skipped-none`/`skipped-no-baseline`, threaded through reporter + ci-action | Already done |
| NOTE-005 | Mechanism A never caught a real wrong heal end-to-end | RESOLVED (Phase 9, mandatory fix) | Real Chromium acceptance test built; genuinely catches a real false heal | Already done |
| NOTE-006 | GitHub Marketplace publication of `ci-action` | PARKED (post-project polish) | Explicitly out of scope by design | No — adoption convenience, not correctness |
| NOTE-007 | Gemini free-tier rate limits are a real adoption cost | PARKED → documented | README states the measured ~23% real-response rate | No — documentation, already done |
| NOTE-008 | Benchmark evidence CLIs had no overwrite protection | RESOLVED (Phase 9) | `evidenceFileGuard.ts`'s `--force`-gated `assertWritable` | Already done |
| NOTE-009 | `EirLocator` needs a real unwrap step for `.and()`/`.or()`/`.dragTo()`/`.locator(sel,{has})` | PARKED (unassigned, post-release) | Confirmed real bug (RISK-005); fix requires its own design/Understanding Gate | **Yes, plausibly** — a real, reproducible correctness bug in the public wrapper surface |
| NOTE-010 | `docs/ci.md`'s snippet never verified from an external fork | PARKED (post-release polish) | Judged disproportionate for Phase 7's own DoD; deferred, not dropped | Minor — worth closing before/at 1.0 given the security-review framing |
| NOTE-011 | "No-heals comment updates to clean state" branch never exercised live | PARKED (post-release polish) | Unit-tested; low risk, upsert mechanism otherwise proven live | Minor |
| NOTE-012 | Hybrid comparison's "no benefit" claim needed its exact trigger-scope boundary stated | RESOLVED (Phase 9) | `docs/hybrid-comparison.md` states the `"matched"`-only scope explicitly, twice | Already done |
| Q-001 | Default for `suggestThreshold` | ANSWERED (provisionally, labeled an estimate) | `0.3`, unmeasured, revisit once real low-confidence match data exists | Worth a documented "still an estimate" call-out at 1.0, not necessarily a blocker |
| RISK-001 | Wrapper layer breaks Playwright auto-wait/chaining | WATCHING | Invisibility proof (Phase 2) is the ongoing detection mechanism | Ongoing risk, mitigated not eliminated |
| RISK-002 | Schedule slippage crowding out Phase 8 | MITIGATED (did not materialize) | Phase 8 delivered full scope | Resolved |
| RISK-003 | `EirLocator`/`EirPage` forward undocumented Playwright internals (`_apiName`/`_expect`) | WATCHING | Confirmed via spikes; `_expectScreenshot` explicitly not forwarded/untested (no suite uses `toHaveScreenshot`) | **Yes, plausibly** — an unversioned dependency on Playwright internals is exactly 1.0-stability-relevant |
| RISK-004 | Capture-point coverage stops at 6 named methods | WATCHING → documented | README/known-limitations names the untracked passthroughs explicitly | Worth a documented decision at 1.0 (accept the boundary, or widen it) |
| RISK-005 | Real Playwright methods taking a `Locator` argument may reject an `EirLocator` | WATCHING → confirmed real bug | Characterization test committed; real fix tracked fresh as NOTE-009 | **Yes** — same item as NOTE-009 above |
| RISK-006 | `removeAllListeners`'s split-return overload needed hand-written overloads | MITIGATED | Real permanent fix (2 explicit overload signatures), not a suppression | Resolved |
| RISK-007 | Post-success fingerprint capture lost every navigational action | MITIGATED | Concurrent-capture fix; governing docs edited deliberately to match | Resolved |
| RISK-008 | Selector-normalization templating collapsed distinct static selectors | MITIGATED | Templating rescoped to only the Blueprint-named XPath-literal case | Resolved |
| RISK-009 | `sibling-reorder` breakage invisible to Eir's own triage (never throws) | MITIGATED (partial) | Mechanism B detects it for the 4/8 targets Eir's wrapper actually reaches; the other 4 (plain pass-throughs / no baseline) remain a real, honestly-reported gap | **Yes, plausibly** — ties directly into RISK-004's capture-surface boundary |
| RISK-010 | `dom-count-change` page-wide count is occasionally non-deterministic | WATCHING | Confirmed harmless-direction-only (can only make verification *more* conservative); not fixed | Low priority — documented, safe-direction only |
| RISK-011 | `classifyFailureSpecies` missed zero-match without `actionTimeout` configured | MITIGATED (fully, Phase 9) | Case-insensitive timeout-string match now also catches the test-level-timeout shape; `actionTimeout` remains a *recommended*, not hard-enforced, prerequisite | Resolved at the engine level; `actionTimeout` is still an unenforced README convention, not a startup check |

---

## §13. Observations & Imperfections Noticed

Numbered, most to least concrete. Severity is a guess, not a verdict.
**Nothing below was fixed this session** — describing, not fixing, is this
session's entire mandate.

1. **`CLAUDE.md` §9's repository map places `.eir/` at the repo root; it
   actually lives at `packages/demo-app/.eir/`.** `README.md`'s own,
   later-written repository map gets this right
   (`packages/demo-app/.eir/  fingerprint store...`). Location:
   `CLAUDE.md` §9 vs. `git ls-files | grep '\.eir/'`. Severity: **cosmetic**
   — no code depends on `CLAUDE.md`'s map being literal, but it would
   mislead a reader following the working agreement verbatim.

2. **A stale code comment in `policy/thresholds.ts` names a report-string
   that no longer exists.** Line 28's comment says a suspicious drift score
   gets "flagged `silent-drift-suspected` in the report," but every real
   usage (`eirLocator.ts`, `reporter/eirReporter.ts`,
   `policy/policyLogFile.ts`, `policy/policyLog.ts`) uses the string
   `"drift-suspected"` (no `silent-` prefix) — confirmed by grep across all
   non-test source. Severity: **cosmetic** — the comment is simply out of
   sync with an apparent earlier rename; no behavioral effect.

3. **`packages/demo-app/playwright.config.ts`'s `actionTimeout` comment
   describes a bug that Phase 9 already fixed, as if it were still true.**
   The inline comment reads "...which `classifyFailureSpecies` doesn't
   recognize as zero-match (it looks for capital-T `Timeout`..." — but
   `classifyFailureSpecies` was widened Phase 9 (RISK-011's engine-level
   fix, confirmed by direct read of
   `packages/eir/src/triage/failureSpecies.ts`'s case-insensitive
   `.toLowerCase().includes("timeout")` check) to recognize *both* message
   shapes. The comment still frames `actionTimeout` as load-bearing for
   *correctness* (avoiding a silently-dead triage funnel), when post-fix
   its real remaining value is purely *speed* (5s vs. 30s+ diagnosis) —
   which is exactly what `README.md`'s own "Prerequisites" section says
   correctly. Location: `packages/demo-app/playwright.config.ts`, the
   `use.actionTimeout` comment block. Severity: **minor** — a reader of
   this specific file (not the README) would form an outdated belief about
   why the setting matters.

4. **The CI dogfood mechanism is pinned to one exact, already-merged
   branch name and can never fire again as-is.** `.github/workflows/
   ci.yml`'s dogfood step guards on `github.head_ref ==
   'phase-7-dogfood-demo-2026-07-12'` — a literal, one-time branch name
   from Phase 7, long since merged (confirmed: that branch still exists in
   `git branch -a` per the never-delete-without-asking rule, but its PR is
   closed/merged). Any future demonstration of the dogfood path would
   require either recreating a branch with that exact name or editing this
   workflow. Location: `.github/workflows/ci.yml`, the "Apply dogfood
   mutation" step's `if:` condition. Severity: **minor** — the mechanism
   worked as designed for its one intended demo (Phase 7's PR #15) but is
   not a reusable, ongoing capability as currently wired; a reader could
   reasonably expect it to be re-triggerable by branch-naming convention
   and be surprised it isn't.

5. **`ci-action`'s "does this run have findings" check may miss a genuine
   heal whose suggested-selector generation happened to fail.**
   `packages/ci-action/src/main.ts`'s `hasFindings = report.rows.some((row)
   => row.suggestion !== null)` uses `suggestion` as the sole signal of
   "worth commenting about." But `EirReporter`'s `suggestion` field for a
   `"healed"` row is populated from `matchAttempt.suggestion`, and
   `matching/suggestSelector.ts`'s own docstring states it returns `null`
   in the rare case "even the structural fallback fails (e.g. the page
   navigated away between matching and suggesting)." In that specific
   edge case, a row that is genuinely `action: "healed"` (a real retry
   succeeded) would carry `suggestion: null` and therefore not count
   toward `hasFindings` — if it were the only row in the run, the action
   would post "no findings" despite a real heal having occurred. Location:
   `packages/ci-action/src/main.ts` line ~32, `packages/eir/src/reporter/
   eirReporter.ts`'s `suggestion` assignment, `packages/eir/src/matching/
   suggestSelector.ts`'s documented null case. Severity: **minor, but
   matters-for-1.0** — it's a narrow, rare edge case (suggestSelector null
   is itself described as rare) but it is a genuine correctness gap in
   what the PR comment reports, not just a doc drift.

6. **`RISK-009`'s ledger status ("MITIGATED (partial)") is honestly
   reported, but the CI workflow's own `pnpm bench --class id-rename
   --seed 42` smoke step never exercises the class where the remaining gap
   lives** (`sibling-reorder`). This isn't a contradiction — the DoD never
   promised the CI smoke test would cover every class — but it does mean
   the one class with a known, only-partially-closed detection gap is not
   the one CI's fast per-push check happens to touch. Location: `.github/
   workflows/ci.yml`'s bench step vs. `NOTES.md` RISK-009. Severity:
   **cosmetic** — the full 8-class baseline is a deliberate manual/
   committed artifact, not a CI gate, by design (per the approach doc's
   own Phase 4 DoD), so this is a coverage note, not a broken promise.

7. **The `packages/eir` `README.md` on the npm registry was described in
   NOTES.md's Phase 9 log as "rewritten... as a condensed version linking
   back to GitHub"** — this session did not independently diff
   `packages/eir/README.md` against the root `README.md` line-by-line to
   confirm every claim in the condensed version still traces to the same
   measured artifacts (it was read as part of §4/§5's package inventory,
   but a full claim-by-claim retrace like §9 did for the root README was
   not repeated for the npm-facing copy). Severity: **cosmetic** — flagged
   as a gap in *this audit's own coverage*, not a confirmed defect in that
   file.

8. **No root-level `CHANGELOG.md`** — only `packages/eir/CHANGELOG.md`
   exists (starts at 0.3.0, per NOTES.md, "earlier versions point to this
   file's own Daily Progress Log"). For a monorepo where three of four
   packages are `private: true` and never released independently, this is
   arguably correct (only `packages/eir` has a version history worth a
   changelog) — noted here as an observation for the reviewer to weigh,
   not asserted as wrong.

9. **`DEFAULT_SUGGEST_THRESHOLD` (0.3) remains an explicitly unmeasured
   estimate**, carried from Phase 6 through to this 0.3.0 release without
   ever being exercised by real low-confidence benchmark data (Q-001,
   still `ANSWERED (provisionally)`). This is already honestly labeled
   everywhere it appears (`policy/thresholds.ts`'s own comment,
   `docs/thresholds.md`, `README.md`'s config-reference table) — flagged
   here only because a 1.0.0 stability commitment on this config surface
   would be a commitment to a number the project itself has never
   validated. Severity: **matters-for-1.0** in the sense that it's a
   pre-existing, already-disclosed limitation, not a newly discovered one.

10. **The dependency version numbers throughout this repo are unusually
    far ahead of any tooling this assistant has direct knowledge of**
    (e.g. `typescript@^6.0.3`, `pnpm@11.9.0`, `vite@^8.1.3`,
    `react@^19.2.7`, `eslint@^10.6.0`, `@playwright/test@^1.61.1`). This
    session verified they are **internally consistent** (the same
    versions appear in `pnpm-lock.yaml`, `node_modules` was already
    installed at these versions, and `pnpm --filter playwright-eir build`
    and all four packages' test suites ran successfully against them) —
    but this audit has no independent way to confirm these are real,
    currently-shipping versions of each tool from an external registry
    check beyond the one npm lookup already performed for `playwright-eir`
    itself. Severity: **noted for completeness, not a finding** — internal
    consistency is fully verified; external plausibility is outside this
    session's verifiable scope.

---

## §14. Version-Gap Statement

**What 0.3.0 is, verified this session, not asserted from memory:** a
working npm package with exactly one runtime dependency (`zod`), a
3-subpath `exports` surface that structurally blocks deep imports, 505
passing unit tests across 4 packages plus a real-browser acceptance suite,
a single green CI workflow, a fully wired (if partially-covered) triage →
match → policy → report → CI-comment pipeline, and an honestly-measured
8-class benchmark whose README claims trace byte-for-byte to committed
artifacts. Every one of the three structural safety walls Blueprint P3/P4
require — interrogative methods are never heal-eligible (a structural
absence of wiring, not a runtime check), the Gemini fallback cannot trigger
a heal-and-continue (verified: no code path from a fallback verdict back
into `#retryHealed`), and post-condition verification (Mechanism A) can
downgrade a confident-looking heal after the fact (now proven against a
real, live false heal, not just a mock) — was independently re-confirmed by
direct source read this session, not taken on the governing documents'
word.

**What stands between this and a 1.0.0 stability commitment**, drawing on
§12/§13:

1. **The never-done external security review itself** — this document is
   the input to that review, not the review. Nothing in §11 constitutes a
   completed security audit; it's an inventory for one to be performed
   against.
2. **Two real, open API-surface-completeness gaps on the public wrapper
   surface** — RISK-005/NOTE-009 (`EirLocator` doesn't unwrap itself when
   passed as an argument to `.and()`/`.or()`/`.dragTo()`/`.locator(sel,
   {has})`, confirmed as a real reproducible bug, not a theoretical risk)
   and NOTE-003 (the fingerprint schema's class-shuffle ceiling, which
   would require a schema-v2 and a full baseline recapture to address). A
   1.0.0 stability commitment implies these either get fixed first, or get
   explicitly, permanently documented as known, accepted limitations of
   the 1.0 contract — right now they're "tracked, parked, unassigned,"
   which is a defensible 0.x posture but not a 1.0 one.
3. **An explicitly unmeasured config default** (`DEFAULT_SUGGEST_THRESHOLD
   = 0.3`, Q-001) still ships as the default for anyone opting into `heal`
   mode. Shipping 1.0 with a config surface whose one non-measured number
   is load-bearing for a "heal" decision is a real thing to decide
   consciously, not necessarily a blocker.
4. **RISK-003's dependency on undocumented Playwright internals**
   (`_apiName`/`_expect`, and the unforwarded, unspiked `_expectScreenshot`)
   is exactly the kind of thing a stability commitment should either
   eliminate, spike-and-document exhaustively, or explicitly accept as an
   ongoing maintenance cost tied to Playwright version bumps.
5. **RISK-009/RISK-004's capture-surface boundary** (6 named
   capture-point methods; everything else — `.filter()`, `.first()`,
   `.and()`, etc. — silently untracked) is now honestly documented in the
   README, but remains an intentional, permanent gap rather than a
   decision point that's been consciously closed or explicitly frozen as
   "will never be covered."
6. **Two verification-coverage gaps in the CI/PR-comment path**
   (NOTE-010's external-fork test, NOTE-011's never-live-exercised
   clean-state branch) are low-severity but both sit exactly in the
   adoption path a 1.0 release would be judged on most immediately by a
   new team trying the CI integration for the first time.

None of the above are fires — CI is green, the published package works end
to end (confirmed by this session's own build + deep-import experiments),
and every measured claim in the README traced cleanly to a committed
artifact. The gap to 1.0.0 is a gap of **conscious closure decisions on
already-known items**, not of undiscovered defects — which is itself a
measure of how thoroughly `NOTES.md`'s own ledger discipline has been kept
this project.
