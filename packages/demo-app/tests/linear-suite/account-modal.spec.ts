import { expect, test } from "playwright-eir";

test("deletes the account using role-based locators and a text match on the confirmation", async ({
  page,
}) => {
  await page.goto("/login");
  await page.locator("#login-username-input").fill("jordan");
  await page.locator("#login-password-input").fill("hunter2");
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.goto("/dashboard/account");
  await page.getByRole("button", { name: "Delete Account" }).click();
  await expect(page.getByRole("dialog", { name: "Delete Account?" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm Delete" }).click();

  await expect(page.getByText("Account deleted.")).toBeVisible();
});
