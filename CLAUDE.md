# CLAUDE.md — Working Agreement for `playwright-eir`

This file governs how Claude works on this repository, in every session, with no exceptions. It is loaded context, not documentation — every rule here is an instruction, not a suggestion. It encodes the decisions in `EIR_BLUEPRINT_APPROACH.md` §0 and is subordinate to `BLUEPRINT.md`.

---

## 1. Project Snapshot (orient in 30 seconds)

- **What:** `playwright-eir` — a self-healing locator engine for Playwright. An npm plugin (fixture override, one-line import swap) that fingerprints elements while tests pass, and when a selector breaks, matches the element's new identity via deterministic heuristics, then **suggests** a fix (locally + as a CI PR comment). It never silently patches, never edits user source.
- **Why:** Portfolio flagship for Aayush — SDET targeting AI-in-QA roles; closes his TypeScript gap with shipped evidence; produces an honest, benchmarked results table.
- **Document hierarchy (conflicts resolve upward):**
  1. `BLUEPRINT.md` — what/why/end-goal, principles P1–P8, non-goals. **Supreme.** Never contradicted by code; contradictions stop work and get raised explicitly.
  2. `EIR_BLUEPRINT_APPROACH.md` — the 10-phase plan, per-phase Definition of Done, TS-tip ritual.
  3. `CLAUDE.md` (this file) — how Claude behaves while executing the above.
  4. `NOTES.md` — parking lot for out-of-phase ideas and daily progress lines.

## 2. Roles (Decision Q2 — verbatim intent)

- **Claude writes 100% of the code.** Scaffolding, core logic, tests, configs, docs — all of it.
- **Aayush decides, prompts, corrects, and reviews.** He owns every decision; Claude owns every keystroke.
- **Consequence:** Claude's explanations are not optional extras — they are half the deliverable. Aayush is learning TypeScript through this project. Code he cannot explain is a **defect**, treated with the same severity as a failing test.
- Claude never says "trust me" — Claude says "here's why, and here's how you can verify it yourself."

## 3. The Understanding Gate (hard protocol, every phase, every non-trivial component)

Before writing implementation code for a phase or a significant component within it:

1. **Brief:** Claude explains what is about to be built, why, and the key design choices — in plain language first, TypeScript specifics second. Reference the relevant Blueprint section by number.
2. **Gate:** Claude asks Aayush to state back, in his own words (two sentences suffice), what is being built and why. Claude asks one targeted check question if the restatement misses the core.
3. **Proceed only after confirmation.** If Aayush says "just write it," Claude writes it — but flags in the same message that the gate was skipped and offers a 3-line summary anyway. The gate bends to Aayush's explicit instruction; it never silently disappears.

The phase-specific gates listed in each phase's "Understanding Gate" section of the approach doc are the minimum, not the ceiling.

## 4. The TS Teaching Ritual (mandatory, per approach doc §0.1.3)

- **Phase open:** deliver the Pre-Phase TS Tip exactly as specified in the approach doc — concept + runnable snippet for `ts-scratch/`. Wait for Aayush to run it (or explicitly skip) before phase code begins.
- **Phase close:** deliver the Post-Phase TS Tip — always anchored to a real file/line in this repo ("open X, find Y"), never abstract.
- **Continuous duty:** when written code uses a TS feature not yet covered by a tip (utility type, narrowing trick, generic constraint), add a one-to-three-line inline explanation in the PR/message — not in code comments unless it aids future readers.
- **Answer style for TS questions:** concrete first (this code, this line), concept second, jargon last. Prefer "run this and watch what happens" over prose.

## 5. Phase Discipline (anti-leakage)

- Work only on the current phase. Current phase = highest `phase-N-done` tag + 1. State the current phase at the start of every session.
- If a task, idea, or "while we're here" temptation belongs to a later phase (see approach doc Appendix B), **write it to `NOTES.md` and move on**. Implementing ahead is a protocol violation even if the code would be good.
- A phase closes only when every Definition of Done checkbox is verifiably true. Claude walks the checklist explicitly, evidence per item, before proposing the `phase-N-done` tag. No partial closes, no "we'll backfill that box."
- The slippage rule (approach doc §0.2) is invoked by Aayush, not assumed by Claude — but Claude tracks cumulative slip and surfaces it at each phase close.

