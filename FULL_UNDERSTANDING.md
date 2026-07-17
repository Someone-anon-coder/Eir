# FULL_UNDERSTANDING.md — Audit Snapshot of `playwright-eir` at 1.0.0-pending

**This document describes exactly one commit.** It is a **new snapshot**,
not an edit of the prior one — the previous audit (commit `38baa60`,
2026-07-16) is superseded, not amended. Every claim below was produced
*this session* by running a command, reading a file, or listing a
directory — never carried forward from the prior snapshot's word, and
never recalled from the closure session's own interim brief without
independent re-verification (a real gap was found doing exactly that —
see §12/§13 item 1). Where a governing document's claim and observed
repo reality differ, both are stated and the mismatch is flagged in §13.
The moment `main` moves one commit further, this document is stale — it
is an audit snapshot, not living documentation, and is not intended to
be kept in sync going forward.

This document is the **closing artifact of the 1.0.0 closure session**:
`FULL_UNDERSTANDING.md`@`38baa60` named twelve conscious-closure items
(A1–A7, B1–B3, C1–C4) plus NOTE-010 and a security review as everything
standing between `0.3.0` and a `1.0.0` stability commitment. This
snapshot confirms every one of those items reached a final disposition —
FIXED, MEASURED, or STANCE — re-verifies the evidence independently
rather than trusting the closure session's own account of itself, and
is the factual foundation §14 draws on to state what `1.0.0` actually
commits to. The version bump, npm publish, and GitHub release happen
*after* this document is merged, per the closure session's own hard
rule (no partial 1.0).

---

## §1. Snapshot Header

