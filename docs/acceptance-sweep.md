# Phase 9 Acceptance Sweep — Blueprint §9.2

Every behavioral acceptance criterion in `BLUEPRINT.md` §9.2, with a
linked, real proving test (or, for #7, freshly re-executed evidence) —
not a claim. Where a criterion was already proven in an earlier phase,
that's stated plainly rather than re-invented; where Phase 9 found a real
gap, a new committed test closes it.

---

## 1. "Happy path is invisible: a green suite runs with no observable
behavioral difference and negligible overhead, with Playwright
auto-waiting/chaining semantics intact."

**Status: proven, Phase 2.**

- `packages/eir/docs/invisibility.md` — the full Phase 2 proof: the
  15-spec reference suite run 3×2 (vanilla vs. wrapped), identical
  pass/fail every time, ~0.7% timing delta (well inside the 5% bar).
- `packages/demo-app/tests/eir-proof/auto-wait.spec.ts` — a spec that
  depends on Playwright's actionability-retry loop (clicking a button
  that only appears after a delay), green under the wrapper.

## 2. "A never-fingerprinted selector fails exactly as vanilla Playwright
would."

**Status: proven at the decision level since Phase 5; the observable
outcome had never been directly compared until Phase 9.**

- `packages/eir/src/triage/gates.test.ts` — Gate 1 (`gateFingerprintExists`)
  unit-tested: no baseline → `rejected`.
- **New, Phase 9:** `packages/eir/src/acceptance/neverFingerprintedFailsVanilla.test.ts`
  — the same real selector, against the same real browser page, once
  through vanilla Playwright and once through `EirLocator` with an empty
  reader (even in `heal` mode — Gate 1 rejects before mode is ever
  consulted), asserting the thrown error text is byte-identical, not
  merely "also an error."

## 3. "Interrogative methods never heal, in any configuration."

**Status: proven structurally, not just behaviorally — Phase 2/5.**

- `packages/eir/src/eirLocator.ts` — `isVisible`/`isEnabled`/`isChecked`/
  `count` are plain pass-throughs to the real `Locator`, with no
  try/catch/heal shell at all. There is no code path connecting them to
  `#attemptHeal`, in any mode — this isn't a runtime check that could be
  misconfigured, it's an absence of wiring.
- `packages/eir/src/eirLocator.test.ts` — the imperative/interrogative
  method classification is exhaustively table-tested (disjoint sets,
  exact 4-method interrogative set, zero logging on the interrogative
  path).
- `packages/eir/src/triage/gates.ts` Gate 4 (`gateMethodImperative`) —
  a standing invariant check on top of the structural guarantee above.

## 4. "`suggest-only` mode provably never retries an action."

**Status: proven, Phase 6.**

- `packages/eir/src/eirLocator.retry.test.ts` — `"never retries, even
  when confidence and margin comfortably clear the heal bar"`: a match
  that would qualify for heal-and-continue under `heal` mode still never
  calls the candidate's action under `suggest-only`.

## 5. "No mode, ever, modifies user source files."

**Status: previously provable only by manual code inspection. Phase 9
closes this with an automated, permanent regression guard.**

- **New, Phase 9:** `packages/eir/src/acceptance/noSourceWrites.test.ts`
  — a structural test over the actual source tree: every file under
  `packages/eir/src` is scanned for a filesystem write primitive
  (`writeFile`, `appendFile`, `rename`, `rm`, `unlink`, `copyFile`, and
  their sync forms); any write call must live in one of exactly four
  files, each independently confined to `.eir/` (the store), an explicit
  opt-in `EIR_*_LOG_FILE` env var path (the benchmark's own diagnostic
  channel), or a report output directory (the reporter, default
  `eir-report/`). A second test asserts the allow-list itself has no
  stale entries. If a future change adds a write call anywhere else, both
  tests fail immediately — the invariant is enforced at the same
  structural level it lives at, not hoped for behaviorally.

## 6. "Fingerprint store stays within the size envelope (§7.3) on a
realistic suite."

**Status: measured once by hand in Phase 3 (~26 KB); never re-checked by
an automated test since. Phase 9 automates it.**

- **New, Phase 9:** `packages/eir/src/acceptance/storeSizeEnvelope.test.ts`
  — measures the real, currently-committed `packages/demo-app/.eir/routes/`
  directory (fingerprints + Phase 6's post-condition siblings together)
  and asserts it stays under the 500 KB bar Phase 3's Definition of Done
  set. Currently measures ~30 KB.

## 7. "Parallel-worker runs do not corrupt the store."

**Status: proven at the unit level since Phase 3; freshly re-executed
end-to-end this session (2026-07-16) rather than relying solely on
Phase 3's original manual run.**

- Unit coverage: `packages/eir/src/store/mergeStore.test.ts`,
  `packages/eir/src/store/globalTeardown.test.ts`, `shardWriter.test.ts`,
  `postConditionShardWriter.test.ts`, `atomicWrite.test.ts` — atomic
  rename-based writes, deterministic shard-merge ordering, teardown
  correctness.
- **Fresh re-verification, Phase 9 (2026-07-16):** ran the full 16-spec
  reference suite twice against the real demo app — once with
  `--workers=1`, once with `--workers=4` — and diffed the resulting
  `.eir/routes/*.json` fingerprint files against the committed baseline.
  **Every fingerprint file was byte-identical across both runs and the
  committed baseline** — zero corruption, zero merge-order sensitivity.
  One already-known, already-documented non-determinism reproduced
  exactly as described (RISK-009... see NOTES.md RISK-010): the wizard's
  page-wide `dom-count-change` **post-condition** signal (not a
  fingerprint) flaked between `"none"` and a real count-change on both
  the 1-worker and 4-worker runs alike — confirming this is real,
  timing-related render noise independent of worker count, exactly as
  RISK-010 already concluded, and confirming it never touches fingerprint
  identity data or corrupts the merge.

## NOTE-005 — Mechanism A's real-catch demonstration

Not a §9.2 line item verbatim, but required this phase as the mandatory
ledger fix: Mechanism A (post-condition verification on heal-and-continue's
retry) had never caught a real wrong heal produced end-to-end by the
actual matching engine — only unit-tested against a mocked matcher.

- **New, Phase 9:** `packages/eir/src/acceptance/note005RealFalseHeal.test.ts`
  — a real browser DOM, the real (unmocked) `attemptMatch` funnel and six
  scorers, and a real `EirLocator#retryHealed` retry. A near-duplicate
  pair (transplanted from `BLUEPRINT.md`'s own Login/Signup motivating
  example) is calibrated on its real target, which is then removed,
  leaving a structurally similar distractor with a *different* real
  effect. With a deliberately permissive `healThreshold` (0.2 — far below
  the shipped 0.7 default; this does **not** contradict the measured 0%
  false-heal rate, see the test's own docstring), the real matcher
  confidently heals to the distractor (measured confidence ≈0.56, real
  and reproducible, comfortably below the shipped default), the retry
  genuinely executes against it, and Mechanism A's `postConditionMatches`
  genuinely catches the mismatch and downgrades to
  `heal-rejected-post-condition-mismatch`.

---

*Every test above is part of `packages/eir`'s standing `pnpm test` suite
(run in CI on every push/PR) — this checklist is a map to evidence that
already runs continuously, not a one-time report.*
