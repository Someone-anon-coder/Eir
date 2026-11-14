# Branch, commit, and pull request procedure

Every change to this repository lands through a pull request that the owner
merges or explicitly asks to have merged. There are no exceptions for small
changes.

## 1. Start clean

```bash
git status
git switch main && git pull
```

Look at `git status` before anything else. If there are untracked files you
did not create, leave them alone and do not stage them: this repo has had a
credentials file appear untracked before. Never use `git add -A` or
`git add .`; add paths by name.

If the working tree or CI is already broken, fixing that comes before new
work.

## 2. Branch

Name: `<scope>-<purpose>-<YYYY-MM-DD>`, using the date the branch is cut.

```bash
git switch -c ci-action-dedupe-rows-2026-07-17
```

Real examples from history: `phase-0-foundation-tooling-2026-07-04`,
`release-1.0.0-version-bump-2026-07-17`,
`closure-notes-ledger-fix-2026-07-17`.

One exception to the pattern: a branch named `eir-dogfood/<anything>` makes CI
apply a deliberate mutation and fail on purpose. Use that prefix only for the
dogfood demo (see the `eir-benchmark` skill).

## 3. Commit

Conventional Commits, one logical change per commit.

```
<type>(<scope>): <summary>
```

- Types: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`, `bench`.
- Scopes seen in history: `eir`, `ci-action`, `benchmark`, `demo-app`,
  `notes`, `tuning`. Docs-wide commits may omit the scope.
- Examples: `feat(eir): add sibling-position scorer`,
  `test(benchmark): table-driven classifier cases`,
  `docs(notes): resolve NOTE-011 - live clean-state exercise (A5)`.
- The body says why, and names any ledger item it addresses (`NOTE-009`,
  `RISK-005`).
- Propose the message; the owner may amend it. Never rewrite pushed history
  unless told to.

Do not commit: `.env*`, `career/`, `ts-scratch/`, `eir-report/`,
`test-results/`, `dist/`, or accidental rewrites of `.eir/routes/` and
`packages/benchmark/results|reports` (see "Side effects" in `SKILL.md`).

## 4. Verify before pushing

Run the full local sequence from `SKILL.md` ("Before proposing a PR"). Record
the actual test counts and outcomes; they go in the PR body.

## 5. Open the pull request

```bash
git push -u origin <branch>
gh pr create --base main --title "<same form as a commit subject>" --body-file <file>
```

Body format used throughout this repo:

```markdown
## Summary

- What changed and why, one bullet per logical change.
- Ledger items addressed (NOTE-###, RISK-###, Q-###).
- Anything deliberately left out, and where it was parked.

## Test plan

- [x] `pnpm lint && pnpm typecheck && pnpm test` — <real counts>
- [x] `pnpm --filter demo-app e2e` — <real result>
- [ ] <anything not run, stated as not run>
```

Rules for the body:

- Only tick a box for something actually run in this session. Paste the real
  numbers. A failing or skipped check is written down as such.
- If the change touches a TypeScript feature the owner has not been walked
  through, add a short plain-language explanation of it.
- Writing a bare `@name` notifies that GitHub user. Put handles and
  placeholders in backticks unless the notification is intended.

## 6. CI

CI runs on every PR: build, lint, typecheck, unit tests, the e2e suite, two
benchmark smoke classes, then the Eir report comment step.

```bash
gh pr checks <number> --watch
```

State the CI result when reporting back. A red run is said plainly, with the
failing step. Expect a red run only on `eir-dogfood/*` branches.

The workflow posts an Eir report comment on a PR only when the e2e run
produced heal or suggestion rows. On a normal PR that means selectors in the
reference suite broke: treat it as a finding about your change, not noise.

## 7. Merge

Do not merge on your own. When the owner says to merge that PR:

```bash
gh pr merge <number> --merge
```

- Use a merge commit; history here is merge commits (`Merge pull request #N`).
- Never pass `--delete-branch`. Never delete the branch afterwards, locally
  or on the remote, without asking for that specifically.
- After merging: `git switch main && git pull`, confirm `main` CI is green.

## 8. Close the session

- Append a Daily Progress Log entry to `NOTES.md` (format in
  `notes-ledger.md`). It goes through a PR like everything else; include it in
  the same PR when possible.
- Update the status of any ledger item the work resolved, and say where.
- Name where the next session should pick up.

## Pull requests that are meant to stay open or unmerged

- PR #15 is the permanent public demo of the report comment. Leave it open,
  red, and unmerged. Do not rebase, close, or "fix" it.
- Verification PRs (for example exercising the comment's clean state) are
  closed unmerged once they have served their purpose, with the branch kept.
