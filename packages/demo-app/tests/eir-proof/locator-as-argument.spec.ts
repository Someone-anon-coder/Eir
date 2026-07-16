import { test, expect } from "playwright-eir";

// RISK-005 (Phase 9 hardening): a real, reproducible bug, not a
// theoretical one. `page.locator()` returns an `EirLocator`, which never
// unwraps back to the real Playwright `Locator` it wraps when passed as
// an *argument* to another Locator's method — `.and()`/`.or()` reach
// into the real Locator's private `_frame`/`_selector` fields directly,
// find them `undefined` on an `EirLocator`, and refuse to proceed.
// Documented as a known limitation (README) rather than fixed here — the
// actual fix (an internal unwrap-if-EirLocator step) is real design work
// logged as a fresh NOTES.md entry, not a same-session patch.
test("passing one EirLocator as another's .or() argument throws today — a known limitation (RISK-005)", async ({
  page,
}) => {
  await page.goto("about:blank");
  await page.evaluate(() => {
    document.body.innerHTML = '<button id="a">A</button><button id="b">B</button>';
  });

  const a = page.locator("#a");
  const b = page.locator("#b");

  expect(() => a.or(b)).toThrow(/must belong to the same frame/i);
});
