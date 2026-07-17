# Security Review — 1.0.0

The stated 1.0 gate is "complete and security checked." `FULL_UNDERSTANDING.md`
§11 (audit snapshot, commit `38baa60`) gathered an inventory of the
security-relevant surface; this document renders the judgment against that
inventory, re-verified live this session against the closure commits
(A1–A7, B1–B3) rather than trusted on the audit's word alone. Every claim
below was produced this session by running a command or reading a file.

**Scope:** the published `playwright-eir` package, `packages/ci-action`,
and this monorepo's own CI workflow. Not in scope: the demo app (`Ward`)
and benchmark harness, which are dev-only tooling never shipped to an
adopter.

---

## Verdicts

| # | Area | Verdict |
|---|---|---|
| 1 | Secrets posture | **PASS** |
| 2 | Injection surfaces (PR comment) | **FAIL → FIXED** |
| 3 | Browser-context code | **PASS** |
| 4 | Filesystem writes | **PASS** |
| 5 | Network calls | **PASS** |
| 6 | `ci-action` threat model | **PASS-WITH-CAVEAT** |
| 7 | Supply chain | **PASS** |

---

## 1. Secrets posture — PASS

- **Live grep, tracked files only, this session:** Google API key shape
  (`AIza...`), AWS key shape (`AKIA...`), `sk-`/`ghp_`/`gho_`/`xox[baprs]-`
  prefixed tokens, PEM private-key headers — **zero matches**. A second
  pass for generic `(api[_-]?key|secret|token|password) = "..."`
  assignments (excluding `*.md`/`pnpm-lock.yaml`) also returned zero real
  matches (the only hits were `token: ":tenant"`-shaped route-normalization
  test fixtures, unrelated to secrets).
- **`GEMINI_API_KEY` is env-only, end to end:** `runFallback.ts`'s
  `buildFallbackRunner` reads the key exclusively via
  `env[keyEnv]` (default `GEMINI_API_KEY`) — never accepted as a config
  literal. A missing/empty key yields `null` (fallback silently never
  constructed), logged once as a warning naming the *env var*, never the
  value. `geminiProvider.ts` sends the key only via the `x-goog-api-key`
  HTTP header (confirmed by reading the fetch call directly) — never in
  the URL, never logged (grepped every `console.*` call in the fallback
  path: exactly one, the missing-key warning above).
- **`.gitignore` coverage:** `.env`/`.env.*`/`career/` all present.
  `git ls-files | grep -i '\.env'` returns nothing — no `.env` file has
  ever been tracked.

## 2. Injection surfaces — FAIL → FIXED

The task most likely to yield a real fix, and it did.

**Finding:** `packages/ci-action/src/renderComment.ts` embedded
`row.route`, `row.selectorKey`, `row.suggestion`, and a fallback verdict's
`detail` directly into the rendered Markdown table with no escaping. All
four ultimately trace back to live page content (attribute values, text)
that `playwright-eir` captures from the page under test — a hostile or
compromised page can put arbitrary characters into a `data-testid`,
`aria-label`, or visible text, and Eir's suggestion generator faithfully
reproduces them into the PR comment.

**Verified with a real hostile fixture** (not assumed), before the fix:
a suggestion string containing a backtick, a pipe, an embedded
`<script>` tag, and a literal newline —
`` getByTestId("a`) | INJECTED | <script>alert(1)</script>\ngetByTestId(evil") ``
— broke the rendered comment three ways:

- the backtick closed the surrounding inline-code span early, so
  everything after it rendered as raw markdown/HTML instead of literal
  text;
- the two pipe characters fragmented the single GFM table row into
  multiple fabricated cells (`| INJECTED |` became its own cell);
- the embedded newline ended the table row entirely, letting
  `getByTestId(evil")` escape into free-form comment body content on its
  own line, outside any table.