| Fact | Value | How verified this session |
|---|---|---|
| Date | 2026-07-17 | system clock (`currentDate` context) |
| HEAD commit | `6100c7484646c75fdec865d65580c09ea535bcaf` | `git log -1` |
| HEAD author/date | Someone <136891153+Someone-anon-coder@users.noreply.github.com>, 2026-07-17 15:00:20 +0530 | `git log -1 --format=...` |
| HEAD subject | "Merge pull request #33 from Someone-anon-coder/closure-notes-ledger-fix-2026-07-17" | `git log -1` |
| `main` status at session start | clean, up to date with `origin/main`, at `af10608` (12 PRs already merged from the closure session's first sitting) | `git status`, `git log` |
| Work this session | Verified the interim brief's 12-PR closure work against real repo state (not trusted on its word); found and fixed one real gap (PR #33 — NOTES.md's NOTE-009/RISK-005 ledger entries were never updated by A1's code fix, and a stray leftover template line contradicted NOTE-010's own RESOLVED header); this re-snapshot | `git log`, `gh pr list/diff` |
| Tags reachable from HEAD | `phase-0-done` … `phase-9-done`, `project-done`, `v0.3.0` (12 total — unchanged from the prior snapshot; **no `v1.0.0` yet**, correctly, since release is the final step after this document merges) | `git tag --merged HEAD` |
| Tags pointing exactly at HEAD | none | `git tag --points-at HEAD` |
| CI status of HEAD | **green** — GitHub Actions check `build` (run 29570200995), conclusion `success` | `gh api .../check-runs` |
| Branches from the closure session, all preserved (none deleted) | 14 total: 13 `closure-*-2026-07-17` (the interim brief's 12 work items + this session's ledger fix) + 1 `eir-dogfood/note-011-live-exercise-2026-07-17` (PR #29's throwaway demo, closed not merged) | `git branch -a` |
| PRs this closure session | 13 merged (#19–28, #30–33), 1 correctly closed without merging (#29, a deliberate throwaway live-demo branch), 0 stray open PRs from this session (pre-existing PR #15 from Phase 7 remains open, unrelated to this session) | `gh pr list --state all` |
| npm published version | still `0.3.0` (**correctly** — 1.0.0 has not shipped yet) | `npm view playwright-eir versions --json` |
| npm dist-tag | `latest` → `0.3.0` | `npm view playwright-eir dist-tags --json` |
| Local `.env` file | present at repo root, **untracked**, matched by `.gitignore:6:.env`, zero appearances in git history | `git ls-files`, `git check-ignore -v`, `git log --all --full-history -- .env` |
| Secret-shaped strings in tracked files | none found (same pattern set as the prior audit: Google/AWS key shapes, `sk-`/`ghp_`/`gho_`/`xox` tokens, PEM headers) — one benign false positive (`"disk-independent"` in NOTES.md prose contains the substring `sk-independent`), confirmed not a real secret by direct read | `git grep -nEI`, re-run this session |
| Full test suite | **565 unit tests, 71 files**, all green: `eir` 375/54 (was 354/54 at `38baa60` — +21 tests in existing files, 0 new files), `benchmark` 102/9 (was 93/8, +1 new file for B1's `scoreDistribution.ts`), `ci-action` 70/7 (was 40/4, +3 new files for A2/A3/RISK-012's `findings.ts`/`dedupe.ts`/`markdownSanitize.ts`), `demo-app` 18/1 (unchanged) | `pnpm --filter <pkg> test -- --run`, run individually this session |
| `pnpm lint` / `pnpm typecheck` | both clean, zero output beyond the command headers | run this session |
| Deep-import boundary | still enforced — `import("playwright-eir/matching/matcher")` throws `ERR_PACKAGE_PATH_NOT_EXPORTED` | re-run this session against a fresh `pnpm --filter playwright-eir build` |
| Runtime dependency count (published package) | still exactly 1 — `zod@4.4.3`, a leaf package | `pnpm list --prod --depth=Infinity` |
| Tarball contents | 291 files, 116.4 kB packed / 450.7 kB unpacked, everything under `dist/` plus `LICENSE`/`README.md`/`package.json` — byte-identical to `docs/security-review-1.0.md`'s own numbers | `npm pack --dry-run`, re-run this session |

---

## §2. What Changed Since the Prior Snapshot (`38baa60` → `6100c74`)

33 files changed, 3415 insertions(+), 114 deletions(-) (`git diff --stat
38baa605 HEAD`). Grouped by what each change closes:

**A1 (NOTE-009/RISK-005 — the unwrap fix):** `packages/eir/src/eirLocator.ts`
(+131/-lines), `eirLocator.test.ts` (+165), `eirPage.ts` (+37),
`eirPage.test.ts` (+63, new file). Zero new source files — the fix is
surgical edits to the two existing wrapper classes, not new modules.
`packages/demo-app/tests/eir-proof/locator-as-argument.spec.ts` flipped
from a characterization test (asserting the bug) to a regression guard
(asserting the fix), +69/-lines.

**A2/A3 (ci-action findings + dedup):** two new implementation files,
`packages/ci-action/src/findings.ts` (+25) and `dedupe.ts` (+56), each
with a table-driven test file (`findings.test.ts` +56, `dedupe.test.ts`
+168). `main.ts` wires both in (+4/-lines).

**A4 (dogfood generalization) + B3 (CI smoke class):** `.github/workflows/ci.yml`
(+32/-lines) — the dogfood step's `if:` condition changed from an exact
one-time branch-name match to `startsWith(github.head_ref, 'eir-dogfood/')`,
and a second `pnpm bench --class sibling-reorder --seed 42` step was
added alongside the existing `id-rename` smoke.

**A6 (doc drift):** `CLAUDE.md` (1 line — `.eir/` repo-map path),
`packages/eir/src/policy/thresholds.ts` (1 line — comment string fix),
`packages/demo-app/playwright.config.ts` (+17/-lines — `actionTimeout`
comment rewritten to describe post-Phase-9 reality).

**A7 (npm README re-diff):** `README.md` (+44/-lines, Known Limitations
section rewritten — NOTE-009 bullet removed, RISK-003/RISK-004 bullets
extended, new Post-1.0 roadmap section added). `packages/eir/README.md`
itself: **zero changes** — confirmed clean by this session's diff, matching
A7's own "none found" disposition.

**B1 (suggestThreshold measurement):** `docs/thresholds.md` (+20/-lines),
two new committed evidence artifacts
(`packages/benchmark/reports/suggest-threshold-evidence-seed42.{md,json}`,
+509 lines combined), and the harness code that produced them:
`packages/benchmark/src/scoreDistribution.ts` (+205, new),
`scoreDistributionCli.ts` (+65, new), `scoreDistribution.test.ts` (+110,
new), plus a new `bench:score-distribution` script in
`packages/benchmark/package.json`.

**B2 (screenshot forwarding):** the same `eirLocator.ts`/`eirPage.ts`
edits as A1 also carry `_expectScreenshot`/`_frame`/`_selector`
forwarding (confirmed by direct read — see §4.1/§7). New test fixture:
`packages/demo-app/tests/eir-proof/screenshot-assertions.spec.ts` (+31,
new) plus two committed baseline PNGs
(`locator-level-chromium-linux.png`, `page-level-chromium-linux.png`).

**Security review (RISK-012 — markdown injection fix):** `packages/ci-action/src/markdownSanitize.ts`
(+37, new) and its test (+53, new), `renderComment.ts` (+55/-lines) and
its test (+149/-lines), `docs/security-review-1.0.md` (+254, new
document).

**C1–C4, NOTE-010, NOTE-011 (documentation stances):** `README.md`'s
Known Limitations/Post-1.0 roadmap sections (already counted under A7),
`docs/ci.md` (+49/-lines — the `eir-dogfood/` prefix explanation and the
external-fork verification paragraph), `NOTES.md` (+105/-lines across
the whole session, further amended by this session's own PR #33 — see
§3/§12).

**Untouched, confirmed by zero-diff:** `BLUEPRINT.md`,
`EIR_BLUEPRINT_APPROACH.md`, `docs/tuning-log.md`,
`docs/hybrid-comparison.md`, `docs/fingerprint-schema.md`,
`docs/acceptance-sweep.md`, `docs/invisibility.md`,
`packages/benchmark/reports/baseline.{md,json}`,
`packages/eir/CHANGELOG.md`, `packages/eir/package.json`,
`packages/eir/src/index.ts` — verified via `git diff 38baa605 HEAD --
<path>` returning empty for each. The measured baseline table, the
public API's fourth export (`eirVersion`), and the version number itself
are all exactly as they were at the prior snapshot; nothing in this
closure session touched the matching/scoring engine's actual behavior.

---

## §3. The Governing Documents — Status at This Snapshot

| Document | Changed this session? | Drift vs. observed reality |
|---|---|---|
| `BLUEPRINT.md` | No (zero-diff confirmed) | No drift found — not re-audited line-by-line this session since nothing touched it; the prior snapshot's "no drift" finding stands on that basis. |
| `EIR_BLUEPRINT_APPROACH.md` | No (zero-diff confirmed) | Same as above. |
| `CLAUDE.md` | Yes — 1 line (A6) | The prior snapshot's one drift finding (§9's repo map placing `.eir/` at the repo root) is **fixed**: now reads `packages/demo-app/.eir/`, matching reality and `README.md`'s own map. No new drift found. |
| `NOTES.md` | Yes — extensively (+105/-lines across the closure session's first sitting, then this session's own PR #33) | This is where the one real gap this session found lived: PR #19 (A1) changed code but never updated NOTE-009/RISK-005's ledger entries, and PR #32 (C1–C4) left a stray leftover `**Resolution:** *(pending)*` template line directly under NOTE-010's own filled-in `RESOLVED` block. Both fixed this session (PR #33, merged, CI green on the result). §12 below reflects the corrected, now-internally-consistent ledger. |

---

## §4. Package-by-Package — What's New Since `38baa60`

Full source maps are unchanged from the prior snapshot except where noted
below; see that document's §4 for the parts not repeated here (file
purposes for modules this session didn't touch).

### §4.1 `packages/eir`

**`eirLocator.ts` — the A1/NOTE-009/RISK-005 fix, read verbatim this session:**

- `EirLocator.unwrap(locator)` — a `static` method (necessarily static:
  `#real` is a true private class field, lexically readable only from
  inside `EirLocator`'s own class body, including on a *different*
  instance — the mechanism that lets one `EirLocator` unwrap another
  passed in as an argument). Returns `locator instanceof EirLocator ?
  locator.#real : locator` — a real `Locator`, or a wrapper from a
  different library entirely, passes through unchanged.
- Two exported module-level helpers built on top of it:
  `unwrapLocator(locator)` (thin wrapper around `EirLocator.unwrap`) and
  `unwrapHasOptions(options)` (unwraps `options.has`/`options.hasNot`
  when present, otherwise passes through — used everywhere a method
  accepts Playwright's `{ has, hasNot }` filter shape).
- Applied at every one of **8 real call sites**, confirmed by direct
  grep of both wrapper classes — 4 more than the 4 originally named in
  NOTE-009's raised text (`.and()`, `.or()`, `.dragTo()`,
  `.locator(sel, {has})`): `EirLocator.and`, `.or`, `.dragTo`, `.filter`,
  `.locator` (5 sites) plus `EirPage.locator`, `.addLocatorHandler`,
  `.removeLocatorHandler` (3 more sites, since `Page` also exposes
  `.locator(sel, {has})` and both locator-handler methods take a real
  `Locator` argument). This is a **systematic enumeration of the entire
  wrapped surface**, not a fix scoped to the 4 methods the original risk
  entry happened to name.
- `packages/demo-app/tests/eir-proof/locator-as-argument.spec.ts` now
  asserts the fix works (previously asserted the throw) — read verbatim,
  confirmed it exercises all 4 originally-risky methods against a real
  browser, and passed in this session's own CI run.

**`eirPage.ts`/`eirLocator.ts` — the B2/RISK-003 `_expectScreenshot` fix:**

- `EirPage._expectScreenshot(...args)` forwards to
  `internalsOf(this.#real)._expectScreenshot(...args)` — the same narrow,
  single-cast pattern already established for `_apiName`/`_expect`.
- `EirLocator` additionally forwards `_frame`/`_selector` — required
  because `expect(locator).toHaveScreenshot()`'s real implementation
  passes the *locator* itself through as an option field that
  Playwright's own matcher code reads `.locator._frame._channel`/
  `.locator._selector` from directly (confirmed via the pre-fix
  `TypeError`s quoted in NOTES.md RISK-003's B2 disposition) — the same
  class of "reads private fields directly" issue as RISK-005/NOTE-009,
  but on a boundary this package can intercept only by forwarding, not
  by unwrapping (it's Playwright's own matcher code calling in, not a
  method call of ours).
- `packages/demo-app/tests/eir-proof/screenshot-assertions.spec.ts` (new)
  exercises both `expect(page).toHaveScreenshot()` and
  `expect(locator).toHaveScreenshot()` against real, committed baseline
  PNGs — passed in this session's own CI run (`pnpm --filter demo-app e2e`).

**`policy/thresholds.ts`:** one-line comment fix (A6) — `"silent-drift-suspected"` → `"drift-suspected"`, matching the real string used everywhere else in the codebase.

**Everything else in `packages/eir/src`** (72 implementation + 54 test
files, 126 total — unchanged file *count* from `38baa60`; the closure
session only edited existing files, added none) is unchanged from the
prior snapshot's §4.1 description.

### §4.2 `packages/demo-app`

New: `tests/eir-proof/screenshot-assertions.spec.ts` (B2) and its two
baseline PNGs. `playwright.config.ts`'s `actionTimeout` comment rewritten
(A6) to state its real remaining value (diagnosis speed, not
correctness) now that RISK-011's engine-level fix has landed — matching
what `README.md`'s Prerequisites section already said correctly.
Everything else unchanged.

### §4.3 `packages/benchmark`

New: `src/scoreDistribution.ts` (B1's measurement harness — runs the
full 8-class benchmark with match-logging on and extracts the raw
confidence distribution of every `matched` attempt), `scoreDistributionCli.ts`,
and `scoreDistribution.test.ts`. New committed artifacts:
`reports/suggest-threshold-evidence-seed42.{md,json}` (66 matched
attempts, confidence range 0.5849–1.0000 — see §9). Everything else
(mutation classes, targets, ground truth, the baseline table itself)
unchanged, confirmed by zero-diff.

### §4.4 `packages/ci-action`

New: `src/findings.ts` (A2 — `hasFindings()` now keyed off a
`HEAL_FAMILY_ACTIONS` set — `"healed"`, `"suggested"`,
`"heal-rejected"`, `"heal-attempt-failed"` — rather than
`suggestion !== null`, closing the gap where a genuine heal whose
suggestion generation itself failed would have been invisible to "does
this run have findings"), `src/dedupe.ts` (A3 — `dedupeReportRows()`,
grouping key `(route, selectorKey, suggestion)`, representative = the
highest-confidence member of the group, ties broken by first-seen order;
exposes `seenCount` for the `(seen Nx)` annotation), and
`src/markdownSanitize.ts` (RISK-012 — `sanitizeForMarkdownCell()`, the
security review's one real fix — HTML-escapes `&`/`<`/`>` in that order,
replaces backtick with a fullwidth look-alike, escapes `|` as `\|`,
collapses CR/LF to a space). All three read verbatim this session,
matching their NOTES.md/`docs/security-review-1.0.md` descriptions
exactly. `main.ts`/`renderComment.ts` wire all three in. File count:
10 implementation + 7 test (was 7 + 4 at `38baa60`).

---

## §5. Public API Surface — Re-Verified Unchanged

Rebuilt this session (`pnpm --filter playwright-eir build`) and re-read
`dist/*.d.ts` for all three `exports` subpaths — **byte-identical in
shape** to the prior snapshot's §5: `eirVersion()`, `test`, `expect`,
`defineEirConfig()`, `EirConfig`/`EirMode` (types only) from `.`;
`runGlobalTeardown`/`eirGlobalTeardown` from `./globalTeardown`;
`EirReporter` plus the two re-exported types from `./reporter`.

**A1's new `unwrapLocator`/`unwrapHasOptions` helpers do not enlarge the
public surface.** They are `export`ed at the *module* level from
`eirLocator.ts` — but `eirLocator.ts` itself is not, and has never been,
reachable through any `exports` subpath (confirmed this session: a live
`import("playwright-eir/matching/matcher")` attempt still throws
`ERR_PACKAGE_PATH_NOT_EXPORTED`, and the same logic applies identically
to any other internal module path, `eirLocator.js` included). This is
the same pattern `EirLocator`/`EirPage` themselves already used — a
class can be `export`ed from its own module for internal cross-module
use and unit testing without ever being part of the package's real,
consumer-facing API.

---

## §6. Runtime Data & Artifacts — Unchanged, Plus One New Evidence Set

`.eir/routes/*.json` fingerprints, `*.postconditions.json` sibling
files, shard lifecycle, `eir-report/` reporter output shape, and the
debug/diagnostic env-var channels are all unchanged from the prior
snapshot's §6 — none of this session's fixes touch capture, storage, or
reporting shape.

**New this session:** `packages/benchmark/reports/suggest-threshold-evidence-seed42.{md,json}`
— B1's committed measurement artifact (see §9).

---

## §7. Control Flow — Two New Steps

The happy-path and failure-path control flow described in the prior
snapshot's §7 is otherwise unchanged. Two additions:

**(a) Locator-argument unwrap (A1), a new step wherever `EirLocator`
receives another `Locator` as an argument:** before reaching the real
Playwright call, `EirLocator.unwrap()`/`unwrapLocator()`/
`unwrapHasOptions()` normalize the argument — if it's an `EirLocator`,
substitute its private `#real` Playwright `Locator`; otherwise pass
through unchanged. This runs at `.and()`, `.or()`, `.dragTo()`,
`.filter()`, `.locator(sel, {has})` (both wrapper classes), and both
`Page` locator-handler methods. Selector-identity/chain tracking (used
for fingerprint keys) still uses the *original*, non-unwrapped argument
where relevant — unwrapping only affects what gets handed to the real
Playwright call, never the identity bookkeeping.

**(b) Screenshot-assertion internals forwarding (B2), a new pass-through
for `expect(...).toHaveScreenshot()`:** `EirPage._expectScreenshot`
forwards directly; `EirLocator._frame`/`._selector` forward so
Playwright's own matcher code (which reads these fields off the locator
it's given, not through a method call) sees the real values it expects,
not `undefined`.

**(c) ci-action's report→comment step (A2/A3), inside the *reporting*
pipeline, downstream of Eir's own engine:** `hasFindings()` now checks
`row.action` against the heal-family set rather than `row.suggestion !==
null`; `dedupeReportRows()` collapses same-selector retry rows before
rendering (never in the underlying `eir-report.json` artifact, which
keeps every raw attempt); `sanitizeForMarkdownCell()` escapes every
page-derived string (`route`, `selectorKey`, `suggestion`, fallback
`detail`) before embedding it in the rendered Markdown table.

---

## §8. Test Inventory — Updated Counts

| Package | Command | Result this session | Prior snapshot |
|---|---|---:|---:|
| `packages/eir` | `pnpm --filter playwright-eir test -- --run` | **375 tests, 54 files** | 354 tests, 54 files |
| `packages/benchmark` | `pnpm --filter benchmark test -- --run` | **102 tests, 9 files** | 93 tests, 8 files |
| `packages/ci-action` | `pnpm --filter ci-action test -- --run` | **70 tests, 7 files** | 40 tests, 4 files |
| `packages/demo-app` | `pnpm --filter demo-app test -- --run` | **18 tests, 1 file** | 18 tests, 1 file |

**Total: 565 unit tests, 71 files, all green.** `pnpm lint` and `pnpm
typecheck` both clean this session.

**Playwright spec files:** `packages/demo-app/tests/` — **14 files**
(was 13): 6 `linear-suite/`, 5 `pom-suite/`, 3 `eir-proof/`
(`auto-wait.spec.ts`, `locator-as-argument.spec.ts` — now a regression
guard, not a characterization test — and the new
`screenshot-assertions.spec.ts`). `packages/benchmark/probes/probe.spec.ts`
unchanged, 1 file. Both this session's CI run and a local
`pnpm --filter demo-app e2e` were confirmed green (the CI run watched
live this session, run 29570200995).

**Characterization tests remaining:** none. The prior snapshot's one
characterization test (`locator-as-argument.spec.ts`) is now a
regression guard — A1 closed the only bug this repo had a test
deliberately documenting rather than preventing.

---

## §9. Benchmark & Measured Claims — Baseline Unchanged, One New Measurement

**The 8-class baseline table is byte-identical to the prior snapshot**
(confirmed via zero-diff on `packages/benchmark/reports/baseline.{md,json}`)
— nothing in this closure session touched the matching/scoring engine's
actual decision logic, so re-running the full benchmark was correctly
judged unnecessary; the committed baseline still traces byte-for-byte to
`README.md`'s results table.

**New this session — B1's `suggestThreshold` anchoring attempt:**
`packages/benchmark/src/scoreDistribution.ts` ran the full 8-class
benchmark (seed 42) with match-logging on and extracted the raw
confidence of every `"matched"` attempt across all 80 probes. Read
verbatim (`reports/suggest-threshold-evidence-seed42.md`): **66 matched
attempts, confidence range 0.5849–1.0000, mean 0.8211, median 0.8393.
Zero attempts fall anywhere near the 0.3 `suggestThreshold` floor** —
the lowest measured score is nearly double the threshold, and there is
no data at all in the [0, 0.58) range. `docs/thresholds.md` states the
honest conclusion: this measurement attempt **did not anchor the
number** — the taxonomy structurally never produces a genuinely
low-confidence match (every mutation either destroys enough signal to
produce `missed`, or preserves enough to score well above any plausible
suggestion floor). `DEFAULT_SUGGEST_THRESHOLD` stays `0.3`, still
labeled an estimate, not relabeled as measured — this is a real,
data-backed *confirmation* of Q-001's original finding, not a dodge of
the measurement attempt.

Everything else in the prior snapshot's §9 (mutation-class definitions,
the tuning log's 6-entry iteration list, the hybrid-comparison verdict
and its exact trigger-scope boundary, NOTE-005's real-catch
demonstration) is unchanged, confirmed by zero-diff on the underlying
documents.

---

## §10. CI, Workflows & Automation — Two Changes

Still exactly one workflow file, `.github/workflows/ci.yml`. Two real
changes from the prior snapshot, both read verbatim this session and
confirmed live in the CI run watched during this session:

1. **The dogfood mutation step (A4)** no longer guards on the exact,
   already-merged branch name `phase-7-dogfood-demo-2026-07-12`. It now
   guards on `startsWith(github.head_ref, 'eir-dogfood/')` — any branch
   under that prefix triggers the same seeded `id-rename` mutation,
   repeatably, by anyone (including an external fork — this is exactly
   the mechanism NOTE-010's external verification exercised). Every
   branch outside the prefix is unaffected, preserving Phase 4's
   invisibility guarantee for `VITE_EIR_MUTATIONS`.
2. **The bench smoke step (B3)** now runs two classes per push instead
   of one: the pre-existing `id-rename --seed 42` plus a new
   `sibling-reorder --seed 42` — the one class with a known,
   only-partially-closed detection gap (RISK-009/Mechanism B), previously
   never touched by CI's fast per-push check (only by the manually-run
   full 8-class baseline).

Everything else — triggers, the explicit `permissions:` block, the
step order (including Chromium installing before `pnpm test`, per
Phase 9's NOTE-005 fix), the artifact-upload/comment-post steps both
gated on `if: always() && github.event_name == 'pull_request'` — is
unchanged from the prior snapshot's §10.

---

## §11. Security Review — Pointer, Not Re-Inventory

The prior snapshot's §11 was raw inventory, explicitly not judgment
("Raw material for the 1.0.0 security review — inventory, not
judgment"). That review has now been performed:
**[`docs/security-review-1.0.md`](docs/security-review-1.0.md)**,
produced during the closure session's first sitting and independently
re-read in full this session. Verdicts, each with its own evidence
command or file reference in that document:

| # | Area | Verdict |
|---|---|---|
| 1 | Secrets posture | **PASS** |
| 2 | Injection surfaces (PR comment) | **FAIL → FIXED** (RISK-012, the one real finding — see §4.4) |
| 3 | Browser-context code | **PASS** |
| 4 | Filesystem writes | **PASS** |
| 5 | Network calls | **PASS** |
| 6 | `ci-action` threat model | **PASS**, including live external-fork verification (NOTE-010) |
| 7 | Supply chain | **PASS** |

This session independently re-ran the checkable claims rather than
trusting the document's word: the secret grep (§1 above, same result —
zero real matches), the deep-import boundary test (§5, still blocked),
`npm pack --dry-run` (byte-identical: 291 files, 116.4 kB / 450.7 kB),
and the runtime dependency count (still exactly `zod@4.4.3`, one leaf
package). All re-verified clean, matching the document's own claims.
**Not independently re-verified this session** (would require live
external infrastructure or a fresh spend, neither appropriate for a
routine re-check): item 6's real fork test itself (NOTE-010 — see §12,
the evidence trail is a real comment ID and CI log, not re-run) and
item 2's hostile-fixture re-render (re-confirmed via the committed test
files passing, not by manually re-injecting the payload).

---

## §12. Known-Gaps Ledger, Final State for 1.0.0

Faithful restatement of every NOTE/RISK/Q entry in `NOTES.md`, read in
full this session — **after** this session's own PR #33 fixed the one
ledger inconsistency it found (NOTE-009/RISK-005 not updated by A1;
NOTE-010's stray leftover line). This table is now internally
consistent with itself and with `README.md`; that consistency was
verified, not assumed.

| ID | One-line summary | Final status | 1.0.0 disposition |
|---|---|---|---|
| NOTE-001 | Post-condition verification (Mechanism A) | RESOLVED (Phase 6) | Already done |
| NOTE-002 | `near-duplicate-sibling-swap` mutation class | RESOLVED (Phase 4) | Already done |
| NOTE-003 | Fingerprint schema never captures class tokens | PARKED | **STANCE (C1)** — flagship Known Limitation, measured 25% ceiling stated, Post-1.0 roadmap names schema v2 |
| NOTE-004 | Post-condition verification silent no-op ambiguity | RESOLVED (Phase 9) | Already done |
| NOTE-005 | Mechanism A never caught a real wrong heal live | RESOLVED (Phase 9) | Already done |
| NOTE-006 | GitHub Marketplace publication | PARKED | **STANCE (C3)** — confirmed still parked, README states it |
| NOTE-007 | Gemini free-tier rate limits | PARKED → documented | Already done (README states measured ~23% rate) |
| NOTE-008 | Evidence CLIs had no overwrite protection | RESOLVED (Phase 9) | Already done |
| NOTE-009 | `EirLocator` doesn't unwrap itself as an argument | **RESOLVED (A1, this session's own PR #33 closed the ledger gap)** | **FIXED** — 8 call sites, centralized unwrap helper, regression-guarded |
| NOTE-010 | `docs/ci.md` snippet never verified from an external fork | **RESOLVED** | **Real external volunteer, full pass, no friction, no fixes needed** |
| NOTE-011 | "Comment updates to clean state" branch never live-exercised | **RESOLVED (A5)** | **FIXED/verified live** — same comment ID, zero duplicates |
| NOTE-012 | Hybrid comparison's trigger-scope boundary | RESOLVED (Phase 9) | Already done |
| Q-001 | `suggestThreshold` default | ANSWERED (provisionally) | **MEASURED-ATTEMPTED, STANCE retained (B1)** — real anchoring attempt found no evidence either way; `0.3` stays an honest estimate |
| RISK-001 | Wrapper breaks auto-wait/chaining | WATCHING | Ongoing, invisibility proof is the detection mechanism |
| RISK-002 | Schedule slippage into Phase 8 | MITIGATED | Resolved, did not materialize |
| RISK-003 | Forwards undocumented Playwright internals | WATCHING | **FIXED, gap closed (B2)** — `_expectScreenshot`/`_frame`/`_selector` now forwarded; overall stance (ongoing tripwire via pinned peer-range CI) stated explicitly in README |
| RISK-004 | Capture-point coverage stops at 6 methods | WATCHING → documented | **STANCE (C2)** — re-verified accurate post-A1 (A1 changed what these methods *accept*, never what they *return*); README bullet extended to also name `page.frame()`/`.mainFrame()` |
| RISK-005 | Locator-argument methods may reject an `EirLocator` | **MITIGATED (A1, ledger gap closed this session)** | **FIXED** — same item as NOTE-009 |
| RISK-006 | `removeAllListeners` overload split | MITIGATED | Resolved |
| RISK-007 | Post-success capture lost navigational actions | MITIGATED | Resolved |
| RISK-008 | Selector-normalization templating over-collapsed | MITIGATED | Resolved |
| RISK-009 | `sibling-reorder` invisible to triage | MITIGATED (partial) | **STANCE, CI coverage improved (B3)** — smoke test now touches this class every push; remaining capture-surface gap is RISK-004's territory, accepted |
| RISK-010 | `dom-count-change` occasional non-determinism | WATCHING | **STANCE (C4)** — confirmed accepted, safe-direction-only |
| RISK-011 | `classifyFailureSpecies` missed unconfigured-timeout shape | MITIGATED (fully, Phase 9) | Already done |
| RISK-012 | `ci-action` PR comment had no injection escaping | **MITIGATED (security review finding, fixed same session)** | **FIXED** — `sanitizeForMarkdownCell()`, 4 new/updated tests |

**Zero items with an open/pending status that this document's own text
doesn't account for.** Every closure-list item (A1–A7, B1–B3, C1–C4,
NOTE-010) reached exactly one of FIXED/MEASURED-attempted/STANCE, and
every one of those dispositions is now reflected in NOTES.md itself
(not just in a session brief describing NOTES.md) — the specific
failure mode this session's own PR #33 caught and fixed for NOTE-009/RISK-005.

---

## §13. Prior Snapshot's Imperfections — Disposition of Each

The prior snapshot (`38baa60`) logged 10 numbered observations in its
own §13, explicitly not fixed at the time ("describing, not fixing, is
this session's entire mandate"). Disposition of each, this session:

1. **`CLAUDE.md` §9's `.eir/` repo-root claim.** **FIXED (A6).** Now
   reads `packages/demo-app/.eir/`. Re-verified by direct read this
   session.
2. **Stale `policy/thresholds.ts` comment (`silent-drift-suspected`).**
   **FIXED (A6).** Now reads `drift-suspected`, matching every real
   usage site. Re-verified by grep this session.
3. **`playwright.config.ts`'s outdated `actionTimeout` comment.**
   **FIXED (A6).** Rewritten to state the post-Phase-9 reality (speed,
   not correctness, is the remaining value). Re-verified by direct read.
4. **CI dogfood mechanism pinned to one dead branch name.** **FIXED
   (A4).** Generalized to the `eir-dogfood/` prefix; live-exercised
   twice this closure session (NOTE-011's own-repo run, NOTE-010's
   external-fork run) — not just theoretically fixed.
5. **`ci-action`'s "has findings" check could miss a genuine heal with a
   null suggestion.** **FIXED (A2).** `hasFindings()` now keyed off
   `action`, unit-tested for the exact edge case.
6. **CI smoke never touches `sibling-reorder`'s known gap.** **FIXED
   (B3).** Now runs as a second per-push smoke class.
7. **npm-facing README never independently re-diffed.** **MEASURED —
   "none found" (A7).** A real claim-by-claim diff was performed this
   closure session (not this re-snapshot session, but independently
   re-confirmed here via zero-diff on `packages/eir/README.md` since
   A7 landed).
8. **No root-level `CHANGELOG.md`.** **Unchanged, not a defect** — still
   only `packages/eir/CHANGELOG.md` exists; this observation was never a
   closure-list item and remains a reasonable structural choice for a
   monorepo where one package is published and three are `private`.
9. **`DEFAULT_SUGGEST_THRESHOLD` unmeasured.** **Measurement attempted
   (B1), stance retained.** See §9/§12 — a real anchoring attempt found
   no evidence either way; the estimate label stays, now backed by a
   documented, data-driven reason rather than an absence of trying.
10. **Dependency version numbers unusually far ahead of this assistant's
    training knowledge.** **Unchanged, not a defect** — still internally
    consistent (lockfile, installed `node_modules`, and every test suite
    all agree), still outside any single session's ability to verify
    against an external registry beyond the one `npm view` call already
    performed for `playwright-eir` itself. Not a 1.0.0-blocking item and
    was never on the closure list.

**New observation, this session:** the interim brief's own account of
its work (A1 in particular) was accurate in substance but incomplete in
execution — the code fix and its test were real and correct, but the
ledger bookkeeping (NOTES.md) that the fix's own tracking item lived in
was never updated to match. This is exactly the class of gap
`FULL_UNDERSTANDING.md`'s own method (verify, don't recall) exists to
catch, and it caught it. No other such gap was found across the other
11 closure items — each was spot-checked against its actual PR diff
and/or re-executed independently this session (§9's B1 measurement,
§5's deep-import test, §11's re-run security checks) and matched its
claimed disposition.

---

## §14. The 1.0.0 Statement

**What `1.0.0` commits to**, verified this session, not asserted from
memory:

`playwright-eir` ships as `1.0.0` with a **stable public API surface**:
the three `exports` subpaths (`.`, `./globalTeardown`, `./reporter`),
the `EirConfig`/`EirMode` shape, and the `.eir/routes/*.json` /
`*.postconditions.json` file formats as adopter-visible contracts. A
breaking change to any of these — a fourth subpath removed, a config
field's meaning changed, the fingerprint schema versioned to v2 (see
below) — is a **major version bump**, not a minor one, going forward.
Internal modules (matching, policy, capture, store internals) were
never part of the contract and remain free to change without a major
bump, exactly as the `exports` map has structurally enforced since
Phase 2 (re-verified this session: still blocks deep imports).

