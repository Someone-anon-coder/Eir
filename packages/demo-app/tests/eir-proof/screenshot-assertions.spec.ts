import { test, expect } from "playwright-eir";

// B2/RISK-003 (1.0.0 closure): `toHaveScreenshot()`'s real implementation
// reaches into private Playwright internals two different ways depending
// on the receiver — confirmed via a real spike, not assumed:
//   - `expect(page).toHaveScreenshot()` calls `page._expectScreenshot(...)`
//     directly on whatever object `expect()` was given.
//   - `expect(locator).toHaveScreenshot()` calls the real page's
//     `_expectScreenshot`, but passes the *locator* through as an option,
//     which reads `.locator._frame._channel`/`.locator._selector` directly.
// Both threw before `eirPage.ts`/`eirLocator.ts` forwarded the relevant
// internals (`_expectScreenshot`, `_frame`, `_selector`). These specs
// regression-guard that fix — a future Playwright upgrade changing any of
// these internals should fail here first.

test("expect(page).toHaveScreenshot() works through EirPage", async ({ page }) => {
  await page.goto("about:blank");
  await page.evaluate(() => {
    document.body.innerHTML = '<div style="width:50px;height:50px;background:red;"></div>';
  });
  await expect(page).toHaveScreenshot("page-level.png");
});

test("expect(locator).toHaveScreenshot() works through EirLocator", async ({ page }) => {
  await page.goto("about:blank");
  await page.evaluate(() => {
    document.body.innerHTML = '<div id="target" style="width:50px;height:50px;background:blue;"></div>';
  });
  const locator = page.locator("#target");
  await expect(locator).toHaveScreenshot("locator-level.png");
});
