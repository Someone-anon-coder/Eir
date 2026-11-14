# Eir in CI: the PR comment action

The Eir repository contains a GitHub Action (`packages/ci-action`) that reads
`eir-report.json` after the test run and keeps one comment on the pull request
up to date with the suggested selector fixes.

## Before wiring it

- The suite already uses `playwright-eir` with the reporter and
  `globalTeardown` configured.
- `.eir/routes/` is committed, so CI has a baseline to match against.
- The action is not published to the GitHub Marketplace. It has to be vendored.

## Vendoring the action

The action has no runtime dependencies; its entry point is a compiled
`dist/main.js` that is not committed upstream. Build it once and commit the
result into the adopting repository:

```bash
git clone https://github.com/Someone-anon-coder/Eir.git /tmp/eir
cd /tmp/eir && pnpm i && pnpm --filter playwright-eir build && pnpm --filter ci-action build
mkdir -p <your-repo>/.github/actions/eir-report
cp packages/ci-action/action.yml <your-repo>/.github/actions/eir-report/
cp -r packages/ci-action/dist <your-repo>/.github/actions/eir-report/
echo '{ "type": "module" }' > <your-repo>/.github/actions/eir-report/package.json
```

The `package.json` is required: the compiled files are ES modules and only
import Node built-ins. Make sure the copied `dist/` is not excluded by the
adopting repo's `.gitignore`. The action runs on `node24`.

This vendored layout follows from how the action is built; the Eir project has
only run the action from inside its own repository, so confirm the first run.

## Workflow

```yaml
on:
  pull_request:

jobs:
  e2e:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write # the only write the action needs
      contents: read
    steps:
      - uses: actions/checkout@v4
      # ... install dependencies and browsers ...

      - run: npx playwright test

      - name: Upload Eir report artifact
        if: always() && github.event_name == 'pull_request'
        uses: actions/upload-artifact@v4
        with:
          name: eir-report
          path: eir-report
          if-no-files-found: ignore

      - name: Post Eir report comment
        if: always() && github.event_name == 'pull_request'
        uses: ./.github/actions/eir-report
        with:
          github-token: ${{ github.token }}
          report-path: eir-report/eir-report.json
          mode: suggest-only
```

What each choice is for:

- `if: always()` on both Eir steps. In `suggest-only` mode a broken selector
  fails the test step, and the comment is most useful exactly then.
- The artifact upload carries the screenshots. The comment links to the run
  instead of embedding images, because GitHub strips inline image data from
  comments.
- `permissions` is declared in the workflow, so it applies even where the
  repository's default token permission is read-only.
- Use `pull_request`, not `pull_request_target`. The action needs no secrets
  and should not run with base-repo privileges on fork code.

## Inputs

| Input          | Default                      | Notes                                                                                                                                       |
| -------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `github-token` | required                     | `${{ github.token }}` with `pull-requests: write`.                                                                                          |
| `report-path`  | `eir-report/eir-report.json` | Relative to the job's working directory. In a monorepo, include the package path.                                                           |
| `mode`         | `unknown`                    | `suggest-only`, `heal`, or `unknown`. Must match the Eir config; the report cannot prove which mode ran. `unknown` omits the mode sentence. |
| `docs-url`     | Eir's `docs/ci.md`           | Footer link.                                                                                                                                |
| `pr-number`    | from the event               | Only for workflows not triggered by `pull_request`.                                                                                         |

## Behavior to expect

- First run with findings creates the comment. Later pushes edit that same
  comment. A later clean run edits it to say there is nothing to report.
- A PR that never had findings gets no comment.
- Retried tests do not produce duplicate lines; see `(seen Nx)` in
  `references/reports.md`.
- Text from the page (test ids, labels) is escaped before it is put in the
  comment table.
- If the report file is missing or unreadable the step fails with an error
  naming the path. Check `report-path` and that the reporter ran.

## Fork pull requests

On a PR from a fork into another repository, GitHub gives the workflow a
read-only token no matter what `permissions` says, so the comment cannot be
posted there. The artifact upload still works. This path (fork to upstream)
has not been verified by the Eir project; a fork running the workflow on its
own PRs has been.