**Every structural safety wall Blueprint P3/P4 require** — interrogative
methods are never heal-eligible (a structural absence of wiring),
the Gemini fallback cannot trigger a heal-and-continue (no code path
exists from a fallback verdict back into `#retryHealed`), and
post-condition verification (Mechanism A) can downgrade a
confident-looking heal after the fact (proven against a real, live false
heal, not just a mock, since Phase 9) — remain independently
re-confirmed by direct source read this session, unchanged by anything
in this closure session's own work.

**What closed between `0.3.0` and `1.0.0`, concretely:**

1. **The #1 correctness gap on the public wrapper surface is fixed.**
   `EirLocator`/`EirPage` now unwrap themselves at every real
   Locator-argument boundary — 8 call sites, systematically enumerated,
   centralized in one helper, regression-guarded. This was the audit's
   own stated "#1 reason 0.3.0 wasn't 1.0."
2. **The completed security review found exactly one real issue and
   fixed it.** A genuine markdown/table-structure injection in the
   PR-comment renderer (page-derived content, not requiring a malicious
   actor — an ordinary backtick or pipe in captured text would have
   triggered it) is closed with a dedicated sanitizer and regression
   tests. Every other reviewed area — secrets, browser-context code,
   filesystem writes, network calls, the `ci-action` threat model,
   supply chain — passed clean, verified by live command or a real
   external volunteer, not carried forward on the audit's word.
