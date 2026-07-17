import { test, expect } from "playwright-eir";

// RISK-005/NOTE-009 (1.0.0 closure session): `page.locator()` returns an
// `EirLocator`, which used to never unwrap back to the real Playwright
// `Locator` it wraps when passed as an *argument* to another Locator's
// method — `.and()`/`.or()`/`.dragTo()`/`.locator(sel, {has})`/`.filter({
// has})` all reach into the real Locator's private `_frame`/`_selector`
// fields directly, and used to find them `undefined` on an `EirLocator`.
// Fixed via a centralized `unwrapLocator`/`unwrapHasOptions` step at every
// such boundary (`eirLocator.ts`). This spec now regression-guards the
// fix instead of documenting the bug.
test("passing one EirLocator as another's .or() argument works — regression guard for RISK-005/NOTE-009", async ({
  page,
}) => {
  await page.goto("about:blank");
  await page.evaluate(() => {
    document.body.innerHTML = '<button id="a">A</button><button id="b">B</button>';
  });

  const a = page.locator("#a");
  const b = page.locator("#b");

  await expect(a.or(b)).toHaveCount(2);
});

test(".and() with an EirLocator argument narrows correctly — regression guard for RISK-005/NOTE-009", async ({
  page,
}) => {
  await page.goto("about:blank");
  await page.evaluate(() => {
    document.body.innerHTML =
      '<button id="a" class="tagged">A</button><button id="b" class="tagged">B</button>';
  });

  const tagged = page.locator(".tagged");
  const isA = page.locator("#a");

  await expect(tagged.and(isA)).toHaveCount(1);
});

test(".locator(sel, { has: EirLocator }) narrows correctly — regression guard for RISK-005/NOTE-009", async ({
  page,
}) => {
  await page.goto("about:blank");
  await page.evaluate(() => {
    document.body.innerHTML =
      '<div class="row"><span class="marker"></span></div><div class="row"></div>';
  });

  const marker = page.locator(".marker");
  await expect(page.locator(".row", { has: marker })).toHaveCount(1);
});

test(".dragTo() with an EirLocator target does not throw on the same-frame check — regression guard for RISK-005/NOTE-009", async ({
  page,
}) => {
  await page.goto("about:blank");
  await page.evaluate(() => {
    document.body.innerHTML =
      '<div id="source" draggable="true" style="width:20px;height:20px;">S</div>' +
      '<div id="target" style="width:20px;height:20px;">T</div>';
  });

  const source = page.locator("#source");
  const target = page.locator("#target");

  // The bug threw synchronously before any drag interaction occurred, on
  // the "Locators must belong to the same frame" check alone — reaching
  // past that point (whatever the drag's own outcome) proves the unwrap.
  await expect(source.dragTo(target)).resolves.toBeUndefined();
});