None of this requires a malicious *actor* in the traditional sense — a
test fixture, a copy-pasted error string, or ordinary app content
containing a backtick or pipe would trigger the same corruption
accidentally. GitHub's own comment sanitizer would still have stripped a
literal `<script>` tag, but the table-structure corruption (fabricated
cells, content escaping the table) happens before or independent of that
sanitizer and was real either way.

**Fix:** `packages/ci-action/src/markdownSanitize.ts` — a pure,
unit-tested `sanitizeForMarkdownCell()` applied at every embed point
(`route`, `selectorKey`, `suggestion`, fallback `detail`):

1. `&` → `&amp;`, then `<` → `&lt;`, `>` → `&gt;` (order matters — escaping
   `&` first avoids double-escaping the entities just introduced).
2. `` ` `` → `｀` (fullwidth backtick, U+FF40) — visually similar, cannot
   close a markdown code span.
3. `|` → `\|` — GFM's own table-cell escape, can no longer fragment the
   row.
4. Any CR/LF → a single space — content can never escape a table row into
   free-form comment body.

Re-ran the same hostile fixture after the fix: the entire payload now
renders inertly inside one table cell — no fabricated rows, no raw
`<script>`, no line break. Regression-guarded with both a unit-test suite
for the sanitizer in isolation (`markdownSanitize.test.ts`) and
integration tests through `renderComment()` itself
(`renderComment.test.ts`'s "security review 1.0: markdown/table
injection" block) — 4 new tests total, plus one pre-existing test's
fixture (an LLM detail string containing `<button>` and `>>`) updated to
assert the now-correctly-escaped output.

## 3. Browser-context code — PASS

Every `page.evaluate()`/`locator.evaluate()` call site was traced to its
actual injected function:

| In-page function | File | Imports? |
|---|---|---|
| `rawExtract` | `capture/rawExtract.ts` | none |
| `extractCandidates` | `matching/candidateExtract.ts` | one `import type` only (erased at compile time — zero runtime JS, confirmed by TypeScript's own type-only-import elision) |
| `capturePagePulse` | `capture/pagePulse.ts` | none |
| `(el, other) => el === other` | `matching/suggestSelector.ts:118` | none (trivial, self-contained, no outer references) |

All four read DOM state only; none write to the DOM, none `eval()` or
otherwise execute page-supplied strings as code, none accept unsanitized
page content as a selector fragment (selectors are Playwright's own API
surface, string-built from captured attribute names/values, never
concatenated from arbitrary captured text into a code path that executes
it). Every Node-side orchestration file (`captureFingerprint.ts`,
`captureCandidates.ts`, `capturePulse.ts`) imports freely — imports are
only forbidden in the function that actually crosses into the browser.

## 4. Filesystem writes — PASS

`packages/eir/src/acceptance/noSourceWrites.test.ts` is a real, committed,
self-verifying structural guard (not just this review's own claim) — ran
in isolation this session, both assertions green:

- every raw fs-write-primitive call (`writeFile`, `appendFile`, `rename`,
  `unlink`, `rm`, `copyFile`, and their `*Sync` forms) anywhere in
  `packages/eir/src` is confined to exactly 5 files, each independently
  scoped: `store/atomicWrite.ts` (the `.eir/` store's one real write
  primitive), `store/globalTeardown.ts` (writes via `atomicWrite`, plus a
  raw `rm()` scoped only to `.eir/.shards*/` scratch dirs), two opt-in
  `EIR_*_LOG_FILE` diagnostic channels (benchmark-only, no-op unless the
  env var is set), and the reporter's own output directory.
- the allow-list itself has **no stale entries** — a second assertion
  confirms the set of files the test permits is exactly the set of files
  that actually contain a write call, nothing more.

Nothing in `packages/eir/src` writes to a user's own test source files —
the structural guarantee behind Blueprint P3, enforced by an automated
test, not manual inspection.

## 5. Network calls — PASS

`grep -rn "fetch" packages/eir/src` (excluding tests): exactly one call
site, `fallback/geminiProvider.ts:91`, gated behind `fallback.enabled ===
true` **and** the configured key env var being set — `buildFallbackRunner`
returns `null` (no provider constructed at all) unless both hold, so the
default CI path — including this repo's own — makes zero API calls not
because a flag is checked at call time, but because there is nothing to
call.

`packages/ci-action`'s `githubClient.ts` also calls `fetch`, against
GitHub's own REST API using the workflow's `github-token` input — this
only ever runs inside a GitHub Actions job, never as part of the
published `playwright-eir` package (`ci-action` is a separate, unpublished
package — confirmed via `package.json`, no npm `publishConfig`).

## 6. `ci-action` threat model — PASS-WITH-CAVEAT

**What a malicious PR can make the action do:**

- **Same-repo PR (author has write access already):** gets the full
  declared token scope (`pull-requests: write`, `contents: read`) — no
  privilege escalation, since a collaborator with write access already
  has broader repo control than this action grants. Standard, accepted
  trust boundary, not a new risk this review introduces.
- **Fork PR:** the workflow uses plain `pull_request` (not
  `pull_request_target`) — confirmed by reading the trigger list in
  `.github/workflows/ci.yml`. This is the safe choice: GitHub's own
  platform behavior caps a fork PR's `GITHUB_TOKEN` to read-only (or
  requires maintainer approval to run at all, per the repo's "Fork pull
  request workflows" setting) regardless of what permissions the workflow
  file requests, and never exposes base-repo secrets to fork-authored
  code. `pull_request_target` would have been the dangerous choice
  (base-repo token + secrets, running fork-authored code) — not used
  here.
- **Report-path / content:** `ci-action`'s own source contains **zero
  filesystem write calls** (confirmed by grep — only `readFile` in
  `githubContext.ts` and `report.ts`). `report-path` is a workflow-author-
  controlled action input, not attacker-influenced from PR content itself;
  there is no write primitive for a crafted path or report content to
  redirect even if it were. The one field read from the untrusted
  `GITHUB_EVENT_PATH` payload — `pull_request.number` — is type-checked
  (`typeof number === "number"`) before use, so it can't carry a string
  injection payload into the API URL.
- **Rendered comment content:** covered by item 2's fix above — a fork PR
  whose page content contains hostile characters can no longer corrupt
  the comment's table structure.

**Caveat:** this analysis is read-and-reason, not a live fork test. The
one thing it can't independently confirm is whether the comment-posting
step behaves cleanly (or fails gracefully) under a real external fork's
actual default token permissions — this is exactly NOTE-010's scope,
tracked separately and evaluated once the external verification (a
friend's fork) returns results.

## 7. Supply chain — PASS

- **Runtime dependencies of the published package:** `pnpm list --prod
  --depth=Infinity` scoped to `playwright-eir` — exactly one,
  `zod@4.4.3`, itself a leaf package (zero further transitive
  dependencies). Total transitive runtime dependency count: **1**.
- **`ci-action` has zero runtime dependencies** — confirmed via
  `package.json` (only `devDependencies`) and by source inspection
  (`githubClient.ts` uses plain global `fetch`, not `@actions/github`/
  `@octokit`).
- **Tarball contents, this session** (`npm pack --dry-run`, pre-1.0.0
  version — re-run at the actual 1.0.0 version is part of the release
  protocol, not this review): 291 files, 116.4 kB packed / 450.7 kB
  unpacked. Every file is under `dist/` plus `LICENSE`/`README.md`/
  `package.json` at the root — no `.ts` source, no test files, no `.env`,
  nothing outside the declared `"files": ["dist"]`.

---

## Outcome

One real finding (injection surfaces), fixed and regression-guarded
before this document was written — not deferred, not caveated. Everything
else re-verifies clean against the same evidence bar: a live command or a
direct source read, not the audit's word carried forward unchecked. The
one caveat (item 6, `ci-action`'s fork-PR behavior) is already tracked as
NOTE-010 and does not block 1.0 — it's a functional-friction question, not
a security hole; the design choice that would create a real hole
(`pull_request_target`) was never made.
