import { expect, test } from "playwright-eir";

test("fills out the provisioning form using label text and css selectors", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#login-username-input").fill("jordan");
  await page.locator("#login-password-input").fill("hunter2");
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.goto("/dashboard/provisioning");
  await page.getByLabel("Requester Name").fill("Priya Shah");
  await page.locator("input[type='date']").fill("2026-09-15");
  await page.locator("textarea").fill("Temporary contractor access");
  await page.getByLabel("Billing Cycle").selectOption("annual");
  await page.locator("form button[type='submit']").click();

  await expect(page.locator("body")).toContainText("Priya Shah");
});
