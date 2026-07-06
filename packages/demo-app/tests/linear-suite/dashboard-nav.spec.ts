import { expect, test } from "playwright-eir";

test("navigates between all dashboard sections via the sidebar links", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#login-username-input").fill("jordan");
  await page.locator("#login-password-input").fill("hunter2");
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.goto("/dashboard/devices");
  await page.getByRole("link", { name: "Provisioning" }).click();
  await expect(page).toHaveURL(/\/dashboard\/provisioning$/);

  await page.getByRole("link", { name: "Account" }).click();
  await expect(page).toHaveURL(/\/dashboard\/account$/);

  await page.getByRole("link", { name: "Access Requests" }).click();
  await expect(page).toHaveURL(/\/dashboard\/requests\/new/);

  await page.getByRole("link", { name: "Devices" }).click();
  await expect(page).toHaveURL(/\/dashboard\/devices$/);

  await page.getByRole("button", { name: "Log Out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
