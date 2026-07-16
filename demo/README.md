# Demo Path — Broken Selector to Suggestion, Under 3 Minutes

This is the script behind Blueprint §9.1's reproducible demo path: clone,
install, run green against the committed calibration baseline, apply a real
mutation, run again, watch a suggestion appear. Every command below is
copy-pasteable exactly as written — this is the literal script that was run
to produce the timing in the root README's "Demo path" section, not a
paraphrase of it.

Run from a clean clone (not inside an existing checkout) so the timing is
honest about what a first-time visitor actually experiences.

## 0. Prerequisites

- Node >=22.13, pnpm (`corepack enable` or `npm i -g pnpm`).
- Chromium reachable by Playwright. If this is genuinely the first time
  Playwright has ever run on this machine, `playwright install --with-deps
  chromium` downloads it — that download is **not** included in the timing
  below, since it's a one-time, network-dependent cost this project doesn't
  control (see the caveat in the root README).

## 1. Clone and install

```bash
git clone https://github.com/Someone-anon-coder/Eir.git
cd Eir
pnpm i
pnpm --filter playwright-eir build
```

The build step is monorepo-specific — it compiles the engine package's
`dist/` from source so the workspace-linked `demo-app` can resolve
`playwright-eir` the same way it would resolve the published npm package.
A real external adopter (see the root README's "Install" section) never
does this; they `npm i playwright-eir` and get a pre-built `dist/` from the
registry.

## 2. Run green — the calibration baseline is already committed

`packages/demo-app/.eir/routes/*.json` is checked into this repo (11 route
files, ~30 KB) — the real fingerprint baseline captured the last time the
reference suite ran green. This step proves the suite passes against that
baseline today; it isn't calibrating from nothing.

```bash
pnpm --filter demo-app e2e
```

Expect: 16/16 specs green, no Eir annotations (nothing broke, nothing to
suggest).

## 3. Apply a real, seeded mutation

This reuses the exact same mutation machinery `packages/benchmark`'s
baseline table is built from (`buildMutationRun`, seed 42) — not a
hand-edited DOM change, so it's reproducible byte-for-byte.

```bash
PAYLOAD=$(pnpm --filter benchmark mutation-payload --class id-rename --seed 42 --exclude-prefix login.)
VITE_EIR_MUTATIONS="$PAYLOAD" pnpm --filter demo-app e2e
```

(`--exclude-prefix login.` skips the login-field targets — renaming those
cascades into every other spec failing to log in at all, which would
demonstrate a login outage, not selector drift. The same exclusion the CI
dogfood step uses — see `.github/workflows/ci.yml`.)

## 4. Watch the suggestion appear locally

The run above is expected to have **failing specs** — this repo ships in
`suggest-only` mode by default (nothing is ever retried until a team opts
into `heal`), so a real broken selector fails exactly like vanilla
Playwright would. What's different is what's sitting next to that failure:

```bash
cat packages/demo-app/eir-report/eir-report.md
```

Each affected selector shows: the route, the old vs. new candidate,
confidence score, and (per Phase 9's NOTE-004 fix) whether a post-condition
verification actually ran or there was no prior baseline to check against.
Screenshots of the matched candidates are alongside the report in the same
directory.

## 5. The same mechanism, as a PR comment

Wiring `packages/ci-action` into your own CI turns step 4's report into a
single, auto-updating PR comment instead of a local file — see
[`docs/ci.md`](../docs/ci.md) for the exact workflow snippet. This repo's
own dogfood PR (#15) is the live, already-recorded proof of this exact path
running for real in GitHub Actions, not just locally — see NOTES.md's Phase
7 log entry for the details, since re-opening a fresh PR isn't part of a
clone-and-run demo.

## Timing

See the root [README.md](../README.md#demo-path)'s "Demo path" section for
the real, measured wall-clock time this script takes end to end, run from
an actual clean clone — not an estimate.
