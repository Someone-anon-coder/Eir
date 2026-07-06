# Phase 2 — Invisibility Proof

**Claim being tested:** swapping `@playwright/test` for `playwright-eir` in an
existing suite changes nothing observable — same pass/fail verdicts, no
meaningful timing overhead, Playwright's auto-wait/retry semantics intact.

**Method:** the Phase 1 reference suite (14 specs, 7 POM-style / 7 linear-
style) plus one new Phase-2-owned spec (`tests/eir-proof/auto-wait.spec.ts`,
15 total) was run three times each in two conditions, back to back, same
machine, same `pnpm --filter demo-app dev` server, Chromium only:

- **Vanilla** — all specs unmodified, importing `test`/`expect` from
  `@playwright/test` (the committed, permanent state of the reference
  suite).
- **Wrapped** — the same 12 spec files' `test`/`expect` import line
  temporarily changed to `playwright-eir` (a scripted, reverted swap — the
  5 POM files needed _zero_ changes, since their `import type { Page }`
  line was already correct and stayed untouched either way).

## Pass/fail parity

| Run | Vanilla      | Wrapped      |
| --- | ------------ | ------------ |
| 1   | 15/15 passed | 15/15 passed |
| 2   | 15/15 passed | 15/15 passed |
| 3   | 15/15 passed | 15/15 passed |

Identical verdicts across all three runs, both conditions. No spec changed
outcome in either direction.

## Timing

Playwright's own reported suite duration, three runs each:

| Run         | Vanilla   | Wrapped   |
| ----------- | --------- | --------- |
| 1           | 4.8s      | 4.6s      |
| 2           | 4.4s      | 4.6s      |
| 3           | 4.4s      | 4.3s      |
| **Average** | **4.53s** | **4.50s** |

Delta: wrapped averaged ~0.7% _faster_ than vanilla — noise, not signal.
Worth noting honestly: the two vanilla runs alone varied by ~9% from each
other (4.4s–4.8s), which is larger than the vanilla-vs-wrapped delta itself.
At this suite size, wrapping overhead is not distinguishable from ordinary
run-to-run jitter, comfortably inside the 5% bar.

## Auto-wait-dependent spec

`tests/eir-proof/auto-wait.spec.ts` injects a button via `page.evaluate`
that only appears in the DOM ~400ms after the test starts (not a Ward app
change — the delay is injected from the test itself), then does
`await page.locator("#delayed-button").click()`. This forces Playwright's
actionability-retry loop to poll more than once before succeeding — nothing
else in the reference suite has a genuine delay, so this is the one spec
that would catch our `click()` shell breaking Playwright's real retry
behavior instead of just getting lucky on a DOM that was already there.

Passed wrapped, all three runs, ~1.0s each (dominated by the deliberate
400ms `setTimeout`, plus Playwright's own polling interval overhead — both
expected and identical to what vanilla Playwright would do with the same
injected delay).

## `EIR_DEBUG=1` sample

One full spec run (`tests/linear-suite/account-modal.spec.ts`, wrapped),
verbatim:

```
[eir] captured: locator('#login-username-input') on /login
[eir] outcome: fill OK
[eir] captured: locator('#login-password-input') on /login
[eir] outcome: fill OK
[eir] captured: getByRole('button', { name: 'Sign In' }) on /login
[eir] outcome: click OK
[eir] captured: getByRole('button', { name: 'Delete Account' }) on /dashboard/account
[eir] outcome: click OK
[eir] captured: getByRole('dialog', { name: 'Delete Account?' }) on /dashboard/account
[eir] captured: getByRole('button', { name: 'Confirm Delete' }) on /dashboard/account
[eir] outcome: click OK
[eir] captured: getByText('Account deleted.') on /dashboard/account
```

Every selector in the spec produces a `captured` line, including plain CSS
id (`#login-username-input`), role+accessible-name, and text-based
locators. Every imperative call (`fill`, `click`) produces an `outcome`
line. Note the last three `captured` lines have **no** matching `outcome`
line — those locators are only ever used inside
`expect(...).toBeVisible()`/`.toBeHidden()` assertions, which resolve
through Playwright's private `_expect()` polling hook, never through our
public `click`/`fill`/etc. shells. That's expected, not a gap: assertions
were never in Blueprint §7.1's heal-eligible list, and this is the concrete
evidence of that boundary holding in practice, not just in theory.

## Conclusion

All three legs of the Definition of Done's invisibility requirement hold,
measured, not assumed:

- Identical pass/fail across 3×2 runs.
- Timing delta (~0.7%) well inside the 5% bar, smaller than natural
  run-to-run variance.
- The one genuinely auto-wait-dependent spec passes wrapped.
