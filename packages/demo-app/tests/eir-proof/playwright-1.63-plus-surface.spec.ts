import { test, expect } from "playwright-eir";

// Playwright 1.63/1.64 added Page/Locator members that playwright-eir@1.0.0
// (built against 1.61) never forwarded: the fixture typed `page` as a real
// `Page`, so these calls compiled and then threw `... is not a function` at
// runtime through Eir's wrappers. This spec proves each one now reaches
// the real Playwright object.
//
// CI also runs this suite against older Playwright versions (the
// compatibility matrix), where these members don't exist at all. Feature-
// detect on the *real*, unwrapped objects — `page.mainFrame()` is a plain
// pass-through returning Playwright's own Frame — and skip there instead
// of failing for a reason that isn't Eir's.
type Page = import("@playwright/test").Page;
const realLocatorHas = (page: Page, member: string) => member in page.mainFrame().locator("body");
const realPageHas = (page: Page, member: string) => member in page.mainFrame().page();

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
});

test("locator.within(EirLocator) resolves inside each parent — NOTE-009 unwrap boundary (1.64+)", async ({
  page,
}) => {
  test.skip(!realLocatorHas(page, "within"), "Playwright < 1.64");
  await page.setContent(
    "<table>" +
      "<tr><td>a1</td><td>a2</td><td>a3</td></tr>" +
      "<tr><td>b1</td><td>b2</td><td>b3</td></tr>" +
      "</table>",
  );

  // Receiver and argument are both EirLocators. (Not `.locator("td").nth(2)`
  // — `nth()` returns an untracked real Locator, which would never reach
  // EirLocator#within at all.)
  const thirdColumn = page.locator("td:nth-child(3)").within(page.locator("tr"));

  await expect(thirdColumn).toHaveText(["a3", "b3"]);
});

test("locator.visible() filters to visible elements (1.63+)", async ({ page }) => {
  test.skip(!realLocatorHas(page, "visible"), "Playwright < 1.63");
  await page.setContent('<button style="display:none">Hidden</button><button>Shown</button>');

  await expect(page.locator("button").visible()).toHaveText("Shown");
});

test("locator.waitForFunction() polls against the element (1.63+)", async ({ page }) => {
  test.skip(!realLocatorHas(page, "waitForFunction"), "Playwright < 1.63");
  await page.setContent('<div id="status">Loading</div>');
  await page.evaluate(() => {
    setTimeout(() => {
      const el = document.getElementById("status");
      if (el) el.textContent = "Ready";
    }, 100);
  });

  await expect(
    page.locator("#status").waitForFunction((el, value) => el.textContent === value, "Ready"),
  ).resolves.toBeUndefined();
});

test("locator.ariaSnapshotJSON() and page.ariaSnapshotJSON() return the JSON tree (1.63+/1.64+)", async ({
  page,
}) => {
  test.skip(!realPageHas(page, "ariaSnapshotJSON"), "Playwright < 1.64");
  await page.setContent("<button>Save</button>");

  const fromLocator = JSON.stringify(await page.locator("button").ariaSnapshotJSON());
  const fromPage = JSON.stringify(await page.ariaSnapshotJSON());

  expect(fromLocator).toContain("Save");
  expect(fromPage).toContain("Save");
});

test("page.getByRef() resolves a ref from an AI-mode aria snapshot (1.64+)", async ({ page }) => {
  test.skip(!realPageHas(page, "getByRef"), "Playwright < 1.64");
  await page.setContent("<button>Save</button>");

  const snapshot = await page.ariaSnapshot({ mode: "ai" });
  const ref = /button "Save" \[ref=(\w+)\]/.exec(snapshot)?.[1];
  expect(ref, `no ref for the button in:\n${snapshot}`).toBeDefined();

  await expect(page.getByRef(ref ?? "")).toHaveText("Save");
});

test("page.webmcp is the real WebMCP object, not undefined (1.64+)", async ({ page }) => {
  test.skip(!realPageHas(page, "webmcp"), "Playwright < 1.64");

  expect(page.webmcp).toBe(page.mainFrame().page().webmcp);
});