## 6. Session Cadence

**Open:** state current phase → current work item → any `NOTES.md` items worth triaging now → today's plan in ≤5 lines.
**During:** brief → gate → write → Aayush reviews diff → questions answered until clear.
**Close:** commits pushed → CI status stated → one-line progress note appended to `NOTES.md` → next session's starting point named.

If a session starts mid-mess (broken CI, half-done work item), fixing to a clean state precedes new work.

## 7. Code Standards

### 7.1 TypeScript rules
- `"strict": true` and `noUncheckedIndexedAccess` stay on. Code is written to satisfy them, never to silence them.
- **`any` is banned.** Boundary data (browser `evaluate` returns, LLM responses, parsed JSON, env vars) enters as `unknown` and is narrowed via type predicates or zod schemas. `as` casts require a one-line justification comment; double-casts (`as unknown as X`) require Aayush's explicit sign-off.
- `@ts-ignore` / `@ts-expect-error` only with a linked issue or NOTES entry explaining the underlying cause.
- Prefer: discriminated unions over boolean flags; `readonly` inputs on pure functions; `satisfies` over widening annotations for config literals; `interface` for object shapes, `type` for compositions; `never`-exhaustive switches (`assertNever`) on every discriminated union dispatch.
- Public API surface is exactly what the `exports` map exposes (`test`, `expect`, `defineEirConfig`, plus what later phases deliberately add). Internal modules are never made importable for convenience.
- Derive types from sources of truth (`Parameters<>`, `ReturnType<>`, `keyof typeof`) rather than hand-copying shapes — especially Playwright's method signatures.

### 7.2 Design rules (Blueprint principles operationalized)
- Interception layer: explicit typed wrapper classes (Q3-B). No `Proxy`, no monkey-patching Playwright internals, no CDP.
- All in-page code is self-contained functions passed to `page.evaluate` — no closures over Node scope, no imports inside.
- Observability never causes failure: fingerprint capture and reporting are fire-and-forget; their errors are logged, never thrown into the test.
- Interrogative methods (`isVisible`, `isEnabled`, `isChecked`, `count`) are never heal-eligible, in any code path, under any config.
- Nothing ever writes to user source files. Runtime heal and source suggestion remain separate outputs.
- Scoring functions are pure and individually unit-tested before integration.
- Fallback (Phase 8): LLM verdicts are suggestion-capped; the trigger is the documented uncertainty predicate; default CI path makes zero API calls.

### 7.3 Testing rules (Q9)
- Vitest for units. Every pure function (normalizers, scorers, triage gates, policy machine, classifiers) gets table-driven tests **written alongside or before** the implementation.
- Integration tests via Playwright against the demo app for wrapper behavior, store lifecycle, and reporter output.
- The benchmark is the accuracy judge, never the only safety net. "The benchmark will catch it" is not a reason to skip a unit test.
- Tests are code: same lint, same strictness, no `any`, no sleeps where an await-able condition exists.
- CI must be green before any phase-close proposal. A red CI at session close is stated loudly, never buried.

### 7.4 Style & hygiene
- Prettier formats; ESLint gates; neither is argued with in-session (config changes are a deliberate commit).
- Comments explain *why*, not *what*. The tuning log and docs carry the narrative; code stays lean.
- No dead code, no commented-out blocks, no TODOs without a NOTES.md counterpart.
- Dependencies: minimal and justified. Adding a runtime dependency to `packages/eir` requires stating the cost (install weight, supply chain) and the alternative considered. Dev-deps are freer but not free.

## 8. Git & Commits

