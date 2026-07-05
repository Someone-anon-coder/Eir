import { expect, test } from "@playwright/test";

test("removes an archived device using a text-based row locator", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#login-username-input").fill("jordan");
  await page.locator("#login-password-input").fill("hunter2");
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.goto("/dashboard/devices");
  const row = page.getByText("Legacy Barcode Scanner").locator("xpath=ancestor::tr");
  await row.getByRole("button", { name: "Remove" }).click();

  await expect(page.getByText("Legacy Barcode Scanner")).toHaveCount(0);
});

test("edits a device inside the archived table using a class-anchored xpath ancestor walk", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#login-username-input").fill("jordan");
  await page.locator("#login-password-input").fill("hunter2");
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.goto("/dashboard/devices");
  const archivedCard = page.locator(
    "xpath=//h2[text()='Archived Devices']/ancestor::section[contains(@class,'table-card')]",
  );
  // Anchored on the owner column, not the name — the name cell becomes an
  // <input> in edit mode, so a name-based filter would stop matching mid-test.
  const row = archivedCard.locator(".data-table tbody tr", { hasText: "S. Patel" });
  await row.getByRole("button", { name: "Edit" }).click();
  await row.locator("input").fill("Retired Conference Display");
  await row.getByRole("button", { name: "Save" }).click();

  await expect(archivedCard.getByText("Retired Conference Display")).toBeVisible();
});
