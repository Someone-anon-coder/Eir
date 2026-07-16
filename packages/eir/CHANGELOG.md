# Changelog

This changelog starts at `0.3.0`. Full detail on `0.0.1`–`0.2.0` (scaffolding,
the interception shell, fingerprint capture, the matching engine, policy and
reporting) lives in [`NOTES.md`](../../NOTES.md)'s Daily Progress Log —
this file covers releases going forward, grouped from conventional commits.

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
