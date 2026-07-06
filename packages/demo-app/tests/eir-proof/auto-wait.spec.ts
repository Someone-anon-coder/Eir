import { test, expect } from "playwright-eir";

// Phase 2 (playwright-eir) artifact, not part of Phase 1's 14-spec reference
// suite: proves Playwright's auto-wait/retry survives locator wrapping.
// Nothing in Ward has a genuine async delay, so no existing spec forces the
// actionability-retry loop to poll more than once — this one does, via a
// DOM mutation injected straight from the test, not an app change.
test("clicks a button that only appears after a delay", async ({ page }) => {
  await page.goto("about:blank");
  await page.evaluate(() => {
    setTimeout(() => {
      const button = document.createElement("button");
      button.id = "delayed-button";
      button.textContent = "Delayed Button";
      button.addEventListener("click", () => {
        button.textContent = "Clicked";
      });
      document.body.appendChild(button);
    }, 400);
  });

  await page.locator("#delayed-button").click();

  await expect(page.locator("#delayed-button")).toHaveText("Clicked");
});
