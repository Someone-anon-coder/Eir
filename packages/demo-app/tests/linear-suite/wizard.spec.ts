import { expect, test } from "@playwright/test";

test("navigates the wizard forward and back using button text, watching the hash change", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#login-username-input").fill("jordan");
  await page.locator("#login-password-input").fill("hunter2");
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.goto("/dashboard/requests/new");
  await expect(page).toHaveURL(/#step-1$/);

  await page.getByLabel("Request Title").fill("Vendor audit access");
  await page.getByLabel("Requested By").fill("Priya Shah");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/#step-2$/);

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/#step-1$/);
  await expect(page.getByLabel("Request Title")).toHaveValue("Vendor audit access");
});
