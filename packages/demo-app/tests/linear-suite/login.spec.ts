import { expect, test } from "@playwright/test";

test("logs in using id-based locators", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#login-username-input").fill("jordan");
  await page.locator("#login-password-input").fill("hunter2");
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL(/\/dashboard\/devices$/);
});
