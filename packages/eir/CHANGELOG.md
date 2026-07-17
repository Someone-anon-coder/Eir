# Changelog

This changelog starts at `0.3.0`. Full detail on `0.0.1`–`0.2.0` (scaffolding,
the interception shell, fingerprint capture, the matching engine, policy and
reporting) lives in [`NOTES.md`](../../NOTES.md)'s Daily Progress Log —
this file covers releases going forward, grouped from conventional commits.

## 1.0.0

A closure release: every item `0.3.0`'s own known-limitations list carried
forward got a conscious 1.0.0 disposition this session — fixed with tests,
measured with real data, or stated as a deliberate, documented stance.
Nothing was silently dropped or softened; the full disposition of each item
is in `NOTES.md` and `FULL_UNDERSTANDING.md`.

### What "1.0.0" means here (semver honesty)

The public API surface is now a stability commitment, not just a working
snapshot: the three `exports` subpaths (`.`, `./globalTeardown`,
`./reporter`), the `EirConfig`/`EirMode` shape, and the `.eir/routes/*.json`
/ `*.postconditions.json` file formats are adopter-visible contracts as of
this release. A breaking change to any of these — a fourth subpath removed,
a config field's meaning changed, or a fingerprint schema version bump (see
"Post-1.0 roadmap" below) — will be a **major** version bump going forward,
not folded into a minor or patch release. Internal modules (matching,
policy, capture, store internals) were never part of the contract and
remain free to change without a major bump, exactly as the `exports` map
has structurally enforced since Phase 2.

### Fixed

- **`EirLocator`/`EirPage` now unwrap themselves at every real
  Locator-argument boundary** (`.and()`, `.or()`, `.dragTo()`, `.filter()`,
  `.locator(sel, { has })` on both wrapper classes, plus `Page`'s
  `addLocatorHandler`/`removeLocatorHandler`) — 8 call sites, systematically
  enumerated and centralized in one `unwrap()` helper, not fixed
  call-site-by-call-site. Previously, passing an `EirLocator` where
  Playwright expected a real `Locator` threw a confusing internal
  Playwright error instead of working transparently. This was the single
  largest reason `0.3.0` wasn't `1.0.0`.
- **`expect(...).toHaveScreenshot()` now works through both wrappers.**
  `EirPage._expectScreenshot` and `EirLocator._frame`/`._selector` are
  forwarded, closing a gap where both the page-level and locator-level
  screenshot assertion threw before reaching Playwright's real
  implementation.
- **`ci-action`'s "does this run have findings" check no longer misses a
  genuine heal.** Previously keyed off `suggestion !== null`, which could
  miss a real `"healed"` row in the rare case its suggestion-generation
  step itself failed. Now keyed off the action itself.
- **A markdown/table-structure injection in the PR-comment renderer is
  fixed.** Page-derived content (a `data-testid`, label text, or similar)
  containing a backtick, pipe, or newline could corrupt the rendered
  comment's table — found and fixed during this release's completed
  security review, not a theoretical concern (verified with a real hostile
  fixture before and after the fix). This is the one genuine finding across
  a full review of secrets handling, browser-context code, filesystem
  writes, network calls, the `ci-action` threat model, and the dependency
  supply chain — every other area passed clean.
- **CI's per-push retried-test duplication is fixed at the render layer.**
  A suite/CI retry re-running Eir's pipeline on the same broken selector no
  longer produces duplicate rows in the PR comment (the underlying
  `eir-report.json` artifact still keeps every raw attempt, unchanged).

### Verified live

- **The GitHub Action's documented adoption path was verified from a real
  external fork**, not just this repo's own PRs — a volunteer forked the
  repo, ran the documented steps with stock default settings, and the
  comment posted correctly despite the fork's own repo-level permissions
  defaulting to read-only, confirming the workflow's explicit `permissions:`
  block does what the docs claim.
- **The no-heals "comment updates to a clean state" path was exercised
  live** for the first time — a real PR with findings, followed by a push
  that removed them, updating the same comment ID to a clean-state message
  with zero duplicates.
- **The one-time CI dogfood demo mechanism is now a repeatable one** — any
  branch under the `eir-dogfood/` prefix triggers the same seeded
  mutation, rather than a single already-merged branch name that could
  never fire again.

### Measured

- **`suggestThreshold`'s default (`0.3`) got a real anchoring attempt.** A
  full 8-class benchmark run with match-logging on found 66 matched
  attempts, confidence range 0.5849–1.0000 — no data anywhere near the 0.3
  floor. The threshold stays an honestly-labeled estimate; this is a
  data-backed confirmation that the benchmark's mutation taxonomy doesn't
  produce a low-confidence match to calibrate against, not a decision made
  without trying to measure it.