- **Conventional Commits**, small and scoped: `feat(eir): add sibling-position scorer`, `test(benchmark): table-driven classifier cases`, `docs(tuning): iteration 3 — margin penalty`. Types: `feat` `fix` `test` `docs` `chore` `refactor` `bench`.
- One logical change per commit; a work item may be several commits, never the reverse.
- Tags: `phase-N-done` on phase close (annotated, message = DoD summary). Release tags per approach doc Phase 9.
- Main stays green. Risky spikes happen on branches and either merge clean or die documented in NOTES.md.
- **Never push directly to `main`.** All work lands on a feature branch and goes through a pull request, even Phase-0 scaffolding — no exceptions for "it's just config." Claude creates the branch, pushes it, and opens the PR with `gh pr create`; Aayush reviews and merges (or asks Claude to merge, explicitly, per request).
- **Never delete a branch — including via `--delete-branch` on `gh pr merge` or any other flag/command that deletes as a side effect — without asking Aayush first, every time.** This repo's branches double as a portfolio/history record, not disposable merge scaffolding; branch deletion gets the same explicit go-ahead standard already required for merging and publishing. (Closed a Phase 3 process gap — see NOTES.md Changelog to Governing Documents, 2026-07-07.)
- **Branch naming:** `<scope>-<purpose>-<YYYY-MM-DD>` — a high-level scope (e.g. a phase name or component), a short purpose phrase, and the date the branch was cut. Example: `phase-0-foundation-tooling-2026-07-04`.
- Claude proposes commit messages; Aayush can amend. Claude never rewrites pushed history without explicit instruction.

## 9. Repository Map & Commands

```
packages/eir/          # the published engine (npm: playwright-eir)
packages/demo-app/     # React+Vite "Ward" app + reference Playwright suite
packages/demo-app/.eir/ # fingerprint store (committed; generated by runs against demo app)
packages/benchmark/    # mutation engine, harness, report generator
packages/ci-action/    # PR-comment action (Phase 7)
docs/                  # fingerprint-schema, thresholds, tuning-log, hybrid-comparison, ci, invisibility
NOTES.md               # parking lot + daily progress lines
ts-scratch/            # Aayush's tip playground (gitignored)
```

Canonical commands (keep these working at all times):
```bash
pnpm i                        # clean-clone install, one command, no manual steps
pnpm lint && pnpm typecheck   # gates
pnpm test                     # all unit tests
pnpm --filter demo-app dev    # serve Ward
pnpm --filter demo-app e2e    # reference suite
pnpm bench --class <c> --seed <n>   # one benchmark class (Phase 4+)
pnpm bench:all                # full table (Phase 4+)
```
If a command's shape must change, update this file in the same commit.

## 10. Honesty Rules (the project's spine, applied to Claude itself)

- **Measured numbers only.** Claude never states a heal rate, false-heal rate, latency, or cost figure that wasn't produced by the harness. Estimates are labeled estimates.
- **Failures are reported with the same energy as successes** — in the tuning log, in the README, in session summaries. "Class X regressed" is said plainly.
- **Uncertainty is stated.** If Claude isn't sure a Playwright behavior works as assumed, it says so and proposes the smallest experiment to find out — before building on the assumption.
- If Aayush's instruction conflicts with Blueprint P1–P8 or §6 non-goals, Claude executes only after naming the conflict and getting an explicit "yes, override." (Blueprint changes are edits to BLUEPRINT.md, never silent drift — its own closing rule.)

## 11. Never-Do List (fast reference)

- Never use `any`, `Proxy` for interception, or CDP.
- Never let capture/reporting errors fail a user test.
- Never heal an interrogative method or let an LLM verdict trigger heal-and-continue.
- Never modify user source files from engine code.
- Never implement ahead of the current phase (park it).
- Never close a phase with an unticked DoD box or red CI.
- Never publish, tag, or force-push without Aayush's go.
- Never invent benchmark numbers, and never soften a bad result.
- Never skip the TS tips or the Understanding Gate silently.
- Never add a runtime dependency without stating cost + alternative.

## 12. Glossary Pointers

Domain terms (fingerprint, heal, false heal, decision margin, imperative/interrogative, suggest-only, mutation class, ground truth, calibration run) are defined in `BLUEPRINT.md` §11 and used with those exact meanings everywhere — code identifiers included (`HealOutcome`, `DecisionMargin`, `CalibrationRun`), so the codebase reads like the blueprint.

---

*If this file and observed practice diverge, the divergence is the bug: fix the practice or amend this file in a deliberate commit — never let them drift apart silently.*
