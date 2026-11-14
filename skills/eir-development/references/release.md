# Releasing `playwright-eir`

A release is an owner decision at every step. An agent prepares, checks, and
reports. The owner decides the version, approves the publish, and runs
`npm publish` themselves (the npm account uses two-factor authentication).

Nothing here is to be started because a change "seems ready". Start it only
when the owner asks for a release.

## What decides the version

Since 1.0.0 these are public contracts:

- the three `exports` subpaths: `.`, `./globalTeardown`, `./reporter`
- the `EirConfig` / `EirMode` shape
- the `.eir/routes/*.json` and `*.postconditions.json` file formats

| Change                                                                    | Bump  |
| ------------------------------------------------------------------------- | ----- |
| Breaks any contract above (including a fingerprint schema version change) | major |
| New capability, contracts intact                                          | minor |
| Fix with no observable API change                                         | patch |

Publishing is tied to observable behavior changing. Internal refactors, docs,
benchmark, and ci-action changes do not need a publish. Present the options
and the reasoning; the owner picks.

## Steps

1. **Version bump PR.** On a branch named
   `release-<version>-version-bump-<YYYY-MM-DD>`:
   - `packages/eir/package.json` `version`
   - the expected string in `packages/eir/src/index.test.ts`
   - a new section at the top of `packages/eir/CHANGELOG.md`, grouped from the
     conventional commits since the last release, stating plainly anything
     that is a limitation or a negative result
   - any README text that names the version

   Run the full local check sequence. The PR goes through the normal process
   and is merged only on the owner's word. Nothing below happens before it is
   merged.

2. **Build from merged `main`.**

   ```bash
   git switch main && git pull
   pnpm i && pnpm --filter playwright-eir build
   pnpm lint && pnpm typecheck && pnpm test
   ```

3. **Check who would publish.** `npm whoami` from `packages/eir`. If it
   errors or names an unexpected account, stop and report it. Do not attempt
   to log in or handle tokens.

4. **Review the tarball.**

   ```bash
   cd packages/eir && npm pack --dry-run
   ```

   Confirm: the version is the intended one; contents are `dist/` plus
   `package.json`, `README.md`, `LICENSE` only; no source, tests fixtures,
   `.env`, or store files; the only runtime dependency is `zod`. Record the
   file count, size, and shasum. Show this to the owner.

5. **Ask for the publish decision.** State the version, the tarball summary,
   and that publishing to npm cannot be undone (a version number can never be
   reused). Wait for an explicit yes.

6. **The owner publishes.** They run `npm publish` in `packages/eir` and
   enter the one-time code. If you run it and it stops with `EOTP`, that is
   the expected hand-off point, not an error to work around.

7. **Verify what shipped.**

   ```bash
   npm view playwright-eir version dist-tags dist.shasum dist.fileCount
   ```

   The version and `latest` tag must match, and the shasum and file count
   must equal the dry-run from step 4. Report any difference.

8. **Tag and GitHub release**, only after the owner confirms. Tags are
   annotated and named `v<version>`. Existing tags (`phase-N-done`,
   `project-done`, earlier versions) are never moved or deleted.

   ```bash
   git tag -a v<version> -m "<one-line summary>"
   git push origin v<version>
   gh release create v<version> --title "<title>" --notes-file <file>
   ```

   Release notes carry the measured results table and the changelog section,
   with links rather than new claims.

9. **Log it.** Daily Progress Log entry in `NOTES.md` covering what was
   published, the verification result, and the tag, through a PR.

## If something is off

- A red check, an unexpected file in the tarball, a version mismatch, or a
  shasum difference: stop and report. Do not publish around it.
- A bad release is fixed by a new patch version. Do not unpublish or
  deprecate without the owner deciding that.