### Documented (deliberate 1.0.0 stances, not defects)

- An element's own class tokens are never captured in its fingerprint (the
  measured `class-shuffle` 25% heal-rate ceiling) — a fingerprint
  schema-v2 candidate, deliberately deferred past 1.0.0 since it would
  require every adopter to recapture their baseline. See "Post-1.0
  roadmap" below.
- Capture-point coverage stops at 6 named methods; `.filter()`, `.first()`,
  `.last()`, `.and()`, `.or()`, `getByAltText()`, `getByTitle()`,
  `.contentFrame()`, and `page.frame()`/`.mainFrame()` (and anything
  reached through a raw `Frame`) remain untracked passthroughs — a
  permanent, accepted 1.0 boundary.
- This package knowingly forwards a small set of undocumented Playwright
  internals (`_apiName`, `_expect`, `_expectScreenshot`, `_frame`,
  `_selector`) so `expect()` assertions work through the wrappers. CI
  against the pinned `@playwright/test` peer range is the ongoing
  tripwire for a future Playwright version renaming or restructuring any
  of them.
- The Gemini fallback has a real, measured free-tier reliability ceiling
  (~23% of invocation attempts got a real model response across this
  project's own comparison runs) — shipped disabled by default on that
  evidence.
- GitHub Marketplace publication of `packages/ci-action` remains
  intentionally parked post-release.

### Post-1.0 roadmap

- **Fingerprint schema v2** — closing the `class-shuffle` ceiling above
  means a schema version bump and a migration story for every adopter's
  existing `.eir/` baseline. Named here as the first roadmap item post-1.0,
  not committed to a specific future version yet.

## 0.3.0

Covers everything shipped since the `0.2.0` version bump: CI integration,
the opt-in LLM fallback, and Phase 9's hardening/documentation/release pass.

### Added

- `packages/ci-action` — a GitHub Action that reads `eir-report.json` and
  posts/upserts a single PR comment with heal and suggestion diffs,
  confidence scores, and linked screenshots (never duplicates a comment
  across pushes to the same PR).
- Opt-in Gemini LLM fallback (`fallback: { provider: "gemini", enabled:
  true }`, off by default): a structurally suggestion-capped second
  opinion — it can never promote a row to `healed` or change a miss.
  zod-validated at the provider response boundary. Measured (not assumed)
  to provide no accuracy benefit on this project's 8-class benchmark and
  shipped disabled on that evidence — see `docs/hybrid-comparison.md`.
- `RetryOutcome`/`ReportRow` now distinguish a heal whose retry was
  genuinely checked against a recorded post-condition (`verified`) from
  one accepted because no prior baseline existed to check against
  (`skipped-no-baseline`) — previously both looked identical in the
  report.
- Full README (root product page + a condensed npm-facing
  `packages/eir/README.md`), a scripted and real-timed demo path
  (`demo/README.md`, ~20s clone-to-suggestion), and `docs/` coverage for
  the fingerprint schema, thresholds, tuning history, CI integration, and
  the hybrid-fallback comparison.

### Fixed

- `classifyFailureSpecies` now recognizes a Playwright *test-level*
  timeout message (`"Test timeout of ...ms exceeded."`), not only a
  bounded *action*-timeout message — closing a gap where a suite without
  `use.actionTimeout` configured would silently never engage Eir's triage
  on a real broken selector at all.
- Benchmark evidence CLIs (`bench:heal-evidence`, `bench:hybrid`) refuse
  to overwrite an existing report file unless `--force` is passed.

### Documented (known limitations, not fixed this release)

- `EirLocator` passed where Playwright expects a real `Locator` argument
  (`.and()`, `.or()`, `.dragTo()`, `.locator(sel, { has })`) is confirmed
  as a real, reproducible bug via a committed characterization test —
  the fix itself is tracked for a future release.
- An element's own class tokens are never captured in its fingerprint
  (the measured `class-shuffle` 25% heal-rate ceiling) — a fingerprint
  schema-v2 candidate, not attempted this release since it would require
  every adopter to recapture their baseline.
- The Gemini fallback's exact trigger-scope boundary (`"matched"`-only —
  never consulted on a true no-candidate miss) is now stated explicitly
  wherever the fallback is documented.
- Capture-point coverage, Gemini free-tier reliability, and two Phase 7
  proof gaps (external-fork CI verification, the no-heals clean-state
  comment path) are documented in the README's "Known limitations" and
  `NOTES.md`.

## 0.2.0 and earlier

See `NOTES.md`'s Daily Progress Log, entries `2026-07-04` through
`2026-07-15`, for the phase-by-phase build history (interception shell,
fingerprint capture and store, the six-scorer matching engine and its
tuning loop, policy and the custom reporter).