3. **The one previously-unexercised adoption-path gap (NOTE-010) is now
   closed with real, independent evidence** — a volunteer who forked the
   repo, ran the documented path with stock default settings, and hit
   zero friction. `docs/ci.md`'s permission-model claims are no longer
   theory.
4. **The one previously-unmeasured config default got a genuine
   measurement attempt**, not a rubber stamp. `suggestThreshold` (0.3)
   remains an honest estimate — but now because real benchmark data was
   gathered and found nothing near the threshold to anchor to, not
   because no one tried.
5. **Every remaining known limitation is now a deliberate, written 1.0
   stance, not an unassigned parked item:** the fingerprint schema's
   class-token ceiling (NOTE-003, with a named Post-1.0 roadmap item),
   the capture-point coverage boundary (RISK-004/RISK-009, extended to
   name `Frame` explicitly), the undocumented-internals dependency
   (RISK-003, with its ongoing-tripwire posture stated in README), and
   `dom-count-change`'s safe-direction-only non-determinism (RISK-010)
   all read as conscious commitments in `README.md`'s Known Limitations,
   not silent gaps a new adopter would discover by surprise.

**What `1.0.0` does *not* claim:** it does not claim the fingerprint
schema is final (schema v2 is explicitly the first Post-1.0 roadmap
item, named as future major-version or migration-tooled-minor work — a
decision for that future cycle, not pre-committed here); it does not
claim `suggestThreshold`'s default is measured (it is explicitly
labeled an estimate, with a stated revisit criterion); it does not claim
coverage of every Locator-returning Playwright method (`.filter()`,
`.first()`, `.last()`, `getByAltText()`, `getByTitle()`,
`.contentFrame()`, and `Frame` itself remain untracked passthroughs, by
design, documented); and it does not claim the Gemini fallback is
reliable on a free-tier key (the measured ~23% real-response rate is
stated plainly, which is why the feature ships disabled by default).

**The gap this session itself found and closed** (NOTES.md's ledger not
reflecting A1's own fix) is the clearest evidence this project's central
discipline — verify, don't recall; describe reality, not the intended
version of it — was applied to itself, not just to the code. A `1.0.0`
tag on this repository is a claim that this discipline, not just this
particular feature set, is what an adopter is trusting.
